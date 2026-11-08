# Live Presentation Studio

Type a presentation **title** and a **prompt**, upload **your photo**, and the app makes:

1. **Slides**: a structured deck (intro → body → conclusion), written by Claude.
2. **A speech** for every slide, which you can edit.
3. **A talking video of you**: your photo is animated so you speak each slide's script with lip-sync (D-ID API), in a female or male voice.
4. **Downloads**: the full presentation as one **1080p MP4** video, each slide's video as an MP4, and a **PowerPoint (.pptx)** with speaker notes.

There are two ways to present: **Present (live video)**, where slides advance automatically as the presenter finishes speaking, and **Slides only**, a normal deck with speaker notes.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
```

| Variable | What it's for | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Writes the slides and the speech | https://platform.claude.com |
| `DID_API_KEY` | Turns the photo into a talking video | https://studio.d-id.com → Account → API |

If `DID_API_KEY` is missing, the app falls back to a **voice-over preview** (your still photo plus the browser's voice). The talking **video** needs the D-ID key.

## Deploy to Vercel

1. Import the GitHub repo at https://vercel.com/new
2. Add `ANTHROPIC_API_KEY` and `DID_API_KEY` under *Settings → Environment Variables*
3. Deploy

## Install as an app (Windows, Mac, iPhone, Android)

The site is a Progressive Web App:

- **Windows / Mac (Chrome or Edge):** click the install icon in the address bar, or open the menu and choose *Install Live Presentation Studio*.
- **Mac (Safari 17+):** *File → Add to Dock*.
- **iPhone / iPad (Safari):** tap *Share → Add to Home Screen*.
- **Android (Chrome):** open the menu and choose *Install app*.

## Notes

- Use only **your own photo**, or a photo of someone who has agreed to it.
- The presenter video is AI-generated. Check your university's rules before you submit it for an assessed or "live" presentation.
- D-ID result links expire after about 24 hours. Download your MP4s, or regenerate them.
- The full-video export records in real time in the browser. Keep the tab open until it finishes. Chrome, Edge and Safari produce MP4; older browsers produce WebM.
