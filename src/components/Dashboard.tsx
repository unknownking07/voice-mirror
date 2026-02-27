'use client';

import Link from 'next/link';
import { useVoice } from '@/hooks/useVoice';

const DAILY_PROMPTS = [
    "What does silence tell you that noise conceals?",
    "What haven't you said out loud today?",
    "What are you avoiding right now?",
    "What would you tell yourself if no one was listening?",
    "What is weighing on you tonight?",
    "What do you actually want?",
];

function getDailyPrompt() {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning Brief';
    if (hour < 17) return 'Afternoon Brief';
    return 'Evening Brief';
}

export default function Dashboard() {
    const { hasVoice } = useVoice();
    const prompt = getDailyPrompt();

    return (
        <div className="dashboard">
            <div className="dashboard-layout">
                <div className="dashboard-hero">
                    <span className="subtitle">{getGreeting()}</span>
                    <h1 className="dashboard-title">
                        Inner<br />
                        <span>Dialogue</span>
                    </h1>
                    <p className="description">
                        Your daily space to reconnect with the sound of your own existence.
                        Start your morning ritual to align voice and mind.
                    </p>
                    <div className="dashboard-header">
                        <div className={`voice-badge ${hasVoice ? 'active' : ''}`}>
                            <span className="voice-badge-dot" />
                            {hasVoice ? 'Voice Active' : 'Voice Not Set Up'}
                        </div>
                        {!hasVoice && (
                            <Link href="/setup" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                                Set Up Your Voice
                            </Link>
                        )}
                    </div>
                    <Link href="/mirror" className="bracket-link" style={{ marginTop: '2rem' }}>
                        [ START RITUAL ]
                    </Link>
                </div>

                <div className="daily-card">
                    <div>
                        <span className="subtitle" style={{ opacity: 0.5 }}>Today&apos;s Prompt</span>
                        <p className="daily-card-prompt">
                            &ldquo;{prompt}&rdquo;
                        </p>
                    </div>
                    <Link href="/mirror" className="control-pill" style={{ height: '50px', marginTop: '2rem', textDecoration: 'none' }}>
                        <span className="control-text">[ RECORD RESPONSE ]</span>
                        <span className="control-icon" />
                    </Link>
                </div>
            </div>

        </div>
    );
}
