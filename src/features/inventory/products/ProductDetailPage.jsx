import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Boxes,
  CalendarX2,
  FileBadge,
  FileWarning,
  History,
  Package,
  PackageX,
  Pencil,
  Plus,
  Power,
  RotateCw,
  Scale,
  ScrollText,
  Star,
  Stethoscope,
  TriangleAlert,
  Truck,
  Warehouse,
  PackagePlus,
} from 'lucide-react'
import { useGetMovementsQuery, useGetPriceHistoryQuery, useGetProductQuery, useSetPresentationActiveMutation, useSetProductActiveMutation } from '../inventoryApi'
import { EXPIRED_POLICY_OPTIONS } from '../inventoryOptions'

const expiredPolicyShort = (code) => EXPIRED_POLICY_OPTIONS.find((option) => option.value === code)?.short ?? '—'
import { useCan, useHasFeature } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { Tabs } from '../../../components/ui/Tabs/Tabs'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { formatCurrency, formatDateTime, formatPercent, formatQuantity } from '../../../utils/format'
import { ROUTES } from '../../../routes/paths'
import { ProductFormModal } from './ProductFormModal'
import { AnimalLotsTab, ReceiveAnimalLotModal } from './AnimalLots'
import { PresentationFormModal } from './PresentationFormModal'
import { InitialStockModal } from './InitialStockModal'
import { AdjustStockModal } from './AdjustStockModal'
import { BatchesTab } from './BatchesTab'
import { VeterinaryTab } from './VeterinaryTab'
import { DocumentsTab } from './DocumentsTab'
import '../../cash/cash.css'
import '../../purchases/purchases.css'
import '../../admin/admin.css'
import '../inventory.css'
import './ProductDetailPage.css'

function Stat({ label, value, detail, tone }) {
  return (
    <div className={`product-stat${tone ? ` product-stat--${tone}` : ''}`}>
      <p className="product-stat__label">{label}</p>
      <p className="product-stat__value">{value}</p>
      {detail && <p className="product-stat__detail">{detail}</p>}
    </div>
  )
}

/** Kárdex: movimientos del producto en la sucursal, del más reciente al más antiguo. */
function MovementsTab({ product, movements, onPageChange, canViewCost }) {
  const symbol = product.unit.symbol
  const columns = [
    { key: 'date', header: 'Fecha', primary: true, render: (row) => formatDateTime(row.createdAt) },
    { key: 'type', header: 'Movimiento', render: (row) => row.typeLabel },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (row) => (
        <span className={`numeric movement-quantity${row.quantity.startsWith('-') ? ' movement-quantity--out' : ' movement-quantity--in'}`}>
          {row.quantity.startsWith('-') ? '' : '+'}
          {formatQuantity(row.quantity)} {symbol}
        </span>
      ),
    },
    { key: 'balance', header: 'Saldo', render: (row) => <span className="numeric">{formatQuantity(row.balanceAfter)} {symbol}</span> },
    ...(canViewCost
      ? [
          { key: 'cost', header: 'Costo unit.', render: (row) => <span className="numeric">{formatCurrency(row.unitCost)}</span> },
          { key: 'average', header: 'Costo prom.', render: (row) => <span className="numeric">{formatCurrency(row.averageCostAfter)}</span> },
        ]
      : []),
    { key: 'notes', header: 'Detalle', render: (row) => row.notes || '—' },
    { key: 'user', header: 'Usuario', render: (row) => row.user?.fullName ?? '—' },
  ]
  return (
    <>
      <DataTable
        caption="Kárdex"
        columns={columns}
        rows={movements.data?.rows ?? []}
        isLoading={movements.isFetching}
        error={movements.error}
        onRetry={movements.refetch}
        emptyTitle="Sin movimientos"
        emptyDescription="La existencia cambia con la carga inicial, las compras, las ventas y los ajustes."
      />
      <Pagination meta={movements.data?.pagination} onPageChange={onPageChange} itemLabel="movimientos" />
    </>
  )
}

