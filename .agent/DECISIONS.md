# DECISIONS.md — Catatan Keputusan Arsitektur (ADR)

> Setiap keputusan teknis yang tidak jelas jawabannya dicatat di sini beserta
> **alternatif yang ditolak dan alasannya**, supaya sesi berikutnya tidak
> memperdebatkan ulang hal yang sudah selesai.

---

## ADR-001 — Tidak ada integrasi ke layanan streaming ⭐

**Konteks.** Tujuan awal: player musik tanpa iklan dan tanpa langganan, dengan playlist
yang sudah dikurasi di Spotify.

**Riwayat.** Rencana awal memakai Spotify Web API resmi untuk mengambil metadata playlist.
Rencana itu **dibatalkan** setelah diketahui bahwa per Februari 2026 Spotify mengubah
aturan Development Mode: pemilik app wajib punya langganan Premium aktif, app berhenti
bekerja kalau langganan lapse, satu Client ID per developer, dan maksimal lima authorized
user. Akun free tier dikecualikan sepenuhnya. Ini membuat jalur resmi gagal memenuhi
syarat "tanpa bayar".

**Keputusan.** Aplikasi **tidak terhubung ke layanan streaming mana pun**. User membawa
daftar lagunya sendiri lewat paste clipboard atau upload CSV, yang diparse di browser.

**Alternatif ditolak:**
- *Spotify Web API resmi* — mewajibkan Premium sejak Feb 2026. Gagal memenuhi tujuan.
- *Scraping Spotify atau YouTube Music* (termasuk `ytmusicapi`) — melanggar ToS, endpoint
  internal berubah tanpa pemberitahuan, deteksi otomatis sedang diperketat, akun berisiko
  suspend. Waktu perawatannya melebihi manfaatnya.
- *YouTube Data API v3* — untuk video, tidak memberikan URL audio. Tetap butuh `yt-dlp`
  untuk audionya, jadi bukan jalan memutar melainkan kembali ke titik yang sama.
- *AdGuard untuk melewati iklan* — salah alat. AdGuard adalah filter DNS/proxy di perangkat
  yang memblokir request pada klien resmi. Aplikasi ini bukan klien YouTube dan tidak punya
  request iklan untuk diblokir; tidak ada mekanisme untuk "menyisipkan" AdGuard ke dalamnya.

**Konsekuensi.** Positif dan cukup besar: folder `api/` dihapus, tabel `spotify_auth`
dihapus, `service_role` key tidak dipakai sama sekali, OAuth hilang. Aplikasi menjadi
100% static tanpa satu pun secret. Sebagai bonus, import CSV otomatis mendukung sumber
selain Spotify (Apple Music, YouTube Music, Deezer lewat Soundiiz/TuneMyMusic) tanpa
kode tambahan.

---

## ADR-002 — Vanilla JavaScript tanpa build step

**Keputusan.** HTML + CSS + vanilla JS, import supabase-js lewat ESM CDN. Satu-satunya
langkah build adalah `inject-env.js` yang menulis dua konstanta.

**Alternatif ditolak:** Next.js/React — menambah build pipeline dan node_modules ratusan MB
untuk aplikasi yang isinya satu halaman dengan satu elemen `<audio>`. User juga sudah
sangat produktif dengan vanilla JS.

---

## ADR-004 — Identitas file pakai hash parsial

**Keputusan.** `file_hash` = MD5 dari 1 MB pertama file + ukuran file. `unique(owner, file_hash)`.

**Alternatif ditolak:** hash seluruh file (lambat — 10.000 lagu = puluhan menit);
path sebagai identitas (rename folder = seluruh library terduplikasi).

---

## ADR-005 — Threshold fuzzy matching

**Keputusan.** Normalisasi → skor `title*0.6 + artist*0.4` (Sørensen–Dice atas token).
ISRC cocok → 100. Skor ≥85 auto-match. 60–84 pending konfirmasi. <60 wishlist.
Tie-breaker durasi: selisih < 3 detik → +3, selisih > 30 detik → −10.

**Alternatif ditolak:** ISRC saja — paling akurat tapi mayoritas file lokal dan sebagian
besar export CSV tidak menyertakan ISRC. Tetap dipakai sebagai jalur cepat kalau ada.

---

## ADR-006 — Audio tidak melewati Vercel ⭐

**Keputusan.** Frontend memanggil `createSignedUrl()` dan memasang hasilnya langsung ke
`audio.src`. Tidak ada proxy.

**Alternatif ditolak:** *proxy lewat serverless function* — Vercel Hobby membatasi durasi
function 60 detik sehingga lagu 6 menit terpotong; memakan kuota bandwidth Vercel yang
seharusnya tidak tersentuh; melipatgandakan latensi; dan Supabase Storage **sudah**
menangani HTTP Range secara native, jadi proxy tidak menambah apa pun.

