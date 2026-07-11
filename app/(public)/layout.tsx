import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="py-5 px-6 border-b border-border bg-white">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-foreground text-sm">BioAutomate</span>
        </Link>
      </header>
      {children}
    </div>
  );
}
