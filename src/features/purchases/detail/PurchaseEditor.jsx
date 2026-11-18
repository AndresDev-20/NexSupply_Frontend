import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, CalendarDays, CheckCircle2, FileText, Package, Receipt, Save, Trash2, Truck } from 'lucide-react'
import { useCreatePurchaseMutation, useDeletePurchaseMutation, useUpdatePurchaseMutation } from '../purchasesApi'
import { useGetProductQuery, useGetSuppliersQuery } from '../../inventory/inventoryApi'
import { TAX_RATE_OPTIONS } from '../../inventory/inventoryOptions'
import { COST_PATTERN, MONEY_PATTERN, QUANTITY_PATTERN, toApiNumber, toInputMoney } from '../../../utils/numberInput'
import { supplierName, todayIso } from '../purchaseOptions'
import { ProductSearch } from './ProductSearch'
import { ConfirmPurchaseModal } from './ConfirmPurchaseModal'
import { AttachmentBox } from './AttachmentBox'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { Switch } from '../../../components/ui/Switch/Switch'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { previewMultiply, previewSubtract, previewSum } from '../../../utils/moneyPreview'
import { purchasePath } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../purchases.css'

let lineKey = 0
const nextKey = () => {
  lineKey += 1
  return `line-${lineKey}`
}

const isPositive = (text) => QUANTITY_PATTERN.test(text) && !/^0+(\.0+)?$/.test(text)

/** Línea nueva desde un producto del buscador. El precio se propone con su precio de compra. */
function lineFromProduct(product) {
  return {
    key: nextKey(),
    productId: product.id,
    product: { id: product.id, code: product.code, name: product.name, tracksBatches: product.tracksBatches, unit: product.unit, presentations: product.presentations ?? [], purchasePrice: product.purchasePrice },
    presentationId: '',
    quantity: '',
    unitPrice: Number(product.purchasePrice) > 0 ? toInputMoney(product.purchasePrice) : '',
    priceTouched: false,
    discount: '',
    taxRate: product.taxRate ?? '',
    lotNumber: '',
    expirationDate: '',
    manufactureDate: '',
  }
}

function lineFromItem(item) {
  return {
    key: nextKey(),
    productId: item.product?.id,
    product: item.product ?? { id: null, name: item.productName, unit: { symbol: item.unitSymbol } },
    presentationId: item.presentation ? String(item.presentation.id) : '',
    quantity: toInputMoney(item.quantity),
    unitPrice: toInputMoney(item.unitPrice),
    priceTouched: true,
    discount: Number(item.discount) > 0 ? toInputMoney(item.discount) : '',
    taxRate: item.taxRate ?? '',
    lotNumber: item.lotNumber ?? '',
    expirationDate: item.expirationDate ?? '',
    manufactureDate: item.manufactureDate ?? '',
  }
}

function initialHeader(purchase) {
  return {
    supplierId: purchase ? String(purchase.supplier?.id ?? '') : '',
    supplierInvoiceNumber: purchase?.supplierInvoiceNumber ?? '',
    invoiceDate: purchase?.invoiceDate ?? todayIso(),
    notes: purchase?.notes ?? '',
    globalDiscount: purchase && Number(purchase.globalDiscount) > 0 ? toInputMoney(purchase.globalDiscount) : '',
    freight: purchase && Number(purchase.freight) > 0 ? toInputMoney(purchase.freight) : '',
    freightInInvoice: purchase?.freightInInvoice ?? true,
  }
}

/** Cuerpo que espera la API a partir del formulario. */
function bodyOf(header, lines) {
  return {
    supplierId: Number(header.supplierId),
    supplierInvoiceNumber: header.supplierInvoiceNumber.trim() || null,
    invoiceDate: header.invoiceDate,
    notes: header.notes.trim() || null,
    globalDiscount: toApiNumber(header.globalDiscount) || '0',
    freight: toApiNumber(header.freight) || '0',
    freightInInvoice: header.freightInInvoice,
    items: lines.map((line) => ({
      productId: line.productId,
      presentationId: line.presentationId ? Number(line.presentationId) : null,
      quantity: toApiNumber(line.quantity),
      unitPrice: toApiNumber(line.unitPrice),
      discount: toApiNumber(line.discount) || '0',
      ...(line.taxRate && { taxRate: line.taxRate }),
      lotNumber: line.lotNumber.trim() || null,
      expirationDate: line.expirationDate || null,
      manufactureDate: line.manufactureDate || null,
    })),
  }
}

