'use client';

import { useState, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

async function convertToWav(blob: Blob): Promise<Blob> {
    // 16kHz keeps file size under Vercel's 4.5MB body limit for 60s recordings
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const numSamples = channelData.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    await audioContext.close();
    return new Blob([buffer], { type: 'audio/wav' });
}

interface Voice {
    voice_id: string;
    name: string;
    category: string;
    accent: string;
    gender: string;
    preview_url: string | null;
}

interface VoiceSetupProps {
    onVoiceCloned: (voiceId: string, provider: 'elevenlabs' | 'minimax') => void;
}

export default function VoiceSetup({ onVoiceCloned }: VoiceSetupProps) {
    const [step, setStep] = useState<'intro' | 'recording' | 'uploading' | 'previewing' | 'pickVoice' | 'done'>('intro');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [voiceId, setVoiceId] = useState<string | null>(null);
    const [cloneError, setCloneError] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [provider, setProvider] = useState<'elevenlabs' | 'minimax'>('elevenlabs');
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
            // MiniMax needs WAV — convert from WebM in the browser
            let audioToUpload: Blob = recordedBlob;
            if (provider === 'minimax' && recordedBlob.type.includes('webm')) {
                try {
                    audioToUpload = await convertToWav(recordedBlob);
                } catch {
                    setError('Failed to process audio. Please try uploading a WAV or MP3 file instead.');
                    setStep('recording');
                    return;
                }
            }

            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('audio', audioToUpload, provider === 'minimax' ? 'voice-sample.wav' : 'voice-sample.webm');

            const cloneUrl = provider === 'minimax' ? '/api/minimax-clone-voice' : '/api/clone-voice';
            const response = await fetch(cloneUrl, {
                method: 'POST',
                body: formData,
            });

            const text = await response.text();
            let data: { voice_id?: string; error?: string };
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(response.status === 413 ? 'Audio file is too large. Try a shorter recording.' : `Server error: ${text.substring(0, 100)}`);
            }

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

            setVoiceId(data.voice_id ?? null);
            setStep('previewing');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setStep('recording');
        }
    };

    const handlePreview = async () => {
        if (!voiceId) return;
        setError(null);
        setLoadingPreview(true);

        try {
            const previewUrl = provider === 'minimax'
                ? `/api/minimax-preview-voice?voiceId=${voiceId}`
                : `/api/preview-voice?voiceId=${voiceId}`;
            const response = await fetch(previewUrl, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Preview failed');
            }

            const audioBlob = await response.blob();
            const url = URL.createObjectURL(audioBlob);
            if (audioRef.current) {
                audioRef.current.src = url;
                try {
                    await audioRef.current.play();
                } catch {
                    setError('Audio playback failed. Please check your browser volume and try again.');
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Preview failed');
        } finally {
            setLoadingPreview(false);
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
            onVoiceCloned(selectedVoice.voice_id, 'elevenlabs');
        }
    };

    const handleConfirm = () => {
        if (voiceId) {
            setStep('done');
            onVoiceCloned(voiceId, provider);
        }
    };

    // Delete the cloned voice from the API to free up the slot
    const deleteClone = async (vid?: string | null) => {
        const idToDelete = vid || voiceId;
        if (!idToDelete) return;
        try {
            await fetch('/api/delete-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voiceId: idToDelete, provider }),
            });
        } catch (err) {
            console.error('Failed to delete clone:', err);
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
                            Record at least {provider === 'minimax' ? '60' : '30'} seconds of natural speech — read something aloud,
                            talk about your day, anything that sounds like <em>you</em>.
                        </p>
                        <input
                            type="text"
                            className="voice-name-input"
                            placeholder="Your name (for the voice profile)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <div className="provider-select">
                            <label className="settings-label">Voice Engine</label>
                            <div className="provider-options">
                                <button
                                    className={`provider-option ${provider === 'elevenlabs' ? 'active' : ''}`}
                                    onClick={() => setProvider('elevenlabs')}
                                >
                                    <span className="provider-name">{provider === 'elevenlabs' ? '✓ ' : ''}ElevenLabs</span>
                                    <span className="provider-desc">Reliable, multilingual</span>
                                </button>
                                <button
                                    className={`provider-option ${provider === 'minimax' ? 'active' : ''}`}
                                    onClick={() => setProvider('minimax')}
                                >
                                    <span className="provider-name">{provider === 'minimax' ? '✓ ' : ''}MiniMax</span>
                                    <span className="provider-desc">More identical voice</span>
                                </button>
                            </div>
                        </div>
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
                            Speak naturally for at least {provider === 'minimax' ? '60' : '30'} seconds. A quiet room works best.
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
                                        {duration < (provider === 'minimax' ? 60 : 30)
                                            ? `Keep going... ${(provider === 'minimax' ? 60 : 30) - duration}s more recommended`
                                            : 'Good length! Stop when ready.'}
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
                            <button className="btn btn-secondary" onClick={handlePreview} disabled={loadingPreview}>
                                {loadingPreview ? '⏳ Generating preview...' : '🔊 Play Preview'}
                            </button>
                            <button className="btn btn-primary" onClick={handleConfirm} disabled={loadingPreview}>
                                Sounds Like Me →
                            </button>
                        </div>
                        {loadingPreview && (
                            <p className="preview-hint">This may take a few seconds</p>
                        )}
                        <button
                            className="btn btn-link"
                            onClick={() => { deleteClone(); setStep('recording'); setRecordedBlob(null); setVoiceId(null); }}
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
