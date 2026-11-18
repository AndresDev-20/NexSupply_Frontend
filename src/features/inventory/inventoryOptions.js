// Opciones fijas del inventario. Reflejan Backend/src/api/config/inventory.js:
// si allá cambian, se actualizan aquí.

export const TAX_RATE_OPTIONS = [
  { value: 'iva_19', label: 'IVA 19 %' },
  { value: 'iva_5', label: 'IVA 5 %' },
  { value: 'iva_0', label: 'IVA 0 %' },
  { value: 'exempt', label: 'Exento' },
  { value: 'excluded', label: 'Excluido' },
]

export const EXPIRED_POLICY_OPTIONS = [
  { value: 'forbidden', label: 'Prohibido vender vencidos', short: 'Prohibido' },
  { value: 'authorization', label: 'Vender vencidos con autorización', short: 'Con autorización' },
  { value: 'allowed', label: 'Se permite vender vencidos', short: 'Permitido' },
]

// Motivos de un ajuste de existencia (D-INV-14). Refleja ADJUSTMENT_REASONS del backend.
export const ADJUSTMENT_REASONS = [
  { value: 'count_difference', label: 'Diferencia en el conteo físico', directions: ['in', 'out'] },
  { value: 'damaged', label: 'Producto dañado o roto', directions: ['out'] },
  { value: 'expired', label: 'Producto vencido', directions: ['out'] },
  { value: 'loss', label: 'Pérdida o robo', directions: ['out'] },
  { value: 'internal_use', label: 'Consumo interno del negocio', directions: ['out'] },
  { value: 'gift', label: 'Regalo o muestra', directions: ['out'] },
  { value: 'supplier_bonus', label: 'Bonificación del proveedor', directions: ['in'] },
  { value: 'other', label: 'Otro motivo', directions: ['in', 'out'], requiresNotes: true },
]

export const SUPPLIER_DOCUMENT_TYPES = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PPT', label: 'Permiso por protección temporal' },
  { value: 'PA', label: 'Pasaporte' },
]

// Tipos de documento de un producto (D-INV-18); igual que PRODUCT_DOCUMENT_TYPES del backend
export const PRODUCT_DOCUMENT_TYPES = {
  ica_registration: 'Registro ICA',
  technical_sheet: 'Ficha técnica',
  safety_sheet: 'Hoja de seguridad',
  certificate: 'Certificado',
  other: 'Otro',
}

export const taxRateLabel = (code) => TAX_RATE_OPTIONS.find((option) => option.value === code)?.label ?? code
export const expiredPolicyLabel = (code) => EXPIRED_POLICY_OPTIONS.find((option) => option.value === code)?.label ?? code

// Formatos numéricos compartidos con otros módulos (caja, compras…): viven en utils/numberInput.js
export { MONEY_PATTERN, QUANTITY_PATTERN, COST_PATTERN, toApiNumber, toInputNumber } from '../../utils/numberInput'
