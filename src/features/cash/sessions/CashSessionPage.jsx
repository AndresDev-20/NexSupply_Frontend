import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Banknote, CircleCheck, CreditCard, HandCoins, Lock, Power, Printer, RotateCw, TriangleAlert } from 'lucide-react'
import { useGetCashMovementsQuery, useGetCashSessionQuery } from '../cashApi'
import { differenceInfo, sessionState } from '../cashOptions'
import { Lifecycle } from '../Lifecycle'
import { OpeningCountModal } from '../OpeningCountModal'
import { CashMovementModal } from './CashMovementModal'
import { SessionActionDialogs } from './SessionActions'
import { useSessionPermissions } from '../useSessionPermissions'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { Button } from '../../../components/ui/Button/Button'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { ROUTES } from '../../../routes/paths'
import '../cash.css'

function Figure({ label, value, detail, tone, strong = false, index = 0 }) {
  return (
    <div className={`cash-figure${tone ? ` cash-figure--${tone}` : ''}${strong ? ' cash-figure--strong' : ''}`} style={{ '--delay': `${index * 60}ms` }}>
      <p className="cash-figure__label">{label}</p>
      <p className="cash-figure__value">{value}</p>
      {detail && <p className="cash-figure__detail">{detail}</p>}
    </div>
  )
}

/** Monto con signo y color: entra (+) o sale (−). */
function SignedAmount({ value }) {
  const negative = String(value).startsWith('-')
  return <span className={`cash-amount cash-amount--${negative ? 'out' : 'in'}`}>{`${negative ? '−' : '+'} ${formatCurrency(negative ? String(value).slice(1) : value)}`}</span>
}

const MOVEMENT_COLUMNS = [
  { key: 'date', header: 'Fecha', primary: true, render: (row) => formatDateTime(row.createdAt) },
  { key: 'type', header: 'Movimiento', render: (row) => row.typeLabel },
  {
    key: 'method',
    header: 'Medio',
    render: (row) => (
      <span className="cash-stack">
        <span>{row.paymentMethod?.name ?? '—'}</span>
        {!row.isCash && <span className="cash-stack__detail">No entra al cajón</span>}
      </span>
    ),
  },
  { key: 'amount', header: 'Monto', align: 'end', render: (row) => <SignedAmount value={row.amount} /> },
  { key: 'reason', header: 'Motivo o referencia', render: (row) => row.reason || row.paymentReference || '—' },
  { key: 'user', header: 'Registró', render: (row) => row.user?.fullName ?? 'Sistema' },
]

/**
 * Un turno: su avance (abierto → cerrado → contado → recibido), el efectivo, los medios de
 * pago y los movimientos, con las acciones que tocan. Contado, muestra su arqueo imprimible.
 */
