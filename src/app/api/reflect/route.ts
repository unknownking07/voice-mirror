import { NextRequest, NextResponse } from 'next/server';
import { MIRROR_SYSTEM_PROMPT } from '@/lib/prompts';
import {
    deleteOneElevenLabsClone, cleanupElevenLabsClones,
    deleteOneMiniMaxClone, cleanupMiniMaxClones,
} from '@/lib/cleanup-clones';

export const maxDuration = 60;

async function ttsElevenLabs(text: string, voiceId: string, speed: number, apiKey: string): Promise<Buffer | null> {
    const clampedSpeed = Math.min(4.0, Math.max(0.25, speed));

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    speed: clampedSpeed,
                },
            }),
        }
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('ElevenLabs TTS error:', err);
        return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function ttsMiniMax(text: string, voiceId: string, speed: number, apiKey: string, groupId: string): Promise<Buffer | null | 'voice_expired'> {
    // MiniMax speed range: 0.5 to 2.0
    const clampedSpeed = Math.min(2.0, Math.max(0.5, speed));

    const response = await fetch(
        `https://api.minimax.io/v1/t2a_v2?GroupId=${groupId}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'speech-02-turbo',
                text,
                voice_setting: {
                    voice_id: voiceId,
                    speed: clampedSpeed,
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
        const err = await response.json().catch(() => ({}));
        console.error('MiniMax TTS error:', err);
        // Detect expired/deleted voice clone
        const errMsg = (err.base_resp?.status_msg || '').toLowerCase();
        if (errMsg.includes('voice') || errMsg.includes('slot') || errMsg.includes('not found') || errMsg.includes('invalid')) {
            return 'voice_expired';
        }
        return null;
    }

    const data = await response.json();
    console.log('MiniMax TTS response keys:', Object.keys(data));
    console.log('MiniMax TTS base_resp:', data.base_resp);
    console.log('MiniMax TTS audio_file length:', data.audio_file?.length || 0);

    if (data.base_resp?.status_code !== 0 && data.base_resp?.status_code !== undefined) {
        console.error('MiniMax TTS error:', data.base_resp);
        const errMsg = (data.base_resp?.status_msg || '').toLowerCase();
        if (errMsg.includes('voice') || errMsg.includes('slot') || errMsg.includes('not found') || errMsg.includes('invalid')) {
            return 'voice_expired';
        }
        return null;
    }

    const audioHex = data.audio_file || data.data?.audio_file || data.data?.audio;

    if (!audioHex) {
        console.error('MiniMax TTS returned no audio. Full response:', JSON.stringify(data).substring(0, 500));
        return null;
    }

    // Decode audio: MiniMax returns hex; validate with MP3 magic bytes and fall back to base64
    const hexBuf = Buffer.from(audioHex, 'hex');
    // Valid MP3: sync word (0xFF 0xEX) or ID3 header (0x49 0x44 0x33)
    const isValidMp3 = hexBuf.length > 10 && (
        (hexBuf[0] === 0xFF && (hexBuf[1] & 0xE0) === 0xE0) ||
        (hexBuf[0] === 0x49 && hexBuf[1] === 0x44 && hexBuf[2] === 0x33)
    );
    return isValidMp3 ? hexBuf : Buffer.from(audioHex, 'base64');
}

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

    const audioFile = formData.get('audio') as File;
    const voiceId = (formData.get('voiceId') as string) || VOICE_ID;
    const speed = parseFloat((formData.get('speed') as string) || '1');
    const provider = (formData.get('provider') as string) || 'elevenlabs';

    if (!audioFile) {
        return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    if (!voiceId) {
        return NextResponse.json({ error: 'No voice ID configured. Please clone your voice first.' }, { status: 400 });
    }

    // Validate MiniMax credentials if that provider is selected
    if (provider === 'minimax' && (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID)) {
        return NextResponse.json({ error: 'MiniMax API credentials not configured' }, { status: 500 });
    }

    // Step 1: Speech-to-Text via ElevenLabs (always)
    let transcript: string;
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

    // Step 2: LLM Reflection via Claude (direct REST API — more reliable on serverless)
    let reflection: string;
    try {
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 512,
                system: MIRROR_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: transcript }],
            }),
        });

        if (!claudeResponse.ok) {
            const claudeError = await claudeResponse.json().catch(() => ({}));
            console.error('Claude API error:', claudeResponse.status, claudeError);
            return NextResponse.json(
                { error: `Reflection failed: ${claudeError.error?.message || claudeResponse.statusText}` },
                { status: 500 }
            );
        }

        const claudeData = await claudeResponse.json();
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

    // Delete voice clones after successful TTS to free up every slot
    // 1. Direct-delete the specific voice used (always works, even for inactive clones)
    // 2. Sweep all remaining clones via list API (catches orphans from abandoned sessions)
    // Must be awaited — Vercel serverless terminates execution after response is sent
    if (provider === 'minimax') {
        await deleteOneMiniMaxClone(MINIMAX_API_KEY!, MINIMAX_GROUP_ID!, voiceId);
        await cleanupMiniMaxClones(MINIMAX_API_KEY!, MINIMAX_GROUP_ID!);
    } else {
        await deleteOneElevenLabsClone(ELEVENLABS_API_KEY, voiceId);
        await cleanupElevenLabsClones(ELEVENLABS_API_KEY);
    }

    return NextResponse.json({
        transcript,
        reflection,
        audio: audioBase64,
    });
}

