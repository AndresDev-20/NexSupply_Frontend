import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, CalendarClock, CalendarOff, CircleCheck, Eye, HandCoins, KeyRound, Landmark, Lock, PiggyBank, Power, RotateCw, TriangleAlert, Zap } from 'lucide-react'
import { useGetCashRegistersQuery, useGetCashSessionQuery, useGetCashSessionsQuery, useGetClosedDaysQuery } from '../cashApi'
import { scheduleLabel, sessionState } from '../cashOptions'
import { Lifecycle } from '../Lifecycle'
import { OpeningCountModal } from '../OpeningCountModal'
import { SessionActionDialogs } from '../sessions/SessionActions'
import { useSessionPermissions } from '../useSessionPermissions'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { ROUTES, cashSessionPath } from '../../../routes/paths'
import { BUSINESS_LOCALE, BUSINESS_TIMEZONE } from '../../../config/env'
import '../cash.css'

const todayLabel = new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: BUSINESS_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })
/** Hoy en la zona del negocio, "AAAA-MM-DD" (en-CA da ese formato). */
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE }).format(new Date())

/** Tarjeta de una caja con su turno de hoy y la acción que toca. */
function RegisterCard({ register, index, onOpen, onConfirm, onAction }) {
  const navigate = useNavigate()
  const canOpen = useCan('cash.open')
  const perms = useSessionPermissions()
  const current = register.currentSession
  // El resumen de la lista no trae el efectivo esperado: se pide el turno completo
  const { data: session } = useGetCashSessionQuery(current?.id, { skip: !current })
  const full = current ? (session ?? null) : null
  const state = sessionState(full ?? current)

  return (
    <li className={`register-card register-card--${state.tone} register-card--${state.key}`} style={{ '--delay': `${index * 70}ms` }}>
      <div className="register-card__head">
        <span className={`register-card__icon${state.key === 'open' ? ' register-card__icon--live' : ''}`} aria-hidden="true">
          <Banknote />
        </span>
        <div className="register-card__title">
          <span className={`status-pill status-pill--${state.tone}`}>
            <span className="status-pill__dot" aria-hidden="true" />
            {state.label}
          </span>
          <h2 className="register-card__name">{register.name}</h2>
          <span className="register-card__schedule">
            <CalendarClock aria-hidden="true" /> {scheduleLabel(register)}
            {register.automatic && (
              <span className="register-card__auto" title="Se abre y se cierra sola según el horario">
                <Zap aria-hidden="true" /> Automática
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="register-card__body">
        {current ? (
          <>
            <div className="register-card__money">
              <span className="register-card__money-label">{current.status === 'open' ? 'Efectivo en caja' : 'Efectivo esperado'}</span>
              <span className="register-card__money-value">{full ? formatCurrency(full.expectedCash) : '…'}</span>
            </div>
            <Lifecycle status={current.status} compact />
            <p className="register-card__meta">
              Abierta {formatDateTime(current.openedAt)} · {current.openedBy?.fullName ?? (current.autoOpened ? 'por el sistema' : '—')}
            </p>
            {state.key === 'overdue' && <p className="register-card__warning">Ya pasó la hora de cierre: cierra el turno y cuenta la caja.</p>}
            {state.key === 'pending' && <p className="register-card__warning">El turno está cerrado. Falta contar el efectivo.</p>}
          </>
        ) : (
          <div className="register-card__money">
            <span className="register-card__money-label">Base del día</span>
            <span className="register-card__money-value">{formatCurrency(register.baseAmount)}</span>
            <span className="register-card__meta">Sin turno abierto</span>
          </div>
        )}
      </div>

      <div className="register-card__foot">
        {current && <IconButton icon={Eye} label={`Ver turno de ${register.name}`} onClick={() => navigate(cashSessionPath(current.id))} />}
        {full && perms.canCut(full) && (
          <Button icon={Power} variant="secondary" onClick={() => onAction({ type: 'cut', session: full })} aria-label={`Cerrar turno de ${register.name}`}>
            Cerrar turno
          </Button>
        )}
        {current?.needsOpeningConfirmation && canOpen && (
          <Button icon={CircleCheck} variant="secondary" onClick={() => full && onConfirm(full)} disabled={!full}>
            Confirmar base
          </Button>
        )}
        {full && perms.canCount(full) && (
          <Button icon={Lock} variant={full.status === 'pending_count' ? 'primary' : 'secondary'} onClick={() => onAction({ type: 'count', session: full })}>
            Contar caja
          </Button>
        )}
        {!current && canOpen && (
          <Button icon={KeyRound} onClick={() => onOpen(register)}>
            Abrir turno
          </Button>
        )}
      </div>
    </li>
  )
}

/**
 * Mis cajas de hoy (D-CAJA-10): cada caja con su turno y la acción que toca —abrir,
 * cerrar turno, contar— y abajo los turnos contados que falta recibir.
 */
export default function CashPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const canManage = useCan('cash.manage')
  const perms = useSessionPermissions()
  const { data: registers = [], isLoading, error, refetch } = useGetCashRegistersQuery()
  const { data: closedDays = [] } = useGetClosedDaysQuery()
  const { data: toReceive } = useGetCashSessionsQuery({ status: 'counted', pageSize: 50 })
  const [opening, setOpening] = useState(null) // { mode, register | session }
  const [action, setAction] = useState(null)

  const closedToday = closedDays.find((day) => day.date === todayIso())
  const openCount = registers.filter((register) => register.currentSession?.status === 'open').length
  const pendingCount = registers.filter((register) => register.currentSession?.status === 'pending_count').length
  const pendingReceipt = toReceive?.rows ?? []

  const handleSaved = (session) => {
    const confirmed = opening.mode === 'confirm'
    setOpening(null)
    toast.success(confirmed ? 'Base confirmada' : `Turno abierto en ${session.register?.name ?? 'la caja'}`)
    navigate(cashSessionPath(session.id))
  }

  let content
  if (isLoading) {
    content = (
      <div className="cash-page__state">
        <Spinner size="lg" label="Cargando cajas…" />
      </div>
    )
  } else if (error) {
    content = (
      <StatusMessage icon={TriangleAlert} tone="danger" title="No se pudieron cargar las cajas" description={error.message}>
        <Button icon={RotateCw} onClick={refetch}>
          Reintentar
        </Button>
      </StatusMessage>
    )
  } else if (registers.length === 0) {
    content = (
      <StatusMessage icon={Banknote} title="Aún no hay cajas" description={canManage ? 'Crea la primera caja con su base y su horario.' : 'Pide a un administrador que cree la caja de la sucursal.'}>
        {canManage && (
          <Link className="button button--primary button--md" to={ROUTES.cashRegisters}>
            <Landmark className="button__icon" aria-hidden="true" />
            <span className="button__label">Ir a Cajas</span>
          </Link>
        )}
      </StatusMessage>
    )
  } else {
    content = (
      <>
        <section className="cash-tiles" aria-label="Resumen de hoy">
          <div className="cash-tile cash-tile--success">
            <Banknote aria-hidden="true" />
            <span className="cash-tile__value">{openCount}</span>
            <span className="cash-tile__label">{openCount === 1 ? 'Caja abierta' : 'Cajas abiertas'}</span>
          </div>
          <div className="cash-tile cash-tile--warning">
            <Lock aria-hidden="true" />
            <span className="cash-tile__value">{pendingCount}</span>
            <span className="cash-tile__label">Por contar</span>
          </div>
          <div className="cash-tile cash-tile--info">
            <HandCoins aria-hidden="true" />
            <span className="cash-tile__value">{pendingReceipt.length}</span>
            <span className="cash-tile__label">Por recibir</span>
          </div>
        </section>

        <ul className="register-grid" aria-label="Cajas de la sucursal">
          {registers.map((register, index) => (
            <RegisterCard
              key={register.id}
              register={register}
              index={index}
              onOpen={(item) => setOpening({ mode: 'open', register: item })}
              onConfirm={(session) => setOpening({ mode: 'confirm', session })}
              onAction={setAction}
            />
          ))}
        </ul>

        {pendingReceipt.length > 0 && (
          <section className="cash-panel receipt-panel" aria-labelledby="to-receive-title">
            <h3 className="cash-panel__title" id="to-receive-title">
              <HandCoins aria-hidden="true" /> Turnos contados por recibir
            </h3>
            <ul className="receipt-list">
              {pendingReceipt.map((session) => (
                <li key={session.id} className="receipt-list__item">
                  <span className="receipt-list__icon" aria-hidden="true">
                    <PiggyBank />
                  </span>
                  <span className="receipt-list__text">
                    <span className="receipt-list__name">
                      {session.register?.name} · {session.closingNumber}
                    </span>
                    <span className="receipt-list__detail">
                      Contada {formatDateTime(session.closedAt)} por {session.closedBy?.fullName ?? '—'}
                    </span>
                  </span>
                  <span className="receipt-list__amount">{formatCurrency(session.cashWithdrawn)}</span>
                  <span className="receipt-list__actions">
                    <IconButton icon={Eye} label={`Ver turno ${session.closingNumber}`} onClick={() => navigate(cashSessionPath(session.id))} />
                    {perms.canReceive(session) && (
                      <Button size="sm" icon={HandCoins} onClick={() => setAction({ type: 'receive', session })}>
                        Recibir
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        description="Tus cajas de hoy: abre el turno, ciérralo cuando quieras y cuenta la caja. La base se queda en el cajón y se entrega el resto."
        actions={
          canManage && (
            <Link className="button button--secondary button--md" to={ROUTES.cashRegisters}>
              <Landmark className="button__icon" aria-hidden="true" />
              <span className="button__label">Cajas</span>
            </Link>
          )
        }
      />
      <p className="cash-today">
        <CalendarClock aria-hidden="true" /> {todayLabel.format(new Date())}
      </p>
      {closedToday && (
        <div className="cash-closed-banner" role="status">
          <CalendarOff aria-hidden="true" />
          <span>
            <strong>Hoy es día sin abrir:</strong> {closedToday.reason}. Las cajas no se abren solas; si abres una a mano, el sistema te pedirá confirmar.
          </span>
        </div>
      )}
      {content}

      {opening?.mode === 'open' && <OpeningCountModal mode="open" register={opening.register} onClose={() => setOpening(null)} onSaved={handleSaved} />}
      {opening?.mode === 'confirm' && <OpeningCountModal mode="confirm" session={opening.session} onClose={() => setOpening(null)} onSaved={handleSaved} />}
      <SessionActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  )
}