function PriceHistoryTab({ productId }) {
  const { data = [], isFetching, error, refetch } = useGetPriceHistoryQuery(productId)
  const columns = [
    { key: 'date', header: 'Fecha', primary: true, render: (row) => formatDateTime(row.createdAt) },
    { key: 'what', header: 'Precio de', render: (row) => row.presentation?.name ?? 'Unidad base' },
    { key: 'old', header: 'Anterior', render: (row) => (row.oldPrice ? formatCurrency(row.oldPrice) : 'Precio inicial') },
    {
      key: 'new',
      header: 'Nuevo',
      render: (row) => (
        <span className="stock-cell">
          <span className="numeric">{formatCurrency(row.newPrice)}</span>
          {row.belowCost && <Badge tone="danger">Bajo el costo</Badge>}
          {row.reason === 'bulk' && <Badge tone="info">Cambio en bloque</Badge>}
        </span>
      ),
    },
    { key: 'user', header: 'Cambiado por', render: (row) => row.user?.fullName ?? '—' },
  ]
  return <DataTable caption="Historial de precios" columns={columns} rows={data} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="Sin cambios de precio" />
}

/** Ficha completa de un producto: existencia, precios, presentaciones, proveedores, kárdex e historial. */
export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const can = {
    update: useCan('inventory.update'),
    deactivate: useCan('inventory.deactivate'),
    initialStock: useCan('inventory.initial_stock'),
    adjust: useCan('inventory.adjust'),
    viewCost: useCan('inventory.cost_view'),
    prices: useCan('inventory.prices'),
  }
  // Los lotes llegan con las compras (funcionalidad del plan 'purchases')
  const hasPurchases = useHasFeature('purchases')
  const [tab, setTab] = useState(null) // la primera pestaña depende del tipo de producto
  const [movementsPage, setMovementsPage] = useState(1)
  const [modal, setModal] = useState(null) // 'edit' | 'stock' | 'adjust' | { presentation }
  const [confirmToggle, setConfirmToggle] = useState(false)
  const { data: product, isLoading, error, refetch } = useGetProductQuery(id)
  const movements = useGetMovementsQuery({ productId: id, page: movementsPage, pageSize: 20 })
  const [setProductActive, productToggle] = useSetProductActiveMutation()
  const [setPresentationActive] = useSetPresentationActiveMutation()

  if (isLoading) {
    return (
      <div className="product-detail__state">
        <Spinner size="lg" label="Cargando el producto…" />
      </div>
    )
  }
  if (error || !product) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'El producto no existe' : 'No se pudo cargar el producto'} description={error?.message}>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(ROUTES.products)}>
          Volver a productos
        </Button>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const symbol = product.unit.symbol
  // Animal (D-ANI-1): se maneja por lotes con precio que sube cada día
  const isAnimal = product.productKind === 'animal'
  const activeTab = tab ?? (isAnimal ? 'animalLots' : 'presentations')
  const hasMovements = (movements.data?.pagination?.total ?? 0) > 0
  const canLoadStock = can.initialStock && product.isActive && movements.data && !hasMovements
  // Existencia en la presentación más grande que alcance: "10 × Bulto 40 kg"
  const pack = [...product.presentations].reverse().find((item) => item.isActive && item.stockWhole && item.stockWhole !== '0')
  const packStock = product.isOutOfStock ? 'Agotado' : pack ? `${pack.stockWhole} × ${pack.name}` : null

  const handleToggleProduct = async () => {
    try {
      const { message } = await setProductActive({ id: product.id, active: !product.isActive }).unwrap()
      // Al desactivar con existencias, el servidor avisa cuánto queda (D-INV-11)
      if (product.isActive && message && message !== 'Producto desactivado') toast.info(message)
      else toast.success(product.isActive ? `${product.name} fue desactivado` : `${product.name} fue activado`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setConfirmToggle(false)
  }

  const togglePresentation = async (presentation) => {
    try {
      await setPresentationActive({ productId: product.id, presentationId: presentation.id, active: !presentation.isActive }).unwrap()
      toast.success(presentation.isActive ? `${presentation.name} desactivada` : `${presentation.name} activada`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
  }

  const presentationColumns = [
    { key: 'name', header: 'Presentación', primary: true, render: (row) => <span className="entity-cell__name">{row.name}</span> },
    { key: 'factor', header: 'Contenido', render: (row) => <span className="numeric">{formatQuantity(row.factor)} {symbol}</span> },
    // Un empaque que no se vende completo solo sirve para comprar (D-INV-20)
    { key: 'price', header: 'Precio', render: (row) => (row.isSoldWhole === false ? <Badge tone="neutral">Solo compra · se vende por {symbol}</Badge> : <span className="numeric">{formatCurrency(row.salePrice)}</span>) },
    ...(can.viewCost
      ? [
          { key: 'purchase', header: 'Compra', render: (row) => <span className="numeric">{formatCurrency(row.purchasePrice)}</span> },
          {
            key: 'profit',
            header: 'Ganancia',
            render: (row) => (
              row.isSoldWhole === false ? (
                '—'
              ) : (
                <span className={`numeric${row.profit?.startsWith('-') ? ' margin--negative' : ''}`}>
                  {formatCurrency(row.profit)} {row.profitPercent !== null && <small>({formatPercent(row.profitPercent)})</small>}
                </span>
              )
            ),
          },
        ]
      : []),
    { key: 'barcode', header: 'Código de barras', render: (row) => <span className="entity-cell__code">{row.barcode ?? '—'}</span> },
    { key: 'status', header: 'Estado', render: (row) => <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Activa' : 'Inactiva'}</Badge> },
    ...(can.update
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            align: 'end',
            render: (row) => (
              <div className="row-actions">
                <IconButton icon={Pencil} label={`Editar ${row.name}`} onClick={() => setModal({ presentation: row })} />
                <IconButton icon={Power} tone={row.isActive ? 'danger' : 'success'} label={row.isActive ? `Desactivar ${row.name}` : `Activar ${row.name}`} onClick={() => togglePresentation(row)} />
              </div>
            ),
          },
        ]
      : []),
  ]

  const tabs = [
    ...(isAnimal ? [{ id: 'animalLots', label: 'Lotes', icon: PackagePlus }] : [{ id: 'presentations', label: 'Presentaciones', icon: Boxes, count: product.presentations.length }]),
    { id: 'suppliers', label: 'Proveedores', icon: Truck, count: product.suppliers.length },
    ...(product.tracksBatches && hasPurchases ? [{ id: 'batches', label: 'Lotes', icon: CalendarX2 }] : []),
    ...(product.isVeterinary || product.veterinaryInfo ? [{ id: 'vet', label: 'Ficha veterinaria', icon: Stethoscope }] : []),
    { id: 'documents', label: 'Documentos', icon: FileBadge },
    { id: 'movements', label: 'Kárdex', icon: ScrollText },
    { id: 'prices', label: 'Historial de precios', icon: History },
  ]

  return (
    <div className="product-detail">
      <button type="button" className="product-detail__back" onClick={() => navigate(ROUTES.products)}>
        <ArrowLeft aria-hidden="true" /> Productos
      </button>

      <header className="product-hero">
        <span className="product-hero__icon" aria-hidden="true">
          <Package />
        </span>
        <div className="product-hero__text">
          <h2 className="product-hero__name">{product.name}</h2>
          <p className="product-hero__meta">
            <span className="entity-cell__code">{product.code}</span>
            {product.category && <span>· {product.category.parent ? `${product.category.parent.name} › ` : ''}{product.category.name}</span>}
          </p>
          <div className="product-hero__badges">
            {!product.isActive && <Badge tone="neutral">Inactivo</Badge>}
            {product.isOutOfStock ? (
              <Badge tone="danger" icon={PackageX}>
                Agotado
              </Badge>
            ) : (
              product.isLowStock && (
                <Badge tone="warning" icon={TriangleAlert}>
                  Existencia baja
                </Badge>
              )
            )}
            <Badge tone="info">{product.taxRateLabel}</Badge>
            {product.tracksBatches && <Badge tone="accent">Maneja lotes</Badge>}
            {isAnimal && <Badge tone="accent">Animal · precio por lote</Badge>}
            {product.isVeterinary && (
              <Badge tone="info" icon={Stethoscope}>
                Veterinario
              </Badge>
            )}
            {product.veterinaryInfo?.requiresPrescription && (
              <Badge tone="warning" icon={FileWarning}>
                Requiere fórmula
              </Badge>
            )}
            <Badge tone="neutral">Vencidos: {expiredPolicyShort(product.effectiveExpiredSalePolicy)}</Badge>
          </div>
        </div>
        <div className="product-hero__actions">
          {isAnimal && can.initialStock && can.viewCost && product.isActive && (
            <Button variant="accent" icon={PackagePlus} onClick={() => setModal('receiveLot')}>
              Recibir lote
            </Button>
          )}
          {!isAnimal && canLoadStock && (
            <Button variant="accent" icon={Warehouse} onClick={() => setModal('stock')}>
              Existencia inicial
            </Button>
          )}
          {!isAnimal && can.adjust && product.isActive && (
            <Button variant="secondary" icon={Scale} onClick={() => setModal('adjust')}>
              Ajustar existencia
            </Button>
          )}
          {can.update && (
            <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
              Editar
            </Button>
          )}
          {can.deactivate && (
            <Button variant={product.isActive ? 'ghost' : 'secondary'} icon={Power} onClick={() => setConfirmToggle(true)}>
              {product.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          )}
        </div>
      </header>

      <section className="product-stats" aria-label="Resumen del producto">
        <Stat
          label="Existencia"
          value={`${formatQuantity(product.stock)} ${symbol}`}
          detail={[packStock, Number(product.minStock) > 0 ? `Mínimo ${formatQuantity(product.minStock)} ${symbol}` : 'Sin mínimo'].filter(Boolean).join(' · ')}
          tone={product.isOutOfStock ? 'danger' : product.isLowStock ? 'warning' : undefined}
        />
        {can.viewCost && !isAnimal && <Stat label="Precio de compra" value={formatCurrency(product.purchasePrice)} detail={`por ${symbol}`} />}
        {can.viewCost && isAnimal && <Stat label="Costo promedio" value={formatCurrency(product.averageCost)} detail="De los animales que hay" />}
        {isAnimal ? (
          <Stat label="Precio de venta" value="Por lote" detail="Sube cada día: mira la pestaña Lotes" />
        ) : (
          <Stat label="Precio de venta" value={formatCurrency(product.salePrice)} detail={`por ${symbol}`} />
        )}
        {can.viewCost && !isAnimal && (
          <>
            <Stat
              label={product.profit?.startsWith('-') ? 'Pérdida' : 'Ganancia'}
              value={formatCurrency(product.profit?.replace('-', ''))}
              detail={product.profitPercent !== null ? `${formatPercent(product.profitPercent)} sobre la compra` : 'Falta el precio de compra'}
              tone={product.profit?.startsWith('-') ? 'danger' : 'success'}
            />
            <Stat label="Costo promedio" value={formatCurrency(product.averageCost)} detail="Del inventario (utilidad real)" />
            <Stat label="Valor en inventario" value={formatCurrency(product.stockValue)} />
          </>
        )}
      </section>

      {product.description && <p className="product-detail__description">{product.description}</p>}

      <Tabs tabs={tabs} active={activeTab} onChange={setTab} label="Información del producto">
        {activeTab === 'animalLots' && <AnimalLotsTab product={product} can={can} onMessage={(message) => toast.success(message)} />}
        {activeTab === 'presentations' && (
          <>
            {can.update && product.isActive && (
              <div className="product-detail__tab-actions">
                <Button size="sm" icon={Plus} onClick={() => setModal({ presentation: null })}>
                  Nueva presentación
                </Button>
              </div>
            )}
            <DataTable
              caption="Presentaciones"
              columns={presentationColumns}
              rows={product.presentations}
              emptyTitle="Sin presentaciones"
              emptyDescription={`Se vende solo por ${product.unit.name.toLowerCase()}. Agrega bultos, cajas o galones con su propio precio.`}
            />
          </>
        )}
        {activeTab === 'suppliers' &&
          (product.suppliers.length === 0 ? (
            <StatusMessage icon={Truck} title="Sin proveedores" description={can.update ? 'Asócialos desde "Editar".' : undefined} />
          ) : (
            <ul className="product-suppliers">
              {product.suppliers.map((supplier) => (
                <li key={supplier.id} className={`product-suppliers__item${supplier.isPrimary ? ' product-suppliers__item--primary' : ''}`}>
                  <Truck aria-hidden="true" />
                  <span className="product-suppliers__name">
                    {supplier.tradeName || supplier.legalName}
                    {supplier.tradeName && <small>{supplier.legalName}</small>}
                  </span>
                  {supplier.isPrimary && (
                    <Badge tone="accent" icon={Star}>
                      Principal
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          ))}
        {activeTab === 'movements' && <MovementsTab product={product} movements={movements} onPageChange={setMovementsPage} canViewCost={can.viewCost} />}
        {activeTab === 'batches' && <BatchesTab product={product} canViewCost={can.viewCost} />}
        {activeTab === 'prices' && <PriceHistoryTab productId={product.id} />}
        {activeTab === 'vet' && <VeterinaryTab product={product} canEdit={can.update} />}
        {activeTab === 'documents' && <DocumentsTab product={product} canEdit={can.update} />}
      </Tabs>

      {modal === 'edit' && (
        <ProductFormModal
          product={product}
          onClose={() => setModal(null)}
          onSaved={(saved, isEdit, extra) => {
            setModal(null)
            toast.success(`${saved.name} actualizado${extra?.purchaseGroupName ? ` y agregado a «${extra.purchaseGroupName}»` : ''}`)
          }}
        />
      )}
      {modal === 'receiveLot' && (
        <ReceiveAnimalLotModal
          product={product}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            setTab('animalLots')
            toast.success(`Lote ${saved.lotNumber} recibido: ${formatQuantity(saved.receivedQuantity)} a ${formatCurrency(saved.priceToday)} hoy`)
          }}
        />
      )}
      {modal === 'stock' && (
        <InitialStockModal
          product={product}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            toast.success(`Existencia inicial registrada: ${formatQuantity(saved.stock)} ${symbol}`)
          }}
        />
      )}
      {modal === 'adjust' && (
        <AdjustStockModal
          product={product}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            toast.success(`Existencia ajustada: ahora hay ${formatQuantity(saved.stock)} ${symbol}`)
          }}
        />
      )}
      {modal && typeof modal === 'object' && (
        <PresentationFormModal
          product={product}
          presentation={modal.presentation}
          onClose={() => setModal(null)}
          onSaved={(saved, isEdit) => {
            setModal(null)
            toast.success(isEdit ? 'Presentación actualizada' : 'Presentación agregada')
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmToggle}
        tone={product.isActive ? 'danger' : 'primary'}
        title={product.isActive ? 'Desactivar producto' : 'Activar producto'}
        message={
          product.isActive
            ? Number(product.stock) > 0
              ? `${product.name} dejará de aparecer en el punto de venta. Todavía hay ${formatQuantity(product.stock)} ${symbol} en existencia: seguirán contando en el inventario hasta que se ajusten.`
              : `${product.name} dejará de aparecer en el punto de venta. Su historial se conserva.`
            : `${product.name} volverá a estar disponible.`
        }
        confirmLabel={product.isActive ? 'Desactivar' : 'Activar'}
        isLoading={productToggle.isLoading}
        onConfirm={handleToggleProduct}
        onCancel={() => setConfirmToggle(false)}
      />
    </div>
  )
}
