export function renderImport(container) {
    container.innerHTML = `
        <h1 class="mb-4">Import Playlist</h1>
        <p class="text-muted">Salin daftar lagumu dari layanan lain dan paste di sini.</p>
        
        <div class="glass-panel mt-6" style="padding: 2rem;">
            <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                
                <div style="flex: 1; min-width: 300px;">
                    <h3 class="mb-4" style="font-size: 1.1rem;">Paste Daftar Lagu</h3>
                    <textarea 
                        style="width: 100%; height: 200px; background: rgba(0,0,0,0.2); border: 1px solid var(--surface-border); border-radius: 8px; color: var(--text-main); padding: 1rem; resize: vertical;" 
                        placeholder="Contoh:&#10;Bohemian Rhapsody - Queen&#10;Hotel California - Eagles"
                    ></textarea>
                    <button class="btn mt-4" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: none; background: #8a2be2; color: white; cursor: pointer; font-weight: 500;">
                        Proses Teks
                    </button>
                </div>
                
                <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column;">
                    <h3 class="mb-4" style="font-size: 1.1rem;">Upload CSV</h3>
                    <div style="flex: 1; border: 2px dashed var(--surface-border); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                        <div style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--text-muted);">📁</div>
                        <p style="font-weight: 500; color: var(--text-main);">Pilih File CSV</p>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; text-align: center;">Export dari Exportify atau TuneMyMusic</p>
                    </div>
                </div>

            </div>
            
            <div class="mt-6" style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px; border-left: 4px solid #8a2be2;">
                <p style="font-size: 0.9rem; color: var(--text-muted);">
                    <strong>Catatan:</strong> Fitur fungsional import dan pencocokan ini akan dibangun pada Fase 3.
                </p>
            </div>
        </div>
    `;
}
