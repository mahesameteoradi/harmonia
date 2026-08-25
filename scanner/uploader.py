import time
import mimetypes
from concurrent.futures import ThreadPoolExecutor
from supabase import Client

def get_mime(path: str) -> str:
    ext = path.split('.')[-1].lower()
    if ext == 'm4a':
        return 'audio/mp4' # Safari fix (ADR)
    mime, _ = mimetypes.guess_type(path)
    return mime or 'application/octet-stream'

def upload_audio(supabase: Client, local_path: str, storage_path: str, attempt=0):
    """
    Mengunggah file audio ke bucket 'audio' dengan exponential backoff retry.
    """
    try:
        with open(local_path, 'rb') as f:
            supabase.storage.from_('audio').upload(
                storage_path, 
                f,
                {"content-type": get_mime(local_path), "cache-control": "3600", "upsert": "true"}
            )
        return ('ok', local_path)
    except Exception as e:
        err_str = str(e)
        if 'Payload too large' in err_str or '413' in err_str:
            return ('too_big', local_path)
        if attempt < 3:
            time.sleep(2 ** attempt) # exponential backoff 1, 2, 4 detik
            return upload_audio(supabase, local_path, storage_path, attempt + 1)
        return ('failed', local_path)

def upload_cover(supabase: Client, img_bytes: bytes, storage_path: str, attempt=0):
    """
    Mengunggah cover (thumbnail 500x500 JPEG) ke bucket 'covers'.
    """
    try:
        supabase.storage.from_('covers').upload(
            storage_path, 
            img_bytes,
            {"content-type": "image/jpeg", "cache-control": "31536000", "upsert": "true"}
        )
        return True
    except Exception as e:
        if attempt < 3:
            time.sleep(2 ** attempt)
            return upload_cover(supabase, img_bytes, storage_path, attempt + 1)
        print(f"Gagal upload cover {storage_path}: {e}")
        return False

def upload_audios_parallel(supabase: Client, files_to_upload: list, max_workers=4):
    """
    Mengunggah daftar lagu secara paralel, dibatasi max_workers (default 4).
    files_to_upload: list of tuple (local_path, storage_path)
    Mengembalikan generator hasil upload.
    """
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        # Wrap agar mudah dipetakan
        futures = []
        for local_p, storage_p in files_to_upload:
            futures.append(ex.submit(upload_audio, supabase, local_p, storage_p))
        
        for future in futures:
            yield future.result()
