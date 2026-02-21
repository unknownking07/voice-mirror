'use client';

import { useState, useEffect } from 'react';
import VoiceSetup from '@/components/VoiceSetup';
import MirrorSession from '@/components/MirrorSession';

export default function Home() {
    const [voiceId, setVoiceId] = useState<string | null>(null);
    const [provider, setProvider] = useState<'elevenlabs' | 'minimax'>('elevenlabs');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedId = localStorage.getItem('mirror_voice_id');
        const savedProvider = localStorage.getItem('mirror_voice_provider') as 'elevenlabs' | 'minimax' | null;
        if (savedId) {
            setVoiceId(savedId);
        }
        if (savedProvider) {
            setProvider(savedProvider);
        }
        setIsLoading(false);
    }, []);

    const handleVoiceCloned = (id: string, prov: 'elevenlabs' | 'minimax') => {
        localStorage.setItem('mirror_voice_id', id);
        localStorage.setItem('mirror_voice_provider', prov);
        setVoiceId(id);
        setProvider(prov);
    };

    const handleReset = () => {
        localStorage.removeItem('mirror_voice_id');
        localStorage.removeItem('mirror_voice_provider');
        setVoiceId(null);
        setProvider('elevenlabs');
    };

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="breathing-circle"></div>
            </div>
        );
    }

    return (
        <main className="app">
            {!voiceId ? (
                <VoiceSetup onVoiceCloned={handleVoiceCloned} />
            ) : (
                <>
                    <MirrorSession voiceId={voiceId} provider={provider} onVoiceExpired={handleReset} />
                    <button className="reset-button" onClick={handleReset} title="Reset voice profile">
                        Reset Voice
                    </button>
                </>
            )}
        </main>
    );
}
