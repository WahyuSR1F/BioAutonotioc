import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      <header className="py-5 px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-foreground">BioAutomate</span>
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
