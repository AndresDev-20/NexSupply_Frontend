import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { ChevronDown, KeyRound, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { logoutUser, selectActiveBranch, selectCurrentUser } from '../../../features/auth/authSlice'
import { ROUTES } from '../../../routes/paths'
import { useThemePreference } from '../../../features/settings/useThemePreference'
import './UserMenu.css'

const THEME_OPTIONS = [
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
]

function initialsOf(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?'
}

/** Menú del usuario en la barra superior: nombre, rol, apariencia, cambiar contraseña y cerrar sesión. */
export function UserMenu() {
  const dispatch = useDispatch()
  const user = useSelector(selectCurrentUser)
  // La sede en la que trabaja ahora (Fase 17); si no hay, su sede principal
  const branch = useSelector(selectActiveBranch) ?? user?.branch
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const containerRef = useRef(null)
  const { theme, setTheme } = useThemePreference()

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

  if (!user) return null

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // Al terminar, la ruta protegida lleva al inicio de sesión
    await dispatch(logoutUser()).catch(() => {})
  }

  return (
    <div className="user-menu" ref={containerRef}>
      <button type="button" className="user-menu__trigger" onClick={() => setIsOpen((value) => !value)} aria-haspopup="menu" aria-expanded={isOpen} aria-label={`Menú de ${user.fullName}`}>
        <span className="user-menu__avatar" aria-hidden="true">
          {initialsOf(user.fullName)}
        </span>
        <span className="user-menu__identity">
          <span className="user-menu__name">{user.fullName}</span>
          <span className="user-menu__role">{user.role?.name}</span>
        </span>
        <ChevronDown className="user-menu__chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="user-menu__panel">
          <div className="user-menu__header">
            <p className="user-menu__header-name">{user.fullName}</p>
            <p className="user-menu__header-detail">
              {user.username}
              {branch ? ` · ${branch.name}` : ''}
            </p>
          </div>
          <div role="menu" aria-label={`Opciones de ${user.fullName}`}>
            <div className="user-menu__theme" role="group" aria-label="Apariencia">
              <p className="user-menu__theme-label" aria-hidden="true">
                Apariencia
              </p>
              <div className="user-menu__theme-options">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={`user-menu__theme-option${theme === value ? ' user-menu__theme-option--active' : ''}`}
                    role="menuitemradio"
                    aria-checked={theme === value}
                    onClick={() => setTheme(value)}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Link className="user-menu__item" role="menuitem" to={ROUTES.changePassword} onClick={() => setIsOpen(false)}>
              <KeyRound className="user-menu__item-icon" aria-hidden="true" />
              Cambiar contraseña
            </Link>
            <button type="button" className="user-menu__item user-menu__item--danger" role="menuitem" onClick={handleLogout} disabled={isLoggingOut}>
              <LogOut className="user-menu__item-icon" aria-hidden="true" />
              {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
