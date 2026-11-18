import { Checkbox } from '../../../components/ui/Checkbox/Checkbox'
import './PermissionPicker.css'

/**
 * Selector de permisos agrupados por módulo, con "todo el módulo" (casilla
 * intermedia cuando solo algunos están marcados). `readOnly` para roles del sistema.
 */
export function PermissionPicker({ catalog, selected, onChange, readOnly = false }) {
  const selectedSet = new Set(selected)

  const toggle = (code, checked) => {
    const next = new Set(selectedSet)
    if (checked) next.add(code)
    else next.delete(code)
    onChange([...next])
  }

  const toggleModule = (group, checked) => {
    const next = new Set(selectedSet)
    for (const permission of group.permissions) {
      if (checked) next.add(permission.code)
      else next.delete(permission.code)
    }
    onChange([...next])
  }

  return (
    <div className="permission-picker">
      {catalog.map((group) => {
        const count = group.permissions.filter((permission) => selectedSet.has(permission.code)).length
        const all = count === group.permissions.length
        return (
          <fieldset key={group.module} className="permission-picker__group">
            <legend className="permission-picker__legend">
              <Checkbox
                label={group.name}
                description={`${count} de ${group.permissions.length} permisos`}
                checked={all}
                indeterminate={count > 0 && !all}
                onChange={(checked) => toggleModule(group, checked)}
                disabled={readOnly}
              />
            </legend>
            <div className="permission-picker__items">
              {group.permissions.map((permission) => (
                <Checkbox
                  key={permission.code}
                  label={permission.name}
                  checked={selectedSet.has(permission.code)}
                  onChange={(checked) => toggle(permission.code, checked)}
                  disabled={readOnly}
                />
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
