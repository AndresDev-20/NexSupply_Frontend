import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ClipboardPen, Scale } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatQuantity } from '../../../utils/format'
import { useAdjustStockMutation } from '../inventoryApi'
import { ADJUSTMENT_REASONS, QUANTITY_PATTERN, toApiNumber } from '../inventoryOptions'
import { scalePrice } from './profitPreview'
import { useGetProductBatchesQuery } from '../../purchases/purchasesApi'
import { formatDay } from '../../purchases/purchaseOptions'
import { useHasFeature } from '../../../hooks/usePermissions'
import '../../admin/admin.css'
import '../inventory.css'

const DIRECTIONS = [
  { value: 'out', label: 'Salida', description: 'Sale producto: daño, vencimiento, pérdida, consumo…', icon: ArrowUpFromLine },
  { value: 'in', label: 'Entrada', description: 'Entra producto: conteo, bonificación…', icon: ArrowDownToLine },
]

/**
 * Ajuste de existencia (D-INV-14): entrada o salida con motivo. La existencia nunca se
 * edita directamente: queda un movimiento en el kárdex y un registro en la auditoría.
 * La cantidad puede escribirse en la unidad base o en una presentación (bultos).
 */
export function AdjustStockModal({ product, onClose, onSaved }) {
  const unit = product.unit
  const packs = product.presentations.filter((item) => item.isActive)
  const [form, setForm] = useState({ direction: 'out', quantity: '', presentationId: '', batchId: '', reason: '', notes: '' })
  const [localErrors, setLocalErrors] = useState({})
  const [adjustStock, { isLoading, error }] = useAdjustStockMutation()
  // Salidas de productos con lotes: del que vence primero (FEFO) o de un lote escogido (D-INV-16)
  const hasPurchases = useHasFeature('purchases')
  const withBatches = product.tracksBatches && hasPurchases
  const { data: batches = [] } = useGetProductBatchesQuery({ productId: product.id }, { skip: !withBatches })
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const reasons = ADJUSTMENT_REASONS.filter((reason) => reason.directions.includes(form.direction))
  const reason = ADJUSTMENT_REASONS.find((item) => item.value === form.reason)
  const pack = packs.find((item) => String(item.id) === form.presentationId)
  const quantity = toApiNumber(form.quantity)
  const valid = QUANTITY_PATTERN.test(quantity) && !/^0+(\.0+)?$/.test(quantity)
  const inBase = valid ? (pack ? scalePrice(quantity, pack.factor) : quantity) : null

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value, ...(name === 'direction' && { reason: '' }) }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!valid) errors.quantity = 'Escribe una cantidad mayor que cero (ej. 2 o 12,5)'
    else if (!pack && !unit.allowsDecimals && !/^\d+$/.test(quantity)) errors.quantity = `La unidad ${unit.symbol} solo admite cantidades enteras`
    if (!reason) errors.reason = 'Selecciona el motivo'
    if (reason?.requiresNotes && !form.notes.trim()) errors.notes = 'Explica el motivo del ajuste'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const saved = await adjustStock({
        productId: product.id,
        direction: form.direction,
        quantity,
        ...(pack && { presentationId: pack.id }),
        ...(form.direction === 'out' && form.batchId && { batchId: Number(form.batchId) }),
        reason: form.reason,
        notes: form.notes.trim() || null,
      }).unwrap()
      onSaved(saved)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={Scale}
      title="Ajustar existencia"
      description={`${product.name}. Hay ${formatQuantity(product.stock)} ${unit.symbol}. El ajuste queda en el kárdex con su motivo.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="adjust-stock-form" icon={Scale} isLoading={isLoading}>
            Registrar ajuste
          </Button>
        </>
      }
    >
      <form id="adjust-stock-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <div className="adjust-stock__direction">
          <OptionCards legend="Tipo de ajuste" name="direction" options={DIRECTIONS} value={form.direction} onChange={(value) => set('direction', value)} />
        </div>
        <FormSection icon={ClipboardPen} title="Cantidad y motivo">
          <TextField
            label="Cantidad"
            inputMode="decimal"
            placeholder="Ej.: 2"
            data-autofocus
            hint={inBase && pack ? `${formatQuantity(quantity)} × ${pack.name} = ${formatQuantity(inBase)} ${unit.symbol}` : undefined}
            value={form.quantity}
            onChange={(event) => set('quantity', event.target.value)}
            error={fieldErrors.quantity}
            required
          />
          <SelectField
            label="En"
            options={[{ value: '', label: `${unit.name} (${unit.symbol})` }, ...packs.map((item) => ({ value: String(item.id), label: item.name }))]}
            value={form.presentationId}
            onChange={(event) => set('presentationId', event.target.value)}
            error={fieldErrors.presentationId}
          />
          {withBatches && form.direction === 'out' && (
            <SelectField
              className="form-section__full"
              label="Lote"
              options={[
                { value: '', label: 'El que vence primero (automático)' },
                ...batches.map((batch) => ({ value: String(batch.id), label: `${batch.lotNumber} · vence ${formatDay(batch.expirationDate)} · ${formatQuantity(batch.availableQuantity)} ${unit.symbol}` })),
              ]}
              hint="Ej.: escoge el lote vencido que vas a sacar. Si no, sale del que vence primero."
              value={form.batchId}
              onChange={(event) => set('batchId', event.target.value)}
              error={fieldErrors.batchId}
            />
          )}
          <SelectField
            className="form-section__full"
            label="Motivo"
            placeholder="Selecciona…"
            options={reasons.map((item) => ({ value: item.value, label: item.label }))}
            value={form.reason}
            onChange={(event) => set('reason', event.target.value)}
            error={fieldErrors.reason}
            required
          />
          <TextAreaField
            className="form-section__full"
            label="Nota"
            placeholder={reason?.requiresNotes ? 'Explica qué pasó' : 'Opcional. Ej.: bulto mojado en la bodega'}
            maxLength={200}
            rows={2}
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
            error={fieldErrors.notes}
            required={Boolean(reason?.requiresNotes)}
          />
        </FormSection>
      </form>
    </Modal>
  )
}
