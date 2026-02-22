import { NextRequest, NextResponse } from 'next/server';
import { cleanupMiniMaxClones } from '@/lib/cleanup-clones';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

    if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
        return NextResponse.json({ error: 'MiniMax API credentials not configured' }, { status: 500 });
    }

    try {
        // Clean up ALL existing clones before creating a new one
        await cleanupMiniMaxClones(MINIMAX_API_KEY, MINIMAX_GROUP_ID);

        const formData = await req.formData();
        const name = formData.get('name') as string;
        const audioFile = formData.get('audio') as File;

        if (!name || !audioFile) {
            return NextResponse.json({ error: 'Name and audio file are required' }, { status: 400 });
        }

        // Client sends WAV (converted from WebM in the browser)
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });

        // Step 1: Upload the file to MiniMax
        const uploadForm = new FormData();
        uploadForm.append('file', audioBlob, 'voice-sample.wav');
        uploadForm.append('purpose', 'voice_clone');

        const uploadResponse = await fetch(
            `https://api.minimax.io/v1/files/upload?GroupId=${MINIMAX_GROUP_ID}`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
                body: uploadForm,
            }
        );

        if (!uploadResponse.ok) {
            const uploadError = await uploadResponse.json().catch(() => ({}));
            console.error('MiniMax upload error:', uploadError);
            return NextResponse.json(
                { error: uploadError.base_resp?.status_msg || 'File upload failed' },
                { status: uploadResponse.status }
            );
        }

        const uploadData = await uploadResponse.json();
        const fileId = uploadData.file?.file_id;

        if (!fileId) {
            console.error('MiniMax upload response missing file_id:', uploadData);
            return NextResponse.json({ error: 'File upload did not return a file ID' }, { status: 500 });
        }

        // Step 2: Clone the voice using the uploaded file
        const customVoiceId = `mirror_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

        const cloneResponse = await fetch(
            `https://api.minimax.io/v1/voice_clone?GroupId=${MINIMAX_GROUP_ID}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file_id: fileId,
                    voice_id: customVoiceId,
                }),
            }
        );

        if (!cloneResponse.ok) {
            const cloneError = await cloneResponse.json().catch(() => ({}));
            console.error('MiniMax clone error:', cloneError);
            return NextResponse.json(
                { error: cloneError.base_resp?.status_msg || 'Voice cloning failed' },
                { status: cloneResponse.status }
            );
        }

        const cloneData = await cloneResponse.json();
        console.log('MiniMax clone response:', cloneData);

        // MiniMax returns success but doesn't echo the voice_id back — our custom ID is the voice_id
        if (cloneData.base_resp?.status_code !== 0) {
            console.error('MiniMax clone failed:', cloneData.base_resp);
            return NextResponse.json(
                { error: cloneData.base_resp?.status_msg || 'Voice cloning failed' },
                { status: 500 }
            );
        }

        return NextResponse.json({ voice_id: customVoiceId });
    } catch (error) {
        console.error('MiniMax clone voice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
