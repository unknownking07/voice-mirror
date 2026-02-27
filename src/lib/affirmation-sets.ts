export interface AffirmationSet {
    id: string;
    title: string;
    icon: string;
    description: string;
    affirmations: string[];
}

export const AFFIRMATION_SETS: AffirmationSet[] = [
    {
        id: 'confidence',
        title: 'Confidence',
        icon: '⚡',
        description: 'Step into your power',
        affirmations: [
            'I trust myself to handle whatever comes my way.',
            'My voice matters, and I deserve to be heard.',
            'I don\'t need to be perfect to be valuable.',
            'I\'m allowed to take up space in this world.',
            'My past doesn\'t define what I\'m capable of.',
            'I have survived every hard day so far. That\'s a perfect track record.',
            'I choose courage over comfort today.',
            'I am enough, exactly as I am right now.',
            'My confidence grows every time I show up for myself.',
            'I release the need for approval from others.',
        ],
    },
    {
        id: 'gratitude',
        title: 'Gratitude',
        icon: '✧',
        description: 'Appreciate what you have',
        affirmations: [
            'I have more than enough. I am more than enough.',
            'Today is a gift I get to unwrap however I choose.',
            'I\'m grateful for the people who show up for me.',
            'My life has beauty in it, even when I forget to look.',
            'I appreciate my body for carrying me through every day.',
            'The small moments are the big moments in disguise.',
            'I\'m thankful for the lessons hidden in my struggles.',
            'There is always something to be grateful for, even now.',
            'I choose to see abundance instead of scarcity.',
            'Every breath is a reminder that I\'m alive and here.',
        ],
    },
    {
        id: 'self-love',
        title: 'Self-Love',
        icon: '♡',
        description: 'Be your own best friend',
        affirmations: [
            'I deserve the same kindness I give to others.',
            'I forgive myself for the things I didn\'t know before.',
            'My worth is not measured by my productivity.',
            'I\'m allowed to rest without earning it first.',
            'I choose to speak to myself with gentleness today.',
            'I am worthy of love, especially from myself.',
            'My flaws make me human, not broken.',
            'I release guilt for putting myself first sometimes.',
            'I honor my feelings without judging them.',
            'I am a work in progress, and that\'s beautiful.',
        ],
    },
    {
        id: 'morning',
        title: 'Morning Ritual',
        icon: '☀',
        description: 'Start your day with intention',
        affirmations: [
            'Today I choose to show up as my best self.',
            'This day is full of potential and I\'m ready for it.',
            'I release yesterday and embrace what today brings.',
            'I have the energy and focus to do meaningful work today.',
            'I will be patient with myself and others today.',
            'Good things are coming my way. I\'m open to receiving them.',
            'I set the tone for my day, not the other way around.',
            'Today I will do one thing that moves me forward.',
            'I bring value to every room I walk into.',
            'This is going to be a good day. I can feel it.',
        ],
    },
];
