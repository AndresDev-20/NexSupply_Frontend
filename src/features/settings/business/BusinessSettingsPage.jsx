import { AtSign, FileText, Hash, Image, Mail, MapPin, MessageCircle, Phone, Printer, Receipt, ScrollText, ShieldCheck, Store } from 'lucide-react'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { TextField } from '../../../components/ui/TextField/TextField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { Switch } from '../../../components/ui/Switch/Switch'
import { SaveBar } from '../../../components/ui/SaveBar/SaveBar'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useSettingsForm } from '../useSettingsForm'
import { SettingsLoader } from '../SettingsLoader'
import { LogoUploader } from './LogoUploader'
import { EmailPreview, ReceiptPreview } from './ReceiptPreview'
import '../settings.css'

const FORM_ID = 'business-settings-form'

// Claves de config/settings.js (backend) que edita esta pantalla
const KEYS = [
  'business.name',
  'business.nit',
  'business.address',
  'business.phone',
  'business.email',
  'business.whatsapp',
  'business.social',
  'receipt.paper_format',
  'receipt.show_logo',
  'receipt.tax_regime_text',
  'receipt.footer_message',
  'receipt_email.enabled',
  'receipt_email.subject',
  'receipt_email.message',
  'receipt_email.reply_to',
]

const PAPER_OPTIONS = [
  { value: '58mm', label: 'Tirilla 58 mm', description: 'Impresoras térmicas pequeñas', icon: Receipt },
  { value: '80mm', label: 'Tirilla 80 mm', description: 'La más común en mostrador', icon: Receipt },
  { value: 'letter', label: 'Hoja carta', description: 'Impresora normal', icon: Printer },
]

const PLACEHOLDERS = ['{negocio}', '{cliente}', '{numero}']

