import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
    title: 'Mirror — Hear Yourself Think',
    description: 'Speak your thoughts. Hear them reflected back in your own voice.',
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
                {children}
            </body>
        </html>
    );
}
