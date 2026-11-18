import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'
import emblem from '../../../assets/brand/nexsupply-emblem.jpg'
import './UserBadgePreview.css'

function initialsOf(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase()
}

/**
 * "Carné" del usuario: vista previa en vivo mientras se llena el formulario.
 * Es solo visual; no es un documento del sistema.
 */
export function UserBadgePreview({ fullName, username, document, phone, email, roleName, branchName, status }) {
  const initials = initialsOf(fullName)
  const statusInfo = {
    new: { icon: KeyRound, text: 'Contraseña temporal al crear', tone: 'accent' },
    mustChange: { icon: KeyRound, text: 'Debe cambiar su contraseña', tone: 'accent' },
    active: { icon: ShieldCheck, text: 'Usuario activo', tone: 'success' },
    inactive: { icon: ShieldOff, text: 'Usuario inactivo', tone: 'muted' },
  }[status]
  const StatusIcon = statusInfo.icon

  return (
    <div className="user-badge">
      <span className="user-badge__hanger" aria-hidden="true" />
      <div className="user-badge__brand">
        <img className="user-badge__emblem" src={emblem} alt="" width="30" height="20" />
        <span>
          Nex<span className="user-badge__brand-accent">Supply</span>
        </span>
      </div>

      <div className={`user-badge__avatar${initials ? '' : ' user-badge__avatar--empty'}`} aria-hidden="true">
        {initials || '?'}
      </div>
      <p className={`user-badge__name${fullName.trim() ? '' : ' user-badge__name--placeholder'}`}>
        {fullName.trim() || 'Nombre del usuario'}
      </p>
      <span className={`user-badge__role${roleName ? '' : ' user-badge__role--empty'}`}>{roleName || 'Sin rol'}</span>

      <dl className="user-badge__details">
        <div className="user-badge__row">
          <dt>Documento</dt>
          <dd>{document || '—'}</dd>
        </div>
        <div className="user-badge__row">
          <dt>Teléfono</dt>
          <dd>{phone || '—'}</dd>
        </div>
        <div className="user-badge__row">
          <dt>Usuario</dt>
          <dd>{username ? `@${username}` : '—'}</dd>
        </div>
        <div className="user-badge__row">
          <dt>Correo</dt>
          <dd>{email || '—'}</dd>
        </div>
        <div className="user-badge__row">
          <dt>Sucursal</dt>
          <dd>{branchName || '—'}</dd>
        </div>
      </dl>

      <span className={`user-badge__status user-badge__status--${statusInfo.tone}`}>
        <StatusIcon size={14} aria-hidden="true" />
        {statusInfo.text}
      </span>
    </div>
  )
}
