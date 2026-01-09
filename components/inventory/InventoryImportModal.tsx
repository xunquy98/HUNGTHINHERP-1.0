
import React, { useState, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Primitives';
import { FormField, FormSelect } from '../ui/Form';
import { useAppContext } from '../../contexts/AppContext';
import { parseCSV, parseExcel, SYSTEM_FIELDS, generateErrorCSV, ImportRowData } from '../../utils/importHelpers';
import { downloadTextFile, formatCurrency, generateUUID, getCurrentDate } from '../../utils/helpers';
import { WAREHOUSE_NAMES } from '../../constants/options';
import { db } from '../../services/db';
import { Product } from '../../types';
import { useLiveQuery } from 'dexie-react-hooks';

interface InventoryImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'result';

export const InventoryImportModal: React.FC<InventoryImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { showNotification, createImportOrder } = useAppContext();
    
    // Fetch products locally
    const products = useLiveQuery(() => db.products.toArray()) || [];
    
    // State
    const [step, setStep] = useState<Step>('upload');
    const [fileData, setFileData] = useState<{ headers: string[], rows: any[] } | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({}); // System Field -> File Header
    const [warehouse, setWarehouse] = useState(WAREHOUSE_NAMES[0]);
    const [createMissing, setCreateMissing] = useState(true);
    
    // Validation & Preview State
    const [processedRows, setProcessedRows] = useState<any[]>([]);
    const [errors, setErrors] = useState<Record<number, string[]>>({});
    const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0, newSkus: 0, existingSkus: 0 });
    
    // Import Progress
    const [progress, setProgress] = useState(0);
    const [importLog, setImportLog] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- STEP 1: UPLOAD ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                let parsed;
                if (isExcel) {
                    const data = event.target?.result as ArrayBuffer;
                    parsed = parseExcel(data);
                } else {
                    const text = event.target?.result as string;
                    parsed = parseCSV(text);
                }
                
                if (parsed.headers.length === 0) throw new Error('File trống hoặc định dạng không đúng');
                
                setFileData(parsed);
                // Auto-map common headers
                const initMap: Record<string, string> = {};
                SYSTEM_FIELDS.forEach(field => {
                    const match = parsed.headers.find(h => 
                        h.toLowerCase().includes(field.key.toLowerCase()) || 
                        h.toLowerCase() === field.label.toLowerCase()
                    );
                    if (match) initMap[field.key] = match;
                });
                setMapping(initMap);
                setStep('mapping');
            } catch (err: any) {
                showNotification(err.message, 'error');
            }
        };

        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    // --- STEP 2: MAPPING & VALIDATION ---
    const handleAnalyze = async () => {
        if (!fileData) return;

        // Verify required mappings
        const missingRequired = SYSTEM_FIELDS.filter(f => f.required && !mapping[f.key]);
        if (missingRequired.length > 0) {
            showNotification(`Vui lòng ánh xạ các cột bắt buộc: ${missingRequired.map(f => f.label).join(', ')}`, 'error');
            return;
        }

        const skuMap = new Map<string, any>(); // For merging duplicates
        const newErrors: Record<number, string[]> = {};
        const existingSkusSet = new Set(products.map(p => p.sku));
        let newSkuCount = 0;
        let existingSkuCount = 0;

        // Pass 1: Aggregate by SKU
        fileData.rows.forEach((row, idx) => {
            const rowErrors: string[] = [];
            const sku = String(row[mapping['sku']] || '').trim();
            
            if (!sku) {
                newErrors[idx] = ['Thiếu mã SKU'];
                return;
            }

            // Consolidate data
            const cleanRow: any = { _originalIdx: idx };
            SYSTEM_FIELDS.forEach(field => {
                const header = mapping[field.key];
                let val = row[header];
                
                if (field.type === 'number') {
                    // Nếu là Excel, nó có thể đã là số, chỉ cần parse nếu là string
                    if (typeof val === 'string') {
                        val = Number(val.replace(/[^0-9.-]+/g, ''));
                    } else {
                        val = Number(val);
                    }
                    if (isNaN(val)) val = 0;
                }
                cleanRow[field.key] = val;
            });

            if (cleanRow.quantity < 0) rowErrors.push('Số lượng âm');

            // Merge logic
            if (skuMap.has(sku)) {
                const existing = skuMap.get(sku);
                existing.quantity += cleanRow.quantity; // Sum quantity
                // Keep other fields from the last row or first row (strategy: overwrite)
            } else {
                skuMap.set(sku, cleanRow);
            }
        });

        // Pass 2: Final Validation
        const finalRows: any[] = [];
        Array.from(skuMap.values()).forEach((row) => {
            const isNew = !existingSkusSet.has(row.sku);
            
            if (isNew) {
                if (!createMissing) {
                    newErrors[row._originalIdx] = (newErrors[row._originalIdx] || []).concat(['SKU chưa tồn tại (Bỏ qua)']);
                } else if (!row.name) {
                    newErrors[row._originalIdx] = (newErrors[row._originalIdx] || []).concat(['Thiếu tên sản phẩm mới']);
                } else {
                    newSkuCount++;
                    finalRows.push({ ...row, _isNew: true });
                }
            } else {
                existingSkuCount++;
                finalRows.push({ ...row, _isNew: false });
            }
        });

        setProcessedRows(finalRows);
        setErrors(newErrors);
        setStats({
            total: fileData.rows.length,
            valid: finalRows.length,
            invalid: Object.keys(newErrors).length,
            newSkus: newSkuCount,
            existingSkus: existingSkuCount
        });
        setStep('preview');
    };

    // --- STEP 3: IMPORT EXECUTION ---
    const handleImport = async () => {
        if (processedRows.length === 0) return;
        setStep('importing');
        setProgress(0);
        setImportLog([]);

        const batchId = generateUUID('batch');
        const chunkSize = 20;
        const totalChunks = Math.ceil(processedRows.length / chunkSize);
        
        try {
            // 1. Create New Products First
            const newProducts = processedRows.filter(r => r._isNew);
            if (newProducts.length > 0) {
                setImportLog(prev => [...prev, `Đang tạo ${newProducts.length} sản phẩm mới...`]);
                await (db as any).transaction('rw', db.products, db.auditLogs, async () => {
                    const toAdd = newProducts.map(r => ({
                        id: generateUUID('prod'),
                        sku: r.sku,
                        name: r.name,
                        brand: r.brand || 'No Brand',
                        dimensions: r.dimensions || '',
                        importPrice: r.price || 0,
                        retailPrice: r.retailPrice || (r.price * 1.3) || 0,
                        stock: 0, // Stock will be added via Import Order
                        minStock: r.minStock || 10,
                        location: r.location || warehouse, // Use row location or selected warehouse
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        isDeleted: false
                    }));
                    await db.products.bulkAdd(toAdd as Product[]);
                });
            }

            // 2. Prepare Import Items
            setImportLog(prev => [...prev, `Đang tạo phiếu nhập kho...`]);
            const importItems = await Promise.all(processedRows.map(async r => {
                const product = await db.products.where('sku').equals(r.sku).first();
                return {
                    id: product!.id,
                    sku: r.sku,
                    productName: product!.name,
                    unit: 'Cái',
                    quantity: r.quantity,
                    price: r.price || product!.importPrice,
                    total: r.quantity * (r.price || product!.importPrice)
                };
            }));

            // 3. Create Import Order (This handles stock updates & transaction logs internally in AppContext)
            // We'll chunk the execution if needed, but createImportOrder is usually one transaction.
            // For stability with large imports, we stick to one big order or split orders. 
            // Here: One big order for atomicity.
            
            const totalVal = importItems.reduce((sum, i) => sum + i.total, 0);
            
            await createImportOrder({
                code: `IMP-${Date.now()}`,
                supplierName: `Import File ${batchId.slice(0,6)}`,
                date: getCurrentDate(),
                total: totalVal,
                status: 'Received', // Auto-receive to update stock
                warehouse: warehouse,
                items: importItems,
                paymentMethod: 'cash',
                amountPaid: 0, // Treat as unpaid/internal for now
                notes: `Import batch: ${batchId}`
            });

            setProgress(100);
            setImportLog(prev => [...prev, `Hoàn tất! Đã nhập ${importItems.length} dòng hàng.`]);
            setStep('result');
            onSuccess();

        } catch (error: any) {
            setImportLog(prev => [...prev, `LỖI: ${error.message}`]);
            showNotification('Có lỗi xảy ra trong quá trình nhập', 'error');
        }
    };

    const handleDownloadErrors = () => {
        if (!fileData) return;
        const csvContent = generateErrorCSV(fileData.rows, errors);
        downloadTextFile(`ImportErrors_${new Date().toISOString().slice(0,10)}.csv`, csvContent);
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Import Kho Hàng (Excel/CSV)"
            size="2xl"
            footer={
                <div className="flex justify-between w-full">
                    {step === 'upload' && (
                        <>
                            <Button variant="secondary" onClick={onClose}>Hủy</Button>
                            <Button variant="primary" disabled>Tiếp tục</Button>
                        </>
                    )}
                    {step === 'mapping' && (
                        <>
                            <Button variant="secondary" onClick={() => setStep('upload')}>Quay lại</Button>
                            <Button variant="primary" onClick={handleAnalyze}>Tiếp tục</Button>
                        </>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="secondary" onClick={() => setStep('mapping')}>Quay lại</Button>
                            <Button variant="primary" onClick={handleImport} disabled={stats.valid === 0} icon="download">
                                Thực hiện Import ({stats.valid})
                            </Button>
                        </>
                    )}
                    {step === 'result' && (
                        <>
                            <Button variant="secondary" onClick={onClose}>Đóng</Button>
                            <Button variant="primary" onClick={() => { setStep('upload'); setFileData(null); }}>Import tiếp</Button>
                        </>
                    )}
                </div>
            }
        >
            <div className="space-y-6">
                {/* Stepper */}
                <div className="flex items-center justify-between px-10 mb-6">
                    {['Upload', 'Cấu hình', 'Kiểm tra', 'Kết quả'].map((label, idx) => {
                        const stepIdx = ['upload', 'mapping', 'preview', 'result'].indexOf(step === 'importing' ? 'preview' : step);
                        const isActive = idx === stepIdx;
                        const isDone = idx < stepIdx;
                        return (
                            <div key={label} className="flex flex-col items-center gap-2 relative z-10">
                                <div className={`size-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg scale-110' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    {isDone ? <span className="material-symbols-outlined text-[16px]">check</span> : idx + 1}
                                </div>
                                <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                            </div>
                        );
                    })}
                    <div className="absolute left-0 top-4 w-full h-0.5 bg-slate-100 -z-0"></div>
                </div>

                {/* STEP 1: UPLOAD */}
                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                        <div className="size-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-4xl text-blue-500">cloud_upload</span>
                        </div>
                        <h3 className="font-bold text-slate-700">Nhấn để chọn file Excel/CSV</h3>
                        <p className="text-xs text-slate-500 mt-2">Hỗ trợ định dạng .xlsx, .xls, .csv</p>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                    </div>
                )}

                {/* STEP 2: MAPPING */}
                {step === 'mapping' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Nhập vào kho</label>
                                <FormSelect value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                    {WAREHOUSE_NAMES.map(w => <option key={w} value={w}>{w}</option>)}
                                </FormSelect>
                            </div>
                            <div className="flex items-center pt-5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={createMissing} onChange={e => setCreateMissing(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-sm font-medium text-slate-700">Tự động tạo sản phẩm nếu SKU chưa có</span>
                                </label>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Trường dữ liệu</th>
                                        <th className="px-4 py-3 text-left">Cột trong file</th>
                                        <th className="px-4 py-3 text-left">Ví dụ (Dòng 1)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {SYSTEM_FIELDS.map(field => (
                                        <tr key={field.key}>
                                            <td className="px-4 py-3 font-medium">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <select 
                                                    value={mapping[field.key] || ''} 
                                                    onChange={e => setMapping({...mapping, [field.key]: e.target.value})}
                                                    className={`w-full p-1.5 rounded border text-sm ${!mapping[field.key] && field.required ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                                                >
                                                    <option value="">-- Chọn cột --</option>
                                                    {fileData?.headers.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 italic truncate max-w-xs">
                                                {fileData?.rows[0]?.[mapping[field.key]] || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* STEP 3: PREVIEW & STEP 4: IMPORTING */}
                {(step === 'preview' || step === 'importing' || step === 'result') && (
                    <div className="space-y-4">
                        {/* Stats Bar */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-blue-500 uppercase">Tổng dòng</p>
                                <p className="text-xl font-black text-blue-700">{stats.total}</p>
                            </div>
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-emerald-500 uppercase">Hợp lệ</p>
                                <p className="text-xl font-black text-emerald-700">{stats.valid}</p>
                            </div>
                            <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-orange-500 uppercase">SP Mới</p>
                                <p className="text-xl font-black text-orange-700">{stats.newSkus}</p>
                            </div>
                            <div className={`p-3 border rounded-xl text-center ${stats.invalid > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                <p className={`text-[10px] font-bold uppercase ${stats.invalid > 0 ? 'text-red-500' : 'text-slate-400'}`}>Lỗi / Bỏ qua</p>
                                <p className={`text-xl font-black ${stats.invalid > 0 ? 'text-red-700' : 'text-slate-400'}`}>{stats.invalid}</p>
                            </div>
                        </div>

                        {/* Progress Bar (Importing) */}
                        {step === 'importing' && (
                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-4 relative">
                                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600">{progress}%</span>
                            </div>
                        )}

                        {/* Log / Error Actions */}
                        {step === 'result' ? (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                                <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
                                <h3 className="font-bold text-emerald-800">Nhập hàng thành công!</h3>
                                <p className="text-sm text-emerald-600">Đã cập nhật tồn kho cho {stats.valid} sản phẩm.</p>
                            </div>
                        ) : (
                            stats.invalid > 0 && (
                                <div className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-xl">
                                    <span className="text-sm font-bold text-red-600 flex items-center gap-2">
                                        <span className="material-symbols-outlined">warning</span>
                                        Có {stats.invalid} dòng bị lỗi hoặc bỏ qua.
                                    </span>
                                    <Button variant="secondary" size="sm" onClick={handleDownloadErrors} className="text-red-600 border-red-200 hover:bg-red-100">
                                        Tải file lỗi
                                    </Button>
                                </div>
                            )
                        )}

                        {/* Preview Table */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar relative">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Trạng thái</th>
                                        <th className="px-4 py-2 text-left">SKU</th>
                                        <th className="px-4 py-2 text-left">Tên sản phẩm</th>
                                        <th className="px-4 py-2 text-center">SL</th>
                                        <th className="px-4 py-2 text-right">Giá vốn</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {processedRows.slice(0, 50).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-2">
                                                {row._isNew 
                                                    ? <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">MỚI</span>
                                                    : <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">CẬP NHẬT</span>
                                                }
                                            </td>
                                            <td className="px-4 py-2 font-mono font-bold text-slate-700">{row.sku}</td>
                                            <td className="px-4 py-2 truncate max-w-[200px]" title={row.name}>{row.name}</td>
                                            <td className="px-4 py-2 text-center font-bold">{row.quantity}</td>
                                            <td className="px-4 py-2 text-right">{formatCurrency(row.price)}</td>
                                        </tr>
                                    ))}
                                    {stats.valid > 50 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-2 text-xs text-slate-400 italic">... và {stats.valid - 50} dòng khác ...</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
