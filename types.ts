
export type ViewState = 'DASHBOARD' | 'POS' | 'ORDERS' | 'QUOTES' | 'DELIVERY_NOTES' | 'IMPORTS' | 'INVENTORY' | 'PARTNERS' | 'DEBTS' | 'TRANSACTIONS' | 'REPORTS' | 'AUDIT_LOGS' | 'SETTINGS' | 'SYSTEM_LOGS';

export interface AppNotification {
  id: string;
  type: 'debt' | 'inventory' | 'system';
  severity: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  link?: { view: ViewState, params?: any };
}

export const PartnerType = {
  Customer: 'Customer',
  Supplier: 'Supplier'
} as const;
export type PartnerType = typeof PartnerType[keyof typeof PartnerType];

export interface Partner {
  id: string;
  code: string;
  name: string;
  type: PartnerType;
  phone: string;
  email?: string;
  address?: string;
  taxId?: string;
  debt?: number;
  debtLimit?: number;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
  seedTag?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  dimensions?: string;
  image?: string;
  importPrice: number;
  retailPrice: number;
  stock: number;
  location?: string;
  lastSupplier?: string;
  minStock?: number;
  stockReserved?: number;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
  seedTag?: string;
}

export interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  deliveredQuantity?: number; // Added for Partial Fulfillment
  price: number;
  total: number;
  costPrice?: number;
  maxQuantity?: number;
}

export type OrderStatus = 'PendingPayment' | 'Processing' | 'Shipping' | 'PartiallyShipped' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'card';

export interface Order {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  date: string;
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Partial';
  fulfillmentStatus?: 'NotShipped' | 'PartiallyShipped' | 'Shipped' | 'Delivered' | 'Returned';
  items: OrderItem[];
  lockedAt?: number;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
  seedTag?: string;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Cancelled';

export interface QuoteItem extends OrderItem {}

export interface Quote {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  address: string;
  date: string;
  validUntil: string;
  status: QuoteStatus;
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  items: QuoteItem[];
  customerId?: string;
  notes?: string;
  convertedOrderId?: string;
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

export type ImportStatus = 'Pending' | 'Receiving' | 'Received' | 'Completed' | 'Cancelled';

export interface ImportItem {
  id: string;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
  receivedQuantity?: number;
}

export interface ImportOrder {
  id: string;
  code: string;
  supplierId?: string;
  supplierName: string;
  date: string;
  total: number;
  status: ImportStatus;
  invoiceNo?: string;
  warehouse: string;
  items: ImportItem[];
  amountPaid?: number;
  paymentMethod?: PaymentMethod;
  lockedAt?: number;
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

export type DebtStatus = 'Overdue' | 'Pending' | 'Paid' | 'Partial' | 'DueSoon' | 'Void' | 'Normal';

export interface DebtRecord {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerInitials?: string;
  partnerPhone?: string;
  orderCode: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  type: 'Receivable' | 'Payable';
  payments?: { id: string; date: string; amount: number; method: string; notes?: string }[];
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

export type DeliveryStatus = 'Pending' | 'Shipping' | 'Delivered' | 'Cancelled';

export interface DeliveryNote {
  id: string;
  code: string;
  orderCode: string;
  customerName: string;
  address: string;
  date: string;
  shipperName?: string;
  shipperPhone?: string;
  status: DeliveryStatus;
  notes?: string;
  items: { id: string; productName: string; sku: string; unit: string; quantity: number; price: number; total: number; }[];
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
  seedTag?: string;
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  method: string;
  description: string;
  referenceCode?: string;
  partnerName?: string;
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  date: string;
  timestamp: number;
  type: string;
  changeAmount: number;
  oldStock: number;
  newStock: number;
  note?: string;
  referenceCode?: string;
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

// --- Dynamic Template Types ---
export type TemplateSectionType = 'header' | 'customer_info' | 'items_table' | 'payment_info' | 'totals' | 'notes' | 'signatures' | 'footer_note';

export interface TemplateSection {
    id: TemplateSectionType;
    visible: boolean;
    order: number;
    label?: string; // Custom label for section header
}

export interface TableColumnConfig {
    key: 'stt' | 'sku' | 'name' | 'unit' | 'quantity' | 'price' | 'total' | 'note';
    label: string;
    visible: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
}

export interface DocTypeConfig {
  title: string;
  footerNote: string;
  signatures: string[];
  // New Dynamic Configs
  sections?: TemplateSection[];
  columns?: TableColumnConfig[];
  colorTheme?: string; // Hex color for headers/accents
  noteLabel?: string; // Label for the dynamic note section
  
