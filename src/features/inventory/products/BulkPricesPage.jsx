import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, Search, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { useApplyBulkPricesMutation, useGetCategoriesQuery, useGetSuppliersQuery, usePreviewBulkPricesMutation } from '../inventoryApi'
import { CategoryPicker } from '../categories/CategoryPicker'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { Checkbox } from '../../../components/ui/Checkbox/Checkbox'
import { Button } from '../../../components/ui/Button/Button'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { formatCurrency } from '../../../utils/format'
import { toApiNumber } from '../../../utils/numberInput'
import { ROUTES } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../inventory.css'

const VALUE_PATTERN = /^\d{1,12}(\.\d{1,2})?$/

/**
 * /inventario/cambiar-precios — Subir o bajar precios en bloque (D-PRE-2): filtros, el cambio
 * (% o $), vista previa con precio de antes y después, desmarcar y aplicar todo junto.
 */
export default function BulkPricesPage() {
  const toast = useToast()
  const canViewCost = useCan('inventory.cost_view')
  const { data: tree = [] } = useGetCategoriesQuery()
  const { data: suppliersData } = useGetSuppliersQuery({ isActive: 'true', pageSize: 100 })
  const [preview, previewState] = usePreviewBulkPricesMutation()
  const [apply, applyState] = useApplyBulkPricesMutation()
  const [filters, setFilters] = useState({ categoryId: '', supplierId: '', search: '' })
  const [direction, setDirection] = useState('up')
  const [type, setType] = useState('percent')
  const [value, setValue] = useState('')
  const [includePurchasePrice, setIncludePurchasePrice] = useState(false)
  const [result, setResult] = useState(null) // { rows, request }
  const [unchecked, setUnchecked] = useState(() => new Set())
  const [confirm, setConfirm] = useState(null) // null | 'apply' | { belowCost: mensaje }
  const [localError, setLocalError] = useState(null)

  const suppliers = (suppliersData?.rows ?? []).map((row) => ({ value: String(row.id), label: row.tradeName || row.legalName }))
  const amount = toApiNumber(value)

  const changeBody = () => ({ type, value: direction === 'down' ? `-${amount}` : amount })

  // Si cambian los filtros o el cambio, la vista previa ya no sirve
  const resetting = (setter) => (next) => {
    setter(next)
    setResult(null)
  }

  const handlePreview = async (event) => {
    event.preventDefault()
    setLocalError(null)
    if (!VALUE_PATTERN.test(amount) || Number(amount) === 0) {
      setLocalError(type === 'percent' ? 'Escribe el porcentaje (ej. 5)' : 'Escribe cuántos pesos (ej. 2.000)')
      return
    }
    const request = {
      change: changeBody(),
      includePurchasePrice,
      ...(filters.categoryId && { categoryId: Number(filters.categoryId) }),
      ...(filters.supplierId && { supplierId: Number(filters.supplierId) }),
      ...(filters.search.trim() && { search: filters.search.trim() }),
    }
    try {
      const data = await preview(request).unwrap()
      setResult({ rows: data.rows, request })
      setUnchecked(new Set())
    } catch {
      // Se muestra desde previewState.error
    }
  }

  const rows = result?.rows ?? []
  const selected = rows.filter((row) => !unchecked.has(row.productId))
  const belowCount = selected.filter((row) => row.belowCost).length

  const runApply = async (confirmBelowCost = false) => {
    try {
      const data = await apply({ productIds: selected.map((row) => row.productId), change: result.request.change, includePurchasePrice: result.request.includePurchasePrice, confirmBelowCost }).unwrap()
      setConfirm(null)
      setResult(null)
      toast.success(data.message ?? 'Precios actualizados')
    } catch (applyError) {
      if (applyError.code === 'CONFIRMATION_REQUIRED') {
        setConfirm({ belowCost: applyError.message })
        return
      }
      setConfirm(null)
      toast.error(applyError.message)
    }
  }

  const toggle = (productId, checked) =>
    setUnchecked((current) => {
      const next = new Set(current)
      if (checked) next.delete(productId)
      else next.add(productId)
      return next
    })

  const allChecked = rows.length > 0 && unchecked.size === 0
  const columns = [
    {
      key: 'check',
      header: <Checkbox label={<span className="u-visually-hidden">Marcar todos</span>} checked={allChecked} indeterminate={!allChecked && selected.length > 0} onChange={(checked) => setUnchecked(checked ? new Set() : new Set(rows.map((row) => row.productId)))} />,
      render: (row) => <Checkbox label={<span className="u-visually-hidden">{`Cambiar ${row.name}`}</span>} checked={!unchecked.has(row.productId)} onChange={(checked) => toggle(row.productId, checked)} />,
    },
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (row) => (
        <span className="price-change__product">
          <strong>{row.name}</strong>
          <small>
            {row.code} · {row.unitSymbol}
          </small>
          {row.belowCost && <Badge tone="danger">Queda bajo el costo</Badge>}
        </span>
      ),
    },
    {
      key: 'sale',
      header: 'Precio de venta',
      render: (row) => (
        <span className="price-change">
          <span className="price-change__line">
            <span className="numeric">{formatCurrency(row.salePrice)}</span> <ArrowRight aria-hidden="true" /> <strong className="numeric">{formatCurrency(row.newSalePrice)}</strong>
          </span>
          {row.presentations.map((pack) => (
            <span key={pack.id} className="price-change__line price-change__line--pack">
              {pack.name}: <span className="numeric">{formatCurrency(pack.salePrice)}</span> <ArrowRight aria-hidden="true" /> <strong className="numeric">{formatCurrency(pack.newSalePrice)}</strong>
            </span>
          ))}
        </span>
      ),
    },
    ...(canViewCost && result?.request.includePurchasePrice
      ? [
          {
            key: 'purchase',
            header: 'Precio de compra',
            render: (row) => (
              <span className="price-change__line">
                <span className="numeric">{formatCurrency(row.purchasePrice)}</span> <ArrowRight aria-hidden="true" /> <strong className="numeric">{formatCurrency(row.newPurchasePrice)}</strong>
              </span>
            ),
          },
        ]
      : []),
  ]

  const changeText = `${direction === 'up' ? 'subir' : 'bajar'} ${type === 'percent' ? `${value} %` : formatCurrency(amount || '0')}`

  return (
    <>
      <Link className="cash-session__back" to={ROUTES.products}>
        <ArrowLeft aria-hidden="true" /> Productos
      </Link>
      <PageHeader description="Cambia de una vez el precio de muchos productos, por ejemplo cuando el proveedor sube. Primero ves cómo quedan y luego aplicas. Los animales no entran: su precio va por lote." />

      <form onSubmit={handlePreview} noValidate>
        <FilterBar>
          <CategoryPicker label="Categoría" tree={tree} value={filters.categoryId} onChange={resetting((next) => setFilters((current) => ({ ...current, categoryId: next })))} allowClear clearLabel="Todas las categorías" />
          <SelectField label="Proveedor" placeholder="Todos los proveedores" options={suppliers} value={filters.supplierId} onChange={(event) => resetting((next) => setFilters((current) => ({ ...current, supplierId: next })))(event.target.value)} />
          <TextField label="Buscar" icon={Search} type="search" placeholder="Nombre o código" value={filters.search} onChange={(event) => resetting((next) => setFilters((current) => ({ ...current, search: next })))(event.target.value)} />
        </FilterBar>

        <FormSection icon={direction === 'up' ? TrendingUp : TrendingDown} title="El cambio" description="El precio de venta nuevo se redondea hacia arriba a la centena. Los bultos cambian en la misma proporción.">
          <SelectField
            label="¿Subir o bajar?"
            options={[
              { value: 'up', label: 'Subir' },
              { value: 'down', label: 'Bajar' },
            ]}
            value={direction}
            onChange={(event) => resetting(setDirection)(event.target.value)}
          />
          <SelectField
            label="En"
            options={[
              { value: 'percent', label: 'Porcentaje (%)' },
              { value: 'amount', label: 'Pesos ($), por unidad' },
            ]}
            value={type}
            onChange={(event) => resetting(setType)(event.target.value)}
          />
          <TextField label={type === 'percent' ? 'Porcentaje' : 'Pesos'} inputMode="decimal" placeholder={type === 'percent' ? 'Ej.: 5' : 'Ej.: 2.000'} value={value} onChange={(event) => resetting(setValue)(event.target.value)} error={localError} required />
          {canViewCost && (
            <Checkbox
              label="Cambiar también el precio de compra"
              description="Con el mismo cambio, sin redondear. El costo promedio no cambia: ese lo cambian las compras."
              checked={includePurchasePrice}
              onChange={(checked) => resetting(setIncludePurchasePrice)(checked)}
            />
          )}
        </FormSection>
        <div className="price-change__actions">
          <Button type="submit" icon={Eye} isLoading={previewState.isLoading}>
            Ver cómo quedan
          </Button>
        </div>
      </form>

      {previewState.error && !result && <Alert tone="danger">{previewState.error.details?.[0]?.message ?? previewState.error.message}</Alert>}

      {result && (
        <section className="price-change__result" aria-label="Vista previa">
          <DataTable caption="Cómo quedan los precios" columns={columns} rows={rows} getRowId={(row) => row.productId} emptyTitle="Ningún producto coincide con los filtros" />
          {rows.length > 0 && (
            <div className="price-change__footer">
              <span>
                {selected.length} de {rows.length} productos marcados
                {belowCount > 0 && (
                  <>
                    {' · '}
                    <TriangleAlert aria-hidden="true" /> {belowCount} {belowCount === 1 ? 'queda' : 'quedan'} bajo el costo
                  </>
                )}
              </span>
              <Button icon={direction === 'up' ? TrendingUp : TrendingDown} disabled={selected.length === 0} onClick={() => setConfirm('apply')}>
                Aplicar a {selected.length} {selected.length === 1 ? 'producto' : 'productos'}
              </Button>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={confirm === 'apply'}
        title="Cambiar precios"
        message={`Vas a ${changeText} el precio de ${selected.length} ${selected.length === 1 ? 'producto' : 'productos'}${result?.request.includePurchasePrice ? ' (también el precio de compra)' : ''}. Cada cambio queda en el historial de precios.`}
        confirmLabel="Cambiar precios"
        isLoading={applyState.isLoading}
        onConfirm={() => runApply(false)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        isOpen={Boolean(confirm?.belowCost)}
        tone="danger"
        title="Precios por debajo del costo"
        message={confirm?.belowCost ?? ''}
        confirmLabel="Sí, cambiar así"
        isLoading={applyState.isLoading}
        onConfirm={() => runApply(true)}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
