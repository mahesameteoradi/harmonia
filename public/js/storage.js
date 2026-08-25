import { supabase } from './supabase.js';

// Cache signed URL agar tidak meminta ulang setiap klik
const urlCache = new Map(); // path -> { url, expiresAt }

export async function getPlayUrl(storagePath) {
    const { data, error } = await supabase
        .storage.from('audio')
        .createSignedUrl(storagePath, 3600); // berlaku 1 jam
    if (error) throw new Error('Gagal membuat URL: ' + error.message);
    return data.signedUrl;
}

export async function cachedUrl(path, opts = {}) {
    if (!opts.force) {
        const hit = urlCache.get(path);
        if (hit && hit.expiresAt > Date.now() + 60_000) return hit.url;
    }
    const url = await getPlayUrl(path);
    urlCache.set(path, { url, expiresAt: Date.now() + 3600_000 });
    return url;
}

export function getCoverUrl(coverPath) {
    if (!coverPath) return null;
    const { data } = supabase.storage.from('covers').getPublicUrl(coverPath);
    return data.publicUrl;
}
