// Mismo formato que el backend (sequences.service.formatNumber): "V" + 124 → "V-000124".
// Solo para la vista previa: el número real lo asigna el backend al crear el documento.
const NUMBER_PADDING = 6

export function formatSequence(prefix, number) {
  const digits = String(number).padStart(NUMBER_PADDING, '0')
  return prefix ? `${prefix}-${digits}` : digits
}
