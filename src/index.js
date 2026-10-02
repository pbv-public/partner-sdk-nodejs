import assert from 'node:assert'
import fs from 'node:fs'

import fetch from 'node-fetch'

// sent with each new video so PB Vision knows which version of this SDK made
// it. Read lazily and forgivingly: an app bundled with a tool like esbuild may
// not ship this package's package.json, or may ship its own in its place.
let platform
function getPlatform () {
  if (!platform) {
    let version = 'unknown'
    try {
      const pkg = JSON.parse(
        fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
      if (pkg.name === '@pbvision/partner-sdk' && pkg.version) {
        version = pkg.version
      }
    } catch {
      // keep 'unknown'
    }
    platform = { name: 'api', version }
  }
  return platform
}

// the camera settings a recording link may ask the PB Vision app for
const RECORDING_RESOLUTIONS = ['1080p', '4k']
const RECORDING_FPS = [30, 60]

const ENVIRONMENTS = {
  test: {
    apiServer: 'https://api-ko3kowqi6a-uc.a.run.app',
    webApp: 'https://pbv-dev.web.app',
    // development builds of the PB Vision app can't open https links, so test
    // links use the app's own scheme, which store builds open too
    recordLink: 'pbvision://record',
    firebaseConfig: {
      apiKey: 'AIzaSyCV1uh4fM7IFopuZOJ306oVWLV3cKLijFc',
      projectId: 'pbv-dev',
      appId: '1:542837591762:web:06f45c0d7a7e62f25aa70b'
    }
  },
  prod: {
    apiServer: 'https://api-2o2klzx4pa-uc.a.run.app',
    webApp: 'https://pb.vision',
    recordLink: 'https://pb.vision/record',
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
    this.recordUrl = config.recordLink
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
   *   Honored by uploadVideo(), sendVideoUrlToDownload(), makeVideoId(), and
   *   makeRecordingLink().
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
   * video will be recorded and uploaded by another client. Pass the returned
   * `vid` (and `uid`) to that client so it uploads to this video instead of
   * allocating a new one. To have the game recorded with the PB Vision app,
   * use makeRecordingLink() instead.
   *
   * @param {VideoMetadata} [metadata] the video's metadata, plus fileExt
   * @param {string} [metadata.fileExt="mp4"] the extension the video will be
   *   uploaded with
   * @param {string} [metadata.nonce] 1 to 200 characters you choose, such as
   *   your own ID for the game. Every call with the same nonce gets the same
   *   video, even calls made at the same moment; the first call decides its
   *   metadata. Until the video is uploaded, each call checks that the account
   *   paying for it can still pay; if not, that call gets no video (`hasCredits`
   *   false), and a later call gets the same video once it can. A call that
   *   gets no video doesn't use the nonce up.
   * @returns {{vid: (string|undefined), uid: string, hasCredits: (boolean|undefined)}}
   *   the new video id and the uid it belongs to. `hasCredits` is false, with
   *   no `vid`, when the account paying for the video can't pay for it; for
   *   passthrough partners it is always present.
   */
  async makeVideoId ({ fileExt = 'mp4', userEmails = [], name, desc, gameStartEpoch, facility, court, fid, playersForTagging, nonce } = {}) {
    const resp = await this.__callAPI('make_video_id',
      { platform: getPlatform(), fileExt, userEmails, name, desc, gameStartEpoch, facility, court, fid, playersForTagging, nonce })
    const { hasCredits, vid } = JSON.parse(resp)
    const ret = { vid, uid: this.uid }
    if (hasCredits !== undefined) {
      ret.hasCredits = hasCredits
    }
    return ret
  }

  /**
   * The video's details and camera settings for makeRecordingLink(). The
   * details are the same as in VideoMetadata, except that there is no
   * gameStartEpoch: the game's time comes from its recording.
   * @typedef {Object} RecordingLinkOptions
   * @property {Array<string>} [userEmails] the email addresses of up to 4
   *   players in the game (see VideoMetadata)
   * @property {string} [name] the title of the game
   * @property {string} [desc] a longer description of the game
   * @property {string} [facility] the facility where the game is played
   * @property {string} [court] the court where the game is played
   * @property {integer} [fid] the ID of the folder in your partner account's
   *   library to add the video to (see getOrCreateFolder())
   * @property {PlayersForTagging} [playersForTagging] the players to tag
   *   automatically once processing completes
   * @property {string} [nonce] identifies the game, e.g. your own ID for it:
   *   every call with the same nonce returns the same video and link (see
   *   makeVideoId())
   * @property {string} [resolution='1080p'] the resolution to record at:
   *   '1080p' or '4k'. 4K requires your partner account to have 4K enabled;
   *   otherwise PB Vision rejects the upload.
   * @property {integer} [fps=30] the frame rate to record at: 30 or 60
   * @property {boolean} [mayChangeResolution=false] whether the person
   *   recording may choose a different resolution in the app
   * @property {boolean} [mayChangeFPS=false] whether the person recording may
   *   choose a different frame rate in the app
   */

  /**
   * @typedef {Object} RecordingLink
   * @property {string} vid the ID of the video the recording will upload to
   * @property {string} uid the ID of your partner account, which owns the video
   * @property {string} url the link that opens the PB Vision app to record the
   *   game
   */

  /**
   * Makes a video for a game and a link that opens the PB Vision app on a
   * phone straight to its camera, to record the game into that video. Anyone
   * can record from the link, signed in to PB Vision or not. On a phone
   * without the app, the link shows a page for installing it.
   *
   * By default the app records at 1080p and 30 FPS, and the person recording
   * can't change either. A phone that can't record what the link asks for
   * steps down to the best quality it supports. The link's settings apply
   * regardless of the recorder's own PB Vision subscription, but 4K requires
   * your partner account to have 4K enabled; otherwise PB Vision rejects the
   * upload.
   *
   * Each link is for one recording: only the first upload to its video
   * counts, so make a new link for each game. If several people may ask for
   * the same game's link, pass the same `nonce` (e.g. your own ID for the
   * game) and they all get one video and one link.
   *
   * Open the link with a real tap (e.g. in a text message, an email, or a
   * scanned QR code) or by handing it to the phone's operating system, not
   * inside a webview, so that the phone can open the PB Vision app.
   *
   * With the test server (`useProdServer: false`), the link starts with
   * `pbvision://record` and needs a development build of the PB Vision app.
   *
   * @param {RecordingLinkOptions} [options]
   * @returns {RecordingLink}
   * @throws {Error} if gameStartEpoch is given, a camera setting is invalid,
   *   or PB Vision doesn't make the video (e.g. because the account paying for
   *   it can't pay for it)
   */
  async makeRecordingLink ({
    resolution = '1080p', fps = 30, mayChangeResolution = false, mayChangeFPS = false,
    gameStartEpoch, userEmails, name, desc, facility, court, fid, playersForTagging, nonce
  } = {}) {
    assert(gameStartEpoch === undefined,
      'makeRecordingLink() does not take gameStartEpoch: the game\'s time comes from its recording, and a time set now would override it')
    assert(RECORDING_RESOLUTIONS.includes(resolution),
      `resolution must be '1080p' or '4k', not ${JSON.stringify(resolution)}`)
    assert(RECORDING_FPS.includes(fps), `fps must be 30 or 60, not ${JSON.stringify(fps)}`)
    assert(typeof mayChangeResolution === 'boolean', 'mayChangeResolution must be a boolean')
    assert(typeof mayChangeFPS === 'boolean', 'mayChangeFPS must be a boolean')

    const { vid, uid, hasCredits } = await this.makeVideoId({
      fileExt: 'mp4', userEmails, name, desc, facility, court, fid, playersForTagging, nonce })
    if (hasCredits === false) {
      throw new Error('PB Vision did not make a video for this recording link: the account paying for it has no credits available (hasCredits is false)')
    }
    if (!vid) {
      throw new Error('PB Vision did not return a video ID for this recording link')
    }
    // env=test lets the app explain a test-server link it can't record,
    // instead of recording a game whose video exists only on the test server
    const params = { vid, uid, resolution, fps, mayChangeResolution, mayChangeFPS }
    if (this.isDev) {
      params.env = 'test'
    }
    // encodeURIComponent() rather than URLSearchParams, which writes a space
    // as "+" and not every app reads that back as a space
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')
    return { vid, uid, url: `${this.recordUrl}?${query}` }
  }

  /**
   * Upload a video for processing by the AI.
   *
   * The video is only uploaded if the account paying for it has credit(s)
   * available with which the video can be analyzed. If not, nothing is
   * uploaded and this returns `{ hasCredits: false }` with no `vid`.
   *
   * The upload resumes by itself after a dropped connection or a temporary
   * error from the storage service. If it still fails, the error thrown has
   * the video's ID as its `vid` property. To retry without making a second
   * video for the game, pass a `nonce` (see makeVideoId()): calling this again
   * with the same nonce uploads to the same video.
   *
   * @param {string} mp4Filename
   * @param {VideoMetadata} [metadata]
   * @returns {VideoUrlToDownloadResponse}
   * @throws {Error} if the upload fails, with the video's ID as `vid`. A
   *   missing or empty file is refused before any video is made.
   */
  async uploadVideo (mp4Filename, metadata = {}) {
    // checked before making the video, so a file that can't be uploaded
    // doesn't leave a video behind that never gets one
    const stats = await fs.promises.stat(mp4Filename)
    assert(stats.isFile(), `cannot upload ${mp4Filename}: it is not a file`)
    assert(stats.size > 0, `cannot upload ${mp4Filename}: the file is empty`)
    const pieces = mp4Filename.split('.')
    const ext = pieces[pieces.length - 1]
    const { hasCredits, vid } = await this.makeVideoId({ ...metadata, fileExt: ext })
    if (hasCredits === false) {
      return { hasCredits }
    }
    const bucket = `pbv-uploads${this.isDev ? '-dev' : ''}`
    const objName = `${this.uid}/${vid}.${ext}`
    try {
      await uploadToGCS(bucket, objName, mp4Filename)
    } catch (e) {
      const err = new Error(`PB Vision Upload of video ${vid} failed: ${e.message}`, { cause: e })
      err.vid = vid
      throw err
    }
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
   *   view it, signed in or not (see getPublicFolderUrl()). A folder inside a
   *   public folder is only shown with it if it is public too.
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

// How uploadToGCS() reads and sends the file: one chunk in memory at a time.
// GCS needs every chunk but the last to be a multiple of 256 KiB; larger
// chunks tend to upload faster but take more memory.
const UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024

// How uploadToGCS() retries a request that fails with a network error or a
// temporary server error: up to UPLOAD_MAX_RETRIES times in a row without the
// upload making progress, waiting about twice as long before each retry, up to
// UPLOAD_MAX_RETRY_DELAY_MS (plus up to a second at random).
const UPLOAD_MAX_RETRIES = 6
const UPLOAD_FIRST_RETRY_DELAY_MS = 1000
const UPLOAD_MAX_RETRY_DELAY_MS = 32000

// Uploads a file to GCS with a resumable upload, following GCS's protocol: a
// 308 response says how much GCS has stored so far (its Range header), and the
// upload is only done once GCS answers 200 or 201. After a network error or a
// temporary server error, it waits, asks GCS how much it has stored, and goes
// on from there. Throws an Error saying why if the upload fails.
async function uploadToGCS (bucket, objName, filename) {
  const file = await fs.promises.open(filename, 'r')
  try {
    const { size: numBytesTotal } = await file.stat()
    if (numBytesTotal === 0) {
      throw new Error('the file is empty') // it was emptied after it was checked
    }
    const sessionURI = await startResumableUpload(bucket, objName, numBytesTotal)

    let offset = 0 // how many bytes GCS has stored
    let failures = 0 // tries in a row which made no progress
    let mustAskOffset = false // whether to ask GCS for the offset before sending
    for (;;) {
      let request, action
      if (mustAskOffset) {
        action = 'checking the upload\'s progress'
        request = {
          method: 'PUT',
          headers: { 'Content-Length': '0', 'Content-Range': `bytes */${numBytesTotal}` }
        }
      } else {
        const endIdx = Math.min(offset + UPLOAD_CHUNK_SIZE, numBytesTotal) - 1
        action = `uploading bytes ${offset}-${endIdx}`
        // a file that can't be read is not worth retrying, so this throws
        const chunk = await readChunk(file, offset, endIdx - offset + 1, numBytesTotal)
        request = {
          method: 'PUT',
          headers: {
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${offset}-${endIdx}/${numBytesTotal}`
          },
          body: chunk
        }
      }

      let resp, respBody, problem
      try {
        resp = await fetch(sessionURI, request)
        respBody = await resp.text()
      } catch (e) {
        // even a 200 whose body was cut off is confirmed by asking GCS
        resp = undefined
        problem = `network error while ${action}: ${e.message}`
      }

      if (resp && (resp.status === 200 || resp.status === 201)) {
        return
      }
      if (resp?.status === 308) {
        const stored = parseStoredRange(resp.headers.get('Range'), numBytesTotal)
        if (stored === numBytesTotal) {
          throw new Error(`GCS stored all ${numBytesTotal} bytes but did not finish the upload (308)`)
        }
        const madeProgress = stored > offset
        const wasAsking = mustAskOffset
        problem = `GCS stored nothing more while ${action} (308, offset ${stored})`
        offset = stored
        mustAskOffset = false
        if (madeProgress) {
          failures = 0
          continue
        }
        if (wasAsking) {
          continue // the failure that made us ask was already counted
        }
        // GCS kept none of the chunk: resend it, after a wait
      } else if (resp && !isTemporaryStatus(resp.status)) {
        if (mustAskOffset && (resp.status === 404 || resp.status === 410)) {
          throw new Error(`the upload session expired (${resp.status}): ${respBody}`)
        }
        throw new Error(`GCS answered ${resp.status} while ${action}: ${respBody}`)
      } else {
        problem ??= `GCS answered ${resp.status} while ${action}: ${respBody}`
        mustAskOffset = true
      }

      failures++
      if (failures > UPLOAD_MAX_RETRIES) {
        throw new Error(`gave up after ${UPLOAD_MAX_RETRIES} retries; last error: ${problem}`)
      }
      await waitBeforeRetry(failures)
    }
  } finally {
    await file.close()
  }
}

// Starts a resumable upload and returns its session URI.
async function startResumableUpload (bucket, objName, numBytesTotal) {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=resumable&name=${objName}`
  for (let failures = 0; ; failures++) {
    let resp, respBody, problem
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'X-Upload-Content-Length': String(numBytesTotal) }
      })
      respBody = await resp.text()
    } catch (e) {
      problem = `network error while initializing: ${e.message}`
    }
    if (resp?.ok) {
      const sessionURI = resp.headers.get('Location')
      if (!sessionURI) {
        throw new Error('GCS started the upload but gave no session URI')
      }
      return sessionURI
    }
    if (resp && !isTemporaryStatus(resp.status)) {
      throw new Error(`failed to initialize (${resp.status}): ${respBody}`)
    }
    problem ??= `GCS answered ${resp.status} while initializing: ${respBody}`
    if (failures >= UPLOAD_MAX_RETRIES) {
      throw new Error(`gave up after ${UPLOAD_MAX_RETRIES} retries; last error: ${problem}`)
    }
    await waitBeforeRetry(failures + 1)
  }
}

// GCS asks clients to retry these, with exponential backoff
function isTemporaryStatus (status) {
  return status >= 500 || status === 408 || status === 429
}

async function waitBeforeRetry (retryNumber) {
  const delayMs = Math.min(
    UPLOAD_FIRST_RETRY_DELAY_MS * 2 ** (retryNumber - 1), UPLOAD_MAX_RETRY_DELAY_MS)
  await new Promise(resolve => setTimeout(resolve, delayMs + Math.random() * 1000))
}

// Returns how many bytes a 308's Range header (e.g. "bytes=0-1048575") says
// GCS has stored; no Range header means none.
function parseStoredRange (range, numBytesTotal) {
  if (range === null) {
    return 0
  }
  const match = /^bytes=0-(\d+)$/.exec(range)
  const stored = match ? Number(match[1]) + 1 : NaN
  if (!(stored <= numBytesTotal)) {
    throw new Error(`GCS sent an unexpected Range header: ${range}`)
  }
  return stored
}

// Reads length bytes of the file, starting at position.
async function readChunk (file, position, length, numBytesTotal) {
  const chunk = Buffer.alloc(length)
  let chunkBytesRead = 0
  while (chunkBytesRead < length) {
    const { bytesRead } = await file.read(
      chunk, chunkBytesRead, length - chunkBytesRead, position + chunkBytesRead)
    if (bytesRead === 0) {
      throw new Error(`the file ended at byte ${position + chunkBytesRead}, before the ${numBytesTotal} bytes it had when the upload started`)
    }
    chunkBytesRead += bytesRead
  }
  return chunk
}
