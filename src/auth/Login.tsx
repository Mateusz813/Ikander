import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ACCOUNTS, type Account } from './accounts'
import { useAuth } from './AuthProvider'

export function Login() {
  const { signIn } = useAuth()
  const [selected, setSelected] = useState<Account | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await signIn(selected.email, password)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(
        /invalid login credentials/i.test(msg)
          ? 'Nieprawidłowe hasło'
          : 'Błąd połączenia, spróbuj ponownie',
      )
      setBusy(false)
    }
  }

  function back() {
    setSelected(null)
    setPassword('')
    setError(null)
  }

  return (
    <div className="login">
      <motion.div
        className="login__card"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      >
        <motion.div
          className="login__logo"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        >
          💞
        </motion.div>
        <h1 className="login__title">Ikander</h1>

        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="choose"
              className="login__choose"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="login__hint">Kto to?</p>
              <div className="login__buttons">
                {ACCOUNTS.map((acc) => (
                  <motion.button
                    key={acc.key}
                    type="button"
                    className="login__person"
                    style={{ '--person': acc.color } as React.CSSProperties}
                    whileHover={{ y: -4, scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelected(acc)}
                  >
                    <span className="login__person-emoji">{acc.emoji}</span>
                    <span>{acc.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="password"
              className="login__form"
              onSubmit={submit}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
            >
              <div
                className="login__selected"
                style={{ '--person': selected.color } as React.CSSProperties}
              >
                <span className="login__person-emoji">{selected.emoji}</span>
                <span>{selected.label}</span>
              </div>
              <input
                autoFocus
                type="password"
                className="login__input"
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="login__error">{error}</p>}
              <button type="submit" className="btn btn--primary" disabled={busy || !password}>
                {busy ? 'Logowanie…' : 'Zaloguj'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={back}>
                ← Wróć
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
