# MEMORY.md — Otak Persisten Project Harmonia

> **Untuk agen:** ini memori jangka panjang kamu. Konteks percakapan hilang, file ini tidak.
> Kalau isi file ini bertentangan dengan ingatanmu dari percakapan, **file ini yang benar**.
> Jaga di bawah 300 baris — detail lama pindahkan ke `JOURNAL.md`.

---

## 1. Ringkasan

Harmonia adalah music player pribadi. Frontend static (vanilla JS) di **Vercel**.
Metadata dan auth di **Supabase Postgres** dengan RLS. File audio di **Supabase Storage**,
di-stream **langsung ke browser** lewat signed URL — tidak pernah lewat Vercel. Scanner
adalah **CLI Python lokal** di PC user untuk mengunggah koleksi musiknya.

Playlist di-import dengan cara user **mem-paste atau meng-upload daftar lagunya sendiri**
(CSV dari Exportify/TuneMyMusic/Soundiiz, atau hasil Ctrl+C dari Spotify desktop).
Parsing dan matching berjalan di browser. **Tidak ada integrasi ke layanan streaming
mana pun** — tidak ada API key, tidak ada OAuth, tidak ada scraping, tidak ada backend.

---

## 2. Status Terkini

<!-- AGEN: UPDATE BLOK INI SETIAP AKHIR SESI -->

- **Fase aktif:** Fase 1 — Scanner Lokal (Fase 0 selesai)
- **Task sedang dikerjakan:** —
- **Task berikutnya:** T1.1
- **Blocker:** —
- **Terakhir di-update:** 25 Agustus 2026
- **Commit terakhir:** (Update T0.7 UI Login)

---

## 3. Environment

<!-- AGEN: isi setelah setup -->

| Item | Nilai |
|---|---|
| Supabase project ref | *(isi)* |
| Supabase region | Southeast Asia (Singapore) |
| URL production Vercel | *(isi)* |
| Bucket audio | `audio` — private |
| Bucket cover | `covers` — public |
| Email user | *(isi)* |
| Folder musik lokal | *(isi path)* |
| Dev lokal | `vercel dev` → localhost:3000 |
| Scanner | `python -m scanner scan --path ...` |

> Project ini tidak punya secret apa pun. Env var hanya dua: `SUPABASE_URL` dan
> `SUPABASE_ANON_KEY`, keduanya memang dirancang publik.

---

## 4. Peta File

| File | Isi | Status |
|---|---|---|
| `db/schema.sql` | 7 tabel + RLS + storage policy + view | ✅ ada |
| `vercel.json` | Konfigurasi static, tanpa functions | ✅ ada |
| `scripts/inject-env.js` | Suntik 2 env var ke frontend saat build | ✅ ada |
| `public/js/supabase.js` | Inisialisasi client | ✅ ada |
| `public/js/storage.js` | Signed URL + cache | ⬜ |
| `public/js/player.js` | Audio engine + queue | ⬜ |
| `public/js/parser.js` | Parse CSV / teks jadi daftar lagu | ⬜ |
| `public/js/matcher.js` | Normalisasi + skoring | ⬜ |
| `public/js/matcher.worker.js` | Matching di thread terpisah | ⬜ |
| `public/js/auth.js` | Auth login form + state change guard | ✅ ada |
| `scanner/__main__.py` | CLI lokal | ⬜ |

---

## 5. Keputusan Final — Jangan Dibuka Ulang

1. **Tidak ada integrasi layanan streaming.** Import lewat paste/upload daftar lagu. (ADR-001)
2. **Tidak ada backend, tidak ada folder `api/`.** Aplikasi 100% static. (ADR-011)
3. **Audio TIDAK PERNAH lewat Vercel.** Storage → browser langsung via signed URL. (ADR-006)
4. **Vanilla JS**, satu-satunya build step adalah injeksi 2 env var. (ADR-002)
5. **Scanner jalan di PC user**, bukan di cloud. (ADR-007)
6. **RLS wajib di semua tabel.** Anon key memang publik; RLS yang melindungi. (ADR-008)
7. **Bucket `covers` public** supaya kena cache CDN dan hemat egress. (ADR-009)
8. **File hash = md5(1MB pertama + filesize)**, bukan path. (ADR-004)
9. **Threshold matching**: ISRC → ≥85 auto → 60-84 pending → <60 wishlist. (ADR-005)

---

## 6. Kuota — Selalu Ingat Ini

| Sumber daya | Free | Artinya |
|---|---|---|
| Storage | 1 GB, maks 50 MB/file | ~250 lagu MP3 320k · ~1.500 lagu Opus 128k |
| Egress | 5 GB/bulan | ~1.250 putar. Terlampaui → **402, semua mati** |
| Database | 500 MB | aman |
| Auto-pause | 7 hari idle | resume manual dari dashboard |

---

## 7. Jebakan yang Sudah Diketahui

<!-- AGEN: tambahkan setiap kali ketemu bug yang makan waktu >30 menit -->

- **Supabase tidak melempar exception**, mengembalikan `{data, error}`. Lupa cek `error`
  membuat kegagalan tampak seperti "data kosong".
- **RLS aktif tanpa policy = semua ditolak.** Gejala: tabel tampak kosong padahal ada isinya.
- **View butuh `security_invoker = on`**, kalau tidak akan mem-bypass RLS tabel dasarnya.
- **Signed URL kedaluwarsa di tengah album panjang** → tangani `MEDIA_ERR_NETWORK`,
  buat URL baru, lanjutkan dari `currentTime`.
- **CSV**: field berkutip bisa mengandung koma (`"Tyler, The Creator"`). `split(',')` polos
  akan merusak baris. Tangani juga BOM `\uFEFF` dan line ending `\r\n`.
- **Urutan kolom `Artis - Judul` vs `Judul - Artis`** berbeda antar sumber dan tidak bisa
  ditebak. Wajib ada preview + tombol tukar sebelum import dieksekusi.
- **Cover embedded FLAC sering 2–4 MB**, lebih besar dari lagunya. Wajib resize.
- `.m4a` butuh content-type `audio/mp4`, bukan `audio/m4a`, atau Safari menolak.

---

## 8. Preferensi User (Herman)

- Bahasa percakapan **Indonesia**, nama variabel/fungsi Inggris.
- Suka **edit kecil dan tertarget**, bukan rewrite file besar.
- Sudah kuat di: Flask blueprint, MySQL pooling, Chart.js, Telegram Bot API,
  SPA dengan partial loading dinamis, MikroTik.
- Tidak suka penjelasan bertele-tele. Langsung solusi + alasan singkat.
- Kalau ada solusi yang jauh lebih sederhana, **katakan**, jangan diam-diam bikin rumit.
- Berasal dari dunia MySQL. Perbedaan Postgres yang relevan (RLS, `generated always as
  identity`, `on conflict`, `text` vs `varchar`) layak dijelaskan singkat saat pertama
  kali muncul, bukan diasumsikan sudah tahu.
- Tidak menggunakan Laragon atau XAMPP. Tool yang dibutuhkan hanya Node, Git, dan Python.
