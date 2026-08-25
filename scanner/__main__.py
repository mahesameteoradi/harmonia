import argparse
import os
import sys
import uuid
from pathlib import Path

from .auth import login, get_client
from .tags import read_tags, file_hash, extract_cover, resize_cover
from .uploader import upload_audios_parallel, upload_cover, get_mime
from .sync import upsert_artist, upsert_album, upsert_track_pending, update_track_status, cleanup_pending

MAX_FILE = 50 * 1024 * 1024 # 50 MB
QUOTA = 1024 * 1024 * 1024  # 1 GB
ALLOWED_EXT = {'.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav'}

def get_audio_files(directory: str):
    """Mencari semua file audio di folder (rekursif)."""
    base = Path(directory)
    files = []
    for ext in ALLOWED_EXT:
        files.extend(base.rglob(f"*{ext}"))
        files.extend(base.rglob(f"*{ext.upper()}"))
    # Hapus duplikat karena case insensitivity (rglob Windows)
    return list(set(files))

def print_status(supabase):
    """Cek pemakaian storage (estimasi dari tabel tracks)."""
    res = supabase.table('tracks').select('file_size').execute()
    used = sum(t['file_size'] for t in res.data)
    print(f"=== Status Storage ===")
    print(f"Terpakai: {used / 1e6:.1f} MB dari {QUOTA / 1e6:.1f} MB ({(used / QUOTA) * 100:.1f}%)")
    print(f"Sisa: {(QUOTA - used) / 1e6:.1f} MB")
    return used

