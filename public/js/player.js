import { cachedUrl, getCoverUrl } from './storage.js';

class Player {
    constructor() {
        this.audio = document.getElementById('audio-el');
        if (!this.audio) {
            this.audio = document.createElement('audio');
            this.audio.id = 'audio-el';
            this.audio.preload = 'metadata';
            document.body.appendChild(this.audio);
        }

        this.queue = [];
        this.index = -1;
        this.repeat = 'off'; // 'off' | 'all' | 'one'
        this.shuffle = false;
        this._resumeAt = 0;
        this._dragging = false;
        this._listeners = {};

        // DOM refs
        this.playBtn      = document.querySelector('.player-btn-play');
        this.prevBtn      = document.querySelector('.player-btn[title="Previous"]');
        this.nextBtn      = document.querySelector('.player-btn[title="Next"]');
        this.shuffleBtn   = document.querySelector('.player-btn[title="Shuffle"]');
        this.repeatBtn    = document.querySelector('.player-btn[title="Repeat"]');
        this.progressBar  = document.querySelector('.player-progress-bar');
        this.progressFill = document.querySelector('.player-progress-fill');
        this.timeCurrent  = document.querySelectorAll('.player-progress-time')[0];
        this.timeTotal    = document.querySelectorAll('.player-progress-time')[1];
        this.trackName    = document.querySelector('.player-track-name');
        this.trackArtist  = document.querySelector('.player-track-artist');
        this.coverEl      = document.querySelector('.player-cover');
        this.volumeSlider = document.querySelector('.volume-slider');

        this._bindEvents();
        
        // Restore volume dari localStorage
        const savedVol = localStorage.getItem('harmonia_volume');
        if (savedVol !== null) {
            this.audio.volume = parseFloat(savedVol);
            if (this.volumeSlider) this.volumeSlider.value = Math.round(this.audio.volume * 100);
        }
    }

