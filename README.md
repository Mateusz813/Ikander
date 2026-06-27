# Ikander

Aplikacja webowa zbudowana w React + TypeScript (Vite). Hosting: Vercel. Backend/baza: Supabase.

## Wymagania

- Node.js 22+
- npm

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env   # uzupełnij wartości Supabase
npm run dev
```

Aplikacja domyślnie wystartuje na http://localhost:5173

## Skrypty

| Polecenie         | Opis                                         |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Serwer deweloperski z hot-reload             |
| `npm run build`   | Sprawdzenie typów (tsc) + build produkcyjny  |
| `npm run preview` | Podgląd builda produkcyjnego lokalnie        |
| `npm run lint`    | Linter (oxlint)                              |

## Zmienne środowiskowe

Wymagane do połączenia z Supabase (patrz `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Lokalnie trzymane w pliku `.env` (poza repozytorium). Na Vercel ustawiane w
**Project Settings → Environment Variables**. Klient Supabase: `src/lib/supabase.ts`.

## Stack

- React 19 + TypeScript
- Vite
- Supabase (`@supabase/supabase-js`)
- Vercel (hosting)
