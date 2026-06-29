import { useMemo } from 'react'
import { ACCOUNTS } from '../../auth/accounts'
import { useKissesRange } from '../../lib/hooks'
import { addMonths, dayKey, isoWeekday, localDay, monthDays, monthTitle, startOfMonth } from '../../lib/dates'
import type { ActionDef, Profile } from '../../lib/types'

function colorFor(name: string | undefined): string {
  return ACCOUNTS.find((a) => a.key === (name ?? '').toLowerCase())?.color ?? '#999'
}

interface Stat {
  applicable: number
  completed: number
}

function statFor(
  action: ActionDef | undefined,
  userId: string | undefined,
  days: Date[],
  todayKey: string,
  logDone: Map<string, boolean>,
): Stat | null {
  if (!action) return null
  let applicable = 0
  let completed = 0
  for (const d of days) {
    const key = dayKey(d)
    if (key > todayKey) continue
    if (localDay(action.created_at) > key) continue
    if (!action.weekdays.includes(isoWeekday(d))) continue
    applicable++
    if (logDone.get(`${userId}|${action.id}|${key}`)) completed++
  }
  return { applicable, completed }
}

interface Props {
  month: Date
  me: Profile | null
  partner: Profile | null
  myActions: ActionDef[] | undefined
  partnerActions: ActionDef[] | undefined
  logDone: Map<string, boolean>
  perfect: Map<string, boolean>
}

export function MonthSummary({ month, me, partner, myActions, partnerActions, logDone, perfect }: Props) {
  const days = useMemo(() => monthDays(month), [month])
  const todayKey = dayKey(new Date())

  const kissStart = startOfMonth(month).toISOString()
  const kissEnd = startOfMonth(addMonths(month, 1)).toISOString()
  const { data: kisses } = useKissesRange(kissStart, kissEnd)

  // grupuj akcje po nazwie, żeby te same były obok siebie
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; mine?: ActionDef; theirs?: ActionDef }>()
    for (const a of myActions ?? []) {
      const k = a.name.trim().toLowerCase()
      const e = map.get(k) ?? { name: a.name, icon: a.icon }
      e.mine = a
      map.set(k, e)
    }
    for (const a of partnerActions ?? []) {
      const k = a.name.trim().toLowerCase()
      const e = map.get(k) ?? { name: a.name, icon: a.icon }
      e.theirs = a
      map.set(k, e)
    }
    return [...map.values()]
  }, [myActions, partnerActions])

  if (rows.length === 0) return null

  const myPerfect = days.filter((d) => perfect.get(`${me?.id}|${dayKey(d)}`)).length
  const partnerPerfect = days.filter((d) => perfect.get(`${partner?.id}|${dayKey(d)}`)).length
  const myKisses = (kisses ?? []).filter((k) => k.sender_id === me?.id).length
  const partnerKisses = (kisses ?? []).filter((k) => k.sender_id === partner?.id).length

  return (
    <div className="msum">
      <h3 className="msum__title">📊 Podsumowanie — {monthTitle(month)}</h3>

      <div className="msum__head">
        <span />
        <span className="msum__who" style={{ color: colorFor(me?.display_name) }}>
          {me?.display_name}
        </span>
        <span className="msum__who" style={{ color: colorFor(partner?.display_name) }}>
          {partner?.display_name}
        </span>
      </div>

      {rows.map((r) => (
        <div className="msum__row" key={r.name}>
          <span className="msum__action">
            <span className="msum__icon">{r.icon}</span>
            {r.name}
          </span>
          <SummaryCell
            stat={statFor(r.mine, me?.id, days, todayKey, logDone)}
            color={colorFor(me?.display_name)}
          />
          <SummaryCell
            stat={statFor(r.theirs, partner?.id, days, todayKey, logDone)}
            color={colorFor(partner?.display_name)}
          />
        </div>
      ))}

      <div className="msum__row msum__row--total">
        <span className="msum__action">💗 Perfekcyjne dni</span>
        <span className="msum__cell">
          <strong>{myPerfect}</strong>
        </span>
        <span className="msum__cell">
          <strong>{partnerPerfect}</strong>
        </span>
      </div>

      <div className="msum__row msum__row--total">
        <span className="msum__action">💋 Wysłane buziaczki</span>
        <span className="msum__cell">
          <strong>{myKisses}</strong>
        </span>
        <span className="msum__cell">
          <strong>{partnerKisses}</strong>
        </span>
      </div>
    </div>
  )
}

function SummaryCell({ stat, color }: { stat: Stat | null; color: string }) {
  if (!stat || stat.applicable === 0) return <span className="msum__cell msum__cell--empty">—</span>
  const pct = Math.round((stat.completed / stat.applicable) * 100)
  return (
    <span className="msum__cell">
      <span className="msum__bar">
        <span className="msum__bar-fill" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="msum__num">
        {stat.completed}/{stat.applicable}
      </span>
    </span>
  )
}
