import { useSelector } from 'react-redux'
import { selectPermissions, selectPlan } from '../features/auth/authSlice'

/**
 * ¿El usuario tiene TODOS estos permisos? Los permisos llegan ya filtrados por el plan.
 * Solo sirve para adaptar la interfaz: el backend vuelve a verificar en cada petición.
 *
 *   const canCreate = useCan('users.create')
 */
export function useCan(...codes) {
  const permissions = useSelector(selectPermissions)
  return codes.every((code) => permissions.includes(code))
}

/** ¿El plan contratado incluye esta funcionalidad? */
export function useHasFeature(feature) {
  const plan = useSelector(selectPlan)
  return Boolean(plan?.features?.includes(feature))
}

/** Versión sin hook para filtrar listas (menú lateral). */
export function canAccess({ permission, feature }, { permissions, plan }) {
  // permission puede ser una lista: basta con tener uno (ej. los informes, un permiso por área)
  const required = Array.isArray(permission) ? permission : permission ? [permission] : []
  if (required.length && !required.some((code) => permissions.includes(code))) return false
  if (feature && !plan?.features?.includes(feature)) return false
  return true
}
