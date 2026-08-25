# SKILL: Scanner & Uploader Lokal

**Kapan dibaca:** sebelum menulis atau mengubah `scanner/`.

---

## Kenapa harus lokal

Vercel serverless tidak punya akses ke folder musik di PC user dan tidak punya filesystem
persisten. Scanner adalah **program Python yang dijalankan user di komputernya sendiri**,
bukan bagian dari aplikasi web. Ini bukan keterbatasan yang perlu diakali — ini memang
tempat yang benar untuknya.

```
PC user                                    Cloud
─────────                                  ─────
media/*.mp3 ──► scanner.py ──┬── upload ──► Supabase Storage (bucket audio)
                             ├── cover  ──► Supabase Storage (bucket covers)
                             └── metadata ► Supabase Postgres (tabel tracks)
```

---

## Struktur

```
scanner/
├── __main__.py       # CLI: argparse, orkestrasi
├── auth.py           # login sekali, simpan session ke ~/.harmonia/session.json
├── tags.py           # baca metadata pakai mutagen
├── uploader.py       # upload ke Storage dengan retry
└── sync.py           # upsert metadata ke Postgres
```

CLI yang diharapkan:

```bash
python -m scanner login
python -m scanner scan --path "D:/Musik" --dry-run     # lihat dulu, jangan upload
python -m scanner scan --path "D:/Musik"
python -m scanner status                                # berapa terpakai dari 1 GB
```

`--dry-run` bukan fitur opsional. Dengan kuota 1 GB, user harus bisa melihat berapa yang
akan terpakai **sebelum** ratusan file terunggah.

---

## Pembacaan tag dengan fallback

Tag ID3 di dunia nyata berantakan. Selalu sediakan rantai fallback:

```python
from mutagen import File as MutagenFile

def read_tags(path):
    m = MutagenFile(path, easy=True)
    if m is None:
        return None                       # bukan file audio yang valid
    g = lambda k: (m.tags.get(k) or [None])[0] if m.tags else None

    title  = g('title')  or Path(path).stem
    artist = g('artist') or g('albumartist') or g('performer') or 'Unknown Artist'
    album  = g('album')  or 'Unknown Album'

    track_no = None
    raw = g('tracknumber')
    if raw:
        try:    track_no = int(str(raw).split('/')[0])   # format "3/12"
        except ValueError: pass

    return {
        'title': title, 'artist': artist, 'album': album,
        'track_no': track_no,
        'duration_ms': int(m.info.length * 1000) if m.info else None,
        'bitrate': getattr(m.info, 'bitrate', None),
        'isrc': g('isrc'),
        'year': parse_year(g('date')),      # bisa "2011", "2011-05-03", "2011/05"
    }
```

---

## File hash (ADR-004)

```python
import hashlib, os

def file_hash(path, chunk=1024*1024):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        h.update(f.read(chunk))
    h.update(str(os.path.getsize(path)).encode())
    return h.hexdigest()
```

Hash 1 MB pertama + ukuran, bukan seluruh file. Untuk 5.000 lagu, selisihnya menit vs jam.

---

## Preflight check — jalankan sebelum upload apa pun

```python
MAX_FILE = 50 * 1024 * 1024          # batas keras Supabase Free
QUOTA    = 1024 * 1024 * 1024

total = sum(f.size for f in files)
too_big = [f for f in files if f.size > MAX_FILE]

print(f"{len(files)} file, total {total/1e6:.0f} MB")
if too_big:
    print(f"⚠ {len(too_big)} file melebihi 50 MB dan akan dilewati:")
    for f in too_big[:5]:
        print(f"   {f.name} ({f.size/1e6:.0f} MB)")
if used + total > QUOTA:
    print(f"⚠ Melebihi kuota 1 GB (terpakai {used/1e6:.0f} MB). Upload akan gagal di tengah jalan.")
    sys.exit(1)
```

Untuk file yang kebesaran, tawarkan transcode lokal (ffmpeg ada di PC user, bukan di cloud):

```bash
ffmpeg -i input.flac -c:a libopus -b:a 128k output.opus
```

FLAC 40 MB menjadi Opus ~5 MB dengan kualitas yang praktis tidak terbedakan pada
pemutaran normal. Ini cara paling efektif memuat 250 lagu menjadi 1.500+ lagu.

---

## Upload dengan retry dan concurrency terbatas

```python
from concurrent.futures import ThreadPoolExecutor
import time

def upload_one(f, attempt=0):
    try:
        with open(f.path, 'rb') as fh:
            supabase.storage.from_('audio').upload(
                f.storage_path, fh,
                {"content-type": f.mime, "cache-control": "3600", "upsert": "true"})
        return ('ok', f)
    except Exception as e:
        if 'Payload too large' in str(e):
            return ('too_big', f)                # jangan retry, percuma
        if attempt < 3:
            time.sleep(2 ** attempt)             # exponential backoff
            return upload_one(f, attempt + 1)
        return ('failed', f)

with ThreadPoolExecutor(max_workers=4) as ex:    # 4, bukan 50 — hormati batas koneksi
    results = list(ex.map(upload_one, files))
```

---

## Urutan operasi yang benar

1. Insert/upsert baris `tracks` dengan `upload_status='pending'`
2. Upload file audio ke Storage
3. Update `upload_status='uploaded'`

Kalau dibalik (upload dulu, insert belakangan) dan proses terputus di tengah, kamu akan
punya file yatim di Storage yang memakan kuota tanpa muncul di aplikasi. Dengan urutan di
atas, baris `pending` yang tertinggal bisa dideteksi dan dilanjutkan di run berikutnya.

Sediakan perintah pembersih:

```bash
python -m scanner cleanup        # hapus baris pending yang filenya tidak ada di Storage
```

---

## Jebakan

- **Jangan simpan password di script.** Login sekali, simpan `refresh_token` hasil
  `supabase.auth.sign_in_with_password()` ke `~/.harmonia/session.json` dengan permission 600.
- **Path Windows** pakai `\` — normalisasi ke `/` sebelum dijadikan storage path.
- **Nama file non-ASCII** (lagu Indonesia, Jepang) didukung Storage, tapi buang
  `#`, `?`, `%`, dan karakter kontrol yang merusak URL.
- **Cover art wajib di-resize** sebelum upload. Ekstrak dengan mutagen, resize dengan
  Pillow ke 500×500 JPEG q80. Satu cover per album, bukan per lagu — jangan mengunggah
  gambar yang sama 12 kali untuk satu album.
- **`--dry-run` harus benar-benar tidak menyentuh jaringan.** Kalau ternyata tetap
  meng-upload, user akan kehilangan kepercayaan pada tool-nya.
