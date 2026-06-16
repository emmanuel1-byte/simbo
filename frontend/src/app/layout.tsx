import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Simbo: Talk to your database',
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
    <html lang="en">
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
