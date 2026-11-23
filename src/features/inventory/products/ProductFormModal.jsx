import { useState } from 'react'
import { BadgeCheck, Barcode, Boxes, CircleDollarSign, Clock, FileText, FlaskConical, Stethoscope, FolderTree, Hash, Layers, Package, PackagePlus, Ruler, ShoppingCart, Star, Tag, Trash2, TrendingDown, TrendingUp, Truck, Warehouse } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { Switch } from '../../../components/ui/Switch/Switch'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Stepper } from '../../../components/ui/Stepper/Stepper'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useCan, useHasFeature } from '../../../hooks/usePermissions'
import { splitApiError } from '../../../utils/formErrors'
import { useGetUnitsQuery } from '../../settings/settingsApi'
import { useCreateProductMutation, useGetCategoriesQuery, useGetSuppliersQuery, useUpdateProductMutation } from '../inventoryApi'
import { useGetPurchaseGroupsQuery } from '../../purchases/purchasesApi'
import { COST_PATTERN, EXPIRED_POLICY_OPTIONS, MONEY_PATTERN, QUANTITY_PATTERN, TAX_RATE_OPTIONS, expiredPolicyLabel, toApiNumber, toInputNumber } from '../inventoryOptions'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { previewProfit, scalePrice } from './profitPreview'
import { previewDivide } from '../../../utils/moneyPreview'
import { previewAnimalPrice } from './animalPricing'
import { findCategory } from '../categories/categoryOptions'
import { CategoryPicker } from '../categories/CategoryPicker'
import { useBelowCostConfirmation } from './useBelowCostConfirmation'
import { ProductPreview } from './ProductPreview'
import '../../settings/settings.css'
import './ProductFormModal.css'

const STEP_GENERAL = { id: 'general', label: 'General', fields: ['name', 'code', 'categoryId', 'unitId', 'description'] }
const STEP_PRICES = { id: 'sale', label: 'Precios', fields: ['purchasePrice', 'packPurchasePrice', 'animalDailyIncrease', 'animalQuantity', 'salePrice', 'taxRate', 'minStock', 'barcode', 'tracksBatches', 'expiredSalePolicy'] }
// Solo al crear: el bulto (presentación) y la cantidad que hay hoy (D-INV-14).
// Después, las presentaciones se manejan en la ficha y la existencia cambia con ajustes.
const STEP_STOCK = { id: 'stock', label: 'Empaque y cantidad', fields: ['packName', 'packFactor', 'packSalePrice', 'initialQuantity'] }
const STEP_SUPPLIERS = {
  id: 'suppliers',
  label: 'Proveedores',
  fields: ['suppliers', 'purchaseGroupId', 'purchaseQuantity', 'purchase.animalPricing.baseSalePrice', 'purchase.animalPricing.dailyIncrease', 'purchase.animalPricing.maxSalePrice'],
}
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
  'presentations[0].purchasePrice': 'packPurchasePrice',
  'firstLot.quantity': 'animalQuantity',
  'firstLot.dailyIncrease': 'animalDailyIncrease',
  'initialStock.quantity': 'initialQuantity',
  'initialStock.presentationIndex': 'initialQuantity',
  'purchase.groupId': 'purchaseGroupId',
  'purchase.quantity': 'purchaseQuantity',
  'purchase.presentationIndex': 'purchaseQuantity',
}

// «¿A qué compra va?» (D-COMP-9): se recuerda la última compra escogida en este equipo, para que
// los productos que se van creando sigan entrando a la misma compra.
const LAST_GROUP_KEY = 'nexsupply.lastPurchaseGroup'
function readLastGroup() {
  try {
    return window.localStorage.getItem(LAST_GROUP_KEY) ?? ''
  } catch {
    return ''
  }
}
function rememberGroup(groupId) {
  try {
    window.localStorage.setItem(LAST_GROUP_KEY, groupId)
  } catch {
    // Sin almacenamiento: solo no se recuerda
  }
}

const AUTO_CODE = /^P-\d+$/i
const isPositive = (text) => QUANTITY_PATTERN.test(text) && !/^0+(\.0+)?$/.test(text)

