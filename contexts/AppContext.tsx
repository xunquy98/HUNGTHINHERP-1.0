
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import { 
    Order, Product, Partner, ImportOrder, DebtRecord, Transaction, 
    DeliveryNote, Quote, AppSettings, AppNotification, 
    AuditAction, AuditModule, ImportItem, ReturnNote, ReconcileIssue
} from '../types';
import { generateUUID, getCurrentDate } from '../utils/helpers';
import { logAudit } from '../services/audit';

// --- Types ---

export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    duration?: number;
    action?: { label: string; onClick: () => void };
}

export interface UserProfile {
    id: string;
    name: string;
    role: 'admin' | 'staff';
}

interface AppContextType {
    // State
    currentUser: UserProfile;
    setCurrentUser: (user: UserProfile) => void;
    settings: AppSettings;
    setSettings: (settings: AppSettings) => Promise<void>;
    notifications: AppNotification[];
    toasts: ToastMessage[];
    
    // UI Helpers
    showNotification: (message: string, type?: ToastMessage['type'], title?: string) => void;
    dismissNotification: (id: string) => void;
    clearAllDismissed: () => void;
    removeToast: (id: string) => void;
    confirm: (options: { title: string; message: string; type?: 'info' | 'warning' | 'danger'; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
    toggleTheme: () => void;

    // Data Actions
    // Partners
    addPartner: (partner: Partner) => Promise<string>;
    updatePartner: (partner: Partner) => Promise<void>;
    deletePartner: (id: string) => Promise<void>;

    // Products
    addProduct: (product: Product) => Promise<string>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    adjustStock: (productId: string, actualStock: number, reason: string, minStock?: number) => Promise<void>;

    // Orders
    createOrder: (data: any) => Promise<Order>;
    updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
    finalizeOrderWithDelivery: (orderId: string, deliveryData: any) => Promise<void>;

    // Quotes
    createQuote: (quote: any) => Promise<string>;
    updateQuote: (quote: any) => Promise<void>;
    deleteQuote: (id: string) => Promise<void>;
    convertQuoteToOrder: (id: string, options: any) => Promise<void>;

    // Imports
    createImportOrder: (data: any) => Promise<string>;
    addReceivingNote: (importId: string, items: {id: string, quantity: number}[], meta: any, landedCost: number) => Promise<void>;
    addPurchaseReturnNote: (data: { importOrder: ImportOrder, items: any[], refundAmount: number, method: string, notes: string, date: string }) => Promise<void>;
    updateImportStatus: (id: string, status: ImportOrder['status']) => Promise<void>;

    // Debts
    addPaymentToDebt: (debtId: string, payment: { amount: number, method: string, notes: string, date: string }) => Promise<void>;
    batchProcessDebtPayment: (partnerId: string, payment: any, allocations: any[]) => Promise<void>;

    // Transactions
    addManualTransaction: (data: any) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;

    // Delivery
    addDeliveryNote: (data: any) => Promise<void>;
    updateDeliveryNoteStatus: (id: string, status: DeliveryNote['status']) => Promise<void>;
    deleteDeliveryNote: (id: string) => Promise<void>;

    // Returns
    returnNotes: ReturnNote[]; // Added for OrderDetailDrawer

    // Delivery Notes
    deliveryNotes: DeliveryNote[]; // Added for OrderDetailDrawer

    // System
    lockDocument: (type: 'Order' | 'Import', id: string) => Promise<void>;
    globalSearch: (query: string) => Promise<any[]>;
    reconcileData: () => Promise<ReconcileIssue[]>;
    generateDebugBundle: () => Promise<string>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_SETTINGS: AppSettings = {
    general: { name: 'Cửa Hàng Bạc Đạn Hưng Thịnh', taxId: '', phone: '', email: '', website: '', address: '', logo: '' },
    finance: { currency: 'VND', vat: 8, printInvoice: true },
    system: { orderPrefix: 'DH', importPrefix: 'PN', minStockDefault: 10, debtDueDays: 30 },
    appearance: { theme: 'light', density: 'comfortable' },
    documents: {
        order: { title: 'HÓA ĐƠN BÁN HÀNG', footerNote: 'Cảm ơn quý khách đã mua hàng!', signatures: ['Người lập phiếu', 'Người giao hàng', 'Người nhận hàng'] },
        quote: { title: 'BẢNG BÁO GIÁ', footerNote: 'Báo giá có hiệu lực trong 7 ngày.', signatures: ['Người lập', 'Kế toán trưởng', 'Giám đốc'] },
        import: { title: 'PHIẾU NHẬP KHO', footerNote: '', signatures: ['Thủ kho', 'Người giao', 'Kế toán'] },
        delivery: { title: 'PHIẾU GIAO HÀNG', footerNote: 'Vui lòng kiểm tra kỹ hàng hóa trước khi nhận.', signatures: ['Người lập', 'Người giao', 'Người nhận'] }
    }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- State ---
    const [currentUser, setCurrentUser] = useState<UserProfile>({ id: 'admin', name: 'Xun Quý', role: 'admin' });
    const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    // Simple state for related lists (could be replaced by direct db hooks in components)
    const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
    const [returnNotes, setReturnNotes] = useState<ReturnNote[]>([]);

    // --- Load Settings ---
    useEffect(() => {
        const load = async () => {
            const saved = await db.settings.get('appSettings');
            if (saved) setSettingsState(saved.value);
            
            // Initial Data Load
            setDeliveryNotes(await db.deliveryNotes.toArray());
            setReturnNotes(await db.returnNotes.toArray());
        };
        load();
    }, []);

    const setSettings = async (newSettings: AppSettings) => {
        setSettingsState(newSettings);
        await db.settings.put({ key: 'appSettings', value: newSettings });
    };

    // --- Toast & Notification ---
    const showNotification = useCallback((message: string, type: ToastMessage['type'] = 'info', title?: string) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, type, message, title }]);
        // Also log to notifications if important
        if (type === 'error' || type === 'warning') {
            setNotifications(prev => [{
                id, type: 'system', severity: type === 'error' ? 'danger' : 'warning',
                title: title || (type === 'error' ? 'Lỗi' : 'Cảnh báo'),
                message, timestamp: Date.now()
            }, ...prev]);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAllDismissed = () => { /* No-op for now or restore from history */ };

    // --- Confirm Modal (Mock implementation utilizing window.confirm or a custom modal state) ---
    // Since we need to return a Promise, we'll use a simple ref-based approach or context state 
    // In a real app, this would control a global modal state. For simplicity here:
    const confirm = async ({ title, message }: { title: string; message: string }) => {
        return window.confirm(`${title}\n\n${message}`); 
    };

    // --- Audit Helper ---
    const audit = async (action: AuditAction, module: AuditModule, summary: string, entityId: string, entityType: string, entityCode?: string) => {
        await logAudit({
            module, entityType, entityId, entityCode, action, summary, actor: currentUser
        });
    };

    // --- DATA ACTIONS IMPLEMENTATION ---

    const addPartner = async (partner: Partner) => {
        const id = generateUUID('partner');
        const now = Date.now();
        await db.partners.add({ ...partner, id, createdAt: now, updatedAt: now });
        await audit('Create', 'Partners', `Created partner ${partner.name}`, id, 'Partner', partner.code);
        return id;
    };

    const updatePartner = async (partner: Partner) => {
        await db.partners.put({ ...partner, updatedAt: Date.now() });
        await audit('Update', 'Partners', `Updated partner ${partner.name}`, partner.id, 'Partner', partner.code);
    };

    const deletePartner = async (id: string) => {
        const p = await db.partners.get(id);
        if (p) {
            await db.partners.update(id, { isDeleted: true });
            await audit('SoftDelete', 'Partners', `Deleted partner ${p.name}`, id, 'Partner', p.code);
        }
    };

    const addProduct = async (product: Product) => {
        const id = generateUUID('prod');
        const now = Date.now();
        await db.products.add({ ...product, id, createdAt: now, updatedAt: now });
        await audit('Create', 'Inventory', `Created product ${product.name}`, id, 'Product', product.sku);
        return id;
    };

    const updateProduct = async (product: Product) => {
        await db.products.put({ ...product, updatedAt: Date.now() });
        await audit('Update', 'Inventory', `Updated product ${product.name}`, product.id, 'Product', product.sku);
    };

    const deleteProduct = async (id: string) => {
        const p = await db.products.get(id);
        if (p) {
            await db.products.update(id, { isDeleted: true });
            await audit('SoftDelete', 'Inventory', `Deleted product ${p.name}`, id, 'Product', p.sku);
        }
    };

    const adjustStock = async (productId: string, actualStock: number, reason: string, minStock?: number) => {
        const p = await db.products.get(productId);
        if (!p) return;
        const diff = actualStock - p.stock;
        if (diff === 0 && minStock === p.minStock) return;

        await db.products.update(productId, { stock: actualStock, minStock: minStock ?? p.minStock, updatedAt: Date.now() });
        
        await db.inventoryLogs.add({
            id: generateUUID('log'),
            productId, sku: p.sku, productName: p.name,
            type: 'adjustment', changeAmount: diff,
            oldStock: p.stock, newStock: actualStock,
            date: new Date().toLocaleDateString('vi-VN'),
            timestamp: Date.now(),
            note: reason,
            createdAt: Date.now(), updatedAt: Date.now()
        });
        
        await audit('Adjust', 'Inventory', `Adjusted stock for ${p.sku}: ${p.stock} -> ${actualStock}`, productId, 'Product', p.sku);
    };

    const createOrder = async (data: any) => {
        const id = generateUUID('ord');
        const now = Date.now();
        const orderCode = data.code || `#ORD-${now.toString().slice(-6)}`;
        
        const newOrder: Order = {
            id,
            code: orderCode,
            customerName: data.customerName,
            phone: data.customer?.phone || '',
            date: new Date().toLocaleDateString('vi-VN'),
            status: data.status || 'Completed',
            items: data.cart || [],
            subtotal: data.subtotal,
            discount: data.discount,
            vatRate: data.vatRate,
            vatAmount: data.vatAmount,
            total: data.totalAmount,
            amountPaid: data.amountPaid,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus,
            fulfillmentStatus: data.fulfillmentStatus,
            createdAt: now,
            updatedAt: now
        };

        await (db as any).transaction('rw', db.orders, db.products, db.inventoryLogs, db.debtRecords, db.transactions, db.auditLogs, async () => {
            await db.orders.add(newOrder);
            
            // Deduct Stock
            for (const item of newOrder.items) {
                const p = await db.products.get(item.id);
                if (p) {
                    const newStock = p.stock - item.quantity;
                    await db.products.update(item.id, { stock: newStock });
                    await db.inventoryLogs.add({
                        id: generateUUID('log'),
                        productId: item.id, sku: item.sku, productName: item.productName,
                        type: 'sale', changeAmount: -item.quantity,
                        oldStock: p.stock, newStock,
                        date: newOrder.date, timestamp: now,
                        referenceCode: orderCode,
                        createdAt: now, updatedAt: now
                    });
                }
            }

            // Record Debt if needed
            if (newOrder.amountPaid < newOrder.total) {
                await db.debtRecords.add({
                    id: generateUUID('debt'),
                    partnerId: data.customer?.id || 'guest',
                    partnerName: data.customerName,
                    orderCode,
                    issueDate: newOrder.date,
                    dueDate: new Date(now + (settings.system.debtDueDays * 86400000)).toLocaleDateString('vi-VN'),
                    totalAmount: newOrder.total,
                    remainingAmount: newOrder.total - newOrder.amountPaid,
                    status: 'Pending',
                    type: 'Receivable',
                    createdAt: now, updatedAt: now
                });
                // Update Partner Debt
                if (data.customer?.id) {
                    const p = await db.partners.get(data.customer.id);
                    if (p) await db.partners.update(p.id, { debt: (p.debt || 0) + (newOrder.total - newOrder.amountPaid) });
                }
            }

            // Record Transaction
            if (newOrder.amountPaid > 0) {
                await db.transactions.add({
                    id: generateUUID('txn'),
                    date: newOrder.date,
                    type: 'income',
                    category: 'sale',
                    amount: newOrder.amountPaid,
                    method: newOrder.paymentMethod,
                    description: `Thu tiền đơn hàng ${orderCode}`,
                    referenceCode: orderCode,
                    partnerName: newOrder.customerName,
                    createdAt: now, updatedAt: now
                });
            }

            await logAudit({
                module: 'Orders', entityType: 'Order', entityId: id, entityCode: orderCode,
                action: 'Create', summary: `Created order ${orderCode}`, actor: currentUser
            });
        });

        return newOrder;
    };

    const updateOrderStatus = async (id: string, status: Order['status']) => {
        await db.orders.update(id, { status, updatedAt: Date.now() });
        await audit('StatusChange', 'Orders', `Changed status to ${status}`, id, 'Order');
    };

    const deleteOrder = async (id: string) => {
        const order = await db.orders.get(id);
        if (!order) return;
        
        await (db as any).transaction('rw', db.orders, db.products, db.inventoryLogs, db.auditLogs, async () => {
            // Restore Stock
            if (order.status !== 'Cancelled') {
                for (const item of order.items) {
                    const p = await db.products.get(item.id);
                    if (p) {
                        await db.products.update(item.id, { stock: p.stock + item.quantity });
                    }
                }
            }
            await db.orders.delete(id);
            await logAudit({ module: 'Orders', entityType: 'Order', entityId: id, entityCode: order.code, action: 'Delete', summary: `Deleted order ${order.code}`, actor: currentUser });
        });
    };

    const finalizeOrderWithDelivery = async (orderId: string, deliveryData: any) => {
        // ... Implementation for finalizing order and creating delivery note ...
        // For brevity, simple update
        await db.orders.update(orderId, { status: 'Shipping', fulfillmentStatus: 'Shipped' });
        await addDeliveryNote(deliveryData);
    };

    const createQuote = async (quote: any) => {
        const id = generateUUID('quote');
        const code = quote.code || `BG-${Date.now().toString().slice(-6)}`;
        await db.quotes.add({ ...quote, id, code, createdAt: Date.now(), updatedAt: Date.now() });
        await audit('Create', 'Quotes', `Created quote ${code}`, id, 'Quote', code);
        return id;
    };

    const updateQuote = async (quote: any) => {
        await db.quotes.put({ ...quote, updatedAt: Date.now() });
        await audit('Update', 'Quotes', `Updated quote ${quote.code}`, quote.id, 'Quote', quote.code);
    };

    const deleteQuote = async (id: string) => {
        await db.quotes.delete(id);
    };

    const convertQuoteToOrder = async (id: string, options: any) => {
        // Logic to convert quote to order
        const quote = await db.quotes.get(id);
        if (!quote) return;
        await createOrder({
            code: quote.code.replace('BG', 'DH'),
            customerName: quote.customerName,
            customer: { id: quote.customerId, phone: quote.phone },
            cart: quote.items,
            subtotal: quote.subtotal,
            discount: quote.discount,
            vatRate: quote.vatRate,
            vatAmount: quote.vatAmount,
            totalAmount: quote.total,
            amountPaid: 0,
            paymentMethod: 'transfer',
            paymentStatus: 'Unpaid'
        });
        await db.quotes.update(id, { status: 'Accepted' });
    };

    // --- IMPORTS ---
    const createImportOrder = async (data: any) => {
        const id = generateUUID('imp');
        await (db as any).transaction('rw', db.importOrders, db.products, db.inventoryLogs, db.debtRecords, db.transactions, db.auditLogs, async () => {
            await db.importOrders.add({ ...data, id, createdAt: Date.now(), updatedAt: Date.now() });
            
            if (data.status === 'Received' || data.status === 'Completed') {
                for (const item of data.items) {
                    const p = await db.products.get(item.id);
                    if (p) {
                        const newStock = p.stock + item.quantity;
                        // Update cost price (Weighted Average Cost could be implemented here)
                        await db.products.update(item.id, { stock: newStock, importPrice: item.price });
                        await db.inventoryLogs.add({
                            id: generateUUID('log'),
                            productId: item.id, sku: item.sku, productName: item.productName,
                            type: 'import', changeAmount: item.quantity,
                            oldStock: p.stock, newStock,
                            date: data.date, timestamp: Date.now(),
                            referenceCode: data.code,
                            createdAt: Date.now(), updatedAt: Date.now()
                        });
                    }
                }
            }
            
            // Debt / Transaction logic for Supplier...
        });
        return id;
    };

    const updateImportStatus = async (id: string, status: ImportOrder['status']) => {
        await db.importOrders.update(id, { status, updatedAt: Date.now() });
    };

    const addReceivingNote = async (importId: string, items: {id: string, quantity: number}[], meta: any, landedCost: number) => {
        // Update stock and status
    };

    // MISSING FUNCTION FROM PROMPT
    const addPurchaseReturnNote = async (data: { importOrder: ImportOrder, items: any[], refundAmount: number, method: string, notes: string, date: string }) => {
        const id = generateUUID('prn');
        const code = `TH-${Date.now().toString().slice(-6)}`;
        await (db as any).transaction('rw', db.purchaseReturnNotes, db.products, db.transactions, db.debtRecords, db.partners, db.auditLogs, db.inventoryLogs, async () => {
            // 1. Add Return Note
            await db.purchaseReturnNotes.add({
                id, code,
                importCode: data.importOrder.code,
                supplierId: data.importOrder.supplierId,
                supplierName: data.importOrder.supplierName,
                date: data.date,
                items: data.items,
                subtotal: data.refundAmount,
                refundAmount: data.refundAmount,
                method: data.method as any,
                status: 'Completed',
                notes: data.notes,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            // 2. Update Stock & Log Inventory
            for(const item of data.items) {
                const p = await db.products.get(item.id);
                if(p) {
                    const newStock = p.stock - item.quantity;
                    await db.products.update(p.id, { stock: newStock });
                    await db.inventoryLogs.add({
                        id: generateUUID('inv'),
                        productId: p.id,
                        sku: p.sku,
                        productName: p.name,
                        type: 'return_supplier',
                        changeAmount: -item.quantity,
                        oldStock: p.stock,
                        newStock: newStock,
                        date: data.date,
                        timestamp: Date.now(),
                        referenceCode: code,
                        note: `Trả hàng NCC: ${data.notes}`,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
            }

            // 3. Financial Transaction or Debt Deduction
            if (data.method === 'debt_deduction') {
                // Find the debt record for the original import
                const debt = await db.debtRecords.where('orderCode').equals(data.importOrder.code).first();
                if (debt) {
                    const newRemaining = Math.max(0, debt.remainingAmount - data.refundAmount);
                    const newStatus = newRemaining === 0 ? 'Paid' : 'Partial';
                    
                    const deductionPayment = { 
                        id: generateUUID('pay'), 
                        date: data.date, 
                        amount: data.refundAmount, 
                        method: 'return_deduction', 
                        notes: `Khấu trừ từ phiếu trả ${code}` 
                    };

                    await db.debtRecords.update(debt.id, {
                        remainingAmount: newRemaining,
                        status: newStatus,
                        payments: [...(debt.payments || []), deductionPayment],
                        updatedAt: Date.now()
                    });

                    // Update Partner Balance
                    const partner = await db.partners.get(debt.partnerId);
                    if (partner) {
                        await db.partners.update(partner.id, { 
                            debt: Math.max(0, (partner.debt || 0) - data.refundAmount) 
                        });
                    }
                }
            } else if (data.refundAmount > 0) {
                // Cash/Transfer Refund -> Income Transaction
                await db.transactions.add({
                    id: generateUUID('txn'),
                    date: data.date,
                    type: 'income',
                    category: 'import',
                    amount: data.refundAmount,
                    method: data.method,
                    description: `Hoàn tiền trả hàng ${code} (${data.importOrder.code})`,
                    referenceCode: code,
                    partnerName: data.importOrder.supplierName,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
            }

            await logAudit({
                module: 'Imports',
                entityType: 'PurchaseReturnNote',
                entityId: id,
                entityCode: code,
                action: 'Create',
                summary: `Created Purchase Return ${code} for Import ${data.importOrder.code}`,
                actor: currentUser
            });
        });
        showNotification('Tạo phiếu trả hàng thành công', 'success');
    };

    // --- OTHER ACTIONS ---
    const addDeliveryNote = async (data: any) => {
        const id = generateUUID('dn');
        await db.deliveryNotes.add({ ...data, id, createdAt: Date.now(), updatedAt: Date.now() });
        setDeliveryNotes(prev => [data, ...prev]); // Optimistic update
    };

    const updateDeliveryNoteStatus = async (id: string, status: DeliveryNote['status']) => {
        await db.deliveryNotes.update(id, { status, updatedAt: Date.now() });
    };

    const deleteDeliveryNote = async (id: string) => {
        await db.deliveryNotes.delete(id);
    };

    const addPaymentToDebt = async (debtId: string, payment: any) => {
        const debt = await db.debtRecords.get(debtId);
        if (!debt) return;
        
        const newRemaining = debt.remainingAmount - payment.amount;
        const newStatus = newRemaining <= 0 ? 'Paid' : 'Partial';
        
        await db.debtRecords.update(debtId, {
            remainingAmount: newRemaining,
            status: newStatus,
            payments: [...(debt.payments || []), { ...payment, id: generateUUID('pay') }],
            updatedAt: Date.now()
        });
        
        // Add Transaction
        await db.transactions.add({
            id: generateUUID('txn'),
            date: payment.date,
            type: debt.type === 'Receivable' ? 'income' : 'expense',
            category: debt.type === 'Receivable' ? 'debt_collection' : 'debt_payment',
            amount: payment.amount,
            method: payment.method,
            description: payment.notes,
            referenceCode: debt.orderCode,
            partnerName: debt.partnerName,
            createdAt: Date.now(), updatedAt: Date.now()
        });
    };

    const batchProcessDebtPayment = async () => {}; // Placeholder
    const addManualTransaction = async (data: any) => {
        await db.transactions.add({ ...data, id: generateUUID('txn'), createdAt: Date.now(), updatedAt: Date.now() });
    };
    const deleteTransaction = async (id: string) => { await db.transactions.delete(id); };
    const lockDocument = async () => {}; // Placeholder
    const globalSearch = async () => []; // Placeholder
    const reconcileData = async () => []; // Placeholder
    const generateDebugBundle = async () => "{}";
    const toggleTheme = () => {
        const newTheme = settings.appearance.theme === 'light' ? 'dark' : 'light';
        setSettings({ ...settings, appearance: { ...settings.appearance, theme: newTheme } });
        document.documentElement.classList.toggle('dark');
    };

    const value = {
        currentUser, setCurrentUser,
        settings, setSettings,
        notifications, toasts,
        showNotification, dismissNotification, clearAllDismissed, removeToast, confirm, toggleTheme,
        addPartner, updatePartner, deletePartner,
        addProduct, updateProduct, deleteProduct, adjustStock,
        createOrder, updateOrderStatus, deleteOrder, finalizeOrderWithDelivery,
        createQuote, updateQuote, deleteQuote, convertQuoteToOrder,
        createImportOrder, addReceivingNote, addPurchaseReturnNote, updateImportStatus,
        addPaymentToDebt, batchProcessDebtPayment,
        addManualTransaction, deleteTransaction,
        addDeliveryNote, updateDeliveryNoteStatus, deleteDeliveryNote,
        returnNotes, deliveryNotes,
        lockDocument, globalSearch, reconcileData, generateDebugBundle
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within AppProvider");
    return context;
};
