import { Layers, Store } from 'lucide-react'
import { useSelector } from 'react-redux'
import { selectActiveBranch, selectBranches } from '../../../features/auth/authSlice'
import { useCanSeeAllBranches } from './branchScope'
import './BranchScopeToggle.css'

/**
 * Selector «Esta sucursal / Todas» de informes, dashboard y cartera. No se dibuja si la persona
 * no puede ver «Todas» (plan básico o una sola sucursal): ahí todo es de su sucursal.
 */
export function BranchScopeToggle({ value, onChange, feature = 'consolidated_reports', className = '' }) {
  const canSeeAll = useCanSeeAllBranches(feature)
  const active = useSelector(selectActiveBranch)
  const branches = useSelector(selectBranches)
  if (!canSeeAll) return null

  const options = [
    { value: 'active', label: active?.name ?? 'Esta sucursal', icon: Store, hint: 'Solo la sucursal en la que trabajas' },
    { value: 'all', label: `Todas (${branches.length})`, icon: Layers, hint: `Suma ${branches.map((branch) => branch.name).join(', ')}` },
  ]
  return (
    <div className={`branch-scope ${className}`.trim()} role="group" aria-label="Sucursales que se suman">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} title={option.hint} className={`branch-scope__option${value === option.value ? ' is-active' : ''}`} onClick={() => onChange(option.value)}>
          <option.icon aria-hidden="true" />
          {option.label}
        </button>
      ))}
    </div>
  )
}
