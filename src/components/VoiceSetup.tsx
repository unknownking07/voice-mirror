'use client';

import { useState, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useVoice } from '@/hooks/useVoice';

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
    const { setUserName } = useVoice();
    const [step, setStep] = useState<'intro' | 'recording' | 'uploading' | 'previewing' | 'pickVoice' | 'done'>('intro');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [voiceId, setVoiceId] = useState<string | null>(null);
    const [cloneError, setCloneError] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewCount, setPreviewCount] = useState(0);
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
            setPreviewCount((c) => c + 1);
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
        const mins = Math.floor(s / 60).toString().padStart(2, '0');
        const secs = (s % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const maxDuration = provider === 'minimax' ? 60 : 30;

    // Visualizer bars
    const bars = [
        { delay: '0.1s', height: '15px' },
        { delay: '0.3s', height: '35px' },
        { delay: '0.2s', height: '50px' },
        { delay: '0.5s', height: '25px' },
        { delay: '0.4s', height: '45px' },
        { delay: '0.6s', height: '30px' },
        { delay: '0.1s', height: '20px' },
        { delay: '0.3s', height: '40px' },
    ];

    return (
        <div className="vs-page">
            <div className="vs-backdrop-blur" />
            <audio ref={audioRef} />

            <span className="vs-subtitle">Initialization</span>
            <h1 className="vs-title">Voice<br /><span>Profiling</span></h1>

            {/* ── INTRO STEP ── */}
            {step === 'intro' && (
                <>
                    <div className="vs-grid">
                        <div className="vs-form-side">
                            <div className="vs-input-group">
                                <label className="vs-input-label">Your Designation</label>
                                <input
                                    type="text"
                                    className="vs-text-input"
                                    placeholder="Enter name..."
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setUserName(e.target.value);
                                    }}
                                />
                            </div>

                            <div className="vs-input-group">
                                <label className="vs-input-label">Voice Engine</label>
                                <div className="vs-engine-selector">
                                    <button
                                        className={`vs-engine-card ${provider === 'elevenlabs' ? 'active' : ''}`}
                                        onClick={() => setProvider('elevenlabs')}
                                    >
                                        <div className="vs-engine-name">{provider === 'elevenlabs' ? '✓ ' : ''}ElevenLabs</div>
                                        <div className="vs-engine-desc">Reliable, multilingual</div>
                                    </button>
                                    <button
                                        className={`vs-engine-card ${provider === 'minimax' ? 'active' : ''}`}
                                        onClick={() => setProvider('minimax')}
                                    >
                                        <div className="vs-engine-name">{provider === 'minimax' ? '✓ ' : ''}MiniMax</div>
                                        <div className="vs-engine-desc">More identical voice</div>
                                    </button>
                                </div>
                            </div>

                            <p className="vs-description">
                                To create your mirror, we require a signature of your frequency. This sample
                                will calibrate the response algorithm to your unique timbre.
                            </p>
                        </div>

                        <div className="vs-recording-zone">
                            <span className="vs-subtitle" style={{ marginBottom: '2rem' }}>Acoustic Calibration</span>
                            <div className="vs-timer">00:00 / 00:{maxDuration.toString().padStart(2, '0')}</div>
                            <div className="vs-visualizer vs-visualizer-idle">
                                {bars.map((bar, i) => (
                                    <div
                                        key={i}
                                        className="vs-bar"
                                        style={{ animationDelay: bar.delay, height: bar.height, opacity: 0.2 }}
                                    />
                                ))}
                            </div>
                            <p className="vs-prompt-text">
                                &ldquo;Read this naturally: My voice is a reflection of my inner state.
                                I am here to observe the bridge between thought and sound...&rdquo;
                            </p>
                            <div className="vs-zone-actions">
                                <button className="vs-bracket-btn" onClick={handlePickVoice}>
                                    [ SKIP — USE PRESET ]
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="vs-action-footer">
                        <button
                            className="vs-control-pill"
                            onClick={() => setStep('recording')}
                            disabled={!name.trim()}
                        >
                            <span className="vs-control-text">I&apos;M READY</span>
                            <div className="vs-control-dot" />
                        </button>
                    </div>
                </>
            )}

            {/* ── RECORDING STEP ── */}
            {step === 'recording' && (
                <>
                    <div className="vs-grid">
                        <div className="vs-form-side">
                            <div className="vs-input-group">
                                <label className="vs-input-label">Profile</label>
                                <div className="vs-text-input vs-readonly">{name}</div>
                            </div>

                            <div className="vs-input-group">
                                <label className="vs-input-label">Engine</label>
                                <div className="vs-text-input vs-readonly" style={{ textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                                    {provider === 'elevenlabs' ? 'ElevenLabs' : 'MiniMax'}
                                </div>
                            </div>

                            <details className="vs-read-aloud">
                                <summary className="vs-read-aloud-toggle">
                                    📖 Need something to read? Tap here
                                </summary>
                                <div className="vs-read-aloud-text">
                                    {provider === 'minimax' ? (
                                        <>
                                            <p>I&apos;ve been thinking a lot lately about the things that make life interesting. It&apos;s not always the big moments — sometimes it&apos;s just a quiet morning with a cup of coffee, watching the light change through the window.</p>
                                            <p>Yesterday I went for a walk and noticed things I usually rush past. The sound of leaves, someone laughing in the distance, the way the sky looks right before sunset. It made me realize how much I miss when I&apos;m stuck in my own head.</p>
                                            <p>I think the best conversations happen when you&apos;re not trying too hard. When you just let yourself talk about whatever comes to mind. Like right now — I&apos;m not performing, I&apos;m just being myself.</p>
                                            <p>If I could give advice to my younger self, I&apos;d say: don&apos;t rush. The things that matter will find you.</p>
                                        </>
                                    ) : (
                                        <>
                                            <p>I&apos;ve been thinking about what makes a good day. It&apos;s usually not the big things — it&apos;s a quiet moment, a conversation that surprised me, or just feeling like I was actually present for once.</p>
                                            <p>Sometimes the best thing you can do is slow down and notice what&apos;s around you. The sounds, the light, the way the air feels. It&apos;s all there, waiting for you to pay attention.</p>
                                        </>
                                    )}
                                </div>
                            </details>

                            {cloneError && (
                                <div className="vs-clone-fallback">
                                    <p className="vs-fallback-text">
                                        Voice cloning requires an ElevenLabs paid plan ($5/mo).
                                        You can still use the Mirror with a preset voice:
                                    </p>
                                    <button className="vs-bracket-btn" onClick={handlePickVoice}>
                                        [ CHOOSE PRESET VOICE ]
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="vs-recording-zone">
                            <span className="vs-subtitle" style={{ marginBottom: '2rem' }}>Acoustic Calibration</span>

                            {/* Not recording yet, no blob */}
                            {!isRecording && !recordedBlob && (
                                <>
                                    <div className="vs-timer">00:00 / 00:{maxDuration.toString().padStart(2, '0')}</div>
                                    <div className="vs-visualizer vs-visualizer-idle">
                                        {bars.map((bar, i) => (
                                            <div key={i} className="vs-bar" style={{ animationDelay: bar.delay, height: bar.height, opacity: 0.2 }} />
                                        ))}
                                    </div>
                                    <p className="vs-prompt-text">
                                        Speak naturally for at least {maxDuration} seconds. A quiet room works best.
                                    </p>
                                    <div className="vs-zone-actions">
                                        <button className="vs-bracket-btn" onClick={handleStartRecording}>
                                            [ BEGIN RECORDING ]
                                        </button>
                                        <button className="vs-bracket-btn" onClick={() => fileInputRef.current?.click()}>
                                            [ UPLOAD FILE ]
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="audio/*"
                                            onChange={handleFileUpload}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Currently recording */}
                            {isRecording && (
                                <>
                                    <div className="vs-timer">{formatDuration(duration)} / 00:{maxDuration.toString().padStart(2, '0')}</div>
                                    <div className="vs-visualizer">
                                        {bars.map((bar, i) => (
                                            <div key={i} className="vs-bar" style={{ animationDelay: bar.delay, height: bar.height }} />
                                        ))}
                                    </div>
                                    <p className="vs-prompt-text">
                                        {duration < maxDuration
                                            ? `Keep going... ${maxDuration - duration}s more`
                                            : 'Good length! Stop when ready.'}
                                    </p>
                                    <button
                                        className="vs-bracket-btn vs-stop-btn"
                                        onClick={handleStopRecording}
                                        disabled={duration < maxDuration}
                                    >
                                        [ STOP RECORDING ]
                                    </button>
                                </>
                            )}

                            {/* Recording done */}
                            {!isRecording && recordedBlob && (
                                <>
                                    <div className="vs-timer">✓ Audio ready</div>
                                    <div className="vs-visualizer vs-visualizer-idle">
                                        {bars.map((bar, i) => (
                                            <div key={i} className="vs-bar" style={{ animationDelay: bar.delay, height: bar.height, opacity: 0.4 }} />
                                        ))}
                                    </div>
                                    <div className="vs-zone-actions">
                                        <button className="vs-bracket-btn" onClick={() => setRecordedBlob(null)}>
                                            [ RESTART SAMPLE ]
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="vs-action-footer">
                        <button className="vs-bracket-btn" onClick={() => { setStep('intro'); setRecordedBlob(null); }} style={{ marginRight: 'auto' }}>
                            [ ← BACK ]
                        </button>
                        {!isRecording && recordedBlob && (
                            <button className="vs-control-pill" onClick={handleClone}>
                                <span className="vs-control-text">CLONE MY VOICE</span>
                                <div className="vs-control-dot" />
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* ── UPLOADING STEP ── */}
            {step === 'uploading' && (
                <div className="vs-center-state">
                    <div className="vs-breathing-circle" />
                    <p className="vs-loading-label">Cloning your voice...</p>
                    <p className="vs-loading-sub">This usually takes 15-30 seconds</p>
                </div>
            )}

            {/* ── PREVIEWING STEP ── */}
            {step === 'previewing' && (
                <div className="vs-center-state">
                    <p className="vs-loading-label" style={{ marginBottom: '1.5rem' }}>
                        Your voice has been cloned. Listen to a preview.
                    </p>
                    <div className="vs-zone-actions" style={{ flexDirection: 'column', gap: '1rem' }}>
                        <button className="vs-control-pill" onClick={handlePreview} disabled={loadingPreview}>
                            <span className="vs-control-text">
                                {loadingPreview ? '⏳ GENERATING...' : '🔊 PLAY PREVIEW'}
                            </span>
                            <div className="vs-control-dot" />
                        </button>
                        <button className="vs-control-pill" onClick={handleConfirm} disabled={loadingPreview}>
                            <span className="vs-control-text">SOUNDS LIKE ME</span>
                            <div className="vs-control-dot" />
                        </button>
                    </div>
                    {!loadingPreview && previewCount >= 1 && (
                        <p className="vs-loading-sub" style={{ marginTop: '1rem' }}>
                            Tap preview again — each play sounds slightly different
                        </p>
                    )}
                    <button
                        className="vs-bracket-btn"
                        style={{ marginTop: '2rem' }}
                        onClick={() => { deleteClone(); setStep('recording'); setRecordedBlob(null); setVoiceId(null); }}
                    >
                        [ TRY DIFFERENT RECORDING ]
                    </button>
                </div>
            )}

            {/* ── PICK VOICE STEP ── */}
            {step === 'pickVoice' && (
                <div className="vs-pick-voice">
                    <p className="vs-description" style={{ marginBottom: '1.5rem' }}>
                        Pick a voice that feels right. You can always clone your own voice later
                        with an ElevenLabs Starter plan.
                    </p>

                    {loadingVoices ? (
                        <div className="vs-center-state">
                            <div className="vs-breathing-circle" />
                            <p className="vs-loading-label">Loading voices...</p>
                        </div>
                    ) : (
                        <div className="vs-voice-grid">
                            {voices.map((voice) => (
                                <button
                                    key={voice.voice_id}
                                    className={`vs-voice-card ${selectedVoice?.voice_id === voice.voice_id ? 'selected' : ''}`}
                                    onClick={() => setSelectedVoice(voice)}
                                >
                                    <div className="vs-voice-card-info">
                                        <span className="vs-voice-name">{voice.name}</span>
                                        <span className="vs-voice-meta">
                                            {voice.gender}{voice.accent ? ` · ${voice.accent}` : ''}
                                        </span>
                                    </div>
                                    {voice.preview_url && (
                                        <button
                                            className="vs-voice-preview-btn"
                                            onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice); }}
                                        >
                                            {playingPreview === voice.voice_id ? '⏸' : '▶'}
                                        </button>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="vs-action-footer" style={{ marginTop: '2rem' }}>
                        <button className="vs-bracket-btn" onClick={() => setStep('intro')}>
                            [ ← BACK ]
                        </button>
                        {selectedVoice && (
                            <button className="vs-control-pill" onClick={handleConfirmPreset}>
                                <span className="vs-control-text">USE &ldquo;{selectedVoice.name}&rdquo;</span>
                                <div className="vs-control-dot" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── ERROR ── */}
            {(error || recorderError) && !cloneError && (
                <div className="vs-error">
                    {error || recorderError}
                </div>
            )}
        </div>
    );
}
