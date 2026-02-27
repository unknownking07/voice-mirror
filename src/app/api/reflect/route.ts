import { NextRequest, NextResponse } from 'next/server';
import { MIRROR_SYSTEM_PROMPT } from '@/lib/prompts';
import { ttsElevenLabs, ttsMiniMax } from '@/lib/tts';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

    if (!ELEVENLABS_API_KEY || !ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
        return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    const audioFile = formData.get('audio') as File | null;
    const voiceId = (formData.get('voiceId') as string) || VOICE_ID;
    const speed = parseFloat((formData.get('speed') as string) || '1');
    const provider = (formData.get('provider') as string) || 'elevenlabs';
    const customSystemPrompt = formData.get('systemPrompt') as string | null;
    const providedTranscript = formData.get('transcript') as string | null;

    if (!audioFile && !providedTranscript) {
        return NextResponse.json({ error: 'Audio file or transcript is required' }, { status: 400 });
    }

    if (!voiceId) {
        return NextResponse.json({ error: 'No voice ID configured. Please clone your voice first.' }, { status: 400 });
    }

    // Validate MiniMax credentials if that provider is selected
    if (provider === 'minimax' && (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID)) {
        return NextResponse.json({ error: 'MiniMax API credentials not configured' }, { status: 500 });
    }

    // Step 1: Speech-to-Text (skip if transcript provided)
    let transcript: string;
    if (providedTranscript) {
        transcript = providedTranscript;
    } else {
        try {
            const sttForm = new FormData();
            sttForm.append('file', audioFile!, 'recording.webm');
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
            transcript = sttData.text?.trim();
        } catch (err) {
            console.error('STT exception:', err);
            return NextResponse.json({ error: `Transcription failed: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 500 });
        }

        if (!transcript) {
            return NextResponse.json(
                { error: 'no_speech', message: "I didn't hear anything. Try speaking a bit louder or closer to your mic." },
                { status: 400 }
            );
        }
    }

    // Step 2: LLM Reflection via Claude
    // Try Sonnet first, fall back to Haiku if overloaded
    const MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
    const systemPrompt = customSystemPrompt || MIRROR_SYSTEM_PROMPT;
    let reflection: string;
    try {
        let claudeResponse: Response | null = null;

        for (const model of MODELS) {
            claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 512,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: transcript }],
                }),
            });

            if (claudeResponse.status === 529 || claudeResponse.status === 503) {
                console.log(`Claude ${model} returned ${claudeResponse.status}, trying next model...`);
                await new Promise((r) => setTimeout(r, 500));
                continue;
            }
            break;
        }

        if (!claudeResponse!.ok) {
            const claudeError = await claudeResponse!.json().catch(() => ({}));
            console.error('Claude API error:', claudeResponse!.status, claudeError);
            return NextResponse.json(
                { error: `Reflection failed: ${claudeError.error?.message || claudeResponse!.statusText}` },
                { status: 500 }
            );
        }

        const claudeData = await claudeResponse!.json();
        reflection = claudeData.content?.[0]?.text;
    } catch (err) {
        console.error('Claude API exception:', err);
        return NextResponse.json({ error: `Reflection failed: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 500 });
    }

    if (!reflection) {
        return NextResponse.json({ error: 'LLM returned empty response' }, { status: 500 });
    }

    // Step 3: Text-to-Speech (provider-specific)
    let audioBuffer: Buffer | null = null;

    try {
        if (provider === 'minimax') {
            const result = await ttsMiniMax(reflection, voiceId, speed, MINIMAX_API_KEY!, MINIMAX_GROUP_ID!);
            if (result === 'voice_expired') {
                return NextResponse.json({
                    error: 'voice_expired',
                    message: 'Your voice clone has expired. Please re-clone your voice.',
                    transcript,
                    reflection,
                }, { status: 410 });
            }
            audioBuffer = result;
        } else {
            audioBuffer = await ttsElevenLabs(reflection, voiceId, speed, ELEVENLABS_API_KEY);
        }
    } catch (err) {
        console.error('TTS exception:', err);
        // Fall through — audioBuffer stays null, text-only response below
    }

    if (!audioBuffer) {
        // Fallback: return text-only response
        return NextResponse.json({
            transcript,
            reflection,
            audio: null,
            error: 'Voice synthesis failed, returning text only',
        });
    }

    const audioBase64 = audioBuffer.toString('base64');

    return NextResponse.json({
        transcript,
        reflection,
        audio: audioBase64,
    });
}
