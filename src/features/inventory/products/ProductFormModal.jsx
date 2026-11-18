import { useState } from 'react'
import { BadgeCheck, Barcode, Boxes, CircleDollarSign, Clock, FileText, FlaskConical, Stethoscope, FolderTree, Hash, Package, PackagePlus, Ruler, ShoppingCart, Star, Tag, Trash2, TrendingDown, TrendingUp, Truck, Warehouse } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { Switch } from '../../../components/ui/Switch/Switch'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Stepper } from '../../../components/ui/Stepper/Stepper'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useCan } from '../../../hooks/usePermissions'
import { splitApiError } from '../../../utils/formErrors'
import { useGetUnitsQuery } from '../../settings/settingsApi'
import { useCreateProductMutation, useGetCategoriesQuery, useGetSuppliersQuery, useUpdateProductMutation } from '../inventoryApi'
import { COST_PATTERN, EXPIRED_POLICY_OPTIONS, MONEY_PATTERN, QUANTITY_PATTERN, TAX_RATE_OPTIONS, expiredPolicyLabel, toApiNumber, toInputNumber } from '../inventoryOptions'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { previewProfit, scalePrice } from './profitPreview'
import { findCategory } from '../categories/categoryOptions'
import { CategoryPicker } from '../categories/CategoryPicker'
import { useBelowCostConfirmation } from './useBelowCostConfirmation'
import { ProductPreview } from './ProductPreview'
import '../../settings/settings.css'
import './ProductFormModal.css'

const STEP_GENERAL = { id: 'general', label: 'General', fields: ['name', 'code', 'categoryId', 'unitId', 'description'] }
const STEP_PRICES = { id: 'sale', label: 'Precios', fields: ['purchasePrice', 'salePrice', 'taxRate', 'minStock', 'barcode', 'tracksBatches', 'expiredSalePolicy'] }
// Solo al crear: el bulto (presentación) y la cantidad que hay hoy (D-INV-14).
// Después, las presentaciones se manejan en la ficha y la existencia cambia con ajustes.
const STEP_STOCK = { id: 'stock', label: 'Bulto y cantidad', fields: ['packName', 'packFactor', 'packSalePrice', 'initialQuantity'] }
const STEP_SUPPLIERS = { id: 'suppliers', label: 'Proveedores', fields: ['suppliers'] }
// Solo en categorías veterinarias (D-INV-17). Todos los campos son opcionales.
const VET_FIELDS = ['activeIngredient', 'concentration', 'icaRegistration', 'manufacturer', 'species', 'administrationRoute', 'withdrawalMeatDays', 'withdrawalMilkDays', 'requiresPrescription']
const STEP_VET = { id: 'vet', label: 'Ficha veterinaria', fields: VET_FIELDS }
const DAYS_PATTERN = /^\d{1,4}(\.\d)?$/

// Errores del servidor en el bulto, la cantidad y la ficha → campos del formulario
const SERVER_FIELDS = {
  ...Object.fromEntries(VET_FIELDS.map((field) => [`veterinaryInfo.${field}`, field])),
  'presentations[0].name': 'packName',
  'presentations[0].factor': 'packFactor',
  'presentations[0].salePrice': 'packSalePrice',
  'initialStock.quantity': 'initialQuantity',
  'initialStock.presentationIndex': 'initialQuantity',
}

const AUTO_CODE = /^P-\d+$/i
const isPositive = (text) => QUANTITY_PATTERN.test(text) && !/^0+(\.0+)?$/.test(text)

