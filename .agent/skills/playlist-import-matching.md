# SKILL: Import Daftar Lagu & Fuzzy Matching

**Kapan dibaca:** sebelum menyentuh apa pun yang berhubungan dengan import playlist atau pencocokan lagu.

---

## Prinsip

Aplikasi ini **tidak terhubung ke Spotify sama sekali**. Tidak ada OAuth, tidak ada API key,
tidak ada serverless function. User membawa daftar lagunya sendiri lewat clipboard atau file,
dan aplikasi mencocokkannya ke library lokal.

```
User export/copy daftar lagu  →  paste atau upload  →  parser  →  fuzzy match  →  playlist
```

Semua terjadi di browser. Tidak ada data yang keluar selain ke Supabase milik user sendiri.

---

## Cara user mendapatkan daftarnya

Dokumentasikan ini di UI, jangan biarkan user menebak:

| Sumber | Caranya | Hasil |
|---|---|---|
| Spotify desktop | Buka playlist → `Ctrl+A` → `Ctrl+C` | Daftar teks di clipboard |
| Exportify | exportify.net → login → Export | CSV |
| TuneMyMusic / Soundiiz | Pilih playlist → export | CSV |
| Apple Music, YouTube Music, Deezer | Lewat Soundiiz/TuneMyMusic | CSV |
| Ketik manual | — | Teks biasa |

Parser harus menangani semuanya tanpa user perlu memilih format.

---

## Parser format-agnostik

Deteksi format dari isinya, bukan dari ekstensi file:

```javascript
export function parseTrackList(raw) {
  const text = raw.trim();
  if (!text) return [];

  // 1. CSV berheader (Exportify, TuneMyMusic, Soundiiz)
  const firstLine = text.split('\n')[0].toLowerCase();
  if (firstLine.includes(',') &&
      /track|title|name|song/.test(firstLine) &&
      /artist/.test(firstLine)) {
    return parseCsv(text);
  }

  // 2. URI/URL Spotify (hasil copy dari desktop app)
  if (/spotify:track:|open\.spotify\.com\/track\//.test(text)) {
    return parseSpotifyPaste(text);
  }

  // 3. Teks biasa: "Artist - Title" atau "Title - Artist"
  return parsePlainText(text);
}
```

### CSV

Nama kolom berbeda antar tool. Cari berdasarkan pola, jangan hardcode:

```javascript
function pickColumn(headers, patterns) {
  return headers.findIndex(h => patterns.some(p => p.test(h)));
}

const iTitle  = pickColumn(headers, [/^track ?name$/i, /^title$/i, /^name$/i, /^song/i]);
const iArtist = pickColumn(headers, [/^artist ?name/i, /^artist/i, /^performer/i]);
const iAlbum  = pickColumn(headers, [/^album ?name/i, /^album/i]);
const iDur    = pickColumn(headers, [/duration/i, /length/i, /time/i]);
const iIsrc   = pickColumn(headers, [/isrc/i]);
```

Parser CSV harus menangani field berkutip yang mengandung koma — judul lagu sering punya
koma. Jangan pakai `line.split(',')`:

```javascript
function splitCsvLine(line) {
  const out = []; let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }   // "" = escape
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
```

Durasi bisa berupa `"3:45"`, `225000` (ms), atau `225` (detik). Normalisasi ke ms:

```javascript
function parseDuration(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (s.includes(':')) {
    const p = s.split(':').map(Number);
    return p.length === 3 ? (p[0]*3600 + p[1]*60 + p[2]) * 1000 : (p[0]*60 + p[1]) * 1000;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n > 10000 ? n : n * 1000;      // >10000 hampir pasti sudah ms
}
```

### Teks biasa

```javascript
function parsePlainText(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    // buang penomoran di depan: "1. ", "01) ", "- "
    line = line.replace(/^\s*[\d]+[\.\)]\s*|^\s*[-*]\s*/, '');
    // pemisah bisa " - ", " – ", " — ", atau " • " (Spotify pakai bullet)
    const m = line.split(/\s+[-–—•]\s+/);
    if (m.length >= 2) return { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() };
    return { artist: '', title: line };     // tanpa pemisah: anggap judul saja
  });
}
```

