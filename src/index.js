import assert from 'node:assert'

import fetch from 'node-fetch'

export class PBVision {
  constructor (apiKey, server = 'https://api-ko3kowqi6a-uc.a.run.app') {
    assert(apiKey && apiKey.length === 31 && apiKey.indexOf('_') === 10,
      `invalid API key: ${apiKey}`)

    this.apiKey = apiKey
    this.server = server
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
   * Tells PB Vision to download the specified video and process it. When
   * processing is complete, your webhook URL will receive a callback.
   *
   * @param {string} videoUrl the publicly available URL of the video
   * @param {Array<string>} [playerEmails] the email addresses of players in
   *   this video; they'll be notified when the video is done processing
   * @returns
   */
  async sendVideoUrlToDownload (videoUrl, playerEmails = []) {
    assert(typeof videoUrl === 'string' && videoUrl.startsWith('http'),
      'URL must be a string beginning with http')
    assert(videoUrl.endsWith('.mp4'), 'video URL must have the .mp4 extension')
    return this.__callAPI(
      'add_video_by_url', { url: videoUrl, userEmails: playerEmails })
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
    if (resp.ok) {
      return true
    }
    const errBody = await resp.text()
    throw new Error(`PB Vision API ${path} failed (${resp.status}): ${errBody}`)
  }
}
