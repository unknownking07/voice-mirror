'use client';

import { useVoice } from '@/hooks/useVoice';
import { RefObject } from 'react';

const SPEED_PRESETS = [0.7, 1.0, 1.2, 1.5];

interface SpeedControlProps {
    audioRef?: RefObject<HTMLAudioElement | null>;
    isPlaying?: boolean;
    onPause?: () => void;
    onResume?: () => void;
}

export default function SpeedControl({ audioRef, isPlaying, onPause, onResume }: SpeedControlProps) {
    const { speed, setSpeed } = useVoice();

    const handleSpeedChange = (newSpeed: number) => {
        setSpeed(newSpeed);
        if (audioRef?.current) {
            audioRef.current.playbackRate = newSpeed;
        }
    };

    const handlePauseToggle = () => {
        if (!audioRef?.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            onPause?.();
        } else {
            audioRef.current.play().catch(() => { });
            onResume?.();
        }
    };

    const showPauseBtn = audioRef && (isPlaying !== undefined);

    return (
        <div className="speed-control-widget">
            <div className="speed-control-header">
                <label className="speed-control-label">Voice Speed</label>
                {showPauseBtn && (
                    <button
                        className={`speed-pause-btn ${isPlaying ? 'playing' : ''}`}
                        onClick={handlePauseToggle}
                        aria-label={isPlaying ? 'Pause' : 'Resume'}
                    >
                        {isPlaying ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="6,4 20,12 6,20" />
                            </svg>
                        )}
                    </button>
                )}
            </div>
            <div className="speed-control-row">
                <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="speed-slider"
                />
                <span className="speed-value">{speed.toFixed(1)}x</span>
            </div>
            <div className="speed-presets">
                {SPEED_PRESETS.map((s) => (
                    <button
                        key={s}
                        className={`speed-preset ${speed === s ? 'active' : ''}`}
                        onClick={() => handleSpeedChange(s)}
                    >
                        {s}x
                    </button>
                ))}
            </div>
        </div>
    );
}
