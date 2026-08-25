import { supabase } from '../supabase.js';
import { parseInput } from '../parser.js';

export function renderImport(container) {
    container.innerHTML = `
        <div class="page-header fade-in-up">
            <h1>Import Playlist</h1>
            <p>Bawa daftar lagumu dari layanan lain ke Harmonia</p>
        </div>
        
        <div class="import-grid fade-in-up" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
            
            <!-- Paste Text -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05)); display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    </div>
                    <h3>Paste Teks</h3>
                </div>
                <textarea id="import-textarea"
                    style="width: 100%; height: 180px; background: rgba(0,0,0,0.25); border: 1px solid var(--surface-border); border-radius: 10px; color: var(--text-main); padding: 1rem; resize: vertical; font-family: inherit; font-size: 0.9rem; outline: none; transition: border-color 0.2s;" 
                    placeholder="Contoh:&#10;Bohemian Rhapsody - Queen&#10;Hotel California - Eagles&#10;&#10;Atau paste CSV dari Exportify/TuneMyMusic"
                ></textarea>
                <button id="btn-parse-text" class="btn btn-primary mt-4">
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
                <div class="drop-zone" id="csv-drop-zone" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <input type="file" id="csv-file-input" accept=".csv,.txt" style="display:none;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p style="font-weight: 500; color: var(--text-main); font-size: 0.95rem;">Seret file CSV ke sini</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Atau klik untuk memilih file</p>
                </div>
            </div>
        </div>
        
        <!-- Preview Area -->
        <div id="import-preview" style="display: none;" class="mt-6 fade-in-up"></div>
        
        <!-- Panduan -->
        <div class="card-grid fade-in-up" style="margin-top: 1.5rem;">
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05));">1️⃣</div>
                <h3 style="font-size: 1rem;">Exportify</h3>
                <p style="font-size: 0.8rem; margin-top: 0.4rem;">Buka exportify.net → login Spotify → export playlist sebagai CSV.</p>
            </div>
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05));">2️⃣</div>
                <h3 style="font-size: 1rem;">TuneMyMusic</h3>
                <p style="font-size: 0.8rem; margin-top: 0.4rem;">Pilih sumber → pilih playlist → export ke file CSV.</p>
            </div>
            <div class="feature-card">
                <div class="feature-card-icon" style="background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05));">3️⃣</div>
                <h3 style="font-size: 1rem;">Copy-Paste</h3>
                <p style="font-size: 0.8rem; margin-top: 0.4rem;">Dari Spotify desktop: Ctrl+A → Ctrl+C → paste ke textarea di atas.</p>
            </div>
        </div>
    `;

    // Event handlers
    const textarea = document.getElementById('import-textarea');
    const parseBtn = document.getElementById('btn-parse-text');
    const dropZone = document.getElementById('csv-drop-zone');
    const fileInput = document.getElementById('csv-file-input');
    const previewEl = document.getElementById('import-preview');

    // Tombol parse teks
    parseBtn.addEventListener('click', () => {
        const text = textarea.value;
        if (!text.trim()) return;
        const parsed = parseInput(text);
        showPreview(parsed, previewEl);
    });

    // Klik drop zone -> buka file picker
    dropZone.addEventListener('click', () => fileInput.click());
    
    // File dipilih
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) readAndParse(file, previewEl);
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
        dropZone.style.background = 'rgba(139,92,246,0.08)';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) readAndParse(file, previewEl);
    });
}

function readAndParse(file, previewEl) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const parsed = parseInput(text);
        showPreview(parsed, previewEl);
    };
    reader.readAsText(file);
}

let parsedData = []; // simpan sementara untuk save

