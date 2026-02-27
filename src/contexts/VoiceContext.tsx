'use client';

import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { STORAGE_KEYS, migrateStorageKeys } from '@/lib/storage';

interface VoiceContextType {
    voiceId: string | null;
    provider: 'elevenlabs' | 'minimax';
    speed: number;
    userName: string;
    isLoading: boolean;
    hasVoice: boolean;
    setVoice: (id: string, provider: 'elevenlabs' | 'minimax') => void;
    resetVoice: () => void;
    setSpeed: (speed: number) => void;
    setUserName: (name: string) => void;
}

export const VoiceContext = createContext<VoiceContextType | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
    const [voiceId, setVoiceId] = useState<string | null>(null);
    const [provider, setProvider] = useState<'elevenlabs' | 'minimax'>('elevenlabs');
    const [speed, setSpeedState] = useState(1);
    const [userName, setUserNameState] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        migrateStorageKeys();
        const savedId = localStorage.getItem(STORAGE_KEYS.VOICE_ID);
        const savedProvider = localStorage.getItem(STORAGE_KEYS.VOICE_PROVIDER) as 'elevenlabs' | 'minimax' | null;
        const savedSpeed = localStorage.getItem(STORAGE_KEYS.VOICE_SPEED);
        const savedName = localStorage.getItem(STORAGE_KEYS.USER_NAME);

        if (savedId) setVoiceId(savedId);
        if (savedProvider) setProvider(savedProvider);
        if (savedSpeed) setSpeedState(parseFloat(savedSpeed));
        if (savedName) setUserNameState(savedName);
        setIsLoading(false);
    }, []);

    const setVoice = useCallback((id: string, prov: 'elevenlabs' | 'minimax') => {
        localStorage.setItem(STORAGE_KEYS.VOICE_ID, id);
        localStorage.setItem(STORAGE_KEYS.VOICE_PROVIDER, prov);
        setVoiceId(id);
        setProvider(prov);
    }, []);

    const resetVoice = useCallback(() => {
        localStorage.removeItem(STORAGE_KEYS.VOICE_ID);
        localStorage.removeItem(STORAGE_KEYS.VOICE_PROVIDER);
        setVoiceId(null);
        setProvider('elevenlabs');
    }, []);

    const setSpeed = useCallback((s: number) => {
        localStorage.setItem(STORAGE_KEYS.VOICE_SPEED, String(s));
        setSpeedState(s);
    }, []);

    const setUserName = useCallback((n: string) => {
        localStorage.setItem(STORAGE_KEYS.USER_NAME, n);
        setUserNameState(n);
    }, []);

    return (
        <VoiceContext.Provider value={{
            voiceId, provider, speed, userName, isLoading,
            hasVoice: !!voiceId,
            setVoice, resetVoice, setSpeed, setUserName,
        }}>
            {children}
        </VoiceContext.Provider>
    );
}
