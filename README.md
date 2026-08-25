# Harmonia

Music player pribadi. Frontend static di Vercel, data dan file di Supabase.
Tanpa iklan, tanpa langganan, tanpa backend.

---

## Cara kerjanya

```
Koleksi musik di PC  ──scanner CLI──►  Supabase Storage
Daftar lagu (CSV/paste) ──parser di browser──►  fuzzy match ke koleksi
Browser ──signed URL──►  Supabase Storage  (audio, langsung, tanpa perantara)
```

Playlist masuk dengan cara kamu mem-paste atau meng-upload daftar lagunya sendiri.
Aplikasi ini tidak terhubung ke Spotify, YouTube Music, atau layanan streaming mana pun —
tidak ada API key, tidak ada OAuth, tidak ada scraping.

---

## Mulai dari mana

1. **`KICKOFF_PROMPT.md`** — prompt siap tempel untuk Antigravity. Baca ini duluan.
2. **`docs/DEPLOY.md`** — setup Supabase + Vercel, urut dan tidak boleh dilompati.
3. **`docs/TASKS.md`** — papan tugas 4 fase yang akan dikerjakan agen.

---

## Isi folder

| Path | Isi |
|---|---|
| `AGENTS.md` | Aturan kerja agen. Dibaca otomatis oleh Antigravity karena ada di root. |
| `.agent/MEMORY.md` | State project — memori persisten agen |
| `.agent/JOURNAL.md` | Log per sesi |
| `.agent/DECISIONS.md` | 11 ADR yang sudah final |
| `.agent/skills/` | 5 skill file berisi pola kode yang sudah terbukti |
| `docs/SPEC.md` | Arsitektur dan spesifikasi teknis |
| `docs/DEPLOY.md` | Panduan setup Supabase + Vercel |
| `docs/TASKS.md` | Papan tugas berfase |
| `db/schema.sql` | Skema Postgres: 7 tabel + RLS + storage policy |
| `public/` | Frontend static (diisi agen di Fase 2–3) |
| `scanner/` | CLI Python lokal (diisi agen di Fase 1) — tidak ikut di-deploy |
| `scripts/inject-env.js` | Menyuntik 2 env var ke frontend saat build |

---

## Empat aturan yang tidak boleh dilanggar

1. **Tidak ada folder `api/`.** Aplikasi 100% static — keputusan sadar, bukan pekerjaan
   yang belum selesai.
2. **Audio tidak pernah melewati Vercel.** Supabase Storage sudah menangani HTTP Range
   secara native. Frontend memanggil `createSignedUrl()` lalu memasangnya ke `audio.src`.
3. **Tidak ada integrasi layanan streaming.** Baik API resmi maupun scraping. Playlist
   masuk lewat paste atau CSV.
4. **Setiap tabel wajib punya RLS policy.** Anon key ada di frontend dan itu disengaja —
   yang melindungi data adalah RLS, bukan kerahasiaan key.

Alasan lengkap dan alternatif yang ditolak ada di `.agent/DECISIONS.md`.

---

## Cara mendapatkan daftar lagu

| Sumber | Caranya |
|---|---|
| Spotify desktop | Buka playlist → `Ctrl+A` → `Ctrl+C` → paste ke halaman Import |
| Exportify | exportify.net → login → Export → upload CSV-nya |
| TuneMyMusic / Soundiiz | Pilih playlist → export CSV |
| Apple Music, YouTube Music, Deezer | Lewat Soundiiz atau TuneMyMusic, hasilnya CSV |
| Manual | Ketik `Artis - Judul`, satu baris per lagu |

---

## Batas kuota yang memengaruhi desain

| Sumber daya | Free tier | Artinya |
|---|---|---|
| Supabase storage | 1 GB, maks 50 MB/file | ~250 lagu MP3 320k · ~1.500 lagu Opus 128k |
| Supabase egress | 5 GB/bulan | ~1.250 putar. Terlampaui → 402, semua layanan berhenti |
| Auto-pause | 7 hari idle | Resume manual dari dashboard Supabase |

Kalau koleksi melebihi 1 GB, coba transcode ke Opus dulu (task T1.9) sebelum
mempertimbangkan Cloudflare R2 atau upgrade berbayar. Lihat `docs/SPEC.md` §9.

---

## Yang perlu diinstal

Node.js 18+, Git, dan Python 3.11+ (Python baru dibutuhkan mulai Fase 1).
Tidak perlu Laragon, XAMPP, atau web server lokal apa pun.

---

## Catatan untuk pengguna Windows

Folder `.agent` diawali titik. Kalau tidak terlihat di File Explorer setelah ekstrak,
aktifkan **View → Show → Hidden items**. Folder itu wajib ada — di situlah memori
agen disimpan.
