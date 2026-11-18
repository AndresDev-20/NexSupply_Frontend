// Avisos de la licencia de NexCore (N2). El backend manda el estado en /auth/me (plan.license);
// aquí solo se decide qué texto mostrar y a quién. El bloqueo real lo hace el backend.
import { formatDay } from '../purchases/purchaseOptions'

const READ_ONLY = {
  suspended: { title: 'Suscripción suspendida', message: 'Tu suscripción está suspendida. Contacta a Nexoon. Puedes consultar y exportar, pero no registrar operaciones.' },
  cancelled: { title: 'Suscripción cancelada', message: 'Tu suscripción está cancelada. Puedes consultar y exportar tus datos; para volver a registrar operaciones, contacta a Nexoon.' },
  no_license: { title: 'Terminó el periodo de prueba', message: 'Terminó el periodo de prueba. Contacta a Nexoon para activar tu plan. Mientras tanto puedes consultar y exportar.' },
  offline: { title: 'Sin conexión con Nexoon', message: 'Hace varios días no hay conexión con Nexoon para validar la licencia. Puedes consultar, pero no registrar operaciones hasta que vuelva la conexión.' },
}

/** ¿Es administrador del negocio (o soporte de Nexoon)? Los avisos de pago y prueba son para ellos. */
export const isBusinessAdmin = (user) => ['administrator', 'developer'].includes(user?.role?.systemRole)

/**
 * Aviso para mostrar ahora, o null. { key, tone, title, message, dismissible }
 * - Solo lectura: para todos (nadie puede registrar operaciones) y no se puede cerrar.
 * - Pago pendiente, prueba y sin conexión con gracia: solo para los administradores.
 */
export function licenseNotice(license, user) {
  if (!license || license.source !== 'nexcore') return null
  if (license.readOnly) {
    const text = READ_ONLY[license.readOnlyReason] ?? READ_ONLY.suspended
    return { key: `readonly-${license.readOnlyReason}`, tone: 'danger', ...text, dismissible: false }
  }
  if (!isBusinessAdmin(user)) return null
  if (license.offline) {
    return {
      key: 'offline-grace',
      tone: 'warning',
      title: 'Sin conexión con Nexoon',
      message: `No hay conexión con Nexoon para validar la licencia. Si no vuelve antes del ${formatDay(license.offline.graceUntil.slice(0, 10))}, el sistema quedará solo para consultar.`,
      dismissible: true,
    }
  }
  if (license.status === 'past_due') {
    return {
      key: 'past-due',
      tone: 'warning',
      title: 'Pago pendiente',
      message: license.graceUntil ? `Tu pago está pendiente. El servicio se suspenderá el ${formatDay(license.graceUntil)}.` : 'Tu pago está pendiente. Contacta a Nexoon para evitar la suspensión.',
      dismissible: true,
    }
  }
  if (license.status === 'trial' && license.trialDaysLeft !== null && license.trialDaysLeft !== undefined) {
    const days = license.trialDaysLeft
    return {
      key: 'trial',
      tone: 'info',
      title: 'Periodo de prueba',
      message: days <= 0 ? 'Hoy termina tu periodo de prueba. Contacta a Nexoon para activar tu plan.' : days === 1 ? 'Te queda 1 día de prueba.' : `Te quedan ${days} días de prueba.`,
      dismissible: true,
    }
  }
  return null
}
