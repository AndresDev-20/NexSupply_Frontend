import { useSelector } from 'react-redux'
import { Keyboard } from 'lucide-react'
import { Modal } from '../../ui/Modal/Modal'
import { canAccess } from '../../../hooks/usePermissions'
import { selectPermissions, selectPlan } from '../../../features/auth/authSlice'
import { GO_KEY, GO_SHORTCUTS, SCREEN_SHORTCUTS, navigationItemFor } from '../../../app/shortcuts'
import './ShortcutsHelp.css'

const Keys = ({ keys }) => (
  <span className="shortcut-keys">
    {keys.map((key, index) => (
      <span key={key}>
        {index > 0 && <span className="shortcut-keys__then">luego</span>}
        <kbd>{key}</kbd>
      </span>
    ))}
  </span>
)

/** Ayuda de atajos (se abre con "?" o con el botón del teclado en la barra superior). */
export function ShortcutsHelp({ isOpen, onClose }) {
  const permissions = useSelector(selectPermissions)
  const plan = useSelector(selectPlan)
  const allowed = GO_SHORTCUTS.filter((shortcut) => {
    const item = navigationItemFor(shortcut.to)
    return item && canAccess(item, { permissions, plan })
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atajos de teclado" description="Funcionan cuando no estás escribiendo en un campo." icon={Keyboard} size="md">
      <section className="shortcuts-help__section" aria-labelledby="shortcuts-go">
        <h3 id="shortcuts-go">Ir a una pantalla</h3>
        <ul className="shortcuts-help__list">
          {allowed.map((shortcut) => (
            <li key={shortcut.key}>
              <span>{shortcut.label}</span>
              <Keys keys={[GO_KEY, shortcut.key]} />
            </li>
          ))}
        </ul>
      </section>
      <section className="shortcuts-help__section" aria-labelledby="shortcuts-screen">
        <h3 id="shortcuts-screen">En cada pantalla</h3>
        <ul className="shortcuts-help__list">
          {SCREEN_SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label}>
              <span>
                {shortcut.label} <small>({shortcut.screen})</small>
              </span>
              <Keys keys={shortcut.keys} />
            </li>
          ))}
          <li>
            <span>Cerrar una ventana</span>
            <Keys keys={['Esc']} />
          </li>
          <li>
            <span>Ver esta ayuda</span>
            <Keys keys={['?']} />
          </li>
        </ul>
      </section>
    </Modal>
  )
}

/** Aviso flotante mientras se espera la segunda tecla después de "g". */
export function ShortcutPending({ visible }) {
  if (!visible) return null
  return (
    <div className="shortcut-pending" role="status">
      <kbd>{GO_KEY}</kbd> Ir a… <span>escribe la letra de la pantalla</span>
    </div>
  )
}
