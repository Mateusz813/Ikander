import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchProfiles } from '../lib/api'
import type { Profile } from '../lib/types'

interface AuthValue {
  loading: boolean
  session: Session | null
  me: Profile | null
  partner: Profile | null
  profilesError: boolean
  retryProfiles: () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profilesError, setProfilesError] = useState(false)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfiles = useCallback(() => {
    if (!session) {
      setProfiles([])
      setProfilesError(false)
      return
    }
    setProfilesError(false)
    fetchProfiles()
      .then((p) => {
        setProfiles(p)
        setProfilesError(false)
      })
      .catch(() => setProfilesError(true))
  }, [session])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const me = useMemo(
    () => profiles.find((p) => p.id === session?.user.id) ?? null,
    [profiles, session],
  )
  const partner = useMemo(
    () => (me ? (profiles.find((p) => p.id === me.partner_id) ?? null) : null),
    [profiles, me],
  )

  const value: AuthValue = useMemo(
    () => ({
      loading,
      session,
      me,
      partner,
      profilesError,
      retryProfiles: loadProfiles,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message)
      },
      async signOut() {
        await supabase.auth.signOut()
        qc.clear()
      },
    }),
    [loading, session, me, partner, profilesError, loadProfiles, qc],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musi być użyte wewnątrz <AuthProvider>')
  return ctx
}
