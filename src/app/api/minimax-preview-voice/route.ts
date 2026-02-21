import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const voiceId = req.nextUrl.searchParams.get('voiceId');
    if (!voiceId) {
        return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
    }

    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

    if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
        return NextResponse.json({ error: 'MiniMax API credentials not configured' }, { status: 500 });
    }

    try {
        const response = await fetch(
            `https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'speech-02-turbo',
                    text: 'Hello, this is a test of your cloned voice. If this sounds like you, your voice mirror is ready.',
                    voice_setting: {
                        voice_id: voiceId,
                        speed: 1.0,
                        vol: 1.0,
                        pitch: 0,
                    },
                    audio_setting: {
                        format: 'mp3',
                        sample_rate: 32000,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('MiniMax preview HTTP error:', response.status, errorData);
            return NextResponse.json({ error: errorData.base_resp?.status_msg || 'Voice preview failed' }, { status: response.status });
        }

        const data = await response.json();
        console.log('MiniMax T2A response keys:', Object.keys(data));
        console.log('MiniMax T2A base_resp:', data.base_resp);
        console.log('MiniMax T2A audio_file length:', data.audio_file?.length || 0);
        console.log('MiniMax T2A data.data keys:', data.data ? Object.keys(data.data) : 'no data field');

        if (data.base_resp?.status_code !== 0 && data.base_resp?.status_code !== undefined) {
            console.error('MiniMax preview API error:', data.base_resp);
            return NextResponse.json({ error: data.base_resp.status_msg || 'Voice preview failed' }, { status: 500 });
        }

        // MiniMax T2A v2 returns audio in different possible fields
        const audioHex = data.audio_file || data.data?.audio_file || data.data?.audio;

        if (!audioHex) {
            console.error('MiniMax preview: no audio in response. Full response:', JSON.stringify(data).substring(0, 500));
            return NextResponse.json({ error: 'No audio returned from MiniMax' }, { status: 500 });
        }

        // Decode audio: MiniMax returns hex; validate with MP3 magic bytes and fall back to base64
        const hexBuf = Buffer.from(audioHex, 'hex');
        // Valid MP3: sync word (0xFF 0xEX) or ID3 header (0x49 0x44 0x33)
        const isValidMp3 = hexBuf.length > 10 && (
            (hexBuf[0] === 0xFF && (hexBuf[1] & 0xE0) === 0xE0) ||
            (hexBuf[0] === 0x49 && hexBuf[1] === 0x44 && hexBuf[2] === 0x33)
        );
        const audioBuffer = isValidMp3 ? hexBuf : Buffer.from(audioHex, 'base64');

        return new Response(new Uint8Array(audioBuffer), {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('MiniMax voice preview error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
