export function renderPlaylists(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-end;" class="mb-6">
            <div>
                <h1 class="mb-2">Playlists</h1>
                <p class="text-muted">Kumpulan lagu favoritmu.</p>
            </div>
            <button class="btn btn-primary" style="padding: 0.5rem 1rem; border-radius: 8px; border: none; background: #8a2be2; color: white; cursor: pointer;">
                + Buat Playlist
            </button>
        </div>
        
        <div class="glass-panel" style="padding: 4rem 2rem; text-align: center;">
            <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;">📝</div>
            <h3 class="text-main">Belum Ada Playlist</h3>
            <p class="text-muted mt-2">Fitur pengelolaan Playlist akan segera hadir di sini (Fase 2).</p>
        </div>
    `;
}
