// Vista previa del precio de una lista (D-PRE-1). El precio oficial lo calcula el servidor;
// aquí se repite la regla con enteros grandes solo para mostrarla mientras se escribe:
// precio normal − %, redondeado HACIA ARRIBA a la centena, sin pasar del precio normal.
import { SCALE, fromUnits, toUnits } from '../../../utils/moneyPreview'

const HUNDRED_PESOS = 100n * SCALE

/** "100000" con "8" → "92000.00". null si alguno no es un número válido. */
export function previewListPrice(regularPrice, discountPercent) {
  const regular = toUnits(regularPrice)
  const percent = toUnits(discountPercent || '0')
  if (regular === null || percent === null) return null
  if (regular === 0n || percent === 0n) return fromUnits(regular, 2)
  // regular × (100 − %) / 100, con el % en diezmilésimas
  const raw = (regular * (100n * SCALE - percent)) / (100n * SCALE)
  const rounded = ((raw + HUNDRED_PESOS - 1n) / HUNDRED_PESOS) * HUNDRED_PESOS
  return fromUnits(rounded > regular ? regular : rounded, 2)
}

/** "Mayorista · 8 % menos" o "Mayorista · solo precios especiales". */
export function priceListLabel(list) {
  if (!list) return 'Precio normal'
  const percent = Number(list.discountPercent ?? 0)
  return `${list.name} · ${percent > 0 ? `${String(percent).replace('.', ',')} % menos` : 'solo precios especiales'}`
}
