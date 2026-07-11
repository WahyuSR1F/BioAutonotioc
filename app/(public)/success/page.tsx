import Link from 'next/link';
import { CheckCircle2, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SuccessPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Pembayaran Diterima!</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Terima kasih atas pembelian Anda. File digital sedang diproses dan akan dikirim ke email Anda dalam beberapa menit.
        </p>

        <div className="bg-white rounded-2xl border border-border p-6 text-left mb-8 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Cek email Anda</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Link download berumur 24 jam sudah dikirim ke alamat email yang Anda daftarkan saat checkout.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-orange-600 text-xs font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Tidak menerima email?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cek folder spam/junk. Jika tetap tidak ada dalam 15 menit, hubungi penjual.
              </p>
            </div>
          </div>
        </div>

        <Button asChild variant="outline" className="gap-2">
          <Link href="/">
            Kembali ke Beranda <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
