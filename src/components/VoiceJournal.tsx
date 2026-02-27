'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import SpeedControl from '@/components/SpeedControl';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/lib/storage';

interface JournalEntry {
    id: string;
    transcript: string;
    reflection?: string;
    timestamp: string;
}

export default function VoiceJournal() {
    const { voiceId, provider, speed } = useVoice();
    const [view, setView] = useState<'list' | 'record' | 'entry'>('list');
    const [entries, setEntries] = useLocalStorage<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
    const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing' | 'reflecting' | 'speaking'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [loadingReflection, setLoadingReflection] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const { isRecording, duration, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
    const audioRef = useRef<HTMLAudioElement | null>(null);

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

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleNewEntry = () => {
        setView('record');
        setPhase('idle');
        setCurrentEntry(null);
        setError(null);
    };

    const handleRecord = async () => {
        setError(null);
        setPhase('recording');
        await startRecording();
    };

    const handleStop = useCallback(async () => {
        const blob = await stopRecording();
        if (!blob) { setPhase('idle'); return; }

        if (blob.size < 3000) {
            setError('That was too short. Try speaking a bit more.');
            setPhase('idle');
            return;
        }

        setPhase('transcribing');

        try {
            const formData = new FormData();
            formData.append('audio', blob, 'recording.webm');

            const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
            const data = await response.json();

            if (!response.ok) {
                if (data.error === 'no_speech') {
                    setError(data.message);
                    setPhase('idle');
                    return;
                }
                throw new Error(data.error || 'Transcription failed');
            }

            const entry: JournalEntry = {
                id: Date.now().toString(),
                transcript: data.transcript,
                timestamp: new Date().toISOString(),
            };

            setCurrentEntry(entry);
            setEntries((prev) => [entry, ...prev]);
            setView('entry');
            setPhase('idle');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setPhase('idle');
        }
    }, [stopRecording, setEntries]);

    const handleGetReflection = async (entry: JournalEntry) => {
        if (!voiceId) return;
        setLoadingReflection(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('transcript', entry.transcript);
            formData.append('voiceId', voiceId);
            formData.append('speed', String(speed));
            formData.append('provider', provider);

            const response = await fetch('/api/reflect', { method: 'POST', body: formData });
            const data = await response.json();

            if (!response.ok) {
                if (data.error === 'voice_expired') {
                    setError('Your voice clone has expired. Please re-clone your voice.');
                    return;
                }
                throw new Error(data.error || 'Reflection failed');
            }

            // Update entry with reflection
            const updated = { ...entry, reflection: data.reflection };
            setCurrentEntry(updated);
            setEntries((prev) => prev.map((e) => e.id === entry.id ? updated : e));

            if (data.audio && audioRef.current) {
                audioRef.current.src = `data:audio/mpeg;base64,${data.audio}`;
                audioRef.current.playbackRate = speed;
                setIsAudioPlaying(true);
                audioRef.current.onended = () => setIsAudioPlaying(false);
                audioRef.current.onerror = () => setIsAudioPlaying(false);
                await audioRef.current.play();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Reflection failed');
        } finally {
            setLoadingReflection(false);
        }
    };

    const handleDeleteEntry = (id: string) => {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        if (currentEntry?.id === id) {
            setView('list');
            setCurrentEntry(null);
        }
    };

    // Group entries by date
    const groupedEntries = entries.reduce<Record<string, JournalEntry[]>>((acc, entry) => {
        const date = formatDate(entry.timestamp);
        if (!acc[date]) acc[date] = [];
        acc[date].push(entry);
        return acc;
    }, {});

    return (
        <div className="voice-journal">
            <audio ref={audioRef} />

            {view === 'list' && (
                <div className="journal-list">
                    <div className="journal-header">
                        <h1 className="journal-title">Voice Journal</h1>
                        <button className="btn btn-primary" onClick={handleNewEntry}>
                            + New Entry
                        </button>
                    </div>

                    {entries.length === 0 ? (
                        <div className="journal-empty">
                            <p className="journal-empty-text">No entries yet. Start your first journal entry by speaking your thoughts.</p>
                        </div>
                    ) : (
                        <div className="journal-entries">
                            {Object.entries(groupedEntries).map(([date, dateEntries]) => (
                                <div key={date} className="journal-date-group">
                                    <div className="journal-date-label">{date}</div>
                                    {dateEntries.map((entry) => (
                                        <button
                                            key={entry.id}
                                            className="journal-entry-card"
                                            onClick={() => { setCurrentEntry(entry); setView('entry'); }}
                                        >
                                            <p className="journal-entry-preview">
                                                {entry.transcript.substring(0, 120)}{entry.transcript.length > 120 ? '...' : ''}
                                            </p>
                                            <div className="journal-entry-meta">
                                                <span>{formatTime(entry.timestamp)}</span>
                                                {entry.reflection && <span className="journal-has-reflection">Has reflection</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'record' && (
                <div className="journal-record">
                    <button className="btn btn-link" onClick={() => setView('list')} style={{ alignSelf: 'flex-start' }}>
                        ← Back
                    </button>
                    <h2 className="journal-record-title">What&apos;s on your mind?</h2>
                    <p className="journal-record-subtitle">Speak freely. Your words will be transcribed and saved.</p>

                    {phase === 'idle' && (
                        <>
                            <div className="record-btn-wrapper" onClick={handleRecord}>
                                <div className="record-btn-ring" />
                                <div className="record-btn-core">
                                    <div className="record-btn-dot" />
                                </div>
                            </div>
                            <div className="status-label visible">tap to record</div>
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

                    {phase === 'transcribing' && (
                        <>
                            <div className="breathing-circle" />
                            <div className="status-label visible">transcribing...</div>
                        </>
                    )}
                </div>
            )}

            {view === 'entry' && currentEntry && (
                <div className="journal-entry-view">
                    <button className="btn btn-link" onClick={() => setView('list')} style={{ alignSelf: 'flex-start' }}>
                        ← Back
                    </button>

                    <div className="journal-entry-date">
                        {formatDate(currentEntry.timestamp)} at {formatTime(currentEntry.timestamp)}
                    </div>

                    <div className="reflection-card">
                        <div className="card-label">You said</div>
                        <p className="transcript-text">{currentEntry.transcript}</p>

                        {currentEntry.reflection && (
                            <>
                                <div className="card-divider" />
                                <div className="card-label">Reflection</div>
                                <p className="reflection-text">&ldquo;{currentEntry.reflection}&rdquo;</p>
                            </>
                        )}
                    </div>

                    <div className="journal-entry-actions">
                        {!currentEntry.reflection && (
                            <button
                                className="btn btn-primary"
                                onClick={() => handleGetReflection(currentEntry)}
                                disabled={loadingReflection}
                            >
                                {loadingReflection ? 'Reflecting...' : 'Get Reflection'}
                            </button>
                        )}
                        <button
                            className="btn btn-link"
                            onClick={() => handleDeleteEntry(currentEntry.id)}
                            style={{ color: 'var(--danger)' }}
                        >
                            Delete Entry
                        </button>
                    </div>
                    <SpeedControl audioRef={audioRef} isPlaying={isAudioPlaying} onPause={() => setIsAudioPlaying(false)} onResume={() => setIsAudioPlaying(true)} />
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
