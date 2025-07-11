import assert from 'node:assert'
import fs from 'node:fs'

import fetch from 'node-fetch'

const ENVIRONMENTS = {
  test: {
    apiServer: 'https://api-ko3kowqi6a-uc.a.run.app',
    firebaseConfig: {
      apiKey: 'AIzaSyCV1uh4fM7IFopuZOJ306oVWLV3cKLijFc',
      projectId: 'pbv-dev',
      appId: '1:542837591762:web:06f45c0d7a7e62f25aa70b'
    }
  },
  prod: {
    apiServer: 'https://api-2o2klzx4pa-uc.a.run.app',
    firebaseConfig: {
      apiKey: 'AIzaSyCzC8mfo38HtkOR-_Y6xb7Pevp72LkrYfc',
      projectId: 'pbv-prod',
      appId: '1:439056169365:web:8b76be9c7cb7a2a13f5e9c'
    }
  }
}

/** @public */
export class PBVision {
  constructor (apiKey,  { useProdServer = false } = {}) {
    const underscoreIndex = apiKey.lastIndexOf('_')
    assert(apiKey && underscoreIndex !== -1, `invalid API key: ${apiKey}`)

    this.apiKey = apiKey
    this.uid = apiKey.substring(0, underscoreIndex)
    const config = useProdServer ? ENVIRONMENTS.prod : ENVIRONMENTS.test
    this.server = config.apiServer
    this.isDev = config === ENVIRONMENTS.test
  }

  /**
   * Tells PB Vision to make an HTTP POST request your URL after each of your
   * videos is done processing.
   *
   * @param {string} webhookUrl must start with https://
   */
  async setWebhook (webhookUrl) {
    assert(typeof webhookUrl === 'string' && webhookUrl.startsWith('https://'),
      'URL must be a string beginning with https://')
    return this.__callAPI('webhook/set', { url: webhookUrl })
  }

  /**
   * @typedef {Object} VideoUrlToDownloadResponse
   * @property {string} vid the ID of the new video
   * @property {boolean} [hasCredits] for passthrough partners, this field will
   *   be present and indicate whether the first user has any credits available
   */

  /**
   * Tells PB Vision to download the specified video and process it. When
   * processing is complete, your webhook URL will receive a callback.
   *
   * @param {string} videoUrl the publicly available URL of the video
   * @param {VideoMetadata} [metadata]
   * @returns {VideoUrlToDownloadResponse}
   */
  async sendVideoUrlToDownload (videoUrl, { userEmails = [], name, desc, gameStartEpoch, facility, court, fid } = {}) {
    assert(typeof videoUrl === 'string' && videoUrl.startsWith('http'),
      'URL must be a string beginning with http')
    assert(videoUrl.split('?')[0].endsWith('.mp4'), 'video URL must have the .mp4 extension')
    const resp = await this.__callAPI(
      'add_video_by_url',
      { url: videoUrl, userEmails, name, desc, gameStartEpoch, facility, court, fid })
    return JSON.parse(resp)
  }

