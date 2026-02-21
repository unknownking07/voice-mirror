# Voice Mirror

A mirror app where you talk to yourself — and hear profound answers back in your own voice.

You speak. Your voice is cloned. Claude thinks deeply about what you said. Then you hear the answer spoken back to you, in your own voice, like the wisest version of yourself already knew.

## How It Works

1. **Voice Setup** — Choose between ElevenLabs or MiniMax as your voice engine. Record 30–60 seconds of natural speech. Your voice is cloned from this sample.
2. **Speak** — Say whatever is on your mind. Ask a question, share a thought, voice a fear.
3. **Reflect** — Your speech is transcribed, then sent to Claude with a carefully crafted prompt that makes it respond as your wisest inner voice.
4. **Listen** — The response is spoken back to you using your cloned voice via text-to-speech.

The result: you ask something — you hear yourself answer with depth you didn't know you had.

## Tech Stack

- **Next.js 14** (App Router)
- **ElevenLabs** — Voice cloning, speech-to-text (Scribe v1), text-to-speech
- **MiniMax** — Alternative voice engine with more natural-sounding voice cloning
- **Anthropic Claude** — Generates profound, first-person reflections
- **Google Analytics** — Usage tracking
- **TypeScript** throughout

## Setup

### Prerequisites

- Node.js 18+
- An [ElevenLabs](https://elevenlabs.io) account (Starter plan or above for voice cloning)
- A [MiniMax](https://www.minimaxi.com) account (optional, for alternative voice engine)
- An [Anthropic](https://console.anthropic.com) API key

### Install

```bash
git clone https://github.com/unknownking07/voice-mirror.git
cd voice-mirror
npm install
```

### Environment Variables

Create a `.env.local` file in the root:

```
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
ELEVENLABS_VOICE_ID=
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_GROUP_ID=your_minimax_group_id
```

- `ELEVENLABS_VOICE_ID` can be left empty — the app creates and uses a per-session cloned voice ID automatically.
- `MINIMAX_API_KEY` and `MINIMAX_GROUP_ID` are optional — only needed if you want to offer MiniMax as a voice engine.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Dual voice engines** — Choose between ElevenLabs and MiniMax for voice cloning & TTS
- **Voice cloning** — Clone your voice from a single recording, or pick from ElevenLabs preset voices
- **Auto-cleanup** — Voice clones are automatically deleted after each use to prevent running out of API slots
- **Profound answers** — Claude responds as the deepest, most honest version of you. No platitudes, no therapy-speak. Real insight.
- **Voice speed control** — Adjust playback speed from 0.5x to 2.0x in settings
- **Session history** — Review past reflections within the current session
- **Introspective prompts** — Random thought-provoking prompts to get you started
- **Minimal dark UI** — Built for late-night reflection. Orb visualizer, waveform animations, no distractions.
- **Mobile optimized** — Responsive design with centered controls and proper touch targets

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/clone-voice` | POST | Clone a voice via ElevenLabs |
| `/api/minimax-clone-voice` | POST | Clone a voice via MiniMax |
| `/api/voices` | GET | List available ElevenLabs preset voices |
| `/api/preview-voice` | POST | Preview a cloned voice (ElevenLabs) |
| `/api/minimax-preview-voice` | POST | Preview a cloned voice (MiniMax) |
| `/api/reflect` | POST | Full pipeline: transcribe → reflect (Claude) → speak (TTS) → delete clone |
| `/api/delete-voice` | POST | Delete a voice clone from either provider |

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables: `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`
4. Deploy

## License

MIT
