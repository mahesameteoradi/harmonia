import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Pastikan env.js sudah dimuat sebelumnya di HTML
if (!window.__ENV) {
  console.error("Environment variables tidak ditemukan. Pastikan env.js termuat.");
}

export const supabase = createClient(
  window.__ENV?.SUPABASE_URL || '',
  window.__ENV?.SUPABASE_ANON_KEY || '',
  { 
    auth: { 
      persistSession: true, 
      autoRefreshToken: true 
    } 
  }
);
