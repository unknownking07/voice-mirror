'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/mirror', label: 'Mirror', icon: 'mirror' },
    { href: '/reflections', label: 'Reflect', icon: 'reflect' },
    { href: '/journal', label: 'Journal', icon: 'journal' },
    { href: '/affirmations', label: 'Affirm', icon: 'affirm' },
    { href: '/breathe', label: 'Breathe', icon: 'breathe' },
] as const;

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
    const color = active ? 'var(--accent-violet-light)' : 'var(--text-muted)';
    switch (icon) {
        case 'home':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            );
        case 'mirror':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l2 2" />
                </svg>
            );
        case 'reflect':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                </svg>
            );
        case 'journal':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <line x1="8" y1="7" x2="16" y2="7" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
            );
        case 'affirm':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
            );
        case 'breathe':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                </svg>
            );
        default:
            return null;
    }
}

export default function Navigation() {
    const pathname = usePathname();
    // Hide nav on setup page
    if (pathname === '/setup') return null;

    return (
        <nav className="bottom-nav">
            {NAV_ITEMS.map(({ href, label, icon }) => {
                const active = pathname === href;
                return (
                    <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
                        <NavIcon icon={icon} active={active} />
                        <span className="nav-label">{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
