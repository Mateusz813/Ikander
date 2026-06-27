import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../auth/AuthProvider'
import { useActions, useDayStatusRange, useLogsRange } from '../../lib/hooks'
import { ACCOUNTS } from '../../auth/accounts'
import type { ActionDef } from '../../lib/types'
import {
  addMonths,
  addYears,
  dayKey,
  isSameMonth,
  isToday,
  isoWeekday,
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

const MAX_ICONS = 4

export function CalendarPage() {
  const { me, partner } = useAuth()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<Date | null>(null)

  const grid = useMemo(() => monthGrid(month), [month])
  const start = dayKey(grid[0])
  const end = dayKey(grid[grid.length - 1])

  const { data: myActions } = useActions(me?.id)
  const { data: partnerActions } = useActions(partner?.id)
  const { data: logs } = useLogsRange(start, end)
  const { data: dayStatus } = useDayStatusRange(start, end)

  // czy dana akcja jest wykonana danego dnia: `${user}|${action}|${date}`
  const logDone = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const l of logs ?? []) map.set(`${l.user_id}|${l.action_id}|${l.date}`, l.completed)
    return map
  }, [logs])

  const perfect = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const d of dayStatus ?? []) {
      if (d.is_perfect) map.set(`${d.user_id}|${d.date}`, true)
    }
    return map
  }, [dayStatus])

  const monthKey = dayKey(month)
  const todayKey = dayKey(new Date())

  function iconsFor(
    actions: ActionDef[] | undefined,
    userId: string | undefined,
    key: string,
    iso: number,
  ) {
    return (actions ?? [])
      .filter((a) => localDay(a.created_at) <= key && a.weekdays.includes(iso))
      .map((a) => ({ icon: a.icon, done: logDone.get(`${userId}|${a.id}|${key}`) ?? false }))
  }

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

      {/* legenda osób */}
      <div className="calendar__legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: colorFor(me?.display_name) }} />
          {me?.display_name}
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: colorFor(partner?.display_name) }} />
          {partner?.display_name}
        </span>
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
        variants={{ show: { transition: { staggerChildren: 0.01 } } }}
      >
        {grid.map((day) => {
          const key = dayKey(day)
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          const isPast = key < todayKey
          const iso = isoWeekday(day)

          const myIcons = iconsFor(myActions, me?.id, key, iso)
          const partnerIcons = iconsFor(partnerActions, partner?.id, key, iso)
          const hasAny = myIcons.length > 0 || partnerIcons.length > 0

          const mePerfect = perfect.get(`${me?.id}|${key}`) ?? false
          const partnerPerfect = perfect.get(`${partner?.id}|${key}`) ?? false

          let state: 'both' | 'one' | 'missed' | 'none' = 'none'
          if (mePerfect && partnerPerfect) state = 'both'
          else if (mePerfect || partnerPerfect) state = 'one'
          else if (isPast && hasAny) state = 'missed'

          return (
            <motion.button
              key={key}
              type="button"
              className={[
                'day-cell',
                inMonth ? '' : 'is-outside',
                today ? 'is-today' : '',
                `state-${state}`,
              ].join(' ')}
              variants={{ hidden: { opacity: 0, scale: 0.92 }, show: { opacity: 1, scale: 1 } }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelected(day)}
            >
              <span className="day-cell__top">
                <span className="day-cell__num">{day.getDate()}</span>
                {state === 'both' && (
                  <motion.span
                    className="day-cell__heart"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 12 }}
                  >
                    💗
                  </motion.span>
                )}
              </span>

              {hasAny && (
                <span className="day-cell__people">
                  <PersonRow
                    icons={myIcons}
                    color={colorFor(me?.display_name)}
                    perfect={mePerfect}
                  />
                  <PersonRow
                    icons={partnerIcons}
                    color={colorFor(partner?.display_name)}
                    perfect={partnerPerfect}
                  />
                </span>
              )}
            </motion.button>
          )
        })}
      </motion.div>

      <DayDetailModal date={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function PersonRow({
  icons,
  color,
  perfect,
}: {
  icons: { icon: string; done: boolean }[]
  color: string
  perfect: boolean
}) {
  if (icons.length === 0) return <span className="person-row is-empty" />
  const shown = icons.slice(0, MAX_ICONS)
  const extra = icons.length - shown.length
  return (
    <span className={`person-row ${perfect ? 'is-perfect' : ''}`} style={{ '--person': color } as React.CSSProperties}>
      <span className="person-row__dot" />
      <span className="person-row__icons">
        {shown.map((it, i) => (
          <span key={i} className={`person-row__icon ${it.done ? 'is-done' : ''}`}>
            {it.icon}
          </span>
        ))}
        {extra > 0 && <span className="person-row__more">+{extra}</span>}
      </span>
    </span>
  )
}
