import { Archive, FileText } from 'lucide-react'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { SaveBar } from '../../../components/ui/SaveBar/SaveBar'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useSettingsForm } from '../useSettingsForm'
import { SettingsLoader } from '../SettingsLoader'
import '../settings.css'

const FORM_ID = 'sales-settings-form'
const KEYS = ['quotes.validity_days', 'layaway.min_down_payment_percent', 'layaway.default_term_days', 'layaway.due_alert_days']

const days = (values) => values.map((value) => ({ value, label: `${value} ${value === 1 ? 'día' : 'días'}` }))

/**
 * Configuración → Cotizaciones y apartados (D-COT-1, D-APA-1, D-APA-2): cuánto vale una
 * cotización, el abono mínimo y el plazo de los apartados. Cada cotización o apartado puede
 * cambiarlo al hacerlo; aquí está lo que se propone.
 */
export default function SalesSettingsPage() {
  const toast = useToast()
  const form = useSettingsForm(KEYS)
  const { values } = form

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await form.save()
      toast.success('Configuración guardada')
    } catch (saveError) {
      toast.error(saveError.message)
    }
  }

  const field = (key, legend, options) => (
    <OptionCards legend={legend} name={key.replace(/\./g, '_')} options={options} columns={3} value={values[key]} onChange={(value) => form.setValue(key, value)} />
  )

  return (
    <>
      <PageHeader description="Lo que se propone al cotizar y al apartar. Cada cotización o apartado lo puede cambiar al hacerlo." />
      <SettingsLoader isLoading={form.isLoading} error={form.error} onRetry={form.refetch}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormSection icon={FileText} title="Cotizaciones" description="Mientras esté vigente, al vender la cotización se respetan sus precios." columns={1}>
            {field('quotes.validity_days', 'Una cotización vale por', days([5, 8, 15, 30, 45, 60]))}
          </FormSection>
          <FormSection icon={Archive} title="Apartados" description="El producto queda reservado mientras el cliente termina de pagar." columns={1}>
            {field('layaway.min_down_payment_percent', 'Abono inicial mínimo', [0, 10, 20, 30, 40, 50].map((value) => ({ value, label: value === 0 ? 'Sin mínimo' : `${value} %` })))}
            {field('layaway.default_term_days', 'Plazo para terminar de pagar', days([8, 15, 30, 45, 60, 90]))}
            {field('layaway.due_alert_days', 'Avisar antes de la fecha límite', days([1, 2, 3, 5, 7]))}
          </FormSection>
          {form.formError && (
            <div className="settings-form__alert">
              <Alert tone="danger">{form.formError}</Alert>
            </div>
          )}
          <SaveBar changesCount={form.changedKeys.length} isSaving={form.isSaving} formId={FORM_ID} onDiscard={form.discard} />
        </form>
      </SettingsLoader>
    </>
  )
}
