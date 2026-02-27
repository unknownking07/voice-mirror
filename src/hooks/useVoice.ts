'use client';

import { useContext } from 'react';
import { VoiceContext } from '@/contexts/VoiceContext';

export function useVoice() {
    const ctx = useContext(VoiceContext);
    if (!ctx) throw new Error('useVoice must be used within VoiceProvider');
    return ctx;
}
