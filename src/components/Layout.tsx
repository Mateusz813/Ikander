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

  const navItems = [
    { to: '/', end: true, icon: '📅', label: 'Kalendarz', badge: 0 },
    { to: '/akcje', end: false, icon: '⚡', label: 'Akcje', badge: 0 },
    { to: '/nagrody', end: false, icon: '🎁', label: 'Nagrody', badge: todo },
    { to: '/pomysly', end: false, icon: '💡', label: 'Pomysły', badge: 0 },
  ]

  function renderLinks(variant: 'top' | 'bottom') {
    return navItems.map((item) => (
      <NavLink key={item.to} to={item.to} end={item.end} className={`navlink navlink--${variant}`}>
        <span className="navlink__icon">{item.icon}</span>
        <span className="navlink__label">{item.label}</span>
        {item.badge > 0 && <span className="navlink__badge">{item.badge}</span>}
      </NavLink>
    ))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">💞</span>
          <span className="topbar__name">Ikander</span>
        </div>

        <nav className="topbar__nav">{renderLinks('top')}</nav>

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

      <nav className="bottomnav">{renderLinks('bottom')}</nav>
    </div>
  )
}
