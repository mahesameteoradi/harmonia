// Menulis public/js/env.js saat build.
// HANYA dua nilai ini yang boleh masuk. Keduanya memang dirancang publik;
// yang melindungi data adalah RLS, bukan kerahasiaan anon key.
//
// JANGAN PERNAH menambahkan SERVICE_ROLE_KEY atau SPOTIFY_CLIENT_SECRET di sini.
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('\n[inject-env] SUPABASE_URL / SUPABASE_ANON_KEY belum di-set.');
  console.error('[inject-env] Set di Vercel Settings -> Environment Variables,');
  console.error('[inject-env] atau jalankan: vercel env pull .env.local\n');
  process.exit(1);
}

const out = path.join(__dirname, '..', 'public', 'js', 'env.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `window.__ENV=${JSON.stringify({
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key,
})};\n`);

console.log('[inject-env] public/js/env.js dibuat');
