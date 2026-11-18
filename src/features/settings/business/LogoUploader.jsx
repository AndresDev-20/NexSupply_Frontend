import { useRef, useState } from 'react'
import { ImagePlus, ImageUp, Trash2 } from 'lucide-react'
import { logoUrl, useRemoveLogoMutation, useUploadLogoMutation } from '../settingsApi'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Button } from '../../../components/ui/Button/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import './LogoUploader.css'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

/** Revisión rápida en el navegador. La verdadera la hace el backend con el contenido del archivo. */
function checkFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return 'El logo debe ser una imagen PNG, JPG o WEBP'
  if (file.size > MAX_BYTES) return 'El logo supera el tamaño máximo de 2 MB'
  return null
}

/**
 * Logo del negocio: se sube al elegirlo (no espera al botón "Guardar cambios").
 * Acepta clic o arrastrar y soltar.
 */
export function LogoUploader({ logo }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [uploadLogo, uploadState] = useUploadLogoMutation()
  const [removeLogo, removeState] = useRemoveLogoMutation()
  const isBusy = uploadState.isLoading || removeState.isLoading

  const handleFile = async (file) => {
    if (!file) return
    const error = checkFile(file)
    setLocalError(error)
    if (error) return
    try {
      await uploadLogo(file).unwrap()
      toast.success('Logo actualizado')
    } catch (uploadError) {
      setLocalError(uploadError.message)
    }
  }

  const handleRemove = async () => {
    try {
      await removeLogo().unwrap()
      toast.success('Logo eliminado')
    } catch (removeError) {
      toast.error(removeError.message)
    }
    setConfirmRemove(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    if (!isBusy) handleFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className="logo-uploader">
      <div
        className={`logo-uploader__drop${isDragging ? ' logo-uploader__drop--dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="logo-uploader__frame">
          {logo ? (
            <img className="logo-uploader__image" src={logoUrl(logo)} alt="Logo actual del negocio" />
          ) : (
            <ImagePlus className="logo-uploader__placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="logo-uploader__info">
          <p className="logo-uploader__title">{logo ? 'Logo del negocio' : 'Aún no hay logo'}</p>
          <p className="logo-uploader__hint">PNG, JPG o WEBP de máximo 2 MB. Se recomienda fondo transparente. Arrástralo aquí o elígelo.</p>
          <div className="logo-uploader__actions">
            <Button size="sm" icon={ImageUp} onClick={() => inputRef.current?.click()} isLoading={uploadState.isLoading} disabled={isBusy}>
              {logo ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            {logo && (
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmRemove(true)} disabled={isBusy}>
                Quitar
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="u-visually-hidden"
          aria-label="Archivo del logo"
          tabIndex={-1}
          onChange={(event) => {
            handleFile(event.target.files?.[0])
            // Permite volver a elegir el mismo archivo después de un error
            event.target.value = ''
          }}
        />
      </div>
      {localError && (
        <p className="logo-uploader__error" role="alert">
          {localError}
        </p>
      )}

      <ConfirmDialog
        isOpen={confirmRemove}
        tone="danger"
        title="Quitar el logo"
        message="Los comprobantes y la pantalla de inicio de sesión dejarán de mostrar el logo. Puedes subir otro cuando quieras."
        confirmLabel="Quitar logo"
        isLoading={removeState.isLoading}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}
