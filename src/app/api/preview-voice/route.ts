import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const voiceId = req.nextUrl.searchParams.get('voiceId');
    if (!voiceId) {
        return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: 'Hello, this is a test of your cloned voice. If this sounds like you, your voice mirror is ready.',
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            }
        );

        if (!response.ok) {
            return NextResponse.json({ error: 'Voice preview failed' }, { status: response.status });
        }

        return new Response(response.body, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Voice preview error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
