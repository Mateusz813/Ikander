import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../auth/AuthProvider'
import { useActions, useLogsRange, useUpsertLog } from '../../lib/hooks'
import { dayKey, formatLongDate, localDay } from '../../lib/dates'
import type { ActionDef, ActionLog } from '../../lib/types'

interface Props {
  date: Date | null
  onClose: () => void
}

function applicableOn(actions: ActionDef[] | undefined, key: string): ActionDef[] {
  return (actions ?? []).filter((a) => localDay(a.created_at) <= key)
}

function summarize(actions: ActionDef[], logs: ActionLog[]) {
  const done = actions.filter(
    (a) => logs.find((l) => l.action_id === a.id)?.completed,
  ).length
  return { done, total: actions.length, complete: actions.length > 0 && done >= actions.length }
}

export function DayDetailModal({ date, onClose }: Props) {
  const { me, partner } = useAuth()
  const key = date ? dayKey(date) : ''
  const { data: myActions } = useActions(date ? me?.id : undefined)
  const { data: partnerActions } = useActions(date ? partner?.id : undefined)
  const { data: logs } = useLogsRange(key || '0000-01-01', key || '0000-01-01', !!date)
  const upsert = useUpsertLog()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const myApplicable = useMemo(() => applicableOn(myActions, key), [myActions, key])
  const partnerApplicable = useMemo(
    () => applicableOn(partnerActions, key),
    [partnerActions, key],
  )

  const myLogs = (logs ?? []).filter((l) => l.user_id === me?.id)
  const partnerLogs = (logs ?? []).filter((l) => l.user_id === partner?.id)

  const mine = summarize(myApplicable, myLogs)
  const theirs = summarize(partnerApplicable, partnerLogs)
  const bothPerfect = mine.complete && theirs.complete

  function logFor(actionId: string): ActionLog | undefined {
    return myLogs.find((l) => l.action_id === actionId)
  }

  async function save(action: ActionDef, progress: number, completed: boolean) {
    if (!me) return
    setSavingId(action.id)
    setError(null)
    try {
      await upsert.mutateAsync({
        action_id: action.id,
        user_id: me.id,
        date: key,
        progress,
        completed,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać')
    } finally {
      setSavingId(null)
    }
  }

  function toggleCheck(action: ActionDef) {
    const done = !!logFor(action.id)?.completed
    void save(action, done ? 0 : 1, !done)
  }

  function addProgress(action: ActionDef, amount: number) {
    const current = logFor(action.id)?.progress ?? 0
    const next = Math.max(0, current + amount)
    const target = action.target ?? 0
    void save(action, next, target > 0 && next >= target)
  }

  function completeQuantity(action: ActionDef) {
    void save(action, action.target ?? 0, true)
  }

  function resetQuantity(action: ActionDef) {
    void save(action, 0, false)
  }

  async function completeAll() {
    for (const a of myApplicable) {
      const log = logFor(a.id)
      if (log?.completed) continue
      const progress = a.type === 'quantity' ? (a.target ?? 0) : 1
      // eslint-disable-next-line no-await-in-loop
      await save(a, progress, true)
    }
  }

  return (
    <Modal open={!!date} onClose={onClose} title={date ? formatLongDate(date) : ''} maxWidth={520}>
      <div className="day">
        <div className="day__summary">
          <div className={`day__pill ${mine.complete ? 'is-done' : ''}`}>
            <span>{me?.display_name}</span>
            <strong>
              {mine.done}/{mine.total}
            </strong>
          </div>
          <AnimatePresence>
            {bothPerfect && (
              <motion.div
                className="day__heart"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12 }}
              >
                💗
              </motion.div>
            )}
          </AnimatePresence>
          <div className={`day__pill ${theirs.complete ? 'is-done' : ''}`}>
            <span>{partner?.display_name}</span>
            <strong>
              {theirs.done}/{theirs.total}
            </strong>
          </div>
        </div>

        <h3 className="day__section-title">
          <span className="day__section-emoji">🧍</span> Twoje akcje
        </h3>
        {myApplicable.length === 0 ? (
          <p className="muted">Brak akcji tego dnia.</p>
        ) : (
          <ul className="day__list">
            {myApplicable.map((action) => {
              const log = logFor(action.id)
              const completed = !!log?.completed
              const progress = log?.progress ?? 0
              const target = action.target ?? 0
              const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0
              const busy = savingId === action.id
              return (
                <li
                  key={action.id}
                  className={`action-row ${completed ? 'is-done' : ''} ${busy ? 'is-busy' : ''}`}
                >
                  <div className="action-row__head">
                    <span className="action-row__icon">{action.icon}</span>
                    <span className="action-row__name">{action.name}</span>
                    {action.type === 'check' ? (
                      <button
                        className={`checkbox ${completed ? 'is-checked' : ''}`}
                        onClick={() => toggleCheck(action)}
                        disabled={busy}
                        aria-label="Zalicz"
                      >
                        {completed && '✓'}
                      </button>
                    ) : (
                      <span className="action-row__count">
                        {progress}
                        {completed ? ' ✓' : ''} / {target} {action.unit}
                      </span>
                    )}
                  </div>

                  {action.type === 'quantity' && (
                    <>
                      <div className="progressbar">
                        <motion.div
                          className="progressbar__fill"
                          animate={{ width: `${pct}%` }}
                          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                        />
                      </div>
                      <div className="action-row__controls">
                        {action.quick_add.map((amt) => (
                          <button
                            key={amt}
                            className="chip"
                            onClick={() => addProgress(action, amt)}
                            disabled={busy}
                          >
                            +{amt}
                          </button>
                        ))}
                        <button
                          className="chip chip--accent"
                          onClick={() => completeQuantity(action)}
                          disabled={busy}
                        >
                          Zaliczone ✓
                        </button>
                        {progress > 0 && (
                          <button
                            className="chip chip--ghost"
                            onClick={() => resetQuantity(action)}
                            disabled={busy}
                          >
                            Wyzeruj
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {myApplicable.length > 0 && !mine.complete && (
          <button className="btn btn--primary day__all" onClick={() => void completeAll()}>
            Zalicz wszystko ⚡
          </button>
        )}
        {mine.complete && (
          <motion.p
            className="day__done-banner"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Perfekcyjny dzień! +1 bonus 🎉
          </motion.p>
        )}

        {partnerApplicable.length > 0 && (
          <div className="day__partner">
            <h3 className="day__section-title">
              <span className="day__section-emoji">💞</span> Akcje: {partner?.display_name}
            </h3>
            <ul className="day__list">
              {partnerApplicable.map((action) => {
                const log = partnerLogs.find((l) => l.action_id === action.id)
                const completed = !!log?.completed
                const progress = log?.progress ?? 0
                const target = action.target ?? 0
                return (
                  <li
                    key={action.id}
                    className={`action-row action-row--readonly ${completed ? 'is-done' : ''}`}
                  >
                    <div className="action-row__head">
                      <span className="action-row__icon">{action.icon}</span>
                      <span className="action-row__name">{action.name}</span>
                      {action.type === 'check' ? (
                        <span className={`checkbox checkbox--readonly ${completed ? 'is-checked' : ''}`}>
                          {completed ? '✓' : ''}
                        </span>
                      ) : (
                        <span className="action-row__count">
                          {progress}
                          {completed ? ' ✓' : ''} / {target} {action.unit}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {error && <p className="banner banner--error">{error}</p>}
      </div>
    </Modal>
  )
}
