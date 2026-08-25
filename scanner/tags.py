import os
import hashlib
from io import BytesIO
from pathlib import Path
from PIL import Image
from mutagen import File as MutagenFile

def file_hash(path: str, chunk=1024*1024) -> str:
    """Hash MD5(1MB pertama + ukuran) sesuai ADR-004"""
    h = hashlib.md5()
    with open(path, 'rb') as f:
        h.update(f.read(chunk))
    h.update(str(os.path.getsize(path)).encode())
    return h.hexdigest()

def parse_year(date_str):
    if not date_str:
        return None
    date_str = str(date_str)
    # Ambil 4 digit pertama
    try:
        return int(date_str[:4])
    except ValueError:
        return None

def read_tags(path: str):
    """
    Membaca metadata ID3/FLAC/MP4 menggunakan mutagen
    dengan fallback chain lengkap.
    """
    try:
        m = MutagenFile(path, easy=True)
        if m is None:
            return None # Bukan file audio yang valid
    except Exception:
        return None
        
    g = lambda k: (m.tags.get(k) or [None])[0] if getattr(m, 'tags', None) else None

    title  = g('title')  or Path(path).stem
    artist = g('artist') or g('albumartist') or g('performer') or 'Unknown Artist'
    album  = g('album')  or 'Unknown Album'

    track_no = None
    raw = g('tracknumber')
    if raw:
        try:
            track_no = int(str(raw).split('/')[0])
        except ValueError:
            pass
            
    disc_no = None
    raw_disc = g('discnumber')
    if raw_disc:
        try:
            disc_no = int(str(raw_disc).split('/')[0])
        except ValueError:
            pass

    return {
        'title': title, 
        'artist': artist, 
        'album': album,
        'track_no': track_no,
        'disc_no': disc_no,
        'duration_ms': int(m.info.length * 1000) if getattr(m, 'info', None) else None,
        'bitrate': getattr(m.info, 'bitrate', None),
        'isrc': g('isrc'),
        'year': parse_year(g('date'))
    }

def extract_cover(path: str) -> bytes:
    """
    Ekstrak cover art dari file audio. 
    Kembalikan bytes atau None jika tidak ada cover.
    """
    try:
        m = MutagenFile(path)
        if m is None:
            return None
            
        # Cek tag untuk format yang berbeda (FLAC, MP3 ID3, MP4)
        if hasattr(m, 'pictures') and m.pictures:
            # FLAC / OGG
            return m.pictures[0].data
        elif hasattr(m, 'tags'):
            if m.tags:
                # MP3 ID3
                for tag in m.tags.values():
                    if tag.__class__.__name__ == 'APIC':
                        return tag.data
                # MP4 / M4A
                if 'covr' in m.tags:
                    covr = m.tags['covr']
                    if covr and len(covr) > 0:
                        return covr[0]
        return None
    except Exception:
        return None

def resize_cover(image_bytes: bytes, size=(500, 500)) -> bytes:
    """
    Resize gambar menjadi JPEG 500x500 kualitas 80.
    """
    if not image_bytes:
        return None
        
    try:
        img = Image.open(BytesIO(image_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        img.thumbnail(size, Image.Resampling.LANCZOS)
        out = BytesIO()
        img.save(out, format='JPEG', quality=80)
        return out.getvalue()
    except Exception:
        return None
