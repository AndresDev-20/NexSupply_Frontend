import { useSelector } from 'react-redux'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { NAVIGATION } from '../../../app/navigation'
import { canAccess } from '../../../hooks/usePermissions'
import { selectPermissions, selectPlan } from '../../../features/auth/authSlice'
import { NexoonCredit } from '../../brand/NexoonCredit/NexoonCredit'
import { useBusinessName } from '../../../features/settings/useBusinessName'
import { useSeason } from '../../../features/settings/appearance'
import { SeasonalGarland } from '../../brand/Seasonal/SeasonalDecoration'
import emblem from '../../../assets/brand/nexsupply-emblem.jpg'
import './Sidebar.css'

/**
 * Menú lateral. En celular y tablet es un panel deslizable (isOpen);
 * desde laptop (1024px) queda fijo a la izquierda.
 */
export function Sidebar({ id, isOpen, onClose }) {
  const permissions = useSelector(selectPermissions)
  const plan = useSelector(selectPlan)
  const businessName = useBusinessName()
  const season = useSeason()

  // Solo lo que el usuario puede usar; las secciones vacías desaparecen
  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccess(item, { permissions, plan })),
  })).filter((group) => group.items.length > 0)

  return (
    <aside id={id} className={`sidebar${isOpen ? ' sidebar--open' : ''}`} aria-label="Menú principal">
      <div className="sidebar__header">
        <SeasonalGarland season={season} variant="compact" />
        <div className="sidebar__brand">
          <img className="sidebar__emblem" src={emblem} alt="" width="48" height="32" />
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">
              Nex<span className="sidebar__brand-name--accent">Supply</span>
            </span>
            {/* El negocio del cliente debajo de la marca del sistema */}
            <span className="sidebar__brand-tagline" title={businessName ?? undefined}>
              {businessName || 'Siempre en control'}
            </span>
          </div>
        </div>
        <button type="button" className="sidebar__close" onClick={onClose} aria-label="Cerrar menú">
          <X aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar__nav">
        {groups.map((group) => (
          <div className="sidebar__group" key={group.section}>
            <p className="sidebar__group-title">{group.section}</p>
            <ul className="sidebar__list">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
                  >
                    <Icon className="sidebar__link-icon" aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <NexoonCredit tone="inverse" />
      </div>
    </aside>
  )
}
