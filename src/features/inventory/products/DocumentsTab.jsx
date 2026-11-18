import { useRef, useState } from 'react'
import { ExternalLink, FileBadge, FilePlus2, FileUp, Trash2 } from 'lucide-react'
import { openProductDocument, useGetProductDocumentsQuery, useRemoveProductDocumentMutation, useUploadProductDocumentMutation } from '../inventoryApi'
import { PRODUCT_DOCUMENT_TYPES } from '../inventoryOptions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatDateTime } from '../../../utils/format'
import { formatDay } from '../../purchases/purchaseOptions'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Días hasta una fecha "AAAA-MM-DD" (negativo si ya pasó), en la fecha local. */
function daysUntil(date) {
  const [year, month, day] = date.split('-').map(Number)
  const today = new Date()
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
}

function Expiry({ document }) {
  if (!document.expiresOn) return <span className="u-text-muted">No vence</span>
  const days = daysUntil(document.expiresOn)
  const tone = document.isExpired || days < 0 ? 'danger' : days <= 30 ? 'warning' : 'success'
  const label = days < 0 ? 'Vencido' : days === 0 ? 'Vence hoy' : days <= 30 ? `En ${days} ${days === 1 ? 'día' : 'días'}` : 'Vigente'
  return (
    <span className="batch-expiry">
      <span>{formatDay(document.expiresOn)}</span>
      <span className={`status-pill status-pill--${tone}`}>
        <span className="status-pill__dot" aria-hidden="true" />
        {label}
      </span>
    </span>
  )
}

function UploadDocumentModal({ product, onClose, onSaved }) {
  const inputRef = useRef(null)
  const [form, setForm] = useState({ documentType: '', title: '', expiresOn: '', file: null })
  const [localErrors, setLocalErrors] = useState({})
  const [upload, { isLoading, error }] = useUploadProductDocumentMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const pickFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED.includes(file.type)) return setLocalErrors((current) => ({ ...current, file: 'Debe ser un PDF o una imagen JPG o PNG' }))
    if (file.size > MAX_BYTES) return setLocalErrors((current) => ({ ...current, file: 'El archivo supera los 5 MB' }))
    setForm((current) => ({ ...current, file, title: current.title || file.name.replace(/\.[^.]+$/, '').slice(0, 120) }))
    setLocalErrors((current) => ({ ...current, file: undefined, title: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!form.documentType) errors.documentType = 'Selecciona el tipo de documento'
    if (form.title.trim().length < 3) errors.title = 'Escribe el nombre del documento (mínimo 3 caracteres)'
    if (!form.file) errors.file = 'Elige el archivo'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const saved = await upload({ productId: product.id, file: form.file, documentType: form.documentType, title: form.title.trim(), expiresOn: form.expiresOn || null }).unwrap()
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
      icon={FilePlus2}
      title="Agregar documento"
      description={`${product.name}. PDF, JPG o PNG de máximo 5 MB.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="document-form" icon={FileUp} isLoading={isLoading}>
            Guardar documento
          </Button>
        </>
      }
    >
      <form id="document-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <div className={`document-drop${fieldErrors.file ? ' document-drop--invalid' : ''}`}>
          <FileBadge aria-hidden="true" />
          <span className="document-drop__text">
            <span className="document-drop__name">{form.file ? form.file.name : 'Ningún archivo elegido'}</span>
            <span className="document-drop__detail">{fieldErrors.file ?? (form.file ? formatSize(form.file.size) : 'Registro ICA, ficha técnica, certificado…')}</span>
          </span>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={pickFile} aria-label="Elegir el archivo del documento" />
          <Button size="sm" variant="secondary" icon={FileUp} onClick={() => inputRef.current?.click()}>
            {form.file ? 'Cambiar' : 'Elegir archivo'}
          </Button>
        </div>
        <FormSection icon={FileBadge} title="Datos del documento">
          <SelectField
            label="Tipo"
            placeholder="Selecciona…"
            options={Object.entries(PRODUCT_DOCUMENT_TYPES).map(([value, label]) => ({ value, label }))}
            value={form.documentType}
            onChange={(event) => set('documentType', event.target.value)}
            error={fieldErrors.documentType}
            required
          />
          <TextField
            label="Vence el"
            type="date"
            hint="Opcional. La campana avisa antes de que venza."
            value={form.expiresOn}
            onChange={(event) => set('expiresOn', event.target.value)}
            error={fieldErrors.expiresOn}
          />
          <TextField className="form-section__full" label="Nombre" placeholder="Ej.: Registro ICA 2026" maxLength={120} value={form.title} onChange={(event) => set('title', event.target.value)} error={fieldErrors.title} required />
        </FormSection>
      </form>
    </Modal>
  )
}

/** Documentos y certificados del producto (D-INV-18). */
export function DocumentsTab({ product, canEdit }) {
  const toast = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [toRemove, setToRemove] = useState(null)
  const { data = [], isFetching, error, refetch } = useGetProductDocumentsQuery(product.id)
  const [removeDocument, removeState] = useRemoveProductDocumentMutation()

  const open = async (document) => {
    try {
      await openProductDocument(product.id, document.id)
    } catch (openError) {
      toast.error(openError.message)
    }
  }

  const handleRemove = async () => {
    try {
      await removeDocument({ productId: product.id, documentId: toRemove.id }).unwrap()
      toast.success(`${toRemove.title} fue quitado`)
    } catch (removeError) {
      toast.error(removeError.message)
    }
    setToRemove(null)
  }

  const columns = [
    {
      key: 'title',
      header: 'Documento',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <span className="cash-link__name">{row.title}</span>
          <span className="cash-stack__detail">
            {row.documentTypeLabel} · {row.fileName} · {formatSize(row.fileSize)}
          </span>
        </span>
      ),
    },
    { key: 'expires', header: 'Vencimiento', render: (row) => <Expiry document={row} /> },
    { key: 'uploaded', header: 'Subido', render: (row) => `${formatDateTime(row.uploadedAt)} · ${row.uploadedBy?.fullName ?? '—'}` },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) => (
        <div className="row-actions">
          <IconButton icon={ExternalLink} label={`Ver ${row.title}`} onClick={() => open(row)} />
          {canEdit && <IconButton icon={Trash2} tone="danger" label={`Quitar ${row.title}`} onClick={() => setToRemove(row)} />}
        </div>
      ),
    },
  ]

  return (
    <>
      {canEdit && (
        <div className="product-detail__tab-actions">
          <Button size="sm" icon={FilePlus2} onClick={() => setIsUploading(true)}>
            Agregar documento
          </Button>
        </div>
      )}
      <DataTable
        caption="Documentos del producto"
        columns={columns}
        rows={data}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="Sin documentos"
        emptyDescription="Registro ICA, ficha técnica, hoja de seguridad o certificados. Si tienen vencimiento, la campana avisa antes."
      />
      {isUploading && (
        <UploadDocumentModal
          product={product}
          onClose={() => setIsUploading(false)}
          onSaved={(saved) => {
            setIsUploading(false)
            toast.success(`${saved.title} agregado`)
          }}
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(toRemove)}
        tone="danger"
        title="Quitar documento"
        message={toRemove ? `Se quitará "${toRemove.title}" y su archivo. Quedará registrado en la auditoría.` : ''}
        confirmLabel="Quitar"
        isLoading={removeState.isLoading}
        onConfirm={handleRemove}
        onCancel={() => setToRemove(null)}
      />
    </>
  )
}
