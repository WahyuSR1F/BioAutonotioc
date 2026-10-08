'use client';

import Link from 'next/link';
import {
  Zap,
  Package,
  Mail,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Zap,
    title: 'Pengiriman Instan',
    desc: 'Pembeli langsung terima file digital via email begitu pembayaran dikonfirmasi — tanpa intervensi manual.',
  },
  {
    icon: Shield,
    title: 'Webhook Terverifikasi',
    desc: 'Setiap notifikasi pembayaran dari Midtrans & Xendit diverifikasi HMAC sebelum diproses.',
  },
  {
    icon: Package,
    title: 'Multi-Produk',
    desc: 'Kelola e-book, template Canva, preset, source code — semua dalam satu dashboard.',
  },
  {
    icon: Link2,
    title: 'Add-on Link Bio',
    desc: 'Tidak mengganti Linktree atau Saweria. Bekerja sebagai pelengkap di belakang layar.',
  },
  {
    icon: Mail,
    title: 'Signed Download URL',
    desc: 'Link unduhan berumur 24 jam — aman dari penyebaran ilegal, langsung ke email pembeli.',
  },
  {
    icon: BarChart3,
    title: 'Analitik Penjualan',
    desc: 'Pantau total revenue, jumlah pesanan, dan produk terlaris dalam satu layar.',
  },
];

const steps = [
  { num: '01', title: 'Upload Produk', desc: 'Tambah file digital + set harga, lalu generate payment link.' },
  { num: '02', title: 'Pasang di Bio', desc: 'Salin link ke Linktree, Saweria, atau platform bio lainnya.' },
  { num: '03', title: 'Pembeli Bayar', desc: 'Pembeli checkout via Midtrans atau Xendit — proses aman.' },
  { num: '04', title: 'Auto Kirim', desc: 'BioAutomate otomatis kirim signed URL ke email pembeli.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-foreground text-lg tracking-tight">BioAutomate</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Fitur</a>
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cara Kerja</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Masuk</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Mulai Gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 text-primary border-primary/20 bg-primary/5">
            Add-on Otomasi Produk Digital
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-[1.1] tracking-tight mb-6">
            Kirim Produk Digital<br />
            <span className="text-primary">Otomatis ke Pembeli</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            BioAutomate memantau notifikasi pembayaran dari Midtrans & Xendit, lalu langsung mengirimkan e-book, template, atau source code ke email pembeli — tanpa satu pun langkah manual.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2 h-12 px-8 text-base" asChild>
              <Link href="/signup">
                Mulai Sekarang <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <Link href="#how">Lihat Cara Kerja</Link>
            </Button>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="max-w-5xl mx-auto mt-20">
          <div className="rounded-2xl border border-border shadow-2xl shadow-primary/5 overflow-hidden bg-white">
            <div className="bg-secondary/50 px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-muted-foreground ml-2">dashboard.bioautomate.id</span>
            </div>
            <div className="grid grid-cols-3 gap-0 divide-x divide-border min-h-[300px]">
              <div className="p-6 col-span-1 bg-[hsl(var(--sidebar-bg))]">
                <div className="space-y-1">
                  {['Dashboard', 'Produk', 'Pesanan', 'Pengiriman', 'Pengaturan'].map((item, i) => (
                    <div key={item} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-primary text-white' : 'text-muted-foreground'}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-2 p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Revenue', val: 'Rp 4.200.000', change: '+12%' },
                    { label: 'Pesanan Hari Ini', val: '8', change: '+3' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-semibold mt-1">{s.val}</p>
                      <p className="text-xs text-green-600 mt-1">{s.change} hari ini</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">PENGIRIMAN TERBARU</p>
                  <div className="space-y-2">
                    {[
                      { email: 'buyer@gmail.com', product: 'E-book Copywriting', status: 'Terkirim' },
                      { email: 'user@yahoo.com', product: 'Template Canva Pro', status: 'Terkirim' },
                      { email: 'dev@outlook.com', product: 'Source Code Next.js', status: 'Pending' },
                    ].map((d) => (
                      <div key={d.email} className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium">{d.email}</span>
                          <span className="text-muted-foreground ml-2">{d.product}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${d.status === 'Terkirim' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Semua yang Anda butuhkan</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">Platform yang dirancang untuk creator digital Indonesia yang ingin otomatisasi penuh.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Cara kerjanya sederhana</h2>
            <p className="text-lg text-muted-foreground">Setup sekali, jalan selamanya.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {steps.map((step) => (
              <div key={step.num} className="flex gap-5 p-6 rounded-2xl border border-border hover:border-primary/30 transition-colors">
                <span className="text-3xl font-bold text-primary/20 leading-none shrink-0">{step.num}</span>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-primary">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Mulai otomatisasi hari ini</h2>
          <p className="text-primary-foreground/80 text-lg mb-8">Daftar gratis, upload produk pertama Anda, dan biarkan BioAutomate bekerja untuk Anda.</p>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base gap-2" asChild>
            <Link href="/signup">
              Buat Akun Gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">BioAutomate</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Webhook Midtrans & Xendit
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-2" />
            Turso Database
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-2" />
            Email via Resend
          </div>
          <p className="text-xs text-muted-foreground">&copy; 2024 BioAutomate</p>
        </div>
      </footer>
    </div>
  );
}
