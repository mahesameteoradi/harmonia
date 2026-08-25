# TASKS.md — Papan Tugas

**Legenda:** `[ ]` belum · `[~]` dikerjakan · `[x]` selesai & tercommit · `[!]` blocked

> Kerjakan **satu task sampai tuntas** sebelum pindah. Jangan lompat fase.
> `[~]` → `[x]` hanya kalau semua syarat Definition of Done (`AGENTS.md` §8) terpenuhi.

---

## Fase 0 — Infrastruktur (1 sesi)

- [x] **T0.1** — `docs/DEPLOY.md` langkah 1: buat project Supabase, jalankan `schema.sql`, verifikasi 7 tabel + RLS aktif
- [x] **T0.2** — Buat bucket `audio` (private) dan `covers` (public) + policy-nya
- [x] **T0.3** — Buat user lewat Dashboard, **matikan public signup**
- [x] **T0.4** — `git init`, `.gitignore` (`public/js/env.js`, `.env*`, `venv/`, `__pycache__/`, `node_modules/`, `media/`)
- [x] **T0.5** — Verifikasi `scripts/inject-env.js` + `package.json` + `vercel.json` sudah benar
- [x] **T0.6** — Deploy kosong ke Vercel, set `SUPABASE_URL` dan `SUPABASE_ANON_KEY`
- [x] **T0.7** — `public/login.html` + auth flow → login berhasil dan sesi bertahan setelah refresh

**Gate:** bisa login di URL Vercel. Tidak ada folder `api/` di repo.

---

## Fase 1 — Scanner Lokal (2–3 sesi)

> Baca dulu: `.agent/skills/local-scanner-upload.md`

- [ ] **T1.1** — `scanner/auth.py`: login sekali, simpan session ke `~/.harmonia/session.json` (chmod 600)
- [ ] **T1.2** — `scanner/tags.py`: baca metadata via mutagen dengan fallback chain lengkap
- [ ] **T1.3** — `file_hash` = md5(1MB pertama + filesize), lihat ADR-004
- [ ] **T1.4** — **Preflight**: total ukuran, tandai file > 50 MB, bandingkan sisa kuota, tolak kalau melebihi
- [ ] **T1.5** — `--dry-run` yang benar-benar tidak menyentuh jaringan
- [ ] **T1.6** — Upsert `artists` → `albums` → `tracks` dengan status `pending`
- [ ] **T1.7** — Upload audio ke Storage (4 worker, retry backoff) → update status `uploaded`
- [ ] **T1.8** — Ekstrak cover, resize 500×500 q80, upload ke `covers` — satu per album
- [ ] **T1.9** — Opsi `--transcode opus` via ffmpeg lokal untuk file yang melebihi 50 MB
- [ ] **T1.10** — `python -m scanner status`: pemakaian storage vs kuota 1 GB
- [ ] **T1.11** — `python -m scanner cleanup`: hapus baris `pending` yang filenya tidak ada di Storage

**Gate:** scan 50 lagu, semuanya berstatus `uploaded`. Rescan kedua tidak menduplikasi.

---

## Fase 2 — Player (3–5 sesi)

> Baca dulu: `.agent/skills/supabase-storage-audio.md` dan `.agent/skills/player-frontend.md`
>
> ⚠️ Tidak ada task "bikin endpoint streaming" di fase ini, dan tidak akan pernah ada.
> Supabase Storage sudah menangani Range request.

