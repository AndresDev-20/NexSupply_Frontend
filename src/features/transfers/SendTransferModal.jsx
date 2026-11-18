import { useMemo, useState } from 'react'
import { ArrowLeftRight, Send, Trash2, Truck } from 'lucide-react'
import { useSelector } from 'react-redux'
import { useGetTransferDestinationsQuery, useSendTransferMutation } from './transfersApi'
import { selectActiveBranch } from '../auth/authSlice'
import { ProductSearch } from '../purchases/detail/ProductSearch'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { TextField } from '../../components/ui/TextField/TextField'
import { TextAreaField } from '../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Alert } from '../../components/feedback/Alert/Alert'
import { splitApiError } from '../../utils/formErrors'
import { formatQuantity } from '../../utils/format'
import { QUANTITY_PATTERN, toApiNumber } from '../../utils/numberInput'
import { previewMultiply, previewSubtract } from '../../utils/moneyPreview'
import { newIdempotencyKey } from '../../utils/idempotencyKey'

const isPositive = (text) => QUANTITY_PATTERN.test(text) && !/^0+(\.0+)?$/.test(text)

/** Disponible para enviar en unidad base: existencia − apartado (lo apartado no se envía). */
const availableOf = (product) => previewSubtract(product.stock ?? '0', product.reservedStock ?? '0') ?? '0'

/** Una línea del envío: producto, en qué presentación va y cuánto. */
function TransferLine({ line, index, error, onChange, onRemove }) {
  const { product } = line
  const unit = product.unit
  const packs = (product.presentations ?? []).filter((item) => item.isActive)
  const pack = packs.find((item) => String(item.id) === line.presentationId)
  const quantity = toApiNumber(line.quantity)
  const inBase = pack && isPositive(quantity) ? previewMultiply(pack.factor, quantity) : null
  const available = availableOf(product)

  return (
    <li className="purchase-line">
      <div className="purchase-line__head">
        <span className="purchase-line__number">{index + 1}</span>
        <span className="purchase-line__product">
          <span className="purchase-line__name">{product.name}</span>
          <span className="purchase-line__meta">
            {product.code} · disponible {formatQuantity(available)} {unit?.symbol}
            {product.tracksBatches && <span className="purchase-line__tag">Salen primero los lotes que vencen antes</span>}
          </span>
        </span>
        <IconButton icon={Trash2} tone="danger" label={`Quitar ${product.name}`} onClick={onRemove} />
      </div>
      <div className="transfer-line__fields">
        <SelectField
          label="Va en"
          options={[{ value: '', label: unit?.name ?? 'Unidad base' }, ...packs.map((item) => ({ value: String(item.id), label: item.name }))]}
          value={line.presentationId}
          onChange={(event) => onChange({ ...line, presentationId: event.target.value })}
          error={error(`items[${index}].presentationId`)}
        />
        <TextField
          label="Cantidad"
          inputMode="decimal"
          placeholder="Ej.: 10"
          value={line.quantity}
          onChange={(event) => onChange({ ...line, quantity: event.target.value })}
          error={error(`items[${index}].quantity`)}
          hint={inBase ? `= ${formatQuantity(inBase)} ${unit?.symbol}` : undefined}
          required
        />
      </div>
    </li>
  )
}

/**
 * Enviar mercancía a otra sede (D-INT-1). Sale de la sede activa al costo que tiene aquí y
 * queda "en camino" hasta que la otra sede la reciba. Una clave por formulario evita el doble envío.
 */
export function SendTransferModal({ onClose, onSent }) {
  const origin = useSelector(selectActiveBranch)
  const { data: destinations = [], isLoading: loadingDestinations } = useGetTransferDestinationsQuery()
  const [sendTransfer, { isLoading, error }] = useSendTransferMutation()
  const [destinationId, setDestinationId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [localErrors, setLocalErrors] = useState({})
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [])
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const errors = { ...serverErrors, ...localErrors }
  const fieldError = (field) => errors[field]

  const addProduct = (product) => {
    if (lines.some((line) => line.product.id === product.id)) {
      setLocalErrors({ items: `${product.name} ya está en el envío: cambia su cantidad` })
      return
    }
    // Si el producto tiene presentaciones, se propone la más grande (bulto)
    const biggest = (product.presentations ?? []).filter((item) => item.isActive).at(-1)
    setLines((current) => [...current, { key: `${product.id}-${Date.now()}`, product, presentationId: biggest ? String(biggest.id) : '', quantity: '' }])
    setLocalErrors({})
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const found = {}
    if (!destinationId) found.destinationBranchId = 'Escoge a qué sede va'
    if (lines.length === 0) found.items = 'Agrega al menos un producto'
    lines.forEach((line, index) => {
      if (!isPositive(toApiNumber(line.quantity))) found[`items[${index}].quantity`] = 'Escribe cuánto va'
    })
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const result = await sendTransfer({
        idempotencyKey,
        destinationBranchId: Number(destinationId),
        notes: notes.trim() || null,
        items: lines.map((line) => ({ productId: line.product.id, presentationId: line.presentationId ? Number(line.presentationId) : null, quantity: toApiNumber(line.quantity) })),
      }).unwrap()
      onSent(result)
    } catch {
      // Se muestra en el formulario
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="lg"
      icon={Truck}
      title="Enviar mercancía a otra sede"
      description={`Sale de ${origin?.name ?? 'tu sede'} al costo que tiene aquí y queda en camino hasta que la otra sede la reciba.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="send-transfer-form" icon={Send} isLoading={isLoading}>
            Enviar
          </Button>
        </>
      }
    >
      <form id="send-transfer-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        {!loadingDestinations && destinations.length === 0 && (
          <div className="admin-form__alert">
            <Alert tone="info">No hay otra sede activa a la cual enviar.</Alert>
          </div>
        )}
        <FormSection icon={ArrowLeftRight} title="Hacia dónde" description="La otra sede recibe un aviso y confirma lo que llegó.">
          <SelectField
            label="Sede de destino"
            placeholder="Escoge la sede"
            options={destinations.map((branch) => ({ value: String(branch.id), label: branch.name }))}
            value={destinationId}
            onChange={(event) => {
              setDestinationId(event.target.value)
              setLocalErrors((current) => ({ ...current, destinationBranchId: undefined }))
            }}
            error={fieldError('destinationBranchId')}
            required
          />
          <TextAreaField label="Nota" placeholder="Ej.: va en el camión de la mañana" maxLength={255} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} error={fieldError('notes')} hint="Opcional" />
        </FormSection>

        <FormSection icon={Truck} title="Qué va" description="Busca por nombre, código o con el lector. No se puede enviar lo apartado.">
          <div className="form-section__full">
            <ProductSearch onPick={addProduct} disabled={isLoading} />
            {fieldError('items') && (
              <p className="transfer-form__error" role="alert">
                {fieldError('items')}
              </p>
            )}
          </div>
          {lines.length > 0 && (
            <ol className="purchase-lines form-section__full" aria-label="Productos del envío">
              {lines.map((line, index) => (
                <TransferLine
                  key={line.key}
                  line={line}
                  index={index}
                  error={fieldError}
                  onChange={(next) => setLines((current) => current.map((item) => (item.key === line.key ? next : item)))}
                  onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                />
              ))}
            </ol>
          )}
        </FormSection>
      </form>
    </Modal>
  )
}
