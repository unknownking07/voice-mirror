import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch voices' }, { status: response.status });
        }

        const data = await response.json();

        // Return a simplified list of voices
        const voices = data.voices.map((v: { voice_id: string; name: string; category: string; labels?: Record<string, string>; preview_url?: string }) => ({
            voice_id: v.voice_id,
            name: v.name,
            category: v.category,
            accent: v.labels?.accent || '',
            gender: v.labels?.gender || '',
            preview_url: v.preview_url || null,
        }));

        return NextResponse.json({ voices });
    } catch (error) {
        console.error('Fetch voices error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
