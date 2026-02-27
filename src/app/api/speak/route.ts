import { NextRequest, NextResponse } from 'next/server';
import { ttsElevenLabs, ttsMiniMax } from '@/lib/tts';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

    if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    let body: { text?: string; voiceId?: string; speed?: number; provider?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { text, voiceId, speed = 1, provider = 'elevenlabs' } = body;

    if (!text || !voiceId) {
        return NextResponse.json({ error: 'text and voiceId are required' }, { status: 400 });
    }

    if (provider === 'minimax' && (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID)) {
        return NextResponse.json({ error: 'MiniMax API credentials not configured' }, { status: 500 });
    }

    try {
        let audioBuffer: Buffer | null = null;

        if (provider === 'minimax') {
            const result = await ttsMiniMax(text, voiceId, speed, MINIMAX_API_KEY!, MINIMAX_GROUP_ID!);
            if (result === 'voice_expired') {
                return NextResponse.json({
                    error: 'voice_expired',
                    message: 'Your voice clone has expired. Please re-clone your voice.',
                }, { status: 410 });
            }
            audioBuffer = result;
        } else {
            audioBuffer = await ttsElevenLabs(text, voiceId, speed, ELEVENLABS_API_KEY);
        }

        if (!audioBuffer) {
            return NextResponse.json({ error: 'Voice synthesis failed' }, { status: 500 });
        }

        const audioBase64 = audioBuffer.toString('base64');
        return NextResponse.json({ audio: audioBase64 });
    } catch (err) {
        console.error('TTS exception:', err);
        return NextResponse.json(
            { error: `Speech synthesis failed: ${err instanceof Error ? err.message : 'unknown'}` },
            { status: 500 }
        );
    }
}
