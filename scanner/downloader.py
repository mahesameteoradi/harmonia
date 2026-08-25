import os
import yt_dlp
from pathlib import Path
from mutagen.mp4 import MP4, MP4Cover

def download_track(query: str, output_dir: str) -> str:
    """
    Mencari dan mendownload lagu menggunakan yt-dlp.
    Menyimpan file di output_dir dan mengembalikan path filenya (berupa .m4a).
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a',
            'preferredquality': '192',
        }],
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(f"ytsearch1:{query} audio", download=True)
            if 'entries' in info and len(info['entries']) > 0:
                entry = info['entries'][0]
                expected_path = os.path.join(output_dir, f"{entry['id']}.m4a")
                if os.path.exists(expected_path):
                    return expected_path
        except Exception as e:
            print(f"Gagal mendownload {query}: {e}")
            
    return None

def inject_m4a_tags(file_path: str, title: str, artist: str, album: str = None):
    """
    Menyuntikkan ID3 tags ke dalam file .m4a menggunakan mutagen.
    Ini memastikan scanner lokal dapat membacanya dengan benar.
    """
    try:
        audio = MP4(file_path)
        audio['\xa9nam'] = [title]
        audio['\xa9ART'] = [artist]
        if album:
            audio['\xa9alb'] = [album]
        audio.save()
    except Exception as e:
        print(f"Gagal menyuntikkan tag ke {file_path}: {e}")
