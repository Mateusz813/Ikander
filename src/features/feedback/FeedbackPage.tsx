import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../auth/AuthProvider'
import {
  useCreateFeedback,
  useDeleteFeedback,
  useFeedback,
  useSetFeedbackDone,
} from '../../lib/hooks'
import { ACCOUNTS } from '../../auth/accounts'
import { formatDateTime } from '../../lib/dates'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Feedback } from '../../lib/types'

function accountFor(name: string | undefined) {
  return ACCOUNTS.find((a) => a.key === (name ?? '').toLowerCase())
}

export function FeedbackPage() {
  const { me, partner } = useAuth()
  const { data: feedback } = useFeedback()
  const create = useCreateFeedback(me?.id ?? '')
  const setDone = useSetFeedbackDone()
  const remove = useDeleteFeedback()

  const [text, setText] = useState('')
  const [toDelete, setToDelete] = useState<Feedback | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = useMemo(() => {
    const list = [...(feedback ?? [])]
    // niezrobione na górze, potem zrobione; w obrębie grupy najnowsze pierwsze
    list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return a.created_at < b.created_at ? 1 : -1
    })
    return list
  }, [feedback])

  function infoFor(authorId: string) {
    const name = authorId === me?.id ? me?.display_name : partner?.display_name
    const acc = accountFor(name)
    return { name: name ?? '—', emoji: acc?.emoji ?? '🙂', color: acc?.color ?? '#999' }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setError(null)
    try {
      await create.mutateAsync(body)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać')
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <h2 className="page__title">💡 Pomysły</h2>
      </div>
      <p className="muted feedback__intro">
        Co dodać albo poprawić w aplikacji? Wpisujcie tu oboje — widzicie nawzajem swoje notatki.
      </p>

      <form className="feedback__form" onSubmit={add}>
        <textarea
          className="input feedback__textarea"
          placeholder="np. Dodać przypomnienia o wodzie wieczorem…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim() || create.isPending}>
          {create.isPending ? 'Dodawanie…' : 'Dodaj pomysł'}
        </button>
        {error && <p className="banner banner--error">{error}</p>}
      </form>

      {items.length === 0 ? (
        <p className="muted">Jeszcze nic tu nie ma. Dorzuć pierwszy pomysł 👆</p>
      ) : (
        <ul className="feedback__list">
          <AnimatePresence initial={false}>
            {items.map((f) => {
              const who = infoFor(f.author_id)
              const own = f.author_id === me?.id
              return (
                <motion.li
                  key={f.id}
                  className={`feedback__item ${f.done ? 'is-done' : ''}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  layout
                >
                  <span className="feedback__avatar" style={{ background: who.color }}>
                    {who.emoji}
                  </span>
                  <div className="feedback__content">
                    <div className="feedback__meta">
                      <strong>{who.name}</strong>
                      <span className="muted">{formatDateTime(f.created_at)}</span>
                    </div>
                    <p className="feedback__text">{f.body}</p>
                  </div>
                  <div className="feedback__buttons">
                    <button
                      className={`feedback__check ${f.done ? 'is-checked' : ''}`}
                      title={f.done ? 'Cofnij' : 'Oznacz jako zrobione'}
                      onClick={() => setDone.mutate({ id: f.id, done: !f.done })}
                    >
                      {f.done ? '✓' : '○'}
                    </button>
                    {own && (
                      <button
                        className="feedback__del"
                        title="Usuń"
                        onClick={() => setToDelete(f)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Usunąć pomysł?"
        message="Tego nie da się cofnąć."
        confirmLabel="Usuń"
        busy={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}