**Konsekuensi.** Seluruh kode streaming manual menjadi tidak perlu — satu fase penuh hilang
dari roadmap. Sebagai gantinya muncul kebutuhan menangani signed URL yang kedaluwarsa di
tengah pemutaran (T2.7).

---

## ADR-007 — Scanner jalan di PC user, bukan di cloud

**Keputusan.** Scanner adalah CLI Python yang dijalankan user di komputernya.
Tugasnya: baca tag → hitung hash → upload ke Storage → upsert metadata ke Postgres.

**Alternatif ditolak:** *scanner sebagai serverless function* — serverless tidak punya akses
ke filesystem user dan tidak punya storage persisten. Secara teknis mustahil, bukan sekadar
tidak disarankan.

**Konsekuensi.** `scanner/` tidak ikut di-deploy, punya `requirements-scanner.txt` sendiri.
Keuntungan tak terduga: transcoding ffmpeg bisa dilakukan lokal secara gratis.

---

## ADR-008 — RLS sebagai satu-satunya lapisan otorisasi

**Konteks.** Frontend static bicara langsung ke Postgres. Tidak ada backend yang bisa
memvalidasi request.

**Keputusan.** Semua tabel mengaktifkan RLS dengan policy `owner = auth.uid()`. Anon key
boleh berada di frontend karena memang dirancang publik.

**Alternatif ditolak:** *API layer sendiri untuk semua query* — menambah latensi dan
kompleksitas untuk sesuatu yang sudah ditangani Postgres dengan lebih baik dan lebih dekat
ke data.

**Konsekuensi.** Setiap tabel baru **wajib** disertai policy di migration yang sama.
Tabel tanpa policy berarti data terbuka bagi siapa pun yang membuka DevTools.

---

## ADR-009 — Bucket `covers` public, bucket `audio` private

**Konteks.** Kuota egress 5 GB/bulan adalah batasan paling ketat di project ini.

**Keputusan.** `audio` private (signed URL). `covers` public.

**Alasan.** File di bucket public dilayani lewat CDN dan di-cache, jadi cover art yang sama
tidak memakan egress berulang setiap halaman dibuka. Bucket private selalu menembus ke
origin. Cover art bukan data sensitif, jadi tidak ada yang dikorbankan.

**Konsekuensi.** Cover wajib di-resize ke 500×500 sebelum upload — cover embedded FLAC
sering 2–4 MB, lebih besar dari lagunya sendiri.

---

## ADR-010 — Tetap di Supabase Storage dulu, R2 sebagai jalur upgrade

**Keputusan.** Mulai dari Supabase Storage. Kalau koleksi melebihi 1 GB:
(1) transcode ke Opus 128k — gratis, biasanya cukup, 1 GB jadi muat ~1.500 lagu;
(2) pindah audio ke Cloudflare R2 (10 GB, egress nol), Supabase tetap untuk Postgres + Auth;
(3) Supabase Pro $25/bulan.

**Alternatif ditolak:** *langsung R2 dari awal* — menambah penyedia dan kredensial, dan
signed URL R2 harus dibuat di serverless function, sehingga arsitektur berhenti menjadi
100% static. Tidak sepadan sebelum terbukti dibutuhkan.

**Konsekuensi.** Kolom `storage_path` sengaja menyimpan path, bukan URL penuh — migrasi ke
R2 nanti cukup mengganti fungsi pembuat URL, tanpa migrasi data.

---

## ADR-011 — Aplikasi 100% static, tanpa backend ⭐

**Konteks.** Konsekuensi langsung dari ADR-001. Setelah integrasi Spotify dibatalkan, tidak
ada lagi operasi yang memerlukan server.

**Keputusan.** Tidak ada folder `api/`. Tidak ada serverless function. Vercel murni
berfungsi sebagai CDN untuk file static. Parsing daftar lagu dan fuzzy matching berjalan
di browser, matching berat dipindah ke Web Worker.

**Alternatif ditolak:** *matching di serverless function* — akan memerlukan pengiriman
seluruh library ke server per request, atau query berulang per lagu. Di browser, library
sudah dimuat sekali dan matching berjalan tanpa latensi jaringan sama sekali. Untuk library
di bawah ~20.000 lagu ini lebih cepat.

**Konsekuensi.** Project ini tidak punya secret apa pun — tidak ada `service_role` key,
tidak ada client secret, tidak ada token pihak ketiga. Env var hanya dua dan keduanya
memang dirancang publik. Kalau suatu saat agen merasa perlu menambahkan secret, itu sinyal
bahwa dia sedang menambahkan sesuatu yang dilarang di `AGENTS.md` §2.

---

<!-- AGEN: TAMBAHKAN ADR BARU DI BAWAH SINI -->
