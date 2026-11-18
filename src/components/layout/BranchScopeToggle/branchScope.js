// «Esta sucursal / Todas» (Fase 19, D-INT-12): quién puede verlo y qué se envía a la API.
import { useSelector } from 'react-redux'
import { selectBranches, selectPlan } from '../../../features/auth/authSlice'

/**
 * ¿Puede la persona ver «Todas las sucursales»? El plan debe incluir la funcionalidad y la persona
 * debe entrar a más de una sucursal. «Todas» suma solo las suyas.
 */
export function useCanSeeAllBranches(feature = 'consolidated_reports') {
  const plan = useSelector(selectPlan)
  const branches = useSelector(selectBranches)
  return Boolean(plan?.features?.includes(feature)) && branches.length > 1
}

/** Parámetro para la API: { branch: 'all' } con «Todas»; nada con la sucursal activa. */
export const branchParams = (scope) => (scope === 'all' ? { branch: 'all' } : {})
