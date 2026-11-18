import { useState } from 'react'
import { Building2, Contact, Hash, MapPin, Phone, Store } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useCreateBranchMutation, useUpdateBranchMutation } from '../adminApi'
import { BranchPreview } from './BranchPreview'

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,20}$/

/** Crear o editar una sucursal, con vista previa. El código solo se define al crear (D-ADM-5). */
export function BranchFormModal({ branch, onClose, onSaved }) {
  const isEdit = Boolean(branch)
  const [form, setForm] = useState({
    code: branch?.code ?? '',
    name: branch?.name ?? '',
    address: branch?.address ?? '',
    phone: branch?.phone ?? '',
  })
  const [localErrors, setLocalErrors] = useState({})
  const [createBranch, createState] = useCreateBranchMutation()
  const [updateBranch, updateState] = useUpdateBranchMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!isEdit && !CODE_PATTERN.test(form.code.trim())) errors.code = 'De 2 a 20 caracteres: letras, números, guion o guion bajo'
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre de la sucursal'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return

    const body = { name: form.name, address: form.address.trim() || null, phone: form.phone.trim() || null }
    try {
      const saved = isEdit
        ? await updateBranch({ id: branch.id, ...body }).unwrap()
        : await createBranch({ code: form.code, ...body }).unwrap()
      onSaved(saved, isEdit)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={Building2}
      title={isEdit ? 'Editar sucursal' : 'Nueva sucursal'}
      description="Los campos con * son obligatorios."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="branch-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Crear sucursal'}
          </Button>
        </>
      }
    >
      <FormWithPreview
        previewLabel="Así se verá"
        preview={<BranchPreview code={form.code} name={form.name} address={form.address} phone={form.phone} isActive={branch?.isActive ?? true} />}
      >
        <form id="branch-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          <FormSection icon={Store} title="Identificación" description="Cómo se reconoce en informes y documentos.">
            <TextField
              label="Código"
              name="code"
              icon={Hash}
              placeholder="Ej.: MAIN, NORTE"
              data-autofocus={!isEdit || undefined}
              value={form.code}
              onChange={handleChange}
              error={fieldErrors.code}
              disabled={isEdit}
              hint={isEdit ? 'El código no se puede cambiar.' : 'No se puede cambiar después.'}
              required={!isEdit}
            />
            <TextField
              label="Nombre"
              name="name"
              icon={Store}
              placeholder="Ej.: Sede principal"
              data-autofocus={isEdit || undefined}
              value={form.name}
              onChange={handleChange}
              error={fieldErrors.name}
              required
            />
          </FormSection>

          <FormSection icon={Contact} title="Contacto" description="Opcional. Aparece en los comprobantes de esta sucursal.">
            <TextField
              className="form-section__full"
              label="Dirección"
              name="address"
              icon={MapPin}
              placeholder="Ej.: Calle 10 # 5-20, centro"
              value={form.address}
              onChange={handleChange}
              error={fieldErrors.address}
            />
            <TextField
              label="Teléfono"
              name="phone"
              type="tel"
              icon={Phone}
              placeholder="Ej.: 3001234567"
              value={form.phone}
              onChange={handleChange}
              error={fieldErrors.phone}
            />
          </FormSection>
        </form>
      </FormWithPreview>
    </Modal>
  )
}
