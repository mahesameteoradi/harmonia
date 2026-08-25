# SKILL: Supabase Data Layer (Postgres + RLS + Auth)

**Kapan dibaca:** sebelum menulis query apa pun, membuat tabel, atau menyentuh auth.

---

## Inisialisasi client

Satu instance untuk seluruh aplikasi. Taruh di `public/js/supabase.js`:

```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Nilai ini ditulis saat build oleh scripts/inject-env.js — lihat docs/DEPLOY.md
export const supabase = createClient(
  window.__ENV.SUPABASE_URL,
  window.__ENV.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
```

**Anon key aman berada di frontend.** Itu memang dirancang publik — yang melindungi data
adalah RLS, bukan kerahasiaan key. Yang **tidak boleh** ada di frontend adalah
`service_role` key, karena key itu mem-bypass RLS sepenuhnya.

---

## Pola error handling

Supabase **tidak melempar exception**. Dia mengembalikan `{ data, error }`. Kalau kamu
lupa mengecek `error`, kegagalan akan tampak seperti "data kosong" dan kamu akan
menghabiskan satu jam mengira query-nya salah.

```javascript
const { data, error } = await supabase.from('v_tracks').select('...');
if (error) {
  console.error('[tracks]', error.message, error.code);
  showToast('Gagal memuat lagu: ' + error.message);
  return [];
}
```

Kode error yang sering muncul:

| Kode | Arti |
|---|---|
| `PGRST116` | Baris tidak ditemukan (pakai `.maybeSingle()` kalau ini normal) |
| `42501` | RLS menolak. Bukan bug query — policy-nya kurang, atau user belum login |
| `23505` | Unique constraint kena — biasanya scanner mengunggah file yang sama dua kali |
| `PGRST301` | JWT kedaluwarsa — pastikan `autoRefreshToken: true` |

---

## Query yang hemat egress

Egress dihitung per byte yang keluar. `select('*')` pada 10.000 baris bisa menghabiskan
puluhan MB tanpa alasan.

```javascript
// ❌ boros
supabase.from('tracks').select('*')

// ✅ sebutkan kolomnya, pakai view yang sudah di-join, dan selalu paginate
const { data, error, count } = await supabase
  .from('v_tracks')
  .select('id,title,artist_name,album_name,duration_ms,cover_path', { count: 'exact' })
  .order('title')
  .range(offset, offset + 49);          // 50 baris per halaman
```

Search dengan trigram index yang sudah dibuat di schema:

```javascript
.or(`title_norm.ilike.%${q}%,artist_name.ilike.%${q}%`)
```

Untuk library besar, lebih baik bikin RPC function di Postgres daripada mengirim
banyak query dari browser:

```sql
create or replace function search_tracks(q text, lim int default 50)
returns setof v_tracks language sql stable security invoker as $$
  select * from v_tracks
  where title_norm % q or artist_name ilike '%'||q||'%'
  order by similarity(title_norm, q) desc
  limit lim;
$$;
```

```javascript
const { data } = await supabase.rpc('search_tracks', { q: query, lim: 50 });
```

---

## Auth (single user)

```javascript
// Login
const { error } = await supabase.auth.signInWithPassword({ email, password });

// Cek sesi saat aplikasi dimuat
const { data: { session } } = await supabase.auth.getSession();
if (!session) showLoginScreen();

// Reaksi terhadap perubahan sesi — WAJIB dipasang, kalau tidak user akan
// tiba-tiba melihat error 42501 saat token kedaluwarsa
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') showLoginScreen();
  if (event === 'TOKEN_REFRESHED') refreshSignedUrls();   // signed URL lama ikut basi
});
```

Buat akun user lewat Dashboard → Authentication → Add User, lalu **matikan signup publik**
(Authentication → Providers → Email → nonaktifkan "Enable Sign Ups"). Ini aplikasi pribadi;
tidak ada alasan orang lain bisa mendaftar.

---

## Menulis data

Kolom `owner` punya `default auth.uid()`, jadi tidak perlu diisi manual dari frontend:

```javascript
const { data, error } = await supabase
  .from('playlists')
  .insert({ name: 'Santai Sore' })
  .select('id')
  .single();
```

Upsert untuk scanner (idempoten — rescan tidak menduplikasi):

```python
supabase.table('tracks').upsert(rows, on_conflict='owner,file_hash').execute()
```

Reorder playlist — jangan kirim 50 update terpisah. Pakai satu RPC:

```sql
create or replace function reorder_playlist(p_id bigint, track_ids bigint[])
returns void language plpgsql security invoker as $$
begin
  delete from playlist_tracks where playlist_id = p_id;
  insert into playlist_tracks (playlist_id, position, track_id)
  select p_id, i, track_ids[i] from generate_subscripts(track_ids, 1) i;
end $$;
```

---

## Jebakan

- **RLS aktif tapi tidak ada policy = semua ditolak.** Gejalanya tabel tampak kosong padahal
  datanya ada. Cek dengan menjalankan query yang sama di SQL Editor (di sana kamu jadi superuser).
- **View perlu `security_invoker = on`**, kalau tidak view akan mem-bypass RLS tabel dasarnya.
  Sudah diatur di `schema.sql`, jangan dihapus.
- **Project free auto-pause setelah ~1 minggu tanpa aktivitas.** Kalau aplikasi tiba-tiba
  mati total, cek dashboard dulu sebelum men-debug kode.
- **Batas koneksi**: 60 direct, 200 pooler. Untuk scanner yang mengunggah paralel, batasi
  concurrency ke 4–8 worker, jangan 50.
- Jangan menyimpan data besar (blob, base64, log panjang) di kolom Postgres — kuota
  database hanya 500 MB dan itu jauh lebih mahal daripada Storage.
