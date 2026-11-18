import { useState } from 'react'
import { useSelector } from 'react-redux'
import { ArrowLeft, ArrowRight, AtSign, CreditCard, IdCard, KeyRound, Mail, Phone, User, UserPen, UserPlus } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { Checkbox } from '../../../components/ui/Checkbox/Checkbox'
import { selectBranches } from '../../auth/authSlice'
import { Stepper } from '../../../components/ui/Stepper/Stepper'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useCreateUserMutation, useUpdateUserMutation } from '../adminApi'
import { UserBadgePreview } from './UserBadgePreview'
import { DOCUMENT_TYPES, formatDocument, isValidPhone, normalizeDocumentNumber, validateDocument } from '../../../utils/identityDocument'

const STEPS = [
  { id: 'person', label: 'Persona', fields: ['fullName', 'documentType', 'documentNumber', 'phone', 'email'] },
  { id: 'access', label: 'Acceso', fields: ['username', 'roleId', 'branchId', 'branchIds'] },
]
const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function initialForm(user) {
  return {
    username: user?.username ?? '',
    fullName: user?.fullName ?? '',
    documentType: user?.documentType ?? 'CC',
    documentNumber: user?.documentNumber ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    roleId: user?.role?.id ? String(user.role.id) : '',
    branchId: user?.branch?.id ? String(user.branch.id) : '',
    // Otras sucursales a las que entra, además de la principal (Fase 17)
    extraBranchIds: (user?.branches ?? []).map((branch) => String(branch.id)).filter((id) => id !== String(user?.branch?.id ?? '')),
  }
}

/**
 * Validación inmediata de cada paso, para no avanzar con datos incompletos.
 * El backend vuelve a validar todo al guardar.
 */
function validateStep(stepIndex, form, isEdit) {
  const errors = {}
  if (stepIndex === 0) {
    if (form.fullName.trim().length < 2) errors.fullName = 'Escribe el nombre completo'
    const documentError = validateDocument(form.documentType, form.documentNumber)
    if (documentError) errors.documentNumber = documentError
    if (form.phone.trim() && !isValidPhone(form.phone)) errors.phone = 'Entre 7 y 15 dígitos'
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Ingresa un correo válido'
  } else {
    if (!isEdit && !USERNAME_PATTERN.test(form.username.trim().toLowerCase())) {
      errors.username = 'De 3 a 50 caracteres: minúsculas, números, punto, guion o guion bajo'
    }
    if (!form.roleId) errors.roleId = 'Selecciona un rol'
    if (!form.branchId) errors.branchId = 'Selecciona una sucursal'
  }
  return errors
}

/**
 * Crear o editar un usuario en dos pasos (Persona → Acceso) con el carné en vivo.
 * - El nombre de usuario solo se define al crear (D-ADM-4).
 * - Al crear, el padre recibe { user, temporaryPassword } para mostrar la temporal.
 * - Nadie puede cambiarse su propio rol: el campo queda bloqueado.
 */
