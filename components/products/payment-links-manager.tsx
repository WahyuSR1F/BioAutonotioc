'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { slugify } from '@/lib/utils';

interface Link {
  id: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  productId: string;
  productTitle: string;
  initialLinks: Link[];
}

export default function PaymentLinksManager({ productId, productTitle, initialLinks }: Props) {
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [loading, setLoading] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  async function generateLink() {
    setLoading(true);
    const slug = `${slugify(productTitle)}-${Date.now().toString(36)}`;

    const res = await fetch('/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, slug }),
    });
    const result = await res.json();
    setLoading(false);

    if (!res.ok) { toast.error(result.error || 'Gagal membuat link'); return; }
    setLinks((prev) => [
      { id: result.id, slug: result.slug, is_active: true, created_at: new Date().toISOString() },
      ...prev,
    ]);
    toast.success('Payment link baru dibuat!');
  }

  async function toggleLink(id: string, isActive: boolean) {
    const res = await fetch(`/api/payment-links/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    });
    const result = await res.json();
    if (!res.ok) { toast.error(result.error || 'Gagal mengubah link'); return; }
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, is_active: !isActive } : l));
    toast.success(isActive ? 'Link dinonaktifkan' : 'Link diaktifkan');
  }

  async function deleteLink(id: string) {
    const res = await fetch(`/api/payment-links/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) { toast.error(result.error || 'Gagal menghapus link'); return; }
    setLinks((prev) => prev.filter((l) => l.id !== id));
    toast.success('Link dihapus');
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${appUrl}/buy/${slug}`);
    toast.success('Link disalin!');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{links.length} payment link</p>
        <Button size="sm" onClick={generateLink} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
          Generate Link
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Belum ada payment link. Klik &quot;Generate Link&quot; untuk membuat.
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-foreground truncate">
                  {appUrl}/buy/{link.slug}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dibuat {new Date(link.created_at).toLocaleDateString('id-ID')}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${link.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {link.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => copyLink(link.slug)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                  <a href={`/buy/${link.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => toggleLink(link.id, link.is_active)}>
                  <span className="text-xs">{link.is_active ? 'Off' : 'On'}</span>
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => deleteLink(link.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-accent rounded-xl p-4">
        <p className="text-xs font-medium text-accent-foreground">Cara menggunakan</p>
        <p className="text-xs text-muted-foreground mt-1">
          Salin payment link di atas, lalu tempel sebagai tombol/link di Linktree, Saweria, Instagram bio, atau platform bio lainnya.
        </p>
      </div>
    </div>
  );
}
