'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BREATHING_PATTERNS, DURATIONS, BreathingPattern, BreathingPhase } from '@/lib/breathing-patterns';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/lib/storage';
import { useVoice } from '@/hooks/useVoice';
import { useAmbientSound } from '@/hooks/useAmbientSound';
import { useBreathingCues } from '@/hooks/useBreathingCues';

interface PresetVoice {
    voice_id: string;
    name: string;
    gender: string;
    accent: string;
    preview_url: string | null;
}

interface GuideVoice {
    voiceId: string;
    provider: 'elevenlabs' | 'minimax';
    label: string;
}

export default function BreathingGuide() {
    const [view, setView] = useState<'select' | 'preparing' | 'session' | 'done'>('select');
    const [selectedPattern, setSelectedPattern] = useState<BreathingPattern | null>(null);
    const [selectedDuration, setSelectedDuration] = useState(180);
    const [currentPhase, setCurrentPhase] = useState<BreathingPhase | null>(null);
    const [phaseTimeLeft, setPhaseTimeLeft] = useState(0);
    const [totalTimeLeft, setTotalTimeLeft] = useState(0);
    const [cycleCount, setCycleCount] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [prefs, setPrefs] = useLocalStorage<{ lastPattern?: string; lastDuration?: number }>(STORAGE_KEYS.BREATHING_PREFS, {});
    const [soundEnabled, setSoundEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.BREATHING_SOUND, true);
    const [savedGuideVoice, setSavedGuideVoice] = useLocalStorage<GuideVoice | null>(STORAGE_KEYS.BREATHING_VOICE, null);

    // Voice picker state
    const [voiceSource, setVoiceSource] = useState<'own' | 'preset'>('preset');
    const [presetVoices, setPresetVoices] = useState<PresetVoice[]>([]);
    const [loadingVoices, setLoadingVoices] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<PresetVoice | null>(null);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);
    const [showVoicePicker, setShowVoicePicker] = useState(false);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    const { voiceId: clonedVoiceId, provider: clonedProvider, speed, hasVoice } = useVoice();

    // Determine the active guide voice
    const guideVoiceId = voiceSource === 'own' && hasVoice ? clonedVoiceId : (selectedPreset?.voice_id || savedGuideVoice?.voiceId || null);
    const guideProvider: 'elevenlabs' | 'minimax' = voiceSource === 'own' && hasVoice ? clonedProvider : 'elevenlabs';

    const { startAmbient, stopAmbient } = useAmbientSound();
    const { prefetchAll, playIntro, playCue, stopCue, playBell, isLoading: cuesLoading } = useBreathingCues({
        voiceId: guideVoiceId,
        provider: guideProvider,
        speed,
        enabled: soundEnabled && !!guideVoiceId,
    });

    const phaseIndexRef = useRef(0);
    const phaseTimeRef = useRef(0);
    const totalTimeRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevPhaseRef = useRef<BreathingPhase | null>(null);

    // Restore last used settings
    useEffect(() => {
        if (prefs.lastPattern) {
            const p = BREATHING_PATTERNS.find((bp) => bp.id === prefs.lastPattern);
            if (p) setSelectedPattern(p);
        }
        if (prefs.lastDuration) setSelectedDuration(prefs.lastDuration);
    }, [prefs.lastPattern, prefs.lastDuration]);

    // Restore saved voice selection
    useEffect(() => {
        if (savedGuideVoice) {
            setVoiceSource('preset');
        } else if (hasVoice) {
            setVoiceSource('own');
        }
    }, [savedGuideVoice, hasVoice]);

    const fetchVoices = async () => {
        if (presetVoices.length > 0) return; // already loaded
        setLoadingVoices(true);
        try {
            const res = await fetch('/api/voices');
            const data = await res.json();
            if (data.voices) {
                setPresetVoices(data.voices);
            }
        } catch {
            // silently fail
        } finally {
            setLoadingVoices(false);
        }
    };

    const handlePreviewVoice = (voice: PresetVoice) => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        if (playingPreview === voice.voice_id) {
            setPlayingPreview(null);
            return;
        }
        if (voice.preview_url) {
            const audio = new Audio(voice.preview_url);
            previewAudioRef.current = audio;
            setPlayingPreview(voice.voice_id);
            audio.onended = () => setPlayingPreview(null);
            audio.play().catch(() => setPlayingPreview(null));
        }
    };

    const handleSelectPreset = (voice: PresetVoice) => {
        setSelectedPreset(voice);
        setSavedGuideVoice({ voiceId: voice.voice_id, provider: 'elevenlabs', label: voice.name });
        setShowVoicePicker(false);
    };

    const handleBegin = useCallback(async () => {
        if (!selectedPattern) return;
        setPrefs({ lastPattern: selectedPattern.id, lastDuration: selectedDuration });

        if (soundEnabled && guideVoiceId) {
            // Show preparing view while fetching audio
            setView('preparing');
            const phaseNames = selectedPattern.phases.map((p) => p.name);
            await prefetchAll(selectedPattern.id, phaseNames);
            // Play intro, then start session
            await playIntro();
        }

        // Transition to session
        setView('session');
        setTotalTimeLeft(selectedDuration);
        totalTimeRef.current = selectedDuration;
        setCycleCount(0);
        phaseIndexRef.current = 0;

        const firstPhase = selectedPattern.phases[0];
        setCurrentPhase(firstPhase);
        prevPhaseRef.current = null; // Allow first-phase voice cue to play
        phaseTimeRef.current = firstPhase.duration;
        setPhaseTimeLeft(firstPhase.duration);
        setIsActive(true);

        if (soundEnabled) {
            startAmbient();
        }
    }, [selectedPattern, selectedDuration, setPrefs, soundEnabled, guideVoiceId, prefetchAll, playIntro, startAmbient]);

    const stopSession = useCallback(() => {
        setIsActive(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        stopAmbient(true); // Stop immediately — no fade
        stopCue();
        playBell(); // Chime to signal completion
        setView('done');
    }, [stopAmbient, stopCue, playBell]);

    // Play voice cue on phase transitions
    useEffect(() => {
        if (isActive && soundEnabled && guideVoiceId && currentPhase && currentPhase !== prevPhaseRef.current) {
            playCue(currentPhase.name);
        }
        prevPhaseRef.current = currentPhase;
    }, [currentPhase, isActive, soundEnabled, guideVoiceId, playCue]);

    // Main timer loop — phase transitions use refs to avoid React 18
    // Strict Mode double-invocation of state updater functions.
    useEffect(() => {
        if (!isActive || !selectedPattern) return;

        intervalRef.current = setInterval(() => {
            // Decrement total time
            totalTimeRef.current -= 1;
            if (totalTimeRef.current <= 0) {
                stopSession();
                setTotalTimeLeft(0);
                return;
            }
            setTotalTimeLeft(totalTimeRef.current);

            // Decrement phase time
            phaseTimeRef.current -= 1;

            if (phaseTimeRef.current <= 0) {
                // Advance to next phase
                const nextIndex = (phaseIndexRef.current + 1) % selectedPattern.phases.length;
                phaseIndexRef.current = nextIndex;
                const nextPhase = selectedPattern.phases[nextIndex];
                setCurrentPhase(nextPhase);
                phaseTimeRef.current = nextPhase.duration;

                if (nextIndex === 0) {
                    setCycleCount((c) => c + 1);
                }
            }

            setPhaseTimeLeft(phaseTimeRef.current);
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive, selectedPattern, stopSession]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getOrbScale = () => {
        if (!currentPhase || !isActive) return 1;
        const progress = 1 - (phaseTimeLeft / currentPhase.duration);
        switch (currentPhase.name) {
            case 'inhale': return 1 + progress * 0.8;
            case 'exhale': return 1.8 - progress * 0.8;
            case 'hold': return 1.8;
            case 'rest': return 1;
            default: return 1;
        }
    };

    const getOrbOpacity = () => {
        if (!currentPhase || !isActive) return 0.4;
        switch (currentPhase.name) {
            case 'inhale': return 0.4 + (1 - phaseTimeLeft / currentPhase.duration) * 0.4;
            case 'exhale': return 0.8 - (1 - phaseTimeLeft / currentPhase.duration) * 0.4;
            case 'hold': return 0.8;
            case 'rest': return 0.4;
            default: return 0.5;
        }
    };

    const guideLabel = voiceSource === 'own'
        ? 'Your Voice'
        : (selectedPreset?.name || savedGuideVoice?.label || 'Choose a voice');

    return (
        <div className="breathing-guide">
            {view === 'select' && (
                <div className="bg-select">
                    <div className="bg-header">
                        <h1 className="bg-title">Breathe</h1>
                        <p className="bg-subtitle">Choose a pattern and duration</p>
                    </div>

                    <div className="bg-patterns">
                        {BREATHING_PATTERNS.map((pattern) => (
                            <button
                                key={pattern.id}
                                className={`bg-pattern-card ${selectedPattern?.id === pattern.id ? 'active' : ''}`}
                                onClick={() => setSelectedPattern(pattern)}
                            >
                                <span className="bg-pattern-icon">{pattern.icon}</span>
                                <div className="bg-pattern-info">
                                    <span className="bg-pattern-title">{pattern.title}</span>
                                    <span className="bg-pattern-desc">{pattern.description}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* How-to explanation for the selected pattern */}
                    {selectedPattern && (
                        <div className="bg-steps-callout">
                            <span className="bg-steps-label">How it works</span>
                            <p className="bg-steps-text">{selectedPattern.steps}</p>
                        </div>
                    )}

                    <div className="bg-durations">
                        <div className="settings-label" style={{ marginBottom: '10px' }}>Duration</div>
                        <div className="bg-duration-options">
                            {DURATIONS.map((d) => (
                                <button
                                    key={d.seconds}
                                    className={`bg-duration-btn ${selectedDuration === d.seconds ? 'active' : ''}`}
                                    onClick={() => setSelectedDuration(d.seconds)}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Guide Voice Selection */}
                    <div className="bg-voice-section">
                        <div className="settings-label" style={{ marginBottom: '10px' }}>Guide Voice</div>
                        <div className="bg-voice-options">
                            {hasVoice && (
                                <button
                                    className={`bg-voice-opt ${voiceSource === 'own' ? 'active' : ''}`}
                                    onClick={() => setVoiceSource('own')}
                                >
                                    Your Voice
                                </button>
                            )}
                            <button
                                className={`bg-voice-opt ${voiceSource === 'preset' ? 'active' : ''}`}
                                onClick={() => {
                                    setVoiceSource('preset');
                                    if (!selectedPreset && !savedGuideVoice) {
                                        fetchVoices();
                                        setShowVoicePicker(true);
                                    }
                                }}
                            >
                                {voiceSource === 'preset' && guideLabel !== 'Choose a voice' ? guideLabel : 'Preset Voice'}
                            </button>
                        </div>
                        {voiceSource === 'preset' && (
                            <button
                                className="bg-change-voice"
                                onClick={() => { fetchVoices(); setShowVoicePicker(true); }}
                            >
                                {guideLabel === 'Choose a voice' ? 'Choose a voice' : 'Change voice'}
                            </button>
                        )}
                    </div>

                    {/* Voice Picker Modal */}
                    {showVoicePicker && (
                        <div className="bg-voice-picker-overlay" onClick={() => setShowVoicePicker(false)}>
                            <div className="bg-voice-picker" onClick={(e) => e.stopPropagation()}>
                                <div className="bg-voice-picker-header">
                                    <span>Choose a guide voice</span>
                                    <button onClick={() => setShowVoicePicker(false)}>&times;</button>
                                </div>
                                {loadingVoices ? (
                                    <div className="bg-voice-picker-loading">
                                        <div className="vs-breathing-circle" />
                                        <p>Loading voices...</p>
                                    </div>
                                ) : (
                                    <div className="bg-voice-picker-grid">
                                        {presetVoices.map((voice) => (
                                            <div
                                                key={voice.voice_id}
                                                className={`bg-voice-card ${selectedPreset?.voice_id === voice.voice_id ? 'active' : ''}`}
                                                onClick={() => handleSelectPreset(voice)}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <div className="bg-voice-card-info">
                                                    <span className="bg-voice-card-name">{voice.name}</span>
                                                    <span className="bg-voice-card-meta">
                                                        {voice.gender}{voice.accent ? ` · ${voice.accent}` : ''}
                                                    </span>
                                                </div>
                                                {voice.preview_url && (
                                                    <button
                                                        className="bg-voice-card-play"
                                                        onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice); }}
                                                    >
                                                        {playingPreview === voice.voice_id ? '⏸' : '▶'}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={handleBegin}
                        disabled={!selectedPattern || (voiceSource === 'preset' && !guideVoiceId && soundEnabled)}
                        style={{ marginTop: '24px', width: '100%' }}
                    >
                        Begin
                    </button>
                </div>
            )}

            {view === 'preparing' && (
                <div className="bg-preparing">
                    <div className="bg-preparing-orb" />
                    <p className="bg-preparing-label">Preparing your session...</p>
                </div>
            )}

            {view === 'session' && (
                <div className="bg-session">
                    {/* Sound toggle */}
                    <button
                        className="bg-sound-toggle"
                        onClick={() => {
                            const next = !soundEnabled;
                            setSoundEnabled(next);
                            if (next) {
                                startAmbient();
                            } else {
                                stopAmbient();
                                stopCue();
                            }
                        }}
                        aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
                    >
                        {soundEnabled ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
                                <line x1="4" y1="4" x2="20" y2="20" />
                                <path d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z" fill="currentColor" stroke="none" opacity="0.3" />
                            </svg>
                        )}
                    </button>

                    {/* Timer */}
                    <div className="bg-timer">{formatTime(totalTimeLeft)}</div>

                    {/* Breathing orb */}
                    <div className="bg-orb-container">
                        <div
                            className="bg-orb"
                            style={{
                                transform: `scale(${getOrbScale()})`,
                                opacity: getOrbOpacity(),
                                transition: `transform ${currentPhase?.duration || 4}s ease-in-out, opacity ${currentPhase?.duration || 4}s ease-in-out`,
                            }}
                        />
                        <div className="bg-orb-ring" style={{
                            transform: `scale(${getOrbScale() * 1.2})`,
                            opacity: getOrbOpacity() * 0.3,
                            transition: `transform ${currentPhase?.duration || 4}s ease-in-out, opacity ${currentPhase?.duration || 4}s ease-in-out`,
                        }} />
                    </div>

                    {/* Phase label */}
                    <div className="bg-phase-label">
                        {currentPhase?.label || '...'}
                    </div>

                    <div className="bg-phase-timer">{phaseTimeLeft}</div>

                    <div className="bg-cycle-count">Cycle {cycleCount + 1}</div>

                    <button className="bg-end-btn" onClick={stopSession}>
                        End Session
                    </button>
                </div>
            )}

            {view === 'done' && (
                <div className="bg-done">
                    <div className="bg-done-orb" />
                    <h2 className="bg-done-title">Well done</h2>
                    <p className="bg-done-subtitle">
                        {cycleCount} cycle{cycleCount !== 1 ? 's' : ''} completed
                    </p>
                    <div className="bg-done-actions">
                        <button className="btn btn-primary" onClick={() => { setView('session'); handleBegin(); }}>
                            Go Again
                        </button>
                        <button className="btn btn-secondary" onClick={() => setView('select')}>
                            Change Pattern
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
