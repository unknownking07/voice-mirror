'use client';

import VoiceSetup from '@/components/VoiceSetup';
import { useVoice } from '@/hooks/useVoice';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
    const { setVoice } = useVoice();
    const router = useRouter();

    const handleVoiceCloned = (id: string, provider: 'elevenlabs' | 'minimax') => {
        setVoice(id, provider);
        router.push('/');
    };

    return (
        <div className="app">
            <VoiceSetup onVoiceCloned={handleVoiceCloned} />
        </div>
    );
}
