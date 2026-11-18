import { useState } from 'react'
import { FolderPlus, FolderTree, Percent, ShieldAlert, Stethoscope, Tag } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { Switch } from '../../../components/ui/Switch/Switch'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useCreateCategoryMutation, useUpdateCategoryMutation } from '../inventoryApi'
import { EXPIRED_POLICY_OPTIONS, TAX_RATE_OPTIONS } from '../inventoryOptions'
import { CategoryPreview } from './CategoryPreview'
import '../../settings/settings.css'

/**
 * Crear o editar una categoría o subcategoría (D-INV-1, D-INV-3, D12).
 * `parent`: la categoría principal cuando se crea o edita una subcategoría.
 */
export function CategoryFormModal({ category, parent, onClose, onSaved }) {
  const isEdit = Boolean(category)
  const [form, setForm] = useState({
    name: category?.name ?? '',
    // Una subcategoría nueva propone lo de su categoría (el backend hace lo mismo)
    defaultTaxRate: category?.defaultTaxRate ?? parent?.defaultTaxRate ?? 'excluded',
    expiredSalePolicy: category?.expiredSalePolicy ?? parent?.expiredSalePolicy ?? 'authorization',
    // Las subcategorías la heredan de su categoría principal (D-INV-17)
    isVeterinary: category?.isVeterinary ?? parent?.isVeterinary ?? false,
  })
  const [nameError, setNameError] = useState(null)
  const [createCategory, createState] = useCreateCategoryMutation()
  const [updateCategory, updateState] = useUpdateCategoryMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors, formError } = splitApiError(error)

  const setField = (name, value) => {
    if (name === 'name') setNameError(null)
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.name.trim().length < 2) {
      setNameError('Escribe el nombre (mínimo 2 caracteres)')
      return
    }
    const body = { name: form.name.trim(), defaultTaxRate: form.defaultTaxRate, expiredSalePolicy: form.expiredSalePolicy, ...(!parent && { isVeterinary: form.isVeterinary }) }
    try {
      const saved = isEdit
        ? await updateCategory({ id: category.id, ...body }).unwrap()
        : await createCategory({ ...body, ...(parent && { parentId: parent.id }) }).unwrap()
      onSaved(saved, isEdit)
    } catch {
      // Se muestra desde `error`
    }
  }

  const kind = parent ? 'subcategoría' : 'categoría'
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={isEdit ? FolderTree : FolderPlus}
      title={isEdit ? `Editar ${kind}` : `Nueva ${kind}`}
      description={parent ? `Dentro de "${parent.name}". Los campos con * son obligatorios.` : 'Los campos con * son obligatorios.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : `Crear ${kind}`}
          </Button>
        </>
      }
    >
      <FormWithPreview previewLabel="Así se verá" preview={<CategoryPreview parentName={parent?.name} {...form} />}>
        <form id="category-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          <FormSection icon={Tag} title="Nombre" description={parent ? 'Ej.: Cerdos, Bovinos, Antiparasitarios.' : 'Ej.: Alimentos, Medicamentos, Herramientas.'} columns={1}>
            <TextField
              label="Nombre"
              icon={FolderTree}
              data-autofocus
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              error={nameError || fieldErrors.name}
              maxLength={80}
              required
            />
          </FormSection>

          <FormSection icon={Percent} title="Para los productos nuevos" description="Los productos que se creen aquí heredan estos valores; luego se pueden ajustar uno por uno." columns={1}>
            <SelectField
              label="Tarifa de IVA"
              options={TAX_RATE_OPTIONS}
              value={form.defaultTaxRate}
              onChange={(event) => setField('defaultTaxRate', event.target.value)}
              error={fieldErrors.defaultTaxRate}
              hint="Solo se cobra si el IVA está activo en la configuración."
            />
            <OptionCards
              legend="Venta de productos vencidos"
              name="expired_policy"
              columns={3}
              options={EXPIRED_POLICY_OPTIONS.map((option) => ({ value: option.value, label: option.short, icon: ShieldAlert }))}
              value={form.expiredSalePolicy}
              onChange={(value) => setField('expiredSalePolicy', value)}
            />
          </FormSection>

          <FormSection icon={Stethoscope} title="Productos veterinarios" columns={1}>
            {parent ? (
              <p className="settings-note">
                <Stethoscope aria-hidden="true" />
                <span>
                  Hereda de &quot;{parent.name}&quot;: {parent.isVeterinary ? 'sus productos tienen ficha veterinaria.' : 'sin ficha veterinaria.'}
                </span>
              </p>
            ) : (
              <Switch
                label="Categoría veterinaria"
                description="Sus productos (y los de sus subcategorías) muestran la ficha veterinaria: principio activo, registro ICA, tiempo de retiro, fórmula…"
                checked={form.isVeterinary}
                onChange={(checked) => setField('isVeterinary', checked)}
              />
            )}
          </FormSection>
        </form>
      </FormWithPreview>
    </Modal>
  )
}
