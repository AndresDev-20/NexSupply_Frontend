// Avisos en el escritorio con sonido (D-CLI-8): mientras NexSupply esté abierto en el navegador
// (aunque esté minimizado o en otra pestaña), cada aviso nuevo de la campana sale como
// notificación del sistema operativo y suena. Es una preferencia de cada equipo (localStorage).

const STORAGE_KEY = 'nexsupply.desktopAlerts'
const DEFAULTS = { enabled: true, sound: true }

export function readDesktopPrefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeDesktopPrefs(prefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura hasta recargar
  }
}

/** Estado del permiso del navegador: 'granted' | 'denied' | 'default' | 'unsupported'. */
export function desktopPermission() {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'
}

export async function requestDesktopPermission() {
  if (desktopPermission() === 'unsupported') return 'unsupported'
  return window.Notification.requestPermission()
}

let audioContext = null

/** "Ding-dong" corto con Web Audio (sin archivos de sonido). */
export function playAlertSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    audioContext = audioContext ?? new AudioContextClass()
    const start = audioContext.currentTime
    ;[
      { frequency: 880, at: 0 },
      { frequency: 660, at: 0.18 },
    ].forEach(({ frequency, at }) => {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + at)
      gain.gain.exponentialRampToValueAtTime(0.25, start + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.35)
      oscillator.connect(gain).connect(audioContext.destination)
      oscillator.start(start + at)
      oscillator.stop(start + at + 0.4)
    })
  } catch {
    // El navegador puede bloquear el sonido hasta que el usuario interactúe con la página
  }
}

/** Muestra un aviso del sistema operativo. onOpen: al hacer clic. */
export function showDesktopNotification({ id, title, message }, onOpen) {
  if (desktopPermission() !== 'granted') return
  try {
    const notification = new window.Notification(title, { body: message, tag: `nexsupply-${id}`, icon: '/favicon.png' })
    notification.onclick = () => {
      window.focus()
      onOpen?.()
      notification.close()
    }
  } catch {
    // Algunos navegadores solo permiten notificaciones desde un service worker
  }
}
