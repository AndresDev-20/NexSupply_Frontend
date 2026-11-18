import { useEffect } from 'react'
import { Check, Palette, PartyPopper } from 'lucide-react'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Switch } from '../../../components/ui/Switch/Switch'
import { SaveBar } from '../../../components/ui/SaveBar/SaveBar'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { SeasonalGarland } from '../../../components/brand/Seasonal/SeasonalDecoration'
import { useSettingsForm } from '../useSettingsForm'
import { SettingsLoader } from '../SettingsLoader'
import { PALETTES, applyPalette, readCachedPalette, useSeason } from '../appearance'
import '../settings.css'
import './AppearanceSettingsPage.css'

const FORM_ID = 'appearance-settings-form'
const KEYS = ['appearance.palette', 'appearance.seasonal_decorations']

// Las mismas fechas de Backend/src/api/config/seasons.js (solo para mostrarlas)
const SEASONS = [
  { key: 'christmas', label: 'Navidad', dates: '1 al 30 de diciembre', message: '¡Feliz Navidad!' },
  { key: 'new_year', label: 'Año Nuevo', dates: '31 de diciembre al 6 de enero', message: '¡Feliz Año Nuevo!' },
  { key: 'love_friendship', label: 'Amor y Amistad', dates: '1 de septiembre al tercer sábado', message: '¡Feliz Amor y Amistad!' },
  { key: 'patriotic', label: 'Fiestas patrias', dates: '15 al 20 de julio y 1 al 7 de agosto', message: '¡Viva Colombia!' },
  { key: 'mothers_day', label: 'Día de la Madre', dates: '1 de mayo al segundo domingo', message: '¡Feliz día a todas las mamás!' },
  { key: 'fathers_day', label: 'Día del Padre', dates: '1 de junio al tercer domingo', message: '¡Feliz día a todos los papás!' },
]

/**
 * Configuración → Apariencia (Fase 15, D-UX-1 a D-UX-4): paleta del negocio y adornos de
 * temporada. Es del negocio: todos lo ven igual. El modo claro/oscuro es personal (menú del usuario).
 */
export default function AppearanceSettingsPage() {
  const toast = useToast()
  const form = useSettingsForm(KEYS)
  const today = useSeason()
  const palette = form.values['appearance.palette'] ?? 'campo'
  const decorations = Boolean(form.values['appearance.seasonal_decorations'])

  // Vista previa en vivo: la paleta escogida se ve en toda la pantalla mientras se decide.
  // Al salir sin guardar vuelve la guardada.
  useEffect(() => {
    applyPalette(palette)
  }, [palette])
  useEffect(() => () => applyPalette(readCachedPalette()), [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await form.save()
      toast.success('Apariencia guardada: todos la verán así')
    } catch (saveError) {
      toast.error(saveError.message)
    }
  }

  return (
    <>
      <PageHeader description="Los colores y los adornos del sistema para todo el negocio. El modo claro u oscuro lo escoge cada persona en su menú." />

      <SettingsLoader isLoading={form.isLoading} error={form.error} onRetry={form.refetch}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormSection icon={Palette} title="Paleta de colores" description="Combinaciones revisadas para que todo se lea bien en modo claro y oscuro. Al escoger una, la ves al instante; se aplica a todos al guardar." columns={1}>
            <fieldset className="palette-picker">
              <legend className="u-visually-hidden">Paleta de colores</legend>
              {PALETTES.map((item) => (
                <label key={item.key} className={`palette-option${palette === item.key ? ' is-selected' : ''}`}>
                  <input type="radio" name="appearance_palette" value={item.key} checked={palette === item.key} onChange={() => form.setValue('appearance.palette', item.key)} className="u-visually-hidden" />
                  <span className="palette-option__swatches" aria-hidden="true">
                    {item.swatches.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="palette-option__text">
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                  {palette === item.key && <Check className="palette-option__check" aria-hidden="true" />}
                </label>
              ))}
            </fieldset>
          </FormSection>

          <FormSection icon={PartyPopper} title="Adornos de temporada" description="En Navidad, Amor y Amistad, fiestas patrias y otras fechas, el sistema se adorna solo: la bienvenida, el inicio de sesión y el menú. Solo decoran; nunca cambian cómo se trabaja." columns={1}>
            <Switch label="Adornar el sistema en cada temporada" description={today ? `Hoy está activa: ${today.label}.` : 'Hoy no hay ninguna temporada activa.'} checked={decorations} onChange={(checked) => form.setValue('appearance.seasonal_decorations', checked)} />
            <ul className={`season-list${decorations ? '' : ' is-off'}`} aria-label="Temporadas y sus fechas">
              {SEASONS.map((season) => (
                <li key={season.key} className={`season-card${today?.key === season.key ? ' is-today' : ''}`}>
                  <span className="season-card__preview" aria-hidden="true">
                    <SeasonalGarland season={season} variant="compact" />
                  </span>
                  <strong>{season.label}</strong>
                  <small>{season.dates}</small>
                  {today?.key === season.key && <span className="season-card__today">Activa hoy</span>}
                </li>
              ))}
            </ul>
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