  // Custom HTML/CSS Support
  customCss?: string;
  customHeader?: string;
  customFooter?: string;
}

export interface DocPrintSettings {
  order: DocTypeConfig;
  quote: DocTypeConfig;
  import: DocTypeConfig;
  delivery: DocTypeConfig;
}

export interface AppSettings {
  general: { name: string; taxId: string; phone: string; email: string; website: string; address: string; logo: string };
  finance: { currency: string; vat: number; printInvoice: boolean };
  system: { orderPrefix: string; importPrefix: string; minStockDefault: number; debtDueDays: number };
  appearance: { theme: 'light' | 'dark'; density: 'comfortable' | 'compact' };
  documents: DocPrintSettings;
}

export type AuditAction = 
  'Create' | 'Update' | 'Delete' | 'SoftDelete' | 
  'StatusChange' | 'Payment' | 'AddItem' | 'RemoveItem' | 
  'Adjust' | 'Cancel' | 'Convert' | 'Approve' | 'Restore' | 'Lock';

export type AuditModule = 
  'Orders' | 'Inventory' | 'Debts' | 'Imports' | 'Partners' | 
  'Settings' | 'Returns' | 'Transactions' | 'Quotes' | 'Delivery' | 'System';

export interface AuditLog {
  id: string;
  createdAt: number;
  createdById: string;
  createdByName: string;
  
  module: AuditModule;
  entityType: string; // Order, Product, etc.
  entityId: string;
  entityCode?: string;
  
  action: AuditAction;
  summary: string;
  
  before?: any; // Snapshot (partial)
  after?: any;  // Snapshot (partial)
  diff?: any;   // Specific changes
  
  severity: 'info' | 'warn' | 'error';
  refType?: string;
  refCode?: string; // Cross-reference (e.g. Transaction ID)
  
  tags?: string[]; // 'money', 'stock', 'status'
  seedTag?: string;
}

export interface ErrorLog {
  id?: number; 
  timestamp: number;
  message: string;
  stack?: string;
  componentStack?: string;
  route?: string;
  severity: 'error' | 'warning';
  userAgent?: string;
}

export interface AICacheEntry {
  key: string;
  value: string;
  timestamp: number;
  expiresAt: number;
}

export interface ReturnItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReturnNote {
  id: string;
  code: string;
  orderCode: string;
  customerId?: string;
  customerName: string;
  date: string;
  items: ReturnItem[];
  subtotal: number;
  refundAmount: number;
  method: 'cash' | 'transfer' | 'debt_deduction';
  status: 'Completed';
  notes?: string;
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

export interface PurchaseReturnNote {
  id: string;
  code: string;
  importCode: string;
  supplierId?: string;
  supplierName: string;
  date: string;
  items: ReturnItem[];
  subtotal: number;
  refundAmount: number;
  method: 'cash' | 'transfer' | 'debt_deduction';
  status: 'Completed';
  notes?: string;
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

export interface ReceivingItem {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  importPrice: number;
  total: number;
  costAllocation?: number;
  finalUnitCost?: number;
}

export interface ReceivingNote {
  id: string;
  code: string;
  importCode: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  items: ReceivingItem[];
  status: 'Received';
  notes?: string;
  totalLandedCost?: number;
  createdAt: number;
  updatedAt: number;
  seedTag?: string;
}

export interface BackupData {
  metadata: {
    appVersion: string;
    schemaVersion: number;
    exportedAt: number;
    source: string;
  };
  data: {
    products: Product[];
    partners: Partner[];
    orders: Order[];
    quotes: Quote[];
    importOrders: ImportOrder[];
    debtRecords: DebtRecord[];
    transactions: Transaction[];
    inventoryLogs: InventoryLog[];
    deliveryNotes: DeliveryNote[];
    settings: { key: string, value: any }[];
    auditLogs: AuditLog[];
    returnNotes: ReturnNote[];
    purchaseReturnNotes: PurchaseReturnNote[];
    receivingNotes: ReceivingNote[];
    aiCache: AICacheEntry[]; // Include cache in backup
  };
}

export interface ReconcileIssue {
  type: string;
  severity: 'High' | 'Medium' | 'Low';
  entityId: string;
  entityName?: string;
  message: string;
  suggestedFix?: string;
}

export type DateFilterType = 'all' | 'today' | 'week' | 'month';

export interface SearchResult {
  id: string;
  type: 'ORDER' | 'QUOTE' | 'PARTNER' | 'PRODUCT' | 'DELIVERY' | 'IMPORT' | 'ACTION';
  title: string;
  subtitle: string;
  view: ViewState;
  icon: string;
  status?: string;
  code?: string;
  highlightId?: string;
}
