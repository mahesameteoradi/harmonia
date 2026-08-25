import { supabase } from '../supabase.js';
import { getCoverUrl } from '../storage.js';
import { player } from '../player.js';

let allTracks = [];

export async function renderLibrary(container) {
    container.innerHTML = `
        <div class="page-header fade-in-up">
            <h1>Perpustakaan Musik</h1>
            <p>Koleksi lagu pribadi Anda</p>
        </div>
        
        <div id="library-loading" class="empty-state fade-in-up" style="min-height: 40vh;">
            <div class="empty-state-icon animate-pulse">🎵</div>
            <p class="text-muted">Memuat daftar lagu...</p>
        </div>
        
        <div id="library-content" style="display: none;"></div>
        <div id="library-empty" style="display: none;"></div>
    `;

    try {
        const { data: tracks, error } = await supabase
            .from('v_tracks')
            .select('id, title, artist_name, album_name, duration_ms, track_no, storage_path, cover_path, upload_status')
            .eq('upload_status', 'uploaded')
            .order('artist_name', { ascending: true })
            .order('album_name', { ascending: true })
            .order('track_no', { ascending: true })
            .limit(200);

        document.getElementById('library-loading').style.display = 'none';

        if (error) throw error;

        if (!tracks || tracks.length === 0) {
            showEmpty();
            return;
        }

        allTracks = tracks;
        const contentEl = document.getElementById('library-content');
        contentEl.style.display = 'block';
        
        let html = `
            <div class="glass-panel fade-in-up" style="padding: 0.5rem 0; overflow: hidden;">
                <div class="track-row" style="cursor: default; opacity: 0.5; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">
                    <span class="track-row-num">#</span>
                    <span class="track-row-info">Judul</span>
                    <span class="track-row-album">Album</span>
                    <span class="track-row-duration">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </span>
                </div>
        `;

        tracks.forEach((track, i) => {
            let dur = '--:--';
            if (track.duration_ms) {
                const s = Math.floor(track.duration_ms / 1000);
                dur = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            }

            html += `
                <div class="track-row" data-track-id="${track.id}" data-index="${i}" style="animation: fadeInUp 0.3s ${Math.min(i * 0.02, 0.5)}s both;">
                    <span class="track-row-num">${i + 1}</span>
                    <div class="track-row-info">
                        <div class="track-row-title">${track.title}</div>
                        <div class="track-row-artist">${track.artist_name || 'Unknown Artist'}</div>
                    </div>
                    <span class="track-row-album">${track.album_name || ''}</span>
                    <span class="track-row-duration">${dur}</span>
                </div>
            `;
        });

        html += `</div>`;
        contentEl.innerHTML = html;

        // Klik lagu -> mainkan
        contentEl.querySelectorAll('.track-row[data-index]').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.index);
                player.setQueue(allTracks, idx);
            });
        });

    } catch (e) {
        console.error('Gagal memuat library:', e);
        document.getElementById('library-loading').style.display = 'none';
        showEmpty();
    }
}

function showEmpty() {
    const el = document.getElementById('library-empty');
    el.style.display = 'block';
    el.innerHTML = `
        <div class="empty-state fade-in-up">
            <div class="empty-state-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
            </div>
            <h2>Library Masih Kosong</h2>
            <p>Jalankan Scanner Lokal di komputermu untuk mengunggah koleksi musik.</p>
            <div class="glass-panel" style="margin-top: 1.5rem; padding: 1rem 1.5rem; font-size: 0.85rem;">
                <code>python -m scanner scan --path "D:/Musik"</code>
            </div>
        </div>
    `;
}
