/**
 * Clave contra el doble registro (D-VEN-8, D-AUD-3). Se genera una vez por operación (al abrir el
 * formulario o empezar el cobro) y se reenvía igual en cada reintento: si el servidor ya guardó esa
 * operación, devuelve la misma en vez de crear otra (doble clic, red lenta).
 */
export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`
}
