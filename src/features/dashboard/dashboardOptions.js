// Utilidades del dashboard (Fase 14).
import { BUSINESS_LOCALE, BUSINESS_TIMEZONE } from '../../config/env'

/** Cada cuánto se refresca solo (D-DASH-5): 5 minutos. */
export const REFRESH_MS = 5 * 60 * 1000

// D-DASH-3: botones de periodo y contra qué se compara (D-DASH-2)
export const PERIODS = [
  { key: 'today', label: 'Hoy', versus: 'ayer a esta hora', previousName: 'Ayer' },
  { key: 'week', label: 'Semana', versus: 'la semana pasada', previousName: 'Semana pasada' },
  { key: 'month', label: 'Mes', versus: 'el mes pasado', previousName: 'Mes pasado' },
  { key: 'year', label: 'Año', versus: 'el año pasado', previousName: 'Año pasado' },
]

export const periodInfo = (key) => PERIODS.find((period) => period.key === key) ?? PERIODS[0]

const hourFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, { hour: 'numeric', hour12: true, timeZone: 'UTC' })
const weekdayFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const dayFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, { month: 'short', timeZone: 'UTC' })
const monthLongFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const todayFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: BUSINESS_TIMEZONE })
const timeFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TIMEZONE })

/**
 * Nombre corto de un punto de la gráfica según el grupo que manda el servidor:
 * hora "14" → "2 p. m."; día "2026-11-17" → "lun 17" (semana) o "17 nov" (mes); mes "2026-11" → "nov".
 */
export function bucketLabel(key, bucket, period) {
  if (!key) return ''
  if (bucket === 'hour') return hourFormatter.format(new Date(Date.UTC(2026, 0, 1, Number(key))))
  if (bucket === 'month') return monthFormatter.format(new Date(`${key}-15T12:00:00Z`)).replace('.', '')
  const date = new Date(`${key}T12:00:00Z`)
  return (period === 'week' ? weekdayFormatter : dayFormatter).format(date).replace('.', '')
}

/** Nombre largo para el detalle de la gráfica: "17 nov", "noviembre de 2026", "2 p. m.". */
export function bucketTitle(key, bucket, period) {
  if (bucket === 'month' && key) return monthLongFormatter.format(new Date(`${key}-15T12:00:00Z`))
  return bucketLabel(key, bucket, period)
}

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora de Bogotá. */
export function greeting(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: BUSINESS_TIMEZONE }).format(date))
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/** "martes, 17 de noviembre" con la primera letra en mayúscula. */
export function todayText(date = new Date()) {
  const text = todayFormatter.format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const timeText = (value) => (value ? timeFormatter.format(new Date(value)) : '')

/**
 * Solo para dibujar: Recharts necesita números. Los textos que se LEEN (tarjetas, detalle)
 * siempre se formatean desde el texto decimal de la API, nunca desde este número.
 */
export const plot = (value) => (value === null || value === undefined ? null : Number(value))

/** Sentido de una variación: up, down o flat (null si no hay contra qué comparar). */
export function trendOf(change) {
  if (change === null || change === undefined) return null
  const value = Number(change)
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}