export function UserFormModal({ user, roles, branches, isSelf, onClose, onCreated, onUpdated }) {
  const isEdit = Boolean(user)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => initialForm(user))
  const [localErrors, setLocalErrors] = useState({})
  const [createUser, createState] = useCreateUserMutation()
  const [updateUser, updateState] = useUpdateUserMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const roleName = roles.find((role) => String(role.id) === form.roleId)?.name ?? user?.role?.name
  const branchName = branches.find((branch) => String(branch.id) === form.branchId)?.name ?? user?.branch?.name
  // Varias sucursales (Fase 17): solo si hay más de una activa. Nadie da acceso a una sucursal a la que él no entra.
  const myBranchIds = new Set(useSelector(selectBranches).map((branch) => String(branch.id)))
  const hasManyBranches = branches.length > 1
  const selectedRole = roles.find((role) => String(role.id) === form.roleId) ?? (isEdit && String(user.role?.id) === form.roleId ? user.role : null)
  const entersAll = Boolean(selectedRole?.isSystemRole) || (isEdit && user.accessToAllBranches && String(user.role?.id) === form.roleId)
  const extraOptions = branches.filter((branch) => String(branch.id) !== form.branchId)
  const extraCount = form.extraBranchIds.filter((id) => id !== form.branchId).length
  const isLastStep = step === STEPS.length - 1

  const handleChange = (event) => {
    const { name, value } = event.target
    // La principal nunca queda repetida entre las otras sucursales
    setForm((current) => ({ ...current, [name]: value, ...(name === 'branchId' ? { extraBranchIds: current.extraBranchIds.filter((id) => id !== value) } : {}) }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const toggleExtraBranch = (id, checked) => {
    setForm((current) => ({ ...current, extraBranchIds: checked ? [...current.extraBranchIds, id] : current.extraBranchIds.filter((item) => item !== id) }))
    setLocalErrors((current) => ({ ...current, branchIds: undefined }))
  }

  const goNext = () => {
    const errors = validateStep(step, form, isEdit)
    setLocalErrors(errors)
    if (Object.keys(errors).length === 0) setStep((current) => current + 1)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isLastStep) {
      goNext()
      return
    }
    const errors = validateStep(step, form, isEdit)
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return

    const body = {
      fullName: form.fullName,
      documentType: form.documentType,
      documentNumber: form.documentNumber,
      phone: form.phone.trim() === '' ? null : form.phone,
      email: form.email.trim() === '' ? null : form.email,
      roleId: Number(form.roleId),
      branchId: Number(form.branchId),
    }
    if (hasManyBranches) {
      // Las sucursales inactivas que ya tenía se conservan: no salen en la lista, pero no se le quitan
      const listed = new Set(branches.map((branch) => String(branch.id)))
      const kept = (user?.branches ?? []).map((branch) => String(branch.id)).filter((id) => !listed.has(id))
      body.branchIds = [...new Set([...form.extraBranchIds, ...kept])].filter((id) => id !== form.branchId).map(Number)
    }
    try {
      if (isEdit) {
        if (isSelf) delete body.roleId
        onUpdated(await updateUser({ id: user.id, ...body }).unwrap())
      } else {
        onCreated(await createUser({ username: form.username, ...body }).unwrap())
      }
    } catch (saveError) {
      // Si el servidor rechaza un campo de un paso anterior, se vuelve a ese paso
      const firstField = saveError?.details?.[0]?.field
      const stepWithError = STEPS.findIndex((item) => item.fields.includes(firstField))
      if (stepWithError >= 0) setStep(stepWithError)
    }
  }

  const status = !isEdit ? 'new' : !user.isActive ? 'inactive' : user.mustChangePassword ? 'mustChange' : 'active'

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={isEdit ? UserPen : UserPlus}
      title={isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      description={isEdit ? `Usuario @${user.username} · Los campos con * son obligatorios.` : 'Los campos con * son obligatorios.'}
      footer={
        <>
          {step === 0 ? (
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
          ) : (
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(step - 1)} disabled={isLoading}>
              Atrás
            </Button>
          )}
          {isLastStep ? (
            <Button type="submit" form="user-form" isLoading={isLoading}>
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          ) : (
            <Button type="submit" form="user-form" className="button--icon-end" icon={ArrowRight}>
              Siguiente
            </Button>
          )}
        </>
      }
    >
      <FormWithPreview
        previewLabel="Así queda su carné"
        preview={
          <UserBadgePreview
            fullName={form.fullName}
            username={isEdit ? user.username : form.username.trim().toLowerCase()}
            email={form.email.trim()}
            document={formatDocument(form.documentType, normalizeDocumentNumber(form.documentNumber))}
            phone={form.phone.trim()}
            roleName={roleName}
            branchName={branchName}
            status={status}
          />
        }
      >
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />

        <form id="user-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          {step === 0 && (
            <FormSection icon={IdCard} title="Datos de la persona" description="Quién va a usar el sistema.">
              <TextField
                className="form-section__full"
                label="Nombre completo"
                name="fullName"
                icon={User}
                placeholder="Ej.: Ana María Pérez"
                data-autofocus
                value={form.fullName}
                onChange={handleChange}
                error={fieldErrors.fullName}
                required
              />
              <SelectField
                label="Tipo de documento"
                name="documentType"
                options={DOCUMENT_TYPES}
                value={form.documentType}
                onChange={handleChange}
                error={fieldErrors.documentType}
                required
              />
              <TextField
                label="Número de documento"
                name="documentNumber"
                icon={CreditCard}
                inputMode={form.documentType === 'PA' ? 'text' : 'numeric'}
                placeholder={form.documentType === 'PA' ? 'Ej.: AB123456' : 'Ej.: 1023456789'}
                value={form.documentNumber}
                onChange={handleChange}
                error={fieldErrors.documentNumber}
                required
              />
              <TextField
                label="Teléfono"
                name="phone"
                type="tel"
                icon={Phone}
                placeholder="3001234567"
                value={form.phone}
                onChange={handleChange}
                error={fieldErrors.phone}
                hint="Opcional."
              />
              <TextField
                label="Correo"
                name="email"
                type="email"
                icon={Mail}
                placeholder="usuario@ejemplo.com"
                value={form.email}
                onChange={handleChange}
                error={fieldErrors.email}
                hint="Opcional. Para recuperar su contraseña."
              />
            </FormSection>
          )}

          {step === 1 && (
            <FormSection icon={KeyRound} title="Acceso al sistema" description="Con qué ingresa y qué puede hacer.">
              {!isEdit && (
                <TextField
                  className="form-section__full"
                  label="Usuario"
                  name="username"
                  icon={AtSign}
                  placeholder="ej.: ana.perez"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-autofocus
                  value={form.username}
                  onChange={handleChange}
                  error={fieldErrors.username}
                  hint="Con este nombre inicia sesión. No se puede cambiar después."
                  required
                />
              )}
              <SelectField
                label="Rol"
                name="roleId"
                placeholder="Selecciona un rol"
                options={roles.map((role) => ({ value: String(role.id), label: role.name }))}
                value={form.roleId}
                onChange={handleChange}
                error={fieldErrors.roleId}
                disabled={isSelf}
                hint={isSelf ? 'No puedes cambiar tu propio rol.' : 'Define lo que puede ver y hacer.'}
                required
              />
              <SelectField
                label={hasManyBranches ? 'Sucursal principal' : 'Sucursal'}
                name="branchId"
                placeholder="Selecciona una sucursal"
                options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
                value={form.branchId}
                onChange={handleChange}
                error={fieldErrors.branchId}
                hint={hasManyBranches ? 'Con la que abre el sistema al iniciar sesión.' : 'Dónde trabaja.'}
                required
              />
              {hasManyBranches && (
                <fieldset className="form-section__full user-branches">
                  <legend className="user-branches__legend">Otras sucursales donde trabaja</legend>
                  {entersAll ? (
                    <Alert tone="info">Con este rol entra a todas las sucursales activas.</Alert>
                  ) : (
                    <>
                      <p className="user-branches__hint">Podrá cambiar entre ellas desde la barra superior. {extraCount > 0 ? `Entra a ${extraCount + 1} sucursales.` : 'Por ahora solo entra a la principal.'}</p>
                      <div className="user-branches__list">
                        {extraOptions.map((branch) => {
                          const id = String(branch.id)
                          const canGrant = myBranchIds.has(id)
                          return (
                            <Checkbox
                              key={id}
                              label={branch.name}
                              description={canGrant ? branch.code : 'No puedes dar acceso: tú no entras a esta sucursal'}
                              checked={form.extraBranchIds.includes(id)}
                              disabled={!canGrant && !form.extraBranchIds.includes(id)}
                              onChange={(checked) => toggleExtraBranch(id, checked)}
                            />
                          )
                        })}
                      </div>
                    </>
                  )}
                  {fieldErrors.branchIds && <p className="user-branches__error" role="alert">{fieldErrors.branchIds}</p>}
                </fieldset>
              )}
              {!isEdit && (
                <div className="form-section__full">
                  <Alert tone="info">
                    Al crear el usuario, el sistema generará una <strong>contraseña temporal</strong> para que se la entregues.
                  </Alert>
                </div>
              )}
            </FormSection>
          )}
        </form>
      </FormWithPreview>
    </Modal>
  )
}
