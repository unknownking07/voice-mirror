'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useVoice } from '@/hooks/useVoice';

interface Reflection {
    id: string;
    transcript: string;
    reflection: string;
    audioUrl: string | null;
    timestamp: Date;
}

interface MirrorSessionProps {
    voiceId: string;
    provider: 'elevenlabs' | 'minimax';
    onVoiceExpired?: () => void;
}

const PROMPTS = [
    "What is weighing on you tonight?",
    "What haven't you said out loud?",
    "What do you keep circling back to?",
    "What would you tell yourself if no one was listening?",
    "What are you avoiding right now?",
    "What do you actually want?",
];

export default function MirrorSession({ voiceId, provider, onVoiceExpired }: MirrorSessionProps) {
    const [phase, setPhase] = useState<'idle' | 'recording' | 'thinking' | 'speaking' | 'done'>('idle');
    const [reflections, setReflections] = useState<Reflection[]>([]);
    const [currentReflection, setCurrentReflection] = useState<Reflection | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentPrompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
    const [sessionNumber] = useState(() => Math.floor(Math.random() * 20) + 1);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const { speed: voiceSpeed, setSpeed: setVoiceSpeed } = useVoice();
    const { isRecording, duration, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const waveformRef = useRef<HTMLDivElement | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const orbRef = useRef<HTMLDivElement | null>(null);

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const isNight = now.getHours() >= 20 || now.getHours() < 6;
    const sessionLabel = isNight ? 'Night' : now.getHours() < 12 ? 'Morning' : 'Afternoon';

    // Animate waveform bars during recording
    useEffect(() => {
        if (phase === 'recording' && waveformRef.current) {
            const bars = waveformRef.current.querySelectorAll('.wave-bar') as NodeListOf<HTMLElement>;
            const animate = () => {
                if (phase !== 'recording') return;
                const time = Date.now() * 0.005;
                bars.forEach((bar, i) => {
                    const offset = i * 0.5;
                    const height = 10 + Math.sin(time + offset) * 15 + Math.cos(time * 0.5 + offset) * 10;
                    const jitter = Math.random() * 12;
                    bar.style.height = `${Math.max(4, height + jitter)}px`;
                });
                animFrameRef.current = requestAnimationFrame(animate);
            };
            animate();
        }
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [phase]);

    // Simulate orb voice activity during recording
    useEffect(() => {
        if (phase === 'recording' && orbRef.current) {
            const interval = setInterval(() => {
                if (!orbRef.current) return;
                const scale = 1 + Math.random() * 0.5;
                const opacity = 0.4 + Math.random() * 0.4;
                orbRef.current.style.transform = `scale(${scale})`;
                orbRef.current.style.opacity = `${opacity}`;
            }, 150);
            return () => clearInterval(interval);
        }
    }, [phase]);

    // Stop audio on unmount (page change)
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    const handleRecord = async () => {
        setError(null);
        setCurrentReflection(null);
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
            formData.append('voiceId', voiceId);
            formData.append('speed', String(voiceSpeed));
            formData.append('provider', provider);

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
                    if (onVoiceExpired) onVoiceExpired();
                    return;
                }
                throw new Error(data.error || 'Reflection failed');
            }

            const reflection: Reflection = {
                id: Date.now().toString(),
                transcript: data.transcript,
                reflection: data.reflection,
                audioUrl: data.audio ? `data:audio/mpeg;base64,${data.audio}` : null,
                timestamp: new Date(),
            };

            setCurrentReflection(reflection);
            setReflections((prev) => [reflection, ...prev]);

            if (reflection.audioUrl && audioRef.current) {
                setPhase('speaking');
                setIsAudioPlaying(true);
                audioRef.current.src = reflection.audioUrl;
                audioRef.current.playbackRate = voiceSpeed;
                audioRef.current.onended = () => { setPhase('done'); setIsAudioPlaying(false); };
                audioRef.current.onerror = () => { setPhase('done'); setIsAudioPlaying(false); };
                await audioRef.current.play();
            } else {
                setPhase('done');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setPhase('idle');
        }
    }, [stopRecording, voiceId, voiceSpeed, provider, onVoiceExpired]);

    const handleReplay = () => {
        if (currentReflection?.audioUrl && audioRef.current) {
            setPhase('speaking');
            setIsAudioPlaying(true);
            audioRef.current.currentTime = 0;
            audioRef.current.playbackRate = voiceSpeed;
            audioRef.current.onended = () => { setPhase('done'); setIsAudioPlaying(false); };
            audioRef.current.play();
        }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsAudioPlaying(false);
    };

    const handlePauseToggle = () => {
        if (!audioRef.current) return;
        if (isAudioPlaying) {
            audioRef.current.pause();
            setIsAudioPlaying(false);
        } else {
            audioRef.current.play().catch(() => { });
            setIsAudioPlaying(true);
        }
    };

    const handleSpeedChange = (speed: number) => {
        setVoiceSpeed(speed);
        // Apply immediately if audio is playing
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    };

    const getOrbClass = () => {
        switch (phase) {
            case 'idle': return 'orb breathing';
            case 'recording': return 'orb';
            case 'thinking': return 'orb breathing';
            case 'speaking': return 'orb listening';
            case 'done': return 'orb breathing';
            default: return 'orb breathing';
        }
    };

    return (
        <div className="mirror-session">
            <audio ref={audioRef} />

            {/* Top Bar — Design 2 */}
            <header className="top-bar">
                <span className="meta-label">
                    {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                </span>
                <div className="session-pill">
                    <div className="session-indicator" />
                    <span className="session-time">{timeStr}</span>
                </div>
                <span className="meta-label">LOOP {String(sessionNumber).padStart(2, '0')}</span>
            </header>

            {/* Peripheral text — Design 2 */}
            <div className="peripheral-text">
                <span className="meta-label">INTERNAL_MONOLOGUE</span>
                <span className="meta-label">NO_FILTER</span>
            </div>

            {/* Main Stage */}
            <section className="stage">

                {/* IDLE — Design 3 prompt + Design 4 query card */}
                {phase === 'idle' && (
                    <>
                        <div className="prompt-card">
                            <div className="prompt-card-label">Reflection Query</div>
                            <div className="prompt-card-text">&ldquo;{currentPrompt}&rdquo;</div>
                        </div>

                        <div style={{ position: 'relative' }}>
                            {/* Waveform rings — Design 4 */}
                            <div className="waveform-rings">
                                <div className="waveform-ring" />
                                <div className="waveform-ring" />
                                <div className="waveform-ring" />
                            </div>

                            <div className="record-btn-wrapper" onClick={handleRecord}>
                                <div className="record-btn-ring" />
                                <div className="record-btn-core">
                                    <div className="record-btn-dot" />
                                </div>
                                <div className="distortion-lens" />
                            </div>
                        </div>

                        <div className="status-label visible">tap to record</div>
                    </>
                )}

                {/* RECORDING — Design 2 waveform + Design 1 orb */}
                {phase === 'recording' && (
                    <>
                        <h1 className="prompt-text" style={{ opacity: 0.3, marginBottom: '1rem' }}>
                            {currentPrompt}
                        </h1>

                        {/* Waveform bars — Design 2 */}
                        <div className="waveform-bars active" ref={waveformRef}>
                            {Array.from({ length: 14 }).map((_, i) => (
                                <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                            ))}
                        </div>

                        {/* Orb — Design 1 */}
                        <div className="visualizer-stage">
                            <div className={getOrbClass()} ref={orbRef} />
                            <div className="orb-secondary" />
                        </div>

                        <div className="record-btn-wrapper recording" onClick={handleStop}>
                            <div className="record-btn-ring" />
                            <div className="record-btn-core">
                                <div className="record-btn-dot" />
                            </div>
                        </div>

                        <div className="status-label visible" style={{ color: 'var(--text-primary)' }}>
                            listening...
                        </div>
                        <div className="recording-info">
                            <span className="pulse-dot" />
                            <span>{formatDuration(duration)}</span>
                        </div>
                    </>
                )}

                {/* THINKING — Design 1 breathing orb */}
                {phase === 'thinking' && (
                    <>
                        <div className="visualizer-stage">
                            <div className="orb breathing" />
                            <div className="orb-secondary" />
                        </div>

                        <div className="status-label visible">reflecting...</div>
                    </>
                )}

                {/* SPEAKING — Design 1 orb + reflection text */}
                {phase === 'speaking' && currentReflection && (
                    <>
                        <div className="visualizer-stage">
                            <div className="orb listening" />
                            <div className="orb-secondary" />
                        </div>

                        <div className="mirror-speaking">
                            <p className="reflection-text">&ldquo;{currentReflection.reflection}&rdquo;</p>
                        </div>

                        <div className="inline-speed-controls">
                            <button
                                className={`inline-speed-btn pause-btn ${isAudioPlaying ? 'playing' : ''}`}
                                onClick={handlePauseToggle}
                                aria-label={isAudioPlaying ? 'Pause' : 'Resume'}
                            >
                                {isAudioPlaying ? '⏸' : '▶'}
                            </button>
                            {[1, 1.5, 2].map((s) => (
                                <button
                                    key={s}
                                    className={`inline-speed-btn ${voiceSpeed === s ? 'active' : ''}`}
                                    onClick={() => handleSpeedChange(s)}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>

                        <div className="status-label visible">echoing back</div>
                    </>
                )}

                {/* DONE — Design 4 reflection card + controls */}
                {phase === 'done' && currentReflection && (
                    <>
                        <div className="reflection-card">
                            <div className="card-label">You said</div>
                            <p className="transcript-text">{currentReflection.transcript}</p>
                            <div className="card-divider" />
                            <div className="card-label">Your mirror reflected</div>
                            <p className="reflection-text">&ldquo;{currentReflection.reflection}&rdquo;</p>
                        </div>

                        <div className="done-actions">
                            {currentReflection.audioUrl && (
                                <button className="btn-ghost" onClick={handleReplay}>
                                    Replay
                                </button>
                            )}
                            {currentReflection.audioUrl && (
                                <div className="inline-speed-controls">
                                    <button
                                        className={`inline-speed-btn pause-btn ${isAudioPlaying ? 'playing' : ''}`}
                                        onClick={handlePauseToggle}
                                        aria-label={isAudioPlaying ? 'Pause' : 'Resume'}
                                    >
                                        {isAudioPlaying ? '⏸' : '▶'}
                                    </button>
                                    {[1, 1.5, 2].map((s) => (
                                        <button
                                            key={s}
                                            className={`inline-speed-btn ${voiceSpeed === s ? 'active' : ''}`}
                                            onClick={() => handleSpeedChange(s)}
                                        >
                                            {s}x
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button className="btn-ghost" onClick={() => { stopAudio(); setPhase('idle'); }}>
                                Speak Again
                            </button>
                        </div>
                    </>
                )}
            </section>

            {/* Error */}
            {(error || recorderError) && (
                <div className="error-toast">
                    <p>{error || recorderError}</p>
                    <button onClick={() => setError(null)}>✕</button>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div className="settings-panel">
                    <div className="settings-header">
                        <span className="meta-label">Voice Settings</span>
                        <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
                    </div>
                    <div className="settings-row">
                        <label className="settings-label">Voice Speed</label>
                        <div className="speed-control">
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={voiceSpeed}
                                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                className="speed-slider"
                            />
                            <span className="speed-value">{voiceSpeed.toFixed(1)}x</span>
                        </div>
                        <div className="speed-presets">
                            {[0.7, 1.0, 1.2, 1.5].map((s) => (
                                <button
                                    key={s}
                                    className={`speed-preset ${voiceSpeed === s ? 'active' : ''}`}
                                    onClick={() => handleSpeedChange(s)}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* History Panel */}
            {showHistory && reflections.length > 0 && (
                <div className="history-panel">
                    <div className="settings-header">
                        <span className="history-title">Past Reflections</span>
                        <button className="settings-close" onClick={() => setShowHistory(false)}>✕</button>
                    </div>
                    <div className="history-list">
                        {reflections.map((r) => (
                            <div key={r.id} className="history-item">
                                <p className="history-transcript">{r.transcript}</p>
                                <p className="history-reflection">&ldquo;{r.reflection}&rdquo;</p>
                                <span className="history-time">
                                    {r.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer Controls — Design 2 */}
            <footer className="footer-controls">
                <button
                    className={`control-btn ${showHistory ? 'active' : ''}`}
                    aria-label="History"
                    title="History"
                    onClick={() => { setShowHistory(!showHistory); setShowSettings(false); }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                        <line x1="9" y1="9" x2="15" y2="9" />
                        <line x1="9" y1="13" x2="15" y2="13" />
                        <line x1="9" y1="17" x2="11" y2="17" />
                    </svg>
                </button>
                <button
                    className={`control-btn ${showSettings ? 'active' : ''}`}
                    aria-label="Settings"
                    title="Settings"
                    onClick={() => { setShowSettings(!showSettings); setShowHistory(false); }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>
            </footer>

            {/* Context indicator — Design 1 */}
            <div className="context-indicator">
                Session {String(sessionNumber).padStart(3, '0')} — {sessionLabel}
            </div>
        </div>
    );
}
