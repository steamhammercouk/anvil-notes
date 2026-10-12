# Third-party notices and trademarks

Anvil Notes is an independent project. It is **not affiliated with, endorsed by, sponsored by or approved by** any of the companies or projects named below. Their names are used only to describe what Anvil Notes works with.

## Trademarks

| Name | Owner |
| --- | --- |
| **Claude** and **Anthropic** | Anthropic, PBC |
| **Notion** | Notion Labs, Inc. |
| **OpenWhispr** | Its respective owner |
| **OpenAI** and **Whisper** | OpenAI |
| **NVIDIA** and **Parakeet** | NVIDIA Corporation |
| **Apple**, **Mac** and **macOS** | Apple Inc., registered in the U.S. and other countries |
| **Electron** | OpenJS Foundation |
| **Plaud** | Its respective owner |

All other trademarks, product names and company names are the property of their respective owners. Any comparison with another product is for information only and reflects publicly available details at the time of writing.

## Services Anvil Notes connects to

Anvil Notes connects to these services **only when you choose to**, using **your own** accounts and keys. Your use of each service is governed by that provider's own terms, privacy policy and pricing, not by this project.

| Service | Used for | When |
| --- | --- | --- |
| [OpenWhispr](https://openwhispr.com) desktop app | Transcription on your Mac | Default transcription engine |
| [OpenWhispr Cloud](https://docs.openwhispr.com/api/transcription) | Cloud transcription | Only if selected in Settings |
| [Claude API](https://www.anthropic.com/api) by Anthropic | Summaries and task extraction | Only in "Claude summary + tasks" mode |
| [Notion API](https://developers.notion.com) | Creating pages | Only when "Upload to Notion" is ticked |
| [OpenAI API](https://platform.openai.com) | Whisper transcription | Only if selected in Settings |

Speech models used by OpenWhispr, such as NVIDIA Parakeet or OpenAI Whisper, are downloaded and managed by OpenWhispr, not distributed with Anvil Notes, and are subject to their own licences (for example, NVIDIA's Parakeet models are published under CC-BY-4.0).

## Open-source software included in Anvil Notes

The Anvil Notes app bundles the following open-source packages. Each package's full licence text is included with the package inside the app.

| Package | Licence | Purpose |
| --- | --- | --- |
| [Electron](https://github.com/electron/electron) | MIT | App framework (includes Chromium and Node.js, whose licences ship with the app) |
| [@openwhispr/cli](https://www.npmjs.com/package/@openwhispr/cli) | MIT | Talks to the OpenWhispr desktop app |
| [commander](https://github.com/tj/commander.js) | MIT | Used by the OpenWhispr CLI |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | MIT | Claude API client |
| [@notionhq/client](https://github.com/makenotion/notion-sdk-js) | MIT | Notion API client |
| [openai](https://github.com/openai/openai-node) | Apache-2.0 | OpenAI API client |
| [zod](https://github.com/colinhacks/zod) | MIT | Data validation |
| json-schema-to-ts, ts-algebra, @babel/runtime, undici, standardwebhooks, @stablelib/base64 | MIT | Dependencies of the packages above |
| fast-sha256 | Unlicense | Dependency of the packages above |

The build tool [electron-builder](https://github.com/electron-userland/electron-builder) (MIT) is used to create the installer but isn't included in the app.
