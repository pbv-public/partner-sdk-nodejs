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
    - [Video Metadata](#video-metadata)
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

#### Video Metadata

Both `sendVideoUrlToDownload()` and `uploadVideo()` accept an optional metadata
object. You can omit it entirely, or provide some or all of these fields:

| Field | Type | Description |
|-------|------|-------------|
| `userEmails` | `string[]` | Up to 4 email addresses of players in the game. These users will have the video added to their PB Vision library, become editors on the video, and be notified when processing is complete. |
| `name` | `string` | Title of the game. Defaults to the game time, or the upload time if no game time is provided. |
| `desc` | `string` | A longer description of the game. |
| `gameStartEpoch` | `integer` | Unix timestamp (seconds) of when the game was played. |
| `facility` | `string` | Name of the facility where the game was recorded, e.g. `"Cool Club #3 - Barcelona"`. Useful for facility and Court Insight integrations. |
| `court` | `string` | Court identifier where the game was recorded, e.g. `"11A"`. Useful for facility and Court Insight integrations. |
| `fid` | `integer` | Folder ID. Organizes the video into a specific folder in the uploader's PB Vision library. |

The `facility` and `court` fields are primarily used by facility partners
running [Court Insight](https://help.pb.vision/en/articles/9341690-court-insight-for-facilities-and-clubs)
or similar venue-based integrations, where tracking which court a game came from
is important. League and tournament partners may also find these useful for
organizing videos by location.

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

This returns the same insights JSON that would be delivered via the webhook
callback. You can call this endpoint as many times as needed.

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

2. **Use thumbnails for manual or automated matching.** After processing, fetch
   the player thumbnails and either surface them in an admin UI for manual
   confirmation, or compare them against known player photos programmatically.

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
