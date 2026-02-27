'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVoice } from '@/hooks/useVoice';

const NAV_ITEMS = [
    {
        href: '/',
        label: 'Home',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        href: '/mirror',
        label: 'Mirror',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
            </svg>
        ),
    },
    {
        href: '/reflections',
        label: 'Reflect',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
            </svg>
        ),
    },
    {
        href: '/breathe',
        label: 'Breathe',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M12 6v6l4 2" />
            </svg>
        ),
    },
    {
        href: '/affirmations',
        label: 'Affirm',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
        ),
    },
    {
        href: '/journal',
        label: 'Journal',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        ),
    },
];

/** Mobile header bar — renders inside the scrollable area so it scrolls away */
export function MobileHeader() {
    const { userName } = useVoice();

    return (
        <header className="mobile-header">
            <div className="mobile-brand">Mirror Mind</div>
            <Link href="/setup" className="mobile-avatar" aria-label="Settings">
                {userName ? userName.charAt(0).toUpperCase() : '?'}
            </Link>
        </header>
    );
}

/** Bottom nav dock — fixed at the bottom of the screen */
export function MobileNavDock() {
    const pathname = usePathname();

    return (
        <nav className="nav-dock">
            {NAV_ITEMS.map(({ href, label, icon }) => {
                const isActive = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`nav-dock-item ${isActive ? 'active' : ''}`}
                        aria-label={label}
                    >
                        {icon}
                    </Link>
                );
            })}
        </nav>
    );
}
