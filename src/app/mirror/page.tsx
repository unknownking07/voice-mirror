'use client';

import MirrorSession from '@/components/MirrorSession';
import VoiceRequired from '@/components/VoiceRequired';
import { useVoice } from '@/hooks/useVoice';

export default function MirrorPage() {
    const { voiceId, provider, resetVoice } = useVoice();

    return (
        <div className="app">
            <VoiceRequired>
                <MirrorSession voiceId={voiceId!} provider={provider} onVoiceExpired={resetVoice} />
            </VoiceRequired>
        </div>
    );
}
