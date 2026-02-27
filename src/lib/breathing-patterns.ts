export interface BreathingPhase {
    name: 'inhale' | 'hold' | 'exhale' | 'rest';
    label: string;
    duration: number; // seconds
}

export interface BreathingPattern {
    id: string;
    title: string;
    description: string;
    icon: string;
    phases: BreathingPhase[];
    steps: string; // step-by-step how-to for the user
}

export const BREATHING_PATTERNS: BreathingPattern[] = [
    {
        id: '4-7-8',
        title: '4-7-8 Relaxation',
        description: 'Deep calm. Inhale 4, hold 7, exhale 8.',
        icon: '🌙',
        steps: 'Breathe in through your nose for 4 seconds → Hold your breath for 7 seconds → Slowly exhale through your mouth for 8 seconds. Repeat.',
        phases: [
            { name: 'inhale', label: 'Breathe in...', duration: 4 },
            { name: 'hold', label: 'Hold...', duration: 7 },
            { name: 'exhale', label: 'Breathe out...', duration: 8 },
        ],
    },
    {
        id: 'box',
        title: 'Box Breathing',
        description: 'Balance and focus. Equal 4-count rhythm.',
        icon: '◻',
        steps: 'Breathe in for 4 seconds → Hold for 4 seconds → Breathe out for 4 seconds → Hold empty for 4 seconds. Each side of the "box" is equal.',
        phases: [
            { name: 'inhale', label: 'Breathe in...', duration: 4 },
            { name: 'hold', label: 'Hold...', duration: 4 },
            { name: 'exhale', label: 'Breathe out...', duration: 4 },
            { name: 'rest', label: 'Hold...', duration: 4 },
        ],
    },
    {
        id: 'simple',
        title: 'Simple Calm',
        description: 'Easy and gentle. In 4, out 6.',
        icon: '🍃',
        steps: 'Breathe in slowly for 4 seconds → Breathe out gently for 6 seconds. The longer exhale activates your relaxation response. Just follow the orb.',
        phases: [
            { name: 'inhale', label: 'Breathe in...', duration: 4 },
            { name: 'exhale', label: 'Breathe out...', duration: 6 },
        ],
    },
];

export const DURATIONS = [
    { label: '3 min', seconds: 180 },
    { label: '5 min', seconds: 300 },
    { label: '10 min', seconds: 600 },
];