- [ ] **T2.1** — `public/js/supabase.js` + `storage.js` (signed URL, cache Map, batch `createSignedUrls`)
- [ ] **T2.2** — `index.html`: shell single-page (sidebar, main, player bar bawah)
- [ ] **T2.3** — Render library dari view `v_tracks`, paginated `.range()` 50 baris
- [ ] **T2.4** — Kelas `Player`: play, pause, next, prev, seek, volume
- [ ] **T2.5** — Queue: shuffle (Fisher-Yates), repeat off/all/one
- [ ] **T2.6** — Progress bar draggable (abaikan `timeupdate` selama drag)
- [ ] **T2.7** — **Pemulihan signed URL kedaluwarsa**: tangani `MEDIA_ERR_NETWORK`, buat URL baru, lanjut dari `currentTime`
- [ ] **T2.8** — Prefetch URL lagu berikutnya (URL saja, bukan audionya)
- [ ] **T2.9** — Search dengan debounce 300ms → RPC `search_tracks`
- [ ] **T2.10** — Media Session API (metadata + action handler)
- [ ] **T2.11** — Playlist lokal: buat, tambah, hapus, reorder via RPC `reorder_playlist`
- [ ] **T2.12** — Halaman **Usage**: total storage terpakai, jumlah lagu, peringatan mendekati 1 GB
- [ ] **T2.13** — CSS: layout responsif, tema gelap, cover besar di player bar

**Gate:** dipakai mendengarkan musik 1 jam penuh dari HP. Cek Network: request audio menuju
`*.supabase.co`, bukan `*.vercel.app`.

---

## Fase 3 — Import Daftar Lagu (2–3 sesi)

> Baca dulu: `.agent/skills/playlist-import-matching.md`
>
> ⚠️ Tidak ada OAuth, tidak ada API key, tidak ada serverless function di fase ini.
> Semuanya berjalan di browser.

- [ ] **T3.1** — Halaman Import: textarea untuk paste + drop zone untuk file CSV
- [ ] **T3.2** — `parser.js`: deteksi format otomatis (CSV berheader / URI / teks biasa)
- [ ] **T3.3** — Parser CSV yang benar — tangani field berkutip yang mengandung koma, BOM, dan `\r\n`
- [ ] **T3.4** — Pencocokan kolom berbasis pola (`Track Name`, `Title`, `Song`, `Artist Name`, dst)
- [ ] **T3.5** — Normalisasi durasi: `"3:45"`, detik, dan milidetik → ms
- [ ] **T3.6** — **Preview 5 baris + tombol "Tukar kolom"** sebelum import dieksekusi
- [ ] **T3.7** — Simpan hasil konfirmasi ke `imported_tracks`
- [ ] **T3.8** — `matcher.js`: normalisasi + skor Sørensen–Dice `title*0.6 + artist*0.4`
- [ ] **T3.9** — Tie-breaker durasi (< 3 detik → +3, > 30 detik → −10)
- [ ] **T3.10** — Pre-filter berbasis token index supaya tidak O(n×m)
- [ ] **T3.11** — Pindahkan matching ke Web Worker + progress bar
- [ ] **T3.12** — Terapkan ambang: ISRC → ≥85 auto → 60-84 pending → <60 wishlist (ADR-005)
- [ ] **T3.13** — UI review kandidat `pending` (top-3 per lagu, klik untuk memilih)
- [ ] **T3.14** — Halaman wishlist + export CSV
- [ ] **T3.15** — Panduan di UI: cara mendapatkan daftar dari Spotify desktop, Exportify, TuneMyMusic

**Gate:** import CSV asli 50+ lagu dan paste teks dari Spotify desktop, keduanya berhasil.
Ringkasan match masuk akal. UI tidak membeku saat matching.

---

## Fase 4 — Polish (opsional)

- [ ] **T4.1** — PWA: `manifest.json` + service worker, bisa "Add to Home Screen"
- [ ] **T4.2** — Cache audio offline via service worker (batasi kuota)
- [ ] **T4.3** — Statistik dengar (play count, top artist) dengan Chart.js
- [ ] **T4.4** — Keyboard shortcut (spasi, panah kiri/kanan)
- [ ] **T4.5** — Cron ringan untuk mencegah auto-pause project free
- [ ] **T4.6** — Export playlist lokal ke CSV (kebalikan dari import)
- [ ] **T4.7** — Migrasi audio ke Cloudflare R2 kalau koleksi melebihi 1 GB (lihat SPEC §9)
