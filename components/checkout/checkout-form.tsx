'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency } from '@/lib/utils';

const schema = z.object({
  buyerName: z.string().min(2, 'Nama minimal 2 karakter'),
  buyerEmail: z.string().email('Email tidak valid'),
  confirmEmail: z.string().email('Email tidak valid'),
  paymentProvider: z.enum(['midtrans', 'xendit']),
}).refine((d) => d.buyerEmail === d.confirmEmail, {
  message: 'Email tidak cocok',
  path: ['confirmEmail'],
});

type FormData = z.infer<typeof schema>;

interface Props {
  productId: string;
  paymentLinkId: string;
  productTitle: string;
  price: number;
  adminFee: number;
  total: number;
  currency: string;
  providers: Array<'midtrans' | 'xendit'>;
}

export default function CheckoutForm({
  productId,
  paymentLinkId,
  productTitle,
  price,
  adminFee,
  total,
  currency,
  providers,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const availableProviders = providers.length > 0 ? providers : [];

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paymentProvider: availableProviders[0] ?? 'midtrans' },
  });

  const provider = watch('paymentProvider');

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          paymentLinkId,
          buyerName: data.buyerName,
          buyerEmail: data.buyerEmail,
          paymentProvider: data.paymentProvider,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || 'Terjadi kesalahan');
        return;
      }

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        router.push('/success');
      }
    } catch {
      toast.error('Gagal membuat pesanan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Checkout</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{productTitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="buyerName">Nama Lengkap</Label>
          <Input id="buyerName" placeholder="Nama Anda" {...register('buyerName')} />
          {errors.buyerName && <p className="text-xs text-destructive">{errors.buyerName.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="buyerEmail">Alamat Email</Label>
          <Input id="buyerEmail" type="email" placeholder="email@contoh.com" {...register('buyerEmail')} />
          {errors.buyerEmail && <p className="text-xs text-destructive">{errors.buyerEmail.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmEmail">Konfirmasi Email</Label>
          <Input id="confirmEmail" type="email" placeholder="Ulangi email" {...register('confirmEmail')} />
          {errors.confirmEmail && <p className="text-xs text-destructive">{errors.confirmEmail.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Metode Pembayaran</Label>
          {availableProviders.length === 0 ? (
            <div className="p-3 rounded-xl border border-dashed border-border bg-secondary/40">
              <p className="text-sm text-muted-foreground">
                Metode pembayaran sedang tidak tersedia. Silakan coba lagi nanti.
              </p>
            </div>
          ) : (
            <RadioGroup
              value={provider}
              onValueChange={(v) => setValue('paymentProvider', v as 'midtrans' | 'xendit')}
              className="grid grid-cols-2 gap-3"
            >
              {availableProviders.map((p) => (
                <label
                  key={p}
                  htmlFor={p}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    provider === p ? 'border-primary bg-accent' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <RadioGroupItem value={p} id={p} />
                  <div>
                    <p className="text-sm font-medium capitalize">{p}</p>
                    <p className="text-xs text-muted-foreground">
                      {p === 'midtrans' ? 'Transfer, QRIS, VA' : 'QRIS, VA, Kartu'}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Harga produk</span>
            <span className="text-sm text-foreground">{formatCurrency(price, currency)}</span>
          </div>
          {adminFee > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Biaya admin</span>
              <span className="text-sm text-foreground">{formatCurrency(adminFee, currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border/70">
            <span className="text-sm font-medium text-foreground">Total Pembayaran</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(total, currency)}</span>
          </div>

          <Button
            type="submit"
            className="w-full gap-2 mt-2"
            size="lg"
            disabled={loading || availableProviders.length === 0}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            {loading ? 'Memproses...' : `Bayar ${formatCurrency(total, currency)}`}
          </Button>
        </div>
      </form>

      <p className="text-xs text-center text-muted-foreground">
        Pembayaran diproses dengan aman. File dikirim otomatis setelah konfirmasi.
      </p>
    </div>
  );
}
