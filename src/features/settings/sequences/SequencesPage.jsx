import { useState } from 'react'
import { Pencil, RotateCw, TriangleAlert } from 'lucide-react'
import { useGetSequencesQuery } from '../settingsApi'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { SequenceFormModal } from './SequenceFormModal'
import { SequenceTicket } from './SequenceTicket'
import '../../admin/admin.css'
import '../settings.css'
import './SequencesPage.css'

/** Agrupa los consecutivos por sucursal (el plan básico tiene una sola). */
function groupByBranch(sequences) {
  const groups = new Map()
  for (const sequence of sequences) {
    const key = sequence.branch?.id ?? 0
    if (!groups.has(key)) groups.set(key, { branch: sequence.branch, sequences: [] })
    groups.get(key).sequences.push(sequence)
  }
  return [...groups.values()]
}

/** Consecutivos de documentos (D-CFG-3). Pantalla para quien tiene document_sequences.manage. */
export default function SequencesPage() {
  const toast = useToast()
  const { data: sequences = [], isLoading, error, refetch } = useGetSequencesQuery()
  const [editing, setEditing] = useState(null)
  const groups = groupByBranch(sequences)

  let content
  if (isLoading) {
    content = (
      <div className="settings-loader">
        <Spinner size="lg" label="Cargando consecutivos…" />
      </div>
    )
  } else if (error) {
    content = (
      <StatusMessage icon={TriangleAlert} tone="danger" title="No se pudieron cargar los consecutivos" description={error.message}>
        <Button icon={RotateCw} onClick={refetch}>
          Reintentar
        </Button>
      </StatusMessage>
    )
  } else {
    content = groups.map((group) => (
      <section key={group.branch?.id ?? 0} className="sequences-group" aria-label={group.branch ? `Sucursal ${group.branch.name}` : 'Consecutivos'}>
        {groups.length > 1 && group.branch && <h2 className="sequences-group__title">{group.branch.name}</h2>}
        <ul className="sequences-grid">
          {group.sequences.map((sequence) => (
            <li key={sequence.id} className="sequence-card">
              <SequenceTicket compact documentName={sequence.documentName} number={sequence.preview} />
              <div className="sequence-card__footer">
                <span className="sequence-card__detail">
                  Prefijo <strong>{sequence.prefix || 'ninguno'}</strong>
                </span>
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(sequence)} aria-label={`Editar el consecutivo de ${sequence.documentName}`}>
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    ))
  }

  return (
    <>
      <PageHeader description="Numeración de los documentos que emite el sistema. Cada número se usa una sola vez: no hay saltos ni repetidos." />
      {content}
      {editing && (
        <SequenceFormModal
          sequence={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            toast.success(`${saved.documentName}: el próximo será ${saved.preview}`)
          }}
        />
      )}
    </>
  )
}
