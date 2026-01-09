
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Quote, QuoteItem, Partner, Product, PartnerType } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency, removeVietnameseTones, formatInputDate as formatDateDDMM, parseDate } from '../utils/helpers';
import { Button, SearchInput } from './ui/Primitives';
import { Modal } from './ui/Modal';
import { FormField, FormInput, FormSelect, FormTextarea } from './ui/Form';
import { InlineNumberEdit } from './ui/InlineNumberEdit';
import { PrintPreviewModal as GenericPrintModal } from './print/PrintPreviewModal';

// --- Helper to convert DD/MM/YYYY to YYYY-MM-DD for inputs ---
const toInputDate = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().slice(0, 10);
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return new Date().toISOString().slice(0, 10);
};

interface CreateQuoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    initialData?: Quote | null;
}

export const CreateQuoteModal: React.FC<CreateQuoteModalProps> = ({ isOpen, onClose, mode, initialData }) => {
    const { createQuote, updateQuote, showNotification } = useAppContext();

    // Data Fetching
    const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
    const partners = useLiveQuery(() => db.partners.filter(p => !p.isDeleted).toArray()) || [];

    // Form State
    const [code, setCode] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
    const [validUntil, setValidUntil] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)); // YYYY-MM-DD
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [vatRate, setVatRate] = useState(8); // Default 8%
    const [notes, setNotes] = useState('');
    const [customerId, setCustomerId] = useState<string | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI Helper State
    const [productSearch, setProductSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerResults, setShowCustomerResults] = useState(false);

    // Init Data
    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && initialData) {
                setCode(initialData.code);
                setCustomerName(initialData.customerName);
                setPhone(initialData.phone);
                setAddress(initialData.address);
                setDate(toInputDate(initialData.date));
                setValidUntil(toInputDate(initialData.validUntil));
                setItems(initialData.items);
                setDiscount(initialData.discount);
                setVatRate(initialData.vatRate);
                setNotes(initialData.notes || '');
                setCustomerId(initialData.customerId);
                setCustomerSearch(initialData.customerName);
            } else {
                // Generate default code for new quote: BG-YYYYMM-XXXX
                const now = new Date();
                const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                const defaultCode = `BG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}-${randomPart}`;
                
                setCode(defaultCode);
                setCustomerName('');
                setPhone('');
                setAddress('');
                setDate(new Date().toISOString().slice(0, 10));
                setValidUntil(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
                setItems([]);
                setDiscount(0);
                setVatRate(8);
                setNotes('');
                setCustomerId(undefined);
                setCustomerSearch('');
            }
            setProductSearch('');
            setShowCustomerResults(false);
            setIsSubmitting(false);
        }
    }, [isOpen, mode, initialData]);

    // Derived Lists
    const filteredProducts = useMemo(() => {
        const norm = removeVietnameseTones(productSearch);
        return products.filter(p => 
            removeVietnameseTones(p.name).includes(norm) || 
            p.sku.toLowerCase().includes(norm)
        ).slice(0, 10);
    }, [productSearch, products]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return [];
        const norm = removeVietnameseTones(customerSearch);
        return partners.filter(p => 
            p.type === PartnerType.Customer && 
            (removeVietnameseTones(p.name).includes(norm) || p.phone.includes(customerSearch))
        ).slice(0, 5);
    }, [customerSearch, partners]);

    // Handlers
    const handleSelectCustomer = (p: Partner) => {
        setCustomerId(p.id);
        setCustomerName(p.name);
        setPhone(p.phone);
        setAddress(p.address || '');
        setCustomerSearch(p.name);
        setShowCustomerResults(false);
    };

    const handleAddItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i);
            }
            return [...prev, {
                id: product.id,
                sku: product.sku,
                productName: product.name,
                unit: 'Cái', // Default unit
                quantity: 1,
                price: product.retailPrice,
                total: product.retailPrice,
                costPrice: product.importPrice
            }];
        });
    };

    const updateItem = (id: string, updates: Partial<QuoteItem>) => {
        setItems(prev => prev.map(i => {
            if (i.id === id) {
                const newItem = { ...i, ...updates };
                // Recalculate total if price or quantity changed
                if (updates.quantity !== undefined || updates.price !== undefined) {
                    newItem.total = newItem.quantity * newItem.price;
                }
                return newItem;
            }
            return i;
        }));
    };

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

    // Calculations
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const vatAmount = Math.round((subtotal - discount) * (vatRate / 100));
    const total = Math.max(0, subtotal - discount + vatAmount);

    const handleSubmit = async () => {
        if (isSubmitting) return;
        if (!code) { showNotification('Vui lòng nhập mã báo giá', 'error'); return; }
        if (!customerName) { showNotification('Vui lòng nhập tên khách hàng', 'error'); return; }
        if (items.length === 0) { showNotification('Vui lòng chọn ít nhất 1 sản phẩm', 'error'); return; }

        setIsSubmitting(true);
        const payload = {
            code, // User edited code or auto-generated
            customerName, phone, address,
            date: formatDateDDMM(date),
            validUntil: formatDateDDMM(validUntil),
            items,
            subtotal,
            discount,
            vatRate,
            vatAmount,
            total,
            notes,
            customerId,
            status: mode === 'create' ? 'Sent' : (initialData?.status || 'Sent'),
        };

        try {
            if (mode === 'create') {
                await createQuote(payload);
            } else if (initialData) {
                await updateQuote({ ...payload, id: initialData.id });
            }
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? 'Tạo Báo Giá Mới' : 'Chỉnh Sửa Báo Giá'}
            size="2xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</Button>
                    <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} icon="save">Lưu báo giá</Button>
                </>
            }
        >
            <div className="flex h-[600px] gap-6">
                {/* LEFT: Product Selection */}
                <div className="w-1/3 flex flex-col border-r border-slate-200 dark:border-slate-700 pr-6">
                    <div className="mb-4">
                        <SearchInput 
                            value={productSearch} 
                            onChange={setProductSearch} 
                            placeholder="Tìm sản phẩm..." 
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {filteredProducts.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => handleAddItem(p)}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all group active:scale-95"
                            >
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600">{p.name}</p>
                                <div className="flex justify-between mt-1.5">
                                    <span className="text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-600">{p.sku}</span>
                                    <span className="text-[10px] font-bold text-blue-600">{formatCurrency(p.retailPrice)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Form & Items */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header Inputs */}
                    <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
                        {/* Quote Code Field */}
                        <FormField label="Mã báo giá" required>
                            <FormInput 
                                value={code} 
                                onChange={e => setCode(e.target.value)} 
                                placeholder="BG-..." 
                                className="font-mono font-bold text-blue-600 uppercase"
                            />
                        </FormField>

                        {/* Valid Until */}
                        <FormField label="Hiệu lực đến">
                            <FormInput type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                        </FormField>

                        <div className="col-span-2 relative">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Khách hàng</label>
                            <input 
                                value={customerSearch} 
                                onChange={e => { setCustomerSearch(e.target.value); setCustomerName(e.target.value); setShowCustomerResults(true); }}
                                onFocus={() => setShowCustomerResults(true)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                placeholder="Nhập tên khách hàng..."
                            />
                            {showCustomerResults && filteredCustomers.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                                    {filteredCustomers.map(c => (
                                        <div key={c.id} onClick={() => handleSelectCustomer(c)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-bold">{c.name}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <FormField label="Số điện thoại" className="col-span-2">
                            <FormInput value={phone} onChange={e => setPhone(e.target.value)} placeholder="SĐT..." />
                        </FormField>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-0 mb-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 uppercase font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2">Sản phẩm</th>
                                    <th className="px-2 py-2 w-16 text-center">SL</th>
                                    <th className="px-2 py-2 w-24 text-right">Đơn giá</th>
                                    <th className="px-3 py-2 w-24 text-right">Tổng</th>
                                    <th className="px-1 py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {items.length > 0 ? items.map((item, idx) => (
                                    <tr key={idx} className="group hover:bg-white dark:hover:bg-slate-700/50">
                                        <td className="px-3 py-2">
                                            <div className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{item.productName}</div>
                                            <div className="text-[10px] font-mono text-slate-500">{item.sku}</div>
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <InlineNumberEdit value={item.quantity} onChange={v => updateItem(item.id, { quantity: v })} min={1} align="center" className="bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 py-0.5 font-bold" />
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                            <InlineNumberEdit value={item.price} onChange={v => updateItem(item.id, { price: v })} min={0} align="right" className="bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 py-0.5" />
                                        </td>
                                        <td className="px-3 py-2 text-right font-black text-slate-900 dark:text-white">{formatCurrency(item.total)}</td>
                                        <td className="px-1 py-2 text-center"><button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-[16px]">close</span></button></td>
                                    </tr>
                                )) : <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic">Chưa có sản phẩm</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Totals */}
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shrink-0">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">Tạm tính</span>
                                <span className="font-bold">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Chiết khấu</span>
                                <div className="w-24">
                                    <InlineNumberEdit value={discount} onChange={setDiscount} align="right" className="border-b border-slate-300 bg-transparent py-0 font-medium" />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 font-medium">VAT</span>
                                    <select value={vatRate} onChange={e => setVatRate(Number(e.target.value))} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1 py-0 text-xs font-bold cursor-pointer">
                                        <option value={0}>0%</option>
                                        <option value={5}>5%</option>
                                        <option value={8}>8%</option>
                                        <option value={10}>10%</option>
                                    </select>
                                </div>
                                <span className="font-bold">{formatCurrency(vatAmount)}</span>
                            </div>
                            <div className="border-t border-slate-200 dark:border-slate-600 pt-2 flex justify-between items-end">
                                <span className="text-sm font-black uppercase text-slate-900 dark:text-white">Tổng cộng</span>
                                <span className="text-xl font-black text-blue-600">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export const PrintPreviewModal: React.FC<{ isOpen: boolean, onClose: () => void, data: any }> = ({ isOpen, onClose, data }) => {
    if (!data) return null;

    // Use GenericPrintModal which will default to TemplateEngine when no children are passed.
    // This connects the print action to the new dynamic template system.
    return (
        <GenericPrintModal
            isOpen={isOpen}
            onClose={onClose}
            title={`In Phiếu ${data.code}`}
            filename={`Phieu_${data.code}`}
            data={data}
        />
    );
};
