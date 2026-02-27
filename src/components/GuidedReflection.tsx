'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import SpeedControl from '@/components/SpeedControl';
import { REFLECTION_THEMES, ReflectionTheme } from '@/lib/reflection-themes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/lib/storage';

interface ReflectionSession {
    id: string;
    themeId: string;
    prompt: string;
    transcript: string;
    reflection: string;
    timestamp: string;
}

export default function GuidedReflection() {
    const { voiceId, provider, speed } = useVoice();
    const [step, setStep] = useState<'themes' | 'session' | 'result'>('themes');
    const [selectedTheme, setSelectedTheme] = useState<ReflectionTheme | null>(null);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [phase, setPhase] = useState<'idle' | 'recording' | 'thinking' | 'speaking' | 'done'>('idle');
    const [transcript, setTranscript] = useState('');
    const [reflection, setReflection] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useLocalStorage<ReflectionSession[]>(STORAGE_KEYS.REFLECTION_HISTORY, []);
    const [showHistory, setShowHistory] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const { isRecording, duration, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
    }, []);

    // Stop audio on unmount (page change)
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const selectTheme = (theme: ReflectionTheme) => {
        stopAudio();
        setSelectedTheme(theme);
        const prompt = theme.prompts[Math.floor(Math.random() * theme.prompts.length)];
        setCurrentPrompt(prompt);
        setStep('session');
        setPhase('idle');
        setError(null);
        setTranscript('');
        setReflection('');
    };

    const handleRecord = async () => {
        setError(null);
        setPhase('recording');
        await startRecording();
    };

    const handleStop = useCallback(async () => {
        const blob = await stopRecording();
        if (!blob) { setPhase('idle'); return; }

        if (blob.size < 5000) {
            setError('That was too short. Try speaking for at least a few seconds.');
            setPhase('idle');
            return;
        }

        setPhase('thinking');

        try {
            const formData = new FormData();
            formData.append('audio', blob, 'recording.webm');
            formData.append('voiceId', voiceId!);
            formData.append('speed', String(speed));
            formData.append('provider', provider);
            formData.append('systemPrompt', selectedTheme!.systemPrompt);

            const response = await fetch('/api/reflect', { method: 'POST', body: formData });
            const data = await response.json();

            if (!response.ok) {
                if (data.error === 'no_speech') {
                    setError(data.message);
                    setPhase('idle');
                    return;
                }
                if (data.error === 'voice_expired') {
                    setError('Your voice clone has expired. Please re-clone your voice.');
                    setPhase('idle');
                    return;
                }
                throw new Error(data.error || 'Reflection failed');
            }

            setTranscript(data.transcript);
            setReflection(data.reflection);

            // Save to history
            const session: ReflectionSession = {
                id: Date.now().toString(),
                themeId: selectedTheme!.id,
                prompt: currentPrompt,
                transcript: data.transcript,
                reflection: data.reflection,
                timestamp: new Date().toISOString(),
            };
            setHistory((prev) => [session, ...prev.slice(0, 49)]);

            if (data.audio && audioRef.current) {
                setPhase('speaking');
                setIsPlaying(true);
                audioRef.current.src = `data:audio/mpeg;base64,${data.audio}`;
                audioRef.current.playbackRate = speed;
                audioRef.current.onended = () => { setPhase('done'); setIsPlaying(false); };
                audioRef.current.onerror = () => { setPhase('done'); setIsPlaying(false); };
                await audioRef.current.play();
            } else {
                setPhase('done');
            }
            setStep('result');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setPhase('idle');
        }
    }, [stopRecording, voiceId, speed, provider, selectedTheme, currentPrompt, setHistory]);

    const handleNewPrompt = () => {
        if (!selectedTheme) return;
        stopAudio();
        const prompt = selectedTheme.prompts[Math.floor(Math.random() * selectedTheme.prompts.length)];
        setCurrentPrompt(prompt);
        setPhase('idle');
        setError(null);
        setTranscript('');
        setReflection('');
        setStep('session');
    };

    return (
        <div className="guided-reflection">
            <audio ref={audioRef} />

            {step === 'themes' && (
                <div className="gr-themes">
                    <div className="gr-header">
                        <h1 className="gr-title">Guided Reflections</h1>
                        <p className="gr-subtitle">Choose a theme to explore</p>
                    </div>

                    <div className="theme-grid">
                        {REFLECTION_THEMES.map((theme) => (
                            <button key={theme.id} className="theme-card" onClick={() => selectTheme(theme)}>
                                <span className="theme-icon">{theme.icon}</span>
                                <span className="theme-title">{theme.title}</span>
                                <span className="theme-desc">{theme.description}</span>
                            </button>
                        ))}
                    </div>

                    {history.length > 0 && (
                        <button className="btn btn-link" onClick={() => setShowHistory(!showHistory)}>
                            {showHistory ? 'Hide' : 'View'} Past Reflections ({history.length})
                        </button>
                    )}

                    {showHistory && (
                        <div className="gr-history">
                            {history.slice(0, 10).map((s) => {
                                const theme = REFLECTION_THEMES.find((t) => t.id === s.themeId);
                                return (
                                    <div key={s.id} className="gr-history-item">
                                        <div className="gr-history-meta">
                                            <span>{theme?.icon} {theme?.title}</span>
                                            <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <p className="gr-history-transcript">{s.transcript}</p>
                                        <p className="gr-history-reflection">&ldquo;{s.reflection}&rdquo;</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {step === 'session' && (
                <div className="gr-session">
                    <button className="btn btn-link" onClick={() => { stopAudio(); setStep('themes'); setPhase('idle'); }} style={{ alignSelf: 'flex-start' }}>
                        ← Themes
                    </button>

                    <div className="gr-theme-badge">
                        <span>{selectedTheme?.icon}</span>
                        <span>{selectedTheme?.title}</span>
                    </div>

                    <div className="prompt-card">
                        <div className="prompt-card-label">Reflection Prompt</div>
                        <div className="prompt-card-text">&ldquo;{currentPrompt}&rdquo;</div>
                    </div>

                    {phase === 'idle' && (
                        <>
                            <div className="record-btn-wrapper" onClick={handleRecord}>
                                <div className="record-btn-ring" />
                                <div className="record-btn-core">
                                    <div className="record-btn-dot" />
                                </div>
                            </div>
                            <div className="status-label visible">tap to respond</div>
                        </>
                    )}

                    {phase === 'recording' && (
                        <>
                            <div className="recording-info" style={{ marginBottom: '16px' }}>
                                <span className="pulse-dot" />
                                <span>{formatDuration(duration)}</span>
                            </div>
                            <div className="record-btn-wrapper recording" onClick={handleStop}>
                                <div className="record-btn-ring" />
                                <div className="record-btn-core">
                                    <div className="record-btn-dot" />
                                </div>
                            </div>
                            <div className="status-label visible">listening...</div>
                        </>
                    )}

                    {phase === 'thinking' && (
                        <>
                            <div className="breathing-circle" />
                            <div className="status-label visible">reflecting...</div>
                        </>
                    )}

                    {phase === 'speaking' && (
                        <>
                            <div className="visualizer-stage">
                                <div className="orb listening" />
                                <div className="orb-secondary" />
                            </div>
                            <div className="mirror-speaking">
                                <p className="reflection-text">&ldquo;{reflection}&rdquo;</p>
                            </div>
                            <div className="status-label visible">echoing back</div>
                            <SpeedControl audioRef={audioRef} isPlaying={isPlaying} onPause={() => setIsPlaying(false)} onResume={() => setIsPlaying(true)} />
                        </>
                    )}
                </div>
            )}

            {step === 'result' && (
                <div className="gr-result">
                    <div className="gr-theme-badge">
                        <span>{selectedTheme?.icon}</span>
                        <span>{selectedTheme?.title}</span>
                    </div>

                    <div className="reflection-card">
                        <div className="card-label">You said</div>
                        <p className="transcript-text">{transcript}</p>
                        <div className="card-divider" />
                        <div className="card-label">Your reflection</div>
                        <p className="reflection-text">&ldquo;{reflection}&rdquo;</p>
                    </div>

                    <div className="done-actions">
                        <button className="btn-ghost" onClick={handleNewPrompt}>
                            New Prompt
                        </button>
                        <button className="btn-ghost" onClick={() => { stopAudio(); setStep('themes'); }}>
                            Change Theme
                        </button>
                    </div>
                    <SpeedControl audioRef={audioRef} isPlaying={isPlaying} onPause={() => setIsPlaying(false)} onResume={() => setIsPlaying(true)} />
                </div>
            )}

            {(error || recorderError) && (
                <div className="error-toast">
                    <p>{error || recorderError}</p>
                    <button onClick={() => setError(null)}>✕</button>
                </div>
            )}
        </div>
    );
}
