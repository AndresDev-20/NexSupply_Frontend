import { useState } from 'react'
import { CalendarDays, HandCoins, Lock, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import { useGetCashHistoryQuery, useGetCashRegistersQuery } from '../cashApi'
import { differenceInfo } from '../cashOptions'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { Badge } from '../../../components/ui/Badge/Badge'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { formatCurrency } from '../../../utils/format'
import { BUSINESS_LOCALE } from '../../../config/env'
import '../cash.css'

const GROUPS = [
  { value: 'day', label: 'Por día' },
  { value: 'month', label: 'Por mes' },
  { value: 'year', label: 'Por año' },
]

// El periodo llega como texto ("2026-11-02", "2026-11", "2026"): se formatea en UTC para no correr el día
const dayFormat = new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: 'UTC', month: 'long', year: 'numeric' })

function periodLabel(period, groupBy) {
  const date = groupBy === 'day' ? new Date(`${period}T12:00:00Z`) : groupBy === 'month' ? new Date(`${period}-15T12:00:00Z`) : null
  // Si el periodo no tiene el formato esperado (ej. mientras cambia la agrupación), se muestra tal cual
  if (!date || Number.isNaN(date.getTime())) return period
  return (groupBy === 'day' ? dayFormat : monthFormat).format(date)
}

/** Proporción para la barra (solo visual: no es un cálculo de dinero). */
const share = (value, max) => (Number(max) > 0 ? Math.max(4, Math.round((Number(value) / Number(max)) * 100)) : 0)

/**
 * Historial de caja (D-CAJA-13): el cuadre de los turnos contados por día, mes o año.
 * Los totales los calcula el backend; aquí solo se muestran.
 */
export default function CashHistoryPage() {
  const [groupBy, setGroupBy] = useState('day')
  const [registerId, setRegisterId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data: registers = [] } = useGetCashRegistersQuery()
  const { data, isFetching, error } = useGetCashHistoryQuery({ groupBy, ...(registerId && { registerId }), ...(from && { from }), ...(to && { to }) })
  const rows = data?.rows ?? []
  const totals = data?.totals
  const max = rows.reduce((top, row) => (Number(row.countedCash) > top ? Number(row.countedCash) : top), 0)
  const totalDiff = differenceInfo(totals?.difference)

  return (
    <>
      <PageHeader description="El cuadre de caja de los turnos contados: cuánto entró, cuánto se contó, las diferencias y lo que se entregó." />

      <div className="segmented" role="tablist" aria-label="Agrupar el historial">
        {GROUPS.map((group) => (
          <button key={group.value} type="button" role="tab" aria-selected={groupBy === group.value} className={`segmented__option${groupBy === group.value ? ' segmented__option--active' : ''}`} onClick={() => setGroupBy(group.value)}>
            {group.label}
          </button>
        ))}
      </div>

      <FilterBar even>
        <SelectField label="Caja" placeholder="Todas las cajas" options={registers.map((register) => ({ value: String(register.id), label: register.name }))} value={registerId} onChange={(event) => setRegisterId(event.target.value)} />
        <TextField label="Desde" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Hasta" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
      </FilterBar>

      {error ? (
        <StatusMessage icon={Scale} tone="danger" title="No se pudo cargar el historial" description={error.message} />
      ) : !data && isFetching ? (
        <div className="cash-page__state">
          <Spinner size="lg" label="Calculando el cuadre…" />
        </div>
      ) : (
        <>
          {data && (
            <p className="history-range">
              <CalendarDays aria-hidden="true" /> Del {shortDate.format(new Date(`${data.from}T12:00:00Z`))} al {shortDate.format(new Date(`${data.to}T12:00:00Z`))}
            </p>
          )}
          <section className="cash-tiles cash-tiles--four" aria-label="Totales del periodo">
            <div className="cash-tile cash-tile--info">
              <Lock aria-hidden="true" />
              <span className="cash-tile__value">{totals?.sessions ?? 0}</span>
              <span className="cash-tile__label">Turnos contados</span>
            </div>
            <div className="cash-tile cash-tile--success">
              <TrendingUp aria-hidden="true" />
              <span className="cash-tile__value">{formatCurrency(totals?.countedCash)}</span>
              <span className="cash-tile__label">Efectivo contado</span>
            </div>
            <div className={`cash-tile cash-tile--${totalDiff?.tone === 'success' ? 'success' : totalDiff?.tone === 'danger' ? 'danger' : 'warning'}`}>
              <TrendingDown aria-hidden="true" />
              <span className="cash-tile__value">{totalDiff ? (totalDiff.label === 'Cuadrada' ? '$ 0' : `${totalDiff.label === 'Faltante' ? '−' : '+'} ${totalDiff.amount}`) : '$ 0'}</span>
              <span className="cash-tile__label">Diferencias</span>
            </div>
            <div className="cash-tile cash-tile--accent">
              <HandCoins aria-hidden="true" />
              <span className="cash-tile__value">{formatCurrency(totals?.toDeliver)}</span>
              <span className="cash-tile__label">Para entregar</span>
            </div>
          </section>

          {rows.length === 0 ? (
            <StatusMessage icon={CalendarDays} title="No hay turnos contados en estas fechas" description="El cuadre aparece cuando se cuenta la caja." />
          ) : (
            <ul className="history-list" aria-label="Cuadre por periodo">
              {rows.map((row, index) => {
                const diff = differenceInfo(row.difference)
                return (
                  <li key={row.period} className="history-row" style={{ '--delay': `${Math.min(index, 12) * 45}ms` }}>
                    <div className="history-row__head">
                      <span className="history-row__period">{periodLabel(row.period, groupBy)}</span>
                      <span className="history-row__sessions">
                        {row.sessions} {row.sessions === 1 ? 'turno' : 'turnos'}
                        {row.received < row.sessions && ` · ${row.sessions - row.received} por recibir`}
                      </span>
                    </div>
                    <div className="history-row__bar" aria-hidden="true">
                      <span style={{ width: `${share(row.countedCash, max)}%` }} />
                    </div>
                    <dl className="history-row__figures">
                      <div>
                        <dt>Entró</dt>
                        <dd className="cash-amount--in">{formatCurrency(row.cashIn)}</dd>
                      </div>
                      <div>
                        <dt>Salió</dt>
                        <dd className="cash-amount--out">{formatCurrency(row.cashOut)}</dd>
                      </div>
                      <div>
                        <dt>Contado</dt>
                        <dd>{formatCurrency(row.countedCash)}</dd>
                      </div>
                      <div>
                        <dt>Diferencia</dt>
                        <dd>
                          <Badge tone={diff.tone}>{diff.label === 'Cuadrada' ? 'Cuadrada' : `${diff.label} ${diff.amount}`}</Badge>
                        </dd>
                      </div>
                      <div>
                        <dt>Para entregar</dt>
                        <dd>
                          <strong>{formatCurrency(row.toDeliver)}</strong>
                        </dd>
                      </div>
                    </dl>
                    {row.byPaymentMethod.length > 0 && (
                      <ul className="history-row__methods" aria-label="Por medio de pago">
                        {row.byPaymentMethod.map((method) => (
                          <li key={method.name} className={method.isCash ? '' : 'history-row__method--other'}>
                            {method.name}: {formatCurrency(method.total)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </>
  )
}
