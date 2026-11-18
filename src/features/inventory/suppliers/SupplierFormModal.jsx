import { useState } from 'react'
import { Building2, CalendarClock, Contact, FileText, Hash, Mail, MapPin, MessageSquareText, Phone, Store, Truck, User } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Stepper } from '../../../components/ui/Stepper/Stepper'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { isValidPhone, validateSupplierDocument } from '../../../utils/identityDocument'
import { useCreateSupplierMutation, useUpdateSupplierMutation } from '../inventoryApi'
import { SUPPLIER_DOCUMENT_TYPES } from '../inventoryOptions'
import { SupplierPreview } from './SupplierPreview'
import '../../settings/settings.css'

const STEPS = [
  { id: 'company', label: 'Empresa', fields: ['documentType', 'documentNumber', 'legalName', 'tradeName'] },
  { id: 'contact', label: 'Contacto', fields: ['phone', 'contactName', 'contactPhone', 'email', 'address', 'city'] },
  { id: 'terms', label: 'Condiciones', fields: ['paymentTermDays', 'notes'] },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function initialForm(supplier) {
  return {
    documentType: supplier?.documentType ?? 'NIT',
    documentNumber: supplier?.documentNumber ?? '',
    legalName: supplier?.legalName ?? '',
    tradeName: supplier?.tradeName ?? '',
    phone: supplier?.phone ?? '',
    contactName: supplier?.contactName ?? '',
    contactPhone: supplier?.contactPhone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    city: supplier?.city ?? '',
    paymentTermDays: String(supplier?.paymentTermDays ?? 0),
    notes: supplier?.notes ?? '',
  }
}

/** Validación del paso, para no avanzar con datos que el backend va a rechazar. */
function validateStep(step, form) {
  const errors = {}
  if (step === 0) {
    const documentError = validateSupplierDocument(form.documentType, form.documentNumber)
    if (documentError) errors.documentNumber = documentError
    if (form.legalName.trim().length < 2) errors.legalName = 'Escribe la razón social'
  }
  if (step === 1) {
    if (!isValidPhone(form.phone)) errors.phone = 'Entre 7 y 15 dígitos'
    if (form.contactPhone.trim() && !isValidPhone(form.contactPhone)) errors.contactPhone = 'Entre 7 y 15 dígitos'
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) errors.email = 'El correo no es válido'
  }
  if (step === 2) {
    const days = Number(form.paymentTermDays)
    if (!Number.isInteger(days) || days < 0 || days > 365) errors.paymentTermDays = 'Entre 0 y 365 días'
  }
  return errors
}

