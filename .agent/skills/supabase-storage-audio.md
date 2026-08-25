# SKILL: Supabase Storage untuk Audio

**Kapan dibaca:** sebelum menyentuh apa pun yang berhubungan dengan pemutaran atau upload file audio.

---

## Prinsip utama

Supabase Storage sudah menangani **HTTP Range request** secara native. Browser bisa
melakukan seek langsung ke server Storage. Kamu **tidak perlu** menulis kode streaming
sama sekali — dan tidak boleh membuat proxy lewat Vercel function (lihat `AGENTS.md` §3).

```
❌ Browser → Vercel Function → Supabase Storage → Vercel Function → Browser
   (dobel bandwidth, kena limit 60 detik, latensi berlipat, tanpa manfaat)

✅ Browser → Supabase Storage
   (Range native, CDN, nol beban di Vercel)
```

---

## Memutar lagu

```javascript
async function getPlayUrl(storagePath) {
  const { data, error } = await supabase
    .storage.from('audio')
    .createSignedUrl(storagePath, 3600);      // berlaku 1 jam
  if (error) throw new Error('Gagal membuat URL: ' + error.message);
  return data.signedUrl;
}

// Pemakaian
audio.src = await getPlayUrl(track.storage_path);
await audio.play().catch(e => {
  if (e.name !== 'NotAllowedError') console.error(e);   // autoplay diblokir = normal
});
```

**Cache signed URL-nya.** Membuat signed URL adalah panggilan jaringan. Kalau kamu
memanggilnya tiap kali user menekan next, playback akan terasa tersendat.

```javascript
const urlCache = new Map();   // path -> { url, expiresAt }

async function cachedUrl(path) {
  const hit = urlCache.get(path);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.url;
  const url = await getPlayUrl(path);
  urlCache.set(path, { url, expiresAt: Date.now() + 3600_000 });
  return url;
}
```

Untuk beberapa lagu sekaligus (misal saat memuat playlist), pakai batch — satu request
untuk banyak path, jauh lebih hemat:

```javascript
const { data } = await supabase.storage.from('audio')
  .createSignedUrls(paths, 3600);      // perhatikan: createSignedUrls, jamak
```

**Prefetch lagu berikutnya saja**, jangan seluruh antrean:

```javascript
audio.addEventListener('loadedmetadata', () => {
  const next = queue[index + 1];
  if (next) cachedUrl(next.storage_path);    // siapkan URL-nya, jangan unduh audionya
});
```

---

## Cover art

Bucket `covers` sengaja **public**. Alasannya bukan kemalasan: file publik dilayani lewat
CDN dan di-cache, sehingga tidak memakan egress berulang setiap kali halaman dibuka.
Bucket private selalu menembus ke origin.

```javascript
const { data } = supabase.storage.from('covers').getPublicUrl(coverPath);
img.src = data.publicUrl;      // sinkron, tidak ada network call
```

Wajib resize sebelum upload. Cover embedded di file FLAC sering berukuran 2–4 MB —
lebih besar dari sebagian lagu MP3. Turunkan ke maks 500×500 JPEG quality 80 (≈60 KB).
Untuk 250 album, itu selisih 15 KB vs 750 MB dari kuota 1 GB.

---

## Upload (dari scanner lokal)

Konvensi path **wajib** diawali UUID user, karena RLS policy mengandalkannya:

```
audio/<user_uid>/<artist>/<album>/<track_no> - <title>.<ext>
```

```python
path = f"{user_id}/{safe(artist)}/{safe(album)}/{track_no:02d} - {safe(title)}{ext}"

with open(local_path, 'rb') as f:
    supabase.storage.from_('audio').upload(
        path, f,
        {"content-type": mime, "cache-control": "3600", "upsert": "true"}
    )
```

`safe()` harus membuang `/`, `\`, dan karakter kontrol. Karakter non-ASCII boleh
(Storage mendukung UTF-8), tapi hindari `#`, `?`, dan `%` yang merepotkan di URL.

---

## Batas yang memengaruhi kode

| Batas | Nilai (Free) | Yang harus dilakukan |
|---|---|---|
| Ukuran file | 50 MB | Tolak file lebih besar di scanner dengan pesan jelas. FLAC lagu panjang bisa melewatinya. |
| Total storage | 1 GB | Tampilkan meter penggunaan di UI. |
| Egress | 5 GB/bulan | `preload="metadata"`, jangan `auto`. Jangan autoplay saat halaman dibuka. |

Cek total pemakaian:

```javascript
const { data } = await supabase.from('tracks').select('file_size.sum()');
```

---

## Jebakan

- **Signed URL kedaluwarsa di tengah lagu.** Kalau durasi 3600 detik dan user memutar
  album panjang tanpa refresh, seek di menit ke-70 akan gagal. Tangani event `error`
  pada `<audio>`: kalau `MEDIA_ERR_NETWORK`, buat URL baru dan lanjutkan dari
  `currentTime` yang tersimpan.
- **Jangan simpan signed URL di database.** URL itu berumur pendek; yang disimpan adalah
  `storage_path`. Menyimpan URL akan menghasilkan link mati setelah satu jam.
- **`upsert: true` menimpa file dengan nama sama.** Untuk scanner ini justru diinginkan
  (rescan tidak menduplikasi), tapi sadari konsekuensinya.
- **Format `.m4a` butuh content-type `audio/mp4`**, bukan `audio/m4a`. Kalau salah,
  Safari menolak memutarnya.
- FLAC tidak didukung Safari iOS. Simpan `file_ext` di DB dan tampilkan peringatan di UI,
  atau konversi ke Opus/AAC saat upload dari scanner (ffmpeg, di sisi lokal — bukan di Vercel).
