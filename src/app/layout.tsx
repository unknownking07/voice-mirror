import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { VoiceProvider } from '@/contexts/VoiceContext';
import AppShell from '@/components/AppShell';
import './globals.css';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
};

export const metadata: Metadata = {
    title: 'MIRROR MIND | Sonic Wellness',
    description: 'Guided reflections, journaling, affirmations, and breathing exercises — all in your own cloned voice.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <Script
                    src="https://www.googletagmanager.com/gtag/js?id=G-FR85JF7Z6V"
                    strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', 'G-FR85JF7Z6V');
                    `}
                </Script>
                {/* Noise grain overlay */}
                <div className="noise-overlay" />
                {/* Vignette effect */}
                <div className="vignette" />
                {/* Ambient background glow */}
                <div className="ambient-glow" />
                <VoiceProvider>
                    <AppShell>
                        {children}
                    </AppShell>
                </VoiceProvider>
            </body>
        </html>
    );
}
