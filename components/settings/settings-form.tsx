'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, User, Webhook, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';

const profileSchema = z.object({
  display_name: z.string().min(2, 'Nama minimal 2 karakter'),
  bio: z.string().max(200, 'Bio maksimal 200 karakter').optional(),
  store_slug: z
    .string()
    .min(3, 'Slug minimal 3 karakter')
    .regex(/^[a-z0-9-]+$/, 'Hanya huruf kecil, angka, dan tanda hubung')
    .optional()
    .or(z.literal('')),
});

type ProfileData = z.infer<typeof profileSchema>;

interface Props {
  profile: {
    display_name: string | null;
    email: string;
    bio: string | null;
    store_slug: string | null;
  };
}

export default function SettingsForm({ profile }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      bio: profile.bio ?? '',
      store_slug: profile.store_slug ?? '',
    },
  });

  async function onSubmit(data: ProfileData) {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sesi habis'); setLoading(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: data.display_name,
        bio: data.bio || null,
        store_slug: data.store_slug || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Profil berhasil disimpan');
  }

  return (
    <div className="space-y-8">
      {/* Profile */}
      <section className="bg-white rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="font-semibold text-foreground">Profil Creator</h2>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-secondary/50" />
            <p className="text-xs text-muted-foreground">Email tidak dapat diubah</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Nama Tampilan</Label>
            <Input id="display_name" {...register('display_name')} />
            {errors.display_name && <p className="text-xs text-destructive">{errors.display_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store_slug">Slug Toko (opsional)</Label>
            <div className="flex items-center">
              <span className="px-3 h-10 flex items-center text-sm text-muted-foreground bg-secondary border border-r-0 border-border rounded-l-lg">
                /store/
              </span>
              <Input id="store_slug" className="rounded-l-none" placeholder="nama-toko-anda" {...register('store_slug')} />
            </div>
            {errors.store_slug && <p className="text-xs text-destructive">{errors.store_slug.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio (opsional)</Label>
            <Textarea id="bio" className="resize-none h-20" placeholder="Ceritakan tentang Anda..." {...register('bio')} />
            {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Simpan Profil
          </Button>
        </form>
      </section>

      {/* Webhook Info */}
      <section className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Webhook className="w-4 h-4 text-orange-600" />
          </div>
          <h2 className="font-semibold text-foreground">Konfigurasi Webhook</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Daftarkan URL webhook berikut ke dashboard Midtrans dan Xendit Anda.
        </p>
        <div className="space-y-3">
          {[
            { label: 'Midtrans Notification URL', path: '/api/webhooks/midtrans' },
            { label: 'Xendit Callback URL', path: '/api/webhooks/xendit' },
          ].map((w) => (
            <div key={w.path} className="space-y-1">
              <Label className="text-xs">{w.label}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-secondary/50 border border-border rounded-lg px-3 py-2.5 font-mono text-muted-foreground overflow-x-auto">
                  {process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}{w.path}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}${w.path}`);
                    toast.success('Disalin!');
                  }}
                >
                  Salin
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* API Keys Info */}
      <section className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <Key className="w-4 h-4 text-green-600" />
          </div>
          <h2 className="font-semibold text-foreground">Environment Variables</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Pastikan variabel berikut sudah dikonfigurasi di file <code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">.env</code> Anda:
        </p>
        <div className="space-y-2">
          {[
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY',
            'MIDTRANS_SERVER_KEY',
            'XENDIT_CALLBACK_TOKEN',
            'RESEND_API_KEY',
            'NEXT_PUBLIC_APP_URL',
          ].map((key) => (
            <div key={key} className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              {key}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
