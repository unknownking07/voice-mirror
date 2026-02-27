'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useVoice } from '@/hooks/useVoice';

const NAV_ITEMS = [
    { href: '/', label: 'Home', id: 'home' },
    { href: '/mirror', label: 'Voice Mirror', id: 'mirror' },
    { href: '/reflections', label: 'Reflect', id: 'reflect' },
    { href: '/journal', label: 'Journal', id: 'journal' },
    { href: '/affirmations', label: 'Affirm', id: 'affirm' },
    { href: '/breathe', label: 'Breathe', id: 'breathe' },
] as const;

export default function Sidebar() {
    const pathname = usePathname();
    const { hasVoice, userName } = useVoice();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle navigation"
            >
                <span className={`hamburger ${mobileOpen ? 'open' : ''}`}>
                    <span />
                    <span />
                    <span />
                </span>
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
                <div className="sidebar-top">
                    <div className="sidebar-brand">Mirror Mind</div>
                    <nav className="sidebar-nav">
                        <ul>
                            {NAV_ITEMS.map(({ href, label }) => {
                                const active = pathname === href;
                                return (
                                    <li key={href}>
                                        <Link
                                            href={href}
                                            className={`sidebar-nav-btn ${active ? 'active' : ''}`}
                                            onClick={() => setMobileOpen(false)}
                                        >
                                            {label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </div>

                <div className="sidebar-bottom">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar" />
                        <span className="sidebar-user-name">
                            {userName || (hasVoice ? 'Voice Active' : 'New User')}
                        </span>
                    </div>
                </div>
            </aside>
        </>
    );
}
