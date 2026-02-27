export const STORAGE_KEYS = {
    VOICE_ID: 'yv_voice_id',
    VOICE_PROVIDER: 'yv_voice_provider',
    VOICE_SPEED: 'yv_voice_speed',
    USER_NAME: 'yv_user_name',
    JOURNAL_ENTRIES: 'yv_journal_entries',
    REFLECTION_HISTORY: 'yv_reflection_history',
    CUSTOM_AFFIRMATIONS: 'yv_custom_affirmations',
    AFFIRMATION_PROGRESS: 'yv_affirmation_progress',
    BREATHING_PREFS: 'yv_breathing_prefs',
    BREATHING_SOUND: 'yv_breathing_sound',
    BREATHING_VOICE: 'yv_breathing_voice',
} as const;

const OLD_KEYS = {
    'mirror_voice_id': STORAGE_KEYS.VOICE_ID,
    'mirror_voice_provider': STORAGE_KEYS.VOICE_PROVIDER,
    'mirror_voice_speed': STORAGE_KEYS.VOICE_SPEED,
} as const;

/** Migrate old `mirror_*` localStorage keys to new `yv_*` namespace. Runs once. */
export function migrateStorageKeys(): void {
    for (const [oldKey, newKey] of Object.entries(OLD_KEYS)) {
        const value = localStorage.getItem(oldKey);
        if (value && !localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, value);
        }
        localStorage.removeItem(oldKey);
    }
}