function initialForm(product) {
  const vet = product?.veterinaryInfo
  return {
    name: product?.name ?? '',
    code: product?.code ?? '',
    categoryId: product?.category ? String(product.category.id) : '',
    unitId: product?.unit ? String(product.unit.id) : '',
    description: product?.description ?? '',
    purchasePrice: toInputNumber(product?.purchasePrice),
    salePrice: toInputNumber(product?.salePrice),
    taxRate: product?.taxRate ?? '',
    minStock: toInputNumber(product?.minStock) || '0',
    barcode: product?.barcode ?? '',
    tracksBatches: product?.tracksBatches ?? false,
    expiredSalePolicy: product?.expiredSalePolicy ?? '',
    suppliers: (product?.suppliers ?? []).map((supplier) => ({ supplierId: supplier.id, name: supplier.tradeName || supplier.legalName, isPrimary: supplier.isPrimary })),
    // Ficha veterinaria
    activeIngredient: vet?.activeIngredient ?? '',
    concentration: vet?.concentration ?? '',
    icaRegistration: vet?.icaRegistration ?? '',
    manufacturer: vet?.manufacturer ?? '',
    species: vet?.species ?? '',
    administrationRoute: vet?.administrationRoute ?? '',
    withdrawalMeatDays: toInputNumber(vet?.withdrawalMeatDays),
    withdrawalMilkDays: toInputNumber(vet?.withdrawalMilkDays),
    requiresPrescription: vet?.requiresPrescription ?? false,
    // Solo al crear
    sellsByPack: false,
    packName: '',
    packFactor: '',
    packSalePrice: '',
    initialQuantity: '',
    initialIn: 'base', // 'base' | 'pack'
  }
}

/** Nombre del bulto: el que se escribió o "Bulto 40 kg". */
function packNameOf(form, unit) {
  const factor = toApiNumber(form.packFactor)
  return form.packName.trim() || `Bulto${factor ? ` ${formatQuantity(factor)}` : ''}${unit ? ` ${unit.symbol}` : ''}`
}

function validateStep(stepId, form, { isEdit, originalCode, unit, canViewCost }) {
  const errors = {}
  if (stepId === 'general') {
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre del producto'
    const code = form.code.trim().toUpperCase()
    if (code && !/^[A-Za-z0-9._-]{1,30}$/.test(code)) errors.code = 'Hasta 30 letras, números, punto o guion'
    else if (code && AUTO_CODE.test(code) && code !== originalCode) errors.code = 'Los códigos P-<número> los asigna el sistema: déjalo vacío'
    if (isEdit && !code) errors.code = 'El código no puede quedar vacío'
    if (!form.categoryId) errors.categoryId = 'Selecciona una categoría'
    if (!form.unitId) errors.unitId = 'Selecciona la unidad base'
  }
  if (stepId === 'sale') {
    // El precio de compra lo escribe quien ve costos (D-INV-13)
    if (canViewCost && !COST_PATTERN.test(toApiNumber(form.purchasePrice))) errors.purchasePrice = 'Escribe el precio de compra (ej. 10.000)'
    if (!MONEY_PATTERN.test(toApiNumber(form.salePrice))) errors.salePrice = 'Escribe el precio (ej. 12500 o 12.500)'
    const minStock = toApiNumber(form.minStock || '0')
    if (!QUANTITY_PATTERN.test(minStock)) errors.minStock = 'Escribe una cantidad (ej. 10 o 2,5)'
    else if (unit && !unit.allowsDecimals && !/^\d+$/.test(minStock)) errors.minStock = `La unidad ${unit.symbol} solo admite cantidades enteras`
    if (form.barcode.trim() && !/^[A-Za-z0-9-]{3,50}$/.test(form.barcode.trim())) errors.barcode = 'De 3 a 50 letras, números o guiones'
  }
  if (stepId === 'vet') {
    for (const field of ['withdrawalMeatDays', 'withdrawalMilkDays']) {
      const days = toApiNumber(form[field])
      if (days && !DAYS_PATTERN.test(days)) errors[field] = 'Escribe los días (ej. 28 o 3,5) o déjalo vacío'
    }
  }
  if (stepId === 'stock') {
    if (form.sellsByPack) {
      const factor = toApiNumber(form.packFactor)
      if (!isPositive(factor)) errors.packFactor = `Escribe cuántos ${unit?.symbol ?? 'unidades'} trae el bulto (ej. 40)`
      else if (unit && !unit.allowsDecimals && !/^\d+$/.test(factor)) errors.packFactor = `La unidad ${unit.symbol} solo admite cantidades enteras`
      if (!MONEY_PATTERN.test(toApiNumber(form.packSalePrice))) errors.packSalePrice = 'Escribe el precio de venta del bulto (ej. 100.000)'
      if (form.packName.trim() && form.packName.trim().length < 2) errors.packName = 'Mínimo 2 caracteres'
    }
    const quantity = toApiNumber(form.initialQuantity)
    if (quantity) {
      if (!isPositive(quantity)) errors.initialQuantity = 'Escribe una cantidad mayor que cero, o déjalo vacío'
      else if (form.initialIn === 'base' && unit && !unit.allowsDecimals && !/^\d+$/.test(quantity)) errors.initialQuantity = `La unidad ${unit.symbol} solo admite cantidades enteras`
      if (canViewCost && !COST_PATTERN.test(toApiNumber(form.purchasePrice))) errors.initialQuantity = 'Para registrar la cantidad hace falta el precio de compra'
    }
  }
  return errors
}

