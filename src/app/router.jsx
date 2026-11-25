import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import RouteErrorPage from '../features/system/pages/RouteErrorPage'
import { SessionGate } from '../routes/SessionGate'
import { PublicOnly, RequireAuth } from '../routes/RequireAuth'
import { RequirePermission } from '../routes/RequirePermission'
import { ROUTES } from '../routes/paths'

// Cada pantalla se carga solo cuando se visita (code splitting):
// el POS no descarga el código de informes, y viceversa.
const AppShell = lazy(() =>
  import('../components/layout/AppShell/AppShell').then((module) => ({ default: module.AppShell })),
)
const AuthLayout = lazy(() =>
  import('../components/layout/AuthLayout/AuthLayout').then((module) => ({ default: module.AuthLayout })),
)
const HomePage = lazy(() => import('../features/system/pages/HomePage'))
const NotFoundPage = lazy(() => import('../features/system/pages/NotFoundPage'))
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'))
const ForgotPasswordPage = lazy(() => import('../features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../features/auth/pages/ResetPasswordPage'))
const ChangePasswordPage = lazy(() => import('../features/auth/pages/ChangePasswordPage'))
const UsersPage = lazy(() => import('../features/admin/users/UsersPage'))
const RolesPage = lazy(() => import('../features/admin/roles/RolesPage'))
const BranchesPage = lazy(() => import('../features/admin/branches/BranchesPage'))
const AuditPage = lazy(() => import('../features/admin/audit/AuditPage'))
const BusinessSettingsPage = lazy(() => import('../features/settings/business/BusinessSettingsPage'))
const TaxSettingsPage = lazy(() => import('../features/settings/tax/TaxSettingsPage'))
const PaymentMethodsPage = lazy(() => import('../features/settings/paymentMethods/PaymentMethodsPage'))
const UnitsPage = lazy(() => import('../features/settings/units/UnitsPage'))
const SequencesPage = lazy(() => import('../features/settings/sequences/SequencesPage'))
const BackupsPage = lazy(() => import('../features/settings/backups/BackupsPage'))
const ProductsPage = lazy(() => import('../features/inventory/products/ProductsPage'))
const ProductDetailPage = lazy(() => import('../features/inventory/products/ProductDetailPage'))
const CategoriesPage = lazy(() => import('../features/inventory/categories/CategoriesPage'))
const SuppliersPage = lazy(() => import('../features/inventory/suppliers/SuppliersPage'))
const ProductImportPage = lazy(() => import('../features/inventory/import/ProductImportPage'))
const LabelsPage = lazy(() => import('../features/inventory/labels/LabelsPage'))
const BulkPricesPage = lazy(() => import('../features/inventory/products/BulkPricesPage'))
const CashPage = lazy(() => import('../features/cash/registers/CashPage'))
const CashSessionPage = lazy(() => import('../features/cash/sessions/CashSessionPage'))
const CashSessionsPage = lazy(() => import('../features/cash/sessions/CashSessionsPage'))
const CashHistoryPage = lazy(() => import('../features/cash/history/CashHistoryPage'))
const CashRegistersPage = lazy(() => import('../features/cash/registers/CashRegistersPage'))
const PurchasesPage = lazy(() => import('../features/purchases/list/PurchasesPage'))
const PurchasePage = lazy(() => import('../features/purchases/detail/PurchasePage'))
const PurchaseGroupPage = lazy(() => import('../features/purchases/groups/PurchaseGroupPage'))
const PayablesPage = lazy(() => import('../features/purchases/payables/PayablesPage'))
const ReorderPage = lazy(() => import('../features/purchases/reorder/ReorderPage'))
const PosPage = lazy(() => import('../features/sales/pos/PosPage'))
const SalesPage = lazy(() => import('../features/sales/SalesPage'))
const LayawaysPage = lazy(() => import('../features/layaways/LayawaysPage'))
const LayawayPage = lazy(() => import('../features/layaways/LayawayPage'))
const SaleReturnsPage = lazy(() => import('../features/returns/SaleReturnsPage'))
const QuarantinePage = lazy(() => import('../features/returns/QuarantinePage'))
const TransfersPage = lazy(() => import('../features/transfers/TransfersPage'))
const ExpensesPage = lazy(() => import('../features/expenses/ExpensesPage'))
const RecurringExpensesPage = lazy(() => import('../features/expenses/RecurringExpensesPage'))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'))
const CustomersPage = lazy(() => import('../features/customers/CustomersPage'))
const CustomerPage = lazy(() => import('../features/customers/CustomerPage'))
const ReceivablesPage = lazy(() => import('../features/customers/ReceivablesPage'))
const PrescriptionsPage = lazy(() => import('../features/sales/PrescriptionsPage'))
const PortersPage = lazy(() => import('../features/expenses/porters/PortersPage'))
const PorterPage = lazy(() => import('../features/expenses/porters/PorterPage'))
const QuotesPage = lazy(() => import('../features/quotes/QuotesPage'))
const QuotePage = lazy(() => import('../features/quotes/QuotePage'))
const CustomerImportPage = lazy(() => import('../features/customers/import/CustomerImportPage'))
const PriceListsPage = lazy(() => import('../features/customers/priceLists/PriceListsPage'))
const PriceListPage = lazy(() => import('../features/customers/priceLists/PriceListPage'))
const CountsPage = lazy(() => import('../features/inventory/counts/CountsPage'))
const CountPage = lazy(() => import('../features/inventory/counts/CountPage'))
const AlertSettingsPage = lazy(() => import('../features/settings/alerts/AlertSettingsPage'))
const SalesSettingsPage = lazy(() => import('../features/settings/sales/SalesSettingsPage'))
const AppearanceSettingsPage = lazy(() => import('../features/settings/appearance/AppearanceSettingsPage'))
const BatchesPage = lazy(() => import('../features/purchases/batches/BatchesPage'))

