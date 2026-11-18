// Formatos de presentación. IMPORTANTE: estas funciones solo MUESTRAN datos.
// Los cálculos de dinero (totales, impuestos, redondeos) los hace el backend
// con aritmética decimal exacta; el frontend no suma ni redondea montos.
import { BUSINESS_LOCALE, BUSINESS_TIMEZONE } from '../config/env'

const MONEY_PATTERN = /^-?\d+(\.\d+)?$/

/**
 * Pesos colombianos: "$ 1.500.000". Acepta el texto que envía la API ("1500000.00").
 * Devuelve "—" si el valor no es válido, para no mostrar "NaN" al usuario.
 */
export function formatCurrency(value, { decimals = 0 } = {}) {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim()
  if (!MONEY_PATTERN.test(text)) return '—'

  const negative = text.startsWith('-')
  const [integerRaw, decimalRaw = ''] = text.replace('-', '').split('.')

  // Redondeo de presentación hecho sobre el texto, sin pasar por float
  let integerPart = integerRaw.replace(/^0+(?=\d)/, '')
  let decimalPart = decimalRaw.padEnd(decimals + 1, '0')
  const roundUp = Number(decimalPart[decimals]) >= 5
  decimalPart = decimalPart.slice(0, decimals)

  if (roundUp) {
    const digits = (integerPart + decimalPart).split('').map(Number)
    let i = digits.length - 1
    while (i >= 0) {
      if (digits[i] === 9) {
        digits[i] = 0
        i -= 1
      } else {
        digits[i] += 1
        break
      }
    }
    if (i < 0) digits.unshift(1)
    const joined = digits.join('')
    integerPart = joined.slice(0, joined.length - decimals) || '0'
    decimalPart = decimals > 0 ? joined.slice(joined.length - decimals) : ''
  }

  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const isZero = /^0+$/.test(integerPart + decimalPart)
  const sign = negative && !isZero ? '-' : ''
  return `${sign}$ ${withThousands}${decimals > 0 ? `,${decimalPart}` : ''}`
}

/**
 * Cantidad de inventario con el texto DECIMAL de la API:
 * "400.000" → "400"; "12.500" → "12,5"; "1250.000" → "1.250".
 */
export function formatQuantity(value) {
  const text = String(value ?? '').trim()
  if (!/^-?\d+(\.\d+)?$/.test(text)) return '—'
  const negative = text.startsWith('-')
  const [integerRaw, decimalRaw = ''] = text.replace('-', '').split('.')
  const integer = integerRaw.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimals = decimalRaw.slice(0, 3).replace(/0+$/, '')
  return `${negative ? '-' : ''}${integer}${decimals ? `,${decimals}` : ''}`
}

/** Porcentaje con un decimal: "23.81" → "23,8 %"; "20.00" → "20 %". */
export function formatPercent(value) {
  const text = String(value ?? '')
  if (!/^-?\d+(\.\d+)?$/.test(text)) return '—'
  const [integer, decimals = ''] = text.split('.')
  const first = decimals.slice(0, 1)
  return `${integer}${first && first !== '0' ? `,${first}` : ''} %`
}

const dateTimeFormatter =new Intl.DateTimeFormat(BUSINESS_LOCALE, {
  timeZone: BUSINESS_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const dateFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, {
  timeZone: BUSINESS_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Fecha y hora en Bogotá. La API envía instantes en UTC (ISO 8601). */
export function formatDateTime(value) {
  const date = toValidDate(value)
  return date ? dateTimeFormatter.format(date) : '—'
}

/** Solo fecha, en Bogotá: "16/11/2026". */
export function formatDate(value) {
  const date = toValidDate(value)
  return date ? dateFormatter.format(date) : '—'
}
