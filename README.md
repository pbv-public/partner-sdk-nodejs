# PB Vision Partner Documentation <!-- omit in toc -->

For policies, pricing, and partner responsibilities refer to our [API Partner Guide](https://help.pb.vision/en/help/articles/2793895-pb-vision-api-partner-guide).

The easiest way to use the PB Vision AI Engine is to simply share a link to
your video file. Our AI usually works on each video for about 30 minutes for a
standard length game, so we'll notify your servers when the results are ready.

- [Installation](#installation)
  - [Step 1: Get API Access](#step-1-get-api-access)
  - [Step 2: SDK Setup](#step-2-sdk-setup)
- [Using the API](#using-the-api)
  - [Webhook Setup](#webhook-setup)
  - [Send Videos](#send-videos)
    - [Option 1: PBV downloads your video from a URL](#option-1-pbv-downloads-your-video-from-a-url)
    - [Option 2: Upload your video](#option-2-upload-your-video)
    - [Option 3: Pre-allocate a video ID (record/upload elsewhere)](#option-3-pre-allocate-a-video-id-recordupload-elsewhere)
    - [Video Metadata](#video-metadata)
    - [Auto-tagging players](#auto-tagging-players)
  - [Folders](#folders)
  - [Recording with the PB Vision app](#recording-with-the-pb-vision-app)
  - [Video Editors and Viewers](#video-editors-and-viewers)
- [After Video Processing is Done](#after-video-processing-is-done)
  - [Callback Data](#callback-data)
  - [Fetching Insights by Video ID](#fetching-insights-by-video-id)
  - [Player Identification](#player-identification)
- [Video Guidelines](#video-guidelines)
- [Reference Guide](#reference-guide)

## Installation

### Step 1: Get API Access

Email **[support@pb.vision](mailto:support@pb.vision)** to request API access for your
account. Let us know which data you need access to (e.g. insights, stats) which
is documented below in the [Callback Data](#callback-data) section. We'll send
you an API Key after discussing your needs more in depth and laying out our billing options.

### Step 2: SDK Setup

1. Install [node](https://nodejs.org/en/download)
2. Install the SDK: `npm i @pbvision/partner-sdk`
3. In your package.json, make sure you're configured to use ESM (modules): `"type": "module"`
4. Initialize the SDK:

```javascript
import { PBVision } from '@pbvision/partner-sdk';
const pbv = new PBVision(YOUR_API_KEY);
```

5. Use its methods as described to [send us video URLs](#send-videos) to
   to process, or [tell us your webhook's URL](#webhook-setup).

## Using the API

### Webhook Setup

Each time our AI finishes processing a video, it will notify your servers via
an HTTP POST request to a URL ("webhook") of your choice. You can use our SDK
to tell our servers where you want us to notify your servers like this:

```javascript
import { PBVision } from '@pbvision/partner-sdk';

const pbv = new PBVision(YOUR_API_KEY);
await pbv.setWebhook(YOUR_WEBHOOK_URL);
```

Alternatively, you can just use `curl`:

```bash
curl -X POST \
     -H 'x-api-key: YOUR_API_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"url": "https://YOUR_WEBHOOK_URL"}' \
     https://api-2o2klzx4pa-uc.a.run.app/partner/webhook/set
```

### Send Videos

#### Option 1: PBV downloads your video from a URL

First, upload a video to a _publicly_ accessible URL on your server. For best
results, videos should follow our [guidelines](#video-guidelines).

Next, tell us to download and work on the video. You can do this using our SDK:

```javascript
import { PBVision } from '@pbvision/partner-sdk';

const pbv = new PBVision(YOUR_API_KEY, { useProdServer: true });
const metadata = {
  userEmails: ['player1@example.com', 'player2@example.com'],
  name: 'Dink Championship 2025',
  gameStartEpoch: 1711393200,
};
const { vid } = await pbv.sendVideoUrlToDownload(YOUR_VIDEO_URL, metadata);
```

Alternatively, you can just use `curl`:

```bash
curl -X POST \
     -H 'x-api-key: YOUR_API_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"url": "https://YOUR_VIDEO_URL", "userEmails": ["test@example.com"]}' \
     https://api-2o2klzx4pa-uc.a.run.app/partner/add_video_by_url
```

#### Option 2: Upload your video

You can directly upload your video from a file using the SDK too:

```javascript
import { PBVision } from '@pbvision/partner-sdk';

const pbv = new PBVision(YOUR_API_KEY, { useProdServer: true });
const metadata = {
  userEmails: ['player1@example.com'],
  name: 'My Game',
  gameStartEpoch: 1711393200,
};
const { vid } = await pbv.uploadVideo(YOUR_VIDEO_FILENAME, metadata);
```

#### Option 3: Pre-allocate a video ID (record/upload elsewhere)

Use `makeVideoId()` to reserve a video ID **without** uploading a file yourself.
This is handy when the video will be recorded and uploaded by a different
client. Hand the returned `vid` (and `uid`) to that client so it uploads to
this video instead of allocating a new one.

To have the game recorded with the PB Vision app, use `makeRecordingLink()`
instead: it reserves the video ID for you and returns a link that opens the
app's camera to record into it. See
[Recording with the PB Vision app](#recording-with-the-pb-vision-app).

```javascript
const { vid, uid, hasCredits } = await pbv.makeVideoId({
  // same metadata fields as the other upload methods (all optional)
  name: 'My Game',
  fileExt: 'mp4', // the extension it will be uploaded as (defaults to "mp4")
  playersForTagging: { server: { name: 'Alice', email: 'alice@example.com' }, receiver: { name: 'Bob' } }
});
```

If the account paying for the video can't pay for it, `hasCredits` is `false`
and there is no `vid`. Passthrough partners always get `hasCredits`.

#### Video Metadata

`sendVideoUrlToDownload()`, `uploadVideo()`, `makeVideoId()`, and
`makeRecordingLink()` accept an optional metadata object. You can omit it
entirely, or provide some or all of these fields:

| Field | Type | Description |
|-------|------|-------------|
| `userEmails` | `string[]` | Up to 4 email addresses of players in the game. These users will have the video added to their PB Vision library, become editors on the video, and be notified when processing is complete. |
| `name` | `string` | Title of the game. Defaults to the game time, or the upload time if no game time is provided. |
| `desc` | `string` | A longer description of the game. |
| `gameStartEpoch` | `integer` | Unix timestamp (seconds) of when the game was played. Not taken by `makeRecordingLink()`, where the game's time comes from its recording. |
| `facility` | `string` | Name of the facility where the game was recorded, e.g. `"Cool Club #3 - Barcelona"`. Useful for facility and Court Insight integrations. |
| `court` | `string` | Court identifier where the game was recorded, e.g. `"11A"`. Useful for facility and Court Insight integrations. |
| `fid` | `integer` | Folder ID, e.g. from `getOrCreateFolder()` (see [Folders](#folders)). Puts the video in that folder in your partner account's library. A `fid` that isn't one of your folders is refused with a 400 error (`unknown folder`). |
| `playersForTagging` | `object` | The players to **auto-tag** once processing completes, each by a name, an email, or both (see [Auto-tagging players](#auto-tagging-players)). Honored by all of `uploadVideo()`, `sendVideoUrlToDownload()`, `makeVideoId()`, and `makeRecordingLink()`. |

The `facility` and `court` fields are primarily used by facility partners
running [Court Insight](https://help.pb.vision/en/articles/9341690-court-insight-for-facilities-and-clubs)
or similar venue-based integrations, where tracking which court a game came from
is important. League and tournament partners may also find these useful for
organizing videos by location.

#### Auto-tagging players

Provide `playersForTagging` to have PB Vision tag the players automatically
once the video is processed. Identify each player by their **role at the start
of the first game**, and give each one a `name`, an `email`, or both:

```javascript
const { vid } = await pbv.uploadVideo(YOUR_VIDEO_FILENAME, {
  playersForTagging: {
    server: { name: 'Alice', email: 'alice@example.com' },       // served the first point
    serverPartner: { name: 'Carol' },                            // omit for singles
    receiver: { email: 'bob@example.com' },                      // received the first point
    receiverPartner: { name: 'Dave', email: 'dave@example.com' } // omit for singles
  }
});
```

To fill in the roles from a match:

- The team that serves first supplies the `server` (its first server) and the
  `serverPartner`.
- The other team's first server is the `receiver`: they start on the right and
  receive the first serve. Their partner is the `receiverPartner`.
- For singles, omit `serverPartner` and `receiverPartner`.

How each player is tagged depends on what you provide:

- A player with an `email` is emailed that they were tagged. If the email
  belongs to a PB Vision account, the game is added to that account's library
  and the account's own name is shown. If not, the `name` you gave is shown,
  and the game joins their library when they sign up with that email.
- A player with only a `name` is labeled with that name.

`server` and `receiver` are required when `playersForTagging` is present.
Names are 1 to 64 characters (after trimming), and each email may be used for
only one player. In multi-game videos the same players are matched across
games automatically.

### Folders

Folders organize the videos in your partner account's library. To put a new
video in a folder, pass the folder's ID as the `fid` [metadata](#video-metadata)
field.

`getOrCreateFolder()` returns the folder in your library with exactly the name
you give (inside `parent`, if you pass one), creating it if there is none.
Calling it again with the same name returns the same folder, as long as you
haven't renamed or moved it since, so it is safe to retry. Use a unique name
for each event, such as one that includes its date; otherwise two events with
the same name would share one folder. Names are 1 to 200 characters, with no
leading or trailing whitespace.

```javascript
// a folder at the top level of your library
const { fid, created } = await pbv.getOrCreateFolder('Spring Open 2026-04-18');

// a folder inside it
const { fid: day1Fid } = await pbv.getOrCreateFolder('Day 1', { parent: fid });
```

`created` is `true` if the call made the folder, or `false` if it already
existed.

`updateFolder()` renames a folder, moves it, or makes it public. Fields you
leave out stay as they are:

```javascript
await pbv.updateFolder(fid, { name: 'Spring Open 2026' }); // rename it
await pbv.updateFolder(day1Fid, { parent: null });         // move it to the top level
await pbv.updateFolder(fid, { public: true });             // let anyone with its link view it
```

Anyone with a public folder's link can view its videos, signed in to PB Vision
or not. `getPublicFolderUrl()` gives you that link:

```javascript
const folderUrl = pbv.getPublicFolderUrl(fid);
// https://pb.vision/library/public/<uid>/<fid>
```

### Recording with the PB Vision app

The PB Vision iOS and Android apps can record a game straight into your
partner account. For each game, `makeRecordingLink()` makes a video with the
[metadata](#video-metadata) you give it and returns a link. Opening the link on
a phone takes the PB Vision app straight to its camera, and the recording
uploads to that video. Anyone can record from the link, whether or not they
are signed in to PB Vision.

A typical event goes like this:

1. **Create a folder for the event** with `getOrCreateFolder()`, using a name
   that is unique to the event (see [Folders](#folders)).
2. **Make a recording link for each game** with `makeRecordingLink()`, putting
   the game in the event's folder and naming its players so they are
   [tagged automatically](#auto-tagging-players).
3. **Share the folder**: make it public with `updateFolder()` and send out the
   link from `getPublicFolderUrl()`.

```javascript
import { PBVision } from '@pbvision/partner-sdk';

const pbv = new PBVision(YOUR_API_KEY, { useProdServer: true });

// 1. one folder per event
const { fid } = await pbv.getOrCreateFolder('Spring Open 2026-04-18');

// 2. one recording link per game
const { vid, url } = await pbv.makeRecordingLink({
  name: 'Spring Open, Court 3, Round 1',
  fid,
  court: '3',
  playersForTagging: {
    server: { name: 'Alice', email: 'alice@example.com' },
    serverPartner: { name: 'Carol' },
    receiver: { name: 'Bob', email: 'bob@example.com' },
    receiverPartner: { name: 'Dave' }
  }
});
// save `vid` with the game in your own records
// show `url` as a QR code, or send it to whoever is recording the game

// 3. share the event
await pbv.updateFolder(fid, { public: true });
const eventUrl = pbv.getPublicFolderUrl(fid);
```

`makeRecordingLink()` returns the new video's `vid`, your `uid`, and the `url`
to share. It takes the same metadata as the other methods except
`gameStartEpoch`: the game's time comes from its recording, and a time given
in advance would override it, so passing one throws an error. It also throws
if the account paying for the video can't pay for it (`hasCredits` is
`false`).

**One link per game.** If several people may ask for the same game's link (for
example, any player on the court can tap "Record"), pass a `nonce` that
identifies the game, such as your own ID for it. Every call with the same nonce
returns the same video and link, even calls made at the same moment, and the
first call decides the video's metadata. A call that gets no video because the
account can't pay doesn't use the nonce up. `makeVideoId()` takes a `nonce` too.

```javascript
const { url } = await pbv.makeRecordingLink({ nonce: `${eventId}-${gameId}`, fid, playersForTagging });
```

**Camera settings.** By default the link records at 1080p and 30 FPS, and the
person recording can't change either. Ask for 4K with `resolution: '4k'` or
60 FPS with `fps: 60`, and let the person recording choose with
`mayChangeResolution: true` and `mayChangeFPS: true`. A phone that can't record
what the link asks for steps down to the best quality it supports. The link's
settings apply regardless of the recorder's own PB Vision subscription, but 4K
requires your partner account to have 4K enabled; otherwise PB Vision rejects
the upload.

```javascript
const { url } = await pbv.makeRecordingLink({
  fid,
  resolution: '4k',          // '1080p' (default) or '4k'
  fps: 60,                   // 30 (default) or 60
  mayChangeResolution: true, // default false
  mayChangeFPS: false        // default false
});
```

**One recording per link.** Only the first upload to a link's video counts, so
make a new link for each game.

**Opening the link.** The PB Vision app opens only when the phone itself opens
the link: when someone taps it (in a text message or an email, for example) or
scans it as a QR code with the camera, or when your own app hands it to the
operating system (for example with `UIApplication.shared.open()` on iOS or an
`ACTION_VIEW` intent on Android). Don't load the link inside a webview or an
in-app browser, where the app may not open. On a phone without the PB Vision
app, the link shows a page for installing it.

**Testing.** With the test server (`useProdServer: false`), links start with
`pbvision://record` instead of `https://pb.vision/record`, and only a
development build of the PB Vision app can open them.

### Video Editors and Viewers

Editors can tag themselves and friends in the video. Viewers have read-only
access. Both editors and viewers can access the video even if it is private (to
make videos uploaded by your partner account private by default, please let us
know via email).

You can get the current list of editors on a video using `getVideoEditors()`.
Use `setVideoEditors()` to set both editor and viewer access (up to 8 emails
each). Note that `setVideoEditors()` _replaces_ the existing editors and
viewers lists entirely.

```javascript
// Get current editors
const editors = await pbv.getVideoEditors(vid);

// Set editors and viewers (replaces any previous lists)
await pbv.setVideoEditors(
  vid,
  ['editor1@example.com', 'editor2@example.com'],  // editors
  ['viewer1@example.com']                           // viewers
);
```

## After Video Processing is Done

When our AI is done processing your video, we will email the players in the
game (_if_ their email addresses were provided via `userEmails`). These users
will be "editors" on the video and be able to tag themselves and their friends.

If you [provided a webhook](#webhook-setup), then we'll send
an HTTP POST request to your server. Your server should acknowledge this
callback with a standard 200 (OK) response. If it does not, we will attempt to
retry sending this request later (up to some maximum number of attempts).

The HTTP POST body will contain JSON which looks like this (depending on which
data is enabled for your API key, only some of these fields may be present):

```json
{
    "from_url": "https://example.com/my-video.mp4",
    "webpage": "https://pb.vision/video/83gyqyc10y8f",
    "cv": CV_DATA,
    "insights": INSIGHTS_DATA,
    "stats": STATS_DATA,
    "vid": STRING,
    "aiEngineVersion": INT,
    "error": {
        "reason": "some explanation here..."
    }
}
```

### Callback Data

- `from_url` is the video url you sent us in [step 3](#send-videos)
- `webpage` is a link to our web app where the stats can be explored
- `error` is only present if your video could not be processed
- `cv` contains low-level frame-by-frame data
- `insights` describes the pickleball game in a detailed, shot-by-shot format
  - Explore the _insights_ schema at <https://pbv-public.github.io/insights>
  - Schema changes and diffs are in our [`pbv-public/insights` repo](https://github.com/pbv-public/insights/blob/dev/CHANGELOG.md)
- `stats` various stats about the game for advanced players
  - Explore the _stats_ schema at <https://pbv-public.github.io/stats?s=~stats~game>
  - Schema changes and diffs are in our [`pbv-public/stats` repo](https://github.com/pbv-public/stats/blob/dev/CHANGELOG.md)
- only included if `insights` is included:
  - `vid` - the unique ID of the video in our system
  - `aiEngineVersion` - the version number of our AI used to process the video

### Fetching Insights by Video ID

If you need to retrieve the insights data outside of the webhook callback (for
example, to re-fetch data for a previously processed video), you can use a
simple HTTP GET request with the video ID:

```bash
curl https://api-2o2klzx4pa-uc.a.run.app/video/VIDEO_ID/insights.json
```

Webhook callbacks with `include.insights` receive the raw insights JSON from
storage. This endpoint is a separate convenience endpoint; by default, it
returns a compact representation of the same session data. Add
`?format=augmented` for readable field names:

```bash
curl 'https://api-2o2klzx4pa-uc.a.run.app/video/VIDEO_ID/insights.json?format=augmented'
```

For multi-game videos, pass the 1-indexed session number:

```bash
curl 'https://api-2o2klzx4pa-uc.a.run.app/video/VIDEO_ID/insights.json?sessionNum=2&format=augmented'
```

You can call this endpoint as many times as needed.

### Player Identification

PB Vision assigns each detected player an index based on visual detection.
Players are indexed 0-3 for doubles (0-1 on one team, 2-3 on the other) and
0 and 2 for singles. These indices are consistent _within_ a single video but
do not carry over between videos, so "Player 0" in one video is not necessarily
the same person as "Player 0" in another.

**Player thumbnails** are available after processing. Using the `vid` and
`aiEngineVersion` from the webhook callback, you can fetch thumbnail images for
each player:

```
https://storage.googleapis.com/pbv-pro/{vid}/{aiEngineVersion}/player{playerIndex}-{imageIndex}.jpg
```

- `playerIndex`: 0-3 for doubles, 0 and 2 for singles
- `imageIndex`: 0-7 (up to 8 thumbnails per player, captured at different
  points in the game)

For example, to get thumbnails for all four players in a doubles game:

```
https://storage.googleapis.com/pbv-pro/83gyqyc10y8f/7/player0-0.jpg
https://storage.googleapis.com/pbv-pro/83gyqyc10y8f/7/player1-0.jpg
https://storage.googleapis.com/pbv-pro/83gyqyc10y8f/7/player2-0.jpg
https://storage.googleapis.com/pbv-pro/83gyqyc10y8f/7/player3-0.jpg
```

**Mapping players to your system:** If your integration needs to know which
player is which (e.g. linking game stats to player profiles in your app), you
have a few options:

1. **Pass player emails at upload time** via the `userEmails` metadata field.
   If you know which players are in the match, their emails will be associated
   with the video as editors, and you can match them against your records.
   Note that providing an email associates the video with that PB Vision
   account, but it does not automatically identify which of the detected
   players (`avatar_id`) belongs to that email. That mapping happens on
   your side using the thumbnails or webpage link below.

2. **Use thumbnails for manual or automated matching.** After processing, fetch
   the player thumbnails and either surface them in an admin UI for manual
   confirmation, or compare them against known player photos programmatically.
   If thumbnails alone aren't enough, show the PB Vision `webpage` link next
   to the avatar choices (or embed it in an iframe) so the user can reference
   the video before selecting themselves.

3. **Store your own metadata alongside the video ID.** When you upload a video,
   record the returned `vid` alongside whatever context you have (match ID,
   player roster, season, week, etc.) in your own system. When the webhook
   fires, use the `vid` to look up that context and route the results
   accordingly.

The insights JSON also includes an `avatar_id` for each player, which
corresponds to the `playerIndex` used in the thumbnail URLs above.

## Video Guidelines

Note: We are now able to split videos into individual games if you'd like to upload more than one game per video. Let us know if this applies to your use case.

Requirements:

- Comply with [PB Vision's framing guidelines](https://help.pb.vision/en/help/articles/1108176-video-recording-and-framing-tips)
- Video Encoding: H.264 codec
- Frame Rate: 30 or 60 FPS
- Max Duration: 30 minutes

For best results, we also recommend:

- File Extension: .mp4
- Audio Encoding: MPEG-4 AAC
- Resolution: 1080p
- Frame Rate: 30 FPS
- Max Bitrate: 4 Mbps
- Max File Size: 2GB

## Reference Guide

- [JSDocs](https://pbv-public.github.io/partner-sdk-nodejs/)