⚠️ Urutan `Artist - Title` vs `Title - Artist` berbeda antar sumber, dan tidak bisa
ditebak dari satu baris. **Tampilkan preview 5 baris pertama dengan tombol "Tukar kolom"**
sebelum user mengkonfirmasi import. Ini jauh lebih baik daripada menebak dan salah untuk
seluruh playlist.

---

## Normalisasi sebelum matching

```javascript
const NOISE = /\b(remaster(ed)?|deluxe|edition|version|radio edit|live|acoustic|bonus track|explicit|mono|stereo|\d{4} mix)\b/gi;

export function normalize(s) {
  if (!s) return '';
  return s
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // buang aksen
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')                     // buang isi kurung
    .replace(/\bfeat\.?\b.*$|\bft\.?\b.*$/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

---

## Matching di browser

Tanpa backend, matching berjalan di sisi klien. Untuk library di bawah ~20.000 lagu ini
lebih cepat daripada round-trip ke server, karena tidak ada latensi jaringan per lagu.

Muat kandidat sekali, cocokkan semuanya di memori:

```javascript
// Satu query, bukan satu per lagu
const { data: library } = await supabase
  .from('v_tracks')
  .select('id,title_norm,artist_name,duration_ms,isrc');

function scoreOne(imported, local) {
  const t = ratio(normalize(imported.title),  local.title_norm);
  const a = ratio(normalize(imported.artist), normalize(local.artist_name));
  let s = t * 0.6 + a * 0.4;

  // Tie-breaker durasi: sangat efektif membedakan versi studio vs live
  if (imported.duration_ms && local.duration_ms) {
    const diff = Math.abs(imported.duration_ms - local.duration_ms);
    if (diff < 3000) s += 3;
    else if (diff > 30000) s -= 10;
  }
  return Math.min(100, s);
}
```

Untuk `ratio()`, pakai token-set similarity — bukan Levenshtein mentah, karena urutan kata
sering berbeda:

```javascript
function ratio(a, b) {
  const A = new Set(a.split(' ')), B = new Set(b.split(' '));
  const inter = [...A].filter(x => B.has(x)).length;
  return (2 * inter) / (A.size + B.size) * 100;      // Sørensen–Dice
}
```

**Pre-filter sebelum skoring penuh.** Membandingkan 100 lagu × 10.000 library = sejuta
operasi dan UI akan membeku. Saring dulu berdasarkan kata pertama judul:

```javascript
const byToken = new Map();          // token -> [track, ...]
for (const t of library)
  for (const tok of t.title_norm.split(' '))
    (byToken.get(tok) ?? byToken.set(tok, []).get(tok)).push(t);

// saat matching, hanya periksa kandidat yang berbagi minimal satu token
```

Kalau proses tetap terasa berat, jalankan di **Web Worker** supaya UI tetap responsif.

---

## Ambang keputusan

| Kondisi | Aksi | `match_status` |
|---|---|---|
| ISRC sama persis | Auto-match, skor 100 | `matched` |
| Skor ≥ 85 | Auto-match | `matched` |
| Skor 60–84 | Simpan top-3 kandidat, minta konfirmasi user | `pending` |
| Skor < 60 | Wishlist | `not_found` |

Tampilkan ringkasan setelah import: *"45 dari 60 lagu ketemu, 8 perlu konfirmasi, 7 belum ada di koleksi"*.

---

## Jebakan

- **Judul non-ASCII** (lagu Indonesia, Jepang, Korea) — normalisasi NFKD menangani aksen
  Latin, tapi Hangul dan Kanji tidak tersentuh. Itu justru bagus: biarkan apa adanya,
  pencocokan karakter tetap bekerja.
- **CSV dengan BOM** (`\uFEFF` di awal file) merusak deteksi header. Buang dulu:
  `text.replace(/^\uFEFF/, '')`.
- **Line ending Windows** (`\r\n`) menyisakan `\r` di akhir field terakhir. Normalisasi
  ke `\n` sebelum parsing.
- **Jangan simpan hasil parse mentah ke database** sebelum user mengkonfirmasi preview.
  Salah tebak urutan kolom lalu menulis 200 baris sampah jauh lebih menyakitkan daripada
  satu langkah konfirmasi.
- **Nama artis dengan koma** (`"Tyler, The Creator"`) — inilah alasan `split(',')` polos
  tidak boleh dipakai untuk CSV.
