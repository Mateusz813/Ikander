// Dwa stałe konta. Przyciski na ekranie logowania mapują się na e-maile w Supabase.
export interface Account {
  key: 'mateusz' | 'iwona'
  label: string // etykieta na przycisku
  email: string
  emoji: string
  color: string // kolor motywu osoby
}

export const ACCOUNTS: Account[] = [
  {
    key: 'mateusz',
    label: 'Mateusz',
    email: 'mateusz@ikander.local',
    emoji: '🧔',
    color: '#3b82f6',
  },
  {
    key: 'iwona',
    label: 'IKA',
    email: 'iwona@ikander.local',
    emoji: '👩',
    color: '#ec4899',
  },
]
