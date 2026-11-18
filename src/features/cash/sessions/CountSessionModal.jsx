import { useState } from 'react'
import { useSelector } from 'react-redux'
import { ArrowLeft, Banknote, HandCoins, Lock, PiggyBank, UserCheck } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { selectCurrentUser } from '../../auth/authSlice'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency } from '../../../utils/format'
import { MONEY_PATTERN, toApiNumber } from '../../../utils/numberInput'
import { previewSubtract } from '../../../utils/moneyPreview'
import { useCountCashSessionMutation } from '../cashApi'
import { differenceInfo } from '../cashOptions'
import '../../admin/admin.css'
import '../cash.css'

const isNegative = (text) => typeof text === 'string' && text.startsWith('-')

/**
 * Contar la caja (D-CAJA-4, D-CAJA-9, D-CAJA-12), en dos pasos:
 * 1. Contar: el efectivo total del cajón y, si no cuadra, qué pasó.
 * 2. Confirmar: resumen tipo tirilla. Después de contar, el turno no se puede modificar.
 *
 * La base fija de la caja se queda en el cajón para el día siguiente; se entrega el resto.
 * La diferencia y lo que se entrega se muestran en vivo (vista previa con enteros);
 * los valores oficiales los calcula el backend.
 */
export function CountSessionModal({ session, onClose, onSaved }) {
  const currentUser = useSelector(selectCurrentUser)
  const onBehalf = session.responsibleId !== null && session.responsibleId !== currentUser?.id
  const base = session.register?.baseAmount ?? '0'
  const [step, setStep] = useState('count')
  const [form, setForm] = useState({ countedCash: '', differenceNotes: '', onBehalfReason: '' })
  const [localErrors, setLocalErrors] = useState({})
  const [countSession, { isLoading, error }] = useCountCashSessionMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const counted = toApiNumber(form.countedCash)
  const hasCount = MONEY_PATTERN.test(counted)
  const difference = hasCount ? previewSubtract(counted, session.expectedCash) : null
  const diff = differenceInfo(difference)
  const isSquare = diff?.label === 'Cuadrada'
  // Si lo contado no alcanza la base, se queda todo en el cajón
  const overBase = hasCount ? previewSubtract(counted, base) : null
  const baseStays = overBase === null ? null : isNegative(overBase) ? counted : base
  const toDeliver = overBase === null ? null : isNegative(overBase) ? '0' : overBase

  const change = (name) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const validate = () => {
    const errors = {}
    if (!hasCount) errors.countedCash = 'Escribe el efectivo que contaste (ej. 480.000)'
    if (diff && !isSquare && !form.differenceNotes.trim()) errors.differenceNotes = 'Lo contado no coincide con lo esperado: explica qué pasó'
    if (onBehalf && !form.onBehalfReason.trim()) errors.onBehalfReason = 'Explica por qué cuentas un turno abierto por otra persona'
    setLocalErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (step === 'count') {
      if (validate()) setStep('confirm')
      return
    }
    try {
      const saved = await countSession({
        sessionId: session.id,
        countedCash: counted,
        differenceNotes: form.differenceNotes.trim() || null,
        onBehalfReason: onBehalf ? form.onBehalfReason.trim() : null,
      }).unwrap()
      onSaved(saved)
    } catch (countError) {
      // Un error de un campo se corrige en el paso de conteo
      if (countError.details?.some((detail) => detail.field)) setStep('count')
    }
  }

  const isConfirm = step === 'confirm'
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={Lock}
      title={isConfirm ? 'Confirmar el conteo' : 'Contar la caja'}
      description={
        isConfirm
          ? 'Revisa los datos. Después de contar, el turno no se puede modificar.'
          : `${session.register?.name ?? 'Caja'}. Cuenta todo el efectivo del cajón (billetes y monedas) y escribe el total.`
      }
      footer={
        isConfirm ? (
          <>
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep('count')} disabled={isLoading}>
              Volver
            </Button>
            <Button type="submit" form="count-session-form" icon={Lock} isLoading={isLoading}>
              Confirmar conteo
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="count-session-form" icon={Lock}>
              Revisar
            </Button>
          </>
        )
      }
    >
      <form id="count-session-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}

        {isConfirm ? (
          <dl className="closing-summary closing-summary--ticket" aria-label="Resumen del conteo">
            <div>
              <dt>Efectivo esperado</dt>
              <dd>{formatCurrency(session.expectedCash)}</dd>
            </div>
            <div>
              <dt>Efectivo contado</dt>
              <dd>{formatCurrency(counted)}</dd>
            </div>
            <div className={`closing-summary__row--${diff.tone}`}>
              <dt>Diferencia</dt>
              <dd>
                {diff.label}
                {!isSquare && ` · ${diff.amount}`}
              </dd>
            </div>
            <div>
              <dt>Se queda de base</dt>
              <dd>{formatCurrency(baseStays)}</dd>
            </div>
            <div className="closing-summary__row--strong">
              <dt>Para entregar</dt>
              <dd>{formatCurrency(toDeliver)}</dd>
            </div>
            {!isSquare && (
              <div className="closing-summary__note">
                <dt>Qué pasó</dt>
                <dd>{form.differenceNotes.trim()}</dd>
              </div>
            )}
            {onBehalf && (
              <div className="closing-summary__note">
                <dt>Cuentas por {session.openedBy?.fullName ?? 'otra persona'}</dt>
                <dd>{form.onBehalfReason.trim()}</dd>
              </div>
            )}
          </dl>
        ) : (
          <>
            <div className="count-preview">
              <div className="count-preview__item">
                <Banknote aria-hidden="true" />
                <span className="count-preview__label">Esperado</span>
                <span className="count-preview__value">{formatCurrency(session.expectedCash)}</span>
              </div>
              <div className="count-preview__item">
                <PiggyBank aria-hidden="true" />
                <span className="count-preview__label">Base que se queda</span>
                <span className="count-preview__value">{formatCurrency(baseStays ?? base)}</span>
              </div>
              <div className="count-preview__item count-preview__item--strong">
                <HandCoins aria-hidden="true" />
                <span className="count-preview__label">Para entregar</span>
                <span className="count-preview__value">{toDeliver === null ? '—' : formatCurrency(toDeliver)}</span>
              </div>
            </div>

            <FormSection icon={Banknote} title="Conteo" columns={1}>
              <TextField
                label="Efectivo contado"
                icon={Banknote}
                inputMode="decimal"
                placeholder="Ej.: 480.000"
                data-autofocus
                value={form.countedCash}
                onChange={change('countedCash')}
                error={fieldErrors.countedCash}
                required
              />
              {diff && (
                <p className={`cash-diff cash-diff--${diff.tone}`} role="status">
                  {isSquare ? 'La caja cuadra' : `${diff.label} de ${diff.amount}`}
                </p>
              )}
              {diff && !isSquare && (
                <TextAreaField
                  label="¿Qué pasó?"
                  placeholder="Ej.: se dio mal un cambio de $ 2.000"
                  maxLength={500}
                  rows={2}
                  value={form.differenceNotes}
                  onChange={change('differenceNotes')}
                  error={fieldErrors.differenceNotes}
                  required
                />
              )}
            </FormSection>

            {onBehalf && (
              <FormSection icon={UserCheck} title="Cuentas por otra persona" description={`Este turno lo abrió ${session.openedBy?.fullName ?? 'otra persona'}.`} columns={1}>
                <TextAreaField
                  label="Motivo"
                  placeholder="Ej.: el cajero salió temprano"
                  maxLength={255}
                  rows={2}
                  value={form.onBehalfReason}
                  onChange={change('onBehalfReason')}
                  error={fieldErrors.onBehalfReason}
                  required
                />
              </FormSection>
            )}
          </>
        )}
      </form>
    </Modal>
  )
}
