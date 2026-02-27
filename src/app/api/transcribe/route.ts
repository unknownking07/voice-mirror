import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
        return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    const audioFile = formData.get('audio') as File;
    if (!audioFile) {
        return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    try {
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

        return NextResponse.json({ transcript });
    } catch (err) {
        console.error('Transcription exception:', err);
        return NextResponse.json(
            { error: `Transcription failed: ${err instanceof Error ? err.message : 'unknown'}` },
            { status: 500 }
        );
    }
}
