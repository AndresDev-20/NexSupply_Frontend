import { Hash, Info } from 'lucide-react'
import { usePaymentMethodInfo } from './paymentHelpers'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextField } from '../../../components/ui/TextField/TextField'
import '../../settings/settings.css'

/**
 * Datos del pago a un proveedor (D-COMP-7, D-COMP-8): método y referencia (si el método la pide).
 * Las compras no tocan la caja: la caja es solo para las ventas del negocio.
 * value: { paymentMethodId, paymentReference }.
 */
export function PaymentFields({ value, onChange, errors = {} }) {
  const { methods, method } = usePaymentMethodInfo(value.paymentMethodId)

  return (
    <>
      <SelectField
        label="Método de pago"
        placeholder="Selecciona…"
        options={methods.map((item) => ({ value: String(item.id), label: item.name }))}
        value={value.paymentMethodId}
        onChange={(event) => onChange({ ...value, paymentMethodId: event.target.value })}
        error={errors.paymentMethodId}
        required
      />
      {method?.requiresReference && (
        <TextField label="Referencia" icon={Hash} placeholder="Ej.: número de la transferencia" maxLength={60} value={value.paymentReference ?? ''} onChange={(event) => onChange({ ...value, paymentReference: event.target.value })} error={errors.paymentReference} required />
      )}
      {method?.isCash && (
        <p className="settings-note form-section__full">
          <Info aria-hidden="true" />
          <span>Queda registrado como pago en efectivo. No sale de la caja: la caja es solo para las ventas.</span>
        </p>
      )}
    </>
  )
}
