import { motion } from 'framer-motion'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { usePoints, useRealtime, useRedemptions } from '../lib/hooks'
import { ACCOUNTS } from '../auth/accounts'

function emojiFor(name: string): string {
  return ACCOUNTS.find((a) => a.key === name.toLowerCase())?.emoji ?? '🙂'
}

export function Layout() {
  const { me, partner, signOut } = useAuth()
  useRealtime()
  const { data: points } = usePoints()
  const { data: redemptions } = useRedemptions()

  const balance = points?.find((p) => p.user_id === me?.id)?.balance ?? 0
  // nagrody, które JA mam wykonać (partner je wykupił) i jeszcze nie wykonane
  const todo =
    redemptions?.filter((r) => r.status === 'pending' && r.recipient_id === partner?.id).length ?? 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">💞</span>
          <span className="topbar__name">Ikander</span>
        </div>

        <nav className="topbar__nav">
          <NavLink to="/" end className="navlink">
            <span className="navlink__icon">📅</span>
            <span className="navlink__label">Kalendarz</span>
          </NavLink>
          <NavLink to="/akcje" className="navlink">
            <span className="navlink__icon">⚡</span>
            <span className="navlink__label">Akcje</span>
          </NavLink>
          <NavLink to="/nagrody" className="navlink">
            <span className="navlink__icon">🎁</span>
            <span className="navlink__label">Nagrody</span>
            {todo > 0 && <span className="navlink__badge">{todo}</span>}
          </NavLink>
        </nav>

        <div className="topbar__right">
          <div className="points-badge" title="Twoje punkty">
            <span className="points-badge__star">⭐</span>
            <motion.span
              key={balance}
              className="points-badge__value"
              initial={{ scale: 1.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14 }}
            >
              {balance}
            </motion.span>
          </div>
          <div className="topbar__user">
            <span className="topbar__user-emoji">{emojiFor(me?.display_name ?? '')}</span>
            <span className="topbar__user-name">{me?.display_name}</span>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
            Wyloguj
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
