import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'AgriTrack Liberia — Administration Portal',
  description: 'Digital Farm Records, Agricultural Production & Quality Verification Management Portal',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-[#1E293B]">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
