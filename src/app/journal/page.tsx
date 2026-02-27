'use client';

import VoiceJournal from '@/components/VoiceJournal';
import VoiceRequired from '@/components/VoiceRequired';

export default function JournalPage() {
    return (
        <div className="app-page">
            <VoiceRequired>
                <VoiceJournal />
            </VoiceRequired>
        </div>
    );
}