/** Datos del negocio, logo, comprobante y envío por correo (D-CFG-6). */
export default function BusinessSettingsPage() {
  const toast = useToast()
  const form = useSettingsForm(KEYS)
  const { values, fieldErrors, settings } = form
  const emailEnabled = Boolean(values['receipt_email.enabled'])

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await form.save()
      toast.success('Configuración guardada')
    } catch (saveError) {
      // Errores por campo: junto a cada campo. Los demás: en el aviso de arriba del formulario
      if (saveError.details?.length) toast.error('Revisa los campos marcados')
    }
  }

  const appendPlaceholder = (marker) => {
    const current = values['receipt_email.message'] ?? ''
    form.setValue('receipt_email.message', `${current}${current && !current.endsWith(' ') ? ' ' : ''}${marker}`)
  }

  return (
    <>
      <PageHeader description="Así se presenta el negocio en los comprobantes, en los correos y en la pantalla de inicio de sesión." />

      <SettingsLoader isLoading={form.isLoading} error={form.error} onRetry={form.refetch}>
        <FormWithPreview
          previewLabel="Vista previa del comprobante"
          preview={
            <>
              <ReceiptPreview values={values} fixed={settings?.fixed} logo={settings?.logo} />
              {emailEnabled && <EmailPreview values={values} />}
            </>
          }
        >
          {form.formError && (
            <div className="settings-form__alert">
              <Alert tone="danger">{form.formError}</Alert>
            </div>
          )}

          <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
            <FormSection icon={Store} title="Datos del negocio" description="Aparecen en el encabezado de cada comprobante.">
              <TextField
                className="form-section__full"
                label="Nombre comercial"
                icon={Store}
                value={form.text('business.name')}
                onChange={form.handleText('business.name')}
                error={fieldErrors['business.name']}
                maxLength={120}
                required
              />
              <TextField
                label="NIT"
                icon={Hash}
                placeholder="Ej.: 900123456-7"
                value={form.text('business.nit')}
                onChange={form.handleText('business.nit')}
                error={fieldErrors['business.nit']}
                hint="Opcional. Con el dígito de verificación si lo tienes."
                maxLength={20}
              />
              <TextField
                label="Teléfono"
                type="tel"
                icon={Phone}
                placeholder="Ej.: 3001234567"
                value={form.text('business.phone')}
                onChange={form.handleText('business.phone')}
                error={fieldErrors['business.phone']}
              />
              <TextField
                className="form-section__full"
                label="Dirección"
                icon={MapPin}
                placeholder="Ej.: Calle 10 # 5-20, centro"
                value={form.text('business.address')}
                onChange={form.handleText('business.address')}
                error={fieldErrors['business.address']}
                maxLength={255}
              />
              <TextField
                label="Correo"
                type="email"
                icon={Mail}
                placeholder="Ej.: ventas@minegocio.com"
                value={form.text('business.email')}
                onChange={form.handleText('business.email')}
                error={fieldErrors['business.email']}
              />
              <TextField
                label="WhatsApp"
                type="tel"
                icon={MessageCircle}
                placeholder="Ej.: 3001234567"
                value={form.text('business.whatsapp')}
                onChange={form.handleText('business.whatsapp')}
                error={fieldErrors['business.whatsapp']}
                hint="Se imprime al final del comprobante."
              />
              <TextField
                className="form-section__full"
                label="Redes sociales"
                icon={AtSign}
                placeholder="Ej.: Instagram @agroelcampo"
                value={form.text('business.social')}
                onChange={form.handleText('business.social')}
                error={fieldErrors['business.social']}
                maxLength={100}
              />
            </FormSection>

            <FormSection icon={Image} title="Logo" description="Se muestra en los comprobantes y al iniciar sesión. Se guarda apenas lo eliges." columns={1}>
              <LogoUploader logo={settings?.logo} />
            </FormSection>

            <FormSection icon={ScrollText} title="Comprobante de venta" description="Formato de impresión y textos del comprobante." columns={1}>
              <OptionCards
                legend="Formato de impresión"
                name="paper_format"
                options={PAPER_OPTIONS}
                columns={3}
                value={values['receipt.paper_format']}
                onChange={(value) => form.setValue('receipt.paper_format', value)}
              />
              <Switch
                label="Mostrar el logo en el comprobante"
                description={settings?.logo ? undefined : 'Primero sube un logo.'}
                checked={Boolean(values['receipt.show_logo'])}
                onChange={(checked) => form.setValue('receipt.show_logo', checked)}
              />
              <TextField
                label="Régimen tributario"
                icon={ShieldCheck}
                placeholder={`Automático: ${settings?.fixed?.taxRegimeText ?? ''}`}
                value={form.text('receipt.tax_regime_text')}
                onChange={form.handleText('receipt.tax_regime_text')}
                error={fieldErrors['receipt.tax_regime_text']}
                hint="Déjalo vacío para usar el texto automático según el IVA."
                maxLength={120}
              />
              <TextAreaField
                label="Mensaje al pie"
                placeholder="Ej.: Gracias por su compra. Cambios dentro de los 8 días con este comprobante."
                value={form.text('receipt.footer_message')}
                onChange={form.handleText('receipt.footer_message')}
                error={fieldErrors['receipt.footer_message']}
                maxLength={300}
              />
              <p className="settings-note">
                <FileText aria-hidden="true" />
                <span>
                  Siempre se imprime el aviso: <strong>{settings?.fixed?.legalNotice}</strong> El sistema no emite facturas electrónicas de la DIAN.
                </span>
              </p>
            </FormSection>

            <FormSection icon={Mail} title="Envío por correo" description="El cliente podrá recibir su comprobante en PDF. El envío se activa con el módulo de ventas." columns={1}>
              <Switch
                label="Permitir enviar comprobantes por correo"
                checked={emailEnabled}
                onChange={(checked) => form.setValue('receipt_email.enabled', checked)}
              />
              {emailEnabled && (
                <div className="settings-subfields">
                  <TextField
                    label="Asunto"
                    value={form.text('receipt_email.subject')}
                    onChange={form.handleText('receipt_email.subject')}
                    error={fieldErrors['receipt_email.subject']}
                    maxLength={150}
                    required
                  />
                  <TextAreaField
                    label="Mensaje"
                    rows={4}
                    value={form.text('receipt_email.message')}
                    onChange={form.handleText('receipt_email.message')}
                    error={fieldErrors['receipt_email.message']}
                    maxLength={1000}
                    required
                  />
                  <div className="placeholder-chips">
                    <span>Insertar en el mensaje:</span>
                    {PLACEHOLDERS.map((marker) => (
                      <button key={marker} type="button" className="placeholder-chips__chip" onClick={() => appendPlaceholder(marker)}>
                        {marker}
                      </button>
                    ))}
                  </div>
                  <TextField
                    label="Correo para respuestas"
                    type="email"
                    icon={Mail}
                    placeholder="Ej.: ventas@minegocio.com"
                    value={form.text('receipt_email.reply_to')}
                    onChange={form.handleText('receipt_email.reply_to')}
                    error={fieldErrors['receipt_email.reply_to']}
                    hint="Opcional. Si el cliente responde el correo, la respuesta llega aquí."
                  />
                </div>
              )}
            </FormSection>
          </form>

          <SaveBar changesCount={form.changedKeys.length} isSaving={form.isSaving} formId={FORM_ID} onDiscard={form.discard} />
        </FormWithPreview>
      </SettingsLoader>
    </>
  )
}