/** Ganancia calculada (no se escribe): venta − compra, y su porcentaje sobre la compra. */
function ProfitSummary({ profit, per }) {
  if (!profit) return null
  const loss = profit.profit.startsWith('-')
  return (
    <div className={`profit-summary form-section__full${loss ? ' profit-summary--loss' : ''}`} role="status">
      {loss ? <TrendingDown aria-hidden="true" /> : <TrendingUp aria-hidden="true" />}
      <span className="profit-summary__text">
        <span className="profit-summary__label">
          {loss ? 'Pérdida' : 'Ganancia'} por {per}
        </span>
        <span className="profit-summary__value">
          {formatCurrency(profit.profit.replace('-', ''))}
          {profit.percent !== null && <span className="profit-summary__percent"> · {profit.percent.replace('.', ',')} %</span>}
        </span>
      </span>
      <span className="profit-summary__hint">Se calcula con el precio de compra y el de venta</span>
    </div>
  )
}

/**
 * Crear o editar un producto por pasos con su ficha en vivo:
 * General → Precios → Bulto y cantidad (solo al crear) → Proveedores.
 * El precio de venta solo se cambia con inventory.prices (D-INV-10); el precio de compra
 * y la ganancia, solo con inventory.cost_view (D-INV-13). La ganancia no se escribe:
 * se calcula. La cantidad inicial necesita inventory.initial_stock (D-INV-14).
 */