function initialForm(product) {
  const vet = product?.veterinaryInfo
  return {
    // 'standard' o 'animal' (D-ANI-1); no se cambia después de creado
    productKind: product?.productKind ?? 'standard',
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
    // «¿Cómo lo compras?» (D-INV-20): 'loose' suelto, 'pack' en empaque (frasco, caja, bulto…)
    buyIn: 'loose',
    packPurchasePrice: '',
    packSoldWhole: false,
    sellsByPack: false,
    packName: '',
    packFactor: '',
    packSalePrice: '',
    initialQuantity: '',
    initialIn: 'base', // 'base' | 'pack'
    // «¿A qué compra va?»: null = no se ha tocado (se propone la última usada)
    purchaseGroupId: null,
    purchaseQuantity: '',
    purchaseIn: 'base', // 'base' | 'pack'
    // Animal (D-ANI-1): lo que sube cada día y cuántos llegan hoy (el primer lote se recibe al crearlo)
    animalDailyIncrease: '',
    animalQuantity: '',
  }
}

/** Nombre del empaque: el que se escribió, "Empaque 100 cc" (comprado en empaque) o "Bulto 40 kg". */
function packNameOf(form, unit) {
  const factor = toApiNumber(form.packFactor)
  const word = form.buyIn === 'pack' ? 'Empaque' : 'Bulto'
  return form.packName.trim() || `${word}${factor ? ` ${formatQuantity(factor)}` : ''}${unit ? ` ${unit.symbol}` : ''}`
}

/** ¿Tiene empaque? Comprado en empaque, o suelto pero también se vende en bulto o caja. */
const hasPackOf = (form) => form.buyIn === 'pack' || form.sellsByPack
/** ¿El empaque se vende completo? Si se compró en empaque es opcional; si no, siempre. */
const packSoldWholeOf = (form) => (form.buyIn === 'pack' ? form.packSoldWhole : true)

