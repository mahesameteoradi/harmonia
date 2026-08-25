# KICKOFF_PROMPT.md

Prompt siap tempel untuk Antigravity. Bagian A untuk sesi pertama, bagian B untuk
**setiap sesi setelahnya** — B inilah yang mencegah agen "lupa" project-nya.

---

## A. Sesi Pertama

```
Kamu adalah software engineer yang mengerjakan project "Harmonia" — music player pribadi.
Frontend static di Vercel, data dan file di Supabase. Tidak ada backend.

LANGKAH PERTAMA, sebelum menulis kode apa pun, baca berurutan:
1. AGENTS.md           — aturan kerja, batasan, protokol memori. Ini kontrak, bukan saran.
2. .agent/MEMORY.md    — state project. Sumber kebenaran tunggal.
3. docs/SPEC.md        — arsitektur dan spesifikasi.
4. docs/DEPLOY.md      — langkah setup Supabase + Vercel.
5. docs/TASKS.md       — papan tugas berfase.
6. .agent/DECISIONS.md — 11 ADR yang sudah final, jangan dibuka ulang.

Setelah membaca semuanya, lapor balik:
- Ringkasan arsitektur dalam 3 kalimat
- Jelaskan kenapa project ini TIDAK punya folder api/ dan kenapa audio tidak boleh
  melewati Vercel (buktikan kamu benar-benar membaca, bukan menebak)
- Task pertama yang akan kamu kerjakan dan alasannya
- Hal yang belum jelas dan perlu saya jawab dulu

JANGAN mulai ngoding sebelum saya bilang "lanjut". Setelah itu kerjakan SATU task sampai
tuntas, update MEMORY.md + JOURNAL.md + TASKS.md, commit, baru lanjut ke task berikutnya.

Empat aturan yang paling sering dilanggar agen, saya tegaskan di depan:

1. JANGAN membuat folder api/ atau serverless function apa pun. Aplikasi ini 100% static
   dan itu keputusan sadar (ADR-011), bukan pekerjaan yang belum selesai.

2. JANGAN membuat endpoint streaming. Supabase Storage sudah menangani HTTP Range secara
   native. Frontend memanggil createSignedUrl() dan memasang hasilnya ke audio.src.

3. JANGAN menambahkan integrasi ke Spotify, YouTube Music, atau layanan streaming lain —
   baik lewat API resmi maupun scraping, dan jangan menambahkan spotdl/librespot/yt-dlp/
   ytmusicapi. Playlist masuk lewat paste teks atau upload CSV yang diparse di browser.
   Kalau kamu merasa butuh API key atau OAuth, kamu salah memahami project.

4. JANGAN menjalankan scanner di cloud. Serverless tidak punya akses ke folder musik di
   PC saya. Scanner adalah CLI Python lokal.
```

---

## B. Sesi Lanjutan

```
Lanjutkan project Harmonia.

Protokol pemulihan konteks — kerjakan dulu, jangan dilewati:
1. Baca AGENTS.md
2. Baca .agent/MEMORY.md — perhatikan "Status Terkini" dan "Kuota"
3. Baca 2 entri teratas .agent/JOURNAL.md
4. Baca docs/TASKS.md — cari task pertama bertanda [ ] atau [~]
5. Jalankan: git log --oneline -10
6. Baca skill file yang relevan dengan task berikutnya (tabel di AGENTS.md bagian 7)

Lalu lapor: "Melanjutkan dari Fase X task Y. Rencana: ..." dan tunggu konfirmasi saya.

Di akhir sesi, atau saat konteks mulai penuh, WAJIB:
- Update .agent/MEMORY.md ("Status Terkini" + "Peta File")
- Tambah entri .agent/JOURNAL.md
- Centang task di docs/TASKS.md
- Catat ADR baru di .agent/DECISIONS.md kalau ada keputusan teknis
- git add -A && git commit
```

---

## C. Koreksi (kalau agen melenceng)

