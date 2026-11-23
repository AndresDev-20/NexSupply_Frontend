// Cotizaciones (D-COT-1): estados y textos.
export const QUOTE_STATES = [
  { value: '', label: 'Todas' },
  { value: 'open', label: 'Vigentes' },
  { value: 'expired', label: 'Vencidas' },
  { value: 'converted', label: 'Vendidas' },
  { value: 'cancelled', label: 'Anuladas' },
]

export const STATE_TONE = { open: 'success', expired: 'warning', converted: 'info', cancelled: 'neutral' }

/** "Vence hoy", "Vence mañana", "Vence en 5 días". */
export function daysLeftText(days) {
  if (days === null || days === undefined) return ''
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `Vence en ${days} días`
}

/** Mensaje para WhatsApp al compartir la cotización. */
export function quoteShareText(quote, businessName) {
  const [year, month, day] = quote.validUntil.split('-')
  return `${businessName ?? 'Agropecuaria'} · Cotización ${quote.number}, válida hasta el ${day}/${month}/${year}.`
}
