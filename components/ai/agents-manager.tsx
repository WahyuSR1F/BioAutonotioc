'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Bot,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AI_MODELS } from '@/lib/ai-models';

export interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  model: string;
  temperature: number;
  isActive: boolean;
  isDefault: boolean;
}

interface Props {
  initialAgents: AgentRow[];
  configured: boolean;
}

const DEFAULT_FORM = {
  name: '',
  description: '',
  systemPrompt: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
};

export default function AgentsManager({ initialAgents, configured }: Props) {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRow[]>(initialAgents);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgentRow | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => setAgents(initialAgents), [initialAgents]);

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setOpen(true);
  }

  function openEdit(agent: AgentRow) {
    setEditing(agent);
    setForm({
      name: agent.name,
      description: agent.description ?? '',
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      temperature: agent.temperature,
    });
    setOpen(true);
  }

  async function onSave() {
    setSaving(true);
    try {
      const url = editing ? `/api/ai/agents/${editing.id}` : '/api/ai/agents';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description.trim() || null,
          systemPrompt: form.systemPrompt,
          model: form.model,
          temperature: form.temperature,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Gagal menyimpan agent');
        return;
      }
      toast.success(editing ? 'Agent diperbarui' : 'Agent dibuat');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Gagal menyimpan agent');
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(agent: AgentRow, active: boolean) {
    setBusyId(agent.id);
    const prev = agents;
    setAgents((a) => a.map((x) => (x.id === agent.id ? { ...x, isActive: active } : x)));
    try {
      const res = await fetch(`/api/ai/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: active }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAgents(prev);
        toast.error(result.error || 'Gagal mengubah mode agent');
        return;
      }
      toast.success(active ? `Agent "${agent.name}" diaktifkan` : `Agent "${agent.name}" dinonaktifkan`);
      router.refresh();
    } catch {
      setAgents(prev);
      toast.error('Gagal mengubah mode agent');
    } finally {
      setBusyId(null);
    }
  }

  async function onSetDefault(agent: AgentRow) {
    setBusyId(agent.id);
    try {
      const res = await fetch(`/api/ai/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Gagal mengatur default');
        return;
      }
      toast.success(`"${agent.name}" menjadi agent default (mode Auto)`);
      router.refresh();
    } catch {
      toast.error('Gagal mengatur default');
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(agent: AgentRow) {
    if (!confirm(`Hapus agent "${agent.name}"? Riwayat chat dengan agent ini tetap tersimpan.`)) return;
    setBusyId(agent.id);
    try {
      const res = await fetch(`/api/ai/agents/${agent.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Gagal menghapus agent');
        return;
      }
      toast.success('Agent dihapus');
      router.refresh();
    } catch {
      toast.error('Gagal menghapus agent');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-border p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Daftar Agent AI</h2>
            <p className="text-xs text-muted-foreground">
              Bebas punya banyak agent — setiap agent bisa diaktifkan/dinonaktifkan dengan switch
            </p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Agent Baru
        </Button>
      </div>

      {!configured && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          OPENAI_API_KEY belum di-set di environment server — chat tidak akan berfungsi sampai key
          dipasang.
        </p>
      )}

      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border bg-secondary/30"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Bot className="w-4 h-4 text-muted-foreground" /> {agent.name}
                </p>
                {agent.isDefault && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 flex items-center gap-1">
                    <Star className="w-3 h-3" /> Default (Auto)
                  </span>
                )}
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {agent.model}
                </span>
              </div>
              {agent.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 italic">
                {agent.systemPrompt}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => openEdit(agent)}
                  disabled={busyId === agent.id}
                >
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                {!agent.isDefault && agent.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => onSetDefault(agent)}
                    disabled={busyId === agent.id}
                  >
                    <Star className="w-3 h-3 mr-1" /> Jadikan Default
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => onDelete(agent)}
                  disabled={busyId === agent.id || agents.length <= 1}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Hapus
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {busyId === agent.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : agent.isActive ? (
                  'Aktif'
                ) : (
                  'Nonaktif'
                )}
              </span>
              <Switch
                checked={agent.isActive}
                disabled={busyId === agent.id}
                onCheckedChange={(v) => onToggle(agent, v)}
                aria-label={`Mode agent ${agent.name}`}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Mode <span className="font-medium text-foreground">Auto</span> di halaman chat memakai agent
        bertanda <span className="font-medium text-foreground">Default</span>. Nonaktifkan agent untuk
        mengeluarkannya dari pemilihan otomatis.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Agent' : 'Agent Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agentName">Nama agent</Label>
              <Input
                id="agentName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="mis. Helper Toko, Copywriter, Support"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentDesc">Deskripsi (opsional)</Label>
              <Input
                id="agentDesc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ringkasan peran agent"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentPrompt">System prompt</Label>
              <Textarea
                id="agentPrompt"
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                rows={5}
                placeholder="Jelaskan peran, gaya bahasa, dan batasan agent…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Select
                  value={form.model}
                  onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agentTemp">Temperature ({form.temperature})</Label>
                <Input
                  id="agentTemp"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, temperature: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || !form.name.trim() || !form.systemPrompt.trim()}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Simpan Perubahan' : 'Buat Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
