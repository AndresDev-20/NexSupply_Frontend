import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CheckCheck, Monitor, Volume2, VolumeX } from 'lucide-react'
import { useHasFeature } from '../../hooks/usePermissions'
import { httpClient } from '../../api/httpClient'
import { desktopPermission, playAlertSound, readDesktopPrefs, requestDesktopPermission, showDesktopNotification, writeDesktopPrefs } from './desktopAlerts'
import { formatDateTime } from '../../utils/format'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from './notificationsApi'
import './NotificationBell.css'

// El contador se actualiza solo cada minuto (y al volver a la pestaña)
const POLLING_MS = 60 * 1000

/** Campana de notificaciones de la barra superior (decisión D7d). */
export function NotificationBell() {
  const enabled = useHasFeature('notifications')
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const { data: unread = 0 } = useGetUnreadCountQuery(undefined, { skip: !enabled, pollingInterval: POLLING_MS, refetchOnFocus: true })
  const { data, isFetching } = useGetNotificationsQuery({ pageSize: 10 }, { skip: !enabled || !isOpen })
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation()
  const [prefs, setPrefs] = useState(readDesktopPrefs)
  const [permission, setPermission] = useState(desktopPermission)
  const prefsRef = useRef(prefs)
  const lastSeenRef = useRef(null)
  const previousUnreadRef = useRef(null)

  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])

  // Avisos en el escritorio con sonido (D-CLI-8): cuando sube el contador, se buscan los avisos
  // nuevos (los de id mayor al último visto). La primera vez solo se toma la referencia.
  useEffect(() => {
    if (!enabled || unread === undefined) return
    const previous = previousUnreadRef.current
    previousUnreadRef.current = unread
    if (previous !== null && unread <= previous) return
    let cancelled = false
    httpClient
      .get('/notifications', { params: { pageSize: 5 } })
      .then((response) => {
        if (cancelled) return
        const rows = response.data?.data ?? []
        const maxId = rows.reduce((max, row) => Math.max(max, row.id), 0)
        if (lastSeenRef.current === null) {
          lastSeenRef.current = maxId
          return
        }
        const fresh = rows.filter((row) => row.id > lastSeenRef.current && !row.readAt).reverse()
        lastSeenRef.current = Math.max(lastSeenRef.current, maxId)
        if (fresh.length === 0) return
        if (prefsRef.current.sound) playAlertSound()
        if (prefsRef.current.enabled) {
          fresh.slice(-3).forEach((row) =>
            showDesktopNotification(row, () => {
              if (!row.readAt) markRead(row.id)
              if (row.link) navigate(row.link)
            }),
          )
        }
      })
      .catch(() => {
        // Sin conexión: se intentará en el próximo cambio del contador
      })
    return () => {
      cancelled = true
    }
  }, [enabled, unread, markRead, navigate])

  const updatePrefs = (changes) => {
    const next = { ...prefs, ...changes }
    setPrefs(next)
    writeDesktopPrefs(next)
  }

  const enableDesktop = async () => {
    const result = await requestDesktopPermission()
    setPermission(result)
    if (result === 'granted') {
      updatePrefs({ enabled: true })
      playAlertSound()
    }
  }

  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  if (!enabled) return null

  const handleOpenNotification = (notification) => {
    if (!notification.readAt) markRead(notification.id)
    if (notification.link) {
      setIsOpen(false)
      navigate(notification.link)
    }
  }

  const BellIcon = unread > 0 ? BellRing : Bell
  const rows = data?.rows ?? []

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className={`notification-bell__trigger${unread > 0 ? ' notification-bell__trigger--active' : ''}`}
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
      >
        <BellIcon className="notification-bell__icon" aria-hidden="true" />
        {unread > 0 && (
          <span className="notification-bell__count" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-bell__panel" role="dialog" aria-label="Notificaciones">
          <header className="notification-bell__header">
            <p className="notification-bell__title">Notificaciones</p>
            {unread > 0 && (
              <button type="button" className="notification-bell__mark-all" onClick={() => markAllRead()} disabled={markAllState.isLoading}>
                <CheckCheck size={16} aria-hidden="true" /> Marcar todas como leídas
              </button>
            )}
          </header>

          {isFetching && rows.length === 0 ? (
            <div className="notification-bell__empty">
              <Spinner label="Cargando notificaciones…" />
            </div>
          ) : rows.length === 0 ? (
            <div className="notification-bell__empty">
              <Bell className="notification-bell__empty-icon" aria-hidden="true" />
              <p>No tienes notificaciones</p>
            </div>
          ) : (
            <ul className="notification-bell__list">
              {rows.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notification-bell__item notification-bell__item--${notification.severity}${notification.readAt ? '' : ' notification-bell__item--unread'}`}
                    onClick={() => handleOpenNotification(notification)}
                  >
                    <span className="notification-bell__item-title">{notification.title}</span>
                    <span className="notification-bell__item-message">{notification.message}</span>
                    <span className="notification-bell__item-date">{formatDateTime(notification.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <footer className="notification-bell__footer">
            {permission === 'granted' ? (
              <button type="button" className="notification-bell__toggle" onClick={() => updatePrefs({ enabled: !prefs.enabled })} aria-pressed={prefs.enabled}>
                <Monitor size={16} aria-hidden="true" /> Avisos en el escritorio: {prefs.enabled ? 'activados' : 'apagados'}
              </button>
            ) : permission === 'default' ? (
              <button type="button" className="notification-bell__toggle notification-bell__toggle--call" onClick={enableDesktop}>
                <Monitor size={16} aria-hidden="true" /> Activar avisos en el escritorio
              </button>
            ) : permission === 'denied' ? (
              <p className="notification-bell__hint">El navegador bloqueó los avisos en el escritorio. Permítelos desde el candado de la barra de direcciones.</p>
            ) : null}
            <button type="button" className="notification-bell__toggle" onClick={() => updatePrefs({ sound: !prefs.sound })} aria-pressed={prefs.sound}>
              {prefs.sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />} Sonido: {prefs.sound ? 'activado' : 'silenciado'}
            </button>
          </footer>
        </div>
      )}
    </div>
  )
}
