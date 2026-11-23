import { useState } from 'react'
import { HeartCrack, PackagePlus, PencilLine, TrendingUp } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Switch } from '../../../components/ui/Switch/Switch'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { previewAnimalPrice, validatePricing } from './animalPricing'
import { useGetAnimalLotsQuery, useReceiveAnimalLotMutation, useRegisterAnimalDeathMutation, useUpdateAnimalLotMutation } from '../inventoryApi'
import { COST_PATTERN, QUANTITY_PATTERN, toApiNumber, toInputNumber } from '../inventoryOptions'
import { formatDay, todayIso } from '../../purchases/purchaseOptions'
import '../../admin/admin.css'
import '../inventory.css'

const isPositive = (text) => QUANTITY_PATTERN.test(text) && !/^0+(\.0+)?$/.test(text)
const isWhole = (text) => /^\d+$/.test(text)

/** Días entre dos fechas "AAAA-MM-DD" (sin zonas horarias). */
function daysBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

/**
 * Campos del precio de un lote: precio de venta (el del día que llegan) y lo que sube cada día.
 * El precio máximo es opcional y solo se muestra al corregir el precio (withMax).
 */
export function PricingFields({ form, errors, onChange, autoFocus = false, withMax = false }) {
  return (
    <>
      <TextField label="Precio de venta" icon={TrendingUp} inputMode="decimal" placeholder="Ej.: 2.000" hint="Lo que vale cada animal el día que llegan." data-autofocus={autoFocus || undefined} value={form.baseSalePrice} error={errors.baseSalePrice} onChange={(event) => onChange('baseSalePrice', event.target.value)} required />
      <TextField label="Sube cada día" inputMode="decimal" placeholder="Ej.: 200" hint="Cuánto aumenta por día. 0 = no sube." value={form.dailyIncrease} error={errors.dailyIncrease} onChange={(event) => onChange('dailyIncrease', event.target.value)} required />
      {withMax && (
        <TextField label="Precio máximo" inputMode="decimal" placeholder="Sin tope" hint="Opcional. Al llegar aquí deja de subir." value={form.maxSalePrice} error={errors.maxSalePrice} onChange={(event) => onChange('maxSalePrice', event.target.value)} />
      )}
    </>
  )
}

/** Línea de ejemplo: "Hoy $ 2.000 · en 7 días $ 3.400 · en 30 días $ 8.000". */
function PricePreview({ form, startDays = 0 }) {
  const base = toApiNumber(form.baseSalePrice)
  if (!isPositive(base)) return null
  const at = (days) => previewAnimalPrice(base, toApiNumber(form.dailyIncrease || '0'), days, toApiNumber(form.maxSalePrice))
  return (
    <p className="settings-note form-section__full" role="status">
      <TrendingUp aria-hidden="true" />
      <span>
        Hoy {formatCurrency(at(startDays))} · en 7 días {formatCurrency(at(startDays + 7))} · en 30 días {formatCurrency(at(startDays + 30))}
      </span>
    </p>
  )
}

