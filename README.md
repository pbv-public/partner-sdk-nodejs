# PB Vision Partner Documentation <!-- omit in toc -->

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
- [After Video Processing is Done](#after-video-processing-is-done)
- [Video Guidelines](#video-guidelines)
- [Reference Guide](#reference-guide)

## Installation

### Step 1: Get API Access

Email **[dev@pb.vision](mailto:dev@pb.vision)** to request API access for your account. Let us know which data you need access to (e.g. cv, insights, stats, link which are documented below). We'll send you an API Key after discussing your needs more in depth.

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

const pbv = new PBVision(YOUR_API_KEY);
// you can omit this metadata, or provide some or all of this object—whatever you'd like!
const optionalMetadata = {
  userEmails: [],
  name: 'Dink Championship 2024',
  desc: 'A longer description, if you want',
  gameStartEpoch: 1711393200, // when the game was played
};
await pbv.sendVideoUrlToDownload(YOUR_VIDEO_URL, optionalMetadata);
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

const pbv = new PBVision(YOUR_API_KEY, { useProdServer: false });
// you can omit this metadata, or provide some or all of this object—whatever you'd like!
const optionalMetadata = {
  userEmails: [],
  name: 'Dink Championship 2024',
  desc: 'A longer description, if you want',
  gameStartEpoch: 1711393200, // when the game was played
};
await pbv.uploadVideo(YOUR_VIDEO_FILENAME, optionalMetadata);
```

## After Video Processing is Done

When our AI is done processing your video, we will email the players in the
game (_if_ their email addresses were provided via `userEmails`).

If you [provided a webhook](#webhook-setup), then we'll send
an HTTP POST request to your server. Your server should acknowledge this
callback with a standard 200 (OK) response. If it does not, we will attempt to
retry sending this request later (up to some maximum number of attempts).

The HTTP POST body will contain JSON which looks like this (depending on which
data is enabled for your API key, only some of these fields may be present):

```json
{
    "from_url": "https://example.com/my-video.mp4",
    "webpage": "https://pb.vision/video/tvgz3pqij0ll",
    "cutVideo": "https://storage.googleapis.com/pbv-pro/xyz/f50272db-69a8-49ed-9d92-3a4d067af87c/rallies.mp4",
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
- `cutVideo` contains a link to the rally-sliced (dead time removed) .mp4.
- only included if `insights` is included:
  - `vid` - the unique ID of the video in our system
  - `aiEngineVersion` - the version number of our AI used to process the video
  - Using these two values, you can retrieve the player thumbnail images extracted from the video like: `https://storage.googleapis.com/pbv-pro/${vid}/${aiEngineVersion}/player${playerIndex}-${imageIndex}.jpg` where `playerIndex` is in the range [0, 3] (for doubles games) and `imageIndex` is in the range [0, 7].

## Video Guidelines

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
- Max Bitrate: 2 Mbps
- Max File Size: 2GB

## Reference Guide

- [JSDocs](https://pbv-public.github.io/partner-sdk-nodejs/)
