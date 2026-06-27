import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../auth/AuthProvider'
import { useActions, useDayStatusRange, useLogsRange } from '../../lib/hooks'
import { ACCOUNTS } from '../../auth/accounts'
import {
  addMonths,
  addYears,
  dayKey,
  isSameMonth,
  isToday,
  localDay,
  monthGrid,
  monthTitle,
  startOfMonth,
  weekdayLabels,
} from '../../lib/dates'
import { DayDetailModal } from './DayDetailModal'

function colorFor(name: string | undefined): string {
  return ACCOUNTS.find((a) => a.key === (name ?? '').toLowerCase())?.color ?? '#999'
}

export function CalendarPage() {
  const { me, partner } = useAuth()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<Date | null>(null)

  const grid = useMemo(() => monthGrid(month), [month])
  const start = dayKey(grid[0])
  const end = dayKey(grid[grid.length - 1])

  const { data: myActions } = useActions(me?.id)
  const { data: logs } = useLogsRange(start, end)
  const { data: dayStatus } = useDayStatusRange(start, end)

  // indeksy do szybkiego dostępu
  const myLogDone = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const l of logs ?? []) {
      if (l.user_id === me?.id) map.set(`${l.action_id}|${l.date}`, l.completed)
    }
    return map
  }, [logs, me])

  const perfect = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const d of dayStatus ?? []) {
      if (d.is_perfect) map.set(`${d.user_id}|${d.date}`, true)
    }
    return map
  }, [dayStatus])

  const monthKey = dayKey(month)

  return (
    <div className="calendar">
      <div className="calendar__header">
        <div className="calendar__nav">
          <button className="iconbtn" onClick={() => setMonth((m) => addYears(m, -1))} title="Rok wstecz">
            «
          </button>
          <button className="iconbtn" onClick={() => setMonth((m) => addMonths(m, -1))} title="Miesiąc wstecz">
            ‹
          </button>
        </div>
        <motion.h2
          key={monthKey}
          className="calendar__title"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {monthTitle(month)}
        </motion.h2>
        <div className="calendar__nav">
          <button className="iconbtn" onClick={() => setMonth((m) => addMonths(m, 1))} title="Miesiąc do przodu">
            ›
          </button>
          <button className="iconbtn" onClick={() => setMonth((m) => addYears(m, 1))} title="Rok do przodu">
            »
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Dziś
          </button>
        </div>
      </div>

      <div className="calendar__weekdays">
        {weekdayLabels().map((d) => (
          <div key={d} className="calendar__weekday">
            {d}
          </div>
        ))}
      </div>

      <motion.div
        key={monthKey}
        className="calendar__grid"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.012 } } }}
      >
        {grid.map((day) => {
          const key = dayKey(day)
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          const applicable = (myActions ?? []).filter((a) => localDay(a.created_at) <= key)
          const icons = applicable.slice(0, 4).map((a) => ({
            icon: a.icon,
            done: myLogDone.get(`${a.id}|${key}`) ?? false,
          }))
          const extra = applicable.length - icons.length
          const mePerfect = perfect.get(`${me?.id}|${key}`) ?? false
          const partnerPerfect = perfect.get(`${partner?.id}|${key}`) ?? false
          const both = mePerfect && partnerPerfect

          return (
            <motion.button
              key={key}
              type="button"
              className={`day-cell ${inMonth ? '' : 'is-outside'} ${today ? 'is-today' : ''} ${both ? 'is-both' : ''}`}
              variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelected(day)}
            >
              <span className="day-cell__num">{day.getDate()}</span>

              {icons.length > 0 && (
                <div className="day-cell__icons">
                  {icons.map((it, i) => (
                    <span key={i} className={`day-cell__icon ${it.done ? 'is-done' : ''}`}>
                      {it.icon}
                    </span>
                  ))}
                  {extra > 0 && <span className="day-cell__more">+{extra}</span>}
                </div>
              )}

              <div className="day-cell__status">
                {both ? (
                  <motion.span
                    className="day-cell__heart"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 12 }}
                  >
                    💗
                  </motion.span>
                ) : (
                  <>
                    {mePerfect && (
                      <span
                        className="day-cell__who"
                        style={{ background: colorFor(me?.display_name) }}
                      >
                        {me?.display_name.charAt(0)}
                      </span>
                    )}
                    {partnerPerfect && (
                      <span
                        className="day-cell__who"
                        style={{ background: colorFor(partner?.display_name) }}
                      >
                        {partner?.display_name.charAt(0)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </motion.button>
          )
        })}
      </motion.div>

      <DayDetailModal date={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
