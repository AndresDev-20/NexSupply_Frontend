// Textos, tonos y utilidades de clientes y cartera (Fase 9, D-CLI-1 a D-CLI-8).
import { formatCurrency } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'

export const RECEIVABLE_STATUS = {
  open: { label: 'Por cobrar', tone: 'warning' },
  paid: { label: 'Pagada', tone: 'success' },
  cancelled: { label: 'Anulada', tone: 'neutral' },
}

export const INSTALLMENT_STATUS = {
  pending: { label: 'Pendiente', tone: 'info' },
  partial: { label: 'Abonada', tone: 'warning' },
  paid: { label: 'Pagada', tone: 'success' },
  overdue: { label: 'Vencida', tone: 'danger' },
}

export const FREQUENCIES = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
]

export const DEBT_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'with', label: 'Con deuda' },
  { value: 'overdue', label: 'Con deuda vencida' },
]

/** Estado visible de una deuda: vencida si tiene cuotas vencidas. */
export function receivableState(receivable) {
  if (receivable.status === 'open' && receivable.isOverdue) return { label: 'Vencida', tone: 'danger' }
  return RECEIVABLE_STATUS[receivable.status] ?? { label: receivable.status, tone: 'neutral' }
}

/** "Cumple en 3 días" / "¡Cumple hoy!" / null. */
export function birthdayLabel(customer) {
  if (customer.daysToBirthday === null || customer.daysToBirthday === undefined) return null
  if (customer.daysToBirthday === 0) return '¡Cumple años hoy!'
  if (customer.daysToBirthday <= 7) return `Cumple años en ${customer.daysToBirthday} ${customer.daysToBirthday === 1 ? 'día' : 'días'}`
  return null
}

/** Celular en formato internacional para wa.me: los de 10 dígitos de Colombia llevan 57. */
export function whatsappNumber(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  return digits.length === 10 ? `57${digits}` : digits
}

/**
 * Recordatorio de pago por WhatsApp (D7b). Abre wa.me con el mensaje listo;
 * la persona lo revisa y lo envía desde su WhatsApp.
 */
export function reminderLink({ customer, businessName, balance, overdueBalance, nextDue }) {
  const number = whatsappNumber(customer.phone)
  if (!number) return null
  const lines = [`Hola ${customer.name.split(' ')[0]}, te saludamos de ${businessName || 'la agropecuaria'}.`]
  if (Number(overdueBalance) > 0) lines.push(`Te recordamos que tienes un saldo vencido de ${formatCurrency(overdueBalance)}.`)
  else if (nextDue) lines.push(`Te recordamos que el ${formatDay(nextDue.dueDate)} vence un pago de ${formatCurrency(nextDue.pending)}.`)
  lines.push(`Tu saldo total es de ${formatCurrency(balance)}. ¡Gracias por tu confianza!`)
  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join(' '))}`
}

/** Recibo de un abono por WhatsApp. */
export function receiptLink({ payment, businessName }) {
  const number = whatsappNumber(payment.customer?.phone)
  if (!number) return null
  const balance = payment.allocations.reduce((sum, item) => sum + Number(item.balanceNow), 0)
  const text = `Hola ${payment.customer.name.split(' ')[0]}, ${businessName || 'la agropecuaria'} confirma tu abono ${payment.number} por ${formatCurrency(payment.amount)} (${payment.paymentMethod?.name}). Saldo pendiente: ${formatCurrency(String(balance))}. ¡Gracias!`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