def main():
    parser = argparse.ArgumentParser(description="Harmonia Scanner Lokal")
    parser.add_argument("command", choices=["login", "scan", "status", "cleanup", "download-missing"])
    parser.add_argument("--path", type=str, help="Path ke folder musik")
    parser.add_argument("--dry-run", action="store_true", help="Simulasi tanpa upload/ubah data")
    
    args = parser.parse_args()
    
    if args.command == "login":
        login()
        sys.exit(0)
        
    supabase = get_client()
    user_uid = supabase.auth.get_user().user.id
    
    if args.command == "status":
        print_status(supabase)
        sys.exit(0)
        
    if args.command == "cleanup":
        cleanup_pending(supabase, user_uid)
        sys.exit(0)
        
    if args.command == "download-missing":
        from .downloader import download_track, inject_m4a_tags
        print("Mengambil daftar lagu hasil import...")
        
        # Ambil imported tracks
        res_import = supabase.table('imported_tracks').select('*').execute()
        imported = res_import.data
        
        # Ambil tracks lokal yang sudah ada
        res_tracks = supabase.table('tracks').select('title_norm, artist_id').execute()
        # Harus mapping artist_id ke artist_name_norm, tapi untuk simple approach kita cukup fetch nama artist dari tabel artists
        res_artists = supabase.table('artists').select('id, name_norm').execute()
        artist_map = {a['id']: a['name_norm'] for a in res_artists.data}
        
        local_tracks = {(t['title_norm'], artist_map.get(t['artist_id'], '')) for t in res_tracks.data}
        
        missing = []
        for imp in imported:
            title_norm = imp['title_norm']
            artist_norm = imp['artist_norm']
            if (title_norm, artist_norm) not in local_tracks:
                missing.append(imp)
                
        if not missing:
            print("Semua lagu import sudah ada di library lokal.")
            sys.exit(0)
            
        print(f"Ditemukan {len(missing)} lagu yang belum ada di library lokal. Mulai mendownload...")
        
        download_dir = Path("downloads")
        download_dir.mkdir(exist_ok=True)
        
        cached_artists = {}
        cached_albums = {}
        audio_uploads = []
        
        for imp in missing:
            query = f"{imp['title']} {imp['artist_name']}"
            print(f"\nMendownload: {query}")
            file_path = download_track(query, str(download_dir))
            
            if not file_path:
                print(f"❌ Gagal menemukan/mendownload {query}")
                continue
                
            print(f"✔ Berhasil didownload. Menyuntikkan tags...")
            inject_m4a_tags(file_path, imp['title'], imp['artist_name'], imp['album_name'])
            
            artist_name = imp['artist_name']
            album_name = imp['album_name'] or "Unknown Album"
            
            if artist_name not in cached_artists:
                cached_artists[artist_name] = upsert_artist(supabase, artist_name)
            artist_id = cached_artists[artist_name]
            
            cache_key_album = f"{artist_id}_{album_name}"
            if cache_key_album not in cached_albums:
                cached_albums[cache_key_album] = {
                    'id': upsert_album(supabase, album_name, artist_id, None, None),
                }
            album_id = cached_albums[cache_key_album]['id']
            
            fhash = file_hash(file_path)
            ext = Path(file_path).suffix.lower()
            
            safe_artist = "".join(c for c in artist_name if c.isalnum() or c in " -_")[:30]
            safe_album = "".join(c for c in album_name if c.isalnum() or c in " -_")[:30]
            safe_title = "".join(c for c in imp['title'] if c.isalnum() or c in " -_")[:40]
            if not safe_artist: safe_artist = "Unknown"
            if not safe_album: safe_album = "Unknown"
            if not safe_title: safe_title = "Track"
            
            storage_path = f"{user_uid}/{safe_artist}/{safe_album}/{safe_title}_{fhash[:6]}{ext}"
            
            track_data = {
                "storage_path": storage_path,
                "file_hash": fhash,
                "file_size": Path(file_path).stat().st_size,
                "file_ext": ext,
                "title": imp['title'],
                "title_norm": imp['title_norm'],
                "artist_id": artist_id,
                "album_id": album_id,
                "track_no": None,
                "disc_no": None,
                "duration_ms": imp['duration_ms'],
                "bitrate": 192000,
                "isrc": None
            }
            
            upsert_track_pending(supabase, track_data)
            audio_uploads.append((file_path, storage_path, fhash))
            
        if not audio_uploads:
            print("Tidak ada file yang berhasil diproses.")
            sys.exit(1)
            
        print(f"\nMengunggah {len(audio_uploads)} lagu ke Storage...")
        upload_queue = [(item[0], item[1]) for item in audio_uploads]
        
        success_count = 0
        for i, result in enumerate(upload_audios_parallel(supabase, upload_queue)):
            status, local_p = result
            fhash = next(item[2] for item in audio_uploads if item[0] == local_p)
            
            if status == 'ok':
                update_track_status(supabase, fhash, 'uploaded')
                success_count += 1
                try:
                    os.remove(local_p)
                except:
                    pass
            else:
                update_track_status(supabase, fhash, 'failed')
                print(f"Gagal upload ({status}): {local_p}")
                
            print(f"Progress: {i+1}/{len(audio_uploads)}", end='\r')
            
        print(f"\nSelesai! Berhasil mengunggah: {success_count}/{len(audio_uploads)}.")
        sys.exit(0)

    if args.command == "scan":
        if not args.path:
            print("Error: Argumen --path wajib diisi untuk command scan.")
            sys.exit(1)
            
        folder_path = Path(args.path)
        if not folder_path.exists() or not folder_path.is_dir():
            print(f"Error: Path {args.path} tidak ditemukan atau bukan folder.")
            sys.exit(1)
            
        print("Memindai file lokal...")
        files = get_audio_files(args.path)
        
        # PREFLIGHT CHECK
        total_size = sum(f.stat().st_size for f in files)
        too_big = [f for f in files if f.stat().st_size > MAX_FILE]
        
        print(f"\nDitemukan {len(files)} file audio, total {total_size / 1e6:.0f} MB")
        
        if too_big:
            print(f"⚠ {len(too_big)} file melebihi 50 MB (batas Free tier) dan akan dilewati:")
            for f in too_big[:5]:
                print(f"   - {f.name} ({f.stat().st_size / 1e6:.1f} MB)")
            if len(too_big) > 5:
                print(f"   - ... (dan {len(too_big)-5} lainnya)")
            
            # Filter file yang terlalu besar
            files = [f for f in files if f.stat().st_size <= MAX_FILE]
            total_size = sum(f.stat().st_size for f in files)
        
        if not args.dry_run:
            used = print_status(supabase)
            if used + total_size > QUOTA:
                print(f"\n⚠ DITOLAK: Melebihi kuota 1 GB (sisa {(QUOTA-used)/1e6:.1f} MB, butuh {total_size/1e6:.1f} MB).")
                sys.exit(1)
        
        if args.dry_run:
            print("\n[DRY RUN] Tidak ada file yang diunggah.")
            print(f"File siap diproses: {len(files)}")
            sys.exit(0)
            
        print("\nMemulai proses sinkronisasi...")
        
        # Ekstrak tags dan upsert DB secara berurutan, simpan path untuk batch upload
        audio_uploads = [] # list of (local_path, storage_path)
        album_covers = {}  # album_id -> local_path_of_first_song
        
        # Untuk optimalisasi
        cached_artists = {}
        cached_albums = {}
        
        for fpath in files:
            tags = read_tags(str(fpath))
            if not tags:
                continue
                
            artist_name = tags['artist']
            album_name = tags['album']
            
            # Hindari roundtrip DB berulang untuk artist yang sama (cache lokal per sesi)
            if artist_name not in cached_artists:
                cached_artists[artist_name] = upsert_artist(supabase, artist_name)
            artist_id = cached_artists[artist_name]
            
            cache_key_album = f"{artist_id}_{album_name}"
            if cache_key_album not in cached_albums:
                # Siapkan struktur cover_path. Satu cover per album.
                cover_filename = f"{uuid.uuid4().hex[:8]}.jpg"
                cover_storage_path = f"{user_uid}/covers/{cover_filename}"
                cached_albums[cache_key_album] = {
                    'id': upsert_album(supabase, album_name, artist_id, tags['year'], cover_storage_path),
                    'cover_path': cover_storage_path,
                    'cover_uploaded': False
                }
                # Simpan fpath ini untuk nanti kita ekstrak gambarnya
                album_covers[cached_albums[cache_key_album]['id']] = str(fpath)
                
            album_info = cached_albums[cache_key_album]
            album_id = album_info['id']
            
            fhash = file_hash(str(fpath))
            ext = fpath.suffix.lower()
            
            # Buat storage path untuk audio: <uid>/<artist>/<album>/<title>.ext
            # Sanitasi nama agar aman di URL
            safe_artist = "".join(c for c in artist_name if c.isalnum() or c in " -_")[:30]
            safe_album = "".join(c for c in album_name if c.isalnum() or c in " -_")[:30]
            safe_title = "".join(c for c in tags['title'] if c.isalnum() or c in " -_")[:40]
            if not safe_artist: safe_artist = "Unknown"
            if not safe_album: safe_album = "Unknown"
            if not safe_title: safe_title = "Track"
            
            storage_path = f"{user_uid}/{safe_artist}/{safe_album}/{safe_title}_{fhash[:6]}{ext}"
            
            track_data = {
                "storage_path": storage_path,
                "file_hash": fhash,
                "file_size": fpath.stat().st_size,
                "file_ext": ext,
                "title": tags['title'],
                "title_norm": tags['title'].lower().strip(),
                "artist_id": artist_id,
                "album_id": album_id,
                "track_no": tags['track_no'],
                "disc_no": tags['disc_no'],
                "duration_ms": tags['duration_ms'],
                "bitrate": tags['bitrate'],
                "isrc": tags['isrc']
            }
            
            # Upsert DB dengan status pending
            upsert_track_pending(supabase, track_data)
            audio_uploads.append((str(fpath), storage_path, fhash))

        # Ekstrak dan Upload Cover (satu per album)
        print("\nMemproses cover album...")
        for album_id, cover_file_path in album_covers.items():
            # Cari informasi album di dictionary
            album_info = next(a for a in cached_albums.values() if a['id'] == album_id)
            if not album_info['cover_uploaded']:
                cover_bytes = extract_cover(cover_file_path)
                resized = resize_cover(cover_bytes)
                if resized:
                    success = upload_cover(supabase, resized, album_info['cover_path'])
                    if success:
                        album_info['cover_uploaded'] = True
                
        # Upload Audio Paralel
        print(f"\nMengunggah {len(audio_uploads)} lagu ke Storage...")
        # Hilangkan tuple ke-3 (fhash) untuk pemetaan ke upload_audios_parallel
        upload_queue = [(item[0], item[1]) for item in audio_uploads]
        
        success_count = 0
        for i, result in enumerate(upload_audios_parallel(supabase, upload_queue)):
            status, local_p = result
            # Cari fhash dari local_p
            fhash = next(item[2] for item in audio_uploads if item[0] == local_p)
            
            if status == 'ok':
                update_track_status(supabase, fhash, 'uploaded')
                success_count += 1
            else:
                update_track_status(supabase, fhash, 'failed')
                print(f"Gagal ({status}): {local_p}")
                
            print(f"Progress: {i+1}/{len(audio_uploads)}", end='\r')
            
        print(f"\nSelesai! Berhasil mengunggah: {success_count}/{len(audio_uploads)}.")

if __name__ == "__main__":
    main()
