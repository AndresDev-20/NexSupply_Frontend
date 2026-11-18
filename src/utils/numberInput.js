// Números que escribe el usuario en los formularios ↔ texto decimal de la API.
// Solo convierten el formato: no hacen cálculos de dinero.

// Mismo formato que valida el backend (texto con máximo N decimales)
export const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/
export const QUANTITY_PATTERN = /^\d{1,11}(\.\d{1,3})?$/
export const COST_PATTERN = /^\d{1,12}(\.\d{1,4})?$/

/**
 * Lo que escribe el usuario ("12.500", "2,5", "$ 98.000") → texto decimal para la API ("12500", "2.5").
 * Solo convierte el formato: no hace cálculos.
 */
export function toApiNumber(value) {
  let text = String(value ?? '').replace(/[$\s]/g, '')
  if (text === '') return ''
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '')
  return text
}

/** Texto decimal de la API ("12500.00") → para editar en un campo ("12500"; "2.5" → "2,5"). */
export function toInputNumber(value) {
  if (value === null || value === undefined || value === '') return ''
  const [integer, decimals = ''] = String(value).split('.')
  const trimmed = decimals.replace(/0+$/, '')
  return trimmed ? `${integer},${trimmed}` : integer
}

/** Monto de la API para un campo, con separador de miles: "150000.00" → "150.000"; "1500.50" → "1.500,5". */
export function toInputMoney(value) {
  const [integer, decimals] = toInputNumber(value).split(',')
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimals ? `,${decimals}` : ''}`
}
