export function renderPlaylists(container) {
    container.innerHTML = `
        <div class="page-header fade-in-up">
            <h1>Playlists</h1>
            <p>Kumpulan lagu favoritmu</p>
        </div>
        
        <div class="card-grid fade-in-up" style="animation-delay: 0.1s;">
            <div class="feature-card" style="cursor: pointer;" onclick="alert('Fitur akan tersedia di Fase 2!')">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05));">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <h3>Buat Playlist Baru</h3>
                <p style="font-size: 0.85rem; margin-top: 0.5rem;">Kumpulkan lagu-lagu favoritmu dalam satu tempat.</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05));">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <h3>Most Played</h3>
                <p style="font-size: 0.85rem; margin-top: 0.5rem;">Daftar otomatis lagu yang paling sering kamu putar.</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(236,72,153,0.2), rgba(236,72,153,0.05));">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <h3>Favorit</h3>
                <p style="font-size: 0.85rem; margin-top: 0.5rem;">Lagu-lagu yang kamu tandai sebagai favorit.</p>
            </div>
        </div>
        
        <div class="glass-panel fade-in-up" style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; animation-delay: 0.2s; border-left: 3px solid var(--primary);">
            <p style="font-size: 0.9rem; color: var(--text-muted);">
                <strong style="color: var(--text-main);">Segera Hadir</strong> — Fitur pengelolaan playlist lengkap (buat, edit, hapus, dan reorder lagu) akan dibangun pada tahap berikutnya.
            </p>
        </div>
    `;
}
