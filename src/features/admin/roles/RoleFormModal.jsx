import { useState } from 'react'
import { ArrowLeft, ArrowRight, FileText, ListChecks, Lock, Percent, ShieldCheck, ShieldPlus } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Stepper } from '../../../components/ui/Stepper/Stepper'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { splitApiError } from '../../../utils/formErrors'
import { useCreateRoleMutation, useGetPermissionCatalogQuery, useUpdateRoleMutation } from '../adminApi'
import { PermissionPicker } from './PermissionPicker'
import { RolePreview } from './RolePreview'

const STEPS = [
  { id: 'info', label: 'Información', fields: ['name', 'description'] },
  { id: 'permissions', label: 'Permisos', fields: ['permissions'] },
]

/**
 * Crear, editar o ver un rol en dos pasos (Información → Permisos) con resumen en vivo.
 * Los roles del sistema se muestran en solo lectura: sus permisos son automáticos (D-ADM-1).
 */
export function RoleFormModal({ role, readOnly: forceReadOnly = false, initialStep = 0, onClose, onSaved }) {
  const isEdit = Boolean(role)
  const isSystemRole = Boolean(role?.isSystemRole)
  // Solo lectura: rol del sistema, o usuario sin permiso de edición
  const readOnly = isSystemRole || forceReadOnly
  // "Asignar permisos" abre directo en el paso de permisos
  const [step, setStep] = useState(readOnly ? 1 : initialStep)
  const [form, setForm] = useState({ name: role?.name ?? '', description: role?.description ?? '', maxDiscountPercent: role?.maxDiscountPercent ? String(Number(role.maxDiscountPercent)) : '0' })
  const [discountError, setDiscountError] = useState(null)
  const [nameError, setNameError] = useState(null)
  const [permissions, setPermissions] = useState(role?.permissions ?? [])
  const { data: catalog = [], isLoading: isLoadingCatalog } = useGetPermissionCatalogQuery()
  const [createRole, createState] = useCreateRoleMutation()
  const [updateRole, updateState] = useUpdateRoleMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors, formError } = splitApiError(error)
  const isLastStep = step === STEPS.length - 1

  const handleChange = (event) => {
    setNameError(null)
    setDiscountError(null)
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isLastStep) {
      if (form.name.trim().length < 2) {
        setNameError('Escribe el nombre del rol')
        return
      }
      const discount = form.maxDiscountPercent.trim().replace(',', '.') || '0'
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(discount) || Number(discount) > 100) {
        setDiscountError('Escribe un porcentaje entre 0 y 100')
        return
      }
      setStep(1)
      return
    }
    const body = { name: form.name, description: form.description.trim() || null, maxDiscountPercent: form.maxDiscountPercent.trim().replace(',', '.') || '0', permissions }
    try {
      const saved = isEdit ? await updateRole({ id: role.id, ...body }).unwrap() : await createRole(body).unwrap()
      onSaved(saved, isEdit)
    } catch (saveError) {
      const firstField = saveError?.details?.[0]?.field
      const stepWithError = STEPS.findIndex((item) => item.fields.includes(firstField))
      if (stepWithError >= 0) setStep(stepWithError)
    }
  }

  const footer = readOnly ? (
    <Button onClick={onClose}>Cerrar</Button>
  ) : (
    <>
      {step === 0 ? (
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
      ) : (
        <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(0)} disabled={isLoading}>
          Atrás
        </Button>
      )}
      {isLastStep ? (
        <Button type="submit" form="role-form" isLoading={isLoading}>
          {isEdit ? 'Guardar cambios' : 'Crear rol'}
        </Button>
      ) : (
        <Button type="submit" form="role-form" className="button--icon-end" icon={ArrowRight}>
          Siguiente
        </Button>
      )}
    </>
  )

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={isSystemRole ? Lock : isEdit ? ShieldCheck : ShieldPlus}
      title={readOnly ? role.name : isEdit ? 'Editar rol' : 'Nuevo rol'}
      description={
        isSystemRole
          ? 'Rol del sistema: tiene todos sus permisos automáticamente y no se puede modificar.'
          : readOnly
            ? 'Permisos de este rol (solo lectura).'
            : 'Los campos con * son obligatorios. Los cambios aplican de inmediato.'
      }
      footer={footer}
    >
      <FormWithPreview
        previewLabel="Resumen del rol"
        preview={<RolePreview name={form.name} description={form.description} catalog={catalog} selected={permissions} isSystemRole={isSystemRole} />}
      >
        {!readOnly && <Stepper steps={STEPS} current={step} onStepClick={setStep} />}

        <form id="role-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          {step === 0 && (
            <FormSection icon={FileText} title="Información del rol" description="Un nombre claro ayuda a asignarlo bien.">
              <TextField
                label="Nombre del rol"
                name="name"
                icon={ShieldCheck}
                data-autofocus
                value={form.name}
                onChange={handleChange}
                error={nameError || fieldErrors.name}
                placeholder="Ej.: Cajero, Bodega, Supervisor"
                required
              />
              <TextField
                label="Descripción"
                name="description"
                value={form.description}
                onChange={handleChange}
                error={fieldErrors.description}
                placeholder="Ej.: Atiende el punto de venta"
                hint="Opcional."
              />
              <TextField
                label="Tope de descuento en el punto de venta (%)"
                name="maxDiscountPercent"
                icon={Percent}
                inputMode="decimal"
                value={form.maxDiscountPercent}
                onChange={handleChange}
                error={discountError || fieldErrors.maxDiscountPercent}
                hint="Hasta este % de descuento en una venta no pide autorización. 0 = todo descuento la pide."
              />
            </FormSection>
          )}

          {step === 1 && (
            <FormSection
              icon={ListChecks}
              title={readOnly ? 'Permisos' : 'Qué puede hacer'}
              description={readOnly ? undefined : 'Marca un módulo completo o permisos sueltos.'}
              columns={1}
            >
              {isSystemRole && (
                <Alert tone="info" title="Permisos automáticos">
                  Este rol recibe también los permisos de los módulos que se agreguen en el futuro.
                </Alert>
              )}
              {fieldErrors.permissions && <Alert tone="danger">{fieldErrors.permissions}</Alert>}
              {isLoadingCatalog ? (
                <Spinner label="Cargando permisos…" />
              ) : (
                <PermissionPicker
                  catalog={catalog}
                  selected={isSystemRole ? catalog.flatMap((group) => group.permissions.map((p) => p.code)) : permissions}
                  onChange={setPermissions}
                  readOnly={readOnly}
                />
              )}
            </FormSection>
          )}
        </form>
      </FormWithPreview>
    </Modal>
  )
}
