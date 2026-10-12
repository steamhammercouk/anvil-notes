# Anvil Notes: Setup Guide

> **Provided without warranty.** Anvil Notes is free, open-source software provided "as is". You're responsible for getting consent from people you record, for checking AI-generated output, and for any costs from third-party services. See the [disclaimer in the README](README.md#disclaimer-provided-without-warranty) and the [MIT License](LICENSE).

This guide takes you from nothing installed to your first MP3 turned into a Notion page, with a summary and tasks written by Claude. Follow the parts in order. Each part ends with a check so you know it worked before moving on.

| Part | What you'll set up | Time | Required? |
| --- | --- | --- | --- |
| [1](#part-1-install-nodejs) | Node.js (runs the app) | 5 min | Yes |
| [2](#part-2-install-the-app) | This app's code | 2 min | Yes |
| [3](#part-3-set-up-openwhispr-transcription) | OpenWhispr and a speech model (turns audio into text) | 10–15 min | Yes |
| [4](#part-4-get-a-claude-api-key-summaries-and-tasks) | A Claude API key (summaries and tasks) | 5 min | Only for summaries |
| [5](#part-5-connect-notion) | A Notion integration token and parent page | 5 min | Only for Notion uploads |
| [6](#part-6-enter-everything-in-the-app) | Entering it all in the app | 2 min | Yes |
| [7](#part-7-your-first-run) | Your first run | 2 min | Yes |
| [8](#part-8-using-a-voice-recorder) | Using a voice recorder | 2 min | Optional |

If you only want plain transcripts saved as Markdown files on your Mac, you can skip Parts 4 and 5.

> **Keep your keys secret.** The Claude key and Notion token work like passwords: anyone who has them can spend your Claude credit or edit your Notion pages. Don't paste them into chats, emails or shared documents. The app stores them encrypted in your Mac's Keychain.

---

## How it works

```
 MP3 file
    │
    ▼
 OpenWhispr (on your Mac)  ──►  transcript text
    │
    ├── "Full transcript" ──────────────────────────────┐
    │                                                   │
    └── "Claude summary + tasks" ──► Claude API ──►     │
         summary, key points, decisions, tasks          │
                                                        ▼
                                      Notion-friendly Markdown
                                        │                  │
                                        ▼                  ▼
                                   Notion page        .md file on your Mac
```

- **OpenWhispr** transcribes the audio on your Mac. The audio isn't uploaded anywhere and there's no file-size limit.
- **Claude** gets only the transcript text, and only when you choose "Claude summary + tasks".
- **Notion** gets the final page, and only when you tick "Upload to Notion".

---

## Part 1: Install Node.js

Node.js is the runtime the app is built on. You need version **20 or later**.

### 1.1 Check whether you already have it

1. Open **Terminal**. Press `⌘ Space`, type `Terminal` and press Return.
2. Run:

   ```bash
   node -v
   ```

3. If it prints `v20` or higher (for example `v22.11.0` or `v26.9.0`), skip to [Part 2](#part-2-install-the-app). If it says `command not found` or shows a lower version, carry on.

### 1.2 Install it

**Option A: the installer (easiest)**

1. Go to [nodejs.org](https://nodejs.org).
2. Download the **LTS** version for macOS.
3. Open the downloaded `.pkg` file and click through the installer.
4. Quit and reopen Terminal.

**Option B: Homebrew (if you already use it)**

```bash
brew install node
```

### ✅ Check

```bash
node -v
npm -v
```

Both commands should print a version number.

---

## Part 2: Install the app

### 2.1 Open a terminal in the project folder

In Terminal, go to the folder that holds this file (`SETUP.md`), using `cd` with the folder's path. A quick way: type `cd ` (with a trailing space), drag the project folder from Finder into the Terminal window, then press Return.

### 2.2 Install its dependencies

```bash
npm install
```

This downloads everything the app needs into a `node_modules` folder, including Electron, the Claude, Notion and OpenAI SDKs, and the OpenWhispr command-line tool. It takes a minute or two. Messages starting with `npm warn` are normal.

### ✅ Check

```bash
npx openwhispr --version
```

This should print a version number such as `0.3.0`. That's the OpenWhispr command-line tool the app uses to talk to OpenWhispr.

---

## Part 3: Set up OpenWhispr (transcription)

[OpenWhispr](https://openwhispr.com) is a free, open-source voice-to-text app. This app uses it to transcribe MP3 files **on your Mac**, using a speech model you download once.

### 3.1 Download and install OpenWhispr

> If `OpenWhispr.app` is already in your **Applications** folder, skip to [3.2](#32-first-launch-and-onboarding).

1. Go to [openwhispr.com](https://openwhispr.com) and click the download button. You can also download it from the [GitHub releases page](https://github.com/OpenWhispr/openwhispr/releases/latest).
2. Download the **macOS `.dmg`**. The same file works on Apple Silicon (M1, M2, M3, M4) and Intel Macs.
3. Open the `.dmg` and drag **OpenWhispr** into **Applications**.
4. Eject the `.dmg` from the Finder sidebar.

### 3.2 First launch and onboarding

1. Open **OpenWhispr** from Applications.
   - If macOS says it can't verify the app, open **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.
2. OpenWhispr walks you through onboarding: dictation first, then notes and meeting recording, then a demo of its voice assistant.
3. When it asks how to process speech, choose **Local**. You'll pick the exact model in [3.3](#33-download-the-speech-model-the-important-bit).
4. **Signing in:** an OpenWhispr account isn't needed for local transcription. Sign in only if you want OpenWhispr's own cloud features.
5. **Permissions.** OpenWhispr will ask for:

   | Permission | Needed for this app? | Why OpenWhispr asks |
   | --- | --- | --- |
   | Microphone | No | Its own dictation |
   | Accessibility | No | Pasting dictated text into other apps |
   | Screen Recording | No | Recording meeting audio |

   None of these are needed for transcribing files. You can allow them if you want to use OpenWhispr's own dictation, or skip them.

6. **The "assistant" or language-model step.** Onboarding may make you pick an AI assistant model. **This app doesn't use it**, because it uses Claude for summaries. Pick the smallest option so you can move on:

   | Choice | Download | When to pick it |
   | --- | --- | --- |
   | **OpenWhispr Cloud** (if offered) | None | Easiest, nothing to download |
   | **Qwen3.5 2B** | 1.3 GB | Smallest local option; fine for this app |
   | **Qwen3.5 4B** | 2.7 GB | If you also want OpenWhispr's own dictation cleanup and voice agent; runs well on 16 GB Macs |

   You don't need the larger 8B, 9B or 32B models.

### 3.3 Download the speech model (the important bit)

This model turns speech into text. Without it, transcription fails with "no local model set up yet".

1. In OpenWhispr, open **Settings**.
2. Under **AI Models**, choose **Speech-to-Text**.
3. You'll see tabs for **Dictation**, **Note Recording** and **Audio Upload**. Each keeps its own engine choice. Select **Audio Upload**, because that's the one for files. Setting the same model on Dictation does no harm.
4. Choose **Local**.
5. Open the **NVIDIA** tab.
6. Click **Download** next to the model you want:

   | Model | Download | Pick it if |
   | --- | --- | --- |
   | **parakeet-unified-en-0.6b** ⭐ | ~631 MB | Your recordings are in **English**. Best English accuracy. |
   | parakeet-tdt-0.6b-v3 | ~680 MB | Some recordings are in **other languages** (it covers 25) |

   Other good choices in other tabs:
   - **Orukeet** (Oruk tab, ~672 MB): OpenWhispr's default. Multilingual, fast and accurate.
   - **Cohere Transcribe** (~1.7 GB download): the most accurate, but you have to set the language in advance.
   - **Whisper base** (Whisper tab, ~142 MB): a small, decent fallback.

7. Wait for the download to finish, then make sure the model is **selected**, not just downloaded.

### 3.4 Keep OpenWhispr allowed to run

The app talks to OpenWhispr through a private connection on your own Mac, which OpenWhispr starts when it launches. You don't need to keep OpenWhispr's window open: **if OpenWhispr isn't running, the app opens it in the background** when you start a transcription. Quitting OpenWhispr completely is fine too.

### ✅ Check

With OpenWhispr open, run this from the project folder:

```bash
npx openwhispr doctor
```

You want to see `"local"` with `"reachable": true`:

```json
{
  "local": {
    "configured": true,
    "reachable": true,
    "description": "local desktop bridge"
  },
  "remote": { ... "reachable": false ... }
}
```

`remote` being `false` is fine, because that's OpenWhispr's paid cloud service. If `local` is `false`, see [Troubleshooting](#troubleshooting).

**Optional end-to-end test.** Make a 5-second test clip with your Mac's built-in voice and transcribe it:

```bash
say -o /tmp/ow-test.aiff "Testing OpenWhispr. Sarah will send the report on Friday."
afconvert -f m4af -d aac /tmp/ow-test.aiff /tmp/ow-test.m4a
npx openwhispr --local transcribe /tmp/ow-test.m4a
```

It should print the sentence back. If it says no model is selected, go back to [3.3](#33-download-the-speech-model-the-important-bit).

---

## Part 4: Get a Claude API key (summaries and tasks)

> Skip this part if you only want full transcripts.

Claude reads the transcript and writes the summary, key points, decisions and **tasks**. The app talks to Claude through the **Claude API**, which is billed separately from a Claude.ai Pro or Max subscription. A Claude.ai subscription does **not** include API credit.

### 4.1 Create an account on the Claude Console

1. Go to [console.anthropic.com](https://console.anthropic.com) (the Claude Console).
2. Sign up or log in. You can use the same email as your Claude.ai account, but billing is separate.
3. If asked, create an organisation. Your name or company name is fine.

### 4.2 Add credit

API usage is prepaid.

1. In the Console, open **Settings → Billing**.
2. Add a payment method and buy credit. **$5 is plenty to start** (see the cost estimate below).
3. Optional but sensible: under **Settings → Limits**, set a monthly **spend limit**, for example $10, so a mistake can't run up a big bill.
4. Optional: turn **auto-reload** off if you'd rather top up by hand.

### 4.3 Create an API key

1. In the Console, open **Settings → API Keys**.
2. Click **Create Key**.
3. Name it something recognisable, such as `Anvil Notes – MacBook`.
4. If asked for a workspace, choose **Default** (or whichever one you set a spend limit on).
5. Click **Create** or **Add**.
6. **Copy the key now.** It starts with `sk-ant-` and **is only shown once**. If you lose it, delete it and create a new one.
7. Keep it somewhere safe for a minute. You'll paste it into the app in [Part 6](#part-6-enter-everything-in-the-app).

### Which model, and what it costs

The app offers two models, set in Settings:

| Model | Best for | Price (input / output per million tokens) |
| --- | --- | --- |
| **Claude Opus 5.5** (default) | Best summaries and task detection | $4 / $20 |
| Claude Sonnet 5.5 | Faster and cheaper; still very good | $2 / $10 |

**Rough cost per recording:** an hour of speech is about 9,000 words, or roughly 12,000 tokens. With Opus 5.5 a summary of an hour-long meeting usually costs **around 5 to 15 cents**. Short voice notes cost a fraction of a cent. These are estimates; check **Settings → Usage** in the Console for actual spend.

### ✅ Check

In the Console under **API Keys**, your new key should be listed as **Active**, and **Billing** should show a balance above zero.

---

## Part 5: Connect Notion

> Skip this part if you only want to save Markdown files.

Notion only lets apps reach pages you've explicitly shared with them. You'll do three things:

1. Create an **integration** (gives you a token).
2. Choose or create a **parent page**, where new pages will appear.
3. **Connect** the integration to that page.

### 5.1 Create an internal integration

You need to be a **Workspace Owner** to create integrations. If you're not, ask an owner to do steps 1–8 and send you the token securely.

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations). You can also get there in Notion via **Settings → Connections → Develop or manage integrations**.
2. Click **New integration** (or **+ New integration**).
3. Fill in:
   - **Integration name:** `Anvil Notes`
   - **Associated workspace:** the workspace you want transcripts in
   - **Type:** **Internal** (only you and your workspace use it)
   - **Logo:** optional
4. Click **Save** (or **Submit**).
5. Open the integration's **Configuration** (or **Capabilities**) section and check that **Content capabilities** includes:
   - ✅ **Read content**
   - ✅ **Update content**
   - ✅ **Insert content**

   Comment and user-information capabilities aren't needed; leave them as they are.
6. Click **Save changes** if you changed anything.
7. Find **Internal Integration Secret** and click **Show**, then **Copy**.
8. The token starts with `ntn_` (older ones start with `secret_`). Keep it safe for [Part 6](#part-6-enter-everything-in-the-app).

### 5.2 Choose or create a parent page

Every transcript or summary becomes a **new page inside this parent page**.

1. In Notion, create a page such as **📼 Recordings** or **Meeting Notes**. You can also use an existing page.
2. It must be a normal **page**, not a database.

### 5.3 Connect the integration to the parent page

**This is the step people most often miss.** Without it, Notion replies "Could not find page".

1. Open the parent page in Notion.
2. Click the **•••** menu in the top-right corner.
3. Scroll to **Connections** (in some versions, **Add connections** or **Connect to**).
4. Search for **Anvil Notes** and select it.
5. Click **Confirm** when Notion asks to give the integration access to the page and its child pages.

Alternatively, go back to the integration's settings page, open the **Access** tab, click **Edit access** and tick the page.

### 5.4 Copy the parent page link

1. On the parent page, click **Share** and then **Copy link**. You can also click **•••** and then **Copy link**.
2. You'll get something like:

   ```
   https://www.notion.so/yourteam/Recordings-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d?pvs=4
   ```

   You can paste the whole link into the app; it picks out the ID (the 32 characters at the end) itself.

### ✅ Check

On the parent page, **••• → Connections** should list **Anvil Notes**.

---

## Part 6: Enter everything in the app

### 6.1 Start the app

From the project folder:

```bash
npm start
```

A window called **Anvil Notes** opens. The first time, it opens on **Settings**.

### 6.2 Fill in Settings

**Transcription**

| Field | What to enter |
| --- | --- |
| Engine | **OpenWhispr (on this Mac, free)** |
| Model (optional) | Leave blank to use OpenWhispr's selected model, **or** type `parakeet-unified-en-0.6b` to choose it directly. A model typed here must already be downloaded in OpenWhispr. |
| Language (optional) | Leave blank to auto-detect, or enter a code such as `en`. Setting it can improve accuracy. |

> Other engines: **OpenWhispr Cloud** needs a Pro or Business OpenWhispr plan and an API key starting `owk_live_` (create one in OpenWhispr under **Integrations → API** with the `transcriptions:write` scope). It's in beta and limited to 4 MB per file. **OpenAI Whisper API** needs an OpenAI key and is limited to 25 MB per file. Most people won't need either.

**Claude summaries**

| Field | What to enter |
| --- | --- |
| Claude API key | Paste your `sk-ant-…` key from [Part 4](#part-4-get-a-claude-api-key-summaries-and-tasks) |
| Model | **Claude Opus 5.5** (best) or **Claude Sonnet 5.5** (cheaper) |

**Notion**

| Field | What to enter |
| --- | --- |
| Integration token | Paste your `ntn_…` token from [Part 5](#part-5-connect-notion) |
| Parent page | Paste the parent page link from [5.4](#54-copy-the-parent-page-link) |

Click **Save settings**. A green **Saved** message appears.

### Where settings are stored

`~/Library/Application Support/Anvil Notes/settings.json`. Keys and tokens in that file are encrypted with your macOS Keychain. The first time, macOS may ask to allow Keychain access; click **Always Allow**.

---

## Part 7: Your first run

1. Click the **Transcribe** tab.
2. **Add recordings:** drop audio files onto the dashed box, or click it to choose some. You can add several at once. Supported formats: **MP3, WAV, M4A, FLAC, OGG and WebM**. Pick something short (1–2 minutes) for your first test.
3. Each file appears in the **Queue**. You can type a **title** for any of them; leave it blank and the app uses Claude's suggested title (in summary mode), the file name, or "Recording 7 Oct 2026, 14:32" for recorder-style names like `REC001.WAV`.
4. **Output:**
   - **Full transcript**: the complete text, split into readable paragraphs.
   - **Claude summary + tasks**: a summary, two lists and a task list. Pick a **Template** to suit the recording (see the table below), and tick **Add the full transcript under the summary** to include the transcript as well.
5. **Send to:** tick **Upload to Notion**, **Save Markdown file**, or both. Markdown files are saved automatically to the folder shown, `~/Documents/Anvil Notes` unless you click **Change**. They're named like `2026-10-07 Q4 planning sync.md`.
6. Click **Transcribe** (or **Transcribe and summarise 3 recordings**, and so on).

The recordings are processed one at a time, and each row shows its progress: *Transcribing… → Summarising with Claude… → Saving Markdown file… → Creating Notion page…* To stop part-way, click **Stop after this one**.

When a row finishes it shows the number of tasks found and links:
- **View** shows the Markdown in the panel at the bottom, with **Copy** and **Save .md** buttons.
- **Open in Notion** opens the new page.
- **Show in Finder** shows the saved `.md` file.

### Summary templates

| Template | Best for | First list | Second list | Tasks |
| --- | --- | --- | --- | --- |
| **Auto-detect** | Anything; Claude works out the type | Key points | Decisions | Any action items |
| **Meeting** | Meetings and stand-ups | Key points | Decisions | Action items with owners and deadlines |
| **Lecture or class** | Lectures, training, talks | Key concepts | Questions to review | Assignments, readings, deadlines |
| **Interview** | Interviews, user research | Key insights | Notable quotes | Follow-ups |
| **Phone call** | Calls with clients or suppliers | Key points | Agreements | Follow-ups on each side |
| **Voice memo** | Notes to self | Ideas | Notes | Your to-dos |

### What you'll get in Notion

```markdown
# Q4 planning sync
*Source: REC014.WAV · Recorded 7 October 2026, 14:32*

## Summary
The team reviewed …

## Tasks
- [ ] Send the Q4 budget (**Sarah**, due Friday)     ← a Notion to-do checkbox
- [ ] Book the photographer

## Key points
- …

## Decisions
- …

▸ Full transcript                                      ← a collapsible toggle
```

Each task becomes a **checkbox to-do** in Notion. A short transcript goes in a collapsible **toggle**; a long one appears as a normal **Full transcript** section.

---

## Part 8: Using a voice recorder

Any cheap digital voice recorder works, as long as it **shows up as a USB drive** when you plug it into your Mac and records **MP3 or WAV**. Most do. Avoid recorders that need their own app to get recordings off.

> **Tip:** set the recorder's clock. Anvil Notes uses each file's date as the "Recorded" time and, for names like `REC001.WAV`, in the title.

### Importing recordings

1. Open Anvil Notes.
2. Plug in the recorder. Within a couple of seconds a banner appears: **🎙 VOICE connected · 5 new recordings**. If Anvil Notes is in the background, you get a macOS notification instead.
3. The list shows only recordings the app hasn't processed before. Untick any you don't want.
4. Click **Add to queue**, choose your output options, then click **Transcribe**.

The first time, macOS may ask whether Anvil Notes can **access files on a removable volume**. Click **Allow**.

### Other buttons in the banner

| Button | What it does |
| --- | --- |
| **Mark as done** | Hides the ticked recordings from now on without processing them. Useful for old recordings you don't need. |
| **Ignore this drive** | Never offers recordings from this drive again. Useful for USB sticks full of music. Undo it in **Settings → Recorders → Stop ignoring all**. |
| **Hide** / **Review** | Collapses or expands the list. |

### How the app remembers what's done

A recording is marked as done once it has been saved or uploaded successfully. The app recognises recordings by name, size and date, so a new recording that reuses an old name (recorders often restart at `REC001` after you delete files) still counts as new. Recordings are **never deleted from the recorder**; clear it with the recorder's own controls or in Finder when you're ready.

> **Important:** don't unplug the recorder while its recordings are being processed. Wait until the queue finishes. Processing reads straight from the recorder, and an unplugged recording fails with "The file is no longer there".

---

## Troubleshooting

| Message or symptom | Cause | Fix |
| --- | --- | --- |
| **"OpenWhispr has no local model set up yet"** | No speech model selected in OpenWhispr | Do [3.3](#33-download-the-speech-model-the-important-bit): download a Parakeet model and select it on the **Audio Upload** tab. Or type the model name in the app's **Model (optional)** field. |
| **"OpenWhispr opened but did not respond"** | OpenWhispr is still starting, stuck in onboarding, or waiting on a dialog | Bring OpenWhispr to the front, finish onboarding or close any dialog, then try again. Check with `npx openwhispr doctor`. |
| **"Could not open OpenWhispr"** | OpenWhispr isn't in Applications | Install it ([3.1](#31-download-and-install-openwhispr)). |
| `doctor` shows `"local": { "reachable": false }` | OpenWhispr isn't running | Open OpenWhispr, wait 10 seconds and run `doctor` again. If it's still `false`, quit OpenWhispr fully (`⌘Q`) and reopen it. |
| **"…couldn't transcribe this file: …model…"** | The model typed in the app's Settings isn't downloaded | Download that model in OpenWhispr, or clear the **Model (optional)** field. |
| **"Claude rejected the API key"** | Key mistyped, deleted, or from a different organisation | Create a new key ([4.3](#43-create-an-api-key)) and paste it again. |
| **"Claude API error (400)…credit balance is too low"** | No API credit | Add credit in **Console → Billing**. A Claude.ai subscription doesn't count. |
| **"Claude rate limit reached"** | Too many requests in a short time | Wait a minute and try again. |
| **"Claude declined to summarise this recording"** | Claude's safety checks flagged the content | Use **Full transcript** mode for this file. |
| **"Notion upload failed: Could not find page…"** | The integration isn't connected to the parent page | Do [5.3](#53-connect-the-integration-to-the-parent-page). |
| **"Notion upload failed: API token is invalid"** | Token mistyped or the integration was deleted | Copy the **Internal Integration Secret** again ([5.1](#51-create-an-internal-integration)). |
| **"Notion upload failed: Insufficient permissions"** | The integration is missing **Insert content** | Turn on Read, Update and Insert content ([5.1](#51-create-an-internal-integration), step 5). |
| **"Set a valid Notion parent page"** | The link pasted isn't a page link | Use **Copy link** on the page itself, not on a database or view. |
| The Start button is greyed out | Nothing is queued, or something's missing for your current choices | Add recordings, then read the yellow note above the button; it says what's missing. |
| Tasks look wrong or are missing | Claude only lists tasks the recording supports | Try **Claude Opus 5.5** if you're on Sonnet. Clear audio and stating who owns each task help. |
| The transcript has odd words or names | Speech-recognition errors | In OpenWhispr, add names and jargon to **Custom Dictionary**, set the **Language** in this app, or try a larger model. |
| Recorder plugged in but no banner | It isn't showing up as a drive, has no supported audio files, or everything on it is already done | Check it appears in Finder's sidebar. Check it records MP3 or WAV. Check **Settings → Recorders** in case you ignored it. |
| "Those files aren't a supported audio format" | The dropped file isn't MP3, WAV, M4A, FLAC, OGG or WebM | Convert it first, or set the recorder to MP3 or WAV. |
| "The file is no longer there. Was the recorder unplugged?" | The recorder was unplugged mid-queue | Plug it back in; the unprocessed recordings are offered again. |
| `npm start` says `command not found: npm` | Node.js isn't installed | Do [Part 1](#part-1-install-nodejs). |

### Still stuck?

From the project folder, run:

```bash
npx openwhispr doctor
node -v
```

Share the output, along with the exact error from the app, with whoever is helping you, **without** any API keys or tokens.

---

## Privacy summary

| Data | Where it goes |
| --- | --- |
| Your MP3 audio | Stays on your Mac (OpenWhispr local) |
| The transcript text | Sent to Anthropic's Claude API **only** in "Claude summary + tasks" mode |
| The final page | Sent to Notion **only** if "Upload to Notion" is ticked |
| API keys and tokens | Encrypted in your macOS Keychain; sent only to their own service |

Anthropic doesn't use Claude API data to train models by default. See Anthropic's commercial terms and privacy policy for details.

---

## Reference links

- OpenWhispr: [openwhispr.com](https://openwhispr.com) · [Docs](https://docs.openwhispr.com) · [Local models](https://docs.openwhispr.com/guides/local-models) · [CLI](https://docs.openwhispr.com/cli/install)
- Claude: [Claude Console](https://console.anthropic.com) · [API docs](https://docs.anthropic.com) · [Pricing](https://www.anthropic.com/pricing#api)
- Notion: [Your integrations](https://www.notion.so/profile/integrations) · [Integration guide](https://developers.notion.com/docs/create-a-notion-integration)