const withTitle = (title) => ({ title })

// Informes: se entra con el permiso de cualquier área (D-INF-2)
export const REPORT_PERMISSIONS = ['reports.sales', 'reports.profit', 'reports.inventory', 'reports.cash', 'reports.purchases_expenses', 'reports.receivables']

/** Pantalla interna protegida por permiso y funcionalidad del plan. */
const guarded = ({ path, permission, feature, element, title }) => ({
  element: <RequirePermission permission={permission} feature={feature} />,
  children: [{ path, element, handle: withTitle(title) }],
})

export const routes = [
  {
    // Raíz: verifica la sesión antes de mostrar cualquier pantalla
    element: <SessionGate />,
    errorElement: <RouteErrorPage />,
    children: [
      // Pantallas de acceso
      {
        element: <AuthLayout />,
        children: [
          {
            element: <PublicOnly />,
            children: [{ path: ROUTES.login, element: <LoginPage />, handle: withTitle('Iniciar sesión') }],
          },
          // Accesibles con o sin sesión (el enlace del correo puede abrirse en cualquier momento)
          { path: ROUTES.forgotPassword, element: <ForgotPasswordPage />, handle: withTitle('Recuperar contraseña') },
          { path: ROUTES.resetPassword, element: <ResetPasswordPage />, handle: withTitle('Restablecer contraseña') },
          {
            element: <RequireAuth allowPendingPasswordChange />,
            children: [
              { path: ROUTES.changePassword, element: <ChangePasswordPage />, handle: withTitle('Cambiar contraseña') },
            ],
          },
        ],
      },

      // Sistema interno: requiere sesión y contraseña al día
      {
        element: <RequireAuth />,
        children: [
          {
            path: ROUTES.home,
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage />, handle: withTitle('Inicio') },
              guarded({ path: ROUTES.products, permission: 'inventory.view', feature: 'inventory', element: <ProductsPage />, title: 'Productos' }),
              guarded({ path: ROUTES.productDetail, permission: 'inventory.view', feature: 'inventory', element: <ProductDetailPage />, title: 'Producto' }),
              guarded({ path: ROUTES.categories, permission: 'categories.manage', feature: 'inventory', element: <CategoriesPage />, title: 'Categorías' }),
              guarded({ path: ROUTES.suppliers, permission: 'suppliers.view', feature: 'inventory', element: <SuppliersPage />, title: 'Proveedores' }),
              guarded({ path: ROUTES.inventoryCounts, permission: 'inventory.view', feature: 'inventory', element: <CountsPage />, title: 'Inventario físico' }),
              guarded({ path: ROUTES.inventoryCount, permission: 'inventory.view', feature: 'inventory', element: <CountPage />, title: 'Inventario físico' }),
              guarded({ path: ROUTES.labels, permission: 'inventory.update', feature: 'inventory', element: <LabelsPage />, title: 'Etiquetas' }),
              guarded({ path: ROUTES.bulkPrices, permission: 'inventory.prices', feature: 'inventory', element: <BulkPricesPage />, title: 'Cambiar precios en bloque' }),
              guarded({ path: ROUTES.productImport, permission: 'inventory.import', feature: 'inventory', element: <ProductImportPage />, title: 'Importar productos' }),
              guarded({ path: ROUTES.cash, permission: 'cash.view', feature: 'cash', element: <CashPage />, title: 'Mis cajas de hoy' }),
              guarded({ path: ROUTES.cashSessions, permission: 'cash.view', feature: 'cash', element: <CashSessionsPage />, title: 'Turnos' }),
              guarded({ path: ROUTES.cashSession, permission: 'cash.view', feature: 'cash', element: <CashSessionPage />, title: 'Turno de caja' }),
              guarded({ path: ROUTES.cashHistory, permission: 'cash.view', feature: 'cash', element: <CashHistoryPage />, title: 'Historial de caja' }),
              guarded({ path: ROUTES.cashRegisters, permission: 'cash.manage', feature: 'cash', element: <CashRegistersPage />, title: 'Cajas' }),
              guarded({ path: ROUTES.pos, permission: 'sales.create', feature: 'sales', element: <PosPage />, title: 'Punto de venta' }),
              guarded({ path: ROUTES.sales, permission: 'sales.view', feature: 'sales', element: <SalesPage />, title: 'Ventas' }),
              guarded({ path: ROUTES.layaways, permission: 'layaways.view', feature: 'sales', element: <LayawaysPage />, title: 'Apartados' }),
              guarded({ path: ROUTES.prescriptions, permission: 'sales.view', feature: 'sales', element: <PrescriptionsPage />, title: 'Fórmulas veterinarias' }),
              guarded({ path: ROUTES.porters, permission: 'porters.view', feature: 'sales', element: <PortersPage />, title: 'Conductores' }),
              guarded({ path: ROUTES.porterDetail, permission: 'porters.view', feature: 'sales', element: <PorterPage />, title: 'Conductor' }),
              guarded({ path: ROUTES.quotes, permission: 'quotes.view', feature: 'sales', element: <QuotesPage />, title: 'Cotizaciones' }),
              guarded({ path: ROUTES.quoteDetail, permission: 'quotes.view', feature: 'sales', element: <QuotePage />, title: 'Cotización' }),
              guarded({ path: ROUTES.layawayDetail, permission: 'layaways.view', feature: 'sales', element: <LayawayPage />, title: 'Apartado' }),
              guarded({ path: ROUTES.saleReturns, permission: 'sales.view', feature: 'sales', element: <SaleReturnsPage />, title: 'Devoluciones' }),
              guarded({ path: ROUTES.quarantine, permission: 'inventory.view', feature: 'inventory', element: <QuarantinePage />, title: 'Cuarentena' }),
              guarded({ path: ROUTES.transfers, permission: ['transfers.view', 'transfers.send', 'transfers.receive'], feature: 'branch_transfers', element: <TransfersPage />, title: 'Transferencias entre sedes' }),
              guarded({ path: ROUTES.expenses, permission: 'expenses.view', feature: 'expenses', element: <ExpensesPage />, title: 'Gastos' }),
              guarded({ path: ROUTES.recurringExpenses, permission: 'expenses.view', feature: 'expenses', element: <RecurringExpensesPage />, title: 'Gastos fijos' }),
              guarded({ path: ROUTES.reports, permission: REPORT_PERMISSIONS, feature: 'reports', element: <ReportsPage />, title: 'Informes' }),
              guarded({ path: ROUTES.customers, permission: 'customers.view', feature: 'customers', element: <CustomersPage />, title: 'Clientes' }),
              guarded({ path: ROUTES.customerImport, permission: 'customers.manage', feature: 'customers', element: <CustomerImportPage />, title: 'Importar clientes' }),
              guarded({ path: ROUTES.priceLists, permission: 'price_lists.manage', feature: 'sales', element: <PriceListsPage />, title: 'Listas de precios' }),
              guarded({ path: ROUTES.priceList, permission: 'price_lists.manage', feature: 'sales', element: <PriceListPage />, title: 'Lista de precios' }),
              guarded({ path: ROUTES.customerDetail, permission: 'customers.view', feature: 'customers', element: <CustomerPage />, title: 'Cliente' }),
              guarded({ path: ROUTES.receivables, permission: 'receivables.view', feature: 'customers', element: <ReceivablesPage />, title: 'Cartera' }),
              guarded({ path: ROUTES.purchases, permission: 'purchases.view', feature: 'purchases', element: <PurchasesPage />, title: 'Compras' }),
              guarded({ path: ROUTES.purchaseNew, permission: 'purchases.create', feature: 'purchases', element: <PurchasePage />, title: 'Nueva compra' }),
              guarded({ path: ROUTES.payables, permission: 'purchases.view', feature: 'purchases', element: <PayablesPage />, title: 'Cuentas por pagar' }),
              guarded({ path: ROUTES.reorder, permission: 'purchases.create', feature: 'purchases', element: <ReorderPage />, title: 'Pedido sugerido' }),
              guarded({ path: ROUTES.purchaseGroup, permission: 'purchases.view', feature: 'purchases', element: <PurchaseGroupPage />, title: 'Compra' }),
              guarded({ path: ROUTES.purchaseDetail, permission: 'purchases.view', feature: 'purchases', element: <PurchasePage />, title: 'Compra' }),
              guarded({ path: ROUTES.batches, permission: 'inventory.view', feature: 'purchases', element: <BatchesPage />, title: 'Lotes y vencimientos' }),
              guarded({ path: ROUTES.users, permission: 'users.view', feature: 'administration', element: <UsersPage />, title: 'Usuarios' }),
              guarded({ path: ROUTES.roles, permission: 'roles.view', feature: 'administration', element: <RolesPage />, title: 'Roles y permisos' }),
              guarded({ path: ROUTES.branches, permission: 'branches.view', feature: 'administration', element: <BranchesPage />, title: 'Sucursales' }),
              guarded({ path: ROUTES.audit, permission: 'audit.view', feature: 'audit', element: <AuditPage />, title: 'Auditoría' }),
              guarded({ path: ROUTES.businessSettings, permission: 'settings.update', feature: 'settings', element: <BusinessSettingsPage />, title: 'Negocio y comprobante' }),
              guarded({ path: ROUTES.taxSettings, permission: 'settings.tax', feature: 'settings', element: <TaxSettingsPage />, title: 'IVA y redondeo' }),
              guarded({ path: ROUTES.paymentMethods, permission: 'payment_methods.manage', feature: 'settings', element: <PaymentMethodsPage />, title: 'Métodos de pago' }),
              guarded({ path: ROUTES.units, permission: 'units.manage', feature: 'settings', element: <UnitsPage />, title: 'Unidades de medida' }),
              guarded({ path: ROUTES.salesSettings, permission: 'settings.update', feature: 'settings', element: <SalesSettingsPage />, title: 'Cotizaciones y apartados' }),
              guarded({ path: ROUTES.alertSettings, permission: 'settings.update', feature: 'settings', element: <AlertSettingsPage />, title: 'Avisos' }),
              guarded({ path: ROUTES.appearanceSettings, permission: 'settings.update', feature: 'settings', element: <AppearanceSettingsPage />, title: 'Apariencia' }),
              guarded({ path: ROUTES.backups, permission: 'backups.manage', feature: 'settings', element: <BackupsPage />, title: 'Copias de seguridad' }),
              guarded({ path: ROUTES.sequences, permission: 'document_sequences.manage', feature: 'settings', element: <SequencesPage />, title: 'Consecutivos' }),
              { path: '*', element: <NotFoundPage />, handle: withTitle('Página no encontrada') },
            ],
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
