import { BellRing, Cake, CalendarX2, FileBadge, HandCoins, PackageX, Wallet } from 'lucide-react'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { Switch } from '../../../components/ui/Switch/Switch'
import { SaveBar } from '../../../components/ui/SaveBar/SaveBar'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useSettingsForm } from '../useSettingsForm'
import { SettingsLoader } from '../SettingsLoader'
import '../settings.css'

const FORM_ID = 'alert-settings-form'
const KEYS = [
  'inventory.expiry_alert_days',
  'inventory.document_alert_days',
  'purchases.payable_alert_days',
  'inventory.low_stock_alert',
  'receivables.due_alert_days',
  'receivables.default_term_days',
  'customers.birthday_alert_days',
]

const dayOptions = (days) => days.map((value) => ({ value, label: `${value} ${value === 1 ? 'día' : 'días'}` }))
const LONG_DAYS = dayOptions([7, 15, 30, 45, 60, 90])
const SHORT_DAYS = dayOptions([1, 3, 5, 7, 10, 15])
const DUE_DAYS = dayOptions([1, 2, 3, 5, 7])
const TERM_DAYS = dayOptions([8, 15, 30, 45, 60, 90])
const BIRTHDAY_DAYS = [{ value: 0, label: 'Solo el día' }, ...dayOptions([1, 2, 3, 5, 7]).map((option) => ({ ...option, label: `${option.label} antes y el día` }))]

/**
 * Configuración → Avisos (D-INV-19): cuántos días antes avisa la campana de lotes,
 * documentos y cuentas por pagar, y el resumen diario de existencias bajas.
 * Los avisos se revisan una vez al día y no se repiten.
 */
export default function AlertSettingsPage() {
  const toast = useToast()
  const form = useSettingsForm(KEYS)
  const { values } = form

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await form.save()
      toast.success('Avisos guardados')
    } catch (saveError) {
      toast.error(saveError.message)
    }
  }

  const daysField = (key, options) => (
    <OptionCards legend="Avisar con" name={key.replace('.', '_')} options={options} columns={3} value={values[key]} onChange={(value) => form.setValue(key, value)} />
  )

  return (
    <>
      <PageHeader description="Qué avisa la campana de notificaciones y con cuántos días de anticipación. Los avisos se revisan una vez al día y no se repiten." />

      <SettingsLoader isLoading={form.isLoading} error={form.error} onRetry={form.refetch}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormSection icon={CalendarX2} title="Lotes por vencer" description="Lotes con existencia que vencen pronto. También avisa el día en que vencen." columns={1}>
            {daysField('inventory.expiry_alert_days', LONG_DAYS)}
          </FormSection>

          <FormSection icon={FileBadge} title="Documentos por vencer" description="Registros ICA, certificados y demás documentos de los productos que tienen fecha de vencimiento." columns={1}>
            {daysField('inventory.document_alert_days', LONG_DAYS)}
          </FormSection>

          <FormSection icon={HandCoins} title="Cuentas por pagar" description="Compras a crédito que se deben pagar pronto. También avisa cuando ya están vencidas." columns={1}>
            {daysField('purchases.payable_alert_days', SHORT_DAYS)}
          </FormSection>

          <FormSection icon={Wallet} title="Cartera de clientes" description="Cuotas y fiados por vencer. También avisa cuando se vencen, y lo recuerda cada 7 días mientras sigan vencidos." columns={1}>
            {daysField('receivables.due_alert_days', DUE_DAYS)}
            <OptionCards
              legend="Plazo propuesto para pagar un fiado con abonos libres"
              name="receivables_default_term_days"
              options={TERM_DAYS}
              columns={3}
              value={values['receivables.default_term_days']}
              onChange={(value) => form.setValue('receivables.default_term_days', value)}
            />
          </FormSection>

          <FormSection icon={Cake} title="Cumpleaños de clientes" description="Para preparar una promoción o un detalle." columns={1}>
            <OptionCards legend="Avisar" name="customers_birthday_alert_days" options={BIRTHDAY_DAYS} columns={3} value={values['customers.birthday_alert_days']} onChange={(value) => form.setValue('customers.birthday_alert_days', value)} />
          </FormSection>

          <FormSection icon={PackageX} title="Existencias bajas" columns={1}>
            <Switch
              label="Resumen diario de existencias bajas y agotados"
              description="Cada mañana, un aviso con cuántos productos están en o bajo su existencia mínima y cuántos se agotaron. Solo cuentan los productos con mínimo."
              checked={Boolean(values['inventory.low_stock_alert'])}
              onChange={(checked) => form.setValue('inventory.low_stock_alert', checked)}
            />
            <p className="settings-note">
              <BellRing aria-hidden="true" />
              <span>Cada aviso lo ve quien tiene permiso sobre ese módulo: inventario, compras, cartera o clientes. En la campana, cada equipo puede activar los avisos en el escritorio y el sonido.</span>
            </p>
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
