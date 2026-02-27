'use client';

import Affirmations from '@/components/Affirmations';
import VoiceRequired from '@/components/VoiceRequired';

export default function AffirmationsPage() {
    return (
        <div className="app-page">
            <VoiceRequired>
                <Affirmations />
            </VoiceRequired>
        </div>
    );
}
