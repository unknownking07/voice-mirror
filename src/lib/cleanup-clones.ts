/**
 * Utility to list and delete ALL voice clones for both ElevenLabs and MiniMax.
 * Called after clone creation (to purge orphans) and after TTS (to free all slots).
 */

export async function cleanupElevenLabsClones(
    apiKey: string,
    excludeVoiceId?: string
): Promise<number> {
    let deleted = 0;
    try {
        // List all voices
        const res = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKey },
        });
        if (!res.ok) {
            console.error('ElevenLabs list voices failed:', res.status);
            return 0;
        }

        const data = await res.json();
        const clonedVoices = (data.voices || []).filter(
            (v: { category: string; voice_id: string }) =>
                v.category === 'cloned' && v.voice_id !== excludeVoiceId
        );

        // Delete each cloned voice
        for (const voice of clonedVoices) {
            try {
                const delRes = await fetch(
                    `https://api.elevenlabs.io/v1/voices/${voice.voice_id}`,
                    {
                        method: 'DELETE',
                        headers: { 'xi-api-key': apiKey },
                    }
                );
                if (delRes.ok) {
                    deleted++;
                    console.log(`Cleaned up ElevenLabs clone: ${voice.voice_id} (${voice.name})`);
                } else {
                    console.error(`Failed to delete ElevenLabs clone ${voice.voice_id}:`, delRes.status);
                }
            } catch (err) {
                console.error(`Error deleting ElevenLabs clone ${voice.voice_id}:`, err);
            }
        }

        if (deleted > 0) {
            console.log(`ElevenLabs cleanup: deleted ${deleted} orphaned clone(s)`);
        }
    } catch (err) {
        console.error('ElevenLabs cleanup error (non-fatal):', err);
    }
    return deleted;
}

export async function cleanupMiniMaxClones(
    apiKey: string,
    groupId: string,
    excludeVoiceId?: string
): Promise<number> {
    let deleted = 0;
    try {
        // List all cloned voices
        const res = await fetch(
            `https://api.minimax.io/v1/get_voice?GroupId=${groupId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ voice_type: 'voice_cloning' }),
            }
        );

        if (!res.ok) {
            console.error('MiniMax list voices failed:', res.status);
            return 0;
        }

        const data = await res.json();
        const clonedVoices: { voice_id: string }[] = data.voice_cloning || [];

        // Delete each cloned voice except the excluded one
        for (const voice of clonedVoices) {
            if (voice.voice_id === excludeVoiceId) continue;
            try {
                const delRes = await fetch(
                    `https://api.minimax.io/v1/delete_voice?GroupId=${groupId}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            voice_id: voice.voice_id,
                            voice_type: 'voice_cloning',
                        }),
                    }
                );
                if (delRes.ok) {
                    deleted++;
                    console.log(`Cleaned up MiniMax clone: ${voice.voice_id}`);
                } else {
                    console.error(`Failed to delete MiniMax clone ${voice.voice_id}:`, delRes.status);
                }
            } catch (err) {
                console.error(`Error deleting MiniMax clone ${voice.voice_id}:`, err);
            }
        }

        if (deleted > 0) {
            console.log(`MiniMax cleanup: deleted ${deleted} orphaned clone(s)`);
        }
    } catch (err) {
        console.error('MiniMax cleanup error (non-fatal):', err);
    }
    return deleted;
}
