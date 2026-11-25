import { useNavigate } from 'react-router-dom'
import { HandCoins, PhoneOff, Users } from 'lucide-react'
import { downloadCustomerImportTemplate, useImportCustomersMutation } from '../customersApi'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { ExcelImport, ImportAnotherButton, SummaryCard } from '../../../components/ui/ExcelImport/ExcelImport'
import { formatCurrency } from '../../../utils/format'
import { ROUTES } from '../../../routes/paths'

const plural = (count, singular, pluralWord = `${singular}s`) => `${count} ${count === 1 ? singular : pluralWord}`

/**
 * Importación de clientes con lo que ya deben, desde Excel (D-CLI-10). Mismos pasos que la de
 * productos: plantilla, revisión sin guardar y carga de todo o nada. La deuda entra como saldo
 * inicial de cartera (sin venta, sin inventario y sin caja).
 */
export default function CustomerImportPage() {
  const navigate = useNavigate()
  const [importCustomers, importState] = useImportCustomersMutation()

  return (
    <>
      <PageHeader description="Carga todos tus clientes de una vez, con lo que debe cada uno. Primero se revisa el archivo; si tiene un solo error, no se carga nada." />
      <ExcelImport
        templateText="Una fila por cliente: nombre, documento, celular, vereda, cupo, lista de precios y lo que debe hoy, con instrucciones y un ejemplo."
        onDownloadTemplate={downloadCustomerImportTemplate}
        fileLabel="Archivo de Excel con los clientes"
        runImport={(args) => importCustomers(args).unwrap()}
        isBusy={importState.isLoading}
        onReset={importState.reset}
        renderSummary={(preview) => (
          <>
            <div className="import-summary">
              <SummaryCard icon={Users} label="Clientes nuevos" value={preview.customersToCreate} />
              <SummaryCard icon={HandCoins} label={`Con deuda · ${formatCurrency(preview.debtTotal)}`} value={preview.customersWithDebt} tone="accent" />
              {preview.customersWithoutPhone > 0 && <SummaryCard icon={PhoneOff} label="Con deuda y sin celular" value={preview.customersWithoutPhone} tone="info" />}
            </div>
            {preview.customersWithoutPhone > 0 && (
              <p className="import-categories">Los clientes con deuda y sin celular quedan con su saldo, pero no se les pueden mandar recordatorios por WhatsApp hasta que les agregues uno.</p>
            )}
          </>
        )}
        importLabel={(preview) => `Importar ${plural(preview.customersToCreate, 'cliente')}`}
        confirm={{
          title: 'Importar clientes',
          message: (preview) =>
            `Se crearán ${plural(preview?.customersToCreate ?? 0, 'cliente')}${preview?.customersWithDebt ? `, ${preview.customersWithDebt} con deuda por ${formatCurrency(preview.debtTotal)} en total` : ''}. Las deudas entran como saldo inicial de la cartera.`,
        }}
        successMessage={(result) => `${plural(result.created, 'cliente')} ${result.created === 1 ? 'importado' : 'importados'}`}
        renderDone={(result, reset) => (
          <>
            <h2 className="import-done__title">
              {plural(result.created, 'cliente')} {result.created === 1 ? 'importado' : 'importados'}
            </h2>
            <p className="import-done__text">{result.debtsCreated > 0 && `${plural(result.debtsCreated, 'deuda')} por ${formatCurrency(result.debtTotal)} en la cartera.`}</p>
            <div className="import-actions">
              <ImportAnotherButton onClick={reset} />
              <Button icon={Users} onClick={() => navigate(ROUTES.customers)}>
                Ver clientes
              </Button>
            </div>
          </>
        )}
      />
    </>
  )
}
