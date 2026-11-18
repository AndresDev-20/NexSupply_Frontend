import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlarmClock, Archive, ArrowLeft, Ban, Cake, Gift, CalendarClock, Eye, HandCoins, IdCard, MapPin, MessageCircle, NotebookPen, Pencil, Phone, Power, ReceiptText, RotateCw, ScrollText, TriangleAlert, UserRound, Wallet } from 'lucide-react'
import {
  useCancelCustomerPaymentMutation,
  useCancelReceivableMutation,
  useGetCustomerPaymentsQuery,
  useGetCustomerQuery,
  useGetCustomerStatementQuery,
  useGetReceivableQuery,
  useGetReceivablesQuery,
  useSetCustomerActiveMutation,
} from './customersApi'
import { INSTALLMENT_STATUS, birthdayLabel, receivableState, reminderLink } from './customerOptions'
import { CustomerFormModal } from './CustomerFormModal'
import { DebtModal } from './DebtModal'
import { PaymentModal } from './PaymentModal'
import { PaymentReceiptModal } from './PaymentReceiptModal'
import { CustomerCreditTab, CustomerLayawaysTab } from '../layaways/CustomerLayawayTabs'
import { ReasonModal } from '../purchases/detail/PurchaseModals'
import { formatDay } from '../purchases/purchaseOptions'
import { useBusinessName } from '../settings/useBusinessName'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../components/ui/Button/Button'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Badge } from '../../components/ui/Badge/Badge'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { ROUTES } from '../../routes/paths'
import '../admin/admin.css'
import '../cash/cash.css'
import '../purchases/purchases.css'
import '../inventory/products/ProductDetailPage.css'
import './customers.css'

function Pill({ tone, children }) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

/** Una deuda con sus cuotas. */
function DebtCard({ receivable, canCancel, onCancel }) {
  const state = receivableState(receivable)
  const paidPercent = Number(receivable.total) > 0 ? Math.round((Number(receivable.amountPaid) / Number(receivable.total)) * 100) : 0
  return (
    <article className={`debt-card debt-card--${state.tone}`}>
      <header className="debt-card__head">
        <span className="debt-card__title">
          <strong>{receivable.number}</strong> · {receivable.description}
        </span>
        <Pill tone={state.tone}>{state.label}</Pill>
      </header>
      <p className="debt-card__meta">
        {receivable.originLabel} · {formatDay(receivable.issueDate)} · {receivable.paymentModeLabel}
        {receivable.exceededCreditLimit && ' · pasó el cupo'}
      </p>
      <div className="debt-card__figures">
        <span>
          Total <strong className="numeric">{formatCurrency(receivable.total)}</strong>
        </span>
        <span>
          Abonado <strong className="numeric">{formatCurrency(receivable.amountPaid)}</strong>
        </span>
        <span>
          Debe <strong className="numeric">{formatCurrency(receivable.balance)}</strong>
        </span>
      </div>
      <span className="count-progress debt-card__progress" role="progressbar" aria-label="Pagado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(paidPercent)} aria-valuetext={`${paidPercent} % pagado`}>
        <span className="count-progress__bar" style={{ width: `${paidPercent}%` }} />
      </span>
      {receivable.installments?.length > 0 && (
        <ol className="debt-card__installments">
          {receivable.installments.map((item) => {
            const status = INSTALLMENT_STATUS[item.status]
            return (
              <li key={item.id} className="debt-card__installment">
                <span>{receivable.paymentMode === 'free' ? 'Fecha límite' : `Cuota ${item.installmentNumber}`}</span>
                <span>{formatDay(item.dueDate)}</span>
                <span className="numeric">{formatCurrency(item.amount)}</span>
                <span className="numeric">{Number(item.pending) > 0 ? `Debe ${formatCurrency(item.pending)}` : '—'}</span>
                <Pill tone={status.tone}>{status.label}</Pill>
              </li>
            )
          })}
        </ol>
      )}
      {receivable.status === 'cancelled' && <p className="debt-card__meta">Anulada: {receivable.cancelReason}</p>}
      {canCancel && receivable.status === 'open' && Number(receivable.amountPaid) === 0 && receivable.originType === 'opening_balance' && (
        <div className="debt-card__actions">
          <Button size="sm" variant="ghost" icon={Ban} onClick={() => onCancel(receivable)}>
            Anular deuda
          </Button>
        </div>
      )}
    </article>
  )
}

