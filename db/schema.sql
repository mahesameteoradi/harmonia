-- ============================================================================
-- Harmonia — skema Postgres untuk Supabase
-- Jalankan di Supabase Dashboard -> SQL Editor -> New Query -> paste -> Run
--
-- CATATAN PENTING vs versi MySQL:
--   - Tidak ada CREATE DATABASE. Supabase sudah menyediakan database-nya.
--   - Semua tabel WAJIB punya RLS policy. Tanpa RLS, tabel bisa dibaca siapa saja
--     yang tahu anon key kamu (dan anon key itu memang publik di frontend).
--   - Tipe id pakai BIGINT GENERATED ALWAYS AS IDENTITY, bukan AUTO_INCREMENT.
--   - Kolom owner mengacu ke auth.users(id) bawaan Supabase Auth.
-- ============================================================================

-- Extension untuk fuzzy search sisi database (opsional tapi sangat berguna)
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- library

create table if not exists artists (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  name_norm   text not null,
  created_at  timestamptz not null default now(),
  unique (owner, name_norm)
);

create table if not exists albums (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  title_norm  text not null,
  artist_id   bigint references artists(id) on delete set null,
  year        smallint,
  cover_path  text,                 -- path di bucket 'covers', bukan URL penuh
  created_at  timestamptz not null default now(),
  unique (owner, title_norm, artist_id)
);

create table if not exists tracks (
  id            bigint generated always as identity primary key,
  owner         uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- storage_path = path di bucket 'audio', contoh: '<uid>/Queen/A Night at the Opera/03.mp3'
  -- TIDAK menyimpan URL. URL dibuat on-demand sebagai signed URL berumur pendek.
  storage_path  text not null,
  file_hash     text not null,      -- md5(1MB pertama + ukuran) — lihat ADR-004
  file_size     bigint not null,
  file_ext      text not null,

  title         text not null,
  title_norm    text not null,
  artist_id     bigint references artists(id) on delete set null,
  album_id      bigint references albums(id)  on delete set null,
  track_no      smallint,
  disc_no       smallint,
  duration_ms   integer,
  bitrate       integer,
  isrc          text,

  play_count    integer not null default 0,
  last_played   timestamptz,
  upload_status text not null default 'pending'
                check (upload_status in ('pending','uploaded','failed','local_only')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner, file_hash)
);

create index if not exists idx_tracks_owner        on tracks(owner);
create index if not exists idx_tracks_album        on tracks(album_id);
create index if not exists idx_tracks_artist       on tracks(artist_id);
create index if not exists idx_tracks_isrc         on tracks(isrc) where isrc is not null;
create index if not exists idx_tracks_title_trgm   on tracks using gin (title_norm gin_trgm_ops);
create index if not exists idx_tracks_status       on tracks(owner, upload_status);

-- ---------------------------------------------------------------- playlist

