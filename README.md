# Anvil Notes

*Turn recordings into summaries and tasks.*

A Mac app that turns a cheap voice recorder into a Plaud-style AI note-taker, with no subscription. Plug in a recorder (or drop in audio files) and it:

1. Imports new recordings from a plugged-in recorder, or audio files you drop in (MP3, WAV, M4A, FLAC, OGG, WebM), and processes them as a queue.
2. Transcribes them with [OpenWhispr](https://openwhispr.com), on your Mac through the OpenWhispr app (default) or with OpenWhispr Cloud. OpenAI Whisper is also available.
3. Optionally summarises them with Claude, using a template (Meeting, Lecture, Interview, Phone call, Voice memo or Auto-detect), and turns every action item into a **task**.
4. Builds Notion-compatible Markdown and **uploads it to Notion** and/or **saves it as a `.md` file**.

## Setup

**New here? Follow the step-by-step [SETUP.md](SETUP.md).** Quick version:

```bash
npm install
npm start
```

Fill in Settings. You only need the keys for the features you use:

| Setting | Needed for |
| --- | --- |
| Nothing for OpenWhispr on this Mac. An `owk_live_` key for OpenWhispr Cloud, or an OpenAI key | Transcription |
| Claude API key (console.anthropic.com) | "Claude summary + tasks" |
| Notion token + parent page | "Upload to Notion" |

**Notion:** create an internal integration at https://www.notion.so/profile/integrations, then on the parent page open **••• → Connections** and add it.

**OpenWhispr (default):** install the [OpenWhispr app](https://openwhispr.com) and, in its Settings → Transcription, download and select a local model (Parakeet or Whisper). This app drives it through the bundled OpenWhispr CLI (`@openwhispr/cli`) and opens OpenWhispr in the background if needed. It's free, runs offline and has no file-size limit.

**OpenWhispr Cloud:** needs a Pro/Business plan and an API key with the `transcriptions:write` scope (OpenWhispr → Integrations → API). Beta; 4 MB per file.

API keys are encrypted with the macOS Keychain (Electron `safeStorage`).

## Building the installer

```bash
npm run dist
```

This creates `dist/Anvil Notes-<version>-arm64.dmg` for Apple Silicon Macs. It's signed ad-hoc (no Apple Developer certificate), which is fine on the Mac that built it. Before sharing it with others, sign it with a Developer ID and notarise it, otherwise macOS will block it.

## Output format

```markdown
# Q4 planning sync

*Source: q4_sync.mp3 · 7 October 2026*

## Summary
...

## Tasks

- [ ] Send the Q4 budget (**Sarah**, due Friday)

## Key points
- ...

## Decisions
- ...

<details>
<summary>Full transcript</summary>
...
</details>
```

In Notion, `- [ ]` lines become to-do checkboxes and `<details>` becomes a toggle. Long transcripts become a normal "Full transcript" section, so they can be uploaded in chunks.

## Code

| File | Role |
| --- | --- |
| `src/main.js` | Window and IPC: transcribe, then summarise, build Markdown, save and upload |
| `src/transcribe.js` | OpenWhispr (local via CLI, or Cloud REST API) or OpenAI Whisper |
| `src/summarize.js` | Claude (Opus 5.5 by default) with structured output: summary, key points, decisions, tasks |
| `src/markdown.js` | Renders transcript/summary Markdown (paragraph splitting, escaping, to-dos) |
| `src/notion.js` | Creates the page from Markdown, appending in 20k-char chunks |
| `src/recorders.js` | Watches `/Volumes` for plugged-in drives and finds recordings that haven't been processed |
| `src/library.js` | Remembers processed recordings (name + size + date fingerprint) |
| `src/templates.js` | Summary templates: Claude instructions and section headings |
| `src/audio.js` | Supported audio formats |
| `src/settings.js` | Settings storage with encrypted secrets |
| `renderer/` | UI |
