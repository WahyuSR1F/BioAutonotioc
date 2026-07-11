import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BioAutomate — Kirim Produk Digital Otomatis',
  description:
    'Otomatiskan pengiriman e-book, template, dan source code ke pembeli. Integrasikan dengan platform link-bio favorit Anda.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.variable + ' font-sans'}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
