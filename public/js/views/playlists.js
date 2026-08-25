import { supabase } from '../supabase.js';

export function renderPlaylists(container) {
    container.innerHTML = `
        <div class="page-header fade-in-up" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h1>Playlists</h1>
                <p>Kumpulan lagu favoritmu</p>
            </div>
            <button id="btn-create-playlist" class="btn btn-primary" style="width: auto; padding: 0.6rem 1.25rem; font-size: 0.9rem;">
                + Buat Playlist
            </button>
        </div>
        
        <div id="playlists-list" class="fade-in-up"></div>
        
        <!-- Create Modal -->
        <div id="playlist-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 300; display: none; align-items: center; justify-content: center;">
            <div class="glass-panel" style="width: 400px; max-width: 90vw; padding: 2rem;">
                <h3 style="margin-bottom: 1rem;">Buat Playlist Baru</h3>
                <div class="input-group">
                    <label>Nama Playlist</label>
                    <input type="text" id="playlist-name-input" placeholder="My Playlist">
                </div>
                <div class="input-group">
                    <label>Deskripsi (opsional)</label>
                    <input type="text" id="playlist-desc-input" placeholder="Koleksi lagu favorit...">
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button id="btn-save-playlist" class="btn btn-primary" style="flex: 1;">Simpan</button>
                    <button id="btn-cancel-playlist" class="btn" style="flex: 0.4; background: var(--surface); color: var(--text-muted); border: 1px solid var(--surface-border);">Batal</button>
                </div>
            </div>
        </div>
    `;

    loadPlaylists();
    
    // Create playlist
    const modal = document.getElementById('playlist-modal');
    document.getElementById('btn-create-playlist').addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    document.getElementById('btn-cancel-playlist').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    document.getElementById('btn-save-playlist').addEventListener('click', async () => {
        const name = document.getElementById('playlist-name-input').value.trim();
        if (!name) return;
        const desc = document.getElementById('playlist-desc-input').value.trim();
        
        const { error } = await supabase.from('playlists').insert({
            name,
            description: desc || null,
            source: 'local'
        });
        
        if (error) {
            alert('Gagal membuat playlist: ' + error.message);
        } else {
            modal.style.display = 'none';
            loadPlaylists();
        }
    });
}

async function loadPlaylists() {
    const listEl = document.getElementById('playlists-list');
    
    const { data: playlists, error } = await supabase
        .from('playlists')
        .select('id, name, description, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        listEl.innerHTML = `<p style="color: var(--danger);">Gagal memuat playlist: ${error.message}</p>`;
        return;
    }

    if (!playlists || playlists.length === 0) {
        listEl.innerHTML = `
            <div class="card-grid" style="margin-top: 0.5rem;">
                <div class="feature-card" style="cursor: pointer;" onclick="document.getElementById('btn-create-playlist').click()">
                    <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05));">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>
                    <h3>Buat Playlist Pertamamu</h3>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Kumpulkan lagu-lagu favoritmu dalam satu tempat.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05));">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </div>
                    <h3>Most Played</h3>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Otomatis terbentuk setelah kamu memutar lagu.</p>
                </div>
            </div>
        `;
        return;
    }

    // Render daftar playlist
    let html = '<div class="card-grid">';
    playlists.forEach(pl => {
        const date = new Date(pl.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        html += `
            <div class="feature-card" data-playlist-id="${pl.id}" style="cursor: pointer; position: relative;">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05));">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
                <h3>${pl.name}</h3>
                <p style="font-size: 0.8rem; margin-top: 0.25rem; color: var(--text-muted);">${pl.description || ''}</p>
                <p style="font-size: 0.75rem; margin-top: 0.5rem; color: rgba(148,163,184,0.5);">Dibuat ${date}</p>
                <button class="delete-playlist-btn" data-id="${pl.id}" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: var(--text-muted); cursor: pointer; opacity: 0.5; transition: opacity 0.2s;" title="Hapus playlist">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;
    });
    html += '</div>';
    listEl.innerHTML = html;

    // Delete handler
    listEl.querySelectorAll('.delete-playlist-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Hapus playlist ini?')) return;
            const { error } = await supabase.from('playlists').delete().eq('id', btn.dataset.id);
            if (!error) loadPlaylists();
        });
    });
}
