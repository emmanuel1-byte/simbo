import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/auth-context';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Simbo — Talk to your database',
  description:
    'Simbo turns plain English into safe, read-only SQL. Get answers from your database in seconds, with full transparency.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#09090B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: '#18181B',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#EDEAE5',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                borderRadius: '10px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
