import assert from 'node:assert'
import crypto from 'node:crypto'

/**
 * Creates the name for a video file to upload to our uploads bucket.
 *
 * The name is signed with the uploader's API Key to prove that the upload is
 * indeed from them.
 *
 * The object name is formatted like:
 * <User ID>/<Video ID>-<Security Hash>.<File Extension>
 *
 * @param {Object} opts information about the video upload
 * @param {string} opts.uploaderUID the video uploader's user ID
 * @param {string} opts.signingKey the video uploader's API Key
 * @param {string} [opts.fileExt] the video's file extension
 * @param {string} [opts.bucket] the GCS bucket to upload to
 * @returns {string} the signed GCS object filename
 * @public
 */
export function makeSignedGoogleCloudStorageVideoObjectName ({
  uploaderUID,
  signingKey,
  fileExt = 'mp4',
  bucket = 'pbv-uploads',
  uploadId = undefined
}) {
  assert(typeof uploaderUID === 'string' && uploaderUID.length)
  assert(typeof signingKey === 'string' && signingKey.length)
  uploadId = uploadId ?? crypto.randomUUID().replace(/-/g, '')
  assert(typeof uploadId === 'string' && uploadId.length === 32)
  return makeObjectName(uploaderUID, signingKey, uploadId, fileExt, bucket)
}

/**
 * Returns the hash from the parameters used to construct a GCS object name.
 *
 * The hash includes all elements of the file's unique path (including the
 * bucket) except for the hash itself.
 */
function getHash (uploaderUID, signingKey, uploadId, fileExt, bucket) {
  const nameWithEmptyHash = makeObjectNameGivenHash(
    uploaderUID, uploadId, fileExt, '')
  return crypto.createHash('sha256')
    .update(signingKey + bucket + nameWithEmptyHash)
    .digest('hex')
}

/**
 * Returns the full GCS object name (including hash) for the given parameters.
 */
function makeObjectName (uploaderUID, signingKey, uploadId, fileExt, bucket) {
  const hash = getHash(uploaderUID, signingKey, uploadId, fileExt, bucket)
  const nameWithHash = makeObjectNameGivenHash(
    uploaderUID, uploadId, fileExt, hash)
  return nameWithHash
}

/**
 * Returns the full GCS object name using the specified hash string.
 */
function makeObjectNameGivenHash (uploaderUID, uploadId, fileExt, hash) {
  assert(uploaderUID.indexOf('/') === -1)
  return `${uploaderUID}/${uploadId}-${hash}.${fileExt}`
}