/** Detalle de las deudas: se pide cada una con sus cuotas. */
function DebtsTab({ customerId, canCancel, onCancel }) {
  const [status, setStatus] = useState('open')
  const { data, isFetching, error, refetch } = useGetReceivablesQuery({ customerId, pageSize: 50, ...(status && { status }) })
  const rows = data?.rows ?? []
  return (
    <>
      <div className="segmented" role="tablist" aria-label="Estado de las deudas">
        {[
          { value: 'open', label: 'Por cobrar' },
          { value: 'paid', label: 'Pagadas' },
          { value: 'cancelled', label: 'Anuladas' },
        ].map((option) => (
          <button key={option.value} type="button" role="tab" aria-selected={status === option.value} className={`segmented__option${status === option.value ? ' segmented__option--active' : ''}`} onClick={() => setStatus(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      {isFetching && !data ? (
        <Spinner label="Cargando las deudas…" />
      ) : error ? (
        <StatusMessage icon={TriangleAlert} tone="danger" title="No se pudieron cargar las deudas" description={error.message}>
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        </StatusMessage>
      ) : rows.length === 0 ? (
        <StatusMessage icon={Wallet} title={status === 'open' ? 'No debe nada' : 'Sin deudas aquí'} />
      ) : (
        <div className="debt-list">
          {rows.map((row) => (
            <DebtCardLoader key={row.id} receivable={row} canCancel={canCancel} onCancel={onCancel} />
          ))}
        </div>
      )}
    </>
  )
}

// La lista no trae las cuotas: cada tarjeta las pide (pocas deudas por cliente)
function DebtCardLoader({ receivable, canCancel, onCancel }) {
  const { data } = useGetReceivableQuery(receivable.id)
  return <DebtCard receivable={data ?? receivable} canCancel={canCancel} onCancel={onCancel} />
}

function PaymentsTab({ customerId, canCancel, onView, onCancel }) {
  const { data, isFetching, error, refetch } = useGetCustomerPaymentsQuery({ customerId, pageSize: 50 })
  const columns = [
    { key: 'number', header: 'Abono', primary: true, render: (row) => <span className="cash-link__name">{row.number}</span> },
    { key: 'date', header: 'Fecha', render: (row) => formatDateTime(row.paidAt) },
    { key: 'method', header: 'Método', render: (row) => `${row.paymentMethod?.name ?? '—'}${row.cashSessionId ? ' · a la caja' : ''}` },
    { key: 'amount', header: 'Valor', align: 'end', render: (row) => <strong className={`numeric${row.status === 'cancelled' ? ' customer-strike' : ''}`}>{formatCurrency(row.amount)}</strong> },
    { key: 'status', header: 'Estado', render: (row) => (row.status === 'cancelled' ? <Pill tone="neutral">Anulado</Pill> : <Pill tone="success">Vigente</Pill>) },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) => (
        <div className="row-actions">
          <IconButton icon={ReceiptText} label={`Ver recibo ${row.number}`} onClick={() => onView(row)} />
          {canCancel && row.status === 'active' && <IconButton icon={Ban} tone="danger" label={`Anular ${row.number}`} onClick={() => onCancel(row)} />}
        </div>
      ),
    },
  ]
  return <DataTable caption="Abonos del cliente" columns={columns} rows={data?.rows ?? []} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="Sin abonos" />
}

function StatementTab({ customerId }) {
  const { data, isFetching, error, refetch } = useGetCustomerStatementQuery(customerId)
  const columns = [
    { key: 'date', header: 'Fecha', primary: true, render: (row) => formatDay(row.date) },
    { key: 'number', header: 'Documento', render: (row) => row.number },
    // Fase 19: lo que debe el cliente es del negocio; si hay movimientos de varias sucursales, se dice en cuál fue cada uno
    ...(new Set((data?.entries ?? []).map((row) => row.branchName)).size > 1 ? [{ key: 'branch', header: 'Sucursal', render: (row) => row.branchName ?? '—' }] : []),
    { key: 'description', header: 'Detalle', render: (row) => (row.cancelled ? <span className="customer-strike">{row.description} (anulado)</span> : row.description) },
    { key: 'charge', header: 'Cargo', align: 'end', render: (row) => (row.kind === 'charge' ? <span className={`numeric${row.cancelled ? ' customer-strike' : ''}`}>{formatCurrency(row.amount)}</span> : '') },
    { key: 'payment', header: 'Abono', align: 'end', render: (row) => (row.kind === 'payment' ? <span className={`numeric${row.cancelled ? ' customer-strike' : ''}`}>{formatCurrency(row.amount)}</span> : '') },
    { key: 'balance', header: 'Saldo', align: 'end', render: (row) => <strong className="numeric">{formatCurrency(row.balanceAfter)}</strong> },
  ]
  return <DataTable caption="Estado de cuenta" columns={columns} rows={data?.entries ?? []} getRowId={(row) => `${row.kind}-${row.id}`} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="Sin movimientos" />
}

/** Ficha del cliente: datos, lo que debe, cuotas, abonos y estado de cuenta (D-CLI-1 a D-CLI-8). */
export default function CustomerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const businessName = useBusinessName()
  const can = {
    manage: useCan('customers.manage'),
    viewDebt: useCan('receivables.view'),
    createDebt: useCan('receivables.create'),
    collect: useCan('receivables.collect'),
    cancelPayment: useCan('receivables.cancel_payment'),
    viewLayaways: useCan('layaways.view'),
  }
  const [tab, setTab] = useState('debts')
  const [modal, setModal] = useState(null) // 'edit' | 'debt' | 'payment' | 'toggle' | { receipt } | { cancelDebt } | { cancelPayment }
  const { data: customer, isLoading, error, refetch } = useGetCustomerQuery(id)
  const [setActive, toggleState] = useSetCustomerActiveMutation()
  const [cancelReceivable, cancelDebtState] = useCancelReceivableMutation()
  const [cancelPayment, cancelPaymentState] = useCancelCustomerPaymentMutation()

  if (isLoading) {
    return (
      <div className="product-detail__state">
        <Spinner size="lg" label="Cargando el cliente…" />
      </div>
    )
  }
  if (error || !customer) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'El cliente no existe' : 'No se pudo cargar el cliente'} description={error?.message}>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(ROUTES.customers)}>
          Volver a clientes
        </Button>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const hasDebt = Number(customer.balance) > 0
  // Saldo a favor (D-APA-4): nace al cancelar un apartado
  const hasCredit = Number(customer.creditBalance) > 0
  const birthday = birthdayLabel(customer)
  const whatsapp = hasDebt ? reminderLink({ customer, businessName, balance: customer.balance, overdueBalance: customer.overdueBalance, nextDue: null }) : null

  const handleToggle = async () => {
    try {
      await setActive({ id: customer.id, active: !customer.isActive }).unwrap()
      toast.success(customer.isActive ? `${customer.name} fue desactivado` : `${customer.name} fue activado`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setModal(null)
  }

  const handleCancelDebt = async (reason) => {
    try {
      const result = await cancelReceivable({ id: modal.cancelDebt.id, reason }).unwrap()
      toast.success(`Deuda ${result.number} anulada`)
      setModal(null)
    } catch {
      // Se muestra en el modal
    }
  }

  const handleCancelPayment = async (reason) => {
    try {
      const result = await cancelPayment({ id: modal.cancelPayment.id, reason }).unwrap()
      toast.success(`Abono ${result.number} anulado`)
      setModal(null)
    } catch {
      // Se muestra en el modal
    }
  }

  const tabs = [
    { id: 'debts', label: 'Deudas', icon: Wallet, count: customer.openReceivables || undefined },
    { id: 'payments', label: 'Abonos', icon: HandCoins },
    { id: 'statement', label: 'Estado de cuenta', icon: ScrollText },
    ...(can.viewLayaways ? [{ id: 'layaways', label: 'Apartados', icon: Archive }] : []),
    ...(hasCredit ? [{ id: 'credit', label: 'Saldo a favor', icon: Gift }] : []),
  ]

  return (
    <div className="product-detail">
      <button type="button" className="product-detail__back" onClick={() => navigate(ROUTES.customers)}>
        <ArrowLeft aria-hidden="true" /> Clientes
      </button>

      <header className="product-hero">
        <span className="product-hero__icon" aria-hidden="true">
          <UserRound />
        </span>
        <div className="product-hero__text">
          <h2 className="product-hero__name">{customer.name}</h2>
          <p className="product-hero__meta">
            {customer.phone && (
              <span className="customer-meta">
                <Phone aria-hidden="true" /> {customer.phone}
              </span>
            )}
            {customer.documentNumber && (
              <span className="customer-meta">
                <IdCard aria-hidden="true" /> {customer.documentType} {customer.documentNumber}
              </span>
            )}
            {customer.location && (
              <span className="customer-meta">
                <MapPin aria-hidden="true" /> {customer.location}
              </span>
            )}
            {customer.age !== null && (
              <span className="customer-meta">
                <Cake aria-hidden="true" /> {customer.age} años · {formatDay(customer.birthDate)}
              </span>
            )}
          </p>
          <div className="product-hero__badges">
            {!customer.isActive && <Badge tone="neutral">Inactivo</Badge>}
            {birthday && (
              <Badge tone="accent" icon={Cake}>
                {birthday}
              </Badge>
            )}
            {hasCredit && (
              <Badge tone="success" icon={Gift}>
                Saldo a favor {formatCurrency(customer.creditBalance)}
              </Badge>
            )}
            {customer.isOverCreditLimit && (
              <Badge tone="warning" icon={TriangleAlert}>
                Pasó el cupo
              </Badge>
            )}
            {!customer.phone && <Badge tone="neutral">Sin celular: no se le puede fiar</Badge>}
          </div>
        </div>
        <div className="product-hero__actions">
          {can.collect && hasDebt && (
            <Button variant="accent" icon={HandCoins} onClick={() => setModal('payment')}>
              Recibir abono
            </Button>
          )}
          {can.createDebt && customer.isActive && (
            <Button variant="secondary" icon={NotebookPen} onClick={() => setModal('debt')} disabled={!customer.phone} title={customer.phone ? undefined : 'Agrega el celular para poder fiarle'}>
              Registrar deuda
            </Button>
          )}
          {whatsapp && (
            <a className="button button--secondary button--md" href={whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle className="button__icon" aria-hidden="true" />
              <span className="button__label">Recordar por WhatsApp</span>
            </a>
          )}
          {can.manage && (
            <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
              Editar
            </Button>
          )}
          {can.manage && (
            <Button variant="ghost" icon={Power} onClick={() => setModal('toggle')}>
              {customer.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          )}
        </div>
      </header>

      {can.viewDebt && (
        <section className="cash-tiles cash-tiles--four" aria-label="Cuenta del cliente">
          <div className={`cash-tile cash-tile--${hasDebt ? 'info' : 'success'}`}>
            <Wallet aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(customer.balance)}</span>
            <span className="cash-tile__label">Debe</span>
          </div>
          <div className={`cash-tile cash-tile--${Number(customer.overdueBalance) > 0 ? 'danger' : 'success'}`}>
            <AlarmClock aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(customer.overdueBalance)}</span>
            <span className="cash-tile__label">Vencido</span>
          </div>
          <div className="cash-tile cash-tile--accent">
            <CalendarClock aria-hidden="true" />
            <span className="cash-tile__value">{customer.openReceivables}</span>
            <span className="cash-tile__label">Deudas abiertas</span>
          </div>
          <div className={`cash-tile cash-tile--${customer.isOverCreditLimit ? 'warning' : 'info'}`}>
            <Eye aria-hidden="true" />
            <span className="cash-tile__value">{customer.creditLimit === null ? 'Sin cupo' : formatCurrency(customer.availableCredit)}</span>
            <span className="cash-tile__label">{customer.creditLimit === null ? 'Cupo' : `Disponible de ${formatCurrency(customer.creditLimit)}`}</span>
          </div>
        </section>
      )}

      {customer.notes && <p className="product-detail__description">{customer.notes}</p>}

      {can.viewDebt && (
        <Tabs tabs={tabs} active={tab} onChange={setTab} label="Cuenta del cliente">
          {tab === 'debts' && <DebtsTab customerId={customer.id} canCancel={can.createDebt} onCancel={(receivable) => setModal({ cancelDebt: receivable })} />}
          {tab === 'payments' && <PaymentsTab customerId={customer.id} canCancel={can.cancelPayment} onView={(payment) => setModal({ receipt: payment })} onCancel={(payment) => setModal({ cancelPayment: payment })} />}
          {tab === 'statement' && <StatementTab customerId={customer.id} />}
          {tab === 'layaways' && <CustomerLayawaysTab customerId={customer.id} />}
          {tab === 'credit' && <CustomerCreditTab customerId={customer.id} />}
        </Tabs>
      )}

      {modal === 'edit' && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            toast.success(`${saved.name} actualizado`)
          }}
        />
      )}
      {modal === 'debt' && (
        <DebtModal
          customer={customer}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            setTab('debts')
            if (saved.creditWarning) toast.info(`Deuda ${saved.number} registrada. Ojo: ${saved.creditWarning}`)
            else toast.success(`Deuda ${saved.number} registrada`)
          }}
        />
      )}
      {modal === 'payment' && (
        <PaymentModal
          customer={customer}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            toast.success(`Abono ${saved.number} registrado`)
            setModal({ receipt: saved })
          }}
        />
      )}
      {modal?.receipt && <PaymentReceiptModal payment={modal.receipt} onClose={() => setModal(null)} />}
      {modal?.cancelDebt && (
        <ReasonModal
          title={`Anular la deuda ${modal.cancelDebt.number}`}
          description="Solo se anulan deudas sin abonos. Queda el registro de quién la anuló y por qué."
          confirmLabel="Anular deuda"
          placeholder="Ej.: el valor se escribió mal"
          isLoading={cancelDebtState.isLoading}
          error={cancelDebtState.error}
          onClose={() => setModal(null)}
          onConfirm={handleCancelDebt}
        />
      )}
      {modal?.cancelPayment && (
        <ReasonModal
          title={`Anular el abono ${modal.cancelPayment.number}`}
          description={`${formatCurrency(modal.cancelPayment.amount)} vuelven a quedar como deuda.${modal.cancelPayment.cashSessionId ? ' El efectivo sale del mismo turno de caja, que debe seguir abierto.' : ''}`}
          confirmLabel="Anular abono"
          placeholder="Ej.: se registró dos veces"
          isLoading={cancelPaymentState.isLoading}
          error={cancelPaymentState.error}
          onClose={() => setModal(null)}
          onConfirm={handleCancelPayment}
        />
      )}
      <ConfirmDialog
        isOpen={modal === 'toggle'}
        tone={customer.isActive ? 'danger' : 'primary'}
        title={customer.isActive ? 'Desactivar cliente' : 'Activar cliente'}
        message={customer.isActive ? `${customer.name} dejará de aparecer en la lista de clientes activos. ${hasDebt ? `Su deuda de ${formatCurrency(customer.balance)} se conserva.` : 'Su historial se conserva.'}` : `${customer.name} volverá a estar disponible.`}
        confirmLabel={customer.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
