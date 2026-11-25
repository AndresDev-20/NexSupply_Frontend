import { useNavigate } from 'react-router-dom'
import { FolderPlus, Package, Warehouse } from 'lucide-react'
import { downloadImportTemplate, useImportProductsMutation } from '../inventoryApi'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { Badge } from '../../../components/ui/Badge/Badge'
import { ExcelImport, ImportAnotherButton, SummaryCard } from '../../../components/ui/ExcelImport/ExcelImport'
import { ROUTES } from '../../../routes/paths'
import '../inventory.css'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * Importación de productos desde Excel (D-INV-8):
 * 1. Descargar la plantilla. 2. Subir el archivo: se revisa sin guardar nada.
 * 3. Si no hay errores, confirmar: se carga todo en una sola operación (todo o nada).
 */
export default function ProductImportPage() {
  const navigate = useNavigate()
  const [importProducts, importState] = useImportProductsMutation()

  return (
    <>
      <PageHeader description="Carga muchos productos de una vez, con su existencia inicial. Primero se revisa el archivo; si tiene un solo error, no se carga nada." />
      <ExcelImport
        templateText="Trae las columnas, las unidades y tarifas de IVA en listas desplegables, e instrucciones con un ejemplo."
        onDownloadTemplate={downloadImportTemplate}
        fileLabel="Archivo de Excel con los productos"
        runImport={(args) => importProducts(args).unwrap()}
        isBusy={importState.isLoading}
        onReset={importState.reset}
        renderSummary={(preview) => (
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
          </>
        )}
        importLabel={(preview) => `Importar ${plural(preview.productsToCreate, 'producto')}`}
        confirm={{
          title: 'Importar productos',
          message: (preview) => `Se crearán ${preview?.productsToCreate ?? 0} producto(s)${preview?.productsWithStock ? `, ${preview.productsWithStock} con existencia inicial` : ''}. La existencia inicial no se puede volver a cargar después.`,
        }}
        successMessage={(result) => `${result.created} producto(s) importado(s)`}
        renderDone={(result, reset) => (
          <>
            <h2 className="import-done__title">
              {result.created} producto{result.created === 1 ? '' : 's'} importado{result.created === 1 ? '' : 's'}
            </h2>
            <p className="import-done__text">
              {result.productsWithStock > 0 && `${result.productsWithStock} con existencia inicial. `}
              {result.categoriesToCreate.length > 0 && `${result.categoriesToCreate.length} categoría(s) nueva(s).`}
            </p>
            <div className="import-actions">
              <ImportAnotherButton onClick={reset} />
              <Button icon={Package} onClick={() => navigate(ROUTES.products)}>
                Ver productos
              </Button>
            </div>
          </>
        )}
      />
    </>
  )
}
