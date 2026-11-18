import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { formatDateTime } from '../../../utils/format'
import { ENTITY_LABELS, FIELD_LABELS, actionLabel, formatAuditValue } from './auditLabels'
import './AuditPage.css'

/** Detalle de un registro: quién, cuándo, desde dónde y qué cambió (antes → después). */
export function AuditDetailModal({ log, onClose }) {
  if (!log) return null
  const keys = [...new Set([...Object.keys(log.oldValues ?? {}), ...Object.keys(log.newValues ?? {})])]
  const hasBefore = log.oldValues && Object.keys(log.oldValues).length > 0

  return (
    <Modal isOpen onClose={onClose} title={actionLabel(log.action)} description={formatDateTime(log.createdAt)} footer={<Button onClick={onClose}>Cerrar</Button>}>
      <dl className="audit-detail">
        <div className="audit-detail__item">
          <dt>Realizado por</dt>
          <dd>{log.user ? `${log.user.fullName} (@${log.user.username})` : 'No identificado'}</dd>
        </div>
        {log.entityType && (
          <div className="audit-detail__item">
            <dt>Registro</dt>
            <dd>
              {ENTITY_LABELS[log.entityType] ?? log.entityType} #{log.entityId}
            </dd>
          </div>
        )}
        <div className="audit-detail__item">
          <dt>Dirección IP</dt>
          <dd>{log.ip || '—'}</dd>
        </div>
      </dl>

      {keys.length > 0 && (
        <table className="audit-changes">
          <caption className="u-visually-hidden">Cambios</caption>
          <thead>
            <tr>
              <th scope="col">Campo</th>
              {hasBefore && <th scope="col">Antes</th>}
              <th scope="col">{hasBefore ? 'Después' : 'Valor'}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key}>
                <th scope="row">{FIELD_LABELS[key] ?? key}</th>
                {hasBefore && <td className="audit-changes__old">{formatAuditValue(key, log.oldValues?.[key])}</td>}
                <td className="audit-changes__new">{formatAuditValue(key, log.newValues?.[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
