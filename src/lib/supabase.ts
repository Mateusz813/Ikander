import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Brak konfiguracji Supabase. Ustaw VITE_SUPABASE_URL oraz VITE_SUPABASE_ANON_KEY (plik .env lokalnie, zmienne środowiskowe na Vercel).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
