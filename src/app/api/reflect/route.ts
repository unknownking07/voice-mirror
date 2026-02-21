import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { MIRROR_SYSTEM_PROMPT } from '@/lib/prompts';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

    if (!ELEVENLABS_API_KEY || !ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;
        const voiceId = (formData.get('voiceId') as string) || VOICE_ID;
        const speed = parseFloat((formData.get('speed') as string) || '1');

        if (!audioFile) {
            return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
        }

        if (!voiceId) {
            return NextResponse.json({ error: 'No voice ID configured. Please clone your voice first.' }, { status: 400 });
        }

        // Step 1: Speech-to-Text via ElevenLabs
        const sttForm = new FormData();
        sttForm.append('file', audioFile, 'recording.webm');
        sttForm.append('model_id', 'scribe_v1');

        const sttResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: { 'xi-api-key': ELEVENLABS_API_KEY },
            body: sttForm,
        });

        if (!sttResponse.ok) {
            const sttError = await sttResponse.json().catch(() => ({}));
            console.error('STT error:', sttError);
            return NextResponse.json(
                { error: 'Speech transcription failed', details: sttError },
                { status: 500 }
            );
        }

        const sttData = await sttResponse.json();
        const transcript = sttData.text?.trim();

        if (!transcript) {
            return NextResponse.json(
                { error: 'no_speech', message: "I didn't hear anything. Try speaking a bit louder or closer to your mic." },
                { status: 400 }
            );
        }

        // Step 2: LLM Reflection via Claude
        const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 512,
            system: MIRROR_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: transcript }],
        });

        const reflection = (message.content[0] as { type: string; text: string }).text;

        if (!reflection) {
            return NextResponse.json({ error: 'LLM returned empty response' }, { status: 500 });
        }

        // Clamp speed to ElevenLabs' supported range (0.25 to 4.0)
        const clampedSpeed = Math.min(4.0, Math.max(0.25, speed));

        // Step 3: Text-to-Speech via ElevenLabs (cloned voice)
        const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: reflection,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        speed: clampedSpeed,
                    },
                }),
            }
        );

        if (!ttsResponse.ok) {
            const ttsError = await ttsResponse.json().catch(() => ({}));
            console.error('TTS error:', ttsError);
            // Fallback: return text-only response
            return NextResponse.json({
                transcript,
                reflection,
                audio: null,
                error: 'Voice synthesis failed, returning text only',
            });
        }

        // Collect audio stream into a buffer to send alongside metadata
        const audioArrayBuffer = await ttsResponse.arrayBuffer();
        const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');

        return NextResponse.json({
            transcript,
            reflection,
            audio: audioBase64,
        });
    } catch (error) {
        console.error('Reflect pipeline error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
