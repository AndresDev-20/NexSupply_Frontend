import { useState } from 'react'
import { Coins, PackageCheck, Warehouse } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatQuantity } from '../../../utils/format'
import { useLoadInitialStockMutation } from '../inventoryApi'
import { COST_PATTERN, QUANTITY_PATTERN, toApiNumber, toInputNumber } from '../inventoryOptions'

/**
 * Existencia inicial (D-INV-6): lo que ya hay en bodega y lo que costó cada unidad.
 * Solo una vez, antes de cualquier otro movimiento.
 */
export function InitialStockModal({ product, onClose, onSaved }) {
  const unit = product.unit
  // El costo de arranque propuesto es el precio de compra del producto (D-INV-13)
  const [form, setForm] = useState({ quantity: '', unitCost: toInputNumber(product.purchasePrice) })
  const [localErrors, setLocalErrors] = useState({})
  const [loadInitialStock, { isLoading, error }] = useLoadInitialStockMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const bind = (name) => ({
    value: form[name],
    error: fieldErrors[name],
    onChange: (event) => {
      setForm((current) => ({ ...current, [name]: event.target.value }))
      setLocalErrors((current) => ({ ...current, [name]: undefined }))
    },
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const quantity = toApiNumber(form.quantity)
    const unitCost = toApiNumber(form.unitCost)
    const errors = {}
    if (!QUANTITY_PATTERN.test(quantity) || Number(quantity) <= 0) errors.quantity = 'Escribe una cantidad mayor que cero'
    else if (!unit.allowsDecimals && !/^\d+$/.test(quantity)) errors.quantity = `La unidad ${unit.symbol} solo admite cantidades enteras`
    if (!COST_PATTERN.test(unitCost)) errors.unitCost = 'Escribe el costo de una unidad (ej. 2.100)'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const saved = await loadInitialStock({ productId: product.id, quantity, unitCost }).unwrap()
      onSaved(saved)
    } catch {
      // Se muestra desde `error`
    }
  }

  const previewQuantity = toApiNumber(form.quantity)
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={Warehouse}
      title="Existencia inicial"
      description={`${product.name}. Se carga una sola vez; después la existencia cambia con compras, ventas o ajustes.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="initial-stock-form" icon={PackageCheck} isLoading={isLoading}>
            Registrar existencia
          </Button>
        </>
      }
    >
      <form id="initial-stock-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={Warehouse} title="Lo que hay hoy en bodega">
          <TextField
            label={`Cantidad (${unit.symbol})`}
            inputMode="decimal"
            placeholder={unit.allowsDecimals ? 'Ej.: 400 o 12,5' : 'Ej.: 24'}
            data-autofocus
            hint={QUANTITY_PATTERN.test(previewQuantity) && Number(previewQuantity) > 0 ? `${formatQuantity(previewQuantity)} ${unit.symbol}` : undefined}
            {...bind('quantity')}
            required
          />
          <TextField
            label={`Costo de 1 ${unit.symbol}`}
            icon={Coins}
            inputMode="decimal"
            placeholder="Ej.: 2.100"
            hint={product.purchasePrice ? 'Propuesto: el precio de compra. Con este costo empieza el costo promedio.' : 'Con este costo empieza el costo promedio.'}
            {...bind('unitCost')}
            required
          />
        </FormSection>
      </form>
    </Modal>
  )
}
