import { useState } from 'react'
import { Truck, UserPlus, X } from 'lucide-react'
import { useGetPortersQuery } from '../../expenses/porters/portersApi'
import { PorterFormModal } from '../../expenses/porters/PorterModals'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { toApiNumber, toInputMoney } from '../../../utils/numberInput'

/**
 * Flete con conductor (D-FLE-1): el pasaje que el negocio le paga al conductor del carro de línea.
 * Va en la misma venta (de contado lo paga el cliente; fiado, queda en su deuda) y el pasaje sale
 * en efectivo de la caja al conductor. value: { isOpen, porterId, amount } · onChange(next).
 * Si el conductor no existe, con porters.manage se registra aquí mismo y queda escogido.
 */
export function PosFreight({ value, onChange }) {
  const toast = useToast()
  const canManage = useCan('porters.manage')
  const [isCreating, setIsCreating] = useState(false)
  const { data: drivers = [], isLoading } = useGetPortersQuery({ isActive: 'true' }, { skip: !value.isOpen })
  const rateOf = (porterId) => drivers.find((driver) => String(driver.id) === String(porterId))?.tripRate

  if (!value.isOpen) {
    return (
      <button type="button" className="pos-freight__add" onClick={() => onChange({ ...value, isOpen: true })}>
        <Truck aria-hidden="true" /> Agregar flete
      </button>
    )
  }

  const choose = (porterId) => {
    // La tarifa del conductor se propone si el valor está vacío o era la del conductor anterior
    const previousRate = rateOf(value.porterId)
    const keepAmount = toApiNumber(value.amount) && toApiNumber(value.amount) !== String(Number(previousRate ?? 0))
    const rate = rateOf(porterId)
    onChange({ ...value, porterId, amount: keepAmount || !(Number(rate) > 0) ? value.amount : toInputMoney(rate) })
  }

  return (
    <fieldset className="pos-freight">
      <legend className="pos-freight__legend">
        <Truck aria-hidden="true" /> Flete
      </legend>
      <select className="pos-freight__driver" aria-label="Conductor del flete" value={value.porterId} onChange={(event) => choose(event.target.value)} disabled={isLoading}>
        <option value="">{isLoading ? 'Cargando conductores…' : drivers.length ? 'Escoge el conductor' : 'No hay conductores registrados'}</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.name}
          </option>
        ))}
      </select>
      {canManage && (
        <button type="button" className="pos-freight__new" onClick={() => setIsCreating(true)}>
          <UserPlus aria-hidden="true" /> Nuevo conductor
        </button>
      )}
      <span className="pos-discount-all__input">
        <span aria-hidden="true">$</span>
        <input inputMode="decimal" placeholder="0" aria-label="Valor del flete" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} />
      </span>
      <button type="button" className="pos-freight__remove" aria-label="Quitar el flete" onClick={() => onChange({ isOpen: false, porterId: '', amount: '' })}>
        <X aria-hidden="true" />
      </button>
      <p className="pos-freight__hint">Va en la factura del cliente y el pasaje sale de la caja al conductor.</p>

      {isCreating && (
        <PorterFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(saved) => {
            setIsCreating(false)
            toast.success(`${saved.name} quedó registrado`)
            // Queda escogido en la venta, con su flete propuesto si lo tiene
            onChange({ ...value, porterId: String(saved.id), amount: Number(saved.tripRate) > 0 ? toInputMoney(saved.tripRate) : value.amount })
          }}
        />
      )}
    </fieldset>
  )
}
