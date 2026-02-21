'use client';

import { useState, useRef, useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface Voice {
    voice_id: string;
    name: string;
    category: string;
    accent: string;
    gender: string;
    preview_url: string | null;
}

interface VoiceSetupProps {
    onVoiceCloned: (voiceId: string) => void;
}

export default function VoiceSetup({ onVoiceCloned }: VoiceSetupProps) {
    const [step, setStep] = useState<'intro' | 'recording' | 'uploading' | 'previewing' | 'pickVoice' | 'done'>('intro');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [voiceId, setVoiceId] = useState<string | null>(null);
    const [cloneError, setCloneError] = useState(false);
    const { isRecording, duration, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Pre-made voices
    const [voices, setVoices] = useState<Voice[]>([]);
    const [loadingVoices, setLoadingVoices] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);

    const fetchVoices = async () => {
        setLoadingVoices(true);
        try {
            const res = await fetch('/api/voices');
            const data = await res.json();
            if (data.voices) {
                setVoices(data.voices);
            }
        } catch {
            setError('Failed to load voices');
        } finally {
            setLoadingVoices(false);
        }
    };

    const handleStartRecording = async () => {
        setError(null);
        await startRecording();
    };

    const handleStopRecording = async () => {
        const blob = await stopRecording();
        if (blob) {
            setRecordedBlob(blob);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRecordedBlob(file);
            setError(null);
        }
    };

    const handleClone = async () => {
        if (!recordedBlob) {
            setError('Please record or upload audio first.');
            return;
        }
        if (!name.trim()) {
            setError('Please enter a name for your voice.');
            return;
        }

        setStep('uploading');
        setError(null);

        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('audio', recordedBlob, 'voice-sample.webm');

            const response = await fetch('/api/clone-voice', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                // Check if it's a subscription error
                const errorMsg = data.error || 'Voice cloning failed';
                if (errorMsg.toLowerCase().includes('subscription') || errorMsg.toLowerCase().includes('upgrade') || response.status === 403 || response.status === 401) {
                    setCloneError(true);
                    setStep('recording');
                    setError(errorMsg);
                    return;
                }
                throw new Error(errorMsg);
            }

            setVoiceId(data.voice_id);
            setStep('previewing');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setStep('recording');
        }
    };

    const handlePreview = async () => {
        if (!voiceId) return;
        setError(null);

        try {
            const response = await fetch(`/api/preview-voice?voiceId=${voiceId}`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Preview failed');
            }

            const audioBlob = await response.blob();
            const url = URL.createObjectURL(audioBlob);
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Preview failed');
        }
    };

    const handlePreviewVoice = (voice: Voice) => {
        if (voice.preview_url && audioRef.current) {
            setPlayingPreview(voice.voice_id);
            audioRef.current.src = voice.preview_url;
            audioRef.current.onended = () => setPlayingPreview(null);
            audioRef.current.play();
        }
    };

    const handlePickVoice = () => {
        fetchVoices();
        setStep('pickVoice');
    };

    const handleConfirmPreset = () => {
        if (selectedVoice) {
            onVoiceCloned(selectedVoice.voice_id);
        }
    };

    const handleConfirm = () => {
        if (voiceId) {
            setStep('done');
            onVoiceCloned(voiceId);
        }
    };

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="voice-setup">
            <div className="setup-container">
                <div className="meta-label" style={{ marginBottom: '1.5rem' }}>Voice Configuration</div>
                <h1 className="setup-title">The Mirror</h1>
                <audio ref={audioRef} />

                {step === 'intro' && (
                    <div className="setup-step">
                        <p className="setup-description">
                            To hear your own voice reflecting back, I need a sample of how you speak.
                            Record at least 30 seconds of natural speech — read something aloud,
                            talk about your day, anything that sounds like <em>you</em>.
                        </p>
                        <input
                            type="text"
                            className="voice-name-input"
                            placeholder="Your name (for the voice profile)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={() => setStep('recording')}
                            disabled={!name.trim()}
                        >
                            I&apos;m Ready
                        </button>
                        <div className="skip-clone">
                            <button className="btn btn-link" onClick={handlePickVoice}>
                                Skip — use a preset voice instead
                            </button>
                        </div>
                    </div>
                )}

                {step === 'recording' && (
                    <div className="setup-step">
                        <p className="setup-description">
                            Speak naturally for at least 30 seconds. A quiet room works best.
                        </p>

                        <div className="recording-controls">
                            {!isRecording && !recordedBlob && (
                                <div className="record-options">
                                    <button className="btn btn-record" onClick={handleStartRecording}>
                                        <span className="record-dot"></span>
                                        Start Recording
                                    </button>
                                    <div className="divider-text">or</div>
                                    <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                        Upload Audio File
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            )}

                            {isRecording && (
                                <div className="recording-active">
                                    <div className="recording-indicator">
                                        <span className="pulse-dot"></span>
                                        <span className="recording-time">{formatDuration(duration)}</span>
                                    </div>
                                    <p className="recording-hint">
                                        {duration < 30 ? `Keep going... ${30 - duration}s more recommended` : 'Good length! Stop when ready.'}
                                    </p>
                                    <button className="btn btn-stop" onClick={handleStopRecording}>
                                        Stop Recording
                                    </button>
                                </div>
                            )}

                            {!isRecording && recordedBlob && (
                                <div className="recording-done">
                                    <p className="recording-ready">✓ Audio ready</p>
                                    <div className="recording-actions">
                                        <button className="btn btn-secondary" onClick={() => { setRecordedBlob(null); }}>
                                            Re-record
                                        </button>
                                        <button className="btn btn-primary" onClick={handleClone}>
                                            Clone My Voice
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {cloneError && (
                            <div className="clone-fallback">
                                <p className="fallback-text">
                                    Voice cloning requires an ElevenLabs paid plan ($5/mo).
                                    You can still use the Mirror with a preset voice:
                                </p>
                                <button className="btn btn-secondary" onClick={handlePickVoice}>
                                    Choose a Preset Voice →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {step === 'uploading' && (
                    <div className="setup-step">
                        <div className="loading-state">
                            <div className="breathing-circle"></div>
                            <p className="loading-text">Cloning your voice...</p>
                            <p className="loading-subtext">This usually takes 15-30 seconds</p>
                        </div>
                    </div>
                )}

                {step === 'previewing' && (
                    <div className="setup-step">
                        <p className="setup-description">
                            Your voice has been cloned. Listen to a preview to make sure it sounds like you.
                        </p>
                        <div className="preview-actions">
                            <button className="btn btn-secondary" onClick={handlePreview}>
                                🔊 Play Preview
                            </button>
                            <button className="btn btn-primary" onClick={handleConfirm}>
                                Sounds Like Me →
                            </button>
                        </div>
                        <button
                            className="btn btn-link"
                            onClick={() => { setStep('recording'); setRecordedBlob(null); setVoiceId(null); }}
                        >
                            Try a different recording
                        </button>
                    </div>
                )}

                {step === 'pickVoice' && (
                    <div className="setup-step">
                        <p className="setup-description">
                            Pick a voice that feels right. You can always clone your own voice later
                            with an ElevenLabs Starter plan.
                        </p>

                        {loadingVoices ? (
                            <div className="loading-state">
                                <div className="breathing-circle"></div>
                                <p className="loading-text">Loading voices...</p>
                            </div>
                        ) : (
                            <div className="voice-grid">
                                {voices.map((voice) => (
                                    <button
                                        key={voice.voice_id}
                                        className={`voice-card ${selectedVoice?.voice_id === voice.voice_id ? 'selected' : ''}`}
                                        onClick={() => setSelectedVoice(voice)}
                                    >
                                        <div className="voice-card-info">
                                            <span className="voice-name">{voice.name}</span>
                                            <span className="voice-meta">
                                                {voice.gender}{voice.accent ? ` · ${voice.accent}` : ''}
                                            </span>
                                        </div>
                                        {voice.preview_url && (
                                            <button
                                                className="voice-preview-btn"
                                                onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice); }}
                                            >
                                                {playingPreview === voice.voice_id ? '⏸' : '▶'}
                                            </button>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedVoice && (
                            <div className="pick-actions">
                                <button className="btn btn-primary" onClick={handleConfirmPreset}>
                                    Use &ldquo;{selectedVoice.name}&rdquo; →
                                </button>
                            </div>
                        )}

                        <button className="btn btn-link" onClick={() => setStep('intro')}>
                            ← Back
                        </button>
                    </div>
                )}

                {(error || recorderError) && !cloneError && (
                    <div className="error-message">
                        {error || recorderError}
                    </div>
                )}
            </div>
        </div>
    );
}
