'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

/** Generate a loopable brown noise AudioBuffer */
function createBrownNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let lastVal = 0;
    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastVal = (lastVal + 0.02 * white) / 1.02;
        data[i] = lastVal * 3.5; // amplify to fill range
    }

    // Crossfade the ends for seamless looping (0.5s fade)
    const fadeLen = Math.floor(sampleRate * 0.5);
    for (let i = 0; i < fadeLen; i++) {
        const t = i / fadeLen;
        data[i] = data[i] * t + data[length - fadeLen + i] * (1 - t);
    }

    return buffer;
}

export function useAmbientSound() {
    const ctxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const startAmbient = useCallback(() => {
        if (isPlaying) return;

        const ctx = ctxRef.current ?? new AudioContext();
        ctxRef.current = ctx;

        // Safari requires explicit resume after user gesture
        if (ctx.state === 'suspended') ctx.resume();

        // Brown noise buffer (10s loop)
        const noiseBuffer = createBrownNoiseBuffer(ctx, 10);

        // Lowpass filter for warmth — only keep deep rumble
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ctx.currentTime);
        filter.Q.setValueAtTime(0.7, ctx.currentTime);

        // Master gain with fade-in
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 3);
        masterGainRef.current = masterGain;

        // Source → Filter → Gain → Speakers
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(ctx.destination);
        source.start();
        sourceRef.current = source;

        setIsPlaying(true);
    }, [isPlaying]);

    const stopAmbient = useCallback((immediate?: boolean) => {
        const ctx = ctxRef.current;
        const masterGain = masterGainRef.current;
        const source = sourceRef.current;
        if (!ctx || !masterGain) {
            setIsPlaying(false);
            return;
        }

        if (immediate) {
            // Stop immediately — kill everything
            try {
                masterGain.gain.cancelScheduledValues(ctx.currentTime);
                masterGain.gain.setValueAtTime(0, ctx.currentTime);
                source?.stop();
                source?.disconnect();
                masterGain.disconnect();
            } catch { /* already stopped */ }
            sourceRef.current = null;
            masterGainRef.current = null;
            // Close and reset context so nothing can leak
            ctx.close().catch(() => { });
            ctxRef.current = null;
        } else {
            // Fade out over 1.5 seconds then stop
            masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);

            setTimeout(() => {
                try { source?.stop(); } catch { /* already stopped */ }
                sourceRef.current = null;
                masterGainRef.current = null;
            }, 1600);
        }

        setIsPlaying(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            try { sourceRef.current?.stop(); } catch { /* already stopped */ }
            sourceRef.current = null;
            if (ctxRef.current) {
                ctxRef.current.close().catch(() => { });
                ctxRef.current = null;
            }
        };
    }, []);

    return { startAmbient, stopAmbient, isPlaying };
}
