import { supabase } from '../supabase.js';

export async function renderLibrary(container) {
    container.innerHTML = `
        <h1 class="mb-4">Perpustakaan Musik</h1>
        <p class="text-muted">Koleksi lagu lokal Anda.</p>
        
        <div id="library-loading" class="text-center mt-6">
            <p class="text-muted">Memuat daftar lagu...</p>
        </div>
        
        <div id="library-content" style="display: none;" class="mt-6">
            <div class="glass-panel" style="padding: 0; overflow: hidden;">
                <table class="w-100" style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); font-size: 0.9rem;">
                            <th style="padding: 1rem;">#</th>
                            <th style="padding: 1rem;">Judul</th>
                            <th style="padding: 1rem;">Album</th>
                            <th style="padding: 1rem; text-align: right;">Durasi</th>
                        </tr>
                    </thead>
                    <tbody id="library-table-body">
                        <!-- Data akan dimasukkan di sini -->
                    </tbody>
                </table>
            </div>
        </div>
        
        <div id="library-empty" class="glass-panel" style="display: none; padding: 3rem; margin-top: 2rem; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎵</div>
            <h3 class="text-main">Library Kosong</h3>
            <p class="text-muted mt-2">Jalankan <code>python -m scanner scan --path "Folder Musik"</code> di komputermu untuk mengunggah lagu.</p>
        </div>
    `;

    try {
        // Menggunakan view v_tracks seperti di T2.3
        const { data: tracks, error } = await supabase
            .from('v_tracks')
            .select('*')
            .eq('upload_status', 'uploaded')
            .order('artist_name', { ascending: true })
            .order('album_name', { ascending: true })
            .order('track_no', { ascending: true })
            .limit(50); // Pagination tahap 1

        if (error) throw error;

        document.getElementById('library-loading').style.display = 'none';

        if (!tracks || tracks.length === 0) {
            document.getElementById('library-empty').style.display = 'block';
            return;
        }

        const tbody = document.getElementById('library-table-body');
        document.getElementById('library-content').style.display = 'block';

        tracks.forEach((track, index) => {
            const tr = document.createElement('tr');
            tr.className = 'track-row';
            tr.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; cursor: pointer;';
            tr.onmouseover = () => tr.style.background = 'rgba(255,255,255,0.05)';
            tr.onmouseout = () => tr.style.background = 'transparent';
            
            // Format waktu ms ke mm:ss
            let durationStr = "-:--";
            if (track.duration_ms) {
                const s = Math.floor(track.duration_ms / 1000);
                durationStr = Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
            }

            tr.innerHTML = `
                <td style="padding: 1rem; color: var(--text-muted);">${index + 1}</td>
                <td style="padding: 1rem;">
                    <div style="font-weight: 500; color: var(--text-main);">${track.title}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${track.artist_name || 'Unknown Artist'}</div>
                </td>
                <td style="padding: 1rem; color: var(--text-muted);">${track.album_name || 'Unknown Album'}</td>
                <td style="padding: 1rem; text-align: right; color: var(--text-muted);">${durationStr}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Gagal memuat library:", e);
        container.innerHTML += `<p style="color: #ff6b6b; margin-top: 1rem;">Gagal memuat daftar lagu: ${e.message}</p>`;
    }
}
