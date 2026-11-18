import { useState } from 'react'
import { Ban, PackageCheck, Truck } from 'lucide-react'
import { useGetTransferQuery, useReceiveTransferMutation } from './transfersApi'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { TextAreaField } from '../../components/ui/TextAreaField/TextAreaField'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { splitApiError } from '../../utils/formErrors'
import { formatCurrency, formatDateTime, formatQuantity } from '../../utils/format'
import { QUANTITY_PATTERN, toApiNumber, toInputNumber } from '../../utils/numberInput'
import { previewMultiply, previewSubtract } from '../../utils/moneyPreview'
import { TransferStatus } from './TransferStatus'

const unitOf = (item) => item.presentationName ?? item.unitSymbol

/** Faltante en vista previa: enviado − bueno − dañado (null si algo no es un número). */
function missingOf(item, row) {
  const good = toApiNumber(row.received)
  const damaged = toApiNumber(row.damaged) || '0'
  if (!QUANTITY_PATTERN.test(good) || !QUANTITY_PATTERN.test(damaged)) return null
  const afterGood = previewSubtract(item.quantity, good)
  return afterGood === null ? null : previewSubtract(afterGood, damaged)
}

/** Recibir (D-INT-8): por línea lo que llegó bueno y lo dañado; el resto es faltante. Empieza con "todo llegó bien". */
function ReceiveForm({ transfer, onDone, onCancel }) {
  const [receive, { isLoading, error }] = useReceiveTransferMutation()
  const [rows, setRows] = useState(() => Object.fromEntries(transfer.items.map((item) => [item.id, { received: toInputNumber(item.quantity), damaged: '', reason: '' }])))
  const [notes, setNotes] = useState('')
  const [localErrors, setLocalErrors] = useState({})
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const errors = { ...serverErrors, ...localErrors }

  const set = (id, name, value) => setRows((current) => ({ ...current, [id]: { ...current[id], [name]: value } }))
  const differences = transfer.items.filter((item) => {
    const missing = missingOf(item, rows[item.id])
    return (missing !== null && Number(missing) !== 0) || Number(toApiNumber(rows[item.id].damaged) || '0') > 0
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const found = {}
    transfer.items.forEach((item, index) => {
      const row = rows[item.id]
      const missing = missingOf(item, row)
      if (!QUANTITY_PATTERN.test(toApiNumber(row.received))) found[`items[${index}].receivedQuantity`] = 'Escribe cuánto llegó bueno (0 si nada)'
      else if (missing === null || Number(missing) < 0) found[`items[${index}].receivedQuantity`] = `Lo bueno más lo dañado no puede pasar de ${formatQuantity(item.quantity)}`
      else if ((Number(missing) > 0 || Number(toApiNumber(row.damaged) || '0') > 0) && row.reason.trim().length === 0) found[`items[${index}].reason`] = 'Escribe qué pasó'
    })
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const result = await receive({
        id: transfer.id,
        notes: notes.trim() || null,
        items: transfer.items.map((item) => {
          const row = rows[item.id]
          return { itemId: item.id, receivedQuantity: toApiNumber(row.received), damagedQuantity: toApiNumber(row.damaged) || '0', reason: row.reason.trim() || null }
        }),
      }).unwrap()
      onDone(result)
    } catch {
      // Se muestra en el formulario
    }
  }

  return (
    <form id="receive-transfer-form" className="transfer-receive" onSubmit={handleSubmit} noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <p className="transfer-receive__intro">Cuenta lo que llegó. Si todo llegó bien, solo confirma. Lo dañado va a la cuarentena de esta sede; lo que falte queda como pérdida de la sede que envió.</p>
      <ol className="transfer-receive__list" aria-label="Lo que llegó">
        {transfer.items.map((item, index) => {
          const row = rows[item.id]
          const missing = missingOf(item, row)
          const hasDifference = differences.includes(item)
          return (
            <li key={item.id} className={`transfer-receive__item${hasDifference ? ' transfer-receive__item--difference' : ''}`}>
              <p className="transfer-receive__name">
                <strong>{item.productName}</strong>
                <span>
                  Se enviaron {formatQuantity(item.quantity)} {unitOf(item)}
                  {missing !== null && Number(missing) > 0 && <span className="transfer-receive__missing"> · faltan {formatQuantity(missing)}</span>}
                </span>
              </p>
              <div className="transfer-receive__fields">
                <TextField label="Llegó bueno" inputMode="decimal" value={row.received} onChange={(event) => set(item.id, 'received', event.target.value)} error={errors[`items[${index}].receivedQuantity`]} required />
                <TextField label="Llegó dañado" inputMode="decimal" placeholder="0" value={row.damaged} onChange={(event) => set(item.id, 'damaged', event.target.value)} error={errors[`items[${index}].damagedQuantity`]} />
                {hasDifference && <TextField label="¿Qué pasó?" placeholder="Ej.: un bulto llegó roto" maxLength={255} value={row.reason} onChange={(event) => set(item.id, 'reason', event.target.value)} error={errors[`items[${index}].reason`]} required />}
              </div>
            </li>
          )
        })}
      </ol>
      <TextAreaField label="Nota del recibo" placeholder="Opcional" maxLength={255} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      <div className="transfer-receive__actions">
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
          Volver
        </Button>
        <Button type="submit" icon={PackageCheck} isLoading={isLoading}>
          {differences.length > 0 ? 'Recibir con diferencias' : 'Todo llegó bien: recibir'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Detalle de una transferencia. Si es para esta sede y sigue en camino, se puede recibir;
 * si la envió esta sede y sigue en camino, se puede anular.
 */
export function TransferDetailModal({ id, canReceive, canCancel, onClose, onReceived, onCancelRequest }) {
  const { data: transfer, isFetching, error } = useGetTransferQuery(id)
  const [receiving, setReceiving] = useState(false)
  const inTransit = transfer?.status === 'in_transit'
  const mayReceive = canReceive && inTransit && transfer?.direction === 'incoming'
  const mayCancel = canCancel && inTransit && transfer?.direction === 'outgoing'

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon={Truck}
      title={transfer ? `Transferencia ${transfer.number}` : 'Transferencia'}
      description={transfer ? `${transfer.origin.name} → ${transfer.destination.name} · enviada el ${formatDateTime(transfer.sentAt)} por ${transfer.sentBy?.fullName ?? '—'}` : undefined}
      footer={
        !receiving && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            {mayCancel && (
              <Button variant="danger" icon={Ban} onClick={() => onCancelRequest(transfer)}>
                Anular envío
              </Button>
            )}
            {mayReceive && (
              <Button icon={PackageCheck} onClick={() => setReceiving(true)}>
                Recibir
              </Button>
            )}
          </>
        )
      }
    >
      {!transfer && isFetching && <Spinner label="Cargando la transferencia…" />}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {transfer && receiving && <ReceiveForm transfer={transfer} onCancel={() => setReceiving(false)} onDone={onReceived} />}
      {transfer && !receiving && (
        <div className="transfer-detail">
          <div className="transfer-detail__summary">
            <TransferStatus transfer={transfer} />
            {transfer.costTotal !== null && <span>Costo enviado: {formatCurrency(transfer.costTotal)}</span>}
            {transfer.receivedBy && <span>Recibida por {transfer.receivedBy.fullName} el {formatDateTime(transfer.receivedAt)}</span>}
            {transfer.cancelledBy && (
              <span>
                Anulada por {transfer.cancelledBy.fullName} el {formatDateTime(transfer.cancelledAt)}: {transfer.cancelReason}
              </span>
            )}
          </div>
          {transfer.notes && <p className="transfer-detail__notes">{transfer.notes}</p>}
          {transfer.hasDifferences && transfer.missingCost !== null && (
            <Alert tone="warning" title="Llegó con diferencias">
              Faltante (pérdida de {transfer.origin.name}): {formatCurrency(transfer.missingCost)} · Dañado (en cuarentena de {transfer.destination.name}): {formatCurrency(transfer.damagedCost)}
            </Alert>
          )}
          <div className="transfer-detail__scroll">
            <table className="transfer-detail__table">
              <caption className="u-visually-hidden">Productos de la transferencia</caption>
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className="numeric">
                    Enviado
                  </th>
                  {transfer.status === 'received' && (
                    <>
                      <th scope="col" className="numeric">
                        Bueno
                      </th>
                      <th scope="col" className="numeric">
                        Dañado
                      </th>
                      <th scope="col" className="numeric">
                        Faltó
                      </th>
                    </>
                  )}
                  {transfer.costTotal !== null && (
                    <th scope="col" className="numeric">
                      Costo
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {transfer.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="cash-stack">
                        <strong>{item.productName}</strong>
                        <span className="cash-stack__detail">
                          {item.productCode}
                          {item.batches?.length > 0 && ` · lotes ${item.batches.map((batch) => `${batch.lotNumber} (${formatQuantity(batch.quantity)})`).join(', ')}`}
                          {item.differenceReason && ` · ${item.differenceReason}`}
                        </span>
                      </span>
                    </td>
                    <td className="numeric">
                      {formatQuantity(item.quantity)} {unitOf(item)}
                    </td>
                    {transfer.status === 'received' && (
                      <>
                        <td className="numeric">{formatQuantity(item.receivedQuantity)}</td>
                        <td className="numeric">{formatQuantity(item.damagedQuantity)}</td>
                        <td className="numeric">{formatQuantity(item.missingQuantity)}</td>
                      </>
                    )}
                    {transfer.costTotal !== null && <td className="numeric">{formatCurrency(previewMultiply(item.unitCost, item.baseQuantity))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
