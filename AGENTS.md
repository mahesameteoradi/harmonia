# AGENTS.md — Instruksi Utama Agen

> **BACA FILE INI SETIAP KALI SESI BARU DIMULAI. JANGAN DILEWATI.**

---

## 0. Protokol Wajib Setiap Sesi

### Saat sesi DIMULAI

1. Baca `AGENTS.md` (file ini).
2. Baca `.agent/MEMORY.md` — state project. **Sumber kebenaran tunggal.**
3. Baca `docs/TASKS.md` — cari task pertama bertanda `[ ]` atau `[~]`.
4. Baca 2 entri teratas `.agent/JOURNAL.md`.
5. `git log --oneline -10`.
6. Lapor: "Melanjutkan dari Fase X task Y. Rencana: ..." lalu **tunggu konfirmasi user**.

### Saat sesi BERAKHIR / konteks mulai penuh

Hentikan pekerjaan baru, lalu: update `MEMORY.md` → tulis entri `JOURNAL.md` → centang
`TASKS.md` → catat ADR baru kalau ada → `git add -A && git commit`.

---

## 1. Identitas Project

- **Nama:** Harmonia — music player pribadi, tanpa iklan, tanpa langganan
- **Pemilik:** Herman (network engineer, MTM Bali)
- **Deploy:** Frontend static di **Vercel**, data + file di **Supabase**
- **Spec:** `docs/SPEC.md` · **Deploy:** `docs/DEPLOY.md` · **Tugas:** `docs/TASKS.md`

---

## 2. Batasan — TIDAK BOLEH DILANGGAR

Aplikasi ini **tidak terhubung ke layanan streaming mana pun.** Tidak ada API key, tidak
ada OAuth, tidak ada scraping. User membawa daftar lagunya sendiri lewat paste atau upload.

| ❌ DILARANG | Alasan |
|---|---|
| Menambahkan integrasi Spotify Web API | Per Feb 2026, Development Mode mewajibkan pemilik app punya Premium aktif. Gagal memenuhi syarat "tanpa bayar", dan mengembalikan OAuth yang sudah sengaja dibuang. |
| Scraping Spotify atau layanan streaming lain | Melanggar ToS. Endpoint internal berubah tanpa pemberitahuan, deteksi otomatis sedang diperketat, akun berisiko suspend. Rapuh dan tidak berkelanjutan. |
| Download/rip/decrypt audio dari layanan streaming | DRM circumvention. Melanggar ToS dan hak cipta. |
| Library `spotdl`, `librespot`, `zspotify`, `yt-dlp`, `pytube` | Sama seperti di atas. |
| Menambahkan secret apa pun ke project | Arsitektur ini sengaja tidak punya secret. Kalau kamu merasa butuh satu, kemungkinan besar kamu sedang menambahkan sesuatu yang dilarang di baris-baris atas. |

**Sumber daftar lagu yang sah:** clipboard atau file CSV dari export tool yang dijalankan
user sendiri (Exportify, TuneMyMusic, Soundiiz), atau ketikan manual.

**Sumber audio yang sah:** file musik milik user sendiri yang dia upload ke Supabase Storage.

---

## 3. Arsitektur

```
Browser (Vercel CDN, static HTML+JS)
   │
   ├── metadata ──► Supabase Postgres  (supabase-js, dilindungi RLS)
   ├── AUDIO ─────► Supabase Storage   (signed URL, LANGSUNG, bukan lewat Vercel)
   └── import ────► parser di browser  (paste teks / upload CSV)

PC user (terpisah): scanner CLI ──upload──► Storage + Postgres
```

Tidak ada backend. Tidak ada folder `api/`. Vercel murni berfungsi sebagai CDN.

### ⛔ Tiga aturan yang paling sering dilanggar agen

**1. AUDIO TIDAK BOLEH MELEWATI VERCEL.** Jangan pernah membuat endpoint seperti
`/api/stream/<id>`. Supabase Storage **sudah** menangani HTTP Range request secara native.
Frontend memanggil `createSignedUrl()` lalu memasang hasilnya ke `audio.src`. Proxy hanya
menambah latensi, memakan bandwidth Vercel, dan menabrak limit durasi function.