/** «Recibir lote» de animales que no llegan por una compra (nacidos en la finca, ingreso inicial). */
export function ReceiveAnimalLotModal({ product, onClose, onSaved }) {
  const today = todayIso()
  // Propone el precio de compra y el de venta que tiene el producto
  const [form, setForm] = useState({
    quantity: '',
    unitCost: Number(product.purchasePrice) > 0 ? toInputNumber(product.purchasePrice) : '',
    receivedOn: today,
    baseSalePrice: Number(product.salePrice) > 0 ? toInputNumber(product.salePrice) : '',
    dailyIncrease: '',
    maxSalePrice: '',
    notes: '',
  })
  const [localErrors, setLocalErrors] = useState({})
  const [receive, { isLoading, error }] = useReceiveAnimalLotMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const errors = { ...serverErrors, ...localErrors }
  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const days = form.receivedOn && form.receivedOn <= today ? daysBetween(form.receivedOn, today) : 0

  const handleSubmit = async (event) => {
    event.preventDefault()
    const pricing = validatePricing(form)
    const found = { ...pricing.errors }
    const quantity = toApiNumber(form.quantity)
    if (!isPositive(quantity) || !isWhole(quantity)) found.quantity = 'Escribe cuántos animales llegaron (número entero)'
    if (!COST_PATTERN.test(toApiNumber(form.unitCost))) found.unitCost = 'Escribe el precio de compra de cada animal (ej. 1.500 o 0)'
    if (!form.receivedOn) found.receivedOn = 'Escribe la fecha de llegada'
    else if (form.receivedOn > today) found.receivedOn = 'La fecha de llegada no puede ser futura'
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const saved = await receive({ productId: product.id, quantity, unitCost: toApiNumber(form.unitCost), receivedOn: form.receivedOn, ...pricing.body, notes: form.notes.trim() || null }).unwrap()
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
      size="lg"
      icon={PackagePlus}
      title="Recibir lote"
      description={`${product.name}. Para animales que no llegan por una compra (las compras crean su lote solas).`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="animal-lot-form" isLoading={isLoading}>
            Recibir lote
          </Button>
        </>
      }
    >
      <form id="animal-lot-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={PackagePlus} title="Lo que llegó">
          <TextField label="¿Cuántos llegaron?" inputMode="numeric" placeholder="Ej.: 50" data-autofocus value={form.quantity} error={errors.quantity} onChange={(event) => set('quantity', event.target.value)} required />
          <TextField label="Precio de compra" inputMode="decimal" placeholder="Ej.: 1.500" hint="De cada animal. 0 si nacieron en la finca." value={form.unitCost} error={errors.unitCost} onChange={(event) => set('unitCost', event.target.value)} required />
          <TextField label="Llegaron el" type="date" max={today} value={form.receivedOn} error={errors.receivedOn} onChange={(event) => set('receivedOn', event.target.value)} hint="Desde ese día se cuentan los días del precio." required />
        </FormSection>
        <FormSection icon={TrendingUp} title="Precio de venta">
          <PricingFields form={form} errors={errors} onChange={set} />
          <PricePreview form={form} startDays={days} />
        </FormSection>
        <FormSection title="Nota" columns={1}>
          <TextAreaField label="Nota" rows={2} maxLength={200} hint="Opcional. Ej.: nacidos de la cerda 3." value={form.notes} error={errors.notes} onChange={(event) => set('notes', event.target.value)} />
        </FormSection>
      </form>
    </Modal>
  )
}

/** «Registrar muerte»: salen del lote como pérdida. */
function AnimalDeathModal({ product, lot, onClose, onSaved }) {
  const [form, setForm] = useState({ quantity: '', notes: '' })
  const [localErrors, setLocalErrors] = useState({})
  const [registerDeath, { isLoading, error }] = useRegisterAnimalDeathMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const errors = { ...serverErrors, ...localErrors }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const quantity = toApiNumber(form.quantity)
    const found = {}
    if (!isPositive(quantity) || !isWhole(quantity)) found.quantity = 'Escribe cuántos murieron (número entero)'
    else if (Number(quantity) > Number(lot.availableQuantity)) found.quantity = `En el lote solo quedan ${formatQuantity(lot.availableQuantity)}`
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      onSaved(await registerDeath({ productId: product.id, lotId: lot.id, quantity, notes: form.notes.trim() || null }).unwrap())
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={HeartCrack}
      title="Registrar muerte"
      description={`${product.name} · lote ${lot.lotNumber} (quedan ${formatQuantity(lot.availableQuantity)}). Salen del inventario como pérdida.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="animal-death-form" variant="danger" isLoading={isLoading}>
            Registrar muerte
          </Button>
        </>
      }
    >
      <form id="animal-death-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <TextField label="¿Cuántos murieron?" inputMode="numeric" placeholder="Ej.: 2" data-autofocus value={form.quantity} error={errors.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
        <TextAreaField label="Nota" rows={2} maxLength={200} hint="Opcional. Ej.: por el calor." value={form.notes} error={errors.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
      </form>
    </Modal>
  )
}

/** «Corregir precio» de un lote: afecta solo las ventas siguientes. */
function AnimalLotPriceModal({ product, lot, onClose, onSaved }) {
  const [form, setForm] = useState({ baseSalePrice: toInputNumber(lot.baseSalePrice), dailyIncrease: toInputNumber(lot.dailyIncrease), maxSalePrice: lot.maxSalePrice ? toInputNumber(lot.maxSalePrice) : '' })
  const [localErrors, setLocalErrors] = useState({})
  const [updateLot, { isLoading, error }] = useUpdateAnimalLotMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const errors = { ...serverErrors, ...localErrors }
  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const pricing = validatePricing(form)
    setLocalErrors(pricing.errors)
    if (Object.keys(pricing.errors).length > 0) return
    try {
      onSaved(await updateLot({ productId: product.id, lotId: lot.id, ...pricing.body }).unwrap())
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="lg"
      icon={PencilLine}
      title="Corregir precio del lote"
      description={`${product.name} · lote ${lot.lotNumber}, lleva ${lot.days} ${lot.days === 1 ? 'día' : 'días'}. Las ventas ya hechas no cambian.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="animal-price-form" isLoading={isLoading}>
            Guardar precio
          </Button>
        </>
      }
    >
      <form id="animal-price-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={TrendingUp} title="Precio de venta">
          <PricingFields form={form} errors={errors} onChange={set} autoFocus withMax />
          <PricePreview form={form} startDays={lot.days} />
        </FormSection>
      </form>
    </Modal>
  )
}

