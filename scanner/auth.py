import os
import json
import getpass
from pathlib import Path
from supabase import create_client, Client

SESSION_DIR = Path.home() / ".harmonia"
SESSION_FILE = SESSION_DIR / "session.json"

def get_env_vars():
    # Coba baca dari .env.local
    env_path = Path(".env.local")
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    # Hapus tanda kutip jika ada
                    v = v.strip('"\'')
                    if k == "SUPABASE_URL":
                        os.environ["SUPABASE_URL"] = v
                    elif k == "SUPABASE_ANON_KEY":
                        os.environ["SUPABASE_ANON_KEY"] = v
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("Error: SUPABASE_URL dan SUPABASE_ANON_KEY belum di-set di environment atau .env.local.")
        print("Jalankan `vercel env pull .env.local` terlebih dahulu.")
        exit(1)
        
    return url, key

def login():
    url, key = get_env_vars()
    supabase: Client = create_client(url, key)
    
    print("=== Harmonia Scanner Login ===")
    email = input("Email: ")
    password = getpass.getpass("Password: ")
    
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if res.session:
            SESSION_DIR.mkdir(parents=True, exist_ok=True)
            # Simpan session ke file
            session_data = {
                "access_token": res.session.access_token,
                "refresh_token": res.session.refresh_token
            }
            with open(SESSION_FILE, "w") as f:
                json.dump(session_data, f)
            # Set permission ke 600 (read/write untuk user saja)
            SESSION_FILE.chmod(0o600)
            print("\nLogin berhasil! Sesi disimpan di ~/.harmonia/session.json")
        else:
            print("\nLogin gagal.")
    except Exception as e:
        print(f"\nLogin gagal: {e}")

def get_client() -> Client:
    url, key = get_env_vars()
    supabase: Client = create_client(url, key)
    
    if not SESSION_FILE.exists():
        print("Sesi tidak ditemukan. Silakan jalankan `python -m scanner login` terlebih dahulu.")
        exit(1)
        
    try:
        with open(SESSION_FILE, "r") as f:
            session_data = json.load(f)
            
        # Set session ke client
        supabase.auth.set_session(
            session_data["access_token"], 
            session_data["refresh_token"]
        )
        return supabase
    except Exception as e:
        print(f"Gagal memulihkan sesi: {e}")
        print("Silakan login kembali dengan `python -m scanner login`.")
        exit(1)
