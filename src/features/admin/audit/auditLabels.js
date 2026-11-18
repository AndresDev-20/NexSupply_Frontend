// Textos en español de las acciones y campos de la auditoría.
// Cada fase agrega aquí las acciones de su módulo.

export const ACTION_LABELS = {
  'auth.login_succeeded': 'Inició sesión',
  'auth.login_failed': 'Intento de ingreso fallido',
  'auth.logout': 'Cerró sesión',
  'auth.password_changed': 'Cambió su contraseña',
  'auth.password_reset': 'Restableció su contraseña por correo',
  'auth.session_reuse_detected': 'Posible robo de sesión: sesión cerrada',
  'user.created': 'Creó un usuario',
  'user.updated': 'Editó un usuario',
  'user.activated': 'Activó un usuario',
  'user.deactivated': 'Desactivó un usuario',
  'user.password_reset_by_admin': 'Restableció la contraseña de un usuario',
  'role.created': 'Creó un rol',
  'role.updated': 'Editó un rol',
  'role.deleted': 'Eliminó un rol',
  'branch.created': 'Creó una sucursal',
  'branch.updated': 'Editó una sucursal',
  'branch.activated': 'Activó una sucursal',
  'branch.deactivated': 'Desactivó una sucursal',
}

export const ENTITY_LABELS = { user: 'Usuario', role: 'Rol', branch: 'Sucursal' }

export const FIELD_LABELS = {
  username: 'Usuario',
  email: 'Correo',
  full_name: 'Nombre',
  role_id: 'Rol (id)',
  default_branch_id: 'Sucursal (id)',
  is_active: 'Activo',
  must_change_password: 'Debe cambiar contraseña',
  name: 'Nombre',
  description: 'Descripción',
  permissions: 'Permisos',
  code: 'Código',
  address: 'Dirección',
  phone: 'Teléfono',
  reason: 'Motivo',
  familyId: 'Sesión',
}

export const REASON_LABELS = {
  wrong_password: 'Contraseña incorrecta',
  user_not_found: 'Usuario inexistente',
  inactive: 'Usuario desactivado',
}

/** Acciones de seguridad que se resaltan en la tabla. */
export const SENSITIVE_ACTIONS = new Set(['auth.login_failed', 'auth.session_reuse_detected'])

export function actionLabel(action) {
  return ACTION_LABELS[action] ?? action
}

/** Valor legible para la tabla de cambios. */
export function formatAuditValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (key === 'reason') return REASON_LABELS[value] ?? value
  if (Array.isArray(value)) return value.length === 0 ? '(ninguno)' : value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
