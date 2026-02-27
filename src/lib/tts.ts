/** Shared TTS functions for ElevenLabs and MiniMax providers. */

export async function ttsElevenLabs(
    text: string,
    voiceId: string,
    speed: number,
    apiKey: string
): Promise<Buffer | null> {
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

export async function ttsMiniMax(
    text: string,
    voiceId: string,
    speed: number,
    apiKey: string,
    groupId: string
): Promise<Buffer | null | 'voice_expired'> {
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
