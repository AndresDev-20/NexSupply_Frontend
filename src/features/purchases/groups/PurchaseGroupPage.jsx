import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, FileText, Layers, Package, PackagePlus, RotateCw, Truck, TriangleAlert, Wallet } from 'lucide-react'
import { useGetPurchaseGroupQuery } from '../purchasesApi'
import { purchaseState, supplierName } from '../purchaseOptions'
import { useCan } from '../../../hooks/usePermissions'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { previewMultiply } from '../../../utils/moneyPreview'
import { ROUTES, purchasePath } from '../../../routes/paths'
import '../../cash/cash.css'
import '../purchases.css'

/** Cantidad de una línea: "20 × Bulto 40 kg" o "50 kg". */
function quantityText(item) {
  return item.presentation ? `${formatQuantity(item.quantity)} × ${item.presentation.name}` : `${formatQuantity(item.quantity)} ${item.unitSymbol ?? ''}`.trim()
}

/** Valor de una línea: el que calcula el servidor o, si falta, cantidad × precio (solo vista previa). */
const lineValue = (item) => item.netAmount ?? previewMultiply(item.unitPrice, item.quantity)

/**
 * /compras/grupos/:id — Una compra con varios proveedores (D-COMP-9). Muestra cada proveedor
 * con sus productos y el total de todo. Los productos se agregan desde Nuevo producto
 * («¿A qué compra va?»); cada proveedor se revisa y se confirma como una compra de siempre.
 */
export default function PurchaseGroupPage() {
  const { id } = useParams()
  const canCreateProducts = useCan('inventory.create')
  const canEditPurchases = useCan('purchases.create')
  const { data: group, isLoading, error, refetch } = useGetPurchaseGroupQuery(id)

  if (isLoading) {
    return (
      <div className="cash-page__state">
        <Spinner size="lg" label="Cargando la compra…" />
      </div>
    )
  }
  if (error || !group) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'La compra no existe' : 'No se pudo cargar la compra'} description={error?.message}>
        <Link className="button button--secondary button--md" to={ROUTES.purchases}>
          <ArrowLeft className="button__icon" aria-hidden="true" />
          <span className="button__label">Volver a compras</span>
        </Link>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const tone = group.isOpen ? 'info' : 'success'
  return (
    <div className="purchase-detail">
      <Link className="cash-session__back" to={ROUTES.purchases}>
        <ArrowLeft aria-hidden="true" /> Compras
      </Link>

      <header className={`cash-session__header cash-session__header--${tone}`}>
        <span className="cash-session__icon" aria-hidden="true">
          <Layers />
        </span>
        <div className="cash-session__title">
          <h2>{group.name}</h2>
          <p>
            {group.suppliersCount} {group.suppliersCount === 1 ? 'proveedor' : 'proveedores'} · {group.productsCount} {group.productsCount === 1 ? 'producto' : 'productos'}
            {group.createdBy ? ` · creada por ${group.createdBy.fullName}` : ''}
          </p>
        </div>
        <span className={`status-pill status-pill--${group.isOpen ? 'info' : 'success'}`}>
          <span className="status-pill__dot" aria-hidden="true" />
          {group.isOpen ? 'Abierta' : 'Confirmada'}
        </span>
      </header>

      <section className="cash-tiles" aria-label="Total de la compra">
        <div className="cash-tile cash-tile--info">
          <Wallet aria-hidden="true" />
          <span className="cash-tile__value">{formatCurrency(group.total)}</span>
          <span className="cash-tile__label">Total de la compra</span>
        </div>
        <div className="cash-tile cash-tile--accent">
          <Truck aria-hidden="true" />
          <span className="cash-tile__value">{group.suppliersCount}</span>
          <span className="cash-tile__label">Proveedores</span>
        </div>
        <div className="cash-tile cash-tile--success">
          <Package aria-hidden="true" />
          <span className="cash-tile__value">{group.productsCount}</span>
          <span className="cash-tile__label">Productos</span>
        </div>
      </section>

      {group.isOpen && (
        <div className="purchase-group__how">
          <PackagePlus aria-hidden="true" />
          <p>
            Para agregar productos ve a <strong>Inventario → Productos → Nuevo producto</strong> y, en el último paso, escoge esta compra en <strong>«¿A qué compra va?»</strong>. Cada producto entra con su proveedor. Las unidades llegan al inventario cuando confirmas la parte de ese proveedor.
          </p>
          {canCreateProducts && (
            <Link className="button button--secondary button--sm" to={ROUTES.products}>
              <span className="button__label">Ir a productos</span>
            </Link>
          )}
        </div>
      )}

      {group.parts.length === 0 ? (
        <section className="cash-panel">
          <p className="cash-panel__empty">Todavía no tiene productos.</p>
        </section>
      ) : (
        group.parts.map((part) => {
          const state = purchaseState(part)
          const isDraft = part.status === 'draft'
          return (
            <section key={part.id} className="cash-panel purchase-group__part" aria-label={`Compra a ${supplierName(part.supplier)}`}>
              <header className="purchase-group__part-head">
                <h3 className="cash-panel__title">
                  <Truck aria-hidden="true" />
                  {supplierName(part.supplier)}
                  {part.number && <span className="cash-session__number">{part.number}</span>}
                </h3>
                <span className={`status-pill status-pill--${state.tone}`}>
                  <span className="status-pill__dot" aria-hidden="true" />
                  {state.label}
                </span>
                <strong className="purchase-group__part-total">{formatCurrency(part.total)}</strong>
              </header>
              <ul className="purchase-group__items">
                {part.items.map((item) => (
                  <li key={item.id}>
                    <span className="purchase-group__item-name">{item.productName}</span>
                    <span className="purchase-group__item-qty">{quantityText(item)}</span>
                    <span className="purchase-group__item-value">{formatCurrency(lineValue(item))}</span>
                  </li>
                ))}
              </ul>
              <div className="purchase-group__part-actions">
                {isDraft && canEditPurchases ? (
                  <Link className="button button--primary button--sm" to={purchasePath(part.id)}>
                    <FileText className="button__icon" aria-hidden="true" />
                    <span className="button__label">Revisar y confirmar</span>
                  </Link>
                ) : (
                  <Link className="button button--ghost button--sm" to={purchasePath(part.id)}>
                    <Eye className="button__icon" aria-hidden="true" />
                    <span className="button__label">Ver la compra</span>
                  </Link>
                )}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
