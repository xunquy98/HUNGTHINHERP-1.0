
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { DeliveryNote, OrderItem, Product, Order } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { removeVietnameseTones, formatInputDate, formatCurrency, getCurrentDate } from '../utils/helpers';
import { Button, SearchInput } from './ui/Primitives';
import { Modal } from './ui/Modal';
import { FormField, FormInput, FormSelect, FormTextarea } from './ui/Form';
import { PrintPreviewModal as GenericPrintModal } from './print/PrintPreviewModal';

// --- CREATE MODAL ---

interface CreateDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialOrderId?: string;
}

interface DeliveryModalItem extends OrderItem {
    maxQuantity?: number; // derived from order remaining qty
}

export const CreateDeliveryModal: React.FC<CreateDeliveryModalProps> = ({ isOpen, onClose, initialOrderId }) => {
    const { addDeliveryNote, finalizeOrderWithDelivery, showNotification } = useAppContext();
    
    // Data Fetching
    const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
    const orders = useLiveQuery(() => db.orders.filter(o => !o.isDeleted).reverse().toArray()) || [];

    // --- STATE ---
    const [creationMode, setCreationMode] = useState<'order' | 'manual'>('order');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Common Form Data
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [shipperName, setShipperName] = useState('');
    const [shipperPhone, setShipperPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [address, setAddress] = useState('');
    
    // Order Mode State
    const [selectedOrderId, setSelectedOrderId] = useState('');
    
    // Manual Mode State
    const [items, setItems] = useState<DeliveryModalItem[]>([]);
    const [productSearch, setProductSearch] = useState('');

    // --- LOGIC: FROM ORDER ---
    const eligibleOrders = useMemo(() => {
        // Only orders that are Processing, PendingPayment, or partially shipped
        return orders.filter(o => {
            const validStatus = o.status === 'Processing' || o.status === 'PendingPayment' || o.status === 'PartiallyShipped' || o.status === 'Shipping';
            return validStatus;
        }).sort((a,b) => b.id.localeCompare(a.id));
    }, [orders]);

    const handleOrderSelect = (orderId: string) => {
        setSelectedOrderId(orderId);
        const order = orders.find(o => o.id === orderId);
        if (order) {
            setCustomerName(order.customerName);
            setAddress(''); 
            
            // Calculate remaining quantities
            const mappedItems = order.items.map(i => {
                const delivered = i.deliveredQuantity || 0;
                const remaining = Math.max(0, i.quantity - delivered);
                return {
                    ...i,
                    quantity: remaining,
                    maxQuantity: remaining
                };
            }).filter(i => i.maxQuantity && i.maxQuantity > 0); // Only show items still needing delivery
            
            setItems(mappedItems);
        }
    };

    // --- RESET & INIT ---
    useEffect(() => {
        if (isOpen) {
            setDate(new Date().toISOString().slice(0, 10));
            setShipperName('');
            setShipperPhone('');
            setNotes('');
            setCustomerName('');
            setAddress('');
            setItems([]);
            setSelectedOrderId('');
            setProductSearch('');
            setIsSubmitting(false);

            if (initialOrderId) {
                // If ID passed, select it immediately
                setCreationMode('order');
                handleOrderSelect(initialOrderId);
            }
        }
    }, [isOpen, initialOrderId, orders]); 

    // --- LOGIC: MANUAL ---
    const filteredProducts = useMemo(() => {
        const norm = removeVietnameseTones(productSearch);
        return products.filter(p => removeVietnameseTones(p.name).includes(norm) || p.sku.toLowerCase().includes(norm)).slice(0, 15);
    }, [productSearch, products]);

    const addItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: product.id, sku: product.sku, productName: product.name, unit: 'Cái',
                quantity: 1, price: product.retailPrice, total: product.retailPrice 
            }];
        });
    };

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
    
    const updateItemQty = (id: string, qty: number) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, qty) } : i));
    };

    // --- SUBMIT ---
    const handleSubmit = async () => {
        if (isSubmitting) return;
        if (!customerName) { showNotification('Vui lòng nhập tên khách hàng', 'error'); return; }
        
        // Filter out zero quantity items
        const validItems = items.filter(i => i.quantity > 0);
        if (validItems.length === 0) { showNotification('Vui lòng nhập số lượng giao hàng > 0', 'error'); return; }

        // Validate Limits
        if (creationMode === 'order') {
            const invalidItem = items.find(i => i.maxQuantity !== undefined && i.quantity > i.maxQuantity);
            if (invalidItem) {
                showNotification(`Sản phẩm "${invalidItem.productName}" vượt quá số lượng còn lại (${invalidItem.maxQuantity})`, 'error');
                return;
            }
        }

        setIsSubmitting(true);
        const payload = {
            code: `PGH-${Date.now().toString().slice(-6)}`,
            date: formatInputDate(date),
            customerName,
            address,
            shipperName,
            shipperPhone,
            notes,
            items: validItems, // This strips maxQuantity prop which is good
            status: 'Shipping' as const // Start as Shipping to trigger inventory movement
        };

        try {
            if (creationMode === 'order') {
                if (!selectedOrderId) { throw new Error('Vui lòng chọn đơn hàng'); }
                const order = orders.find(o => o.id === selectedOrderId);
                if (!order) throw new Error('Không tìm thấy đơn hàng');
                
                await finalizeOrderWithDelivery(selectedOrderId, {
                    ...payload,
                    orderCode: order.code
                });
            } else {
                await addDeliveryNote({
                    ...payload,
                    orderCode: 'MANUAL'
                });
            }
            onClose();
        } catch (e: any) {
            showNotification(e.message || 'Lỗi khi tạo phiếu giao', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tạo Phiếu Giao Hàng"
            subtitle="Lập phiếu xuất kho giao cho khách."
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
                    <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} icon="save">Lưu & Xuất kho</Button>
                </>
            }
        >
            <div className="space-y-6">
                
                {/* 1. Mode Switcher */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setCreationMode('order')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${creationMode === 'order' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[16px]">receipt_long</span> Từ đơn hàng
                    </button>
                    <button onClick={() => setCreationMode('manual')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${creationMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[16px]">edit_note</span> Tạo thủ công
                    </button>
                </div>

                {/* 2. Common Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Ngày giao">
                        <FormInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-2">
                        <FormField label="Người giao (Shipper)">
                            <FormInput value={shipperName} onChange={e => setShipperName(e.target.value)} placeholder="Tên shipper..." />
                        </FormField>
                        <FormField label="SĐT Shipper">
                            <FormInput value={shipperPhone} onChange={e => setShipperPhone(e.target.value)} placeholder="09..." />
                        </FormField>
                    </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* 3. Mode Specific Content */}
                {creationMode === 'order' ? (
                    <div className="space-y-4 animate-fadeIn">
                        <FormField label="Chọn đơn hàng cần giao" required>
                            <FormSelect value={selectedOrderId} onChange={e => handleOrderSelect(e.target.value)} disabled={!!initialOrderId}>
                                <option value="">-- Chọn đơn hàng --</option>
                                {eligibleOrders.map(o => (
                                    <option key={o.id} value={o.id}>{o.code} - {o.customerName} ({formatCurrency(o.total)})</option>
                                ))}
                            </FormSelect>
                        </FormField>
                        
                        {selectedOrderId && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 space-y-3">
                                <FormField label="Địa chỉ giao hàng">
                                    <FormTextarea rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="Số nhà, đường, phường, quận..." />
                                </FormField>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Hàng hóa cần giao</p>
                                        <span className="text-[10px] text-blue-600 font-bold bg-white px-2 py-0.5 rounded border border-blue-200">Điều chỉnh số lượng thực tế bên dưới</span>
                                    </div>
                                    <ul className="space-y-1">
                                        {items.map((item, idx) => (
                                            <li key={idx} className="flex justify-between items-center text-sm bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                                <div className="flex-1">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.productName}</span>
                                                    <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={item.quantity} 
                                                        onChange={e => updateItemQty(item.id, Number(e.target.value))}
                                                        className={`w-16 text-center text-sm font-bold border rounded py-1 px-1 focus:outline-none ${item.maxQuantity !== undefined && item.quantity > item.maxQuantity ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-300 focus:border-blue-500'}`}
                                                    />
                                                    {item.maxQuantity !== undefined && (
                                                        <span className={`text-[9px] font-bold ${item.quantity > item.maxQuantity ? 'text-red-500' : 'text-slate-400'}`}>Còn lại: {item.maxQuantity}</span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex h-[400px] gap-4 animate-fadeIn">
                        {/* Left: Product Search */}
                        <div className="w-1/3 flex flex-col border-r border-slate-200 dark:border-slate-700 pr-4">
                            <div className="mb-2">
                                <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Tìm sản phẩm..." />
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                {filteredProducts.map(p => (
                                    <div key={p.id} onClick={() => addItem(p)} className="p-2 rounded bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 cursor-pointer border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded font-mono">{p.sku}</span>
                                            <span className="text-[10px] font-bold text-blue-600">Tồn: {p.stock}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Right: Form & List */}
                        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Tên khách hàng" required>
                                    <FormInput value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nhập tên khách..." />
                                </FormField>
                                <FormField label="Số điện thoại">
                                    <FormInput value={notes} onChange={e => setNotes(e.target.value)} placeholder="SĐT liên hệ..." /> 
                                    {/* Using 'notes' field for phone temp or add phone field later */}
                                </FormField>
                            </div>
                            <FormField label="Địa chỉ giao">
                                <FormInput value={address} onChange={e => setAddress(e.target.value)} placeholder="Địa chỉ chi tiết..." />
                            </FormField>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-2">
                                {items.length === 0 ? (
                                    <p className="text-center text-slate-400 text-xs mt-10">Chưa có sản phẩm</p>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-500 border-b dark:border-slate-700"><th className="text-left py-1">Tên</th><th className="w-16">SL</th><th className="w-8"></th></tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                                    <td className="py-2 pr-2 font-medium">{item.productName}</td>
                                                    <td className="py-2"><input type="number" min="1" value={item.quantity} onChange={e => updateItemQty(item.id, Number(e.target.value))} className="w-full text-center bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600" /></td>
                                                    <td className="py-2 text-right"><button onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 rounded p-1"><span className="material-symbols-outlined text-[14px]">delete</span></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Common Note */}
                <FormField label="Ghi chú giao hàng">
                    <FormInput value={notes} onChange={e => setNotes(e.target.value)} placeholder="VD: Giao giờ hành chính, gọi trước 30p..." />
                </FormField>
            </div>
        </Modal>
    );
};

// --- PRINT MODAL ---

export const PrintDeliveryModal: React.FC<{ isOpen: boolean, onClose: () => void, data: DeliveryNote | null }> = ({ isOpen, onClose, data }) => {
    // Fetched partner data for TaxID
    const partners = useLiveQuery(() => db.partners.toArray()) || [];
    
    // Inject Partner Tax ID
    const enrichedData = useMemo(() => {
        if (!data) return null;
        let taxId = '';
        const partner = partners.find(p => p.name === data.customerName);
        if (partner) taxId = partner.taxId || '';
        return { ...data, taxId };
    }, [data, partners]);
    
    if (!enrichedData) return null;

    // Use GenericPrintModal to use TemplateEngine
    return (
        <GenericPrintModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Phiếu Giao ${enrichedData.code}`} 
            filename={`PhieuGiao_${enrichedData.code}_${enrichedData.date.replace(/\//g, '-')}`}
            data={enrichedData}
        />
    );
};
