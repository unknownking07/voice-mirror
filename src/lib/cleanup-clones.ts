/**
 * Utility to list and delete ALL voice clones for both ElevenLabs and MiniMax.
 * Called after clone creation (to purge orphans) and after TTS (to free all slots).
 *
 * Two strategies are used together for reliability:
 *  1. Direct delete — always delete a specific voiceId (guaranteed to work)
 *  2. List + sweep — list all clones via API and delete each one (catches orphans)
 */

// ─── ElevenLabs ──────────────────────────────────────────────────────

export async function deleteOneElevenLabsClone(apiKey: string, voiceId: string): Promise<boolean> {
    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
            method: 'DELETE',
            headers: { 'xi-api-key': apiKey },
        });
        const ok = res.ok;
        console.log(`ElevenLabs direct-delete ${voiceId}: ${ok ? 'success' : res.status}`);
        return ok;
    } catch (err) {
        console.error(`ElevenLabs direct-delete ${voiceId} error:`, err);
        return false;
    }
}

export async function cleanupElevenLabsClones(
    apiKey: string,
    excludeVoiceId?: string
): Promise<number> {
    let deleted = 0;
    try {
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

        for (const voice of clonedVoices) {
            const ok = await deleteOneElevenLabsClone(apiKey, voice.voice_id);
            if (ok) deleted++;
        }

        if (deleted > 0) {
            console.log(`ElevenLabs cleanup: deleted ${deleted} orphaned clone(s)`);
        }
    } catch (err) {
        console.error('ElevenLabs cleanup error (non-fatal):', err);
    }
    return deleted;
}

// ─── MiniMax ─────────────────────────────────────────────────────────

export async function deleteOneMiniMaxClone(
    apiKey: string,
    groupId: string,
    voiceId: string
): Promise<boolean> {
    try {
        const res = await fetch(
            `https://api.minimax.io/v1/delete_voice?GroupId=${groupId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    voice_id: voiceId,
                    voice_type: 'voice_cloning',
                }),
            }
        );
        const body = await res.json().catch(() => ({}));
        // MiniMax returns HTTP 200 even on failure — check body status_code
        const ok = res.ok && (body.base_resp?.status_code === 0 || !body.base_resp?.status_code);
        console.log(`MiniMax direct-delete ${voiceId}: ${ok ? 'success' : JSON.stringify(body.base_resp)}`);
        return ok;
    } catch (err) {
        console.error(`MiniMax direct-delete ${voiceId} error:`, err);
        return false;
    }
}

export async function cleanupMiniMaxClones(
    apiKey: string,
    groupId: string,
    excludeVoiceId?: string
): Promise<number> {
    let deleted = 0;
    try {
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
        console.log('MiniMax get_voice response keys:', Object.keys(data));

        // The API may nest clones under different keys — check all possibilities
        const clonedVoices: { voice_id: string }[] =
            data.voice_cloning || data.voices || data.data?.voice_cloning || [];

        console.log(`MiniMax found ${clonedVoices.length} clone(s) to clean up`);

        for (const voice of clonedVoices) {
            if (voice.voice_id === excludeVoiceId) continue;
            const ok = await deleteOneMiniMaxClone(apiKey, groupId, voice.voice_id);
            if (ok) deleted++;
        }

        if (deleted > 0) {
            console.log(`MiniMax cleanup: deleted ${deleted} orphaned clone(s)`);
        }
    } catch (err) {
        console.error('MiniMax cleanup error (non-fatal):', err);
    }
    return deleted;
}
