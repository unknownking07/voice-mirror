'use client';

import GuidedReflection from '@/components/GuidedReflection';
import VoiceRequired from '@/components/VoiceRequired';

export default function ReflectionsPage() {
    return (
        <div className="app-page">
            <VoiceRequired>
                <GuidedReflection />
            </VoiceRequired>
        </div>
    );
}
