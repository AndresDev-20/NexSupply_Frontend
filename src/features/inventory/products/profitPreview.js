// Vista previa de la ganancia mientras se escribe el formulario (D-INV-13).
//
// Solo para mostrarla en vivo: el valor oficial lo calcula y guarda el backend con
// decimal.js. Usa los enteros grandes de utils/moneyPreview.js.
import { SCALE, fromUnits, previewMultiply, toUnits } from '../../../utils/moneyPreview'

/**
 * Ganancia por unidad y porcentaje sobre el precio de compra.
 * Devuelve null si falta alguno de los dos precios.
 * { profit: "3000.00", percent: "30.0" | null }
 */
export function previewProfit(purchasePrice, salePrice) {
  const purchase = toUnits(purchasePrice)
  const sale = toUnits(salePrice)
  if (purchase === null || sale === null) return null
  const profit = sale - purchase
  // porcentaje con 1 decimal: ganancia ÷ compra × 100, en décimas de punto
  const percent = purchase > 0n ? fromUnits((profit * 1000n * SCALE) / purchase / 10n, 1) : null
  return { profit: fromUnits(profit, 2), percent }
}

/** Precio por una cantidad (ej. compra de un bulto de 40 kg). Ver previewMultiply. */
export const scalePrice = previewMultiply
