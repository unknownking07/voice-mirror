# Voice Mirror

A mirror app where you talk to yourself — and hear profound answers back in your own voice.

You speak. Your voice is cloned by ElevenLabs. Claude thinks deeply about what you said. Then you hear the answer spoken back to you, in your own voice, like the wisest version of yourself already knew.

## How It Works

1. **Voice Setup** — Record 30+ seconds of natural speech. ElevenLabs clones your voice from this sample.
2. **Speak** — Say whatever is on your mind. Ask a question, share a thought, voice a fear.
3. **Reflect** — Your speech is transcribed, then sent to Claude with a carefully crafted prompt that makes it respond as your wisest inner voice.
4. **Listen** — The response is spoken back to you using your cloned voice via ElevenLabs text-to-speech.

The result: you ask something — you hear yourself answer with depth you didn't know you had.

## Tech Stack

- **Next.js 14** (App Router)
- **ElevenLabs** — Voice cloning, speech-to-text (Scribe v1), text-to-speech
- **Anthropic Claude** — Generates profound, first-person reflections
- **TypeScript** throughout

## Setup

### Prerequisites

- Node.js 18+
- An [ElevenLabs](https://elevenlabs.io) account (Starter plan or above for voice cloning)
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
```

`ELEVENLABS_VOICE_ID` can be left empty — the app creates and uses a per-session cloned voice ID automatically.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Voice cloning** — Clone your voice from a single recording, or pick from ElevenLabs preset voices
- **Profound answers** — Claude responds as the deepest, most honest version of you. No platitudes, no therapy-speak. Real insight.
- **Voice speed control** — Adjust playback speed from 0.5x to 2.0x in settings
- **Session history** — Review past reflections within the current session
- **Introspective prompts** — Random thought-provoking prompts to get you started
- **Minimal dark UI** — Built for late-night reflection. Orb visualizer, waveform animations, no distractions.

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/clone-voice` | POST | Clone a voice from an audio sample |
| `/api/voices` | GET | List available ElevenLabs voices |
| `/api/preview-voice` | POST | Preview a cloned voice with test speech |
| `/api/reflect` | POST | Full pipeline: transcribe, reflect (Claude), speak (TTS) |

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` as environment variables
4. Deploy

## License

MIT
