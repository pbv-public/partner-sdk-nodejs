import assert from 'node:assert'
import fs from 'node:fs'

import fetch from 'node-fetch'

// sent with each new video so PB Vision knows which version of this SDK made it
const PLATFORM = {
  name: 'api',
  version: JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
}

const ENVIRONMENTS = {
  test: {
    apiServer: 'https://api-ko3kowqi6a-uc.a.run.app',
    webApp: 'https://pbv-dev.web.app',
    firebaseConfig: {
      apiKey: 'AIzaSyCV1uh4fM7IFopuZOJ306oVWLV3cKLijFc',
      projectId: 'pbv-dev',
      appId: '1:542837591762:web:06f45c0d7a7e62f25aa70b'
    }
  },
  prod: {
    apiServer: 'https://api-2o2klzx4pa-uc.a.run.app',
    webApp: 'https://pb.vision',
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
    this.webAppUrl = config.webApp
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
   * Gets the email addresses (if any) which have editor access to a video your
   * partner account uploaded.
   *
   * @param {string} vid video id
   */
  async getVideoEditors (vid) {
    return this.__callAPI('video/editors/get', { vid })
  }

  /**
   * Sets the email addresses (if any) which have editor access to a video your
   * partner account uploaded.
   *
   * @param {string} vid video id
   * @param {Array<string>} editorEmails a list of 0 to 8 email addresses to
   *   allow edit access to the video (replaces any previous editors list).
   * @param {Array<string>} viewerEmails a list of 0 to 8 email addresses to
   *   allow view access to the video (replaces any previous editors list).
   */
  async setVideoEditors (vid, editorEmails, viewerEmails) {
    return this.__callAPI('video/editors/set', { vid, editorEmails, viewerEmails })
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
  async sendVideoUrlToDownload (videoUrl, { userEmails = [], name, desc, gameStartEpoch, facility, court, fid, playersForTagging } = {}) {
    assert(typeof videoUrl === 'string' && videoUrl.startsWith('http'),
      'URL must be a string beginning with http')
    assert(videoUrl.split('?')[0].endsWith('.mp4'), 'video URL must have the .mp4 extension')
    const resp = await this.__callAPI(
      'add_video_by_url',
      { url: videoUrl, userEmails, name, desc, gameStartEpoch, facility, court, fid, playersForTagging })
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
   * @property {integer} [fid] the ID of the folder in your partner account's
   *   library to add this video to (see getOrCreateFolder()). A fid that is
   *   not one of your folders is refused.
   * @property {PlayersForTagging} [playersForTagging] the players to tag
   *   automatically once processing completes, each by a name, an email, or
   *   both. Identify players by their role at the start of the first game.
   *   Honored by uploadVideo(), sendVideoUrlToDownload(), and makeVideoId().
   */

  /**
   * The players to tag automatically once the video is processed, identified
   * by their role at the start of the first game. The team that serves first
   * supplies `server` (its first server) and `serverPartner`. The other team's
   * first server is `receiver`: they start on the right and receive the first
   * serve. Their partner is `receiverPartner`. Omit both partners for singles.
   * Each email may be given for only one player.
   * @typedef {Object} PlayersForTagging
   * @property {PlayerForTagging} server the player who served the first point
   * @property {PlayerForTagging} receiver the player who received the first point
   * @property {PlayerForTagging} [serverPartner] the server's partner (omit for singles)
   * @property {PlayerForTagging} [receiverPartner] the receiver's partner (omit for singles)
   */

  /**
   * A player to tag, identified by a name, an email, or both. At least one of
   * the two is required.
   * @typedef {Object} PlayerForTagging
   * @property {string} [name] what to call the player: 1 to 64 characters
   *   after trimming. Shown unless the email belongs to a PB Vision account,
   *   in which case that account's own name is shown.
   * @property {string} [email] the player's email address. The player is
   *   emailed that they were tagged. If the address belongs to a PB Vision
   *   account, the game is added to that account's library; if not, the game
   *   joins their library when they sign up with this address.
   */

  /**
   * Allocate a new video ID *without* uploading a file yourself. Useful when the
   * video will be recorded and uploaded by another client — e.g. the PB Vision
   * mobile app opened via a deeplink. Pass the returned `vid` (and `uid`) to that
   * client so it uploads to this video instead of allocating a new one.
   *
   * @param {VideoMetadata & {fileExt?: string}} [metadata] `fileExt` is the
   *   extension the video will be uploaded with; defaults to "mp4"
   * @returns {{vid: (string|undefined), uid: string, hasCredits: (boolean|undefined)}}
   *   the new video id and the uid it belongs to. `hasCredits` is false, with
   *   no `vid`, when the account paying for the video can't pay for it; for
   *   passthrough partners it is always present.
   */
  async makeVideoId ({ fileExt = 'mp4', userEmails = [], name, desc, gameStartEpoch, facility, court, fid, playersForTagging } = {}) {
    const resp = await this.__callAPI('make_video_id',
      { platform: PLATFORM, fileExt, userEmails, name, desc, gameStartEpoch, facility, court, fid, playersForTagging })
    const { hasCredits, vid } = JSON.parse(resp)
    const ret = { vid, uid: this.uid }
    if (hasCredits !== undefined) {
      ret.hasCredits = hasCredits
    }
    return ret
  }

  /**
   * Upload a video for processing by the AI.
   *
   * The video is only uploaded if the account paying for it has credit(s)
   * available with which the video can be analyzed. If not, nothing is
   * uploaded and this returns `{ hasCredits: false }` with no `vid`.
   *
   * @param {string} mp4Filename
   * @param {VideoMetadata} [metadata]
   * @returns {VideoUrlToDownloadResponse}
   */
  async uploadVideo (mp4Filename, metadata = {}) {
    const pieces = mp4Filename.split('.')
    const ext = pieces[pieces.length - 1]
    const { hasCredits, vid } = await this.makeVideoId({ ...metadata, fileExt: ext })
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

  /**
   * @typedef {Object} GetOrCreateFolderResponse
   * @property {integer} fid the folder's ID; pass it as the `fid` metadata
   *   field to put a new video in this folder
   * @property {boolean} created true if this call created the folder, false if
   *   it already existed
   */

  /**
   * Gets the folder in your partner account's library with exactly this name,
   * creating it if there is none. Calling it again with the same name returns
   * the same folder, as long as it hasn't been renamed or moved since, so it
   * is safe to retry.
   *
   * Use a unique name for each event, such as one that includes its date;
   * otherwise two events with the same name would share one folder.
   *
   * @param {string} name the folder's name: 1 to 200 characters, with no
   *   leading or trailing whitespace
   * @param {Object} [options]
   * @param {integer} [options.parent] the ID of the folder to look in, and to
   *   create the folder in; omit for the top level of your library
   * @returns {GetOrCreateFolderResponse}
   */
  async getOrCreateFolder (name, { parent } = {}) {
    const resp = await this.__callAPI('folder/get_or_create', { name, parent })
    const { fid, created } = JSON.parse(resp)
    return { fid, created }
  }

  /**
   * Renames a folder in your partner account's library, moves it, or changes
   * whether it is public. Fields you omit are left as they are.
   *
   * @param {integer} fid the ID of the folder to change
   * @param {Object} [changes]
   * @param {string} [changes.name] the folder's new name: 1 to 200 characters,
   *   with no leading or trailing whitespace
   * @param {?integer} [changes.parent] the ID of the folder to move it into, or
   *   null to move it to the top level of your library
   * @param {boolean} [changes.public] whether anyone with the folder's link may
   *   view it, signed in or not (see getPublicFolderUrl())
   */
  async updateFolder (fid, { name, parent, public: isPublic } = {}) {
    await this.__callAPI('folder/update', { fid, name, parent, public: isPublic })
  }

  /**
   * The link to a folder's page on PB Vision, where anyone can view its videos
   * once the folder is public (see updateFolder()).
   *
   * @param {integer} fid the folder's ID
   * @returns {string}
   */
  getPublicFolderUrl (fid) {
    assert(Number.isInteger(fid) && fid > 0, `invalid folder ID: ${fid}`)
    return `${this.webAppUrl}/library/public/${encodeURIComponent(this.uid)}/${fid}`
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
