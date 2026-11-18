// Utilidades del centro de informes (Fase 13).
import { BarChart3, Boxes, HandCoins, Landmark, Receipt, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDateTime, formatPercent, formatQuantity } from '../../utils/format'
import { formatDay, todayIso } from '../purchases/purchaseOptions'

// Ícono y color de cada área (las mismas del catálogo del servidor)
export const AREA_STYLE = {
  sales: { icon: BarChart3, tone: 'green' },
  profit: { icon: TrendingUp, tone: 'amber' },
  inventory: { icon: Boxes, tone: 'blue' },
  cash: { icon: Landmark, tone: 'teal' },
  purchases_expenses: { icon: Receipt, tone: 'rose' },
  receivables: { icon: HandCoins, tone: 'violet' },
}

/** Texto de una celda según el tipo de columna que manda el servidor. */
export function formatCell(type, value) {
  if (value === null || value === undefined || value === '') return '—'
  switch (type) {
    case 'money':
      return formatCurrency(value)
    case 'quantity':
      return formatQuantity(value)
    case 'integer':
      return Number(value).toLocaleString('es-CO')
    case 'percent':
      return formatPercent(value)
    case 'date':
      return formatDay(value)
    case 'datetime':
      return formatDateTime(value)
    default:
      return String(value)
  }
}

const iso = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/** Atajos de fechas: hoy, esta semana, este mes, mes pasado y este año. */
export function datePresets(today = todayIso()) {
  const base = new Date(`${today}T12:00:00`)
  const weekStart = new Date(base)
  weekStart.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  const lastMonthEnd = new Date(base.getFullYear(), base.getMonth(), 0, 12)
  return [
    { key: 'today', label: 'Hoy', from: today, to: today },
    { key: 'week', label: 'Esta semana', from: iso(weekStart), to: today },
    { key: 'month', label: 'Este mes', from: `${today.slice(0, 7)}-01`, to: today },
    { key: 'lastMonth', label: 'Mes pasado', from: iso(new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1, 12)), to: iso(lastMonthEnd) },
    { key: 'year', label: 'Este año', from: `${today.slice(0, 4)}-01-01`, to: today },
  ]
}

/** Columnas que van alineadas a la derecha (números). */
export const isNumeric = (type) => ['money', 'quantity', 'integer', 'percent'].includes(type)
