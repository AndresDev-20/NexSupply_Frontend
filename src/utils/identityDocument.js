// Documento de identidad en la interfaz. La regla oficial está en el backend
// (Backend/src/api/utils/identityDocument.js), que siempre vuelve a validar.

export const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PPT', label: 'Permiso por protección temporal' },
  { value: 'PA', label: 'Pasaporte' },
]

export function normalizeDocumentNumber(value) {
  return String(value ?? '')
    .replace(/[\s.-]/g, '')
    .toUpperCase()
}

/** Mensaje de error en español, o null si es válido. */
export function validateDocument(type, rawNumber) {
  const number = normalizeDocumentNumber(rawNumber)
  if (!number) return 'Escribe el número de documento'
  if (type === 'CC' && !/^\d{5,10}$/.test(number)) return 'La cédula debe tener entre 5 y 10 dígitos'
  if ((type === 'CE' || type === 'PPT') && !/^\d{4,15}$/.test(number)) return 'Solo números (4 a 15 dígitos)'
  if (type === 'PA' && !/^[A-Z0-9]{5,20}$/.test(number)) return 'Entre 5 y 20 letras o números'
  return null
}

export function isValidPhone(value) {
  return /^\+?\d{7,15}$/.test(String(value ?? '').replace(/[\s()-]/g, ''))
}

/** "CC 1.023.456.789" — los números se agrupan de a tres para leerlos fácil. */
export function formatDocument(type, number) {
  if (!number) return null
  const pretty = /^\d+$/.test(number) ? number.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : number
  return `${type ?? ''} ${pretty}`.trim()
}

/** NIT: "900.123.456 - 7" → "900123456-7" (se conserva el dígito de verificación). */
export function normalizeNit(value) {
  return String(value ?? '').replace(/[\s.]/g, '')
}

/** Documento de un proveedor: NIT o documento de persona. Mensaje de error o null. */
export function validateSupplierDocument(type, rawNumber) {
  if (type !== 'NIT') return validateDocument(type, rawNumber)
  const number = normalizeNit(rawNumber)
  if (!number) return 'Escribe el NIT'
  return /^\d{5,15}(-\d)?$/.test(number) ? null : 'De 5 a 15 dígitos y, opcional, el dígito de verificación (900123456-7)'
}
