// Utilidades del punto de venta (Fase 10).
import { newIdempotencyKey } from '../../utils/idempotencyKey'

/** Clave de idempotencia de una venta (D-VEN-8): la misma en cada reintento del mismo cobro. */
export const newSaleKey = newIdempotencyKey

/** Turno escogido en este equipo (preferencia local: cada caja física usa su turno). */
const SESSION_KEY = 'nexsupply.posSession'
export function readPosSession() {
  try {
    return window.localStorage.getItem(SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}
export function writePosSession(id) {
  try {
    window.localStorage.setItem(SESSION_KEY, String(id ?? ''))
  } catch {
    // Sin almacenamiento: se vuelve a escoger al recargar
  }
}

/** Nombre corto de la unidad o presentación de una línea: "kg", "Bulto 40 kg". */
export function lineUnit(product, presentationId) {
  const pack = product.presentations.find((item) => String(item.id) === String(presentationId))
  return pack ? pack.name : product.unit.symbol
}

export function linePrice(product, presentationId) {
  const pack = product.presentations.find((item) => String(item.id) === String(presentationId))
  return pack ? pack.salePrice : product.salePrice
}
