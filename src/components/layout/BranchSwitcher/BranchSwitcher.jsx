import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Check, ChevronDown, Store } from 'lucide-react'
import { selectActiveBranch, selectBranch, selectBranches } from '../../../features/auth/authSlice'
import { ConfirmDialog } from '../../ui/ConfirmDialog/ConfirmDialog'
import { useToast } from '../../feedback/Toast/toastContext'
import './BranchSwitcher.css'

/**
 * Selector de sede en la barra superior (Fase 17, D-INT-3). Solo aparece si el usuario
 * entra a más de una sede; en el plan básico (una sede) no se ve nada.
 * Cambiar de sede recarga las pantallas con los datos de la sede escogida, por eso se confirma.
 */
export function BranchSwitcher() {
  const dispatch = useDispatch()
  const toast = useToast()
  const branches = useSelector(selectBranches)
  const active = useSelector(selectActiveBranch)
  const [isOpen, setIsOpen] = useState(false)
  const [target, setTarget] = useState(null)
  const containerRef = useRef(null)

  // Se cierra al hacer clic fuera o con Escape
  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  if (branches.length < 2 || !active) return null

  const choose = (branch) => {
    setIsOpen(false)
    if (branch.id !== active.id) setTarget(branch)
  }

  const confirm = () => {
    dispatch(selectBranch(target.id))
    toast.success(`Ahora trabajas en ${target.name}`)
    setTarget(null)
  }

  return (
    <div className="branch-switcher" ref={containerRef}>
      <button
        type="button"
        className="branch-switcher__trigger"
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Sucursal: ${active.name}. Cambiar de sucursal`}
      >
        <Store className="branch-switcher__icon" aria-hidden="true" />
        <span className="branch-switcher__name">{active.name}</span>
        <ChevronDown className="branch-switcher__chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="branch-switcher__panel">
          <p className="branch-switcher__title">¿En qué sucursal trabajas?</p>
          <div role="menu" aria-label="Sucursales">
            {branches.map((branch) => {
              const isActive = branch.id === active.id
              return (
                <button
                  key={branch.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`branch-switcher__option${isActive ? ' branch-switcher__option--active' : ''}`}
                  onClick={() => choose(branch)}
                >
                  <span className="branch-switcher__option-text">
                    <span className="branch-switcher__option-name">{branch.name}</span>
                    <span className="branch-switcher__option-code">{branch.code}</span>
                  </span>
                  {isActive && <Check className="branch-switcher__check" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(target)}
        title="Cambiar de sucursal"
        message={`¿Pasar a trabajar en ${target?.name}? Las pantallas se recargan con los datos de esa sucursal; lo que no hayas guardado (por ejemplo un carrito del punto de venta) se pierde. Solo cambia en esta pestaña.`}
        confirmLabel="Cambiar de sucursal"
        onConfirm={confirm}
        onCancel={() => setTarget(null)}
      />
    </div>
  )
}