Gejala khas: agen membuat folder `api/`, mengusulkan integrasi Spotify/YouTube, membuat
endpoint streaming, atau membuat tabel tanpa RLS.

```
Berhenti. Kamu keluar dari arsitektur.

Baca ulang AGENTS.md bagian 2 (Batasan) dan 3 (Arsitektur), lalu .agent/DECISIONS.md
ADR-001, ADR-006, ADR-008, dan ADR-011. Lalu jelaskan:
1. Aturan mana yang barusan kamu langgar
2. Apa yang akan kamu batalkan
3. Rencana yang benar sesuai docs/TASKS.md

Jangan menulis kode sampai saya setujui rencana barunya.
```

---

## D. Audit Sebelum Deploy

```
Lakukan audit sebelum saya deploy. Periksa satu per satu dan laporkan temuannya,
JANGAN langsung memperbaiki:

1. Konfirmasi tidak ada folder api/ di repo.
2. Grep seluruh repo untuk: service_role, CLIENT_SECRET, api_key, oauth, spotdl,
   librespot, yt-dlp, ytmusicapi. Seharusnya nol hasil.
3. Cek scripts/inject-env.js — pastikan HANYA SUPABASE_URL dan SUPABASE_ANON_KEY
   yang disuntik.
4. Daftar semua tabel di db/schema.sql. Untuk tiap tabel konfirmasi ada policy select
   dan policy write. Sebutkan yang tidak punya.
5. Cek semua view punya security_invoker = on.
6. Konfirmasi bucket audio private dan policy-nya mensyaratkan path diawali auth.uid().
7. Cek setiap panggilan supabase di frontend sudah memeriksa `error`, bukan hanya `data`.

Laporkan dalam tabel: item, status (aman/bermasalah), temuan.
```

---

## E. Menambah Skill Baru

```
Pola yang barusan kamu pakai bagus. Simpan sebagai skill permanen:

1. Buat .agent/skills/<nama-deskriptif>.md
2. Isinya: kapan skill ini dibaca, kode pola lengkap yang sudah terbukti jalan,
   cara mengetesnya, dan daftar jebakan yang kamu temui
3. Daftarkan di tabel Skill Library pada AGENTS.md bagian 7
4. Commit: "docs(skill): tambah <nama>"

Ikuti gaya skill file yang sudah ada — praktis, kode nyata, ada bagian jebakan.
```

---

## Kenapa struktur ini bekerja

Agen coding kehilangan konteks percakapan begitu sesi reset atau context window penuh.
Solusinya bukan berharap agen "ingat", tapi memindahkan memorinya ke filesystem:

| File | Peran | Analogi |
|---|---|---|
| `AGENTS.md` | Aturan permanen, dibaca tiap sesi | Kontrak kerja |
| `.agent/MEMORY.md` | State saat ini, sering berubah | Papan status di dinding |
| `.agent/JOURNAL.md` | Riwayat kronologis | Buku harian |
| `.agent/DECISIONS.md` | Keputusan + alasan + alternatif yang ditolak | Notulen rapat |
| `.agent/skills/*.md` | Pengetahuan teknis reusable | Buku manual |
| `docs/TASKS.md` | Antrean kerja | Papan tugas |

Bagian ADR paling sering diremehkan, padahal itu yang mencegah agen "memperbaiki" keputusan
yang sebenarnya sudah benar. Contoh nyata di project ini: tanpa ADR-001, sesi berikutnya
akan melihat fitur import CSV dan berinisiatif menawarkan "integrasi Spotify langsung supaya
lebih praktis" — merasa sedang meningkatkan produk, padahal sedang mengembalikan masalah
yang sudah sengaja dibuang. Alasan dan alternatif yang ditolak harus tercatat, bukan cuma
keputusan akhirnya.

Kuncinya tetap pada **disiplin update**. Agen yang tidak menulis JOURNAL di akhir sesi akan
kehilangan konteks di sesi berikutnya, sebagus apa pun struktur foldernya. Karena itu
"update memori" masuk ke Definition of Done, bukan langkah opsional.
