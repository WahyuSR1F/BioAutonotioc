'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { slugify, formatBytes } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter'),
  description: z.string().optional(),
  price: z.string().refine((v) => Number(v) >= 1000, 'Harga minimal Rp 1.000'),
});

type FormData = z.infer<typeof schema>;

interface ProductFormProps {
  defaultValues?: {
    id: string;
    title: string;
    description: string | null;
    price: number;
    cover_url: string | null;
    is_active: boolean;
  };
  existingFiles?: { id: string; file_name: string; file_size: number | null }[];
}

export default function ProductForm({ defaultValues, existingFiles = [] }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(defaultValues?.cover_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      price: defaultValues?.price?.toString() ?? '',
    },
  });

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setProductFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index: number) {
    setProductFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadCover(): Promise<string | null> {
    if (!coverFile) return null;
    const formData = new FormData();
    formData.append('file', coverFile);
    formData.append('type', 'cover');
    const res = await fetch('/api/uploads', { method: 'POST', body: formData });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal upload cover');
    return result.url as string;
  }

  async function uploadProductFiles(productId: string) {
    for (const file of productFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'file');
      formData.append('productId', productId);
      const res = await fetch('/api/uploads', { method: 'POST', body: formData });
      if (!res.ok) {
        const result = await res.json();
        toast.error(result.error || `Gagal upload ${file.name}`);
        continue;
      }
    }
  }

  async function onSubmit(data: FormData) {
    setLoading(true);

    try {
      const cover_url = await uploadCover();

      if (defaultValues?.id) {
        const res = await fetch(`/api/products/${defaultValues.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            description: data.description || null,
            price: Number(data.price),
            cover_url: cover_url ?? defaultValues.cover_url,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal memperbarui produk');

        await uploadProductFiles(defaultValues.id);
        toast.success('Produk berhasil diperbarui');
        router.push('/dashboard/products');
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            description: data.description || null,
            price: Number(data.price),
            cover_url,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal membuat produk');

        await uploadProductFiles(result.id);

        toast.success('Produk berhasil dibuat & payment link ter-generate otomatis!');
        router.push(`/dashboard/products/${result.id}/links`);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Cover Image */}
      <div className="space-y-2">
        <Label>Cover Produk (opsional)</Label>
        <div
          onClick={() => coverInputRef.current?.click()}
          className="relative aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors overflow-hidden bg-secondary/30 flex items-center justify-center"
        >
          {coverPreview ? (
            <img src={coverPreview} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Klik untuk upload cover</p>
              <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG hingga 5MB</p>
            </div>
          )}
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Judul Produk</Label>
        <Input id="title" placeholder="Contoh: E-book Copywriting Pemula" {...register('title')} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Deskripsi (opsional)</Label>
        <Textarea
          id="description"
          placeholder="Ceritakan isi produk Anda..."
          className="resize-none h-28"
          {...register('description')}
        />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label htmlFor="price">Harga (IDR)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
          <Input id="price" type="number" className="pl-9" placeholder="50000" {...register('price')} />
        </div>
        {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
      </div>

      {/* Product Files */}
      <div className="space-y-2">
        <Label>File Digital Produk</Label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors p-6 text-center"
        >
          <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Klik atau drag & drop file</p>
          <p className="text-xs text-muted-foreground/70 mt-1">PDF, ZIP, RAR, dll — maksimal 4MB per file, akan dikirim ke pembeli</p>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesChange} />

        {existingFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">File tersimpan:</p>
            {existingFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{f.file_name}</span>
                {f.file_size && <span className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</span>}
              </div>
            ))}
          </div>
        )}

        {productFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">File baru:</p>
            {productFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50 text-sm">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => removeFile(i)}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {defaultValues ? 'Simpan Perubahan' : 'Buat Produk'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  );
}
