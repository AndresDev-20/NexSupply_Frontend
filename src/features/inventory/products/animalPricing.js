// Precio de los lotes de animales (D-ANI-1): solo VISTA PREVIA en el navegador. El precio oficial
// lo calcula el servidor con la fecha del negocio.
import { fromUnits, toUnits } from '../../../utils/moneyPreview'
import { MONEY_PATTERN, QUANTITY_PATTERN, toApiNumber } from '../inventoryOptions'

const isPositive = (text) => QUANTITY_PATTERN.test(text) && !/^0+(\.0+)?$/.test(text)

/** Precio a los `days` días: precio inicial + días × aumento, sin pasar del tope. */
export function previewAnimalPrice(base, increase, days, max) {
  const baseUnits = toUnits(base)
  const increaseUnits = toUnits(increase || '0')
  if (baseUnits === null || increaseUnits === null) return null
  let price = baseUnits + increaseUnits * BigInt(days)
  const maxUnits = max ? toUnits(max) : null
  if (maxUnits !== null && price > maxUnits) price = maxUnits
  return fromUnits(price, 2)
}

/**
 * Valida los campos del precio de un lote (precio inicial, aumento diario, tope opcional).
 * Devuelve { errors, body } con el cuerpo listo para la API.
 */
export function validatePricing(form) {
  const errors = {}
  const base = toApiNumber(form.baseSalePrice)
  const increase = toApiNumber(form.dailyIncrease || '0')
  const max = toApiNumber(form.maxSalePrice)
  if (!MONEY_PATTERN.test(base) || !isPositive(base)) errors.baseSalePrice = 'Escribe el precio inicial (ej. 2.000)'
  if (!MONEY_PATTERN.test(increase)) errors.dailyIncrease = 'Escribe cuánto sube por día (ej. 200 o 0)'
  if (max && !MONEY_PATTERN.test(max)) errors.maxSalePrice = 'Escribe el tope en pesos o déjalo vacío'
  else if (max && !errors.baseSalePrice && Number(max) < Number(base)) errors.maxSalePrice = 'El tope no puede ser menor que el precio inicial'
  return { errors, body: { baseSalePrice: base, dailyIncrease: increase, maxSalePrice: max || null } }
}