create table if not exists playlists (
  id                  bigint generated always as identity primary key,
  owner               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                text not null,
  description         text,
  source              text not null default 'local' check (source in ('local','imported')),
  cover_url           text,
  imported_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_playlists_owner on playlists(owner);

create table if not exists playlist_tracks (
  id               bigint generated always as identity primary key,
  playlist_id      bigint not null references playlists(id) on delete cascade,
  owner            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position         integer not null,
  track_id         bigint references tracks(id) on delete set null,   -- NULL = wishlist
  imported_track_id bigint,
  match_status     text not null default 'local'
                   check (match_status in ('local','matched','pending','not_found')),
  match_score      numeric(5,2),
  added_at         timestamptz not null default now(),
  unique (playlist_id, position)
);

create index if not exists idx_pt_playlist on playlist_tracks(playlist_id, position);
create index if not exists idx_pt_status   on playlist_tracks(playlist_id, match_status);

-- ---------------------------------------------------------------- import

-- Baris hasil parse daftar lagu yang di-paste/di-upload user.
-- Tidak ada koneksi ke layanan mana pun. Murni teks yang dibawa user sendiri.
create table if not exists imported_tracks (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_ref  text,                 -- URI/URL asli kalau ada, sekadar catatan
  title       text not null,
  title_norm  text not null,
  artist_name text not null,
  artist_norm text not null,
  album_name  text,
  duration_ms integer,
  isrc        text,
  cover_url   text,
  fetched_at  timestamptz not null default now(),
  unique (owner, source_ref)
);

create index if not exists idx_imp_norm on imported_tracks(owner, title_norm, artist_norm);

create table if not exists match_candidates (
  id               bigint generated always as identity primary key,
  owner            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  imported_track_id bigint not null references imported_tracks(id) on delete cascade,
  track_id         bigint not null references tracks(id) on delete cascade,
  score            numeric(5,2) not null,
  created_at       timestamptz not null default now(),
  unique (imported_track_id, track_id)
);


-- ---------------------------------------------------------------- trigger

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_tracks_updated on tracks;
create trigger trg_tracks_updated before update on tracks
  for each row execute function touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Tanpa blok ini, siapa pun yang punya anon key (yang memang publik) bisa
-- membaca dan menghapus seluruh library kamu. Jangan pernah dilewati.
-- ============================================================================

alter table artists          enable row level security;
alter table albums           enable row level security;
alter table tracks           enable row level security;
alter table playlists        enable row level security;
alter table playlist_tracks  enable row level security;
alter table imported_tracks  enable row level security;
alter table match_candidates enable row level security;

-- Policy generik: user hanya bisa menyentuh baris miliknya sendiri.
do $$
declare t text;
begin
  foreach t in array array['artists','albums','tracks','playlists',
                           'playlist_tracks','imported_tracks','match_candidates']
  loop
    execute format('drop policy if exists "own_select" on %I', t);
    execute format('drop policy if exists "own_write"  on %I', t);
    execute format($f$create policy "own_select" on %I
                      for select using (owner = auth.uid())$f$, t);
    execute format($f$create policy "own_write" on %I
                      for all using (owner = auth.uid())
                      with check (owner = auth.uid())$f$, t);
  end loop;
end $$;

-- Catatan: tidak ada tabel token/kredensial sama sekali di skema ini.
-- Aplikasi tidak terhubung ke layanan pihak ketiga mana pun, jadi tidak ada
-- secret yang perlu disimpan maupun dilindungi.

-- ============================================================================
-- STORAGE BUCKET
-- Jalankan setelah membuat bucket lewat Dashboard -> Storage:
--   bucket 'audio'  -> PRIVATE (diakses lewat signed URL)
--   bucket 'covers' -> PUBLIC  (cover art, aman dan hemat karena kena cache CDN)
-- ============================================================================

-- Konvensi path: '<user_uid>/<sisa path>'. Policy di bawah mengandalkan itu.
drop policy if exists "audio_own" on storage.objects;
create policy "audio_own" on storage.objects
  for all
  using      (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "covers_read" on storage.objects;
create policy "covers_read" on storage.objects
  for select using (bucket_id = 'covers');

drop policy if exists "covers_write_own" on storage.objects;
create policy "covers_write_own" on storage.objects
  for insert with check (bucket_id = 'covers'
                         and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- VIEW bantu: track lengkap dengan nama artis & album (hemat round-trip)
-- ============================================================================

create or replace view v_tracks as
select
  t.id, t.owner, t.title, t.title_norm, t.storage_path, t.file_ext,
  t.duration_ms, t.track_no, t.disc_no, t.play_count, t.last_played,
  t.upload_status, t.isrc,
  a.name  as artist_name,
  al.title as album_name,
  al.cover_path
from tracks t
left join artists a  on a.id  = t.artist_id
left join albums  al on al.id = t.album_id;

-- View mewarisi RLS dari tabel dasarnya selama security_invoker aktif:
alter view v_tracks set (security_invoker = on);
