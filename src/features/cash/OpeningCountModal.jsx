import { useState } from 'react'
import { Banknote, CircleCheck, KeyRound, Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextAreaField } from '../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Alert } from '../../components/feedback/Alert/Alert'
import { splitApiError } from '../../utils/formErrors'
import { formatCurrency } from '../../utils/format'
import { previewSubtract } from '../../utils/moneyPreview'
import { useConfirmCashOpeningMutation, useOpenCashSessionMutation } from './cashApi'
import { differenceInfo } from './cashOptions'
import { DenominationCounter } from './DenominationCounter'
import { countTotal, toBreakdown } from './denominations'
import '../admin/admin.css'
import './cash.css'

/**
 * Conteo de la base al empezar un turno (D-CAJA-3):
 * - mode "open": abrir un turno en `register`. La base esperada es la base fija de la caja (D-CAJA-9).
 *   Si hoy está marcado como día sin abrir, el servidor pide confirmar (D-CAJA-11).
 * - mode "confirm": confirmar lo que hay en un turno que abrió el sistema (`session`, D-CAJA-8).
 * Si lo contado no coincide con lo esperado, se exige una nota.
 */
export function OpeningCountModal({ mode, register, session, onClose, onSaved }) {
  const isConfirm = mode === 'confirm'
  const expected = isConfirm ? session.openingExpected : register.baseAmount
  const registerName = isConfirm ? session.register?.name : register.name
  // Conteo por billetes y monedas (D-CAJA-14); «Está completa» = la base esperada sin detalle
  const [form, setForm] = useState({ quantities: {}, complete: false, notes: '' })
  const [localErrors, setLocalErrors] = useState({})
  const [openSession, openState] = useOpenCashSessionMutation()
  const [confirmOpening, confirmState] = useConfirmCashOpeningMutation()
  const { isLoading, error } = isConfirm ? confirmState : openState
  // Día sin abrir: no es un error, es una pregunta
  const closedDay = error?.code === 'CONFIRMATION_REQUIRED' ? error.message : null
  const { fieldErrors: serverErrors, formError } = splitApiError(closedDay ? null : error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const counted = form.complete ? String(Number(expected)) : String(countTotal(form.quantities))
  const hasCount = form.complete || toBreakdown(form.quantities).length > 0 || Number(expected) === 0
  const difference = hasCount ? previewSubtract(counted, expected) : null
  const diff = differenceInfo(difference)
  const needsNote = Boolean(diff) && diff.label !== 'Cuadrada'

  const change = (name) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!hasCount) errors.countedCash = 'Cuenta los billetes y monedas del cajón, o pulsa «Está completa»'
    if (needsNote && !form.notes.trim()) errors.notes = 'Lo contado no coincide con la base esperada: explica la diferencia'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    const body = { ...(form.complete ? { countedCash: counted } : { breakdown: toBreakdown(form.quantities) }), notes: form.notes.trim() || null, ...(closedDay && { confirmClosedDay: true }) }
    if (!form.complete && body.breakdown.length === 0) body.countedCash = '0'
    try {
      const saved = isConfirm
        ? await confirmOpening({ sessionId: session.id, ...body }).unwrap()
        : await openSession({ registerId: register.id, ...body }).unwrap()
      onSaved(saved)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size={form.complete ? 'md' : 'lg'}
      icon={isConfirm ? CircleCheck : KeyRound}
      title={isConfirm ? 'Confirmar la base' : 'Abrir turno'}
      description={
        isConfirm
          ? `${registerName} la abrió el sistema según su horario. Cuenta el efectivo para confirmar con cuánto arranca el turno.`
          : `${registerName}. Cuenta el efectivo que hay en el cajón antes de empezar a vender.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="opening-count-form" icon={isConfirm ? CircleCheck : KeyRound} variant={closedDay ? 'accent' : 'primary'} isLoading={isLoading}>
            {isConfirm ? 'Confirmar base' : closedDay ? 'Abrir de todas formas' : 'Abrir turno'}
          </Button>
        </>
      }
    >
      <form id="opening-count-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        {closedDay && (
          <div className="admin-form__alert">
            <Alert tone="warning">{closedDay}</Alert>
          </div>
        )}

        <div className="cash-expected">
          <span className="cash-expected__icon" aria-hidden="true">
            <Wallet />
          </span>
          <span className="cash-expected__text">
            <span className="cash-expected__label">Base esperada</span>
            <span className="cash-expected__value">{formatCurrency(expected)}</span>
            <span className="cash-expected__hint">{isConfirm ? 'La base con que el sistema abrió la caja' : 'La base fija con que arranca la caja cada día'}</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setForm((current) => ({ ...current, complete: !current.complete }))
              setLocalErrors((current) => ({ ...current, countedCash: undefined }))
            }}
          >
            {form.complete ? 'Contar billetes' : 'Está completa'}
          </Button>
        </div>

        <FormSection icon={Banknote} title="Lo que contaste" columns={1}>
          {form.complete ? (
            <p className="cash-diff cash-diff--success" role="status">
              La base está completa: {formatCurrency(expected)}
            </p>
          ) : (
            <DenominationCounter
              quantities={form.quantities}
              onChange={(quantities) => {
                setForm((current) => ({ ...current, quantities }))
                setLocalErrors((current) => ({ ...current, countedCash: undefined }))
              }}
              error={fieldErrors.countedCash}
            />
          )}
          {diff && (
            <p className={`cash-diff cash-diff--${diff.tone}`} role="status">
              {diff.label === 'Cuadrada' ? 'Coincide con la base esperada' : `${diff.label} de ${diff.amount} frente a la base esperada`}
            </p>
          )}
          <TextAreaField
            label="Nota"
            placeholder={needsNote ? 'Ej.: faltaban $ 2.000 en monedas' : 'Opcional'}
            maxLength={255}
            rows={2}
            value={form.notes}
            onChange={change('notes')}
            error={fieldErrors.notes}
            required={needsNote}
          />
        </FormSection>
      </form>
    </Modal>
  )
}
