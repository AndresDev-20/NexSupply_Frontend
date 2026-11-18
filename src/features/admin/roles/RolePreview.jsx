import { Lock, ShieldCheck } from 'lucide-react'
import './RolePreview.css'

/** Resumen en vivo del rol: cuántos permisos tiene en cada módulo. */
export function RolePreview({ name, description, catalog, selected, isSystemRole }) {
  const selectedSet = new Set(selected)
  const total = catalog.reduce((sum, group) => sum + group.permissions.length, 0)
  const count = isSystemRole ? total : catalog.reduce((sum, group) => sum + group.permissions.filter((p) => selectedSet.has(p.code)).length, 0)
  const Icon = isSystemRole ? Lock : ShieldCheck

  return (
    <div className="role-preview">
      <div className="role-preview__header">
        <span className="role-preview__icon" aria-hidden="true">
          <Icon />
        </span>
        <p className={`role-preview__name${name.trim() ? '' : ' role-preview__name--placeholder'}`}>{name.trim() || 'Nombre del rol'}</p>
        {description?.trim() && <p className="role-preview__description">{description}</p>}
      </div>

      <div className="role-preview__total">
        <span className="role-preview__count">{count}</span>
        <span className="role-preview__count-label">de {total} permisos</span>
      </div>

      <ul className="role-preview__modules">
        {catalog.map((group) => {
          const groupCount = isSystemRole ? group.permissions.length : group.permissions.filter((p) => selectedSet.has(p.code)).length
          const percent = Math.round((groupCount / group.permissions.length) * 100)
          return (
            <li key={group.module} className="role-preview__module">
              <div className="role-preview__module-head">
                <span>{group.name}</span>
                <span className="role-preview__module-count">
                  {groupCount}/{group.permissions.length}
                </span>
              </div>
              <span className="role-preview__bar" aria-hidden="true">
                <span className="role-preview__bar-fill" style={{ '--role-preview-fill': `${percent}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
