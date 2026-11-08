# Live Presentation Studio

Type a presentation **title** and a **prompt**, upload **your photo**, and optionally **record your voice**. The app then makes:

1. **Slides**: a structured deck (intro → body → conclusion), written by Claude.
2. **A speech** for every slide.
3. **A talking video of you**: your own photo animated with lip-sync (D-ID), speaking in **your own cloned voice** (ElevenLabs) or a ready-made female or male voice.
4. **A live presentation**: fullscreen, and every slide plays automatically as you "speak".
5. **Downloads**: the full presentation as a **1080p MP4**, an MP4 for each slide, and **PowerPoint (.pptx)** with speaker notes.

You can also edit the presentation **by chatting** with the AI, like ChatGPT ("add a slide about costs", "make it more formal").

**📱 Record myself (teleprompter)**: if your university asks you to record the presentation on your phone, this records you with the front camera while your speech scrolls on screen. Then tap **Save video** to keep it in Photos or your Gallery.

**Create & go live** does everything in one click: prompt → slides → talking video → live presentation.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
```

| Variable | What it's for | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Writes the slides and speech, and powers the chat | https://platform.claude.com |
| `DID_API_KEY` | Turns the photo into a talking video | https://studio.d-id.com → Account → API |
| `ELEVENLABS_API_KEY` | Clones the presenter's own voice | https://elevenlabs.io → Profile → API key (voice cloning needs the Starter plan or higher) |

Without `DID_API_KEY` you get a voice-over preview on the still photo. Without `ELEVENLABS_API_KEY` the "Use my own voice" option shows an error, and the ready-made voices still work.

## Deploy to Vercel

1. Go to https://vercel.com/new and import `perera555/live-presentation`.
2. Set **Project Name** to `live-presentation-studio-perera`. The desktop app opens `https://live-presentation-studio-perera.vercel.app`. If you choose another name, change `appUrl` in `desktop/package.json` to match.
3. Add the three environment variables above, then click **Deploy**.

## Desktop app (Windows .exe / Mac .dmg)

The installers are built automatically by GitHub Actions (`.github/workflows/desktop.yml`):

- **Run it:** go to GitHub → *Actions* → *Build desktop apps* → *Run workflow*. When it finishes, download `installer-windows-latest` (.exe) and `installer-macos-latest` (.dmg) from the run page.
- **Release:** push a tag such as `git tag v1.0.0 && git push --tags`, and the installers are attached to a GitHub Release.

The installers are not code-signed:

- **Windows:** if SmartScreen warns you, click *More info → Run anyway*.
- **Mac:** right-click the app → *Open* → *Open* the first time.

To build locally: `cd desktop && npm install && npm run dist:win` (on Windows), or `npm run dist:mac` (on a Mac).

## Install from the browser (iPhone, Android, or any computer)

The site is also an installable web app:

- **Chrome / Edge:** click the install icon in the address bar.
- **Mac Safari:** *File → Add to Dock*.
- **iPhone / iPad:** in Safari, tap *Share → Add to Home Screen*.

## Notes

- Use only **your own** photo and voice. The app asks you to confirm consent before it clones a voice.
- The presenter video is AI-generated. Check your university's rules before you submit it for an assessed or "live" presentation.
- D-ID result links expire after about 24 hours. Download your MP4s, or regenerate them.
- The full-video export records in real time in the browser. Keep the window open until it finishes.
