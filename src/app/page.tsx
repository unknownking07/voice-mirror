'use client';

import { useState, useEffect } from 'react';
import VoiceSetup from '@/components/VoiceSetup';
import MirrorSession from '@/components/MirrorSession';

export default function Home() {
    const [voiceId, setVoiceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check localStorage for saved voice ID
        const savedId = localStorage.getItem('mirror_voice_id');
        if (savedId) {
            setVoiceId(savedId);
        }
        setIsLoading(false);
    }, []);

    const handleVoiceCloned = (id: string) => {
        localStorage.setItem('mirror_voice_id', id);
        setVoiceId(id);
    };

    const handleReset = () => {
        localStorage.removeItem('mirror_voice_id');
        setVoiceId(null);
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
                    <MirrorSession voiceId={voiceId} />
                    <button className="reset-button" onClick={handleReset} title="Reset voice profile">
                        Reset Voice
                    </button>
                </>
            )}
        </main>
    );
}
