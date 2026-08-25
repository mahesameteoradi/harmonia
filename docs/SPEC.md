# SPEC.md — Spesifikasi Teknis Harmonia

## 1. Masalah

Player musik pribadi tanpa iklan dan tanpa langganan, bisa diakses dari browser dan HP.
Playlist yang sudah dikurasi di layanan streaming di-import sebagai **daftar teks**,
lalu dicocokkan ke koleksi musik milik user sendiri.

## 2. Non-Goals

Bukan katalog musik. Tidak ada integrasi dengan layanan streaming, tidak ada rekomendasi ML,
tidak ada fitur sosial, tidak ada pembajakan konten berlisensi.

## 3. Arsitektur

```
┌──────────────────────────────────────────────────────┐
│  Browser / HP (PWA)                                  │
│  ├─ parser daftar lagu (paste / upload CSV)          │
│  └─ fuzzy matching (Web Worker)                      │
└───┬──────────────┬──────────────────┬────────────────┘
    │ static       │ metadata + auth  │ audio (signed URL)
    ▼              ▼                  ▼
┌────────┐   ┌──────────────┐   ┌──────────────────┐
│ Vercel │   │  Supabase    │   │ Supabase Storage │
│  CDN   │   │  Postgres    │   │  bucket 'audio'  │
│        │   │  + Auth+RLS  │   │  Range native    │
└────────┘   └──────────────┘   └──────────────────┘

        PC user (tool terpisah)
        scanner CLI ──upload──► Storage + Postgres
```

**Dua aturan tak bisa ditawar:**
1. Audio mengalir dari Storage langsung ke browser, tidak pernah lewat Vercel.
2. Tidak ada backend. Tidak ada folder `api/`. Tidak ada secret di project ini.

## 4. Struktur Repo

```
harmonia/
├── vercel.json
├── package.json              # hanya untuk script injeksi env
├── public/                   # yang dilayani Vercel
│   ├── index.html
│   ├── login.html
│   ├── css/style.css
│   └── js/
│       ├── env.js            # DIBUAT SAAT BUILD, tidak di-commit
│       ├── supabase.js       # inisialisasi client
│       ├── storage.js        # signed URL + cache
│       ├── player.js         # audio engine + queue
│       ├── parser.js         # parse CSV / teks jadi daftar lagu
│       ├── matcher.js        # normalisasi + skoring
│       ├── matcher.worker.js # matching di thread terpisah
│       ├── ui.js
│       └── views/            # library.js, playlist.js, import.js, wishlist.js, usage.js
├── scanner/                  # CLI lokal, TIDAK di-deploy
│   ├── __main__.py
│   ├── tags.py
│   ├── uploader.py
│   └── sync.py
├── db/schema.sql
├── docs/{SPEC,TASKS,DEPLOY}.md
└── .agent/                   # memori agen
```

## 5. Model Data

Tujuh tabel, semuanya dilindungi RLS berbasis `owner = auth.uid()`.
Detail di `db/schema.sql`.

| Tabel | Isi |
|---|---|
| `artists`, `albums`, `tracks` | Library lokal. `tracks.storage_path` menunjuk ke bucket, bukan URL. |
| `playlists`, `playlist_tracks` | Playlist. `track_id` NULL berarti wishlist. |
| `imported_tracks` | Baris hasil parse daftar yang di-paste/upload user. |
| `match_candidates` | Kandidat skor 60–84 yang perlu konfirmasi manual. |

Tidak ada tabel kredensial. Aplikasi tidak menyimpan token pihak ketiga karena tidak
terhubung ke pihak ketiga mana pun.

View `v_tracks` menggabungkan track + artis + album supaya frontend cukup satu query.

## 6. Alur Import Playlist

```
1. User buka halaman Import
2. Pilih salah satu:
   a. Paste daftar lagu (dari Spotify desktop: Ctrl+A lalu Ctrl+C di playlist)
   b. Upload CSV (dari Exportify / TuneMyMusic / Soundiiz)
   c. Ketik manual
3. Parser deteksi format otomatis → tampilkan PREVIEW 5 baris pertama
4. User cek urutan kolom (artis vs judul), bisa klik "Tukar kolom" kalau terbalik
5. User konfirmasi → baris masuk ke imported_tracks
6. Matching berjalan di Web Worker terhadap library lokal
7. Ringkasan: "45 dari 60 ketemu, 8 perlu konfirmasi, 7 belum ada di koleksi"
8. User review kandidat pending → sisanya masuk wishlist
```

Langkah 3–4 tidak boleh dilewati. Menebak urutan kolom lalu menulis 200 baris sampah jauh
lebih menyakitkan daripada satu langkah konfirmasi.

## 7. Format Daftar yang Didukung

Parser mendeteksi dari isi, bukan dari ekstensi:

| Format | Contoh |
|---|---|
| CSV berheader | `Track Name,Artist Name,Album,Duration` |
| URI/URL | `spotify:track:xxx` atau `https://open.spotify.com/track/xxx` |
| Teks `Artis - Judul` | `Queen - Bohemian Rhapsody` |
| Teks bernomor | `1. Queen - Bohemian Rhapsody` |
| Teks dengan bullet | `Bohemian Rhapsody • Queen` |

Karena CSV bisa berasal dari Apple Music, YouTube Music, atau Deezer lewat Soundiiz,
fitur ini otomatis mendukung sumber selain Spotify tanpa kode tambahan.

## 8. Kuota — Batasan Desain

| Sumber daya | Free tier | Implikasi |
|---|---|---|
| Storage | 1 GB, maks 50 MB/file | ~250 lagu MP3 320k · ~1.500 lagu Opus 128k |
| Egress | 5 GB/bulan | ~1.250 putar. Terlampaui → **402, semua layanan berhenti** |
| Database | 500 MB | aman |
| Auto-pause | 7 hari idle | resume manual |

**Strategi hemat yang wajib diterapkan:**
- Scanner menawarkan transcode ke Opus 128k — FLAC 40 MB jadi ~5 MB, kualitas praktis sama.
- Cover di-resize 500×500 q80 (~60 KB), satu per album.
- Bucket `covers` public supaya kena cache CDN.
- Halaman "Usage" menampilkan pemakaian terhadap batas 1 GB.
- `preload="metadata"`, jangan `auto`.

## 9. Jalur Upgrade Kalau Koleksi Melebihi 1 GB

1. **Transcode ke Opus 128k** — gratis, biasanya sudah cukup. 1 GB muat ~1.500 lagu.
2. **Cloudflare R2** untuk audio, Supabase tetap untuk Postgres + Auth. R2 memberi 10 GB
   dengan **egress nol** — untuk streaming musik, egress adalah biaya sesungguhnya.
   Trade-off: signed URL R2 butuh kredensial, artinya harus ada satu serverless function,
   dan arsitektur berhenti menjadi 100% static.
3. **Supabase Pro** $25/bulan — 100 GB storage, 250 GB egress.

Jangan lompat ke opsi 3 sebelum opsi 1 dicoba.

## 10. Target Performa

| Metrik | Target |
|---|---|
| Load halaman library (50 baris) | < 400 ms |
| Time to first audio byte | < 700 ms |
| Parse + matching 100 lagu vs library 5.000 | < 3 detik, UI tidak membeku |
| Upload 100 lagu dari scanner | < 10 menit pada koneksi 10 Mbps |
