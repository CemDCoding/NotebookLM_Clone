import type { Metadata } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

// Serif face for italic highlights in headings. Only the italic style is used,
// so loading the upright one would preload a font file that never renders.
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-instrument-serif',
});

export const metadata: Metadata = {
  // Pages set only their own name; the template appends the app name the same way everywhere.
  title: { default: 'Quellenchat', template: '%s – Quellenchat' },
  description: 'Sprich mit deinen eigenen Dokumenten. Jede Antwort mit prüfbaren Zitaten belegt.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="de" className={cn(geistSans.variable, instrumentSerif.variable)}>
      <body className="min-h-screen">
        <QueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
