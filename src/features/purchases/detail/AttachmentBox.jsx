import { useRef } from 'react'
import { ExternalLink, FileUp, Paperclip } from 'lucide-react'
import { openPurchaseAttachment, useUploadPurchaseAttachmentMutation } from '../purchasesApi'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Button } from '../../../components/ui/Button/Button'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']

/**
 * Factura del proveedor adjunta (D13): PDF, JPG o PNG de máximo 5 MB. El navegador revisa
 * tipo y tamaño para avisar rápido; la validación real (por el contenido) la hace el backend.
 */
export function AttachmentBox({ purchase }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const canUpload = useCan('purchases.create') && purchase.status !== 'cancelled'
  const [upload, { isLoading }] = useUploadPurchaseAttachmentMutation()

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED.includes(file.type)) return toast.error('La factura debe ser un PDF o una imagen JPG o PNG')
    if (file.size > MAX_BYTES) return toast.error('La factura supera el tamaño máximo de 5 MB')
    try {
      await upload({ id: purchase.id, file }).unwrap()
      toast.success('Factura adjuntada')
    } catch (uploadError) {
      toast.error(uploadError.message)
    }
  }

  const handleOpen = async () => {
    try {
      await openPurchaseAttachment(purchase.id)
    } catch (openError) {
      toast.error(openError.message)
    }
  }

  return (
    <section className="attachment-box" aria-label="Factura del proveedor">
      <span className="attachment-box__icon" aria-hidden="true">
        <Paperclip />
      </span>
      <span className="attachment-box__text">
        <span className="attachment-box__title">Factura del proveedor</span>
        <span className="attachment-box__detail">{purchase.attachment ? purchase.attachment.name : 'Sin adjuntar · PDF, JPG o PNG hasta 5 MB'}</span>
      </span>
      <span className="attachment-box__actions">
        {purchase.attachment && (
          <Button size="sm" variant="secondary" icon={ExternalLink} onClick={handleOpen}>
            Ver
          </Button>
        )}
        {canUpload && (
          <>
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={handleFile} aria-label="Elegir la factura" />
            <Button size="sm" variant={purchase.attachment ? 'ghost' : 'secondary'} icon={FileUp} isLoading={isLoading} onClick={() => inputRef.current?.click()}>
              {purchase.attachment ? 'Cambiar' : 'Adjuntar'}
            </Button>
          </>
        )}
      </span>
    </section>
  )
}
