import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    'Brak konfiguracji Supabase. Ustaw VITE_SUPABASE_URL oraz VITE_SUPABASE_ANON_KEY (plik .env lokalnie, zmienne środowiskowe na Vercel).',
  )
}

// Klient sam dokleja /auth/v1 i /rest/v1, więc URL musi być samą domeną projektu.
// Uodpornienie: jeśli ktoś wklei adres ze ścieżką (np. .../rest/v1), bierzemy samo origin.
function normalizeSupabaseUrl(raw: string): string {
  try {
    return new URL(raw).origin
  } catch {
    return raw.replace(/\/+$/, '')
  }
}

const supabaseUrl = normalizeSupabaseUrl(rawUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
