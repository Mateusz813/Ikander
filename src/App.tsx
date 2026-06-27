import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Login } from './auth/Login'
import { Layout } from './components/Layout'
import { CalendarPage } from './features/calendar/CalendarPage'
import { ActionsPage } from './features/actions/ActionsPage'
import { RewardsPage } from './features/rewards/RewardsPage'

function Loader({ label = 'Wczytywanie…' }: { label?: string }) {
  return (
    <div className="loader">
      <div className="loader__heart">💞</div>
      <p>{label}</p>
    </div>
  )
}

function ErrorScreen() {
  const { retryProfiles, signOut } = useAuth()
  return (
    <div className="loader">
      <div className="loader__heart">😕</div>
      <p>Nie udało się wczytać danych.</p>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button className="btn btn--primary" onClick={() => retryProfiles()}>
          Spróbuj ponownie
        </button>
        <button className="btn btn--ghost" onClick={() => void signOut()}>
          Wyloguj
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { loading, session, me, profilesError } = useAuth()

  if (loading) return <Loader />
  if (!session) return <Login />
  if (profilesError && !me) return <ErrorScreen />
  if (!me) return <Loader label="Wczytywanie profilu…" />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CalendarPage />} />
        <Route path="akcje" element={<ActionsPage />} />
        <Route path="nagrody" element={<RewardsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
