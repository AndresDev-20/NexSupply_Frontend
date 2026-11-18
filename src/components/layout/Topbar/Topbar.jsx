import { CalendarDays, Keyboard, Menu } from 'lucide-react'
import { IconButton } from '../../ui/IconButton/IconButton'
import { formatDate } from '../../../utils/format'
import { UserMenu } from '../UserMenu/UserMenu'
import { BranchSwitcher } from '../BranchSwitcher/BranchSwitcher'
import { NotificationBell } from '../../../features/notifications/NotificationBell'
import './Topbar.css'

/** Barra superior: botón de menú (celular y tablet), título, fecha del negocio, sede (si hay varias) y menú del usuario. */
export function Topbar({ title, isMenuOpen, onMenuClick, menuId, onShortcutsClick }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__menu-button"
        onClick={onMenuClick}
        aria-label="Abrir menú"
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
      >
        <Menu aria-hidden="true" />
      </button>

      <h1 className="topbar__title">{title}</h1>

      <p className="topbar__date">
        <CalendarDays className="topbar__date-icon" aria-hidden="true" />
        <span>{formatDate(new Date())}</span>
      </p>

      {onShortcutsClick && <IconButton icon={Keyboard} label="Atajos de teclado (?)" className="topbar__shortcuts" onClick={onShortcutsClick} />}
      <BranchSwitcher />
      <NotificationBell />
      <UserMenu />
    </header>
  )
}
