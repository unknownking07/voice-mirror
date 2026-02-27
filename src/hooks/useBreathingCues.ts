'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

const PHASE_CUE_TEXT: Record<string, string> = {
    inhale: 'Breathe in',
    hold: 'Hold',
    exhale: 'Breathe out',
    rest: 'Hold',
};

export const INTRO_TEXTS: Record<string, string> = {
    '4-7-8': 'Close your eyes and settle in. We\'ll breathe in for four, hold for seven, and release for eight. Let your body relax with each breath.',
    'box': 'Find a comfortable position. We\'ll breathe in a steady rhythm — in, hold, out, hold — each for four counts. Let the balance calm your mind.',
    'simple': 'Take a moment to settle. We\'ll breathe gently — in for four, out for six. Just follow the rhythm.',
};

/** Convert base64 to a Blob URL for reliable Audio playback */
function base64ToBlobUrl(base64: string, mime = 'audio/mpeg'): string {
    const bytes = atob(base64);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    const blob = new Blob([buf], { type: mime });
    return URL.createObjectURL(blob);
}

interface UseBreathingCuesOptions {
    voiceId: string | null;
    provider: 'elevenlabs' | 'minimax';
    speed: number;
    enabled: boolean;
}

export function useBreathingCues({ voiceId, provider, speed, enabled }: UseBreathingCuesOptions) {
    // Pre-created Audio elements keyed by phase name
    const cueAudios = useRef<Map<string, HTMLAudioElement>>(new Map());
    const introAudio = useRef<HTMLAudioElement | null>(null);
    const blobUrls = useRef<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchAudio = useCallback(async (text: string): Promise<string | null> => {
        if (!voiceId) return null;
        try {
            const res = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voiceId, speed: Math.min(speed, 1.0), provider }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.audio as string;
        } catch {
            return null;
        }
    }, [voiceId, provider, speed]);

    /** Clean up all blob URLs */
    const cleanupBlobs = useCallback(() => {
        for (const url of blobUrls.current) {
            URL.revokeObjectURL(url);
        }
        blobUrls.current = [];
    }, []);

    /** Pre-fetch intro + phase cues, creating Audio elements upfront.
     *  Only fetches cues for phases the pattern actually uses, and
     *  shares Audio elements when different phases have identical text
     *  (e.g. 'hold' and 'rest' both say "Hold"). */
    const prefetchAll = useCallback(async (patternId: string, phaseNames?: string[]) => {
        if (!voiceId || !enabled) return;
        setIsLoading(true);

        // Clean up previous blobs
        cleanupBlobs();
        cueAudios.current.clear();
        introAudio.current = null;

        try {
            const introText = INTRO_TEXTS[patternId] || INTRO_TEXTS['simple'];

            // Determine which phases we actually need cues for
            const neededPhases = phaseNames
                ? phaseNames.filter((p) => PHASE_CUE_TEXT[p])
                : Object.keys(PHASE_CUE_TEXT);

            // De-duplicate by text — e.g. 'hold' and 'rest' both map to "Hold"
            const textToPhases = new Map<string, string[]>();
            for (const phase of neededPhases) {
                const text = PHASE_CUE_TEXT[phase];
                const existing = textToPhases.get(text) || [];
                existing.push(phase);
                textToPhases.set(text, existing);
            }
            const uniqueCues = Array.from(textToPhases.entries()); // [[text, [phase1, phase2]], ...]

            // Fetch intro first (sequential) to stay under ElevenLabs 3-concurrent limit
            const introBase64 = await fetchAudio(introText);
            if (introBase64) {
                const url = base64ToBlobUrl(introBase64);
                blobUrls.current.push(url);
                const audio = new Audio(url);
                audio.preload = 'auto';
                introAudio.current = audio;
            }

            // Then fetch unique cue texts in parallel (max 3 — within limit)
            const cueResults = await Promise.all(
                uniqueCues.map(async ([text, phases]) => {
                    const base64 = await fetchAudio(text);
                    return { phases, base64 };
                }),
            );

            for (const { phases, base64 } of cueResults) {
                if (base64) {
                    const url = base64ToBlobUrl(base64);
                    blobUrls.current.push(url);
                    // Create one Audio per phase name, all sharing the same blob URL
                    for (const phase of phases) {
                        const audio = new Audio(url);
                        audio.preload = 'auto';
                        cueAudios.current.set(phase, audio);
                    }
                }
            }
        } finally {
            setIsLoading(false);
        }
    }, [voiceId, enabled, fetchAudio, cleanupBlobs]);

    /** Play the intro instruction. Returns a promise that resolves when playback ends. */
    const playIntro = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            const audio = introAudio.current;
            if (!audio || !enabled) {
                resolve();
                return;
            }

            audio.currentTime = 0;
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
        });
    }, [enabled]);

    /** Play a phase cue by reusing the pre-created Audio element */
    const playCue = useCallback((phaseName: string) => {
        if (!enabled) return;

        const audio = cueAudios.current.get(phaseName);
        if (!audio) return;

        // Reset and replay the same Audio element
        audio.currentTime = 0;
        audio.play().catch(() => { });
    }, [enabled]);

    const stopCue = useCallback(() => {
        // Pause all cue audios
        for (const audio of Array.from(cueAudios.current.values())) {
            audio.pause();
            audio.currentTime = 0;
        }
        if (introAudio.current) {
            introAudio.current.pause();
            introAudio.current.currentTime = 0;
        }
    }, []);

    /** Play a meditation bell / singing bowl chime via Web Audio API */
    const playBell = useCallback(() => {
        try {
            const ctx = new AudioContext();
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.5, now);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + 4);
            masterGain.connect(ctx.destination);

            // Layer multiple harmonics for a rich singing-bowl tone
            const harmonics = [
                { freq: 528, gain: 0.6, decay: 3.5 },
                { freq: 1056, gain: 0.3, decay: 2.5 },
                { freq: 1584, gain: 0.15, decay: 2.0 },
                { freq: 2112, gain: 0.08, decay: 1.5 },
            ];

            for (const h of harmonics) {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(h.freq, now);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(h.gain, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + h.decay);

                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now);
                osc.stop(now + h.decay + 0.1);
            }

            // Close context after bell finishes
            setTimeout(() => { ctx.close().catch(() => { }); }, 5000);
        } catch {
            // Silently fail if Web Audio not available
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            for (const audio of Array.from(cueAudios.current.values())) {
                audio.pause();
            }
            cueAudios.current.clear();
            if (introAudio.current) {
                introAudio.current.pause();
                introAudio.current = null;
            }
            // Revoke all blob URLs
            for (const url of blobUrls.current) {
                URL.revokeObjectURL(url);
            }
            blobUrls.current = [];
        };
    }, []);

    return { prefetchAll, playIntro, playCue, stopCue, playBell, isLoading };
}
