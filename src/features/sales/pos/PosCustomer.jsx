import { useState } from 'react'
import { UserPlus, UserRound, X } from 'lucide-react'
import { useGetCustomersQuery } from '../../customers/customersApi'
import { CustomerFormModal } from '../../customers/CustomerFormModal'
import { useCan } from '../../../hooks/usePermissions'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { formatCurrency } from '../../../utils/format'

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

/**
 * Cliente de la venta (D21): Consumidor final si no se escoge; obligatorio para fiar.
 * Busca por nombre, cédula o celular y permite registrar uno nuevo sin salir de la caja.
 */
export function PosCustomer({ customer, onChange }) {
  const canSearch = useCan('customers.view')
  const canCreate = useCan('customers.manage')
  const [text, setText] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const search = useDebouncedValue(text.trim(), 250)
  const { data } = useGetCustomersQuery({ search, pageSize: 6, isActive: 'true' }, { skip: !canSearch || search.length < 2 })
  const results = search.length >= 2 && text.trim().length >= 2 ? (data?.rows ?? []) : []

  return (
    <div className={`pos-head__field pos-customer${customer ? ' pos-customer--chosen' : ''}`}>
      <span className="pos-head__icon" aria-hidden="true">
        {customer ? initialsOf(customer.name) : <UserRound />}
      </span>
      <span className="pos-head__body">
        {customer ? (
          <>
            <span className="pos-label">Cliente</span>
            <strong className="pos-customer__name">{customer.name}</strong>
            <span className="pos-head__hint">
              {customer.phone ?? 'Sin celular: no se le puede fiar'}
              {Number(customer.balance) > 0 && <span className="pos-customer__debt"> · Debe {formatCurrency(customer.balance)}</span>}
              {Number(customer.creditBalance) > 0 && <span className="pos-customer__credit"> · Saldo a favor {formatCurrency(customer.creditBalance)}</span>}
            </span>
          </>
        ) : (
          <>
            <label className="pos-label" htmlFor="pos-customer-input">
              Cliente
            </label>
            <input
              id="pos-customer-input"
              className="pos-customer__input"
              type="search"
              autoComplete="off"
              placeholder={canSearch ? 'Consumidor final · busca por nombre, cédula o celular' : 'Consumidor final'}
              disabled={!canSearch}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <span className="pos-head__hint">La venta queda a su nombre. Para fiar, es obligatorio.</span>
          </>
        )}
      </span>
      {customer ? <IconButton icon={X} label="Quitar el cliente (Consumidor final)" onClick={() => onChange(null)} /> : canCreate && <IconButton icon={UserPlus} label="Registrar cliente nuevo" onClick={() => setIsCreating(true)} />}
      {results.length > 0 && (
        <ul className="pos-customer__results" aria-label="Clientes encontrados">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="pos-result"
                onClick={() => {
                  onChange(row)
                  setText('')
                }}
              >
                <span className="pos-result__text">
                  <strong>{row.name}</strong>
                  <small>{[row.phone, row.documentNumber].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</small>
                </span>
                {Number(row.balance) > 0 && <span className="pos-result__price">Debe {formatCurrency(row.balance)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {isCreating && (
        <CustomerFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(saved) => {
            setIsCreating(false)
            onChange(saved)
          }}
        />
      )}
    </div>
  )
}
