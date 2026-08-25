export function renderImport(container) {
    container.innerHTML = `
        <div class="page-header fade-in-up">
            <h1>Import Playlist</h1>
            <p>Bawa daftar lagumu dari layanan lain ke Harmonia</p>
        </div>
        
        <div class="import-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;" >
            
            <!-- Paste Text -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05)); display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    </div>
                    <h3>Paste Teks</h3>
                </div>
                <textarea 
                    style="width: 100%; height: 180px; background: rgba(0,0,0,0.25); border: 1px solid var(--surface-border); border-radius: 10px; color: var(--text-main); padding: 1rem; resize: vertical; font-family: inherit; font-size: 0.9rem; outline: none; transition: border-color 0.2s;" 
                    placeholder="Contoh:&#10;Bohemian Rhapsody - Queen&#10;Hotel California - Eagles&#10;Stairway to Heaven - Led Zeppelin"
                    onfocus="this.style.borderColor='var(--primary)'"
                    onblur="this.style.borderColor='var(--surface-border)'"
                ></textarea>
                <button class="btn btn-primary mt-4" onclick="alert('Fitur parsing akan tersedia di Fase 3!')">
                    Proses Teks
                </button>
            </div>
            
            <!-- Upload CSV -->
            <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05)); display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    </div>
                    <h3>Upload CSV</h3>
                </div>
                <div class="drop-zone" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p style="font-weight: 500; color: var(--text-main); font-size: 0.95rem;">Seret file CSV ke sini</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Atau klik untuk memilih file</p>
                </div>
            </div>

        </div>
        
        <!-- Panduan -->
        <div class="card-grid fade-in-up" style="margin-top: 1.5rem; animation-delay: 0.15s;">
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05));">
                    <span style="font-size: 1.1rem;">1️⃣</span>
                </div>
                <h3 style="font-size: 1rem;">Exportify</h3>
                <p style="font-size: 0.8rem; margin-top: 0.4rem;">Buka exportify.net → login Spotify → export playlist sebagai CSV.</p>
            </div>
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05));">
                    <span style="font-size: 1.1rem;">2️⃣</span>
                </div>
                <h3 style="font-size: 1rem;">TuneMyMusic</h3>
                <p style="font-size: 0.8rem; margin-top: 0.4rem;">Pilih sumber → pilih playlist → export ke file CSV.</p>
            </div>
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05));">
                    <span style="font-size: 1.1rem;">3️⃣</span>
                </div>
                <h3 style="font-size: 1rem;">Copy-Paste</h3>
                <p style="font-size: 0.8rem; margin-top: 0.4rem;">Dari Spotify desktop: Ctrl+A → Ctrl+C → paste ke textarea di atas.</p>
            </div>
        </div>
        
        <div class="glass-panel fade-in-up" style="margin-top: 1.25rem; padding: 1rem 1.5rem; animation-delay: 0.25s; border-left: 3px solid var(--accent);">
            <p style="font-size: 0.85rem; color: var(--text-muted);">
                <strong style="color: var(--text-main);">Catatan:</strong> Import hanya menyalin <em>daftar judul lagu</em>, bukan file audionya. Kamu tetap membutuhkan file musik (MP3/FLAC) sendiri yang diunggah melalui Scanner Lokal.
            </p>
        </div>
    `;
}
