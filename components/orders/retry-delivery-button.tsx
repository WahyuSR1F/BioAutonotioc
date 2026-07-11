'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RetryDeliveryButton({ deliveryId }: { deliveryId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Gagal retry'); return; }
      toast.success('Pengiriman ulang berhasil diproses!');
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRetry} disabled={loading} className="mt-2 gap-2">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      Kirim Ulang
    </Button>
  );
}
