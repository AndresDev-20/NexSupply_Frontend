// Estado de una transferencia como píldora (en camino, recibida, anulada; con aviso si llegó con diferencias).
const TONES = { in_transit: 'info', received: 'success', cancelled: 'danger' }

export function TransferStatus({ transfer }) {
  const tone = transfer.status === 'received' && transfer.hasDifferences ? 'warning' : TONES[transfer.status]
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {transfer.statusLabel}
      {transfer.status === 'received' && transfer.hasDifferences && ' con diferencias'}
    </span>
  )
}
