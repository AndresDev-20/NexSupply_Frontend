import { useState } from 'react'
import { Calculator, Coins, Percent, Receipt, Tags } from 'lucide-react'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { Switch } from '../../../components/ui/Switch/Switch'
import { SaveBar } from '../../../components/ui/SaveBar/SaveBar'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useSettingsForm } from '../useSettingsForm'
import { SettingsLoader } from '../SettingsLoader'
import '../settings.css'
import './TaxSettingsPage.css'

const FORM_ID = 'tax-settings-form'
const KEYS = ['tax.enabled', 'tax.prices_include_tax', 'rounding.increment']
const PRICES_KEY = 'tax.prices_include_tax'

// Ejemplo fijo para ilustrar el redondeo al más cercano (D-CFG-7). Los cálculos reales los hace el backend.
const SAMPLE_TOTAL = '$ 12.437'
const ROUNDING_OPTIONS = [
  { value: 1, label: 'Sin redondeo', description: 'Total exacto', aside: '$ 12.437' },
  { value: 10, label: 'A la decena', description: 'Múltiplos de $ 10', aside: '$ 12.440' },
  { value: 50, label: 'A $ 50', description: 'Múltiplos de $ 50', aside: '$ 12.450' },
  { value: 100, label: 'A la centena', description: 'Múltiplos de $ 100', aside: '$ 12.400' },
]

const PRICE_OPTIONS = [
  {
    value: true,
    label: 'Mis precios ya incluyen el IVA',
    description: 'Con IVA del 19 %, un producto de $ 11.900 se cobra $ 11.900 (base $ 10.000 + IVA $ 1.900).',
    icon: Tags,
  },
  {
    value: false,
    label: 'El IVA se suma al precio',
    description: 'Con IVA del 19 %, un producto de $ 10.000 se cobra $ 11.900.',
    icon: Calculator,
  },
]

/** IVA y redondeo del total (D4, D4b, D5, D-CFG-7). Requiere el permiso settings.tax. */
export default function TaxSettingsPage() {
  const toast = useToast()
  const form = useSettingsForm(KEYS)
  const { values } = form
  const [confirmOpen, setConfirmOpen] = useState(false)
  const taxEnabled = Boolean(values['tax.enabled'])

  const save = async (confirmTaxChange = false) => {
    try {
      await form.save({ confirmTaxChange })
      setConfirmOpen(false)
      toast.success('Configuración de IVA y redondeo guardada')
    } catch (saveError) {
      // El backend también lo exige: si por algún motivo no se confirmó, se pide aquí
      if (saveError.code === 'CONFIRMATION_REQUIRED') setConfirmOpen(true)
      else {
        setConfirmOpen(false)
        toast.error(saveError.message)
      }
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    // Cambiar el significado de los precios exige confirmación (D4b)
    if (form.changedKeys.includes(PRICES_KEY)) setConfirmOpen(true)
    else save()
  }

  return (
    <>
      <PageHeader description="Cómo se calcula el IVA en las ventas y a qué valor se redondea el total a cobrar." />

      <SettingsLoader isLoading={form.isLoading} error={form.error} onRetry={form.refetch}>
        <form id={FORM_ID} className="tax-settings" onSubmit={handleSubmit} noValidate>
          <FormSection icon={Percent} title="IVA" description="Actívalo solo si el negocio es responsable de IVA." columns={1}>
            <Switch
              label="Cobrar IVA en las ventas"
              description={
                taxEnabled
                  ? 'Cada producto usa su tarifa (0 %, 5 %, 19 %, exento o excluido) y el comprobante muestra base e IVA.'
                  : 'Los precios son finales y el comprobante dice "No responsable de IVA".'
              }
              checked={taxEnabled}
              onChange={(checked) => form.setValue('tax.enabled', checked)}
            />
            {taxEnabled && (
              <div className="settings-subfields">
                <OptionCards
                  legend="¿Cómo están registrados tus precios de venta?"
                  hint="Cambiarlo después cambia el significado de todos los precios: el sistema te pedirá confirmación."
                  name="prices_include_tax"
                  options={PRICE_OPTIONS}
                  value={values[PRICES_KEY]}
                  onChange={(value) => form.setValue(PRICES_KEY, value)}
                />
              </div>
            )}
          </FormSection>

          <FormSection icon={Coins} title="Redondeo del total" description="Se aplica solo al total de la venta, al valor más cercano." columns={1}>
            <OptionCards
              legend={`Ejemplo con un total de ${SAMPLE_TOTAL}`}
              name="rounding_increment"
              options={ROUNDING_OPTIONS}
              columns={4}
              value={values['rounding.increment']}
              onChange={(value) => form.setValue('rounding.increment', value)}
            />
            <p className="settings-note">
              <Receipt aria-hidden="true" />
              <span>La diferencia del redondeo queda registrada en cada venta, para que la caja y los informes cuadren al peso.</span>
            </p>
          </FormSection>

          {form.formError && form.saveError?.code !== 'CONFIRMATION_REQUIRED' && (
            <div className="settings-form__alert">
              <Alert tone="danger">{form.formError}</Alert>
            </div>
          )}

          <SaveBar changesCount={form.changedKeys.length} isSaving={form.isSaving && !confirmOpen} formId={FORM_ID} onDiscard={form.discard} />
        </form>
      </SettingsLoader>

      <ConfirmDialog
        isOpen={confirmOpen}
        tone="danger"
        title="Cambiar cómo se interpretan los precios"
        message={
          values[PRICES_KEY]
            ? 'Desde ahora, todos los precios de venta registrados se tomarán como precios CON IVA incluido. No se modifica ningún precio: cambia cómo se calcula el IVA sobre ellos. ¿Continuar?'
            : 'Desde ahora, a todos los precios de venta registrados se les SUMARÁ el IVA al cobrar. Los clientes pagarán más por los mismos productos. ¿Continuar?'
        }
        confirmLabel="Sí, cambiarlo"
        isLoading={form.isSaving}
        onConfirm={() => save(true)}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
