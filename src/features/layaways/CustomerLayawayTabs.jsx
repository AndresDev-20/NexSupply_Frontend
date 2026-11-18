import { Link } from 'react-router-dom'
import { useGetCustomerCreditQuery, useGetLayawaysQuery } from './layawaysApi'
import { dueText, layawayPath } from './layawayOptions'
import { LayawayStatus, PaidProgress } from './LayawaysPage'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'
import './layaways.css'

/** Apartados de un cliente (en curso primero). */
export function CustomerLayawaysTab({ customerId }) {
  const { data, isFetching, error, refetch } = useGetLayawaysQuery({ customerId, pageSize: 50 })
  const columns = [
    {
      key: 'number',
      header: 'Apartado',
      primary: true,
      render: (row) => (
        <Link className="purchase-link" to={layawayPath(row.id)}>
          {row.number}
        </Link>
      ),
    },
    { key: 'paid', header: 'Pagado', render: (row) => <PaidProgress layaway={row} /> },
    { key: 'due', header: 'Fecha límite', render: (row) => (row.status === 'active' ? `${formatDay(row.dueDate)} · ${dueText(row)}` : '—') },
    { key: 'status', header: 'Estado', render: (row) => <LayawayStatus layaway={row} /> },
  ]
  return <DataTable caption="Apartados del cliente" columns={columns} rows={data?.rows ?? []} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No tiene apartados" />
}

/** Saldo a favor del cliente y su historial (D-APA-4). */
export function CustomerCreditTab({ customerId }) {
  const { data, isLoading, error } = useGetCustomerCreditQuery(customerId)
  if (isLoading) return <Spinner label="Cargando el saldo a favor…" />
  if (error) return <Alert tone="danger">{error.message}</Alert>
  return (
    <>
      <Alert tone="success" title={`Saldo a favor: ${formatCurrency(data.balance)}`}>
        Se usa con la forma de pago «Saldo a favor» en el punto de venta o al recibir un abono. No es efectivo de la caja.
      </Alert>
      {data.movements.length === 0 ? (
        <p className="layaway-empty">Sin movimientos.</p>
      ) : (
        <ul className="credit-history">
          {data.movements.map((row) => (
            <li key={row.id}>
              <span className="cash-stack">
                <strong>{row.typeLabel}</strong>
                <span className="cash-stack__detail">
                  {formatDateTime(row.createdAt)}
                  {row.notes && ` · ${row.notes}`}
                </span>
              </span>
              <span className="cash-stack layaway-list__amount">
                <strong className={`numeric${Number(row.amount) > 0 ? ' credit-history__amount--in' : ''}`}>
                  {Number(row.amount) > 0 ? '+' : '−'}
                  {formatCurrency(row.amount.replace('-', ''))}
                </strong>
                <span className="cash-stack__detail">Queda {formatCurrency(row.balanceAfter)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
