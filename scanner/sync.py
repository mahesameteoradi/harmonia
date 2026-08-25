from supabase import Client

def upsert_artist(supabase: Client, name: str) -> int:
    """Upsert artist dan kembalikan id-nya."""
    name_norm = name.lower().strip()
    # Coba insert (akan gagal kalau duplikat di owner + name_norm karena unique constraint)
    res = supabase.table('artists').upsert(
        {"name": name, "name_norm": name_norm},
        on_conflict="owner,name_norm"
    ).execute()
    return res.data[0]['id']

def upsert_album(supabase: Client, title: str, artist_id: int, year: int, cover_path: str = None) -> int:
    """Upsert album dan kembalikan id-nya."""
    title_norm = title.lower().strip()
    
    data = {
        "title": title,
        "title_norm": title_norm,
        "artist_id": artist_id
    }
    if year:
        data["year"] = year
    if cover_path:
        data["cover_path"] = cover_path
        
    res = supabase.table('albums').upsert(
        data,
        on_conflict="owner,title_norm,artist_id"
    ).execute()
    
    # Update cover_path jika ada yang baru tapi di DB belum ada/kosong
    if cover_path and res.data[0].get('cover_path') != cover_path:
        # Lakukan update
        supabase.table('albums').update({"cover_path": cover_path}).eq("id", res.data[0]['id']).execute()
        
    return res.data[0]['id']

def upsert_track_pending(supabase: Client, track_data: dict) -> int:
    """
    Upsert lagu dengan status 'pending'.
    track_data harus berisi field yang sesuai dengan tabel tracks.
    """
    track_data['upload_status'] = 'pending'
    # Pastikan unique constraint pada owner, file_hash
    res = supabase.table('tracks').upsert(
        track_data,
        on_conflict="owner,file_hash"
    ).execute()
    return res.data[0]['id']

def update_track_status(supabase: Client, file_hash: str, status: str):
    """
    Update status upload suatu track (misal: 'uploaded' atau 'failed').
    """
    supabase.table('tracks').update({"upload_status": status}).eq("file_hash", file_hash).execute()

def cleanup_pending(supabase: Client, uid: str):
    """
    Cari lagu yang statusnya 'pending', lalu hapus jika filenya memang tidak ada di Storage.
    Ini berguna jika proses upload dihentikan paksa (Ctrl+C).
    """
    res = supabase.table('tracks').select('id, file_hash, storage_path').eq('upload_status', 'pending').execute()
    pending_tracks = res.data
    
    if not pending_tracks:
        print("Tidak ada track yang berstatus pending.")
        return
        
    print(f"Mengecek {len(pending_tracks)} track pending...")
    
    # Dapatkan daftar file di bucket (ini hanya bekerja baik untuk jumlah kecil/sedang)
    # Pendekatan yang lebih aman adalah dengan mencoba mengambil stat file satu persatu atau folder.
    # Karena API list membatasi 100 per folder, kita periksa per file.
    deleted = 0
    for t in pending_tracks:
        path = t['storage_path']
        # Pisahkan nama file dan foldernya
        parts = path.split('/')
        folder = '/'.join(parts[:-1])
        filename = parts[-1]
        
        # List isi folder
        try:
            files_in_bucket = supabase.storage.from_('audio').list(folder)
            found = any(f['name'] == filename for f in files_in_bucket)
            if not found:
                supabase.table('tracks').delete().eq('id', t['id']).execute()
                deleted += 1
            else:
                # File ada di storage, ubah status jadi uploaded
                supabase.table('tracks').update({"upload_status": "uploaded"}).eq('id', t['id']).execute()
        except Exception as e:
            print(f"Error cek storage: {e}")
            
    print(f"Cleanup selesai. {deleted} track dihapus dari database.")