/** Pestaña «Lotes» de un animal: cuántos quedan, el precio de hoy, los muertos y las acciones. */
export function AnimalLotsTab({ product, can, onMessage }) {
  const [includeEmpty, setIncludeEmpty] = useState(false)
  const [modal, setModal] = useState(null) // { kind: 'death' | 'price', lot }
  const { data: lots = [], isFetching, error, refetch } = useGetAnimalLotsQuery({ productId: product.id, includeEmpty })

  const columns = [
    {
      key: 'lot',
      header: 'Lote',
      primary: true,
      render: (lot) => (
        <span className="entity-cell">
          <span className="entity-cell__name">{lot.lotNumber}</span>
          <span className="entity-cell__code">
            Llegó el {formatDay(lot.receivedOn)} · {lot.days} {lot.days === 1 ? 'día' : 'días'}
            {lot.supplier ? ` · ${lot.supplier.tradeName || lot.supplier.legalName}` : ''}
          </span>
        </span>
      ),
    },
    { key: 'available', header: 'Quedan', align: 'end', render: (lot) => <span className="numeric">{formatQuantity(lot.availableQuantity)} de {formatQuantity(lot.receivedQuantity)}</span> },
    { key: 'dead', header: 'Murieron', align: 'end', render: (lot) => <span className="numeric">{Number(lot.deadQuantity) > 0 ? formatQuantity(lot.deadQuantity) : '—'}</span> },
    {
      key: 'price',
      header: 'Precio hoy',
      align: 'end',
      render: (lot) => (
        <span className="entity-cell">
          <strong className="numeric">{formatCurrency(lot.priceToday)}</strong>
          <span className="entity-cell__code">
            Llegó a {formatCurrency(lot.baseSalePrice)} · sube {formatCurrency(lot.dailyIncrease)} al día{lot.maxSalePrice ? ` · máximo ${formatCurrency(lot.maxSalePrice)}` : ''}
          </span>
        </span>
      ),
    },
    ...(can.viewCost ? [{ key: 'cost', header: 'Costo', align: 'end', render: (lot) => <span className="numeric">{formatCurrency(lot.unitCost)}</span> }] : []),
    ...(can.adjust || can.prices
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            align: 'end',
            render: (lot) => (
              <div className="row-actions">
                {can.prices && (
                  <Button size="sm" variant="ghost" icon={PencilLine} onClick={() => setModal({ kind: 'price', lot })}>
                    Corregir precio
                  </Button>
                )}
                {can.adjust && Number(lot.availableQuantity) > 0 && (
                  <Button size="sm" variant="ghost" icon={HeartCrack} onClick={() => setModal({ kind: 'death', lot })}>
                    Registrar muerte
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <div className="product-detail__tab-actions">
        <Switch label="Ver lotes agotados" checked={includeEmpty} onChange={setIncludeEmpty} />
      </div>
      <DataTable
        caption="Lotes de animales"
        columns={columns}
        rows={lots}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={includeEmpty ? 'Sin lotes' : 'No hay animales disponibles'}
        emptyDescription="Los lotes entran por una compra o con «Recibir lote». Cada uno tiene su precio que sube cada día."
      />
      {modal?.kind === 'death' && (
        <AnimalDeathModal
          product={product}
          lot={modal.lot}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            onMessage(`Muerte registrada en el lote ${saved.lotNumber}: quedan ${formatQuantity(saved.availableQuantity)}`)
          }}
        />
      )}
      {modal?.kind === 'price' && (
        <AnimalLotPriceModal
          product={product}
          lot={modal.lot}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            onMessage(`Precio del lote ${saved.lotNumber} actualizado: hoy ${formatCurrency(saved.priceToday)}`)
          }}
        />
      )}
    </>
  )
}
