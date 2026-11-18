import { useId, useRef } from 'react'
import './Tabs.css'

/**
 * Pestañas accesibles (patrón WAI-ARIA): flechas izquierda/derecha para moverse.
 * tabs: [{ id, label, icon?, count? }]. El contenido lo dibuja quien las usa según `active`.
 */
export function Tabs({ tabs, active, onChange, label, children }) {
  const baseId = useId()
  const listRef = useRef(null)

  const handleKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next].id)
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={label} ref={listRef} onKeyDown={handleKeyDown}>
        {tabs.map(({ id, label: tabLabel, icon: Icon, count }) => {
          const selected = id === active
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`tabs__tab${selected ? ' tabs__tab--active' : ''}`}
              onClick={() => onChange(id)}
            >
              {Icon && <Icon className="tabs__icon" aria-hidden="true" />}
              {tabLabel}
              {count !== undefined && <span className="tabs__count">{count}</span>}
            </button>
          )
        })}
      </div>
      <div className="tabs__panel" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
        {children}
      </div>
    </div>
  )
}
