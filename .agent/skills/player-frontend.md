# SKILL: Player Frontend (Vanilla JS + Supabase)

**Kapan dibaca:** sebelum menulis `player.js`, `ui.js`, atau apa pun yang menyentuh playback.

---

## Prinsip

Satu instance `<audio>` untuk seluruh aplikasi. Jangan membuat elemen baru per lagu —
itu menyebabkan kebocoran memori dan audio yang tumpang tindih.

```html
<audio id="audio" preload="metadata"></audio>
```

`preload="metadata"`, **bukan** `auto`. Dengan `auto`, browser mulai mengunduh audio
begitu `src` dipasang — memakan kuota egress 5 GB/bulan untuk lagu yang mungkin tidak
jadi diputar.

---

## Kerangka Player

```javascript
import { cachedUrl } from './storage.js';

export class Player {
  constructor(audioEl) {
    this.audio = audioEl;
    this.queue = [];
    this.index = -1;
    this.repeat = 'off';        // 'off' | 'all' | 'one'
    this.shuffle = false;
    this._resumeAt = 0;         // untuk pemulihan signed URL kedaluwarsa

    this.audio.addEventListener('ended',      () => this.next());
    this.audio.addEventListener('timeupdate', () => this.emit('progress'));
    this.audio.addEventListener('error',      (e) => this.onError(e));
  }

  async playCurrent() {
    const t = this.queue[this.index];
    if (!t) return;
    try {
      this.audio.src = await cachedUrl(t.storage_path);
      await this.audio.play();
    } catch (e) {
      if (e.name === 'NotAllowedError') this.emit('needs-interaction');
      else this.emit('error', e);
      return;
    }
    this.updateMediaSession(t);
    this.emit('trackchange', t);
    this.prefetchNext();
    this.bumpPlayCount(t.id);
  }

  // Signed URL berumur 1 jam. Kalau kedaluwarsa di tengah album panjang,
  // buat ulang dan lanjutkan dari posisi yang sama — user tidak akan sadar.
  async onError() {
    const err = this.audio.error;
    if (err && err.code === MediaError.MEDIA_ERR_NETWORK) {
      this._resumeAt = this.audio.currentTime;
      const t = this.queue[this.index];
      this.audio.src = await cachedUrl(t.storage_path, { force: true });
      this.audio.currentTime = this._resumeAt;
      this.audio.play().catch(() => {});
    }
  }

  prefetchNext() {
    const n = this.queue[this.index + 1];
    if (n) cachedUrl(n.storage_path);    // siapkan URL saja, JANGAN unduh audionya
  }

  next(manual = false) {
    if (this.repeat === 'one' && !manual) {
      this.audio.currentTime = 0;
      return this.audio.play();
    }
    if (this.index < this.queue.length - 1) this.index++;
    else if (this.repeat === 'all') this.index = 0;
    else return this.emit('queueend');
    this.playCurrent();
  }

  prev() {
    // Konvensi standar: lewat 3 detik = restart lagu, bukan pindah ke sebelumnya
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    this.index = Math.max(0, this.index - 1);
    this.playCurrent();
  }

  shuffleQueue(keepIndex) {
    const cur = this.queue[keepIndex];
    const rest = this.queue.filter((_, i) => i !== keepIndex);
    for (let i = rest.length - 1; i > 0; i--) {          // Fisher-Yates
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.queue = [cur, ...rest];
    this.index = 0;
  }
}
```

---

## Media Session API — jangan dilewatkan

Ini yang membuat aplikasi terasa seperti app asli: kontrol muncul di lockscreen HP,
notification shade, dan tombol headset berfungsi. Kodenya pendek, efeknya besar.

```javascript
updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title:  track.title,
    artist: track.artist_name || 'Unknown Artist',
    album:  track.album_name  || '',
    artwork: [{ src: coverUrl(track.cover_path), sizes: '512x512', type: 'image/jpeg' }],
  });
  navigator.mediaSession.setActionHandler('play',          () => this.audio.play());
  navigator.mediaSession.setActionHandler('pause',         () => this.audio.pause());
  navigator.mediaSession.setActionHandler('nexttrack',     () => this.next(true));
  navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
  navigator.mediaSession.setActionHandler('seekto', d => {
    if (d.seekTime != null) this.audio.currentTime = d.seekTime;
  });
}
```

Media Session hanya bekerja di **HTTPS atau localhost**. Domain Vercel sudah HTTPS,
jadi aman di production — tapi tidak akan muncul kalau kamu mengetes lewat IP LAN biasa.

---

## Progress bar yang bisa digeser

```javascript
bar.addEventListener('pointerdown', e => {
  let ratio = 0;
  const move = ev => {
    const r = bar.getBoundingClientRect();
    ratio = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    fill.style.width = (ratio * 100) + '%';
    dragging = true;                   // abaikan timeupdate selama drag
  };
  const up = ev => {
    move(ev);
    audio.currentTime = ratio * (audio.duration || 0);
    dragging = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  move(e);
});
```

Selama drag berlangsung, **abaikan event `timeupdate`** — kalau tidak, fill bar akan
melompat-lompat melawan jari user.

---

## Render list besar

Library 10.000 lagu tidak boleh dirender sekaligus. Urutan solusi:
1. Pagination server-side lewat `.range()` — mulai dari sini.
2. Infinite scroll dengan `IntersectionObserver` pada elemen sentinel.
3. Virtual scrolling — hanya kalau (1) dan (2) terbukti kurang.

Jangan langsung membangun virtual scroller.

---

## Jebakan

- **Autoplay policy:** `audio.play()` mengembalikan Promise yang di-reject sebelum ada
  interaksi user. Selalu `.catch()`.
- `audio.duration` bisa `NaN` sebelum `loadedmetadata`. Cek sebelum berhitung.
- Di **iOS Safari volume tidak bisa diubah lewat JavaScript** — hanya tombol fisik.
  Sembunyikan slider volume di iOS daripada menampilkan kontrol yang tidak berfungsi.
- `localStorage` boleh dipakai di aplikasi asli (beda dengan artifact) — gunakan untuk
  menyimpan volume, repeat mode, dan posisi terakhir.
- Format waktu: `Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0')`.
