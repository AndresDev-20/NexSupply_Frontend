import { ArrowLeftRight, Archive, Undo2, ShieldAlert, Receipt, Repeat, ChartColumnBig, Banknote, ReceiptText, ScanBarcode, Contact, Wallet, BellRing, ClipboardCheck, Building2, CalendarClock, CalendarX2, HandCoins, ShoppingCart, CreditCard, FileSpreadsheet, FolderTree, Hash, History, House, Landmark, Package, Percent, Ruler, ScrollText, ShieldCheck, Store, Truck, Users, Palette } from 'lucide-react'
import { ROUTES } from '../routes/paths'

// Menú lateral. Cada entrada declara el permiso y la funcionalidad del plan que
// necesita: el menú solo muestra lo que el usuario puede usar, y las secciones
// sin entradas visibles se ocultan. Cada fase agrega aquí sus módulos.
export const NAVIGATION = [
  {
    section: 'General',
    items: [{ to: ROUTES.home, label: 'Inicio', icon: House, end: true }],
  },
  {
    section: 'Ventas',
    items: [
      { to: ROUTES.pos, label: 'Punto de venta', icon: ScanBarcode, permission: 'sales.create', feature: 'sales' },
      { to: ROUTES.sales, label: 'Ventas', icon: ReceiptText, permission: 'sales.view', feature: 'sales', end: true },
      { to: ROUTES.layaways, label: 'Apartados', icon: Archive, permission: 'layaways.view', feature: 'sales' },
      { to: ROUTES.saleReturns, label: 'Devoluciones', icon: Undo2, permission: 'sales.view', feature: 'sales' },
    ],
  },
  {
    section: 'Caja',
    items: [
      { to: ROUTES.cash, label: 'Mis cajas de hoy', icon: Banknote, permission: 'cash.view', feature: 'cash', end: true },
      { to: ROUTES.cashSessions, label: 'Turnos', icon: CalendarClock, permission: 'cash.view', feature: 'cash' },
      { to: ROUTES.cashHistory, label: 'Historial de caja', icon: History, permission: 'cash.view', feature: 'cash' },
      { to: ROUTES.cashRegisters, label: 'Cajas', icon: Landmark, permission: 'cash.manage', feature: 'cash' },
    ],
  },
  {
    section: 'Informes',
    items: [{ to: ROUTES.reports, label: 'Informes', icon: ChartColumnBig, permission: ['reports.sales', 'reports.profit', 'reports.inventory', 'reports.cash', 'reports.purchases_expenses', 'reports.receivables'], feature: 'reports' }],
  },
  {
    section: 'Gastos',
    items: [
      { to: ROUTES.expenses, label: 'Gastos', icon: Receipt, permission: 'expenses.view', feature: 'expenses', end: true },
      { to: ROUTES.recurringExpenses, label: 'Gastos fijos', icon: Repeat, permission: 'expenses.view', feature: 'expenses' },
    ],
  },
  {
    section: 'Clientes',
    items: [
      { to: ROUTES.customers, label: 'Clientes', icon: Contact, permission: 'customers.view', feature: 'customers' },
      { to: ROUTES.receivables, label: 'Cartera', icon: Wallet, permission: 'receivables.view', feature: 'customers' },
    ],
  },
  {
    section: 'Compras',
    items: [
      { to: ROUTES.purchases, label: 'Compras', icon: ShoppingCart, permission: 'purchases.view', feature: 'purchases', end: true },
      { to: ROUTES.payables, label: 'Cuentas por pagar', icon: HandCoins, permission: 'purchases.view', feature: 'purchases' },
    ],
  },
  {
    section: 'Inventario',
    items: [
      { to: ROUTES.products, label: 'Productos', icon: Package, permission: 'inventory.view', feature: 'inventory' },
      { to: ROUTES.categories, label: 'Categorías', icon: FolderTree, permission: 'categories.manage', feature: 'inventory' },
      { to: ROUTES.inventoryCounts, label: 'Inventario físico', icon: ClipboardCheck, permission: 'inventory.view', feature: 'inventory' },
      { to: ROUTES.batches, label: 'Lotes y vencimientos', icon: CalendarX2, permission: 'inventory.view', feature: 'purchases' },
      { to: ROUTES.quarantine, label: 'Cuarentena', icon: ShieldAlert, permission: 'inventory.view', feature: 'inventory' },
      // Fase 18: solo en el plan intermedio
      { to: ROUTES.transfers, label: 'Transferencias', icon: ArrowLeftRight, permission: ['transfers.view', 'transfers.send', 'transfers.receive'], feature: 'branch_transfers' },
      { to: ROUTES.suppliers, label: 'Proveedores', icon: Truck, permission: 'suppliers.view', feature: 'inventory' },
      { to: ROUTES.productImport, label: 'Importar desde Excel', icon: FileSpreadsheet, permission: 'inventory.import', feature: 'inventory' },
    ],
  },
  {
    section: 'Administración',
    items: [
      { to: ROUTES.users, label: 'Usuarios', icon: Users, permission: 'users.view', feature: 'administration' },
      { to: ROUTES.roles, label: 'Roles y permisos', icon: ShieldCheck, permission: 'roles.view', feature: 'administration' },
      { to: ROUTES.branches, label: 'Sucursales', icon: Store, permission: 'branches.view', feature: 'administration' },
      { to: ROUTES.audit, label: 'Auditoría', icon: ScrollText, permission: 'audit.view', feature: 'audit' },
    ],
  },
  {
    section: 'Configuración',
    items: [
      { to: ROUTES.businessSettings, label: 'Negocio y comprobante', icon: Building2, permission: 'settings.update', feature: 'settings' },
      { to: ROUTES.taxSettings, label: 'IVA y redondeo', icon: Percent, permission: 'settings.tax', feature: 'settings' },
      { to: ROUTES.paymentMethods, label: 'Métodos de pago', icon: CreditCard, permission: 'payment_methods.manage', feature: 'settings' },
      { to: ROUTES.units, label: 'Unidades de medida', icon: Ruler, permission: 'units.manage', feature: 'settings' },
      { to: ROUTES.alertSettings, label: 'Avisos', icon: BellRing, permission: 'settings.update', feature: 'settings' },
      { to: ROUTES.appearanceSettings, label: 'Apariencia', icon: Palette, permission: 'settings.update', feature: 'settings' },
      { to: ROUTES.sequences, label: 'Consecutivos', icon: Hash, permission: 'document_sequences.manage', feature: 'settings' },
    ],
  },
]
