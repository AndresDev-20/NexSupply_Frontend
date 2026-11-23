import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, FileSpreadsheet, Package, PackagePlus, PackageX, Pencil, Search, TriangleAlert } from 'lucide-react'
import { useGetCategoriesQuery, useGetProductsQuery } from '../inventoryApi'
import { CategoryPicker } from '../categories/CategoryPicker'
import { useCan } from '../../../hooks/usePermissions'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { Badge } from '../../../components/ui/Badge/Badge'
import { formatCurrency, formatPercent, formatQuantity } from '../../../utils/format'
import { ROUTES, productPath } from '../../../routes/paths'
import { ProductFormModal } from './ProductFormModal'
import '../../admin/admin.css'
import '../inventory.css'

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
]

/** Lista de productos con búsqueda, filtros y existencias de la sucursal del usuario. */
// Filtro por estado de existencia en la sucursal (D-INV-14)
const STOCK_OPTIONS = [
  { value: 'available', label: 'Con existencia', empty: 'con existencia' },
  { value: 'low', label: 'Existencia baja', empty: 'con existencia baja' },
  { value: 'out', label: 'Agotados', empty: 'agotados' },
]

/** "10 bultos + 10 kg" con la primera presentación activa (la más grande que alcance). */
function packStock(product) {
  const pack = [...(product.presentations ?? [])].reverse().find((item) => item.isActive && item.stockWhole && item.stockWhole !== '0')
  if (!pack) return null
  const rest = pack.stockRemainder && !/^0+(\.0+)?$/.test(pack.stockRemainder) ? ` + ${formatQuantity(pack.stockRemainder)} ${product.unit?.symbol ?? ''}` : ''
  return `= ${pack.stockWhole} × ${pack.name}${rest}`
}

export default function ProductsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const can = {
    create: useCan('inventory.create'),
    update: useCan('inventory.update'),
    viewCost: useCan('inventory.cost_view'),
    import: useCan('inventory.import'),
    prices: useCan('inventory.prices'),
  }
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isActive, setIsActive] = useState('true')
  const [stockStatus, setStockStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const debouncedSearch = useDebouncedValue(search.trim())

  const params = {
    page,
    pageSize: 20,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(categoryId && { categoryId }),
    ...(isActive && { isActive }),
    ...(stockStatus && { stockStatus }),
  }
  const { data, error, isFetching, refetch } = useGetProductsQuery(params)
  const { data: tree = [] } = useGetCategoriesQuery()

  const resetPage = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (product) => (
        <div className="entity-cell">
          <span className="entity-cell__icon" aria-hidden="true">
            <Package size={16} />
          </span>
          <span className="entity-cell__text">
            <span className="entity-cell__name">
              <Link to={productPath(product.id)}>{product.name}</Link>
            </span>
            <span className="entity-cell__detail">
              <span className="entity-cell__code">{product.code}</span>
              {product.category && <span>· {product.category.parent ? `${product.category.parent.name} › ` : ''}{product.category.name}</span>}
              {!product.isActive && <Badge tone="neutral">Inactivo</Badge>}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Existencia',
      render: (product) => (
        <span className="stock-cell">
          <span className="stock-cell__amount">
            <span className="numeric">
              {formatQuantity(product.stock)} {product.unit?.symbol}
            </span>
            {packStock(product) && <span className="stock-cell__pack">{packStock(product)}</span>}
          </span>
          {product.isOutOfStock ? (
            <Badge tone="danger" icon={PackageX}>
              Agotado
            </Badge>
          ) : (
            product.isLowStock && (
              <Badge tone="warning" icon={TriangleAlert}>
                Baja
              </Badge>
            )
          )}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      render: (product) => (
        <span className="numeric">
          {product.productKind === 'animal' ? 'Por lote · sube cada día' : `${formatCurrency(product.salePrice)} / ${product.unit?.symbol}`}
        </span>
      ),
    },
    ...(can.viewCost
      ? [
          { key: 'purchase', header: 'Compra', render: (product) => <span className="numeric">{product.productKind === 'animal' ? '—' : formatCurrency(product.purchasePrice)}</span> },
          {
            key: 'profit',
            header: 'Ganancia',
            render: (product) =>
              product.productKind === 'animal' ? (
                '—'
              ) : (
              <span className={`numeric${product.profit?.startsWith('-') ? ' margin--negative' : ''}`}>
                {formatCurrency(product.profit)} {product.profitPercent !== null && <small>({formatPercent(product.profitPercent)})</small>}
              </span>
              ),
          },
        ]
      : []),
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (product) => (
        <div className="row-actions">
          {can.update && <IconButton icon={Pencil} label={`Editar ${product.name}`} onClick={() => setEditing(product)} />}
          <IconButton icon={Package} label={`Ver ${product.name}`} onClick={() => navigate(productPath(product.id))} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Productos del negocio con la existencia de tu sucursal. Busca por nombre, código o escaneando el código de barras."
        actions={
          <>
            {can.prices && (
              <Button variant="secondary" icon={TrendingUp} onClick={() => navigate(ROUTES.bulkPrices)}>
                Cambiar precios
              </Button>
            )}
            {can.import && (
              <Button variant="secondary" icon={FileSpreadsheet} onClick={() => navigate(ROUTES.productImport)}>
                Importar
              </Button>
            )}
            {can.create && (
              <Button icon={PackagePlus} onClick={() => setEditing('new')}>
                Nuevo producto
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <TextField
          label="Buscar"
          icon={Search}
          type="search"
          placeholder="Nombre, código o código de barras"
          value={search}
          onChange={(event) => resetPage(setSearch)(event.target.value)}
        />
        <CategoryPicker label="Categoría" tree={tree} value={categoryId} onChange={resetPage(setCategoryId)} allowClear clearLabel="Todas las categorías" />
        <SelectField label="Estado" placeholder="Todos" options={STATUS_OPTIONS} value={isActive} onChange={(event) => resetPage(setIsActive)(event.target.value)} />
        <SelectField label="Existencia" placeholder="Todas" options={STOCK_OPTIONS} value={stockStatus} onChange={(event) => resetPage(setStockStatus)(event.target.value)} />
      </FilterBar>

      <DataTable
        caption="Productos"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={stockStatus ? `No hay productos ${STOCK_OPTIONS.find((option) => option.value === stockStatus).empty}` : 'No hay productos con estos filtros'}
        emptyDescription={can.create && !stockStatus ? 'Crea uno con "Nuevo producto" o impórtalos desde Excel.' : undefined}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="productos" />

      {editing && (
        <ProductFormModal
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit, extra) => {
            setEditing(null)
            const inPurchase = extra?.purchaseGroupName ? ` y agregado a «${extra.purchaseGroupName}»` : ''
            toast.success(isEdit ? `${saved.name} actualizado${inPurchase}` : `${saved.name} creado con el código ${saved.code}${inPurchase}`)
            if (!isEdit) navigate(productPath(saved.id))
          }}
        />
      )}
    </>
  )
}