function showPreview(items, previewEl) {
    parsedData = items;
    if (items.length === 0) {
        previewEl.style.display = 'block';
        previewEl.innerHTML = `
            <div class="glass-panel" style="padding: 1.5rem; border-left: 3px solid var(--danger);">
                <p style="color: var(--danger); font-weight: 500;">Tidak ada lagu yang terdeteksi.</p>
                <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem;">Pastikan format teks berupa "Judul - Artis" per baris, atau CSV dengan header kolom.</p>
            </div>
        `;
        return;
    }

    // Preview 5 baris pertama + total
    const preview = items.slice(0, 5);
    
    let html = `
        <div class="glass-panel" style="padding: 1.5rem; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Preview (${items.length} lagu terdeteksi)</h3>
                <button id="btn-swap-cols" class="player-btn" title="Tukar Kolom Judul ↔ Artis" style="color: var(--primary); font-size: 0.85rem; padding: 0.4rem 0.75rem; border: 1px solid var(--primary); border-radius: 8px;">
                    ↔ Tukar Kolom
                </button>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted);">
                            <th style="padding: 0.5rem; text-align: left;">#</th>
                            <th style="padding: 0.5rem; text-align: left;">Judul</th>
                            <th style="padding: 0.5rem; text-align: left;">Artis</th>
                            <th style="padding: 0.5rem; text-align: left;">Album</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    preview.forEach((item, i) => {
        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 0.5rem; color: var(--text-muted);">${i + 1}</td>
                <td style="padding: 0.5rem;">${item.title}</td>
                <td style="padding: 0.5rem; color: var(--text-muted);">${item.artist || '-'}</td>
                <td style="padding: 0.5rem; color: var(--text-muted);">${item.album || '-'}</td>
            </tr>
        `;
    });

    if (items.length > 5) {
        html += `<tr><td colspan="4" style="padding: 0.5rem; color: var(--text-muted); font-style: italic;">... dan ${items.length - 5} lagu lainnya</td></tr>`;
    }

    html += `
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 1.25rem; display: flex; gap: 1rem;">
                <button id="btn-save-import" class="btn btn-primary" style="flex: 1;">
                    Simpan ${items.length} Lagu ke Database
                </button>
                <button id="btn-cancel-import" class="btn" style="flex: 0.3; background: var(--surface); color: var(--text-muted); border: 1px solid var(--surface-border);">
                    Batal
                </button>
            </div>
        </div>
    `;

    previewEl.style.display = 'block';
    previewEl.innerHTML = html;

    // Tukar kolom
    document.getElementById('btn-swap-cols').addEventListener('click', () => {
        parsedData = parsedData.map(item => ({
            ...item,
            title: item.artist || item.title,
            artist: item.title,
        }));
        showPreview(parsedData, previewEl);
    });

    // Simpan
    document.getElementById('btn-save-import').addEventListener('click', () => saveImport(previewEl));
    
    // Batal
    document.getElementById('btn-cancel-import').addEventListener('click', () => {
        previewEl.style.display = 'none';
        parsedData = [];
    });
}

async function saveImport(previewEl) {
    const btn = document.getElementById('btn-save-import');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
        // Simpan ke tabel imported_tracks
        const rows = parsedData.map(item => ({
            title: item.title,
            title_norm: item.title.toLowerCase().trim(),
            artist_name: item.artist || 'Unknown Artist',
            artist_norm: (item.artist || 'unknown artist').toLowerCase().trim(),
            album_name: item.album || null,
            duration_ms: item.duration_ms || null,
        }));

        // Batch insert (50 per batch)
        let saved = 0;
        for (let i = 0; i < rows.length; i += 50) {
            const batch = rows.slice(i, i + 50);
            const { error } = await supabase.table('imported_tracks').upsert(batch, { 
                onConflict: 'owner,source_ref',
                ignoreDuplicates: true 
            });
            if (error) {
                // Coba insert satu-satu jika batch gagal
                for (const row of batch) {
                    const { error: singleErr } = await supabase.from('imported_tracks').insert(row);
                    if (!singleErr) saved++;
                }
            } else {
                saved += batch.length;
            }
        }

        previewEl.innerHTML = `
            <div class="glass-panel fade-in-up" style="padding: 2rem; text-align: center; border-left: 3px solid var(--success);">
                <div style="font-size: 2rem; margin-bottom: 0.75rem;">✅</div>
                <h3>Import Berhasil!</h3>
                <p class="text-muted mt-2">${saved} lagu berhasil disimpan ke database.</p>
                <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem;">Lagu-lagu ini akan dicocokkan dengan library lokalmu secara otomatis.</p>
            </div>
        `;
        parsedData = [];
    } catch (e) {
        console.error('Gagal menyimpan import:', e);
        btn.disabled = false;
        btn.textContent = 'Coba Lagi';
        previewEl.innerHTML += `<p style="color: var(--danger); margin-top: 1rem;">Error: ${e.message}</p>`;
    }
}
