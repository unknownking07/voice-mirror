'use client';

import Sidebar from '@/components/Sidebar';
import { MobileHeader, MobileNavDock } from '@/components/MobileNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="app-shell">
            <Sidebar />
            <main className="app-main">
                <MobileHeader />
                {children}
            </main>
            <MobileNavDock />
        </div>
    );
}
