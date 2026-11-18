// Textos y tonos de las compras. Reflejan los estados del backend (D-COMP-1, D-COMP-7).

export const PURCHASE_STATUS = {
  draft: { label: 'Borrador', tone: 'neutral' },
  confirmed: { label: 'Confirmada', tone: 'success' },
  cancelled: { label: 'Anulada', tone: 'danger' },
}

export const PAYMENT_STATUS = {
  paid: { label: 'Pagada', tone: 'success' },
  pending: { label: 'Por pagar', tone: 'warning' },
  overdue: { label: 'Vencida', tone: 'danger' },
}

export const STATUS_TABS = [
  { value: '', label: 'Todas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'cancelled', label: 'Anuladas' },
]

export const PAYMENT_FILTER_OPTIONS = [
  { value: 'pending', label: 'Por pagar' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'paid', label: 'Pagadas' },
]

/** Estado visible: una compra confirmada se ve por su pago (pagada, por pagar, vencida). */
export function purchaseState(purchase) {
  if (purchase.status === 'confirmed' && purchase.paymentStatus) return PAYMENT_STATUS[purchase.paymentStatus]
  return PURCHASE_STATUS[purchase.status] ?? { label: purchase.status, tone: 'neutral' }
}

/** Nombre para mostrar de un proveedor: el comercial si lo tiene. */
export const supplierName = (supplier) => (supplier ? supplier.tradeName || supplier.legalName : '—')

/** Fecha "AAAA-MM-DD" + días, en texto (sin zonas horarias: solo calendario). */
export function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + Number(days || 0)))
  return result.toISOString().slice(0, 10)
}

/** Hoy en la zona del negocio, "AAAA-MM-DD". */
export const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

/** "2026-11-16" → "16/11/2026" (sin pasar por zonas horarias). */
export const formatDay = (date) => (date ? date.split('-').reverse().join('/') : '—')
