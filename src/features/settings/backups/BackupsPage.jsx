import { useState } from 'react'
import { CircleCheck, CircleX, DatabaseBackup, Download, FolderSync, HardDrive, Moon, ShieldCheck } from 'lucide-react'
import { downloadBackup, useCreateBackupMutation, useGetBackupsQuery } from './backupsApi'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { formatDateTime } from '../../../utils/format'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../settings.css'

/** 18588 → "18 KB"; 5242880 → "5,0 MB". */
function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

const hourText = (hour) => `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? 'a. m.' : 'p. m.'}`

/**
 * /configuracion/copias-de-seguridad — Copias de la base de datos (D-SEG-1): estado de la
 * última, lista para descargar y «Sacar copia ahora». Restaurar no se hace aquí.
 */
export default function BackupsPage() {
  const toast = useToast()
  const { data, error, isFetching, refetch } = useGetBackupsQuery()
  const [createBackup, createState] = useCreateBackupMutation()
  const [downloading, setDownloading] = useState(null)

  const handleCreate = async () => {
    try {
      const result = await createBackup().unwrap()
      toast.success(result.message ?? 'Copia de seguridad lista')
    } catch (createError) {
      toast.error(createError.message)
    }
  }

  const handleDownload = async (name) => {
    setDownloading(name)
    try {
      await downloadBackup(name)
    } catch (downloadError) {
      toast.error(downloadError.message ?? 'No se pudo descargar la copia')
    }
    setDownloading(null)
  }

  const last = data?.lastRun
  const settings = data?.settings
  const columns = [
    {
      key: 'date',
      header: 'Copia',
      primary: true,
      render: (file) => (
        <span className="catalog-cell">
          <span className="catalog-cell__icon" aria-hidden="true">
            <DatabaseBackup size={16} />
          </span>
          <span className="catalog-cell__name">
            {formatDateTime(file.createdAt)} {file.manual ? <Badge tone="info">Sacada a mano</Badge> : <Badge tone="neutral">Automática</Badge>}
          </span>
        </span>
      ),
    },
    { key: 'size', header: 'Tamaño', render: (file) => formatSize(file.size) },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (file) => <IconButton icon={Download} label={`Descargar la copia del ${formatDateTime(file.createdAt)}`} disabled={downloading === file.name} onClick={() => handleDownload(file.name)} />,
    },
  ]

  return (
    <>
      <PageHeader
        description="Una copia de toda la información del negocio. Se saca sola cada noche; también puedes sacar una ahora, por ejemplo antes de un cambio grande. Guarda una copia fuera de este equipo."
        actions={
          <Button icon={DatabaseBackup} isLoading={createState.isLoading} onClick={handleCreate}>
            Sacar copia ahora
          </Button>
        }
      />

      {last && !last.ok && (
        <Alert tone="danger" title="La última copia falló">
          {formatDateTime(last.at)}: {last.error} Avise a Nexoon.
        </Alert>
      )}
      {last?.ok && last.copyError && <Alert tone="warning" title="La copia está, pero no llegó a la segunda carpeta">{last.copyError}</Alert>}

      {settings && (
        <section className="cash-tiles cash-tiles--four" aria-label="Estado de las copias">
          <div className={`cash-tile cash-tile--${last?.ok ? 'success' : last ? 'danger' : 'warning'}`}>
            {last?.ok ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
            <span className="cash-tile__value">{last ? formatDateTime(last.at) : 'Aún no hay'}</span>
            <span className="cash-tile__label">{last?.ok ? 'Última copia, bien' : last ? 'Última copia, falló' : 'Última copia'}</span>
          </div>
          <div className="cash-tile cash-tile--info">
            <Moon aria-hidden="true" />
            <span className="cash-tile__value">{settings.enabled ? hourText(settings.hour) : 'Apagadas'}</span>
            <span className="cash-tile__label">Copia automática cada noche</span>
          </div>
          <div className="cash-tile cash-tile--accent">
            <ShieldCheck aria-hidden="true" />
            <span className="cash-tile__value">{settings.retentionDays} días</span>
            <span className="cash-tile__label">Se guardan</span>
          </div>
          <div className={`cash-tile cash-tile--${settings.hasCopyDir ? 'success' : 'warning'}`}>
            {settings.hasCopyDir ? <FolderSync aria-hidden="true" /> : <HardDrive aria-hidden="true" />}
            <span className="cash-tile__value">{settings.hasCopyDir ? 'Sí' : 'No'}</span>
            <span className="cash-tile__label">Copia en otra carpeta</span>
          </div>
        </section>
      )}
      {settings && !settings.hasCopyDir && <Alert tone="warning">Las copias están solo en este equipo. Si el disco se daña, se pierden con él. Pida a Nexoon configurar una segunda carpeta (disco externo o Google Drive).</Alert>}

      <DataTable
        caption="Copias guardadas"
        columns={columns}
        rows={data?.files ?? []}
        getRowId={(file) => file.name}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="Aún no hay copias"
        emptyDescription='Saque la primera con "Sacar copia ahora".'
      />
      <p className="settings-note">
        <ShieldCheck aria-hidden="true" />
        <span>Las copias tienen toda la información del negocio: guárdelas en un lugar seguro. Para restaurar una copia, contacte a Nexoon.</span>
      </p>
    </>
  )
}