/** Subtotal de vista previa de una línea: cantidad × precio − descuento (enteros, no oficial). */
function lineSubtotal(line) {
  const gross = previewMultiply(toApiNumber(line.unitPrice), toApiNumber(line.quantity))
  if (gross === null) return null
  const discount = toApiNumber(line.discount)
  return MONEY_PATTERN.test(discount) ? previewSubtract(gross, discount) : previewSubtract(gross, '0')
}

/** Una línea de la compra. Pide el producto completo para conocer sus presentaciones. */
function PurchaseLine({ line, index, errors, onChange, onRemove }) {
  const { data: product } = useGetProductQuery(line.productId, { skip: !line.productId })
  const unit = product?.unit ?? line.product.unit
  // Del buscador ya llegan las presentaciones; el producto completo las confirma al cargar
  const packs = (product?.presentations ?? line.product.presentations ?? []).filter((item) => item.isActive || String(item.id) === line.presentationId)
  const purchasePrice = product?.purchasePrice ?? line.product.purchasePrice
  const pack = packs.find((item) => String(item.id) === line.presentationId)
  const tracksBatches = product?.tracksBatches ?? line.product.tracksBatches
  const subtotal = lineSubtotal(line)
  const field = (name) => errors[`items[${index}].${name}`]
  const quantity = toApiNumber(line.quantity)
  const inBase = pack && isPositive(quantity) ? previewMultiply(pack.factor, quantity) : null

  const set = (name, value) => onChange({ ...line, [name]: value, ...(name === 'unitPrice' && { priceTouched: true }) })

  const changePresentation = (value) => {
    const next = { ...line, presentationId: value }
    // Si el precio lo propuso el sistema, se ajusta a la presentación (bulto = precio por kg × 40)
    if (!line.priceTouched && Number(purchasePrice) > 0) {
      const chosen = packs.find((item) => String(item.id) === value)
      next.unitPrice = toInputMoney(chosen ? previewMultiply(purchasePrice, chosen.factor) : purchasePrice)
    }
    onChange(next)
  }

  return (
    <li className="purchase-line" style={{ '--delay': `${Math.min(index, 10) * 40}ms` }}>
      <div className="purchase-line__head">
        <span className="purchase-line__number">{index + 1}</span>
        <span className="purchase-line__product">
          <span className="purchase-line__name">{line.product.name}</span>
          <span className="purchase-line__meta">
            {line.product.code} · se guarda en {unit?.symbol}
            {tracksBatches && <span className="purchase-line__tag">Con lotes</span>}
          </span>
        </span>
        <span className="purchase-line__subtotal">{subtotal === null ? '—' : formatCurrency(subtotal)}</span>
        <IconButton icon={Trash2} tone="danger" label={`Quitar ${line.product.name}`} onClick={onRemove} />
      </div>

      <div className="purchase-line__fields">
        <SelectField
          label="Viene en"
          options={[{ value: '', label: unit?.name ?? 'Unidad base' }, ...packs.map((item) => ({ value: String(item.id), label: item.name }))]}
          value={line.presentationId}
          onChange={(event) => changePresentation(event.target.value)}
          error={field('presentationId')}
        />
        <TextField
          label="Cantidad"
          inputMode="decimal"
          placeholder="Ej.: 20"
          value={line.quantity}
          onChange={(event) => set('quantity', event.target.value)}
          error={field('quantity')}
          hint={inBase ? `= ${formatQuantity(inBase)} ${unit?.symbol}` : undefined}
          required
        />
        <TextField
          label="Precio"
          inputMode="decimal"
          placeholder="Sin IVA"
          value={line.unitPrice}
          onChange={(event) => set('unitPrice', event.target.value)}
          error={field('unitPrice')}
          hint={`Por ${pack ? pack.name.toLowerCase() : (unit?.symbol ?? 'unidad')}, sin IVA`}
          required
        />
        <TextField label="Descuento ($)" inputMode="decimal" placeholder="0" value={line.discount} onChange={(event) => set('discount', event.target.value)} error={field('discount')} />
        <SelectField label="IVA" options={TAX_RATE_OPTIONS} value={line.taxRate} onChange={(event) => set('taxRate', event.target.value)} error={field('taxRate')} />
      </div>

      {tracksBatches && (
        <div className="purchase-line__lot">
          <TextField label="Lote" placeholder="Ej.: L-2045" maxLength={40} value={line.lotNumber} onChange={(event) => set('lotNumber', event.target.value)} error={field('lotNumber')} required />
          <TextField label="Vence" type="date" value={line.expirationDate} onChange={(event) => set('expirationDate', event.target.value)} error={field('expirationDate')} required />
          <TextField label="Fabricado" type="date" value={line.manufactureDate} onChange={(event) => set('manufactureDate', event.target.value)} error={field('manufactureDate')} hint="Opcional" />
        </div>
      )}
    </li>
  )
}

