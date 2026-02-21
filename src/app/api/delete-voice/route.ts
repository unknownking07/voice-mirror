import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { voiceId, provider } = await req.json();

    if (!voiceId) {
        return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
    }

    try {
        if (provider === 'minimax') {
            const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
            const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;
            if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
                return NextResponse.json({ error: 'MiniMax credentials not configured' }, { status: 500 });
            }

            const response = await fetch(
                `https://api.minimax.io/v1/delete_voice?GroupId=${MINIMAX_GROUP_ID}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        voice_id: voiceId,
                        voice_type: 'voice_cloning',
                    }),
                }
            );
            const data = await response.json().catch(() => ({}));
            console.log('MiniMax delete voice:', data);
        } else {
            const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
            if (!ELEVENLABS_API_KEY) {
                return NextResponse.json({ error: 'ElevenLabs key not configured' }, { status: 500 });
            }

            const response = await fetch(
                `https://api.elevenlabs.io/v1/voices/${voiceId}`,
                {
                    method: 'DELETE',
                    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
                }
            );
            const data = await response.json().catch(() => ({}));
            console.log('ElevenLabs delete voice:', data);
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Delete voice error:', error);
        return NextResponse.json({ error: 'Failed to delete voice' }, { status: 500 });
    }
}