/** Registrar o editar un proveedor en tres pasos, con su tarjeta en vivo (D-INV-5). */
export function SupplierFormModal({ supplier, onClose, onSaved }) {
  const isEdit = Boolean(supplier)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => initialForm(supplier))
  const [localErrors, setLocalErrors] = useState({})
  const [createSupplier, createState] = useCreateSupplierMutation()
  const [updateSupplier, updateState] = useUpdateSupplierMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const isLastStep = step === STEPS.length - 1

  const field = (name) => ({
    name,
    value: form[name],
    error: fieldErrors[name],
    onChange: (event) => {
      setForm((current) => ({ ...current, [name]: event.target.value }))
      setLocalErrors((current) => ({ ...current, [name]: undefined }))
    },
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = validateStep(step, form)
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!isLastStep) {
      setStep(step + 1)
      return
    }

    const optional = (value) => value.trim() || null
    const body = {
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      legalName: form.legalName.trim(),
      tradeName: optional(form.tradeName),
      phone: form.phone.trim(),
      contactName: optional(form.contactName),
      contactPhone: optional(form.contactPhone),
      email: optional(form.email),
      address: optional(form.address),
      city: optional(form.city),
      paymentTermDays: Number(form.paymentTermDays),
      notes: optional(form.notes),
    }
    try {
      const saved = isEdit ? await updateSupplier({ id: supplier.id, ...body }).unwrap() : await createSupplier(body).unwrap()
      onSaved(saved, isEdit)
    } catch (saveError) {
      // Si el servidor rechaza un campo de otro paso, se vuelve a ese paso
      const stepWithError = STEPS.findIndex((item) => item.fields.includes(saveError?.details?.[0]?.field))
      if (stepWithError >= 0) setStep(stepWithError)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={Truck}
      title={isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}
      description="Los campos con * son obligatorios."
      footer={
        <>
          {step === 0 ? (
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={isLoading}>
              Atrás
            </Button>
          )}
          <Button type="submit" form="supplier-form" isLoading={isLoading}>
            {isLastStep ? (isEdit ? 'Guardar cambios' : 'Registrar proveedor') : 'Siguiente'}
          </Button>
        </>
      }
    >
      <FormWithPreview previewLabel="Tarjeta del proveedor" preview={<SupplierPreview form={form} />}>
        <Stepper steps={STEPS} current={step} onStepClick={(index) => index < step && setStep(index)} />
        <form id="supplier-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          {step === 0 && (
            <FormSection icon={Building2} title="Empresa" description="Como aparece en sus facturas.">
              <SelectField label="Tipo de documento" options={SUPPLIER_DOCUMENT_TYPES} {...field('documentType')} required />
              <TextField label="Número de documento" icon={Hash} placeholder="Ej.: 900123456-7" data-autofocus {...field('documentNumber')} required />
              <TextField
                className="form-section__full"
                label="Razón social"
                icon={Building2}
                placeholder="Ej.: Distribuidora Agrícola del Huila S.A.S."
                maxLength={150}
                {...field('legalName')}
                required
              />
              <TextField
                className="form-section__full"
                label="Nombre comercial"
                icon={Store}
                placeholder="Ej.: Agrohuila"
                hint="Opcional. Como lo conocen."
                maxLength={150}
                {...field('tradeName')}
              />
            </FormSection>
          )}

          {step === 1 && (
            <FormSection icon={Contact} title="Contacto" description="Para pedidos y despachos.">
              <TextField label="Teléfono" type="tel" icon={Phone} placeholder="Ej.: 6088712345" data-autofocus {...field('phone')} required />
              <TextField label="Correo" type="email" icon={Mail} placeholder="Ej.: pedidos@agrohuila.com" hint="Opcional." {...field('email')} />
              <TextField label="Vendedor o asesor" icon={User} placeholder="Ej.: Marta Ruiz" hint="Opcional." maxLength={120} {...field('contactName')} />
              <TextField label="Teléfono del asesor" type="tel" icon={Phone} placeholder="Ej.: 3001234567" hint="Opcional." {...field('contactPhone')} />
              <TextField label="Dirección" icon={MapPin} hint="Opcional." maxLength={255} {...field('address')} />
              <TextField label="Ciudad" icon={MapPin} placeholder="Ej.: Neiva" hint="Opcional." maxLength={80} {...field('city')} />
            </FormSection>
          )}

          {step === 2 && (
            <FormSection icon={FileText} title="Condiciones" description="Se usarán en las compras a crédito." columns={1}>
              <TextField
                label="Plazo de pago (días)"
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                icon={CalendarClock}
                data-autofocus
                hint="0 = de contado. Con él se calcula cuándo vence cada compra a crédito."
                {...field('paymentTermDays')}
              />
              <TextAreaField label="Notas" placeholder="Ej.: Visita los martes. Pedido mínimo $ 500.000." maxLength={500} {...field('notes')} />
              <p className="settings-note">
                <MessageSquareText aria-hidden="true" />
                <span>Los productos de este proveedor se asocian desde la ficha de cada producto.</span>
              </p>
            </FormSection>
          )}
        </form>
      </FormWithPreview>
    </Modal>
  )
}
