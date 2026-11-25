import { useState } from 'react'
import { Barcode, Boxes, CircleDollarSign, PackageOpen } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Switch } from '../../../components/ui/Switch/Switch'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useCan } from '../../../hooks/usePermissions'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { useAddPresentationMutation, useUpdatePresentationMutation } from '../inventoryApi'
import { MONEY_PATTERN, QUANTITY_PATTERN, toApiNumber, toInputNumber } from '../inventoryOptions'
import { useBelowCostConfirmation } from './useBelowCostConfirmation'
import { previewProfit, scalePrice } from './profitPreview'
import { presentationPresets } from './presentationPresets'
import './PresentationFormModal.css'

/**
 * Presentación o empaque de un producto (D11): "Bulto 40 kg" contiene 40 unidades base y tiene
 * precio y código de barras propios. Un empaque que no se vende completo (un frasco que se
 * vende por cc o por dosis) no tiene precio de venta y solo sirve para comprar (D-INV-20).
 */
export function PresentationFormModal({ product, presentation, onClose, onSaved }) {
  const isEdit = Boolean(presentation)
  const canChangePrice = useCan('inventory.prices')
  const priceLocked = isEdit && !canChangePrice
  const unit = product.unit
  const [form, setForm] = useState({
    name: presentation?.name ?? '',
    factor: toInputNumber(presentation?.factor),
    salePrice: toInputNumber(presentation?.salePrice),
    barcode: presentation?.barcode ?? '',
    isSoldWhole: presentation?.isSoldWhole ?? true,
  })
  const [localErrors, setLocalErrors] = useState({})
  const [addPresentation, addState] = useAddPresentationMutation()
  const [updatePresentation, updateState] = useUpdatePresentationMutation()
  const belowCost = useBelowCostConfirmation()
  const { isLoading, error } = isEdit ? updateState : addState
  const { fieldErrors: serverErrors, formError } = splitApiError(error?.code === 'CONFIRMATION_REQUIRED' ? null : error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  // Atajos (D-INV-22): Libra, Arroba, Medio bulto… llenan el nombre y el contenido
  const presets = isEdit ? [] : presentationPresets(product)

  const factor = toApiNumber(form.factor)
  const price = toApiNumber(form.salePrice)
  const validFactor = QUANTITY_PATTERN.test(factor) && Number(factor) > 0
  // Solo con permiso de costos llega el precio de compra del producto
  const purchase = product.purchasePrice !== undefined && validFactor ? scalePrice(product.purchasePrice, factor) : null
  const profit = form.isSoldWhole && purchase !== null && MONEY_PATTERN.test(price) ? previewProfit(purchase, price) : null
  // El precio se envía al crear, si cambió o si el empaque pasa a venderse completo
  const priceChanged = !isEdit || Number(price) !== Number(presentation.salePrice) || !presentation.isSoldWhole

  const bind = (name) => ({
    value: form[name],
    error: fieldErrors[name],
    onChange: (event) => {
      setForm((current) => ({ ...current, [name]: event.target.value }))
      setLocalErrors((current) => ({ ...current, [name]: undefined }))
    },
  })

  const save = (confirm) => {
    const body = {
      name: form.name.trim(),
      factor,
      barcode: form.barcode.trim() || null,
      isSoldWhole: form.isSoldWhole,
      ...(form.isSoldWhole && priceChanged && (!isEdit || canChangePrice) && { salePrice: price }),
      ...(confirm && { confirmBelowCost: true }),
    }
    return isEdit
      ? updatePresentation({ productId: product.id, presentationId: presentation.id, ...body }).unwrap()
      : addPresentation({ productId: product.id, ...body }).unwrap()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre (ej. Bulto 40 kg)'
    if (!validFactor) errors.factor = `Cuántos ${unit.symbol} trae (mayor que cero)`
    else if (!unit.allowsDecimals && !/^\d+$/.test(factor)) errors.factor = `La unidad ${unit.symbol} solo admite cantidades enteras`
    if (form.isSoldWhole && !MONEY_PATTERN.test(price)) errors.salePrice = 'Escribe el precio (ej. 98.000)'
    if (form.barcode.trim() && !/^[A-Za-z0-9-]{3,50}$/.test(form.barcode.trim())) errors.barcode = 'De 3 a 50 letras, números o guiones'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const saved = await belowCost.run(save)
      if (saved) onSaved(saved, isEdit)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={Boxes}
      title={isEdit ? 'Editar presentación' : 'Nueva presentación'}
      description={`${product.name}. Los campos con * son obligatorios.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="presentation-form" isLoading={isLoading && !belowCost.isOpen}>
            {isEdit ? 'Guardar cambios' : 'Agregar presentación'}
          </Button>
        </>
      }
    >
      <FormWithPreview
        previewLabel="Equivalencia"
        preview={
          <div className="presentation-preview">
            <span className="presentation-preview__icon" aria-hidden="true">
              <PackageOpen />
            </span>
            <p className="presentation-preview__name">{form.name.trim() || 'Presentación'}</p>
            <p className="presentation-preview__equals">
              = {validFactor ? formatQuantity(factor) : '…'} <strong>{unit.symbol}</strong>
            </p>
            <p className="presentation-preview__price">{form.isSoldWhole ? (MONEY_PATTERN.test(price) ? formatCurrency(price) : '$ —') : `Se vende por ${unit.symbol}`}</p>
            {purchase !== null && <p className="presentation-preview__base">Compra: {formatCurrency(purchase)}</p>}
            {profit && (
              <p className={`presentation-preview__profit${profit.profit.startsWith('-') ? ' presentation-preview__profit--loss' : ''}`}>
                {profit.profit.startsWith('-') ? 'Pierde' : 'Gana'} {formatCurrency(profit.profit.replace('-', ''))}
                {profit.percent !== null && ` (${profit.percent.replace('.', ',')} %)`}
              </p>
            )}
            <p className="presentation-preview__base">
              Unidad base: {formatCurrency(product.salePrice)} / {unit.symbol}
            </p>
          </div>
        }
      >
        <form id="presentation-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}
          <FormSection icon={Boxes} title="Presentación" description="Ej.: Bulto 40 kg, Caja x 12, Frasco 100 cc.">
            {presets.length > 0 && (
              <div className="form-section__full presentation-presets" role="group" aria-label="Atajos de presentaciones">
                <span className="presentation-presets__label">Atajos:</span>
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`presentation-presets__chip${form.name === preset.name && toApiNumber(form.factor) === preset.factor ? ' presentation-presets__chip--active' : ''}`}
                    onClick={() => {
                      setForm((current) => ({ ...current, name: preset.name, factor: toInputNumber(preset.factor) }))
                      setLocalErrors((current) => ({ ...current, name: undefined, factor: undefined }))
                    }}
                  >
                    {preset.name} <small>{formatQuantity(preset.factor)} {unit.symbol}</small>
                  </button>
                ))}
              </div>
            )}
            <TextField className="form-section__full" label="Nombre" placeholder="Ej.: Bulto 40 kg" maxLength={60} data-autofocus {...bind('name')} required />
            <TextField label={`Contenido (${unit.symbol})`} inputMode="decimal" placeholder="Ej.: 40" hint={`Cuántos ${unit.symbol} trae.`} {...bind('factor')} required />
            <div className="form-section__full">
              <Switch
                label="Se vende completo"
                description={`Apágalo si solo lo compras así (ej. un frasco) y lo vendes por ${unit.symbol}: no aparece en el punto de venta.`}
                checked={form.isSoldWhole}
                disabled={priceLocked}
                onChange={(checked) => {
                  setForm((current) => ({ ...current, isSoldWhole: checked }))
                  setLocalErrors((current) => ({ ...current, salePrice: undefined }))
                }}
              />
            </div>
            {form.isSoldWhole && (
              <TextField
                label="Precio de venta"
                icon={CircleDollarSign}
                inputMode="decimal"
                placeholder="Ej.: 98.000"
                disabled={priceLocked}
                hint={priceLocked ? 'Cambiar precios requiere el permiso "Cambiar precios de venta".' : undefined}
                {...bind('salePrice')}
                required
              />
            )}
            <TextField className="form-section__full" label="Código de barras" icon={Barcode} hint="Opcional. Único." maxLength={50} {...bind('barcode')} />
          </FormSection>
        </form>
      </FormWithPreview>

      <ConfirmDialog
        isOpen={belowCost.isOpen}
        tone="danger"
        title="Precio por debajo del costo"
        message="El precio de esta presentación queda por debajo de su costo. ¿Quieres guardarlo así? Quedará registrado en el historial de precios."
        confirmLabel="Sí, guardar así"
        isLoading={isLoading}
        onConfirm={async () => {
          try {
            onSaved(await belowCost.confirm(), isEdit)
          } catch {
            // Se muestra desde `error`
          }
        }}
        onCancel={belowCost.cancel}
      />
    </Modal>
  )
}
