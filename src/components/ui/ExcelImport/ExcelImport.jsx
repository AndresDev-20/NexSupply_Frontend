import { useRef, useState } from 'react'
import { CircleCheck, Download, FileSpreadsheet, FileWarning, RotateCcw, Upload } from 'lucide-react'
import { useToast } from '../../feedback/Toast/toastContext'
import { Alert } from '../../feedback/Alert/Alert'
import { Button } from '../Button/Button'
import { DataTable } from '../DataTable/DataTable'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import './ExcelImport.css'

const MAX_BYTES = 5 * 1024 * 1024

const errorColumns = [
  { key: 'row', header: 'Fila', primary: true, render: (error) => (error.row ? `Fila ${error.row}` : 'Archivo') },
  { key: 'field', header: 'Columna', render: (error) => (error.field === 'file' ? '—' : error.field) },
  { key: 'message', header: 'Qué corregir', render: (error) => error.message },
]

/** Tarjeta del resumen de la vista previa (cuántos se crean, con existencia, con deuda…). */
export function SummaryCard({ icon: Icon, label, value, tone = 'primary' }) {
  return (
    <div className={`import-summary__card import-summary__card--${tone}`}>
      <Icon aria-hidden="true" />
      <span className="import-summary__value">{value}</span>
      <span className="import-summary__label">{label}</span>
    </div>
  )
}

/** Los errores de un archivo completo (no es Excel, faltan columnas…) llegan sin fila: se muestran igual. */
const asPreview = (error) => ({ isValid: false, errors: error.details?.length ? error.details : [{ message: error.message }], totalErrors: error.details?.length || 1 })

/**
 * Pasos de una importación desde Excel (D-INV-8, D-CLI-10), los mismos para productos y clientes:
 * 1. Descargar la plantilla. 2. Subir el archivo: se revisa sin guardar nada.
 * 3. Si no hay errores, confirmar: se carga todo en una sola operación (todo o nada).
 *
 * - templateText / onDownloadTemplate: qué trae la plantilla y cómo se descarga.
 * - fileLabel: nombre accesible del campo de archivo ("Archivo de Excel con los clientes").
 * - runImport({ file, dryRun }): la mutación (devuelve una promesa con .unwrap() ya aplicado).
 * - isBusy: la mutación está trabajando.
 * - renderSummary(preview): tarjetas del resumen cuando el archivo está bien.
 * - importLabel(preview): texto del botón para importar.
 * - confirm: { title, message(preview) } del diálogo de confirmación.
 * - successMessage(result): aviso al terminar.
 * - renderDone(result, reset): contenido del final (título, texto y botones).
 */
export function ExcelImport({ templateText, onDownloadTemplate, fileLabel, runImport, isBusy, onReset, renderSummary, importLabel, confirm, successMessage, renderDone }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const reset = () => {
    setFile(null)
    setFileError(null)
    setPreview(null)
    setResult(null)
    onReset?.()
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await onDownloadTemplate()
    } catch (downloadError) {
      toast.error(downloadError.message ?? 'No se pudo descargar la plantilla')
    }
    setIsDownloading(false)
  }

  const analyze = async (selected) => {
    reset()
    if (!selected) return
    if (!/\.xlsx$/i.test(selected.name)) return setFileError('El archivo debe ser de Excel (.xlsx). Usa la plantilla.')
    if (selected.size > MAX_BYTES) return setFileError('El archivo supera el tamaño máximo de 5 MB.')
    setFile(selected)
    try {
      setPreview(await runImport({ file: selected, dryRun: true }))
    } catch (analyzeError) {
      setPreview(asPreview(analyzeError))
    }
  }

  const handleImport = async () => {
    try {
      const imported = await runImport({ file, dryRun: false })
      setResult(imported)
      toast.success(successMessage(imported))
    } catch (commitError) {
      // Algo cambió desde la vista previa (otro usuario creó un registro igual): se muestran los errores
      setPreview(asPreview(commitError))
    }
    setConfirmOpen(false)
  }

  const isAnalyzing = isBusy && !confirmOpen

  return (
    <>
      <ol className="import-steps">
        <li className="import-step">
          <span className="import-step__number" aria-hidden="true">
            1
          </span>
          <div className="import-step__body">
            <h2 className="import-step__title">Descarga la plantilla</h2>
            <p className="import-step__text">{templateText}</p>
            <Button variant="secondary" icon={Download} onClick={handleDownload} isLoading={isDownloading}>
              Descargar plantilla
            </Button>
          </div>
        </li>

        <li className="import-step">
          <span className="import-step__number" aria-hidden="true">
            2
          </span>
          <div className="import-step__body">
            <h2 className="import-step__title">Sube el archivo lleno</h2>
            <div
              className={`import-drop${isDragging ? ' import-drop--dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                analyze(event.dataTransfer.files?.[0])
              }}
            >
              <FileSpreadsheet className="import-drop__icon" aria-hidden="true" />
              <p className="import-drop__text">{file ? file.name : 'Arrastra aquí el archivo .xlsx o elígelo'}</p>
              <Button icon={Upload} onClick={() => inputRef.current?.click()} isLoading={isAnalyzing} disabled={isBusy}>
                {file ? 'Elegir otro archivo' : 'Elegir archivo'}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="u-visually-hidden"
                aria-label={fileLabel}
                tabIndex={-1}
                onChange={(event) => {
                  analyze(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>
            {fileError && (
              <p className="import-drop__error" role="alert">
                {fileError}
              </p>
            )}
          </div>
        </li>

        {preview && !result && (
          <li className="import-step">
            <span className="import-step__number" aria-hidden="true">
              3
            </span>
            <div className="import-step__body">
              <h2 className="import-step__title">Revisa y confirma</h2>
              {preview.isValid ? (
                <>
                  {renderSummary(preview)}
                  <div className="import-actions">
                    <Button variant="secondary" icon={RotateCcw} onClick={reset}>
                      Cancelar
                    </Button>
                    <Button icon={CircleCheck} onClick={() => setConfirmOpen(true)}>
                      {importLabel(preview)}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Alert tone="danger" title={`El archivo tiene ${preview.totalErrors} error${preview.totalErrors === 1 ? '' : 'es'}`}>
                    No se cargará nada hasta que el archivo esté completo y sin errores. Corrígelo en Excel y vuelve a subirlo.
                    {preview.totalErrors > (preview.errors?.length ?? 0) && ` Se muestran los primeros ${preview.errors.length}.`}
                  </Alert>
                  <div className="import-errors">
                    <DataTable caption="Errores del archivo" columns={errorColumns} rows={preview.errors ?? []} getRowId={(error) => `${error.row}-${error.field}-${error.message}`} />
                  </div>
                </>
              )}
            </div>
          </li>
        )}
      </ol>

      {result && (
        <section className="import-done" aria-live="polite">
          <CircleCheck className="import-done__icon" aria-hidden="true" />
          {renderDone(result, reset)}
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirm.title}
        message={confirm.message(preview)}
        confirmLabel="Importar"
        isLoading={isBusy}
        onConfirm={handleImport}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

/** Botón del final para empezar otra importación. */
export function ImportAnotherButton({ onClick }) {
  return (
    <Button variant="secondary" icon={FileWarning} onClick={onClick}>
      Importar otro archivo
    </Button>
  )
}