  async __callAPI (path, body) {
    const resp = await fetch(`${this.server}/partner/${path}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'content-type': 'application/json'
      },
      compress: true,
      body: JSON.stringify(body)
    })
    const respBody = await resp.text()
    if (resp.ok) {
      return respBody || true
    }
    throw new Error(`PB Vision API ${path} failed (${resp.status}): ${respBody}`)
  }

  /**
   * Information about the Video that can be set prior to it being uploaded.
   * @typedef {Object} VideoMetadata
   * @property {Array<string>} userEmails a list of email addresses of up to 4
   *   players who were playing in the game; they will also be notified when
   *   the video processing is complete (unless they have these notifications
   *   disabled)
   * @property {string} [name] the title of the game (if omitted, we'll use the
   *   time of the game, or if that isn't provided then the time of the upload)
   * @property {string} [desc] a longer description of the game
   * @property {integer} [gameStartEpoch] the epoch at which the game started
   * @property {string} [facility] the facility where the game was recorded (e.g., "Cool Club #3 - Barcelona")
   * @property {string} [court] the court where the game was recorded (e.g., "11A")
   * @property {integer} [fid] the ID of the folder in which this video should be added
   */

  /**
   * Upload a video for processing by the AI.
   *
   * For passthrough partners, the video is only uploaded if the paying user
   * has credit(s) available with which the video can be analyzed.
   *
   * @param {string} mp4Filename
   * @param {VideoMetadata} [metadata]
   * @returns {VideoUrlToDownloadResponse}
   */
  async uploadVideo (mp4Filename, { userEmails = [], name, desc, gameStartEpoch, facility, court, fid } = {}) {
    const pieces = mp4Filename.split('.')
    const ext = pieces[pieces.length - 1]
    const makeVIDResp = await this.__callAPI('make_video_id', { userEmails, name, desc, gameStartEpoch, facility, court, fid, fileExt: ext })
    const { hasCredits, vid } = JSON.parse(makeVIDResp)
    if (hasCredits === false) {
      return { hasCredits }
    }
    const bucket = `pbv-uploads${this.isDev ? '-dev' : ''}`
    const objName = `${this.uid}/${vid}.${ext}`
    await uploadToGCS(bucket, objName, mp4Filename)
    const ret = { vid }
    if (hasCredits !== undefined) {
      ret.hasCredits = hasCredits
    }
    return ret
  }
}

async function uploadToGCS (bucket, objName, filename) {
  // request to start a new upload
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=resumable&name=${objName}`
  const numBytesTotal = fs.statSync(filename).size
  let headers = { 'X-Upload-Content-Length': numBytesTotal }
  let resp = await fetch(url, { method: 'POST', headers })
  if (!resp.ok) {
    throw new Error(`PB Vision Upload failed to initialize (${resp.status}): ${await resp.text()}`)
  }
  const sessionURI = resp.headers.get('Location')

  // determine how much data to read from the file at once; larger tends to
  // result in faster uploads but also has a bigger memory footprint
  const minChunkSz = 256 * 1024 // this is the *minimum* size
  const targetChunkSzMB = 8
  const chunkSize = Math.max(minChunkSz, targetChunkSzMB * 1024 * 1024)

  // upload one chunk at a time until it is done successfully
  let startIdx = 0
  while (startIdx < numBytesTotal) {
    let endIdx = startIdx + chunkSize - 1
    endIdx = Math.min(endIdx, numBytesTotal - 1)
    const thisChunkSize = endIdx - startIdx + 1

    // read just the chunk we need from the file
    const streamPromise = new Promise((resolve, reject) => {
      const chunk = Buffer.alloc(thisChunkSize)
      let chunkBytesRead = 0
      const stream = fs.createReadStream(
        filename, { start: startIdx, end: endIdx })
      stream.on('data', x => {
        x.copy(chunk, chunkBytesRead)
        chunkBytesRead += x.length
      })
      stream.on('end', () => resolve(chunk))
      stream.on('error', e => reject(e))
    })
    let chunk
    try {
      chunk = await streamPromise
    } catch (e) {
      throw new Error(`PB Vision Upload failed to read from file ${e.toString()}`)
    }

    headers = {
      'Content-Length': chunk.length,
      'Content-Range': `bytes ${startIdx}-${endIdx}/${numBytesTotal}`
    }
    assert(chunk.length <= numBytesTotal)
    assert(chunk.length === endIdx - startIdx + 1)
    resp = await fetch(sessionURI, { method: 'PUT', headers, body: chunk })
    if (!resp.status >= 400) {
      throw new Error(`PB Vision Upload failed to upload chunk ${startIdx} (${resp.status}): ${await resp.text()} ${JSON.stringify(resp.headers.raw())}`)
    }
    startIdx = endIdx + 1
  }
  return true
}
