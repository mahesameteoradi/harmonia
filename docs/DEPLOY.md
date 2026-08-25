# DEPLOY.md — Setup Supabase + Vercel

Dua layanan, dua env var. Tidak ada API key pihak ketiga, tidak ada OAuth.

---

## 1. Supabase

1. supabase.com → New Project. Region **Southeast Asia (Singapore)** — paling dekat dari
   Bali, selisih latensinya terasa untuk streaming.
2. Simpan **Database Password** yang muncul. Tidak bisa dilihat lagi setelah ini.
3. SQL Editor → New Query → tempel seluruh isi `db/schema.sql` → Run.
   Harus selesai tanpa error. Kalau blok RLS gagal, **jangan dilanjutkan** — tabel tanpa
   policy berarti data kamu terbuka.
4. Storage → New Bucket, buat dua:

   | Nama | Public? | Isi |
   |---|---|---|
   | `audio` | ❌ **Private** | file musik, diakses via signed URL |
   | `covers` | ✅ **Public** | cover art, supaya kena cache CDN |

5. Authentication → Users → Add User. Isi email + password kamu sendiri.
6. Authentication → Providers → Email → **matikan "Enable Sign Ups"**.
   Ini aplikasi pribadi; tidak ada alasan orang lain bisa mendaftar.
7. Project Settings → API. Catat dua nilai:
   - **Project URL**
   - **`anon` public key**

   Key ketiga (`service_role`) **tidak dipakai sama sekali** di project ini. Jangan disalin
   ke mana pun.

---

## 2. Vercel

1. Push repo ke GitHub, lalu Vercel → Add New Project → Import.
2. Framework Preset: **Other**. Build Command: `npm run build`. Output Directory: `public`.
3. Settings → Environment Variables, dua saja, scope **Build + Runtime**:

   | Nama | Nilai |
   |---|---|
   | `SUPABASE_URL` | Project URL dari langkah 1.7 |
   | `SUPABASE_ANON_KEY` | anon public key dari langkah 1.7 |

4. Deploy.

### Kenapa anon key boleh publik

Anon key memang dirancang untuk berada di frontend. Yang melindungi data adalah
**Row Level Security** di Postgres, bukan kerahasiaan key. Tanpa login, key itu tidak
bisa membaca apa pun; setelah login, RLS membatasi tiap user pada barisnya sendiri.

`scripts/inject-env.js` menulis kedua nilai itu ke `public/js/env.js` saat build. File itu
masuk `.gitignore` dan dibuat ulang tiap deploy.

---

## 3. Verifikasi

```
□ Buka URL Vercel → halaman login muncul
□ Login dengan user dari langkah 1.5 → masuk ke library kosong
□ Repo tidak punya folder api/ sama sekali
□ Jalankan scanner lokal untuk 5 lagu → muncul di library
□ Putar satu lagu → geser seek bar ke menit terakhir → langsung bunyi
□ DevTools → Network → request audio menuju *.supabase.co, BUKAN *.vercel.app
□ Buka dari HP → kontrol play/pause muncul di lockscreen
□ Paste daftar 10 lagu di halaman Import → preview muncul sebelum tersimpan
```

Baris keenam adalah pengecekan arsitektur paling penting. Kalau request audio mengarah ke
domain Vercel, ada proxy yang tidak seharusnya ada.

---

## 4. Development lokal

```bash
npm i -g vercel
vercel env pull .env.local      # tarik env var dari dashboard
vercel dev                      # http://localhost:3000
```

Karena tidak ada serverless function, `vercel dev` sebenarnya hanya melayani file static.
Server static apa pun bisa dipakai kalau kamu lebih suka:

```bash
npm run build && npx serve public
```

Scanner dijalankan terpisah:

```bash
pip install -r requirements-scanner.txt
python -m scanner login
python -m scanner scan --path "D:/Musik" --dry-run
```

---

## 5. Cara mendapatkan daftar lagu untuk di-import

Dokumentasikan ini juga di UI aplikasi (task T3.15):

| Sumber | Caranya |
|---|---|
| Spotify desktop | Buka playlist → `Ctrl+A` → `Ctrl+C` → paste ke halaman Import |
| Exportify | exportify.net → login → Export → upload CSV-nya |
| TuneMyMusic / Soundiiz | Pilih playlist → export CSV |
| Apple Music, YouTube Music, Deezer | Lewat Soundiiz atau TuneMyMusic, hasilnya CSV |
| Manual | Ketik `Artis - Judul` satu baris per lagu |

Semua jalur ini dijalankan oleh kamu sendiri dengan akunmu sendiri. Aplikasi Harmonia
tidak pernah berkomunikasi dengan layanan mana pun.

---

## 6. Kalau ada yang rusak

| Gejala | Penyebab paling umum |
|---|---|
| Tabel tampak kosong padahal ada datanya | RLS aktif tanpa policy, atau user belum login |
| `42501 permission denied` | Policy kurang untuk operasi itu (select vs insert terpisah) |
| Audio 400/403 | Signed URL kedaluwarsa, atau path tidak diawali UUID user |
| Semua request tiba-tiba 402 | Kuota egress habis — cek Dashboard → Usage |
| Aplikasi mati total setelah ditinggal seminggu | Project free auto-pause. Resume dari dashboard. |
| Import CSV menghasilkan kolom terbalik | Klik "Tukar kolom" di preview sebelum konfirmasi |
| Build gagal `SUPABASE_URL belum di-set` | Env var belum diberi scope **Build**, baru Runtime |
