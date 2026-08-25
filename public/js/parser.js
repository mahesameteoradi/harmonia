/**
 * parser.js — Parser CSV dan teks biasa untuk import daftar lagu.
 * Berjalan 100% di browser, tanpa koneksi ke layanan mana pun.
 */

/**
 * Deteksi format dan parse input teks menjadi array objek { title, artist, album?, duration? }
 */
export function parseInput(text) {
    // Bersihkan BOM dan whitespace
    text = text.replace(/^\uFEFF/, '').trim();
    if (!text) return [];
    
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    
    // Deteksi apakah ini CSV berheader
    const firstLine = lines[0].toLowerCase();
    const hasHeader = /title|track|song|artist|album|nama/i.test(firstLine);
    
    if (hasHeader || lines[0].split(',').length >= 3) {
        return parseCSV(text);
    }

    // Teks biasa: "Judul - Artis" atau "Artis - Judul"
    return parsePlainText(lines);
}

/**
 * Parse CSV (dengan handling quoted fields yang mengandung koma)
 */
function parseCSV(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Deteksi kolom
    const titleCol = headers.findIndex(h => /^(track.?name|title|song|judul|nama.?lagu)/i.test(h));
    const artistCol = headers.findIndex(h => /^(artist.?name|artist|artis|penyanyi)/i.test(h));
    const albumCol = headers.findIndex(h => /^(album.?name|album)/i.test(h));
    const durationCol = headers.findIndex(h => /^(duration|durasi|length)/i.test(h));

    if (titleCol === -1) return []; // minimal harus ada kolom judul

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[titleCol]?.trim()) continue;
        
        results.push({
            title: cols[titleCol].trim(),
            artist: artistCol !== -1 ? (cols[artistCol] || '').trim() : '',
            album: albumCol !== -1 ? (cols[albumCol] || '').trim() : '',
            duration_ms: durationCol !== -1 ? normalizeDuration(cols[durationCol]) : null,
        });
    }
    return results;
}

/**
 * Parse satu baris CSV dengan dukungan quoted fields
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += c;
        }
    }
    result.push(current);
    return result;
}

/**
 * Parse teks biasa, format: "Judul - Artis" per baris
 */
function parsePlainText(lines) {
    return lines.map(line => {
        // Coba pisahkan dengan " - " atau " – " atau tab
        const sep = line.includes(' - ') ? ' - ' 
                  : line.includes(' – ') ? ' – '
                  : line.includes('\t') ? '\t' 
                  : null;
        
        if (sep) {
            const parts = line.split(sep);
            return {
                title: parts[0].trim(),
                artist: parts.slice(1).join(sep).trim(),
                album: '',
                duration_ms: null,
            };
        }
        
        // Tidak ada separator yang terdeteksi
        return { title: line.trim(), artist: '', album: '', duration_ms: null };
    }).filter(t => t.title);
}

/**
 * Normalisasi durasi ke milidetik
 * Mendukung: "3:45", "225", "225000", "PT3M45S"
 */
function normalizeDuration(val) {
    if (!val) return null;
    val = String(val).trim();
    
    // Format mm:ss
    if (/^\d+:\d{2}$/.test(val)) {
        const [m, s] = val.split(':').map(Number);
        return (m * 60 + s) * 1000;
    }
    
    const n = parseInt(val);
    if (isNaN(n)) return null;
    if (n > 100_000) return n; // sudah dalam ms
    if (n > 1000) return n * 1000; // detik (1000+)
    return n * 1000; // detik
}
