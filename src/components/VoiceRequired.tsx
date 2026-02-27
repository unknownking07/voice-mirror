'use client';

import Link from 'next/link';
import { useVoice } from '@/hooks/useVoice';

interface VoiceRequiredProps {
    children: React.ReactNode;
}

export default function VoiceRequired({ children }: VoiceRequiredProps) {
    const { hasVoice, isLoading } = useVoice();

    if (isLoading) {
        return (
            <div className="voice-required-loading">
                <div className="breathing-circle" />
            </div>
        );
    }

    if (!hasVoice) {
        return (
            <div className="voice-required-gate">
                <div className="gate-content">
                    <div className="gate-orb" />
                    <h2 className="gate-title">Voice Not Set Up</h2>
                    <p className="gate-description">
                        This feature uses your cloned voice. Set up your voice profile first to hear reflections, affirmations, and guidance in your own voice.
                    </p>
                    <Link href="/setup" className="btn btn-primary">
                        Set Up Your Voice
                    </Link>
                    <Link href="/" className="btn btn-link">
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
