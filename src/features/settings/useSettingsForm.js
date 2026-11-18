import { useMemo, useState } from 'react'
import { useGetSettingsQuery, useUpdateSettingsMutation } from './settingsApi'
import { splitApiError } from '../../utils/formErrors'

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Estado de una pantalla de ajustes (claves de config/settings.js del backend).
 *
 * - `values`: lo guardado en el servidor con los cambios del usuario encima.
 * - Solo se envían las claves que cambiaron; el backend normaliza y valida.
 * - Los errores del servidor llegan por clave: fieldErrors['business.nit'].
 *
 *   const form = useSettingsForm(['business.name', 'business.nit'])
 *   <TextField value={form.text('business.name')} onChange={form.handleText('business.name')} />
 */
export function useSettingsForm(keys) {
  const query = useGetSettingsQuery()
  const [updateSettings, saveState] = useUpdateSettingsMutation()
  const [draft, setDraft] = useState({})

  const saved = query.data?.values
  const values = useMemo(() => ({ ...saved, ...draft }), [saved, draft])
  const changedKeys = keys.filter((key) => key in draft && !sameValue(draft[key], saved?.[key]))
  const { fieldErrors, formError } = splitApiError(saveState.error)

  const setValue = (key, value) => {
    // Al editar un campo con error, el error del servidor deja de mostrarse en ese campo
    if (saveState.error) saveState.reset()
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /** Valor para un input de texto: null se muestra como vacío. */
  const text = (key) => values[key] ?? ''
  const handleText = (key) => (event) => setValue(key, event.target.value)

  const discard = () => {
    setDraft({})
    saveState.reset()
  }

  /** Guarda los cambios. Devuelve la configuración nueva o lanza el error normalizado. */
  const save = async ({ confirmTaxChange = false } = {}) => {
    const changes = Object.fromEntries(changedKeys.map((key) => [key, draft[key]]))
    const result = await updateSettings({ values: changes, confirmTaxChange }).unwrap()
    setDraft({})
    return result
  }

  return {
    ...query,
    settings: query.data,
    values,
    changedKeys,
    isSaving: saveState.isLoading,
    saveError: saveState.error,
    fieldErrors,
    formError,
    setValue,
    text,
    handleText,
    discard,
    save,
  }
}