/**
 * Editor de una compra en borrador (D-COMP-1, D-COMP-3, D-COMP-6). Se guarda cuantas veces
 * se quiera; el sistema calcula el IVA, el reparto del flete y el costo por unidad al guardar.
 * Confirmar la hace entrar al inventario.
 */
export function PurchaseEditor({ purchase, onConfirmed, autoConfirm = false }) {
  const toast = useToast()
  const navigate = useNavigate()
  const canConfirm = useCan('purchases.confirm')
  const canSeeSuppliers = useCan('suppliers.view')
  const isNew = !purchase
  const [header, setHeader] = useState(() => initialHeader(purchase))
  const [lines, setLines] = useState(() => (purchase?.items ?? []).map(lineFromItem))
  // Lo último guardado: si el formulario cambia, los cálculos del sistema quedan desactualizados
  const [savedBody, setSavedBody] = useState(() => (purchase ? JSON.stringify(bodyOf(initialHeader(purchase), (purchase.items ?? []).map(lineFromItem))) : null))
  // "Guardar y confirmar" de una compra nueva: al llegar ya guardada se abre la confirmación
  const [confirming, setConfirming] = useState(autoConfirm && purchase ? purchase : null)
  const [localErrors, setLocalErrors] = useState({})
  const [askDelete, setAskDelete] = useState(false)
  const { data: suppliers } = useGetSuppliersQuery({ pageSize: 100, isActive: 'true' }, { skip: !canSeeSuppliers })
  const [createPurchase, createState] = useCreatePurchaseMutation()
  const [updatePurchase, updateState] = useUpdatePurchaseMutation()
  const [deletePurchase, deleteState] = useDeletePurchaseMutation()
  const saveError = isNew ? createState.error : updateState.error
  const { fieldErrors: serverErrors, formError } = splitApiError(saveError)
  const errors = { ...serverErrors, ...localErrors }
  const isSaving = createState.isLoading || updateState.isLoading

  const supplierOptions = (suppliers?.rows ?? []).map((supplier) => ({ value: String(supplier.id), label: supplierName(supplier) }))
  if (purchase?.supplier && !supplierOptions.some((option) => option.value === String(purchase.supplier.id))) {
    supplierOptions.unshift({ value: String(purchase.supplier.id), label: supplierName(purchase.supplier) })
  }

  const setField = (name, value) => {
    setHeader((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }


  const validate = ({ forConfirm = false } = {}) => {
    const found = {}
    if (!header.supplierId) found.supplierId = 'Selecciona el proveedor'
    if (!header.invoiceDate) found.invoiceDate = 'Escribe la fecha de la factura'
    for (const name of ['globalDiscount', 'freight']) if (header[name] && !MONEY_PATTERN.test(toApiNumber(header[name]))) found[name] = 'Escribe un valor en pesos (ej. 40.000)'
    lines.forEach((line, index) => {
      const key = (name) => `items[${index}].${name}`
      if (!isPositive(toApiNumber(line.quantity))) found[key('quantity')] = 'Escribe la cantidad'
      if (!COST_PATTERN.test(toApiNumber(line.unitPrice))) found[key('unitPrice')] = 'Escribe el precio'
      if (line.discount && !MONEY_PATTERN.test(toApiNumber(line.discount))) found[key('discount')] = 'Valor en pesos'
      if (forConfirm && line.product.tracksBatches) {
        if (!line.lotNumber.trim()) found[key('lotNumber')] = 'Escribe el lote'
        if (!line.expirationDate) found[key('expirationDate')] = 'Escribe el vencimiento'
      }
    })
    if (forConfirm && lines.length === 0) found.items = 'Agrega al menos un producto'
    setLocalErrors(found)
    return Object.keys(found).length === 0
  }

  /** Guarda el borrador. Devuelve la compra guardada (con los cálculos del sistema) o null. */
  const save = async ({ quiet = false, confirmAfter = false } = {}) => {
    const body = bodyOf(header, lines)
    try {
      if (isNew) {
        const created = await createPurchase(body).unwrap()
        toast.success('Compra guardada como borrador')
        navigate(purchasePath(created.id), { replace: true, state: confirmAfter ? { confirm: true } : null })
        return created
      }
      const updated = await updatePurchase({ id: purchase.id, ...body }).unwrap()
      setSavedBody(JSON.stringify(body))
      if (!quiet) toast.success('Borrador guardado')
      return updated
    } catch {
      return null
    }
  }

  const handleSave = async () => {
    if (validate()) await save()
  }

  const handleConfirm = async () => {
    if (!validate({ forConfirm: true })) {
      toast.error('Revisa los datos marcados antes de confirmar')
      return
    }
    // Siempre se guarda primero: la confirmación usa lo que está en el servidor
    const saved = await save({ quiet: true, confirmAfter: true })
    if (saved && !isNew) setConfirming(saved)
  }

  const handleDelete = async () => {
    try {
      await deletePurchase(purchase.id).unwrap()
      toast.success('Borrador eliminado')
      navigate('/compras')
    } catch (deleteError) {
      toast.error(deleteError.message)
      setAskDelete(false)
    }
  }

  const liveSubtotal = previewSum(lines.map(lineSubtotal).filter(Boolean))
  const dirty = !isNew && savedBody !== JSON.stringify(bodyOf(header, lines))
  const preview = !isNew && purchase.isPreview && purchase.items.length > 0 ? purchase : null

  return (
    <div className="purchase-editor">
      <PageHeader
        description={isNew ? 'Escribe la factura del proveedor. Puedes guardarla como borrador y confirmarla cuando llegue la mercancía.' : 'Borrador: no ha entrado al inventario. Confírmalo cuando la mercancía esté en la bodega.'}
        actions={
          <>
            {!isNew && (
              <Button variant="ghost" icon={Trash2} onClick={() => setAskDelete(true)}>
                Eliminar borrador
              </Button>
            )}
            <Button variant="secondary" icon={Save} onClick={handleSave} isLoading={isSaving && !confirming}>
              Guardar borrador
            </Button>
            {canConfirm && (
              <Button icon={CheckCircle2} onClick={handleConfirm} disabled={isNew && lines.length === 0}>
                {isNew ? 'Guardar y confirmar' : 'Confirmar compra'}
              </Button>
            )}
          </>
        }
      />

      {formError && <Alert tone="danger">{formError}</Alert>}

      <div className="purchase-editor__layout">
        <div className="purchase-editor__main">
          <FormSection icon={Truck} title="Factura del proveedor">
            <SelectField label="Proveedor" placeholder="Selecciona…" options={supplierOptions} value={header.supplierId} onChange={(event) => setField('supplierId', event.target.value)} error={errors.supplierId} required />
            <TextField label="Número de factura" icon={Receipt} placeholder="Ej.: FV-1001" maxLength={40} value={header.supplierInvoiceNumber} onChange={(event) => setField('supplierInvoiceNumber', event.target.value)} error={errors.supplierInvoiceNumber} />
            <TextField label="Fecha de la factura" icon={CalendarDays} type="date" value={header.invoiceDate} onChange={(event) => setField('invoiceDate', event.target.value)} error={errors.invoiceDate} required />
            <TextAreaField label="Notas" rows={1} maxLength={500} value={header.notes} onChange={(event) => setField('notes', event.target.value)} hint="Opcional." />
          </FormSection>

          <FormSection icon={Boxes} title="Productos" description="Como vienen en la factura: en la unidad base o en bultos. El precio es sin IVA." columns={1}>
            <ProductSearch onPick={(product) => setLines((current) => [...current, lineFromProduct(product)])} />
            {errors.items && <Alert tone="danger">{errors.items}</Alert>}
            {lines.length === 0 ? (
              <div className="purchase-empty">
                <Package aria-hidden="true" />
                <p>Aún no hay productos. Búscalos arriba o escanea el código de barras.</p>
              </div>
            ) : (
              <ol className="purchase-lines">
                {lines.map((line, index) => (
                  <PurchaseLine
                    key={line.key}
                    line={line}
                    index={index}
                    errors={errors}
                    onChange={(next) => {
                      setLines((current) => current.map((item) => (item.key === line.key ? next : item)))
                      setLocalErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`items[${index}]`))))
                    }}
                    onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  />
                ))}
              </ol>
            )}
          </FormSection>
        </div>

        <aside className="purchase-editor__side" aria-label="Totales">
          <section className="purchase-totals">
            <h3 className="purchase-totals__title">
              <FileText aria-hidden="true" /> Resumen
            </h3>
            <dl className="closing-summary">
              <div>
                <dt>Productos</dt>
                <dd>{lines.length}</dd>
              </div>
              <div>
                <dt>Subtotal (sin IVA)</dt>
                <dd>{formatCurrency(liveSubtotal)}</dd>
              </div>
            </dl>
            <div className="purchase-totals__fields">
              <TextField label="Descuento general ($)" inputMode="decimal" placeholder="0" value={header.globalDiscount} onChange={(event) => setField('globalDiscount', event.target.value)} error={errors.globalDiscount} hint="Se reparte entre los productos según su valor." />
              <TextField label="Flete y otros costos ($)" inputMode="decimal" placeholder="0" value={header.freight} onChange={(event) => setField('freight', event.target.value)} error={errors.freight} hint="Sube el costo de los productos, repartido según su valor." />
              <Switch label="El flete viene en la factura del proveedor" description={header.freightInInvoice ? 'Se le debe al proveedor junto con la compra.' : 'Se pagó aparte (ej. a un transportador): solo sube el costo.'} checked={header.freightInInvoice} onChange={(value) => setField('freightInInvoice', value)} />
            </div>

            {preview ? (
              <div className={`purchase-preview${dirty ? ' purchase-preview--stale' : ''}`}>
                <p className="purchase-preview__title">Calculado por el sistema{dirty ? ' · guarda para actualizar' : ''}</p>
                <dl className="closing-summary">
                  <div>
                    <dt>Descuentos</dt>
                    <dd>{formatCurrency(preview.discountTotal)}</dd>
                  </div>
                  <div>
                    <dt>IVA</dt>
                    <dd>{formatCurrency(preview.taxTotal)}</dd>
                  </div>
                  <div>
                    <dt>Flete</dt>
                    <dd>{formatCurrency(preview.freight)}</dd>
                  </div>
                  <div className="closing-summary__row--strong">
                    <dt>Total</dt>
                    <dd>{formatCurrency(preview.total)}</dd>
                  </div>
                  {preview.payableTotal !== preview.total && (
                    <div>
                      <dt>Se le debe al proveedor</dt>
                      <dd>{formatCurrency(preview.payableTotal)}</dd>
                    </div>
                  )}
                </dl>
                <ul className="purchase-preview__costs" aria-label="Costo por unidad">
                  {preview.items.map((item) => (
                    <li key={item.id}>
                      <span>{item.productName}</span>
                      <strong>
                        {formatCurrency(item.unitCost)} / {item.unitSymbol}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="purchase-preview__hint">Guarda el borrador y el sistema calcula el IVA, el reparto del flete y el costo real por unidad.</p>
            )}
          </section>

          {!isNew && <AttachmentBox purchase={purchase} />}
        </aside>
      </div>

      {confirming && (
        <ConfirmPurchaseModal
          purchase={confirming}
          onClose={() => setConfirming(null)}
          onConfirmed={(result) => {
            setConfirming(null)
            onConfirmed(result)
          }}
        />
      )}
      <ConfirmDialog
        isOpen={askDelete}
        tone="danger"
        title="Eliminar borrador"
        message="El borrador no ha afectado el inventario. Se elimina con sus productos y su factura adjunta."
        confirmLabel="Eliminar"
        isLoading={deleteState.isLoading}
        onConfirm={handleDelete}
        onCancel={() => setAskDelete(false)}
      />
    </div>
  )
}
