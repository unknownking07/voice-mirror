import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export const maxDuration = 60;

function convertWebmToWav(inputBuffer: Buffer): Buffer {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mirror-'));
    const inputPath = join(tmpDir, 'input.webm');
    const outputPath = join(tmpDir, 'output.wav');

    try {
        writeFileSync(inputPath, inputBuffer);
        execSync(`ffmpeg -i "${inputPath}" -ar 44100 -ac 1 "${outputPath}" -y`, {
            stdio: 'pipe',
            timeout: 30000,
        });
        return readFileSync(outputPath);
    } finally {
        try { unlinkSync(inputPath); } catch { /* ignore */ }
        try { unlinkSync(outputPath); } catch { /* ignore */ }
    }
}

export async function POST(req: NextRequest) {
    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

    if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
        return NextResponse.json({ error: 'MiniMax API credentials not configured' }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const name = formData.get('name') as string;
        const audioFile = formData.get('audio') as File;

        if (!name || !audioFile) {
            return NextResponse.json({ error: 'Name and audio file are required' }, { status: 400 });
        }

        // Convert WebM to WAV (MiniMax only accepts MP3, M4A, WAV)
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        let wavBuffer: Buffer;
        try {
            wavBuffer = convertWebmToWav(audioBuffer);
        } catch (err) {
            console.error('Audio conversion failed:', err);
            return NextResponse.json({ error: 'Failed to convert audio format. Please try uploading an MP3 or WAV file.' }, { status: 400 });
        }

        const wavBlob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });

        // Step 1: Upload the WAV file to MiniMax
        const uploadForm = new FormData();
        uploadForm.append('file', wavBlob, 'voice-sample.wav');
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