export default function CashSessionPage() {
  const { id } = useParams()
  const toast = useToast()
  const canMove = useCan('cash.movements')
  const canOpen = useCan('cash.open')
  const perms = useSessionPermissions()
  const [page, setPage] = useState(1)
  const { data: session, isLoading, error, refetch } = useGetCashSessionQuery(id)
  const movements = useGetCashMovementsQuery({ sessionId: id, page, pageSize: 20 })
  const [dialog, setDialog] = useState(null) // 'deposit' | 'withdrawal' | 'confirm'
  const [action, setAction] = useState(null)

  if (isLoading) {
    return (
      <div className="cash-page__state">
        <Spinner size="lg" label="Cargando el turno…" />
      </div>
    )
  }
  if (error || !session) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'El turno no existe' : 'No se pudo cargar el turno'} description={error?.message}>
        <Link className="button button--secondary button--md" to={ROUTES.cashSessions}>
          <ArrowLeft className="button__icon" aria-hidden="true" />
          <span className="button__label">Volver a los turnos</span>
        </Link>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const state = sessionState(session)
  const isCounted = session.status === 'counted' || session.status === 'received'
  const isOpen = session.status === 'open'
  const summary = session.summary
  const diff = isCounted ? differenceInfo(session.difference) : null
  // Turno ajeno que este usuario no puede cerrar ni contar: se explica por qué no ve los botones
  const blockedByOwner = !isCounted && !perms.isMine(session) && !perms.canCount(session)

  return (
    <div className="cash-session">
      <Link className="cash-session__back no-print" to={ROUTES.cashSessions}>
        <ArrowLeft aria-hidden="true" /> Turnos
      </Link>

      <header className={`cash-session__header cash-session__header--${state.tone}`}>
        <span className={`cash-session__icon${state.key === 'open' ? ' register-card__icon--live' : ''}`} aria-hidden="true">
          <Banknote />
        </span>
        <div className="cash-session__title">
          <h2>
            {session.register?.name ?? 'Caja'}
            {session.closingNumber && <span className="cash-session__number">{session.closingNumber}</span>}
          </h2>
          <p>
            Abierta el {formatDateTime(session.openedAt)} por {session.openedBy?.fullName ?? 'el sistema'}
            {session.cutAt && ` · Cerrada el ${formatDateTime(session.cutAt)}${session.autoCut ? ' (sola, a la hora de cierre)' : ''}`}
          </p>
        </div>
        <span className={`status-pill status-pill--${state.tone}`}>
          <span className="status-pill__dot" aria-hidden="true" />
          {state.label}
        </span>
        <div className="cash-session__lifecycle">
          <Lifecycle status={session.status} />
        </div>
      </header>

      {/* ---------- Avisos ---------- */}
      {session.needsOpeningConfirmation && isOpen && (
        <div className="cash-session__notice">
          <Alert tone="warning">El sistema abrió esta caja según su horario. Cuenta el efectivo y confirma la base para quedar como responsable del turno.</Alert>
          {canOpen && (
            <Button icon={CircleCheck} onClick={() => setDialog('confirm')}>
              Confirmar base
            </Button>
          )}
        </div>
      )}
      {session.isOverdue && <Alert tone="danger">Ya pasó la hora de cierre de la caja: el turno no recibe ventas nuevas. Ciérralo y cuenta la caja.</Alert>}
      {session.status === 'pending_count' && <Alert tone="warning">El turno está cerrado y no recibe más movimientos. Falta contar el efectivo.</Alert>}
      {blockedByOwner && <Alert tone="info">Este turno lo abrió {session.openedBy?.fullName}. Solo esa persona, o alguien con permiso para cerrar turnos de otros, puede cerrarlo y contarlo.</Alert>}

      {/* ---------- Acciones ---------- */}
      <div className="cash-session__actions no-print">
        {canMove && isOpen && (
          <>
            <Button variant="secondary" icon={ArrowDownToLine} onClick={() => setDialog('deposit')}>
              Ingreso
            </Button>
            <Button variant="secondary" icon={ArrowUpFromLine} onClick={() => setDialog('withdrawal')}>
              Retiro
            </Button>
          </>
        )}
        {perms.canCut(session) && (
          <Button variant="danger" icon={Power} onClick={() => setAction({ type: 'cut', session })}>
            Cerrar turno
          </Button>
        )}
        {perms.canCount(session) && (
          <Button icon={Lock} onClick={() => setAction({ type: 'count', session })}>
            Contar caja
          </Button>
        )}
        {perms.canReceive(session) && (
          <Button icon={HandCoins} onClick={() => setAction({ type: 'receive', session })}>
            Recibir dinero
          </Button>
        )}
      </div>

      {/* ---------- Efectivo ---------- */}
      <section className="cash-figures" aria-label="Efectivo del turno">
        <Figure index={0} label="Base inicial" value={formatCurrency(summary?.openingCash)} detail={session.openingDifference && session.openingDifference !== '0.00' ? `Esperada ${formatCurrency(session.openingExpected)}` : 'La base fija de la caja'} />
        <Figure index={1} label="Entradas en efectivo" value={formatCurrency(summary?.cashIn)} tone="success" />
        <Figure index={2} label="Salidas en efectivo" value={formatCurrency(summary?.cashOut)} tone="danger" />
        <Figure index={3} label="Efectivo esperado" value={formatCurrency(session.expectedCash)} strong />
      </section>

      {/* ---------- Arqueo ---------- */}
      {isCounted && (
        <section className="closing-report" aria-label="Arqueo del turno">
          <header className="closing-report__header">
            <div>
              <h3>Arqueo {session.closingNumber}</h3>
              <p>
                Contado el {formatDateTime(session.closedAt)} por {session.closedBy?.fullName ?? '—'}
                {session.receivedAt && ` · Recibido el ${formatDateTime(session.receivedAt)} por ${session.receivedBy?.fullName ?? '—'}`}
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()} className="no-print">
              Imprimir
            </Button>
          </header>
          <dl className="closing-summary">
            <div>
              <dt>Efectivo esperado</dt>
              <dd>{formatCurrency(session.expectedCash)}</dd>
            </div>
            <div>
              <dt>Efectivo contado</dt>
              <dd>{formatCurrency(session.countedCash)}</dd>
            </div>
            <div className={`closing-summary__row--${diff.tone}`}>
              <dt>Diferencia</dt>
              <dd>
                {diff.label}
                {diff.label !== 'Cuadrada' && ` · ${diff.amount}`}
              </dd>
            </div>
            <div>
              <dt>Se quedó de base</dt>
              <dd>{formatCurrency(session.baseLeft)}</dd>
            </div>
            <div className="closing-summary__row--strong">
              <dt>{session.status === 'received' ? 'Entregado' : 'Para entregar'}</dt>
              <dd>{formatCurrency(session.cashWithdrawn)}</dd>
            </div>
            {session.differenceNotes && (
              <div className="closing-summary__note">
                <dt>Qué pasó con la diferencia</dt>
                <dd>{session.differenceNotes}</dd>
              </div>
            )}
            {session.closedOnBehalfReason && (
              <div className="closing-summary__note">
                <dt>Contado por otra persona</dt>
                <dd>{session.closedOnBehalfReason}</dd>
              </div>
            )}
            {session.receivedNotes && (
              <div className="closing-summary__note">
                <dt>Nota al recibir</dt>
                <dd>{session.receivedNotes}</dd>
              </div>
            )}
            {session.openingNotes && (
              <div className="closing-summary__note">
                <dt>Nota de apertura</dt>
                <dd>{session.openingNotes}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* ---------- Medios de pago ---------- */}
      <section className="cash-panel" aria-labelledby="payment-methods-title">
        <h3 className="cash-panel__title" id="payment-methods-title">
          <CreditCard aria-hidden="true" /> Por medio de pago
        </h3>
        {summary?.byPaymentMethod?.length ? (
          <ul className="method-list">
            {summary.byPaymentMethod.map((method) => (
              <li key={method.paymentMethodId} className="method-list__item">
                <span className="method-list__name">
                  {method.name}
                  <span className="method-list__detail">
                    {method.count} {method.count === 1 ? 'movimiento' : 'movimientos'}
                    {!method.isCash && ' · no entra al cajón'}
                  </span>
                </span>
                <SignedAmount value={method.total} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="cash-panel__empty">Todavía no hay movimientos en este turno. Las ventas aparecerán aquí desde la fase de ventas.</p>
        )}
      </section>

      {/* ---------- Movimientos ---------- */}
      <section className="cash-panel cash-panel--flush" aria-labelledby="movements-title">
        <h3 className="cash-panel__title" id="movements-title">
          <Banknote aria-hidden="true" /> Movimientos
        </h3>
        <DataTable
          caption="Movimientos del turno"
          columns={MOVEMENT_COLUMNS}
          rows={movements.data?.rows ?? []}
          isLoading={movements.isFetching}
          error={movements.error}
          onRetry={movements.refetch}
          emptyTitle="Sin movimientos"
          emptyDescription={isOpen && canMove ? 'Registra un ingreso o un retiro, o espera las ventas.' : undefined}
        />
        <Pagination meta={movements.data?.pagination} onPageChange={setPage} itemLabel="movimientos" />
      </section>

      {(dialog === 'deposit' || dialog === 'withdrawal') && (
        <CashMovementModal
          session={session}
          type={dialog}
          onClose={() => setDialog(null)}
          onSaved={(type, amount) => {
            setDialog(null)
            toast.success(`${type === 'withdrawal' ? 'Retiro' : 'Ingreso'} de ${formatCurrency(amount)} registrado`)
          }}
        />
      )}
      {dialog === 'confirm' && (
        <OpeningCountModal
          mode="confirm"
          session={session}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            toast.success('Base confirmada')
          }}
        />
      )}
      <SessionActionDialogs action={action} onClose={() => setAction(null)} />
    </div>
  )
}
