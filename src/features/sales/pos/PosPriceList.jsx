import { BadgePercent } from 'lucide-react'
import { useGetPriceListsQuery } from '../../customers/priceLists/priceListsApi'
import { priceListLabel } from '../../customers/priceLists/priceListOptions'
import { useCan } from '../../../hooks/usePermissions'
import '../../customers/priceLists/priceLists.css'

/**
 * Lista de precios de la venta (D-PRE-1). Sale sola según el cliente; quien tiene el permiso
 * sales.change_price_list puede escoger otra (choice: undefined = la del cliente, null = precio normal).
 * Sin permiso de cambiarla, solo se muestra cuando la venta tiene lista.
 */
export function PosPriceList({ customer, applied, choice, onChange }) {
  const canChange = useCan('sales.change_price_list')
  const { data: lists = [] } = useGetPriceListsQuery({ isActive: 'true' }, { skip: !canChange })
  const customerList = customer?.priceList?.isActive ? customer.priceList : null
  if (canChange ? lists.length === 0 && !applied : !(applied ?? customerList)) return null

  const value = choice === undefined ? 'customer' : choice === null ? 'none' : String(choice)
  const current = applied ?? (choice === undefined ? customerList : lists.find((list) => list.id === choice) ?? null)

  return (
    <div className="pos-pricelist" aria-live="polite">
      <BadgePercent aria-hidden="true" />
      {canChange ? (
        <label className="pos-pricelist__field">
          <span>Precios:</span>{' '}
          <select
            aria-label="Lista de precios de la venta"
            value={value}
            onChange={(event) => {
              const next = event.target.value
              onChange(next === 'customer' ? undefined : next === 'none' ? null : Number(next))
            }}
          >
            <option value="customer">{customerList ? `Del cliente: ${priceListLabel(customerList)}` : 'Del cliente: precio normal'}</option>
            <option value="none">Precio normal</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {priceListLabel(list)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span>
          Precios: <strong>{priceListLabel(current)}</strong>
        </span>
      )}
      {choice !== undefined && <small>Cambiaste la lista del cliente: queda registrado en la venta.</small>}
    </div>
  )
}
