import { useState } from 'react'
import { BadgePercent, Cake, IdCard, MapPin, Phone, UserPlus, UserRound, Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Alert } from '../../components/feedback/Alert/Alert'
import { splitApiError } from '../../utils/formErrors'
import { isValidPhone } from '../../utils/identityDocument'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../utils/numberInput'
import { SUPPLIER_DOCUMENT_TYPES } from '../inventory/inventoryOptions'
import { todayIso } from '../purchases/purchaseOptions'
import { useCreateCustomerMutation, useUpdateCustomerMutation } from './customersApi'
import { useGetPriceListsQuery } from './priceLists/priceListsApi'
import { priceListLabel } from './priceLists/priceListOptions'
import { useCan } from '../../hooks/usePermissions'
import '../admin/admin.css'

function initialForm(customer) {
  return {
    name: customer?.name ?? '',
    documentType: customer?.documentType ?? '',
    documentNumber: customer?.documentNumber ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    location: customer?.location ?? '',
    birthDate: customer?.birthDate ?? '',
    creditLimit: toInputMoney(customer?.creditLimit),
    priceListId: customer?.priceList ? String(customer.priceList.id) : '',
    notes: customer?.notes ?? '',
  }
}

/** Edad que tendrá con la fecha escrita (solo para mostrar). */
function ageFrom(birthDate) {
  if (!birthDate) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  const [ty, tm, td] = todayIso().split('-').map(Number)
  return ty - year - (tm < month || (tm === month && td < day) ? 1 : 0)
}

/**
 * Crear o editar un cliente (D-CLI-2). Solo el nombre es obligatorio; el celular hace falta
 * para fiarle (recordatorios por WhatsApp) y la fecha de nacimiento para el aviso de cumpleaños.
 */
export function CustomerFormModal({ customer, onClose, onSaved }) {
  const isEdit = Boolean(customer)
  const [form, setForm] = useState(() => initialForm(customer))
  // Asignar una lista de precios da precios más bajos: solo quien administra las listas (D-PRE-1)
  const canAssignList = useCan('price_lists.manage')
  const { data: priceLists = [] } = useGetPriceListsQuery(undefined, { skip: !canAssignList })
  const listOptions = priceLists
    .filter((list) => list.isActive || String(list.id) === form.priceListId)
    .map((list) => ({ value: String(list.id), label: `${priceListLabel(list)}${list.isActive ? '' : ' (desactivada)'}` }))
  const [localErrors, setLocalErrors] = useState({})
  const [createCustomer, createState] = useCreateCustomerMutation()
  const [updateCustomer, updateState] = useUpdateCustomerMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const bind = (name) => ({ value: form[name], error: fieldErrors[name], onChange: (event) => set(name, event.target.value) })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre (mínimo 2 caracteres)'
    if (form.documentNumber.trim() && !form.documentType) errors.documentType = 'Selecciona el tipo de documento'
    if (form.phone.trim() && !isValidPhone(form.phone)) errors.phone = 'El celular debe tener entre 7 y 15 dígitos'
    if (form.birthDate && form.birthDate > todayIso()) errors.birthDate = 'La fecha de nacimiento no puede ser futura'
    const limit = toApiNumber(form.creditLimit)
    if (limit && !MONEY_PATTERN.test(limit)) errors.creditLimit = 'Escribe el cupo (ej. 500.000) o déjalo vacío'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return

    const body = {
      name: form.name.trim(),
      documentType: form.documentNumber.trim() ? form.documentType : null,
      documentNumber: form.documentNumber.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      location: form.location.trim() || null,
      birthDate: form.birthDate || null,
      creditLimit: limit || null,
      notes: form.notes.trim() || null,
      // Solo quien administra las listas la manda (el servidor también lo exige)
      ...(canAssignList && { priceListId: form.priceListId ? Number(form.priceListId) : null }),
    }
    try {
      const saved = isEdit ? await updateCustomer({ id: customer.id, ...body }).unwrap() : await createCustomer(body).unwrap()
      onSaved(saved, isEdit)
    } catch {
      // Se muestra desde `error`
    }
  }

  const age = ageFrom(form.birthDate)
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="lg"
      icon={isEdit ? UserRound : UserPlus}
      title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
      description="Solo el nombre es obligatorio. Para fiarle, registra su celular."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="customer-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Registrar cliente'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={UserRound} title="Datos del cliente">
          <TextField className="form-section__full" label="Nombre" icon={UserRound} placeholder="Ej.: Pedro Gómez" maxLength={150} data-autofocus required {...bind('name')} />
          <TextField label="Celular" icon={Phone} inputMode="tel" placeholder="Ej.: 300 123 4567" hint="Para recordarle pagos por WhatsApp." maxLength={20} {...bind('phone')} />
          <TextField label="Correo" type="email" maxLength={150} {...bind('email')} />
          <SelectField label="Tipo de documento" placeholder="Sin documento" options={SUPPLIER_DOCUMENT_TYPES} {...bind('documentType')} />
          <TextField label="Número de documento" icon={IdCard} maxLength={20} {...bind('documentNumber')} />
        </FormSection>
        <FormSection icon={MapPin} title="Dónde vive">
          <TextField label="Vereda, finca o sector" icon={MapPin} placeholder="Ej.: Vereda El Tambo" maxLength={150} {...bind('location')} />
          <TextField label="Dirección" maxLength={255} {...bind('address')} />
        </FormSection>
        <FormSection icon={Cake} title="Cumpleaños y crédito">
          <TextField label="Fecha de nacimiento" type="date" icon={Cake} hint={age !== null && age >= 0 ? `${age} años. La campana avisa su cumpleaños.` : 'Opcional. La campana avisa su cumpleaños.'} {...bind('birthDate')} />
          <TextField
            label="Cupo de crédito"
            icon={Wallet}
            inputMode="decimal"
            placeholder="Sin cupo"
            hint="Opcional. Si una deuda lo pasa, el sistema avisa (no bloquea)."
            {...bind('creditLimit')}
            onBlur={() => set('creditLimit', toInputMoney(toApiNumber(form.creditLimit)))}
          />
          <TextAreaField className="form-section__full" label="Notas" rows={2} maxLength={500} {...bind('notes')} />
        </FormSection>
        {canAssignList && (listOptions.length > 0 || form.priceListId) && (
          <FormSection icon={BadgePercent} title="Precios" description="Con una lista, el punto de venta le cobra sus precios al escogerlo.">
            <SelectField label="Lista de precios" options={[{ value: '', label: 'Precio normal' }, ...listOptions]} {...bind('priceListId')} />
          </FormSection>
        )}
      </form>
    </Modal>
  )
}
