// Textos y formatos del inventario físico (D-INV-15).
import { formatQuantity } from '../../../utils/format'

export const COUNT_STATUS_TABS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'En conteo' },
  { value: 'applied', label: 'Aplicados' },
  { value: 'cancelled', label: 'Anulados' },
]

// Tono de la pastilla de estado (clases status-pill de cash.css)
export const COUNT_STATUS_TONE = { open: 'info', applied: 'success', cancelled: 'neutral' }

export const ITEM_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Sin contar' },
  { value: 'counted', label: 'Contados' },
  { value: 'differences', label: 'Con diferencia' },
]

/** Alcance del conteo: "Todo el inventario" o el nombre de la categoría. */
export const scopeLabel = (count) => (count.category ? count.category.name : 'Todo el inventario')

/** Diferencia con signo: "+2", "−5", "0". */
export function formatDifference(value) {
  const number = Number(value)
  if (!number) return '0'
  return `${number > 0 ? '+' : '−'}${formatQuantity(String(value).replace('-', ''))}`
}

/** Tono de una diferencia: faltante (danger), sobrante (info) o cuadra (success). */
export const differenceTone = (value) => (Number(value) < 0 ? 'danger' : Number(value) > 0 ? 'info' : 'success')
