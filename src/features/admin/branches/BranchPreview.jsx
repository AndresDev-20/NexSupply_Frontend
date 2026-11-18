import { MapPin, Phone, Store } from 'lucide-react'
import './BranchPreview.css'

/** Vista previa de la sucursal como una pequeña fachada con toldo. */
export function BranchPreview({ code, name, address, phone, isActive = true }) {
  return (
    <div className="branch-preview">
      <span className="branch-preview__awning" aria-hidden="true" />
      <div className="branch-preview__body">
        <span className="branch-preview__icon" aria-hidden="true">
          <Store />
        </span>
        <p className={`branch-preview__name${name.trim() ? '' : ' branch-preview__name--placeholder'}`}>{name.trim() || 'Nombre de la sucursal'}</p>
        <span className="branch-preview__code">{code.trim().toUpperCase() || 'CÓDIGO'}</span>

        <ul className="branch-preview__details">
          <li>
            <MapPin size={14} aria-hidden="true" />
            <span>{address.trim() || 'Sin dirección'}</span>
          </li>
          <li>
            <Phone size={14} aria-hidden="true" />
            <span>{phone.trim() || 'Sin teléfono'}</span>
          </li>
        </ul>

        <span className={`branch-preview__status${isActive ? '' : ' branch-preview__status--inactive'}`}>
          {isActive ? 'Abierta' : 'Inactiva'}
        </span>
      </div>
    </div>
  )
}