    _bindEvents() {
        // Audio events
        this.audio.addEventListener('ended', () => this.next());
        this.audio.addEventListener('timeupdate', () => this._onTimeUpdate());
        this.audio.addEventListener('loadedmetadata', () => this._onMetaLoaded());
        this.audio.addEventListener('error', () => this._onError());

        // Play/Pause
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.togglePlay());
        }
        // Prev / Next
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prev());
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.next(true));

        // Shuffle
        if (this.shuffleBtn) {
            this.shuffleBtn.addEventListener('click', () => {
                this.shuffle = !this.shuffle;
                this.shuffleBtn.style.color = this.shuffle ? 'var(--primary)' : '';
                if (this.shuffle && this.queue.length > 0) this._shuffleQueue(this.index);
            });
        }

        // Repeat
        if (this.repeatBtn) {
            this.repeatBtn.addEventListener('click', () => {
                const modes = ['off', 'all', 'one'];
                this.repeat = modes[(modes.indexOf(this.repeat) + 1) % 3];
                this.repeatBtn.style.color = this.repeat !== 'off' ? 'var(--primary)' : '';
                this.repeatBtn.style.opacity = this.repeat === 'one' ? '1' : '';
            });
        }

        // Progress bar draggable
        if (this.progressBar) {
            this.progressBar.addEventListener('pointerdown', (e) => {
                this._dragging = true;
                const move = (ev) => {
                    const r = this.progressBar.getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
                    this.progressFill.style.width = (ratio * 100) + '%';
                    this._dragRatio = ratio;
                };
                const up = (ev) => {
                    move(ev);
                    this.audio.currentTime = this._dragRatio * (this.audio.duration || 0);
                    this._dragging = false;
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
                move(e);
            });
        }

        // Volume
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                this.audio.volume = e.target.value / 100;
                localStorage.setItem('harmonia_volume', this.audio.volume);
            });
        }
    }

    // Muat dan putar lagu saat ini di queue
    async playCurrent() {
        const t = this.queue[this.index];
        if (!t) return;

        try {
            this.audio.src = await cachedUrl(t.storage_path);
            await this.audio.play();
        } catch (e) {
            if (e.name === 'NotAllowedError') {
                // Autoplay policy — user belum interaksi
            } else {
                console.error('Player error:', e);
            }
            return;
        }

        this._updateUI(t);
        this._updateMediaSession(t);
        this._prefetchNext();
    }

    togglePlay() {
        if (this.audio.paused) {
            if (this.audio.src) this.audio.play().catch(() => {});
            else if (this.queue.length > 0) {
                this.index = 0;
                this.playCurrent();
            }
        } else {
            this.audio.pause();
        }
        this._updatePlayIcon();
    }

    next(manual = false) {
        if (this.repeat === 'one' && !manual) {
            this.audio.currentTime = 0;
            this.audio.play().catch(() => {});
            return;
        }
        if (this.index < this.queue.length - 1) this.index++;
        else if (this.repeat === 'all') this.index = 0;
        else return; // end of queue
        this.playCurrent();
    }

    prev() {
        if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
        this.index = Math.max(0, this.index - 1);
        this.playCurrent();
    }

    setQueue(tracks, startIndex = 0) {
        this.queue = [...tracks];
        this.index = startIndex;
        if (this.shuffle) this._shuffleQueue(startIndex);
        this.playCurrent();
    }

    _shuffleQueue(keepIndex) {
        const cur = this.queue[keepIndex];
        const rest = this.queue.filter((_, i) => i !== keepIndex);
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        this.queue = [cur, ...rest];
        this.index = 0;
    }

    _updateUI(track) {
        if (this.trackName) this.trackName.textContent = track.title || 'Unknown';
        if (this.trackArtist) this.trackArtist.textContent = track.artist_name || 'Unknown Artist';
        
        if (this.coverEl) {
            const coverUrl = getCoverUrl(track.cover_path);
            if (coverUrl) {
                this.coverEl.innerHTML = `<img src="${coverUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
            } else {
                this.coverEl.innerHTML = '🎵';
            }
        }

        this._updatePlayIcon();

        // Highlight active row di library
        document.querySelectorAll('.track-row').forEach(row => {
            row.classList.toggle('active', row.dataset.trackId == track.id);
        });
    }

    _updatePlayIcon() {
        if (!this.playBtn) return;
        if (this.audio.paused) {
            this.playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
        } else {
            this.playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        }
    }

    _onTimeUpdate() {
        if (this._dragging || !this.audio.duration) return;
        const pct = (this.audio.currentTime / this.audio.duration) * 100;
        if (this.progressFill) this.progressFill.style.width = pct + '%';
        if (this.timeCurrent) this.timeCurrent.textContent = this._fmt(this.audio.currentTime);
    }

    _onMetaLoaded() {
        if (this.timeTotal) this.timeTotal.textContent = this._fmt(this.audio.duration);
    }

    async _onError() {
        const err = this.audio.error;
        if (err && err.code === MediaError.MEDIA_ERR_NETWORK) {
            // Signed URL kedaluwarsa — buat baru dan lanjutkan
            this._resumeAt = this.audio.currentTime;
            const t = this.queue[this.index];
            if (!t) return;
            try {
                this.audio.src = await cachedUrl(t.storage_path, { force: true });
                this.audio.currentTime = this._resumeAt;
                this.audio.play().catch(() => {});
            } catch (e) {
                console.error('Gagal memulihkan URL:', e);
            }
        }
    }

    _prefetchNext() {
        const n = this.queue[this.index + 1];
        if (n) cachedUrl(n.storage_path); // siapkan URL saja
    }

    _updateMediaSession(track) {
        if (!('mediaSession' in navigator)) return;
        const coverUrl = getCoverUrl(track.cover_path);
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist_name || 'Unknown Artist',
            album: track.album_name || '',
            artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
        });
        navigator.mediaSession.setActionHandler('play', () => this.audio.play());
        navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next(true));
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('seekto', d => {
            if (d.seekTime != null) this.audio.currentTime = d.seekTime;
        });
    }

    _fmt(s) {
        if (!s || isNaN(s)) return '0:00';
        s = Math.floor(s);
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
}

// Singleton — satu instance untuk seluruh aplikasi
export const player = new Player();
