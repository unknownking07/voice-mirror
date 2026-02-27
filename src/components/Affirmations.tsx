'use client';

import { useState, useRef, useEffect } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { AFFIRMATION_SETS, AffirmationSet } from '@/lib/affirmation-sets';
import SpeedControl from '@/components/SpeedControl';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/lib/storage';

export default function Affirmations() {
    const { voiceId, provider, speed } = useVoice();
    const [view, setView] = useState<'sets' | 'player' | 'custom'>('sets');
    const [selectedSet, setSelectedSet] = useState<AffirmationSet | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [autoPlay, setAutoPlay] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customAffirmations, setCustomAffirmations] = useLocalStorage<string[]>(STORAGE_KEYS.CUSTOM_AFFIRMATIONS, []);
    const [newAffirmation, setNewAffirmation] = useState('');
    const [progress, setProgress] = useLocalStorage<Record<string, number | string>>(STORAGE_KEYS.AFFIRMATION_PROGRESS, {});

    // Reset progress daily
    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        if (progress.date !== today) {
            setProgress({ date: today } as Record<string, number | string>);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const autoPlayRef = useRef(false);

    // Stop audio on unmount (page change)
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    const activeAffirmations = selectedSet?.affirmations || customAffirmations;
    const currentAffirmation = activeAffirmations[currentIndex] || '';

    const playAffirmation = async (text: string, index: number) => {
        if (!voiceId) return;
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voiceId, speed, provider }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.error === 'voice_expired') {
                    setError('Your voice clone has expired. Please re-clone your voice.');
                    return;
                }
                throw new Error(data.error || 'Speech synthesis failed');
            }

            if (data.audio && audioRef.current) {
                setIsPlaying(true);
                audioRef.current.src = `data:audio/mpeg;base64,${data.audio}`;
                audioRef.current.playbackRate = speed;
                audioRef.current.onended = () => {
                    setIsPlaying(false);
                    // Track progress
                    const setId = selectedSet?.id || 'custom';
                    setProgress((prev) => ({ ...prev, [setId]: Math.max((prev[setId] as number) || 0, index + 1) }));

                    // Auto-play next
                    if (autoPlayRef.current && index < activeAffirmations.length - 1) {
                        setTimeout(() => {
                            setCurrentIndex(index + 1);
                            playAffirmation(activeAffirmations[index + 1], index + 1);
                        }, 1500);
                    }
                };
                audioRef.current.onerror = () => setIsPlaying(false);
                await audioRef.current.play();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Playback failed');
            setIsPlaying(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectSet = (set: AffirmationSet) => {
        setSelectedSet(set);
        setCurrentIndex(0);
        setView('player');
    };

    const handleCustomSet = () => {
        setSelectedSet(null);
        setCurrentIndex(0);
        setView(customAffirmations.length > 0 ? 'player' : 'custom');
    };

    const handleNext = () => {
        if (currentIndex < activeAffirmations.length - 1) {
            setCurrentIndex((i) => i + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex((i) => i - 1);
        }
    };

    const handlePlayAll = () => {
        autoPlayRef.current = true;
        setAutoPlay(true);
        setCurrentIndex(0);
        playAffirmation(activeAffirmations[0], 0);
    };

    const handleStopAutoPlay = () => {
        autoPlayRef.current = false;
        setAutoPlay(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
    };

    const handleAddCustom = () => {
        if (!newAffirmation.trim()) return;
        setCustomAffirmations((prev) => [...prev, newAffirmation.trim()]);
        setNewAffirmation('');
    };

    const handleDeleteCustom = (index: number) => {
        setCustomAffirmations((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="affirmations">
            <audio ref={audioRef} />

            {view === 'sets' && (
                <div className="aff-sets">
                    <div className="aff-header">
                        <h1 className="aff-title">Daily Affirmations</h1>
                        <p className="aff-subtitle">Hear positive words in your own voice</p>
                    </div>

                    <div className="aff-set-grid">
                        {AFFIRMATION_SETS.map((set) => (
                            <button key={set.id} className="aff-set-card" onClick={() => handleSelectSet(set)}>
                                <span className="aff-set-icon">{set.icon}</span>
                                <div className="aff-set-info">
                                    <span className="aff-set-title">{set.title}</span>
                                    <span className="aff-set-desc">{set.description}</span>
                                </div>
                                {progress[set.id] && (
                                    <span className="aff-set-progress">{progress[set.id]}/{set.affirmations.length}</span>
                                )}
                            </button>
                        ))}

                        <button className="aff-set-card custom" onClick={handleCustomSet}>
                            <span className="aff-set-icon">✎</span>
                            <div className="aff-set-info">
                                <span className="aff-set-title">My Affirmations</span>
                                <span className="aff-set-desc">{customAffirmations.length} custom affirmations</span>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {view === 'player' && (
                <div className="aff-player">
                    <button className="btn btn-link" onClick={() => { setView('sets'); handleStopAutoPlay(); }} style={{ alignSelf: 'flex-start' }}>
                        ← Back
                    </button>

                    <div className="aff-player-header">
                        <span className="aff-player-set">{selectedSet?.icon || '✎'} {selectedSet?.title || 'My Affirmations'}</span>
                        <span className="aff-player-count">{currentIndex + 1} / {activeAffirmations.length}</span>
                    </div>

                    <div className="aff-card">
                        <p className="aff-text">{currentAffirmation}</p>
                    </div>

                    <div className="aff-controls">
                        <button className="aff-nav-btn" onClick={handlePrev} disabled={currentIndex === 0 || isPlaying}>
                            ‹
                        </button>

                        <button
                            className="aff-play-btn"
                            onClick={() => {
                                if (isPlaying) {
                                    handleStopAutoPlay();
                                } else {
                                    autoPlayRef.current = false;
                                    setAutoPlay(false);
                                    playAffirmation(currentAffirmation, currentIndex);
                                }
                            }}
                            disabled={isLoading}
                        >
                            {isLoading ? '...' : isPlaying ? '⏸' : '▶'}
                        </button>

                        <button className="aff-nav-btn" onClick={handleNext} disabled={currentIndex >= activeAffirmations.length - 1 || isPlaying}>
                            ›
                        </button>
                    </div>

                    <div className="aff-auto-play">
                        {!autoPlay ? (
                            <button className="btn-ghost" onClick={handlePlayAll} disabled={isPlaying || isLoading}>
                                Play All
                            </button>
                        ) : (
                            <button className="btn-ghost" onClick={handleStopAutoPlay}>
                                Stop
                            </button>
                        )}
                    </div>

                    <SpeedControl audioRef={audioRef} isPlaying={isPlaying} onPause={() => { if (audioRef.current) audioRef.current.pause(); setIsPlaying(false); }} onResume={() => { if (audioRef.current) { audioRef.current.play().catch(() => { }); setIsPlaying(true); } }} />

                    {/* Progress dots */}
                    <div className="aff-progress-dots">
                        {activeAffirmations.map((_, i) => (
                            <span
                                key={i}
                                className={`aff-dot ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'done' : ''}`}
                            />
                        ))}
                    </div>

                    {!selectedSet && (
                        <button className="btn btn-link" onClick={() => setView('custom')}>
                            Edit My Affirmations
                        </button>
                    )}
                </div>
            )}

            {view === 'custom' && (
                <div className="aff-custom">
                    <button className="btn btn-link" onClick={() => setView('sets')} style={{ alignSelf: 'flex-start' }}>
                        ← Back
                    </button>

                    <h2 className="aff-custom-title">My Affirmations</h2>
                    <p className="aff-custom-subtitle">Write affirmations you want to hear in your own voice</p>

                    <div className="aff-custom-input">
                        <input
                            type="text"
                            className="voice-name-input"
                            placeholder="Type an affirmation..."
                            value={newAffirmation}
                            onChange={(e) => setNewAffirmation(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                        />
                        <button className="btn btn-primary" onClick={handleAddCustom} disabled={!newAffirmation.trim()}>
                            Add
                        </button>
                    </div>

                    {customAffirmations.length > 0 && (
                        <>
                            <div className="aff-custom-list">
                                {customAffirmations.map((a, i) => (
                                    <div key={i} className="aff-custom-item">
                                        <span>{a}</span>
                                        <button className="aff-custom-delete" onClick={() => handleDeleteCustom(i)}>✕</button>
                                    </div>
                                ))}
                            </div>
                            <button className="btn btn-primary" onClick={() => { setCurrentIndex(0); setView('player'); }} style={{ marginTop: '16px' }}>
                                Play My Affirmations
                            </button>
                        </>
                    )}
                </div>
            )}

            {error && (
                <div className="error-toast">
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>✕</button>
                </div>
            )}
        </div>
    );
}
