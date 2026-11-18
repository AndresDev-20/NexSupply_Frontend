// Textos y tonos de la caja. Reflejan Backend/src/api/config/cash.js:
// si allá cambian los estados o los tipos de movimiento, se actualizan aquí.
import { formatCurrency } from '../../utils/format'

/** Ciclo de un turno (D-CAJA-10): abierto → pendiente por contar → contado → recibido. */
export const SESSION_STATUS_OPTIONS = [
  { value: 'open', label: 'Abiertos' },
  { value: 'pending_count', label: 'Por contar' },
  { value: 'counted', label: 'Contados' },
  { value: 'received', label: 'Recibidos' },
]

export const LIFECYCLE = [
  { status: 'open', label: 'Abierto' },
  { status: 'pending_count', label: 'Cerrado' },
  { status: 'counted', label: 'Contado' },
  { status: 'received', label: 'Recibido' },
]

export const lifecycleIndex = (status) => Math.max(0, LIFECYCLE.findIndex((step) => step.status === status))

/** Movimientos que se registran a mano desde la caja (D-CAJA-6). */
export const MANUAL_MOVEMENTS = {
  deposit: { label: 'Ingreso adicional', verb: 'Registrar ingreso', hint: 'Ej.: sencillo que trae el administrador, devolución de un préstamo de caja.' },
  withdrawal: { label: 'Retiro', verb: 'Registrar retiro', hint: 'Ej.: consignación al banco, pago a un domiciliario. Solo sale efectivo que haya en la caja.' },
}

/**
 * Estado visible de un turno, con su tono. Un turno abierto puede estar además pasado
 * de la hora de cierre o sin confirmar (lo abrió el sistema).
 */
export function sessionState(session) {
  if (!session) return { key: 'none', label: 'Sin turno', tone: 'neutral' }
  if (session.status === 'received') return { key: 'received', label: 'Recibida', tone: 'success' }
  if (session.status === 'counted') return { key: 'counted', label: 'Contada · por recibir', tone: 'info' }
  if (session.status === 'pending_count') return { key: 'pending', label: 'Pendiente por contar', tone: 'warning' }
  if (session.isOverdue) return { key: 'overdue', label: 'Pasó la hora de cierre', tone: 'danger' }
  if (session.needsOpeningConfirmation) return { key: 'confirm', label: 'Por confirmar base', tone: 'warning' }
  return { key: 'open', label: 'Abierta', tone: 'success' }
}

/** "07:00 – 18:00", "Desde 07:00", "Sin horario". */
export function scheduleLabel({ openingTime, closingTime }) {
  if (openingTime && closingTime) return `${openingTime} – ${closingTime}`
  if (openingTime) return `Desde ${openingTime}`
  if (closingTime) return `Hasta ${closingTime}`
  return 'Sin horario'
}

/**
 * Diferencia de un conteo para mostrar: sobrante, faltante o cuadrada.
 * value: texto decimal de la API o de la vista previa ("-1500.00").
 */
export function differenceInfo(value) {
  if (value === null || value === undefined) return null
  const text = String(value)
  if (/^-?0+(\.0+)?$/.test(text)) return { label: 'Cuadrada', tone: 'success', amount: formatCurrency('0') }
  const negative = text.startsWith('-')
  return {
    label: negative ? 'Faltante' : 'Sobrante',
    tone: negative ? 'danger' : 'warning',
    amount: formatCurrency(negative ? text.slice(1) : text),
  }
}
