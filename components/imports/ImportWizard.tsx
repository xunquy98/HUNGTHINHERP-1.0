
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { Wizard, WizardStep } from '../ui/Wizard';
import { useAppContext } from '../../contexts/AppContext';
import { ImportOrder, ImportItem, Partner, Product, PartnerType } from '../../types';
import { removeVietnameseTones, formatCurrency, formatInputDate } from '../../utils/helpers';
import { FormField, FormInput, FormSelect, FormTextarea } from '../ui/Form';
import { SearchInput, Button } from '../ui/Primitives';
import { InlineNumberEdit } from '../ui/InlineNumberEdit';
import { parseInvoiceImage } from '../../services/ai';
import { useFormValidation } from '../../hooks/useFormValidation';
import { WAREHOUSE_NAMES } from '../../constants/options';

interface ImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    initialItems?: ImportItem[];
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose, initialItems = [] }) => {
    const { createImportOrder, showNotification } = useAppContext();

    // Data Fetching (Local)
    const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
    const partners = useLiveQuery(() => db.partners.filter(p => !p.isDeleted).toArray()) || [];

    // --- SHARED STATE ---
    // Step 1
    const [selectedSupplier, setSelectedSupplier] = useState<Partner | null>(null);
    const [warehouse, setWarehouse] = useState('Kho Bạc Đạn');
    const [importDate, setImportDate] = useState(new Date().toISOString().slice(0, 10));
    const [invoiceNo, setInvoiceNo] = useState('');
    
    // Step 2
    const [items, setItems] = useState<ImportItem[]>(initialItems);
    const [isPasteMode, setIsPasteMode] = useState(false);
    const [pasteContent, setPasteContent] = useState('');
    
    // Step 3
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<ImportOrder['status']>('Received');

    // UI Helpers
    const [supplierSearch, setSupplierSearch] = useState('');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false); // New Dropdown State
    const [productSearch, setProductSearch] = useState('');
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);

    // Validation
    const { errors, setErrors, register, focusFirstError, clearErrors } = useFormValidation<{ supplier: string, items: string }>();

    // --- RESET EFFECT ---
    useEffect(() => {
        if (isOpen) {
            // Reset Form Data to Default
            setSelectedSupplier(null);
            setWarehouse('Kho Bạc Đạn');
            setImportDate(new Date().toISOString().slice(0, 10));
            setInvoiceNo('');
            setItems(initialItems); 
            setAmountPaid(0);
            setPaymentMethod('transfer');
            setNotes('');
            setStatus('Received');

            // Reset UI State
            setSupplierSearch('');
            setProductSearch('');
            setIsOcrLoading(false);
            setIsSubmitting(false);
            setIsPasteMode(false);
            setPasteContent('');
            setIsSupplierDropdownOpen(false);
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Clear Validation
            clearErrors();
        }
    }, [isOpen, initialItems]);

    // Click outside to close supplier dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
                setIsSupplierDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- LOGIC ---
    
    // Step 1: Supplier
    const filteredSuppliers = useMemo(() => {
        const suppliers = partners.filter(p => p.type === PartnerType.Supplier);
        if (!supplierSearch) return suppliers.slice(0, 10);
        const norm = removeVietnameseTones(supplierSearch);
        return suppliers.filter(p => (removeVietnameseTones(p.name).includes(norm) || p.phone.includes(supplierSearch))).slice(0, 10);
    }, [supplierSearch, partners]);

    // Step 2: Products
    const filteredProducts = useMemo(() => {
        const norm = removeVietnameseTones(productSearch);
        return products.filter(p => removeVietnameseTones(p.name).includes(norm) || p.sku.toLowerCase().includes(norm)).slice(0, 20);
    }, [productSearch, products]);

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

    const handlePasteData = () => {
        if (!pasteContent) return;
        const lines = pasteContent.trim().split('\n');
        const newItems: ImportItem[] = [];
        let notFoundCount = 0;

        lines.forEach(line => {
            const parts = line.split(/[\t,;]+/).map(s => s.trim());
            if (parts.length < 1) return;
            const sku = parts[0];
            const qty = parseFloat(parts[1]) || 1;
            const price = parseFloat(parts[2]);
            const product = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
            
            if (product) {
                const importPrice = !isNaN(price) && price > 0 ? price : product.importPrice;
                newItems.push({
                    id: product.id, sku: product.sku, productName: product.name, unit: 'Cái',
                    quantity: qty, price: importPrice, total: qty * importPrice
                });
            } else { notFoundCount++; }
        });

        if (newItems.length > 0) {
            setItems(prev => {
                const merged = [...prev];
                newItems.forEach(newItem => {
                    const existingIdx = merged.findIndex(i => i.id === newItem.id);
                    if (existingIdx >= 0) {
                        merged[existingIdx].quantity += newItem.quantity;
                        merged[existingIdx].total = merged[existingIdx].quantity * merged[existingIdx].price;
                    } else { merged.push(newItem); }
                });
                return merged;
            });
            showNotification(`Đã thêm ${newItems.length} sản phẩm`, 'success');
        }
        if (notFoundCount > 0) showNotification(`Không tìm thấy ${notFoundCount} mã SKU`, 'warning');
        setPasteContent(''); setIsPasteMode(false);
    };

    // Totals
    const totalAmount = items.reduce((sum, i) => sum + i.total, 0);
    const remainingDebt = Math.max(0, totalAmount - amountPaid);

    // OCR Logic
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
            } catch (err: any) { showNotification(err.message, 'error'); } finally { setIsOcrLoading(false); if(fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsDataURL(file);
    };

    // --- WIZARD STEPS ---

    // Fixed height container for consistent UI
    const CONTAINER_HEIGHT = "h-[450px]";

    const step1: WizardStep = {
        id: 'info',
        title: 'Thông tin phiếu',
        description: 'Chọn nhà cung cấp và thông tin hóa đơn.',
        isValid: !!selectedSupplier,
        component: (
            <div className={`grid grid-cols-12 gap-8 ${CONTAINER_HEIGHT}`}>
                {/* Left: OCR & Hero (30%) */}
                <div className="col-span-4 flex flex-col justify-center border-r border-slate-200 dark:border-slate-700 pr-8">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all gap-4 group ${
                            isOcrLoading 
                            ? 'bg-blue-50 border-blue-300 animate-pulse' 
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-400'
                        }`}
                    >
                        <div className={`size-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${isOcrLoading ? 'bg-blue-100 text-blue-600' : 'bg-white dark:bg-slate-700 text-slate-400'}`}>
                            <span className="material-symbols-outlined text-[32px]">
                                {isOcrLoading ? 'document_scanner' : 'cloud_upload'}
                            </span>
                        </div>
                        {isOcrLoading ? (
                            <p className="text-sm font-bold text-blue-600 animate-pulse">Đang phân tích...</p>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Quét hóa đơn AI</p>
                                <p className="text-[10px] text-slate-500 mt-1">Hỗ trợ JPG, PNG</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-4 text-center">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Hoặc điền thông tin thủ công bên phải.
                            <br/>AI sẽ tự động điền NCC và Hàng hóa nếu có.
                        </p>
                    </div>
                </div>

                {/* Right: Form (70%) */}
                <div className="col-span-8 flex flex-col gap-6 pt-2">
                    {/* Supplier Field - Searchable Dropdown */}
                    <div className="relative z-20" ref={supplierDropdownRef}>
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 block">Nhà cung cấp <span className="text-red-500">*</span></label>
                        
                        {selectedSupplier ? (
                            <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-sm animate-fadeIn">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[20px]">store</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg">{selectedSupplier.name}</p>
                                        <p className="text-xs opacity-80">{selectedSupplier.phone} • {selectedSupplier.address}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setSelectedSupplier(null); setSupplierSearch(''); }} 
                                    className="size-8 flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded-full transition-colors text-emerald-600"
                                    title="Chọn lại"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-slate-400">search</span>
                                <input 
                                    ref={register('supplier')}
                                    value={supplierSearch} 
                                    onChange={e => { setSupplierSearch(e.target.value); setIsSupplierDropdownOpen(true); }}
                                    onFocus={() => setIsSupplierDropdownOpen(true)}
                                    className={`w-full pl-11 pr-4 py-3.5 rounded-xl border bg-white dark:bg-slate-800 text-base focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold transition-all shadow-sm ${errors.supplier ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
                                    placeholder="Tìm tên, số điện thoại nhà cung cấp..." 
                                    autoFocus 
                                />
                                
                                {/* Dropdown Menu */}
                                {isSupplierDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar animate-fadeIn z-50">
                                        {filteredSuppliers.length > 0 ? (
                                            filteredSuppliers.map(s => (
                                                <div 
                                                    key={s.id} 
                                                    onClick={() => { setSelectedSupplier(s); setSupplierSearch(''); setIsSupplierDropdownOpen(false); clearErrors('supplier'); }} 
                                                    className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 group transition-colors"
                                                >
                                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600">{s.name}</p>
                                                    <p className="text-[10px] text-slate-500">{s.phone} {s.address && `• ${s.address}`}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-6 text-center text-slate-500 text-xs">
                                                <p className="mb-2">Không tìm thấy NCC "{supplierSearch}"</p>
                                                {/* In a real app, integrate quick create partner here */}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {errors.supplier && !selectedSupplier && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">error</span> {errors.supplier}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <FormField label="Ngày nhập">
                            <FormInput type="date" value={importDate} onChange={e => setImportDate(e.target.value)} />
                        </FormField>
                        <FormField label="Nhập tại kho">
                            <FormSelect value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                {WAREHOUSE_NAMES.map(w => <option key={w} value={w}>{w}</option>)}
                            </FormSelect>
                        </FormField>
                    </div>

                    <FormField label="Số hóa đơn gốc (Tùy chọn)">
                        <FormInput value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="VD: HD-00123" />
                    </FormField>
                </div>
            </div>
        )
    };

    const step2: WizardStep = {
        id: 'items',
        title: 'Chọn hàng hóa',
        description: 'Thêm sản phẩm cần nhập vào danh sách.',
        isValid: items.length > 0,
        component: (
            <div className={`flex gap-4 ${CONTAINER_HEIGHT}`}>
                {/* Left: Search & List (35%) */}
                <div className="w-[35%] flex flex-col border-r border-slate-200 dark:border-slate-700 pr-4">
                    <div className="mb-3 space-y-2 shrink-0">
                        <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Tìm tên, SKU..." />
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="w-full justify-center border-dashed text-xs h-8"
                            onClick={() => setIsPasteMode(!isPasteMode)}
                            icon={isPasteMode ? "keyboard_arrow_up" : "content_paste"}
                        >
                            {isPasteMode ? "Ẩn khung dán" : "Paste Excel (SKU | SL | Giá)"}
                        </Button>
                        
                        {isPasteMode && (
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 animate-fadeIn absolute top-16 left-4 right-[65%] z-20 shadow-xl">
                                <textarea 
                                    className="w-full text-xs font-mono p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none h-32 resize-none"
                                    placeholder={`SKU [tab] SL [tab] Giá\n6205\t10\t85000`}
                                    value={pasteContent}
                                    onChange={e => setPasteContent(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <Button size="sm" variant="secondary" onClick={() => setIsPasteMode(false)}>Đóng</Button>
                                    <Button size="sm" variant="primary" onClick={handlePasteData}>Thêm</Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                        {filteredProducts.map(p => (
                            <div key={p.id} onClick={() => addItem(p)} className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all active:scale-95 group">
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 max-w-[70%]">{p.name}</p>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.stock <= 10 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>Tồn: {p.stock}</span>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] font-mono text-slate-500">{p.sku}</span>
                                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600">{formatCurrency(p.importPrice)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Table (65%) */}
                <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2">Sản phẩm</th>
                                    <th className="px-1 py-2 w-24 text-center">SL</th>
                                    <th className="px-1 py-2 w-32 text-right">Giá nhập</th>
                                    <th className="px-3 py-2 w-32 text-right">Thành tiền</th>
                                    <th className="px-1 py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {items.length > 0 ? items.map((item, idx) => {
                                    const product = products.find(p => p.id === item.id);
                                    const isPriceHigh = product && item.price > product.importPrice * 1.2;
                                    
                                    return (
                                        <tr key={idx} className="group hover:bg-white dark:hover:bg-slate-700/50 transition-colors bg-white dark:bg-slate-900">
                                            <td className="px-3 py-2">
                                                <div className="font-bold text-slate-900 dark:text-white truncate max-w-[180px] text-xs">{item.productName}</div>
                                                <div className="text-[9px] font-mono text-slate-500">{item.sku}</div>
                                            </td>
                                            <td className="px-1 py-2 text-center">
                                                <InlineNumberEdit value={item.quantity} onChange={v => updateItem(item.id, 'quantity', v)} min={1} align="center" className="font-bold bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 py-1.5" />
                                            </td>
                                            <td className="px-1 py-2 text-right">
                                                <InlineNumberEdit value={item.price} onChange={v => updateItem(item.id, 'price', v)} min={0} align="right" className={`rounded border py-1.5 ${isPriceHigh ? 'bg-orange-50 border-orange-200 text-orange-700 font-bold' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600'}`} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-black text-slate-900 dark:text-white text-xs">{formatCurrency(item.total)}</td>
                                            <td className="px-1 py-2 text-center"><button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-[16px]">delete</span></button></td>
                                        </tr>
                                    );
                                }) : <tr><td colSpan={5} className="px-4 py-20 text-center text-slate-400 italic">Chưa có sản phẩm nào</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                        <span className="text-xs font-bold text-slate-500">Tổng SL: <span className="text-slate-900 dark:text-white">{items.reduce((s,i)=>s+i.quantity,0)}</span></span>
                        <div className="text-right">
                            <span className="text-xs font-bold text-slate-500 mr-2">Tổng cộng:</span>
                            <span className="text-lg font-black text-blue-600">{formatCurrency(totalAmount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    };

    const step3: WizardStep = {
        id: 'payment',
        title: 'Thanh toán & Hoàn tất',
        description: 'Xác nhận thông tin thanh toán và trạng thái phiếu.',
        isValid: amountPaid <= totalAmount,
        component: (
            <div className={`grid grid-cols-12 gap-8 ${CONTAINER_HEIGHT} items-center`}>
                {/* Left: Big Summary (5 cols) */}
                <div className="col-span-5 space-y-6">
                    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng giá trị đơn nhập</p>
                            <p className="text-4xl font-black mb-6">{formatCurrency(totalAmount)}</p>
                            
                            <div className="space-y-3 border-t border-white/10 pt-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-slate-400">Thanh toán ngay</p>
                                    <p className="font-bold text-emerald-400">{formatCurrency(amountPaid)}</p>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-slate-400">Công nợ ghi sổ</p>
                                    <p className="font-bold text-orange-400">{formatCurrency(remainingDebt)}</p>
                                </div>
                            </div>
                        </div>
                        <span className="material-symbols-outlined absolute -bottom-6 -right-6 text-[140px] opacity-10">receipt_long</span>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-500">store</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-500 uppercase">Nhà cung cấp</p>
                                <p className="font-bold text-slate-900 dark:text-white truncate">{selectedSupplier?.name}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">{warehouse}</span>
                            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">{formatInputDate(importDate)}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Inputs (7 cols) */}
                <div className="col-span-7 space-y-6 pl-4 border-l border-slate-200 dark:border-slate-700">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <FormField label="Thanh toán ngay">
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <FormInput 
                                        type="number" 
                                        value={amountPaid} 
                                        onChange={e => setAmountPaid(Number(e.target.value))} 
                                        className={`font-black text-xl h-12 ${amountPaid > totalAmount ? 'text-red-600 border-red-500' : 'text-emerald-600'}`}
                                        autoFocus
                                    />
                                    <button onClick={() => setAmountPaid(totalAmount)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 px-2 py-1 rounded text-slate-600 uppercase">Tất cả</button>
                                </div>
                                <FormSelect value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-36 font-bold h-12">
                                    <option value="transfer">Chuyển khoản</option>
                                    <option value="cash">Tiền mặt</option>
                                </FormSelect>
                            </div>
                            {amountPaid > totalAmount && <p className="text-xs text-red-500 mt-1 font-bold">Số tiền thanh toán vượt quá tổng đơn!</p>}
                        </FormField>
                    </div>

                    <FormField label="Ghi chú nội bộ">
                        <FormTextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú..." rows={4} className="bg-white dark:bg-slate-800" />
                    </FormField>

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-2">Trạng thái xử lý</label>
                        <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
                            <button onClick={() => setStatus('Pending')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${status === 'Pending' ? 'bg-white shadow text-slate-600' : 'text-slate-400'}`}>Lưu nháp</button>
                            <button onClick={() => setStatus('Received')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${status === 'Received' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'}`}>Đã nhập kho</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    };

    // --- FINISH ---
    const handleFinish = async () => {
        if (isSubmitting) return;
        if (!selectedSupplier) {
            setErrors({ supplier: 'Vui lòng chọn nhà cung cấp' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            await createImportOrder({
                code: `PN-${Date.now().toString().slice(-6)}`,
                supplierId: selectedSupplier.id, 
                supplierName: selectedSupplier.name,
                date: formatInputDate(importDate),
                total: totalAmount, 
                status: status,
                invoiceNo: invoiceNo, 
                warehouse: warehouse, 
                items: items,
                amountPaid: amountPaid, 
                paymentMethod: paymentMethod
            });
            onClose();
        } catch (error) {
            showNotification('Có lỗi xảy ra', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Wizard 
            isOpen={isOpen}
            onClose={onClose}
            title="Tạo Phiếu Nhập Kho"
            steps={[step1, step2, step3]}
            onFinish={handleFinish}
            finishLabel={status === 'Received' ? 'Nhập kho & Hoàn tất' : 'Lưu Nháp'}
            size="2xl" // Custom wide size
            isFinishing={isSubmitting}
        />
    );
};
