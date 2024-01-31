# PB Vision Partner Documentation <!-- omit in toc -->

The easiest way to use the PB Vision AI Engine is to simply share a link to
your video file. Our AI usually works on each video for about an hour for a
standard length game, so we'll notify your servers when the results are ready.

- [Using the API](#using-the-api)
  - [Step 1: Get API Access](#step-1-get-api-access)
  - [Step 2: Webhook Setup](#step-2-webhook-setup)
  - [Step 3: Send Videos](#step-3-send-videos)
  - [Step 4: Video Processing Done](#step-4-video-processing-done)
- [SDK Setup](#sdk-setup)
- [Video Guidelines](#video-guidelines)

## Using the API

### Step 1: Get API Access

Email **[dev@pb.vision](mailto:dev@pb.vision)** to request API access for your
account. We'll send you an API Key.

### Step 2: Webhook Setup

Each time our AI finishes processing a video, it will notify your servers via
an HTTP POST request to a URL ("webhook") of your choice. You can use our SDK
to tell our servers where you want us to notify your servers like this:

```javascript
import { PBVision } from '@pbvision/partner-sdk'

const pbv = new PBVision(YOUR_API_KEY)
await pbv.setWebhook(YOUR_WEBHOOK_URL)
```

Alternatively, you can just use `curl`:

```bash
curl -X POST \
     -H 'x-api-key: YOUR_API_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"url": "https://YOUR_WEBHOOK_URL"}' \
     https://api-ko3kowqi6a-uc.a.run.app/partner/webhook/set
```

### Step 3: Send Videos

First, upload a video to a _publicly_ accessible URL on your server. For best
results, videos should follow our [guidelines](#video-guidelines).

Next, tell us to download and work on the video. You can do this using our SDK:

```javascript
import { PBVision } from '@pbvision/partner-sdk'

const pbv = new PBVision(YOUR_API_KEY)
const playerEmails = [] // optional!
await pbv.sendVideoUrlToDownload(YOUR_VIDEO_URL, playerEmails)
```

Alternatively, you can just use `curl`:

```bash
curl -X POST \
     -H 'x-api-key: YOUR_API_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"url": "https://YOUR_VIDEO_URL", "userEmails": ["test@example.com"]}' \
     https://api-ko3kowqi6a-uc.a.run.app/partner/add_video_by_url
```

### Step 4: Video Processing Done

When our AI is done processing your video, we will email the players in the
game (_if_ their email addresses were provided).

If you provided a webhook in [step 2](#step-2-webhook-setup), then we'll send
an HTTP POST request to your server. Your server should acknowledge this
callback with a standard 200 (OK) response. If it does not, we will attempt to
retry sending this request later (up to some maximum number of attempts).

The HTTP POST body will contain JSON which looks like this:

```json
{
    "from_url": "https://example.com/my-video.mp4",
    "webpage": "https://app.pb.vision/video/xyz",
    "events": EVENTS_DATA,
    "insights": INSIGHTS_DATA,
    "error": {
        "reason": "some explanation here..."
    }
}
```

- `from_url` is the video url you sent us in [step 3](#step-3-send-videos)
- `webpage` is a link to our web app where the stats can be explored
- `error` is only present if your video could not be processed
- `events` - describes the pickleball game in detailed, low-level events
  - Explore the _events_ schema at <https://pbv-public.github.io/events/dev>
  - Schema changes and diffs are in our [`pbv-public/events` repo](https://github.com/pbv-public/events/blob/dev/CHANGELOG.md)
- `insights` - a summary of high-level stats about the video
  - Explore the _insights_ schema at <https://pbv-public.github.io/insights/dev>
  - Schema changes and diffs are in our [`pbv-public/insights` repo](https://github.com/pbv-public/insights/blob/dev/CHANGELOG.md)

## SDK Setup

1. Install [node](https://nodejs.org/en/download)
2. Install the SDK: `npm i @pbvision/partner-sdk`
3. In your package.json, make sure you're configured to use ESM (modules): `"type": "module"`
4. Initialize the SDK:

```javascript
import { PBVision } from '@pbvision/partner-sdk'
const pbv = new PBVision(YOUR_API_KEY)
```

5. Use its methods as described to [send us video URLs](#step-3-send-videos) to
   to process, or [tell us your webhook's URL](#step-2-webhook-setup).

## Video Guidelines

Requirements:

- Video Encoding: **H.264** codec
- Frame Rate: **30 or 60 FPS**
- File Extension: `.mp4`

For best results, we also recommend:

- Follow our [**video framing** guidelines](https://www.pb.vision/video-tips)
- Audio Encoding: MPEG-4 AAC
- Resolution: 1080p
- Max bitrate: 2 Mbps
- Max file size: 1GB
- Max duration: 30 minutes
