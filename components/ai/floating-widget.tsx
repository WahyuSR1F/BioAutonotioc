'use client';

import { useEffect, useState } from 'react';
import { Bot, X } from 'lucide-react';
import ChatPanel from '@/components/ai/chat-panel';
import type { AgentRow } from '@/components/ai/agents-manager';

/**
 * Floating widget chat AI untuk semua halaman dashboard.
 * Memuat daftar agent on-demand saat dibuka pertama kali.
 */
export default function AiFloatingWidget() {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/agents');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAgents(data.agents ?? []);
      } catch {
        // daftar agent gagal dimuat — panel tetap terbuka tanpa pilihan agent
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  return (
    <>
      {/* Tombol floating */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label={open ? 'Tutup chat AI' : 'Buka chat AI'}
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-[22rem] max-w-[calc(100vw-2.5rem)] h-[30rem] max-h-[calc(100vh-7rem)]
                     bg-white rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col
                     animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Asisten AI</p>
              <p className="text-[11px] text-muted-foreground">Mode Auto — routing ke agent aktif</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {loaded ? (
              <ChatPanel agents={agents} compact maxHeight="100%" />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Memuat…
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
