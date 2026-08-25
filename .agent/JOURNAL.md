# JOURNAL.md — Catatan Sesi

> Entri terbaru di ATAS. Satu entri per sesi. Maksimal 12 baris — kalau lebih panjang,
> berarti kamu menulis dokumentasi, bukan jurnal.

## Template (copy ini)

```markdown
## [YYYY-MM-DD] Sesi #N — <judul singkat>

**Dikerjakan:** T1.2, T1.3
**Hasil:** scanner upload 50 lagu, semua status 'uploaded', 180 MB terpakai
**File berubah:** scanner/uploader.py, scanner/tags.py
**Cara tes:** python -m scanner scan --path ./test --dry-run lalu tanpa --dry-run
**Masalah:** FLAC tanpa tag ARTIST bikin KeyError -> difix pakai fallback chain
**Belum selesai:** cover art .m4a masih kosong
**Next:** T1.8
**Commit:** a3f9c21
```

---

## [2026-08-25] Sesi #1 — Selesai Fase 0 (UI & Auth)

**Dikerjakan:** T0.1, T0.2, T0.3, T0.5, T0.6, T0.7
**Hasil:** Setup Supabase dan Vercel selesai. Halaman login dengan desain Vanilla CSS (glassmorphism) dan logika otentikasi menggunakan supabase-js.
**File berubah:** public/css/main.css, public/js/supabase.js, public/js/auth.js, public/index.html, public/login.html, TASKS.md, MEMORY.md
**Cara tes:** Buka localhost:3000, pengguna akan dipaksa ke halaman login jika tidak memiliki sesi.
**Masalah:** Sempat terjadi 404 dari Vercel karena index.html belum ada pada deploy T0.6.
**Belum selesai:** -
**Next:** T1.1 (Fase 1 - Scanner Lokal)
**Commit:** (pending)

---

## [2026-08-25] Sesi #0 — Bootstrap (arsitektur static + Supabase)

**Dikerjakan:** Setup dokumen agen
**Hasil:** AGENTS, MEMORY, JOURNAL, DECISIONS (11 ADR), SPEC, TASKS, DEPLOY,
  schema.sql Postgres+RLS (7 tabel), 5 skill file
**Masalah:** —
**Catatan penting:** Integrasi Spotify API DIBATALKAN. Per Feb 2026, Development Mode
  mewajibkan pemilik app punya Premium, jadi gagal memenuhi syarat "tanpa bayar".
  Diganti import daftar lagu via paste/CSV yang diparse di browser (ADR-001 revisi, ADR-011).
  Akibatnya: folder api/ dihapus, tabel spotify_auth dihapus, service_role key tidak
  dipakai sama sekali. Aplikasi jadi 100% static tanpa secret apa pun.
**Next:** T0.1 — buat project Supabase dan jalankan schema.sql
**Commit:** (pending)