export function ProductFormModal({ product, onClose, onSaved }) {
  const isEdit = Boolean(product)
  const canChangePrice = useCan('inventory.prices')
  const canViewSuppliers = useCan('suppliers.view')
  const canViewCost = useCan('inventory.cost_view')
  const canLoadStock = useCan('inventory.initial_stock')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => initialForm(product))
  const [localErrors, setLocalErrors] = useState({})
  const [supplierToAdd, setSupplierToAdd] = useState('')
  const { data: tree = [] } = useGetCategoriesQuery()
  const { data: units = [] } = useGetUnitsQuery()
  const { data: supplierData } = useGetSuppliersQuery({ isActive: 'true', pageSize: 100 }, { skip: !canViewSuppliers })
  const [createProduct, createState] = useCreateProductMutation()
  const [updateProduct, updateState] = useUpdateProductMutation()
  const belowCost = useBelowCostConfirmation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: rawServerErrors, formError } = splitApiError(error?.code === 'CONFIRMATION_REQUIRED' ? null : error)
  const serverErrors = Object.fromEntries(Object.entries(rawServerErrors).map(([field, message]) => [SERVER_FIELDS[field] ?? field, message]))
  const fieldErrors = { ...serverErrors, ...localErrors }

  const category = findCategory(tree, form.categoryId)
  const parentCategory = category && tree.find((item) => item.children.some((child) => child.id === category.id))
  // La ficha veterinaria aparece en categorías veterinarias (la subcategoría hereda de su categoría)
  const isVeterinary = Boolean(category?.isVeterinary || parentCategory?.isVeterinary)
  const steps = [STEP_GENERAL, ...(isVeterinary ? [STEP_VET] : []), STEP_PRICES, ...(isEdit ? [] : [STEP_STOCK]), STEP_SUPPLIERS]
  const stepId = steps[Math.min(step, steps.length - 1)].id
  const isLastStep = step >= steps.length - 1
  const unit = units.find((item) => String(item.id) === form.unitId)
  const priceLocked = isEdit && !canChangePrice
  const availableSuppliers = (supplierData?.rows ?? []).filter((supplier) => !form.suppliers.some((link) => link.supplierId === supplier.id))

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const bind = (name) => ({ name, value: form[name], error: fieldErrors[name], onChange: (event) => setField(name, event.target.value) })

  // Vistas previas (solo para mostrar; el backend calcula los valores oficiales)
  const purchase = toApiNumber(form.purchasePrice)
  const profit = canViewCost ? previewProfit(purchase, toApiNumber(form.salePrice)) : null
  const packFactor = toApiNumber(form.packFactor)
  const packReady = form.sellsByPack && isPositive(packFactor)
  const packPurchase = canViewCost && packReady && COST_PATTERN.test(purchase) ? scalePrice(purchase, packFactor) : null
  const packProfit = packPurchase ? previewProfit(packPurchase, toApiNumber(form.packSalePrice)) : null
  const quantity = toApiNumber(form.initialQuantity)
  const quantityInBase = isPositive(quantity) ? (form.initialIn === 'pack' && packReady ? scalePrice(quantity, packFactor) : quantity) : null

  const addSupplier = () => {
    const supplier = supplierData?.rows.find((item) => String(item.id) === supplierToAdd)
    if (!supplier) return
    setField('suppliers', [...form.suppliers, { supplierId: supplier.id, name: supplier.tradeName || supplier.legalName, isPrimary: form.suppliers.length === 0 }])
    setSupplierToAdd('')
  }
  const removeSupplier = (supplierId) => {
    const rest = form.suppliers.filter((link) => link.supplierId !== supplierId)
    // Si se quitó el principal, el primero que queda pasa a serlo
    if (rest.length > 0 && !rest.some((link) => link.isPrimary)) rest[0] = { ...rest[0], isPrimary: true }
    setField('suppliers', rest)
  }
  const makePrimary = (supplierId) => setField('suppliers', form.suppliers.map((link) => ({ ...link, isPrimary: link.supplierId === supplierId })))

  const buildBody = () => {
    const body = {
      name: form.name.trim(),
      ...((form.code.trim() || isEdit) && { code: form.code.trim().toUpperCase() }),
      categoryId: Number(form.categoryId),
      unitId: Number(form.unitId),
      description: form.description.trim() || null,
      ...(form.taxRate && { taxRate: form.taxRate }),
      minStock: toApiNumber(form.minStock || '0'),
      barcode: form.barcode.trim() || null,
      tracksBatches: form.tracksBatches,
      expiredSalePolicy: form.expiredSalePolicy || null,
      suppliers: form.suppliers.map(({ supplierId, isPrimary }) => ({ supplierId, isPrimary })),
    }
    // Fuera de una categoría veterinaria no se envía: la ficha que ya tenga se conserva
    if (isVeterinary) {
      body.veterinaryInfo = {
        ...Object.fromEntries(['activeIngredient', 'concentration', 'icaRegistration', 'manufacturer', 'species', 'administrationRoute'].map((field) => [field, form[field].trim() || null])),
        withdrawalMeatDays: toApiNumber(form.withdrawalMeatDays) || null,
        withdrawalMilkDays: toApiNumber(form.withdrawalMilkDays) || null,
        requiresPrescription: form.requiresPrescription,
      }
    }
    const price = toApiNumber(form.salePrice)
    if (canViewCost && (!isEdit || Number(purchase) !== Number(product.purchasePrice))) body.purchasePrice = purchase
    // Al editar, el precio solo se envía si cambió (y si hay permiso)
    if (!isEdit || (canChangePrice && Number(price) !== Number(product.salePrice))) body.salePrice = price
    if (!isEdit) {
      if (form.sellsByPack) body.presentations = [{ name: packNameOf(form, unit), factor: packFactor, salePrice: toApiNumber(form.packSalePrice) }]
      if (canLoadStock && quantity) body.initialStock = { quantity, ...(form.initialIn === 'pack' && form.sellsByPack && { presentationIndex: 0 }) }
    }
    return body
  }

  const save = (confirm) => {
    const body = { ...buildBody(), ...(confirm && { confirmBelowCost: true }) }
    return isEdit ? updateProduct({ id: product.id, ...body }).unwrap() : createProduct(body).unwrap()
  }

  const goToStepWithError = (saveError) => {
    const field = saveError?.details?.[0]?.field
    const stepWithError = steps.findIndex((item) => item.fields.includes(SERVER_FIELDS[field] ?? field))
    if (stepWithError >= 0) setStep(stepWithError)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = validateStep(stepId, form, { isEdit, originalCode: product?.code, unit, canViewCost })
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!isLastStep) {
      setStep(step + 1)
      return
    }
    try {
      const saved = await belowCost.run(save)
      if (saved) onSaved(saved, isEdit)
    } catch (saveError) {
      goToStepWithError(saveError)
    }
  }

  const handleConfirmBelowCost = async () => {
    try {
      onSaved(await belowCost.confirm(), isEdit)
    } catch (saveError) {
      goToStepWithError(saveError)
    }
  }

  const inheritedPolicy = category ? expiredPolicyLabel(category.expiredSalePolicy) : null
  const symbol = unit?.symbol ?? 'unidad'
  const pack = form.sellsByPack && packReady ? { name: packNameOf(form, unit), salePrice: toApiNumber(form.packSalePrice) } : null

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={isEdit ? Package : PackagePlus}
      title={isEdit ? 'Editar producto' : 'Nuevo producto'}
      description="Los campos con * son obligatorios."
      footer={
        <>
          {step === 0 ? (
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={isLoading}>
              Atrás
            </Button>
          )}
          <Button type="submit" form="product-form" isLoading={isLoading && !belowCost.isOpen}>
            {isLastStep ? (isEdit ? 'Guardar cambios' : 'Crear producto') : 'Siguiente'}
          </Button>
        </>
      }
    >
      <FormWithPreview
        previewLabel="Ficha del producto"
        preview={
          <ProductPreview
            form={form}
            category={category}
            parentName={parentCategory?.name}
            unit={unit}
            profit={profit}
            pack={pack}
            stock={isEdit ? null : quantityInBase}
          />
        }
      >
        <Stepper steps={steps} current={step} onStepClick={(index) => index < step && setStep(index)} />
        <form id="product-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          {stepId === 'general' && (
            <FormSection icon={Package} title="Datos del producto" description="Cómo se busca y se reconoce.">
              <TextField className="form-section__full" label="Nombre" icon={Package} placeholder="Ej.: Concentrado cerdos levante" maxLength={150} data-autofocus {...bind('name')} required />
              <TextField
                label="Código interno"
                icon={Hash}
                placeholder={isEdit ? '' : 'Automático'}
                hint={isEdit ? undefined : 'Déjalo vacío y el sistema asigna P-00001, P-00002…'}
                maxLength={30}
                {...bind('code')}
                onChange={(event) => setField('code', event.target.value.toUpperCase())}
                required={isEdit}
              />
              <SelectField
                label="Unidad base"
                placeholder="Selecciona…"
                options={units.map((item) => ({ value: String(item.id), label: `${item.name} (${item.symbol})` }))}
                hint={isEdit ? 'No se puede cambiar si el producto ya tiene movimientos.' : 'La unidad más pequeña en que se vende (kg, und…). El bulto se agrega en el paso "Bulto y cantidad".'}
                {...bind('unitId')}
                required
              />
              <div className="form-section__full">
                <CategoryPicker
                  label="Categoría"
                  tree={tree}
                  value={form.categoryId}
                  error={fieldErrors.categoryId}
                  onChange={(categoryId) => {
                    setField('categoryId', categoryId)
                    // Al crear, la tarifa sigue a la categoría hasta que el usuario la cambie
                    if (!isEdit) setField('taxRate', '')
                  }}
                  required
                />
              </div>
              <TextAreaField className="form-section__full" label="Descripción" rows={2} maxLength={500} hint="Opcional." {...bind('description')} />
            </FormSection>
          )}

          {stepId === 'vet' && (
            <>
              <FormSection icon={Stethoscope} title="Ficha veterinaria" description="Información del producto para el mostrador. Todo es opcional. El sistema no diagnostica ni formula.">
                <TextField className="form-section__full" label="Principio activo" icon={FlaskConical} placeholder="Ej.: Ivermectina" maxLength={150} data-autofocus hint="También sirve para buscar el producto." {...bind('activeIngredient')} />
                <TextField label="Concentración" placeholder="Ej.: 1 %" maxLength={60} {...bind('concentration')} />
                <TextField label="Registro ICA" icon={BadgeCheck} placeholder="Ej.: 1234-DB" maxLength={40} {...bind('icaRegistration')} />
                <TextField label="Laboratorio fabricante" maxLength={120} {...bind('manufacturer')} />
                <TextField label="Vía de aplicación" placeholder="Ej.: Subcutánea, oral" maxLength={60} {...bind('administrationRoute')} />
                <TextField className="form-section__full" label="Especies" placeholder="Ej.: Bovinos, porcinos, equinos" maxLength={150} {...bind('species')} />
              </FormSection>
              <FormSection icon={Clock} title="Retiro y venta">
                <TextField label="Retiro en carne (días)" inputMode="decimal" placeholder="Ej.: 28" hint="Días antes del sacrificio." {...bind('withdrawalMeatDays')} />
                <TextField label="Retiro en leche (días)" inputMode="decimal" placeholder="Ej.: 3,5" hint="Días sin vender la leche." {...bind('withdrawalMilkDays')} />
                <div className="form-section__full">
                  <Switch
                    label="Requiere fórmula veterinaria"
                    description="El punto de venta lo recordará al venderlo."
                    checked={form.requiresPrescription}
                    onChange={(checked) => setField('requiresPrescription', checked)}
                  />
                </div>
              </FormSection>
            </>
          )}

          {stepId === 'sale' && (
            <>
              <FormSection icon={CircleDollarSign} title={canViewCost ? 'Precios y ganancia' : 'Precio e impuestos'} description={unit ? `Precios de 1 ${unit.symbol}.` : 'Precios de la unidad base.'}>
                {canViewCost && (
                  <TextField
                    label={`Precio de compra${unit ? ` (1 ${unit.symbol})` : ''}`}
                    icon={ShoppingCart}
                    inputMode="decimal"
                    placeholder="Ej.: 10.000"
                    data-autofocus
                    hint="Lo que se le paga al proveedor."
                    {...bind('purchasePrice')}
                    required
                  />
                )}
                <TextField
                  label={`Precio de venta${unit ? ` (1 ${unit.symbol})` : ''}`}
                  icon={Tag}
                  inputMode="decimal"
                  placeholder="Ej.: 13.000"
                  data-autofocus={!canViewCost || undefined}
                  disabled={priceLocked}
                  hint={priceLocked ? 'Cambiar precios requiere el permiso "Cambiar precios de venta".' : undefined}
                  {...bind('salePrice')}
                  required
                />
                <ProfitSummary profit={profit} per={symbol} />
                <SelectField
                  label="Tarifa de IVA"
                  placeholder={category ? `La de la categoría (${TAX_RATE_OPTIONS.find((option) => option.value === category.defaultTaxRate)?.label})` : 'La de la categoría'}
                  options={TAX_RATE_OPTIONS}
                  {...bind('taxRate')}
                />
              </FormSection>
              <FormSection icon={Ruler} title="Inventario">
                <TextField label={`Existencia mínima${unit ? ` (${unit.symbol})` : ''}`} inputMode="decimal" hint="Bajo este número aparece la alerta de existencias bajas. 0 = sin alerta." {...bind('minStock')} />
                <TextField label="Código de barras" icon={Barcode} placeholder="Escanéalo o escríbelo" hint="Opcional. Único." maxLength={50} {...bind('barcode')} />
                <SelectField
                  label="Venta de vencidos"
                  placeholder={inheritedPolicy ? `La de la categoría (${inheritedPolicy})` : 'La de la categoría'}
                  options={EXPIRED_POLICY_OPTIONS}
                  {...bind('expiredSalePolicy')}
                />
                <Switch
                  label="Maneja lotes y vencimientos"
                  description="Se registran lote y fecha de vencimiento en cada compra (Fase 7)."
                  checked={form.tracksBatches}
                  onChange={(checked) => setField('tracksBatches', checked)}
                />
              </FormSection>
            </>
          )}

          {stepId === 'stock' && (
            <>
              <FormSection icon={Boxes} title="Venta por bulto" description={`Si también se vende el bulto completo, con su propio precio. La existencia se guarda en ${symbol}.`}>
                <div className="form-section__full">
                  <Switch
                    label="¿Se vende también por bulto?"
                    description={`Ej.: bulto de 40 ${symbol}. Se puede vender el bulto entero o suelto por ${symbol}.`}
                    checked={form.sellsByPack}
                    onChange={(checked) => {
                      setField('sellsByPack', checked)
                      if (!checked) setField('initialIn', 'base')
                    }}
                  />
                </div>
                {form.sellsByPack && (
                  <>
                    <TextField
                      label={unit ? `${unit.symbol} por bulto` : "Contenido del bulto"}
                      icon={Package}
                      inputMode="decimal"
                      placeholder="Ej.: 40"
                      data-autofocus
                      hint={packReady ? `1 bulto = ${formatQuantity(packFactor)} ${symbol}` : undefined}
                      {...bind('packFactor')}
                      required
                    />
                    <TextField label="Nombre" placeholder={packNameOf({ ...form, packName: '' }, unit)} hint="Opcional. Así aparece en la venta." maxLength={60} {...bind('packName')} />
                    {packPurchase && (
                      <div className="pack-cost">
                        <span className="pack-cost__label">Precio de compra del bulto</span>
                        <span className="pack-cost__value">{formatCurrency(packPurchase)}</span>
                        <span className="pack-cost__hint">
                          {formatCurrency(purchase)} × {formatQuantity(packFactor)} {symbol}
                        </span>
                      </div>
                    )}
                    <TextField label="Precio de venta del bulto" icon={Tag} inputMode="decimal" placeholder="Ej.: 100.000" {...bind('packSalePrice')} required />
                    <ProfitSummary profit={packProfit} per="bulto" />
                  </>
                )}
              </FormSection>

              <FormSection icon={Warehouse} title="¿Cuánto hay hoy?" description="Lo que hay en bodega al crear el producto. Si no hay, déjalo vacío: queda agotado.">
                {canLoadStock ? (
                  <>
                    <TextField
                      label="Cantidad"
                      icon={Warehouse}
                      inputMode="decimal"
                      placeholder={form.initialIn === 'pack' ? 'Ej.: 10' : `Ej.: 400`}
                      data-autofocus={!form.sellsByPack || undefined}
                      hint={quantityInBase && form.initialIn === 'pack' ? `${formatQuantity(quantity)} bultos = ${formatQuantity(quantityInBase)} ${symbol}` : 'Su costo es el precio de compra.'}
                      {...bind('initialQuantity')}
                    />
                    <SelectField
                      label="En"
                      options={[{ value: 'base', label: unit ? `${unit.name} (${unit.symbol})` : 'Unidad base' }, ...(form.sellsByPack ? [{ value: 'pack', label: 'Bultos' }] : [])]}
                      value={form.initialIn}
                      onChange={(event) => setField('initialIn', event.target.value)}
                    />
                  </>
                ) : (
                  <p className="settings-note form-section__full">
                    <FileText aria-hidden="true" />
                    <span>Para registrar la cantidad necesitas el permiso "Cargar existencias iniciales". El producto se crea agotado.</span>
                  </p>
                )}
              </FormSection>
            </>
          )}

          {stepId === 'suppliers' && (
            <FormSection icon={Truck} title="Proveedores" description="Quiénes lo venden. El principal se propone primero al comprar." columns={1}>
              {!canViewSuppliers ? (
                <p className="settings-note">
                  <FileText aria-hidden="true" />
                  <span>Para asociar proveedores necesitas el permiso "Ver proveedores".</span>
                </p>
              ) : (
                <>
                  <div className="supplier-picker">
                    <SelectField
                      label="Agregar proveedor"
                      placeholder={availableSuppliers.length ? 'Selecciona…' : 'No hay más proveedores activos'}
                      options={availableSuppliers.map((supplier) => ({ value: String(supplier.id), label: supplier.tradeName ? `${supplier.tradeName} (${supplier.legalName})` : supplier.legalName }))}
                      value={supplierToAdd}
                      onChange={(event) => setSupplierToAdd(event.target.value)}
                    />
                    <Button variant="secondary" icon={Truck} onClick={addSupplier} disabled={!supplierToAdd}>
                      Agregar
                    </Button>
                  </div>
                  {fieldErrors.suppliers && <Alert tone="danger">{fieldErrors.suppliers}</Alert>}
                  {form.suppliers.length === 0 ? (
                    <p className="supplier-picker__empty">Sin proveedores. Es opcional: se pueden asociar después.</p>
                  ) : (
                    <ul className="supplier-picker__list">
                      {form.suppliers.map((link) => (
                        <li key={link.supplierId} className={`supplier-picker__item${link.isPrimary ? ' supplier-picker__item--primary' : ''}`}>
                          <span className="supplier-picker__name">{link.name}</span>
                          {link.isPrimary ? (
                            <span className="supplier-picker__primary">
                              <Star aria-hidden="true" /> Principal
                            </span>
                          ) : (
                            <Button size="sm" variant="ghost" icon={Star} onClick={() => makePrimary(link.supplierId)}>
                              Hacer principal
                            </Button>
                          )}
                          <IconButton icon={Trash2} tone="danger" label={`Quitar ${link.name}`} onClick={() => removeSupplier(link.supplierId)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              <p className="settings-note">
                <FolderTree aria-hidden="true" />
                <span>
                  Tarifa de IVA: {form.taxRate ? TAX_RATE_OPTIONS.find((option) => option.value === form.taxRate)?.label : 'la de la categoría'} · Vencidos:{' '}
                  {form.expiredSalePolicy ? expiredPolicyLabel(form.expiredSalePolicy) : inheritedPolicy ?? 'la de la categoría'}
                </span>
              </p>
            </FormSection>
          )}
        </form>
      </FormWithPreview>

      <ConfirmDialog
        isOpen={belowCost.isOpen}
        tone="danger"
        title="Precio por debajo del costo"
        message="Un precio de venta queda por debajo de lo que le cuesta el producto al negocio. ¿Quieres guardarlo así? (Útil para liquidar productos próximos a vencer.) Quedará registrado en el historial de precios."
        confirmLabel="Sí, guardar así"
        isLoading={isLoading}
        onConfirm={handleConfirmBelowCost}
        onCancel={belowCost.cancel}
      />
    </Modal>
  )
}
