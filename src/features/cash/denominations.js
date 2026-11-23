// Billetes y monedas para contar la caja (D-CAJA-14).
import { formatCurrency } from '../../utils/format'

// Billetes y monedas de Colombia (D-CAJA-14), igual que en el servidor (config/cash.js)
export const DENOMINATIONS = [
  { value: 100000, kind: 'bill' },
  { value: 50000, kind: 'bill' },
  { value: 20000, kind: 'bill' },
  { value: 10000, kind: 'bill' },
  { value: 5000, kind: 'bill' },
  { value: 2000, kind: 'bill' },
  { value: 1000, kind: 'bill' },
  { value: 1000, kind: 'coin' },
  { value: 500, kind: 'coin' },
  { value: 200, kind: 'coin' },
  { value: 100, kind: 'coin' },
  { value: 50, kind: 'coin' },
]

export const keyOf = (item) => `${item.kind}:${item.value}`

/** { 'bill:50000': '3', … } → total en pesos (enteros: no hay decimales en billetes ni monedas). */
export function countTotal(quantities) {
  return DENOMINATIONS.reduce((total, item) => total + item.value * (Number(quantities[keyOf(item)]) || 0), 0)
}

/** Lo que se manda al servidor: solo las denominaciones con cantidad. */
export function toBreakdown(quantities) {
  return DENOMINATIONS.filter((item) => Number(quantities[keyOf(item)]) > 0).map((item) => ({
    value: item.value,
    kind: item.kind,
    quantity: Number(quantities[keyOf(item)]),
  }))
}

/** "Billete de $ 50.000" / "Moneda de $ 500". */
export const denominationLabel = (item) => `${item.kind === 'coin' ? 'Moneda' : 'Billete'} de ${formatCurrency(String(item.value))}`
