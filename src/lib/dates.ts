import {
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { pl } from 'date-fns/locale'

const WEEK_OPTS = { weekStartsOn: 1 as const } // tydzień zaczyna się w poniedziałek

/** Klucz dnia w formacie 'yyyy-MM-dd' (lokalny, bez stref czasowych). */
export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseDayKey(key: string): Date {
  return parseISO(key)
}

/** Dzień (lokalny 'yyyy-MM-dd') dla znacznika czasu ISO, np. created_at z bazy. */
export function localDay(iso: string): string {
  return dayKey(new Date(iso))
}

/** Dzień tygodnia w formacie ISO: 1=poniedziałek ... 7=niedziela. */
export function isoWeekday(date: Date): number {
  const d = date.getDay() // 0=nd ... 6=sob
  return d === 0 ? 7 : d
}

/** Siatka kalendarza miesiąca — pełne tygodnie (pon–nd). */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), WEEK_OPTS)
  const end = endOfWeek(endOfMonth(month), WEEK_OPTS)
  return eachDayOfInterval({ start, end })
}

export function monthTitle(month: Date): string {
  return format(month, 'LLLL yyyy', { locale: pl })
}

export function weekdayLabels(): string[] {
  return ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']
}

export function formatLongDate(date: Date): string {
  return format(date, 'EEEE, d MMMM yyyy', { locale: pl })
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy, HH:mm', { locale: pl })
}

export { addMonths, addYears, isSameDay, isSameMonth, isToday, startOfMonth, endOfMonth }