**2. JANGAN MEMBUAT FOLDER `api/`.** Arsitektur 100% static adalah keputusan sadar
(ADR-011), bukan pekerjaan yang belum selesai. Kalau kamu merasa butuh serverless function,
berhenti dan tanya user dulu.

**3. SCANNER TIDAK BISA JALAN DI CLOUD.** Serverless tidak punya akses ke folder musik user
dan tidak punya filesystem persisten. Scanner adalah **CLI Python di PC user**.

---

## 4. Stack — Jangan Diganti Tanpa Izin

| Layer | Teknologi |
|---|---|
| Hosting | Vercel (static saja) |
| Frontend | HTML + CSS + **vanilla JavaScript**, ESM via CDN. Tanpa build step, tanpa React. |
| Database | Supabase Postgres, diakses `@supabase/supabase-js` dari browser |
| Keamanan | **Row Level Security** — wajib, di semua tabel |
| File | Supabase Storage (`audio` private, `covers` public) |
| Auth | Supabase Auth (email + password, single user) |
| Import playlist | Parser JavaScript di browser (CSV + teks biasa) |
| Scanner | Python CLI lokal: `mutagen`, `supabase`, `Pillow` |

---

## 5. Batas Kuota — Ini Memengaruhi Desain

| Sumber daya | Free tier | Artinya |
|---|---|---|
| Supabase storage | 1 GB, maks 50 MB/file | ~250 lagu MP3 320k · ~1.500 lagu Opus 128k |
| Supabase egress | 5 GB/bulan | ~1.250 putar. Terlampaui → **402, semua layanan berhenti** |
| Supabase database | 500 MB | aman untuk puluhan ribu baris |
| Vercel bandwidth | 100 GB | praktis tidak tersentuh |
| Auto-pause | 7 hari idle | resume manual dari dashboard |

**Konsekuensi yang wajib diikuti:**
- Cover di-resize 500×500 q80 sebelum upload, satu per album bukan per lagu.
- Bucket `covers` public supaya kena cache CDN dan tidak memakan egress berulang.
- `preload="metadata"`, jangan `auto`.
- Jangan `select('*')` untuk list — sebutkan kolomnya.
- Sediakan halaman "Usage" yang menampilkan pemakaian terhadap batas 1 GB.

---

## 6. Aturan Ngoding

1. **Edit minimal dan tertarget.** Jangan rewrite file utuh untuk mengubah beberapa baris.
2. **Setiap tabel baru wajib punya RLS policy** di migration yang sama.
3. **Supabase mengembalikan `{data, error}`, tidak melempar exception.** Selalu cek `error`.
4. **Komentar dan teks UI Bahasa Indonesia.** Nama variabel/fungsi Bahasa Inggris.
5. Jangan tambah dependency tanpa mencatat di `DECISIONS.md`.
6. Tes dulu sebelum lapor selesai. "Harusnya jalan" bukan status yang valid.

---

## 7. Skill Library

| Kalau mengerjakan... | Baca dulu |
|---|---|
| Query, RLS, auth, struktur data | `.agent/skills/supabase-data-layer.md` |
| Upload/pemutaran audio, signed URL | `.agent/skills/supabase-storage-audio.md` |
| Scanner lokal, upload batch | `.agent/skills/local-scanner-upload.md` |
| Parser daftar lagu, fuzzy matching | `.agent/skills/playlist-import-matching.md` |
| Player UI, queue, Media Session | `.agent/skills/player-frontend.md` |

Menemukan pola baru yang berulang? Buat skill file baru dan daftarkan di tabel ini.

---

## 8. Definition of Done

- [ ] Kode jalan dan sudah dites manual di browser
- [ ] RLS policy ada untuk tabel/bucket yang disentuh
- [ ] Error handling ada (cek `error` dari setiap panggilan Supabase)
- [ ] `MEMORY.md` dan `JOURNAL.md` sudah di-update
- [ ] Sudah di-commit

---

## 9. Kalau Bingung

Cek `docs/SPEC.md` → cek `.agent/DECISIONS.md` → **tanya user**.

Boleh diputuskan sendiri: nama variabel, struktur folder internal, detail CSS.
Wajib tanya: ganti stack, ubah skema tabel yang sudah berisi data, tambah dependency berat,
menambahkan integrasi layanan eksternal apa pun.
