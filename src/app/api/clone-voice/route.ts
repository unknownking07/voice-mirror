import { NextRequest, NextResponse } from 'next/server';
import { cleanupElevenLabsClones } from '@/lib/cleanup-clones';

export async function POST(req: NextRequest) {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    try {
        // Clean up ALL existing clones before creating a new one
        await cleanupElevenLabsClones(ELEVENLABS_API_KEY);

        const formData = await req.formData();
        const name = formData.get('name') as string;
        const audioFile = formData.get('audio') as File;

        if (!name || !audioFile) {
            return NextResponse.json({ error: 'Name and audio file are required' }, { status: 400 });
        }

        const elevenForm = new FormData();
        elevenForm.append('name', name);
        elevenForm.append('files', audioFile);

        const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: elevenForm,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('ElevenLabs clone error:', errorData);
            return NextResponse.json(
                { error: errorData.detail?.message || 'Voice cloning failed' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({ voice_id: data.voice_id });
    } catch (error) {
        console.error('Clone voice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
