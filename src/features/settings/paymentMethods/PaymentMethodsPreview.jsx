import { Banknote, CreditCard, Hash } from 'lucide-react'
import './PaymentMethodsPreview.css'

/**
 * Botones de pago tal como aparecerán en el punto de venta: los activos, en orden,
 * con el método que se está editando resaltado.
 */
export function PaymentMethodsPreview({ methods = [], editing }) {
  const others = methods.filter((method) => method.isActive && method.id !== editing.id)
  const current = {
    id: editing.id,
    name: editing.name.trim() || 'Nuevo método',
    isCash: editing.isCash,
    requiresReference: !editing.isCash && editing.requiresReference,
    sortOrder: Number(editing.sortOrder) || 0,
    isCurrent: true,
  }
  const list = [...others, current].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))

  return (
    <div className="pay-preview">
      <p className="pay-preview__title">Forma de pago</p>
      <ul className="pay-preview__grid">
        {list.map((method) => {
          const Icon = method.isCash ? Banknote : CreditCard
          return (
            <li key={method.id} className={`pay-preview__button${method.isCurrent ? ' pay-preview__button--current' : ''}`}>
              <Icon className="pay-preview__icon" aria-hidden="true" />
              <span className="pay-preview__name">{method.name}</span>
              {method.requiresReference && (
                <span className="pay-preview__ref">
                  <Hash aria-hidden="true" /> Referencia
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
