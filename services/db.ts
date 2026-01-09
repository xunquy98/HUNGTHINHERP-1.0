
import Dexie, { type Table } from 'dexie';
import { Product, Order, Partner, DebtRecord, ImportOrder, Transaction, InventoryLog, DeliveryNote, Quote, AuditLog, ReturnNote, PurchaseReturnNote, ReceivingNote, ErrorLog, AICacheEntry } from '../types';

export class ERPDatabase extends Dexie {
  products!: Table<Product>;
  orders!: Table<Order>;
  partners!: Table<Partner>;
  debtRecords!: Table<DebtRecord>;
  importOrders!: Table<ImportOrder>;
  transactions!: Table<Transaction>;
  inventoryLogs!: Table<InventoryLog>;
  deliveryNotes!: Table<DeliveryNote>;
  quotes!: Table<Quote>;
  settings!: Table<{key: string, value: any}>;
  auditLogs!: Table<AuditLog>;
  returnNotes!: Table<ReturnNote>;
  purchaseReturnNotes!: Table<PurchaseReturnNote>;
  receivingNotes!: Table<ReceivingNote>;
  errorLogs!: Table<ErrorLog>;
  aiCache!: Table<AICacheEntry>;
  meta!: Table<{key: string, value: any}>;

  constructor() {
    super('ERP_Bearing_DB');
    
    // Updated schema version 23 to include aiCache
    (this as any).version(23).stores({
      products: 'id, sku, name, brand, location, stock, retailPrice, createdAt, updatedAt, isDeleted, seedTag',
      orders: 'id, code, customerName, phone, date, status, total, quoteId, createdAt, updatedAt, isDeleted, seedTag',
      partners: 'id, code, name, type, phone, createdAt, updatedAt, isDeleted, seedTag',
      debtRecords: 'id, partnerId, partnerName, orderCode, status, type, totalAmount, remainingAmount, dueDate, createdAt, updatedAt, seedTag',
      importOrders: 'id, code, supplierId, supplierName, date, status, total, warehouse, invoiceNo, createdAt, updatedAt, seedTag',
      transactions: 'id, date, type, category, method, amount, referenceCode, createdAt, updatedAt, seedTag',
      inventoryLogs: 'id, productId, sku, type, date, timestamp, createdAt, updatedAt, seedTag',
      deliveryNotes: 'id, code, orderCode, date, status, createdAt, updatedAt, seedTag',
      quotes: 'id, code, customerName, date, status, total, convertedOrderId, createdAt, updatedAt, seedTag',
      settings: 'key',
      // Audit Logs: Optimized indexing for fast filtering
      auditLogs: 'id, module, entityType, entityId, entityCode, action, createdAt, createdById, refCode, severity, seedTag, [module+createdAt], [entityType+entityId]',
      returnNotes: 'id, code, orderCode, customerId, date, createdAt, seedTag',
      purchaseReturnNotes: 'id, code, importCode, supplierId, date, createdAt, seedTag',
      receivingNotes: 'id, code, importCode, supplierId, date, createdAt, seedTag',
      errorLogs: '++id, timestamp, severity, route',
      aiCache: 'key, expiresAt', // Simple key-value store for AI responses with TTL
      meta: 'key'
    });
  }
}

export const db = new ERPDatabase();
