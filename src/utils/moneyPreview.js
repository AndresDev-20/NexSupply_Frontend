// Cuentas de dinero de VISTA PREVIA en el navegador (D-INV-13, D-CAJA-F1).
//
// El frontend no calcula dinero oficial: los valores que se guardan los calcula el
// backend con decimal.js. Estas funciones solo muestran en vivo lo que pasará
// (ganancia de un producto, diferencia de un arqueo). Para no usar los decimales de
// JavaScript (0,1 + 0,2 ≠ 0,3) se trabaja con enteros grandes (BigInt) en
// diezmilésimas de peso.
export const SCALE = 10000n

/** "12500.5" → 125005000n (diezmilésimas). null si no es un número válido. */
export function toUnits(text) {
  const match = /^(\d{1,12})(?:\.(\d{1,4}))?$/.exec(String(text ?? '').trim())
  if (!match) return null
  return BigInt(match[1]) * SCALE + BigInt((match[2] ?? '').padEnd(4, '0'))
}

/** Diezmilésimas → texto decimal con `decimals` cifras, redondeando mitad hacia arriba. */
export function fromUnits(units, decimals) {
  const negative = units < 0n
  const absolute = negative ? -units : units
  const step = 10n ** BigInt(4 - decimals)
  const rounded = (absolute + step / 2n) / step
  const factor = 10n ** BigInt(decimals)
  const integer = rounded / factor
  const fraction = decimals ? `.${String(rounded % factor).padStart(decimals, '0')}` : ''
  return `${negative && rounded !== 0n ? '-' : ''}${integer}${fraction}`
}

/**
 * Multiplicación para vistas previas: precio × cantidad (cantidad hasta 3 decimales),
 * con 4 decimales. "2100" × "40" → "84000.0000". null si alguno no es válido.
 */
export function previewMultiply(price, quantity) {
  const units = toUnits(price)
  const match = /^(\d{1,11})(?:\.(\d{1,3}))?$/.exec(String(quantity ?? '').trim())
  if (units === null || !match) return null
  const thousandths = BigInt(match[1]) * 1000n + BigInt((match[2] ?? '').padEnd(3, '0'))
  return fromUnits((units * thousandths + 500n) / 1000n, 4)
}

/** Suma para vistas previas, con 2 decimales. Los valores que no son números se ignoran. */
export function previewSum(values) {
  const total = values.map(toUnits).filter((units) => units !== null).reduce((sum, units) => sum + units, 0n)
  return fromUnits(total, 2)
}

/**
 * Resta para vistas previas: a − b con 2 decimales ("150000" − "148500" → "1500.00").
 * null si alguno no es un número válido.
 */
export function previewSubtract(a, b) {
  const left = toUnits(a)
  const right = toUnits(b)
  if (left === null || right === null) return null
  return fromUnits(left - right, 2)
}
