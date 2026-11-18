// Utilidades de los gastos (Fase 12).

// Soportes (D13): el navegador revisa tipo y tamaño para avisar rápido; el servidor valida el contenido
export const ACCEPTED_FILES = ['application/pdf', 'image/jpeg', 'image/png']
export const MAX_FILE_BYTES = 5 * 1024 * 1024

/** Primer día del mes de una fecha "AAAA-MM-DD". */
export const monthStart = (date) => `${date.slice(0, 7)}-01`

/** Color de una categoría según su posición (los mismos tonos en la lista y en el resumen). */
const TONES = ['green', 'amber', 'blue', 'violet', 'teal', 'rose', 'lime', 'slate']
export const categoryTone = (categoryId) => TONES[(Number(categoryId) || 0) % TONES.length]

/** "2026-11" → "noviembre 2026" (mes de un gasto fijo). */
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const periodLabel = (period) => (period ? `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}` : '')
