import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Eye, HandCoins, Receipt, TriangleAlert, Truck, Users } from 'lucide-react'
import { useGetPayablesSummaryQuery, useGetPurchasesQuery, useGetSupplierAccountQuery } from '../purchasesApi'
import { formatDay, purchaseState, supplierName } from '../purchaseOptions'
import { PaymentModal } from '../detail/PurchaseModals'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { purchasePath } from '../../../routes/paths'
import '../../cash/cash.css'
import '../purchases.css'

/** Estado de cuenta de un proveedor: compras con su saldo y los pagos. */
function SupplierAccountModal({ supplier, onClose }) {
  const { data, isLoading } = useGetSupplierAccountQuery(supplier.id)
  return (
    <Modal isOpen onClose={onClose} size="xl" icon={Truck} title={`Estado de cuenta · ${supplierName(supplier)}`} description={data ? `Plazo de pago: ${data.supplier.paymentTermDays > 0 ? `${data.supplier.paymentTermDays} días` : 'contado'}` : undefined}>
      {isLoading || !data ? (
        <Spinner label="Cargando el estado de cuenta…" />
      ) : (
        <div className="account">
          <dl className="account__totals">
            <div>
              <dt>Comprado</dt>
              <dd>{formatCurrency(data.totals.purchased)}</dd>
            </div>
            <div>
              <dt>Pagado</dt>
              <dd className="cash-amount--in">{formatCurrency(data.totals.paid)}</dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd className="account__balance">{formatCurrency(data.totals.balance)}</dd>
            </div>
          </dl>
          <DataTable
            caption="Compras del proveedor"
            columns={[
              { key: 'number', header: 'Compra', primary: true, render: (row) => <Link className="purchase-link cash-link__name" to={purchasePath(row.id)}>{row.number}</Link> },
              { key: 'date', header: 'Fecha', render: (row) => formatDay(row.invoiceDate) },
              { key: 'due', header: 'Vence', render: (row) => (Number(row.balance) > 0 ? formatDay(row.dueDate) : '—') },
              { key: 'total', header: 'Total', align: 'end', render: (row) => formatCurrency(row.payableTotal) },
              { key: 'balance', header: 'Saldo', align: 'end', render: (row) => (row.status === 'cancelled' ? 'Anulada' : formatCurrency(row.balance)) },
            ]}
            rows={data.purchases}
            emptyTitle="Sin compras"
          />
          <h4 className="account__subtitle">Pagos</h4>
          {data.payments.length === 0 ? (
            <p className="cash-panel__empty">Sin pagos.</p>
          ) : (
            <ul className="payment-list">
              {data.payments.map((payment) => (
                <li key={payment.id} className={`payment-list__item${payment.status === 'cancelled' ? ' payment-list__item--cancelled' : ''}`}>
                  <span className="payment-list__text">
                    <span className="payment-list__amount">{formatCurrency(payment.amount)}</span>
                    <span className="payment-list__detail">
                      {payment.paymentMethod?.name} · {formatDateTime(payment.paidAt)}
                      {payment.status === 'cancelled' && ' · anulado'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

/**
 * Cuentas por pagar (D25, D-COMP-7): cuánto se le debe a cada proveedor, lo vencido y las
 * compras pendientes, con el botón para abonar.
 */
export default function PayablesPage() {
  const toast = useToast()
  const canPay = useCan('payables.pay')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [page, setPage] = useState(1)
  const [account, setAccount] = useState(null)
  const [paying, setPaying] = useState(null)
  const { data: summary, isLoading } = useGetPayablesSummaryQuery()
  const { data, isFetching, error, refetch } = useGetPurchasesQuery({ paymentStatus: onlyOverdue ? 'overdue' : 'pending', page, pageSize: 20 })
  const maxBalance = (summary?.suppliers ?? []).reduce((top, item) => (Number(item.balance) > top ? Number(item.balance) : top), 0)

  const columns = [
    {
      key: 'number',
      header: 'Compra',
      primary: true,
      render: (row) => (
        <Link className="purchase-link" to={purchasePath(row.id)}>
          <span className="cash-link__name">{row.number}</span>
          <span className="cash-stack__detail">{supplierName(row.supplier)}</span>
        </Link>
      ),
    },
    { key: 'date', header: 'Fecha', render: (row) => formatDay(row.invoiceDate) },
    { key: 'due', header: 'Vence', render: (row) => formatDay(row.dueDate) },
    { key: 'total', header: 'Total', align: 'end', render: (row) => formatCurrency(row.payableTotal) },
    { key: 'balance', header: 'Saldo', align: 'end', render: (row) => <strong className="purchase-balance">{formatCurrency(row.balance)}</strong> },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const state = purchaseState(row)
        return (
          <span className={`status-pill status-pill--${state.tone}`}>
            <span className="status-pill__dot" aria-hidden="true" />
            {state.label}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) => (
        <div className="row-actions">
          {canPay && (
            <Button size="sm" icon={HandCoins} onClick={() => setPaying(row)}>
              Pagar
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader description="Lo que se le debe a cada proveedor por compras a crédito, lo vencido y lo que vence pronto." />

      {isLoading ? (
        <div className="cash-page__state">
          <Spinner size="lg" label="Cargando cuentas por pagar…" />
        </div>
      ) : (
        <>
          <section className="cash-tiles" aria-label="Totales por pagar">
            <div className="cash-tile cash-tile--warning">
              <HandCoins aria-hidden="true" />
              <span className="cash-tile__value">{formatCurrency(summary?.totals.balance)}</span>
              <span className="cash-tile__label">Por pagar</span>
            </div>
            <div className={`cash-tile cash-tile--${Number(summary?.totals.overdue) > 0 ? 'danger' : 'success'}`}>
              <TriangleAlert aria-hidden="true" />
              <span className="cash-tile__value">{formatCurrency(summary?.totals.overdue)}</span>
              <span className="cash-tile__label">Vencido</span>
            </div>
            <div className="cash-tile cash-tile--info">
              <Users aria-hidden="true" />
              <span className="cash-tile__value">{summary?.totals.suppliers ?? 0}</span>
              <span className="cash-tile__label">Proveedores con saldo</span>
            </div>
          </section>

          {summary?.suppliers.length ? (
            <ul className="supplier-debts" aria-label="Saldo por proveedor">
              {summary.suppliers.map((item, index) => (
                <li key={item.supplier.id} className={`supplier-debt${Number(item.overdue) > 0 ? ' supplier-debt--overdue' : ''}`} style={{ '--delay': `${index * 60}ms` }}>
                  <div className="supplier-debt__head">
                    <span className="supplier-debt__icon" aria-hidden="true">
                      <Truck />
                    </span>
                    <span className="supplier-debt__text">
                      <span className="supplier-debt__name">{supplierName(item.supplier)}</span>
                      <span className="supplier-debt__meta">
                        {item.purchases} {item.purchases === 1 ? 'compra' : 'compras'} · próximo vencimiento {formatDay(item.nextDueDate)}
                      </span>
                    </span>
                    <IconButton icon={Eye} label={`Estado de cuenta de ${supplierName(item.supplier)}`} onClick={() => setAccount(item.supplier)} />
                  </div>
                  <span className="supplier-debt__balance">{formatCurrency(item.balance)}</span>
                  <div className="history-row__bar" aria-hidden="true">
                    <span style={{ width: `${maxBalance > 0 ? Math.max(4, Math.round((Number(item.balance) / maxBalance) * 100)) : 0}%`, '--delay': `${index * 60}ms` }} />
                  </div>
                  {Number(item.overdue) > 0 && (
                    <span className="supplier-debt__overdue">
                      <CalendarClock aria-hidden="true" /> Vencido {formatCurrency(item.overdue)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <StatusMessage icon={Receipt} title="No le debes nada a ningún proveedor" description="Las compras a crédito aparecen aquí hasta que se pagan." />
          )}
        </>
      )}

      <div className="segmented" role="tablist" aria-label="Compras por pagar">
        {[
          { value: false, label: 'Por pagar' },
          { value: true, label: 'Vencidas' },
        ].map((tab) => (
          <button
            key={String(tab.value)}
            type="button"
            role="tab"
            aria-selected={onlyOverdue === tab.value}
            className={`segmented__option${onlyOverdue === tab.value ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setOnlyOverdue(tab.value)
              setPage(1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        caption="Compras por pagar"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={onlyOverdue ? 'No hay compras vencidas' : 'No hay compras por pagar'}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="compras" />

      {account && <SupplierAccountModal supplier={account} onClose={() => setAccount(null)} />}
      {paying && (
        <PaymentModal
          purchase={paying}
          onClose={() => setPaying(null)}
          onSaved={(saved, amount) => {
            setPaying(null)
            toast.success(`Pago de ${formatCurrency(amount)} registrado${Number(saved.balance) > 0 ? `. Quedan ${formatCurrency(saved.balance)}` : '. Compra pagada'}`)
          }}
        />
      )}
    </>
  )
}
