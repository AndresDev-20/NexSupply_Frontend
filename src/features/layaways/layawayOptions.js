// Utilidades de los apartados (Fase 10b).
import { ROUTES } from '../../routes/paths'

export const layawayPath = (id) => ROUTES.layawayDetail.replace(':id', String(id))

// Filtros de la lista. "Vencido" = pagando con la fecha límite pasada (D-APA-3)
export const LAYAWAY_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Pagando' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'paid', label: 'Por entregar' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
]

/** Color del estado: lo vencido en rojo, lo listo para entregar en verde. */
export function layawayTone(layaway) {
  if (layaway.isOverdue) return 'danger'
  if (layaway.status === 'paid') return 'success'
  if (layaway.status === 'active') return 'warning'
  return 'neutral'
}

/** Cuánto lleva pagado, de 0 a 100 (para la barra de avance). */
export function paidPercent(layaway) {
  const total = Number(layaway.total)
  if (!total) return 0
  return Math.min(100, Math.round((Number(layaway.amountPaid) / total) * 100))
}

/** "vence en 3 días", "vence hoy", "venció hace 2 días". */
export function dueText(layaway) {
  const days = layaway.daysToDue
  if (days === null || days === undefined) return null
  if (days < 0) return `venció hace ${-days} ${days === -1 ? 'día' : 'días'}`
  if (days === 0) return 'vence hoy'
  return `vence en ${days} ${days === 1 ? 'día' : 'días'}`
}
