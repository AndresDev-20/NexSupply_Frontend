// Datos compartidos por el comprobante en tirilla y en carta.
const dateFormatter = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true })

/** "17 nov 2026" y "12:32 p. m." en la hora del negocio. */
export function receiptDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '—', time: '' }
  return { day: dateFormatter.format(date).replace('.', ''), time: timeFormatter.format(date) }
}

/** Iniciales del negocio cuando no hay logo ("Mi agropecuaria" → "MA"). */
export const initialsOf = (name) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')

export const customerName = (sale) => (sale.customer?.isFinalConsumer ? 'Consumidor final' : (sale.customer?.name ?? ''))

export const customerDocument = (sale) =>
  !sale.customer?.isFinalConsumer && sale.customer?.documentNumber ? `${sale.customer.documentType} ${sale.customer.documentNumber}` : null

export const contactLine = (business) =>
  [business.phone && `Tel. ${business.phone}`, business.whatsapp && `WhatsApp ${business.whatsapp}`].filter(Boolean).join(' · ')

export const isCreditSale = (sale) => Number(sale.creditAmount) > 0

/** Ancho de tirilla configurado; si el negocio usa carta, la tirilla es de 80 mm. */
export const ticketFormat = (receipt) => (receipt.paperFormat === '58mm' ? '58mm' : '80mm')