function validateStep(stepId, form, { isEdit, originalCode, unit, canViewCost, purchaseGroupId, unitCost }) {
  const isAnimal = form.productKind === 'animal'
  const errors = {}
  if (stepId === 'general') {
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre del producto'
    const code = form.code.trim().toUpperCase()
    if (code && !/^[A-Za-z0-9._-]{1,30}$/.test(code)) errors.code = 'Hasta 30 letras, números, punto o guion'
    else if (code && AUTO_CODE.test(code) && code !== originalCode) errors.code = 'Los códigos P-<número> los asigna el sistema: déjalo vacío'
    if (isEdit && !code) errors.code = 'El código no puede quedar vacío'
    if (!form.categoryId) errors.categoryId = 'Selecciona una categoría'
    if (!form.unitId) errors.unitId = 'Selecciona la unidad base'
    else if (isAnimal && unit?.allowsDecimals) errors.unitId = 'Los animales se venden por unidad: escoge una unidad sin decimales'
  }
  if (stepId === 'sale' && isAnimal) {
    // Animal: precio de compra, precio de venta de hoy, lo que sube cada día y cuántos llegan (D-ANI-1)
    const cost = toApiNumber(form.purchasePrice)
    const sale = toApiNumber(form.salePrice)
    const increase = toApiNumber(form.animalDailyIncrease)
    const quantity = toApiNumber(form.animalQuantity)
    if (canViewCost && cost && !COST_PATTERN.test(cost)) errors.purchasePrice = 'Escribe el precio de compra (ej. 1.500)'
    if (sale && !MONEY_PATTERN.test(sale)) errors.salePrice = 'Escribe el precio de venta (ej. 2.000)'
    if (increase && !MONEY_PATTERN.test(increase)) errors.animalDailyIncrease = 'Escribe cuánto sube por día (ej. 200 o 0)'
    if (!isEdit && quantity) {
      if (!isPositive(quantity) || !/^\d+$/.test(quantity)) errors.animalQuantity = 'Escribe cuántos llegan (número entero) o déjalo vacío'
      if (!sale) errors.salePrice = 'Escribe el precio de venta de hoy'
      if (canViewCost && !cost) errors.purchasePrice = 'Escribe el precio de compra de cada animal'
    }
    const minStock = toApiNumber(form.minStock || '0')
    if (!/^\d+$/.test(minStock)) errors.minStock = 'Escribe un número entero de animales'
    if (form.barcode.trim() && !/^[A-Za-z0-9-]{3,50}$/.test(form.barcode.trim())) errors.barcode = 'De 3 a 50 letras, números o guiones'
    return errors
  }
  if (stepId === 'sale') {
    // El precio de compra lo escribe quien ve costos (D-INV-13): por unidad o lo que costó el empaque (D-INV-20)
    if (canViewCost && !isEdit && form.buyIn === 'pack') {
      const factor = toApiNumber(form.packFactor)
      if (form.packName.trim() && form.packName.trim().length < 2) errors.packName = 'Mínimo 2 caracteres'
      if (!isPositive(factor)) errors.packFactor = `Escribe cuántos ${unit?.symbol ?? 'unidades'} trae (ej. 100)`
      else if (unit && !unit.allowsDecimals && !/^\d+$/.test(factor)) errors.packFactor = `La unidad ${unit.symbol} solo admite cantidades enteras`
      if (!COST_PATTERN.test(toApiNumber(form.packPurchasePrice)) || !isPositive(toApiNumber(form.packPurchasePrice))) errors.packPurchasePrice = 'Escribe cuánto te costó el empaque (ej. 100.000)'
    } else if (canViewCost && !COST_PATTERN.test(toApiNumber(form.purchasePrice))) errors.purchasePrice = 'Escribe el precio de compra (ej. 10.000)'
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
    if (form.buyIn !== 'pack' && form.sellsByPack) {
      const factor = toApiNumber(form.packFactor)
      if (!isPositive(factor)) errors.packFactor = `Escribe cuántos ${unit?.symbol ?? 'unidades'} trae el empaque (ej. 40)`
      else if (unit && !unit.allowsDecimals && !/^\d+$/.test(factor)) errors.packFactor = `La unidad ${unit.symbol} solo admite cantidades enteras`
      if (form.packName.trim() && form.packName.trim().length < 2) errors.packName = 'Mínimo 2 caracteres'
    }
    if (hasPackOf(form) && packSoldWholeOf(form) && !MONEY_PATTERN.test(toApiNumber(form.packSalePrice))) errors.packSalePrice = 'Escribe el precio de venta del empaque completo (ej. 100.000)'
    const quantity = toApiNumber(form.initialQuantity)
    if (quantity) {
      if (!isPositive(quantity)) errors.initialQuantity = 'Escribe una cantidad mayor que cero, o déjalo vacío'
      else if (form.initialIn === 'base' && unit && !unit.allowsDecimals && !/^\d+$/.test(quantity)) errors.initialQuantity = `La unidad ${unit.symbol} solo admite cantidades enteras`
      if (canViewCost && !COST_PATTERN.test(unitCost ?? '')) errors.initialQuantity = 'Para registrar la cantidad hace falta el precio de compra'
    }
  }
  if (stepId === 'suppliers' && purchaseGroupId) {
    if (form.suppliers.length === 0) errors.suppliers = 'Escoge el proveedor: el producto va a la compra de ese proveedor'
    const quantity = toApiNumber(form.purchaseQuantity)
    if (!isPositive(quantity)) errors.purchaseQuantity = 'Escribe cuántas llegan en la compra'
    else if (form.purchaseIn === 'base' && unit && !unit.allowsDecimals && !/^\d+$/.test(quantity)) errors.purchaseQuantity = `La unidad ${unit.symbol} solo admite cantidades enteras`
    if (toApiNumber(form.initialQuantity)) errors.purchaseGroupId = 'Si va a una compra, las unidades llegan al confirmarla: borra la cantidad de "¿Cuánto hay hoy?" (paso Empaque y cantidad)'
    if (isAnimal) {
      // El lote que llega en la compra usa el precio de venta y lo que sube del paso Precios
      if (!toApiNumber(form.salePrice)) errors.purchaseGroupId = 'Para agregarlo a la compra escribe el precio de venta (paso Precios)'
      if (!isEdit && toApiNumber(form.animalQuantity)) errors.purchaseGroupId = 'Si llegan en esta compra, deja vacío «¿Cuántos llegan hoy?» (paso Precios)'
    }
    if (!COST_PATTERN.test(unitCost ?? '') || /^0+(\.0+)?$/.test(unitCost ?? '')) errors.purchaseGroupId = 'Para agregarlo a la compra hace falta el precio de compra (paso Precios)'
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
  // «¿A qué compra va?» (al crear y al editar), con el módulo de compras y permiso de registrarlas y ver costos
  const purchasesEnabled = useHasFeature('purchases')
  const canAddToPurchase = useCan('purchases.view', 'purchases.create', 'inventory.cost_view') && purchasesEnabled
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => initialForm(product))
  const [localErrors, setLocalErrors] = useState({})
  const [supplierToAdd, setSupplierToAdd] = useState('')
  const { data: tree = [] } = useGetCategoriesQuery()
  const { data: units = [] } = useGetUnitsQuery()
  const { data: supplierData } = useGetSuppliersQuery({ isActive: 'true', pageSize: 100 }, { skip: !canViewSuppliers })
  const [createProduct, createState] = useCreateProductMutation()
  const [updateProduct, updateState] = useUpdateProductMutation()
  const { data: openGroups = [] } = useGetPurchaseGroupsQuery({ open: 'true' }, { skip: !canAddToPurchase })
  const belowCost = useBelowCostConfirmation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: rawServerErrors, formError } = splitApiError(error?.code === 'CONFIRMATION_REQUIRED' ? null : error)
  const serverErrors = Object.fromEntries(Object.entries(rawServerErrors).map(([field, message]) => [SERVER_FIELDS[field] ?? field, message]))
  const fieldErrors = { ...serverErrors, ...localErrors }

  const category = findCategory(tree, form.categoryId)
  const parentCategory = category && tree.find((item) => item.children.some((child) => child.id === category.id))
  // La ficha veterinaria aparece en categorías veterinarias (la subcategoría hereda de su categoría)
  const isVeterinary = Boolean(category?.isVeterinary || parentCategory?.isVeterinary)
  const isAnimal = form.productKind === 'animal'
  // Un animal no tiene ficha veterinaria, empaques ni existencia inicial: entra por lotes (D-ANI-1)
  const steps = isAnimal ? [STEP_GENERAL, STEP_PRICES, STEP_SUPPLIERS] : [STEP_GENERAL, ...(isVeterinary ? [STEP_VET] : []), STEP_PRICES, ...(isEdit ? [] : [STEP_STOCK]), STEP_SUPPLIERS]
  const stepId = steps[Math.min(step, steps.length - 1)].id
  const isLastStep = step >= steps.length - 1
  const unit = units.find((item) => String(item.id) === form.unitId)
  const priceLocked = isEdit && !canChangePrice
  const lastGroup = readLastGroup()
  const purchaseGroupId = form.purchaseGroupId ?? (!isEdit && openGroups.some((group) => String(group.id) === lastGroup) ? lastGroup : '')
  const purchaseGroup = openGroups.find((group) => String(group.id) === purchaseGroupId)
  const availableSuppliers = (supplierData?.rows ?? []).filter((supplier) => !form.suppliers.some((link) => link.supplierId === supplier.id))

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const bind = (name) => ({ name, value: form[name], error: fieldErrors[name], onChange: (event) => setField(name, event.target.value) })

  // Vistas previas (solo para mostrar; el backend calcula los valores oficiales)
  const buysInPack = !isEdit && canViewCost && form.buyIn === 'pack'
  const packFactor = toApiNumber(form.packFactor)
  const hasPack = !isEdit && hasPackOf(form)
  const packReady = hasPack && isPositive(packFactor)
  const packSoldWhole = packSoldWholeOf(form)
  // Precio de compra por unidad base: el escrito, o lo que costó el empaque ÷ su contenido (D-INV-20)
  const purchase = buysInPack ? (packReady ? previewDivide(toApiNumber(form.packPurchasePrice), packFactor) ?? '' : '') : toApiNumber(form.purchasePrice)
  const profit = canViewCost ? previewProfit(purchase, toApiNumber(form.salePrice)) : null
  const packPurchase = canViewCost && packReady && COST_PATTERN.test(purchase) ? (buysInPack ? toApiNumber(form.packPurchasePrice) : scalePrice(purchase, packFactor)) : null
  const packProfit = packPurchase && packSoldWhole ? previewProfit(packPurchase, toApiNumber(form.packSalePrice)) : null
  const packLabel = packNameOf(form, unit)
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
      tracksBatches: isAnimal ? false : form.tracksBatches,
      expiredSalePolicy: isAnimal ? null : form.expiredSalePolicy || null,
      ...(!isEdit && isAnimal && { productKind: 'animal' }),
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
    // Comprado en empaque: el servidor calcula el precio por unidad con lo que costó el empaque
    if (canViewCost && !buysInPack && (!isEdit || Number(purchase) !== Number(product.purchasePrice)) && !(isAnimal && !purchase)) body.purchasePrice = purchase
    // Al editar, el precio solo se envía si cambió (y si hay permiso)
    if (!isAnimal && (!isEdit || (canChangePrice && Number(price) !== Number(product.salePrice)))) body.salePrice = price
    // Animal: el precio de venta es el de hoy (referencia para los lotes nuevos)
    if (isAnimal && price && (!isEdit || (canChangePrice && Number(price) !== Number(product.salePrice)))) body.salePrice = price
    if (isAnimal && !isEdit && toApiNumber(form.animalQuantity)) {
      body.firstLot = { quantity: toApiNumber(form.animalQuantity), dailyIncrease: toApiNumber(form.animalDailyIncrease) || '0' }
    }
    if (!isEdit) {
      if (hasPack) {
        body.presentations = [
          {
            name: packLabel,
            factor: packFactor,
            ...(packSoldWhole ? { salePrice: toApiNumber(form.packSalePrice) } : { isSoldWhole: false }),
            ...(buysInPack && { purchasePrice: toApiNumber(form.packPurchasePrice) }),
          },
        ]
      }
      if (canLoadStock && quantity) body.initialStock = { quantity, ...(form.initialIn === 'pack' && hasPack && { presentationIndex: 0 }) }
      if (canAddToPurchase && purchaseGroup) {
        body.purchase = { groupId: purchaseGroup.id, quantity: toApiNumber(form.purchaseQuantity), ...(form.purchaseIn === 'pack' && hasPack && { presentationIndex: 0 }) }
      }
    } else if (canAddToPurchase && purchaseGroup) {
      // Al editar, la cantidad va en la unidad base o en una presentación que ya existe (por su id)
      body.purchase = { groupId: purchaseGroup.id, quantity: toApiNumber(form.purchaseQuantity), ...(form.purchaseIn !== 'base' && { presentationId: Number(form.purchaseIn) }) }
    }
    // Un animal que llega en una compra lleva el precio de su lote (D-ANI-1)
    if (isAnimal && body.purchase) {
      body.purchase.animalPricing = { baseSalePrice: price, dailyIncrease: toApiNumber(form.animalDailyIncrease) || '0', maxSalePrice: null }
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

  const finish = (saved) => {
    // Al editar con «Ninguna» no se olvida la compra que se venía usando al crear
    if (canAddToPurchase && (!isEdit || purchaseGroup)) rememberGroup(purchaseGroup ? String(purchaseGroup.id) : '')
    onSaved(saved, isEdit, { purchaseGroupName: purchaseGroup?.name ?? null })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = validateStep(stepId, form, { isEdit, originalCode: product?.code, unit, canViewCost, purchaseGroupId: canAddToPurchase && purchaseGroup ? purchaseGroupId : '', unitCost: purchase })
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!isLastStep) {
      setStep(step + 1)
      return
    }
    try {
      const saved = await belowCost.run(save)
      if (saved) finish(saved)
    } catch (saveError) {
      goToStepWithError(saveError)
    }
  }

  const handleConfirmBelowCost = async () => {
    try {
      finish(await belowCost.confirm())
    } catch (saveError) {
      goToStepWithError(saveError)
    }
  }

  const inheritedPolicy = category ? expiredPolicyLabel(category.expiredSalePolicy) : null
  // Animal: "Hoy $ 2.000 · en 7 días $ 3.400 · en 30 días $ 8.000" (vista previa)
  const animalSale = isAnimal ? toApiNumber(form.salePrice) : ''
  const animalPreview =
    isAnimal && MONEY_PATTERN.test(animalSale) && Number(animalSale) > 0
      ? [0, 7, 30].map((days) => `${days === 0 ? 'Hoy' : `en ${days} días`} ${formatCurrency(previewAnimalPrice(animalSale, toApiNumber(form.animalDailyIncrease) || '0', days, ''))}`).join(' · ')
      : null
  const symbol = unit?.symbol ?? 'unidad'
  const pack = packReady ? { name: packLabel, salePrice: packSoldWhole ? toApiNumber(form.packSalePrice) : null, soldWhole: packSoldWhole } : null

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
              {!isEdit && (
                <div className="form-section__full">
                  <OptionCards
                    legend="¿Qué tipo de producto es?"
                    name="productKind"
                    value={form.productKind}
                    onChange={(value) => {
                      setField('productKind', value)
                      // Un animal se vende por unidad: si la unidad escogida admite decimales, se quita
                      if (value === 'animal' && unit?.allowsDecimals) setField('unitId', '')
                    }}
                    options={[
                      { value: 'standard', label: 'Producto normal', description: 'Concentrados, medicamentos, herramientas… con su precio de venta.' },
                      { value: 'animal', label: 'Animal', description: 'Pollos, cerdos… por lotes, con un precio que sube cada día.' },
                    ]}
                  />
                </div>
              )}
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
                options={units.filter((item) => !isAnimal || !item.allowsDecimals || String(item.id) === form.unitId).map((item) => ({ value: String(item.id), label: `${item.name} (${item.symbol})` }))}
                hint={
                  isEdit
                    ? 'No se puede cambiar si el producto ya tiene movimientos.'
                    : isAnimal
                      ? 'Los animales se venden por unidad (ej. Unidad).'
                      : 'La unidad más pequeña en que se vende (kg, und…). El empaque se agrega en el paso "Empaque y cantidad".'
                }
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

          {stepId === 'sale' && isAnimal && (
            <>
              <FormSection icon={CircleDollarSign} title="Precios" description="Cada día el precio de venta sube lo que diga «Sube cada día».">
                {canViewCost && (
                  <TextField label="Precio de compra" icon={ShoppingCart} inputMode="decimal" placeholder="Ej.: 1.500" hint="Lo que cuesta cada animal." data-autofocus {...bind('purchasePrice')} />
                )}
                <TextField label="Precio de venta" icon={Tag} inputMode="decimal" placeholder="Ej.: 2.000" hint="Lo que vale cada animal hoy." data-autofocus={!canViewCost || undefined} disabled={priceLocked} {...bind('salePrice')} />
                <TextField label="Sube cada día" icon={TrendingUp} inputMode="decimal" placeholder="Ej.: 200" hint="Cuánto aumenta el precio por día. 0 = no sube." {...bind('animalDailyIncrease')} />
                {!isEdit && (
                  <TextField label="¿Cuántos llegan hoy?" icon={PackagePlus} inputMode="numeric" placeholder="Ej.: 50" hint="Se reciben de una vez. Déjalo vacío si llegan en una compra." {...bind('animalQuantity')} />
                )}
                {animalPreview && (
                  <p className="settings-note form-section__full" role="status">
                    <TrendingUp aria-hidden="true" />
                    <span>{animalPreview}</span>
                  </p>
                )}
              </FormSection>
              <FormSection icon={Ruler} title="Inventario">
              <SelectField
                label="Tarifa de IVA"
                placeholder={category ? `La de la categoría (${TAX_RATE_OPTIONS.find((option) => option.value === category.defaultTaxRate)?.label})` : 'La de la categoría'}
                options={TAX_RATE_OPTIONS}
                {...bind('taxRate')}
              />
              <TextField label="Existencia mínima (animales)" inputMode="numeric" hint="Bajo este número aparece la alerta. 0 = sin alerta." {...bind('minStock')} />
              <TextField label="Código de barras" icon={Barcode} placeholder="Escanéalo o escríbelo" hint="Opcional. Único." maxLength={50} {...bind('barcode')} />
              </FormSection>
            </>
          )}

          {stepId === 'sale' && !isAnimal && (
            <>
              {!isEdit && canViewCost && (
                <FormSection icon={ShoppingCart} title="¿Cómo lo compras?" description={`Si compras un frasco, una caja o un bulto y lo vendes por ${symbol}, escribe lo que te costó el empaque.`}>
                  <div className="form-section__full">
                    <OptionCards
                      legend="¿Cómo lo compras?"
                      name="buyIn"
                      value={form.buyIn}
                      onChange={(value) => {
                        setField('buyIn', value)
                        if (value === 'loose') setField('initialIn', form.sellsByPack ? form.initialIn : 'base')
                      }}
                      options={[
                        { value: 'loose', label: 'Suelto', description: `Escribo el precio de compra de 1 ${symbol}.` },
                        { value: 'pack', label: 'En empaque', description: `Frasco, caja o bulto que vendo por ${symbol}.` },
                      ]}
                    />
                  </div>
                  {form.buyIn === 'pack' && (
                    <>
                      <TextField label="Nombre del empaque" icon={Package} placeholder={`Ej.: Frasco 100 ${symbol}`} hint="Opcional. Ej.: Frasco, Caja, Bulto." maxLength={60} data-autofocus {...bind('packName')} />
                      <TextField label={`¿Cuántos ${symbol} trae?`} icon={Boxes} inputMode="decimal" placeholder="Ej.: 100" {...bind('packFactor')} required />
                      <TextField label="¿Cuánto te costó el empaque?" icon={ShoppingCart} inputMode="decimal" placeholder="Ej.: 100.000" hint="Lo que le pagas al proveedor por un empaque." {...bind('packPurchasePrice')} required />
                      <div className="pack-cost">
                        <span className="pack-cost__label">Costo por {symbol}</span>
                        <span className="pack-cost__value">{COST_PATTERN.test(purchase) && purchase ? formatCurrency(purchase) : '$ —'}</span>
                        <span className="pack-cost__hint">Lo que costó el empaque ÷ lo que trae</span>
                      </div>
                    </>
                  )}
                </FormSection>
              )}
              <FormSection icon={CircleDollarSign} title={canViewCost ? 'Precios y ganancia' : 'Precio e impuestos'} description={unit ? `Precios de 1 ${unit.symbol}.` : 'Precios de la unidad base.'}>
                {canViewCost && !buysInPack && (
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
                  data-autofocus={(!canViewCost && !buysInPack) || undefined}
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
              {buysInPack ? (
                <FormSection icon={Boxes} title={packLabel} description={`Lo compras en ${packLabel.toLowerCase()} y lo vendes por ${symbol}. La existencia se guarda en ${symbol}.`}>
                  <div className="form-section__full">
                    <Switch
                      label={`¿También vendes el empaque completo (${packLabel})?`}
                      description={`Si no, solo se vende por ${symbol} y el empaque no aparece en el punto de venta.`}
                      checked={form.packSoldWhole}
                      onChange={(checked) => setField('packSoldWhole', checked)}
                    />
                  </div>
                  {form.packSoldWhole && (
                    <>
                      <TextField label="Precio de venta del empaque completo" icon={Tag} inputMode="decimal" placeholder="Ej.: 180.000" data-autofocus {...bind('packSalePrice')} required />
                      <ProfitSummary profit={packProfit} per="empaque" />
                    </>
                  )}
                </FormSection>
              ) : (
                <FormSection icon={Boxes} title="Venta por empaque" description={`Si también se vende el bulto o la caja completa, con su propio precio. La existencia se guarda en ${symbol}.`}>
                  <div className="form-section__full">
                    <Switch
                      label="¿Se vende también por bulto o empaque?"
                      description={`Ej.: bulto de 40 ${symbol}. Se puede vender el empaque completo o suelto por ${symbol}.`}
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
                        label={unit ? `${unit.symbol} por empaque` : 'Contenido del empaque'}
                        icon={Package}
                        inputMode="decimal"
                        placeholder="Ej.: 40"
                        data-autofocus
                        hint={packReady ? `1 empaque = ${formatQuantity(packFactor)} ${symbol}` : undefined}
                        {...bind('packFactor')}
                        required
                      />
                      <TextField label="Nombre" placeholder={packNameOf({ ...form, packName: '' }, unit)} hint="Opcional. Así aparece en la venta." maxLength={60} {...bind('packName')} />
                      {packPurchase && (
                        <div className="pack-cost">
                          <span className="pack-cost__label">Precio de compra del empaque</span>
                          <span className="pack-cost__value">{formatCurrency(packPurchase)}</span>
                          <span className="pack-cost__hint">
                            {formatCurrency(purchase)} × {formatQuantity(packFactor)} {symbol}
                          </span>
                        </div>
                      )}
                      <TextField label="Precio de venta del empaque" icon={Tag} inputMode="decimal" placeholder="Ej.: 100.000" {...bind('packSalePrice')} required />
                      <ProfitSummary profit={packProfit} per="empaque" />
                    </>
                  )}
                </FormSection>
              )}

              <FormSection icon={Warehouse} title="¿Cuánto hay hoy?" description="Lo que hay en bodega al crear el producto. Si no hay, déjalo vacío: queda agotado.">
                {canLoadStock ? (
                  <>
                    <TextField
                      label="Cantidad"
                      icon={Warehouse}
                      inputMode="decimal"
                      placeholder={form.initialIn === 'pack' ? 'Ej.: 10' : `Ej.: 400`}
                      data-autofocus={(!form.sellsByPack && !(buysInPack && form.packSoldWhole)) || undefined}
                      hint={quantityInBase && form.initialIn === 'pack' ? `${formatQuantity(quantity)} × ${packLabel} = ${formatQuantity(quantityInBase)} ${symbol}` : 'Su costo es el precio de compra.'}
                      {...bind('initialQuantity')}
                    />
                    <SelectField
                      label="En"
                      options={[{ value: 'base', label: unit ? `${unit.name} (${unit.symbol})` : 'Unidad base' }, ...(packReady ? [{ value: 'pack', label: packLabel }] : [])]}
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

          {stepId === 'suppliers' && canAddToPurchase && (
            <FormSection
              icon={Layers}
              title="¿A qué compra va?"
              description={
                isEdit
                  ? 'Si llegó más de este producto en una compra, escógela. Entra con su proveedor principal y su precio de compra. Déjalo en «Ninguna» para solo guardar los cambios.'
                  : 'Si llegó en una compra, escógela: el producto entra con su proveedor principal y su precio de compra.'
              }
            >
              <SelectField
                className="form-section__full"
                label="Compra"
                placeholder="Ninguna"
                options={openGroups.map((group) => ({ value: String(group.id), label: `${group.name} · ${formatCurrency(group.total)}` }))}
                hint={openGroups.length === 0 ? 'No hay compras abiertas. Créalas en Compras → Nueva compra.' : undefined}
                name="purchaseGroupId"
                value={purchaseGroupId}
                error={fieldErrors.purchaseGroupId}
                onChange={(event) => setField('purchaseGroupId', event.target.value)}
              />
              {purchaseGroup && (
                <>
                  <TextField
                    label="¿Cuántas llegan?"
                    icon={PackagePlus}
                    inputMode="decimal"
                    placeholder={form.purchaseIn === 'pack' ? 'Ej.: 20' : 'Ej.: 400'}
                    hint={
                      form.suppliers.length
                        ? `Va a la parte de ${(form.suppliers.find((link) => link.isPrimary) ?? form.suppliers[0]).name}. Entran al inventario al confirmarla.`
                        : 'Primero agrega el proveedor arriba.'
                    }
                    {...bind('purchaseQuantity')}
                    required
                  />
                  <SelectField
                    label="En"
                    options={[
                      { value: 'base', label: unit ? `${unit.name} (${unit.symbol})` : 'Unidad base' },
                      ...(isEdit
                        ? (product.presentations ?? []).filter((presentation) => presentation.isActive !== false).map((presentation) => ({ value: String(presentation.id), label: presentation.name }))
                        : packReady
                          ? [{ value: 'pack', label: packLabel }]
                          : []),
                    ]}
                    value={form.purchaseIn}
                    onChange={(event) => setField('purchaseIn', event.target.value)}
                  />
                </>
              )}
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
