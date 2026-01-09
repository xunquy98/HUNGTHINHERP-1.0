import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ImportOrder, ImportItem, Partner, Product, PartnerType } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { removeVietnameseTones, formatInputDate, formatCurrency, getCurrentDate } from '../utils/helpers';
import { parseInvoiceImage } from '../services/ai';
import { Button, SearchInput } from './ui/Primitives';
import { Modal } from './ui/Modal';
import { FormField, FormInput, FormSelect, FormTextarea } from './ui/Form';
import { PrintPreviewModal as GenericPrintModal } from './print/PrintPreviewModal';
import { WAREHOUSE_NAMES } from '../constants/options';
import { InlineNumberEdit } from './ui/InlineNumberEdit';

interface CreateImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialItems?: ImportItem[]; 
}

export const CreateImportModal: React.FC<CreateImportModalProps> = ({ isOpen, onClose, initialItems = [] }) => {
    const { createImportOrder, showNotification } = useAppContext();
    
    // Data Fetching (Local)
    const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
    const partners = useLiveQuery(() => db.partners.filter(p => !p.isDeleted).toArray()) || [];
    
    // Form State
    const [selectedSupplier, setSelectedSupplier] = useState<Partner | null>(null);
    const [items, setItems] = useState<ImportItem[]>(initialItems);
    const [invoiceNo, setInvoiceNo] = useState('');
    const [warehouse, setWarehouse] = useState('Kho Bạc Đạn');
    const [importDate, setImportDate] = useState(new Date().toISOString().slice(0, 10));
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');

    // UI Helper State
    const [productSearch, setProductSearch] = useState('');
    const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if(initialItems.length > 0) setItems(initialItems); }, [initialItems]);
    
    // Filters
    const filteredSuppliers = useMemo(() => {
        if (!partners) return [];
        const suppliers = partners.filter(p => p.type === PartnerType.Supplier);
        if (!supplierSearchQuery) return suppliers;
        const norm = removeVietnameseTones(supplierSearchQuery);
        return suppliers.filter(p => (removeVietnameseTones(p.name).includes(norm) || p.phone.includes(supplierSearchQuery)));
    }, [supplierSearchQuery, partners]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        const norm = removeVietnameseTones(productSearch);
        return products.filter(p => removeVietnameseTones(p.name).includes(norm) || p.sku.toLowerCase().includes(norm)).slice(0, 15);
    }, [productSearch, products]);

    // Actions
    const addItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i);
            }
            return [...prev, {
                id: product.id, sku: product.sku, productName: product.name, unit: 'Cái',
                quantity: 1, price: product.importPrice, total: product.importPrice
            }];
        });
    };

    const updateItem = (id: string, field: 'quantity' | 'price', value: number) => {
        if (value < 0) return;
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value, total: field === 'quantity' ? value * item.price : item.quantity * value } : item));
    };

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

    const totalAmount = items.reduce((sum, i) => sum + i.total, 0);
    const remainingDebt = Math.max(0, totalAmount - amountPaid);

    const handleSubmit = async (status: ImportOrder['status']) => {
        if (isSubmitting) return;
        if (!selectedSupplier) { showNotification('Vui lòng chọn nhà cung cấp', 'error'); return; }
        if (items.length === 0) { showNotification('Vui lòng thêm sản phẩm nhập', 'error'); return; }

        setIsSubmitting(true);
        try {
            await createImportOrder({
                code: `PN-${Date.now().toString().slice(-6)}`,
                supplierId: selectedSupplier.id, supplierName: selectedSupplier.name,
                date: formatInputDate(importDate), total: totalAmount, status: status,
                invoiceNo: invoiceNo, warehouse: warehouse, items: items,
                amountPaid: amountPaid, paymentMethod: paymentMethod
            });
            onClose();
            setItems([]); setSelectedSupplier(null); setInvoiceNo(''); setAmountPaid(0);
        } catch (error) {
            showNotification('Có lỗi xảy ra khi tạo phiếu', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // AI OCR
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Data = (event.target?.result as string).split(',')[1];
            setIsOcrLoading(true);
            try {
                const result = await parseInvoiceImage(base64Data);
                if (result.supplier) {
                    const foundSupplier = partners.find(p => p.type === PartnerType.Supplier && p.name.toLowerCase().includes(result.supplier.toLowerCase()));
                    if (foundSupplier) setSelectedSupplier(foundSupplier);
                }
                const mappedItems: ImportItem[] = [];
                for (const item of result.items) {
                    let product = products.find(p => p.sku === item.sku);
                    if (!product) {
                        const normName = removeVietnameseTones(item.productName || '');
                        product = products.find(p => removeVietnameseTones(p.name).includes(normName));
                    }
                    if (product) {
                        mappedItems.push({
                            id: product.id, sku: product.sku, productName: product.name, unit: 'Cái',
                            quantity: item.quantity || 1, price: item.price || product.importPrice,
                            total: (item.quantity || 1) * (item.price || product.importPrice)
                        });
                    }
                }
                if (mappedItems.length > 0) setItems(prev => [...prev, ...mappedItems]);
                showNotification(`Đã quét được ${mappedItems.length} sản phẩm`, 'success');
            } catch (err: any) { showNotification(err.message || 'Lỗi khi đọc hóa đơn.', 'error'); } finally { setIsOcrLoading(false); if(fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsDataURL(file);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/70 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/10">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <span className="material-symbols-outlined text-[20px]">input</span>
                        </div>
                        Tạo Phiếu Nhập Kho
                    </h2>
                    <div className="flex gap-3">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={isOcrLoading} icon="document_scanner">
                            {isOcrLoading ? 'Đang đọc...' : 'Quét hóa đơn AI'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose} icon="close" />
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANEL: PRODUCT SELECTOR */}
                    <div className="w-[30%] border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm z-10">
                            <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Tìm sản phẩm (Tên/SKU)..." className="w-full" />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                            {filteredProducts.map(p => (
                                <div key={p.id} onClick={() => addItem(p)} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group select-none active:scale-[0.98]">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-emerald-600 truncate">{p.name}</h4>
                                            <div className="flex gap-2 mt-1.5"><span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 font-bold">{p.sku}</span></div>
                                        </div>
                                        <div className="text-right shrink-0 ml-2">
                                            <span className="font-black text-slate-900 dark:text-white text-sm block">{formatCurrency(p.importPrice)}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Giá vốn</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT PANEL: FORM & CART */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 relative">
                        {/* 1. Supplier & Meta Info */}
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-20">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="col-span-2 relative">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Nhà cung cấp <span className="text-red-500">*</span></label>
                                    {selectedSupplier ? (
                                        <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                                            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">store</span> {selectedSupplier.name}</span>
                                            <button onClick={() => setSelectedSupplier(null)}><span className="material-symbols-outlined text-[16px]">close</span></button>
                                        </div>
                                    ) : (
                                        <>
                                            <input value={supplierSearchQuery} onChange={e => setSupplierSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="Tìm NCC..." />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">search</span>
                                            {supplierSearchQuery && filteredSuppliers.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                                                    {filteredSuppliers.map(s => (
                                                        <div key={s.id} onClick={() => { setSelectedSupplier(s); setSupplierSearchQuery(''); }} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-bold border-b border-slate-100 dark:border-slate-700 last:border-0">{s.name}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Ngày nhập</label>
                                    <input type="date" value={importDate} onChange={e => setImportDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Kho nhập</label>
                                    <select value={warehouse} onChange={e => setWarehouse(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold">
                                        {WAREHOUSE_NAMES.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4 mt-4">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Số hóa đơn</label>
                                    <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" placeholder="VD: HD-001" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Thanh toán ngay</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input type="number" value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} className="w-full pl-3 pr-12 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold text-emerald-600" />
                                            <button onClick={() => setAmountPaid(totalAmount)} className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[9px] bg-slate-100 hover:bg-slate-200 rounded uppercase font-bold text-slate-500">Tất cả</button>
                                        </div>
                                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold w-28">
                                            <option value="transfer">CK</option>
                                            <option value="cash">Tiền mặt</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="col-span-1 text-right pt-4">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Còn nợ lại</p>
                                    <p className={`text-lg font-black ${remainingDebt > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatCurrency(remainingDebt)}</p>
                                </div>
                            </div>
                        </div>

                        {/* 2. Items List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            {items.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-[48px] opacity-20">playlist_add</span>
                                    <p className="text-sm mt-2">Chọn sản phẩm từ danh sách bên trái</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-500 uppercase font-bold sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2">Sản phẩm</th>
                                            <th className="px-2 py-2 text-center w-20">SL</th>
                                            <th className="px-4 py-2 text-right w-32">Giá nhập</th>
                                            <th className="px-4 py-2 text-right w-32">Thành tiền</th>
                                            <th className="px-2 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {items.map((item, idx) => (
                                            <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-2">
                                                    <div className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{item.productName}</div>
                                                    <div className="text-[10px] font-mono text-slate-500">{item.sku}</div>
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded py-1 font-bold" />
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <input type="number" min="0" value={item.price} onChange={e => updateItem(item.id, 'price', Number(e.target.value))} className="w-full text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded py-1" />
                                                </td>
                                                <td className="px-4 py-2 text-right font-black text-slate-900 dark:text-white">{formatCurrency(item.total)}</td>
                                                <td className="px-2 py-2 text-center">
                                                    <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* 3. Footer Totals */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                            <div className="text-xs text-slate-500 font-bold">{items.length} mặt hàng</div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">Tổng tiền:</span>
                                <span className="text-2xl font-black text-blue-600">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</Button>
                    <Button variant="outline" onClick={() => handleSubmit('Pending')} disabled={isSubmitting || !selectedSupplier || items.length === 0}>Lưu nháp</Button>
                    <Button variant="primary" onClick={() => handleSubmit('Received')} disabled={isSubmitting || !selectedSupplier || items.length === 0} loading={isSubmitting} icon="check">Nhập kho & Hoàn tất</Button>
                </div>
            </div>
        </div>
    );
};

export const PrintImportModal: React.FC<{ isOpen: boolean, onClose: () => void, data: ImportOrder | null }> = ({ isOpen, onClose, data }) => {
    if (!data) return null;
    return (
        <GenericPrintModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Phiếu Nhập ${data.code}`}
            filename={`PhieuNhap_${data.code}`}
            data={data}
        />
    );
};

export const ReceiveItemsModal: React.FC<{ isOpen: boolean, onClose: () => void, importOrder: ImportOrder | null }> = ({ isOpen, onClose, importOrder }) => {
    const { addReceivingNote, showNotification } = useAppContext();
    const [items, setItems] = useState<{ id: string, quantity: number, max: number, name: string }[]>([]);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [landedCost, setLandedCost] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && importOrder) {
            setDate(new Date().toISOString().slice(0, 10));
            setNotes('');
            setLandedCost(0);
            
            const mapped = importOrder.items.map(i => {
                const received = i.receivedQuantity || 0;
                const remaining = Math.max(0, i.quantity - received);
                return {
                    id: i.id,
                    name: i.productName,
                    quantity: remaining, 
                    max: remaining
                };
            }).filter(i => i.max > 0);
            
            setItems(mapped);
        }
    }, [isOpen, importOrder]);

    const handleQuantityChange = (id: string, qty: number) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    };

    const handleSubmit = async () => {
        if (!importOrder) return;
        const validItems = items.filter(i => i.quantity > 0);
        if (validItems.length === 0) {
            showNotification('Vui lòng nhập số lượng nhận > 0', 'error');
            return;
        }
        const invalid = validItems.find(i => i.quantity > i.max);
        if (invalid) {
            showNotification(`Sản phẩm ${invalid.name} vượt quá số lượng đặt (${invalid.max})`, 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await addReceivingNote(
                importOrder.id,
                validItems.map(i => ({ id: i.id, quantity: i.quantity })),
                { date: formatInputDate(date), notes },
                landedCost
            );
            onClose();
        } catch (e: any) {
            showNotification(e.message || 'Lỗi khi nhập kho', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !importOrder) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Nhập Kho - ${importOrder.code}`}
            subtitle="Ghi nhận hàng về kho thực tế"
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
                    <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} icon="inventory">Xác nhận nhập kho</Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Ngày nhập">
                        <FormInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </FormField>
                    <FormField label="Chi phí vận chuyển/khác (Nếu có)">
                        <div className="relative">
                            <FormInput type="number" value={landedCost === 0 ? '' : landedCost} onChange={e => setLandedCost(Number(e.target.value))} placeholder="0" className="pr-12" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">VND</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Sẽ được phân bổ vào giá vốn sản phẩm.</p>
                    </FormField>
                </div>
                <FormField label="Ghi chú">
                    <FormTextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="VD: Hàng về đợt 1..." rows={2} />
                </FormField>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mt-4">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-2 text-left">Sản phẩm</th>
                                <th className="px-4 py-2 text-center w-24">Còn lại</th>
                                <th className="px-4 py-2 text-center w-32">Thực nhận</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{item.name}</td>
                                    <td className="px-4 py-2 text-center text-slate-500">{item.max}</td>
                                    <td className="px-4 py-2">
                                        <InlineNumberEdit 
                                            value={item.quantity} 
                                            onChange={v => handleQuantityChange(item.id, v)} 
                                            max={item.max} 
                                            min={0}
                                            align="center"
                                            className="border border-blue-200 bg-blue-50 text-blue-700 rounded font-bold"
                                        />
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-500 italic">Đã nhập đủ hàng.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

export const CreatePurchaseReturnModal: React.FC<{ isOpen: boolean, onClose: () => void, importOrder: ImportOrder }> = ({ isOpen, onClose, importOrder }) => {
    const { addPurchaseReturnNote, showNotification } = useAppContext();
    const [items, setItems] = useState<{ id: string, quantity: number, max: number, name: string, price: number }[]>([]);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [method, setMethod] = useState('debt_deduction');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && importOrder) {
            setDate(new Date().toISOString().slice(0, 10));
            setNotes('');
            const mapped = importOrder.items.map(i => ({
                id: i.id,
                name: i.productName,
                quantity: 0,
                max: i.receivedQuantity || i.quantity, // Can only return what was received
                price: i.price
            }));
            setItems(mapped);
        }
    }, [isOpen, importOrder]);

    const handleQuantityChange = (id: string, qty: number) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    };

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.quantity > 0);
        if (validItems.length === 0) {
            showNotification('Vui lòng chọn số lượng trả hàng', 'error');
            return;
        }
        
        setIsSubmitting(true);
        const refundAmount = validItems.reduce((sum, i) => sum + i.quantity * i.price, 0);

        try {
            await addPurchaseReturnNote({
                importOrder,
                items: validItems,
                refundAmount,
                method,
                notes,
                date: formatInputDate(date)
            });
            onClose();
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const totalRefund = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Trả Hàng NCC - ${importOrder.code}`}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
                    <Button variant="danger" onClick={handleSubmit} loading={isSubmitting} icon="keyboard_return">Xác nhận trả hàng</Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Ngày trả">
                        <FormInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </FormField>
                    <FormField label="Phương thức hoàn tiền">
                        <FormSelect value={method} onChange={e => setMethod(e.target.value)}>
                            <option value="debt_deduction">Trừ công nợ</option>
                            <option value="cash">Nhận tiền mặt</option>
                            <option value="transfer">Nhận chuyển khoản</option>
                        </FormSelect>
                    </FormField>
                </div>
                
                <FormField label="Lý do trả hàng">
                    <FormTextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Hàng lỗi, sai quy cách..." rows={2} />
                </FormField>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mt-4">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-2 text-left">Sản phẩm</th>
                                <th className="px-4 py-2 text-center w-24">Đã mua</th>
                                <th className="px-4 py-2 text-center w-32">Trả lại</th>
                                <th className="px-4 py-2 text-right w-32">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{item.name}</td>
                                    <td className="px-4 py-2 text-center text-slate-500">{item.max}</td>
                                    <td className="px-4 py-2">
                                        <InlineNumberEdit 
                                            value={item.quantity} 
                                            onChange={v => handleQuantityChange(item.id, v)} 
                                            max={item.max} 
                                            min={0}
                                            align="center"
                                            className="border border-red-200 bg-red-50 text-red-700 rounded font-bold"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                                        {formatCurrency(item.quantity * item.price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                            <tr>
                                <td colSpan={3} className="px-4 py-2 text-right font-bold text-slate-500 uppercase">Tổng hoàn lại</td>
                                <td className="px-4 py-2 text-right font-black text-red-600 text-lg">{formatCurrency(totalRefund)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </Modal>
    );
};