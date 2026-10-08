=== CARA DEPLOY VERCEL ===
==========================

Langkah 1: Persiapan di Local
---------------------
1. Pastikan .env.local sudah benar:
   - MIDTRANS_SERVER_KEY=your-actual-key (belum diisi = oke, akan dicek di code)
   - MIDTRANS_ENVIRONMENT=SANDBOX (untuk test)

2. Jalankan build untuk pastikan lancar:
   npm run build

Langkah 2: Install Vercel CLI
----------------------------
npm i -g vercel   # atau npx vercel

Langkah 3: Login ke Vercel
----------------------------
vercel login
# Akan terbuka browser, login dengan akun Vercel Anda

Langkah 4: Deploy Project
--------------------------
vercel
# Atau untuk production:
vercel --prod

Langkah 5: Set Environment Variables di Dashboard Vercel
--------------------------------------------------------
Setelah deploy, pergi ke:
https://vercel.com/dashboard -> pilih project -> Settings -> Environment Variables

Tambahkan variables berikut (PASTIikan nilai sesuai):

⚠️ PENTING: Variable dengan prefix NEXT_PUBLIC_ akan langsung ter-exposed ke browser (client)
⚠️ Variable tanpa prefix hanya tersedia di server (server-side only)

1. TURSO_DATABASE_URL = libsql://your-db.turso.io  ← PASTI tanpa prefix NEXT_PUBLIC_
2. TURSO_AUTH_TOKEN = your-turso-auth-token  ← PASTI tanpa prefix NEXT_PUBLIC_
3. AUTH_SECRET = random-string-panjang-min-32-karakter  ← PASTI tanpa prefix NEXT_PUBLIC_
4. MIDTRANS_SERVER_KEY = your-midtrans-server-key  ← PASTI tanpa prefix NEXT_PUBLIC_
5. MIDTRANS_ENVIRONMENT = SANDBOX (untuk test) atau PRODUCTION (live)
6. NEXT_PUBLIC_APP_URL = https://your-app.vercel.app  (atau http://localhost:3000 untuk local)
7. RESEND_API_KEY = your-resend-api-key  ← untuk kirim email delivery

Langkah 7: Konfigurasi Midtrans Dashboard
-----------------------------------------
1. Masuk ke dashboard Midtrans: https://app.midtrans.com/
2. Pilih project Anda
3. Menu: Settings -> Notifications -> Webhook URL
4. Masukkan URL:
   - Production: https://your-app.vercel.app/api/webhooks/midtrans
   - Atau testing: http://localhost:3000/api/webhooks/midtrans

5. Save konfigurasi

Langkah 8: Test setelah Deploy
-------------------------------
1. Buka URL aplikasi Vercel
2. Buat produk dan lakukan checkout
3. Pilot pembayaran melalui Midtrans Sandbox
4. Cek apakah order status berubah ke "paid" di dashboard
5. Cek apakah file produk terkirim via email

==========================
CATATAN PENTING:
- Build Command: npm run build
- Output Directory: .next (default)
- Framework: Next.js 13.5.1 (App Router)
- Semua check (build, typecheck, lint) sudah lulus di lokal

Jika ada error saat deploy, cek:
1. Environment variables sudah benar di Vercel Dashboard
2. MIDTRANS_SERVER_KEY tidak boleh kosong di production (code akan error)
3. Webhook URL di Midtrans sudah sesuai dengan domain Vercel