import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, Download, FileSpreadsheet, FileWarning, FolderPlus, Package, RotateCcw, Upload, Warehouse } from 'lucide-react'
import { downloadImportTemplate, useImportProductsMutation } from '../inventoryApi'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { ROUTES } from '../../../routes/paths'
import '../inventory.css'
import './ProductImportPage.css'

const MAX_BYTES = 5 * 1024 * 1024

const errorColumns = [
  { key: 'row', header: 'Fila', primary: true, render: (error) => (error.row ? `Fila ${error.row}` : 'Archivo') },
  { key: 'field', header: 'Columna', render: (error) => (error.field === 'file' ? '—' : error.field) },
  { key: 'message', header: 'Qué corregir', render: (error) => error.message },
]

function SummaryCard({ icon: Icon, label, value, tone = 'primary' }) {
  return (
    <div className={`import-summary__card import-summary__card--${tone}`}>
      <Icon aria-hidden="true" />
      <span className="import-summary__value">{value}</span>
      <span className="import-summary__label">{label}</span>
    </div>
  )
}

/**
 * Importación de productos desde Excel (D-INV-8):
 * 1. Descargar la plantilla. 2. Subir el archivo: se revisa sin guardar nada.
 * 3. Si no hay errores, confirmar: se carga todo en una sola operación (todo o nada).
 */
export default function ProductImportPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importProducts, importState] = useImportProductsMutation()

  const reset = () => {
    setFile(null)
    setFileError(null)
    setPreview(null)
    setResult(null)
    importState.reset()
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadImportTemplate()
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
      setPreview(await importProducts({ file: selected, dryRun: true }).unwrap())
    } catch (analyzeError) {
      // Error del archivo completo (no es Excel, faltan columnas, está vacío…)
      setPreview({ isValid: false, errors: analyzeError.details?.length ? analyzeError.details : [{ message: analyzeError.message }], totalErrors: analyzeError.details?.length || 1 })
    }
  }

  const handleImport = async () => {
    try {
      const imported = await importProducts({ file, dryRun: false }).unwrap()
      setResult(imported)
      toast.success(`${imported.created} producto(s) importado(s)`)
    } catch (commitError) {
      // Algo cambió desde la vista previa (otro usuario creó un código igual): se muestran los errores
      setPreview({ isValid: false, errors: commitError.details?.length ? commitError.details : [{ message: commitError.message }], totalErrors: commitError.details?.length || 1 })
    }
    setConfirmOpen(false)
  }

  const isAnalyzing = importState.isLoading && !confirmOpen

  return (
    <>
      <PageHeader description="Carga muchos productos de una vez, con su existencia inicial. Primero se revisa el archivo; si tiene un solo error, no se carga nada." />

      <ol className="import-steps">
        <li className="import-step">
          <span className="import-step__number" aria-hidden="true">
            1
          </span>
          <div className="import-step__body">
            <h2 className="import-step__title">Descarga la plantilla</h2>
            <p className="import-step__text">Trae las columnas, las unidades y tarifas de IVA en listas desplegables, e instrucciones con un ejemplo.</p>
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
              <Button icon={Upload} onClick={() => inputRef.current?.click()} isLoading={isAnalyzing} disabled={importState.isLoading}>
                {file ? 'Elegir otro archivo' : 'Elegir archivo'}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="u-visually-hidden"
                aria-label="Archivo de Excel con los productos"
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
                  <div className="import-summary">
                    <SummaryCard icon={Package} label="Productos nuevos" value={preview.productsToCreate} />
                    <SummaryCard icon={Warehouse} label="Con existencia inicial" value={preview.productsWithStock} tone="accent" />
                    <SummaryCard icon={FolderPlus} label="Categorías nuevas" value={preview.categoriesToCreate.length} tone="info" />
                  </div>
                  {preview.categoriesToCreate.length > 0 && (
                    <p className="import-categories">
                      Se crearán:{' '}
                      {preview.categoriesToCreate.map((name) => (
                        <Badge key={name} tone="info">
                          {name}
                        </Badge>
                      ))}
                    </p>
                  )}
                  <div className="import-actions">
                    <Button variant="secondary" icon={RotateCcw} onClick={reset}>
                      Cancelar
                    </Button>
                    <Button icon={CircleCheck} onClick={() => setConfirmOpen(true)}>
                      Importar {preview.productsToCreate} producto{preview.productsToCreate === 1 ? '' : 's'}
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
          <h2 className="import-done__title">
            {result.created} producto{result.created === 1 ? '' : 's'} importado{result.created === 1 ? '' : 's'}
          </h2>
          <p className="import-done__text">
            {result.productsWithStock > 0 && `${result.productsWithStock} con existencia inicial. `}
            {result.categoriesToCreate.length > 0 && `${result.categoriesToCreate.length} categoría(s) nueva(s).`}
          </p>
          <div className="import-actions">
            <Button variant="secondary" icon={FileWarning} onClick={reset}>
              Importar otro archivo
            </Button>
            <Button icon={Package} onClick={() => navigate(ROUTES.products)}>
              Ver productos
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Importar productos"
        message={`Se crearán ${preview?.productsToCreate ?? 0} producto(s)${preview?.productsWithStock ? `, ${preview.productsWithStock} con existencia inicial` : ''}. La existencia inicial no se puede volver a cargar después.`}
        confirmLabel="Importar"
        isLoading={importState.isLoading}
        onConfirm={handleImport}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
