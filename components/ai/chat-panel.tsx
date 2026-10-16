'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bot, Loader2, Send, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AgentRow } from '@/components/ai/agents-manager';

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentId?: string | null;
}

interface Props {
  agents: AgentRow[];
  /** true = tampilan ringkas untuk floating widget */
  compact?: boolean;
  maxHeight?: string;
}

const AUTO = '__auto__';

export default function ChatPanel({ agents, compact = false, maxHeight = '32rem' }: Props) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [input, setInput] = useState('');
  const [agentId, setAgentId] = useState<string>(AUTO);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeAgents = agents.filter((a) => a.isActive);
  const selectedAgent =
    agentId === AUTO
      ? activeAgents.find((a) => a.isDefault) ?? activeAgents[0]
      : activeAgents.find((a) => a.id === agentId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/chat');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMessages(
          (data.messages ?? []).map((m: { id: string; role: string; content: string; agentId: string | null }) => ({
            id: m.id,
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
            agentId: m.agentId,
          }))
        );
      } catch {
        // riwayat gagal dimuat — bukan fatal
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;

    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          agentId: agentId === AUTO ? null : agentId,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Gagal mengirim pesan');
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setInput(text);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          agentId: result.agent?.id ?? null,
        },
      ]);
    } catch {
      toast.error('Gagal mengirim pesan');
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  async function onClear() {
    if (!confirm('Hapus seluruh riwayat chat?')) return;
    try {
      const res = await fetch('/api/ai/chat', { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Gagal menghapus riwayat');
        return;
      }
      setMessages([]);
      toast.success('Riwayat chat dihapus');
    } catch {
      toast.error('Gagal menghapus riwayat');
    }
  }

  function agentName(id: string | null | undefined): string {
    if (!id) return 'AI';
    return agents.find((a) => a.id === id)?.name ?? 'AI';
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: pemilih agent + hapus riwayat */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className={compact ? 'h-8 text-xs w-[10.5rem]' : 'h-9 text-sm w-56'}>
            <Bot className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Pilih agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>
              Auto — {selectedAgent ? selectedAgent.name : 'agent default'}
            </SelectItem>
            {activeAgents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.isDefault ? ' (default)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground hover:text-destructive"
          title="Hapus riwayat chat"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Area pesan */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight }}>
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat riwayat…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Mulai ngobrol dengan asisten AI</p>
            <p className="text-xs text-muted-foreground">
              Tanya cara pakai BioAutomate, minta bantuan atur produk, atau apapun. Agent aktif
              saat ini: <span className="font-medium">{selectedAgent?.name ?? '—'}</span>
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-secondary text-foreground rounded-bl-md'
                }`}
              >
                {m.role === 'assistant' && messages.length > 1 && (
                  <p className="text-[10px] font-medium opacity-60 mb-1">{agentName(m.agentId)}</p>
                )}
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-secondary rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Ketik pesan… (Enter kirim, Shift+Enter baris baru)"
            rows={compact ? 1 : 2}
            className={compact ? 'text-sm min-h-[2.25rem] resize-none' : 'text-sm resize-none'}
          />
          <Button
            onClick={onSend}
            disabled={sending || !input.trim()}
            size={compact ? 'sm' : 'default'}
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
