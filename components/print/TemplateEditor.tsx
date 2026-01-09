
import React, { useState, useEffect } from 'react';
import { DocTypeConfig, AppSettings, TemplateSection, TableColumnConfig } from '../../types';
import { TemplateEngine } from './TemplateEngine';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Primitives';
import { FormField, FormInput, FormTextarea } from '../ui/Form';

// MOCK DATA FOR PREVIEW
const MOCK_ORDER = {
    code: 'DH-202405-001',
    date: '24/05/2024',
    customerName: 'Công ty TNHH Mẫu Demo',
    address: '123 Đường Số 1, KCN Tân Bình, TP.HCM',
    phone: '0909 123 456',
    taxId: '0312345678',
    paymentMethod: 'transfer',
    items: [
        { productName: 'Vòng bi cầu SKF 6205-2RS1', sku: 'SKF-6205', unit: 'Cái', quantity: 10, price: 125000, total: 1250000 },
        { productName: 'Dây curoa B-52 Mitsuboshi', sku: 'B-52', unit: 'Sợi', quantity: 5, price: 90000, total: 450000 },
        { productName: 'Phớt chắn dầu 25x52x7', sku: 'OIL-25527', unit: 'Cái', quantity: 20, price: 15000, total: 300000 },
    ],
    subtotal: 2000000,
    discount: 100000,
    vatRate: 8,
    vatAmount: 152000,
    total: 2052000,
    notes: 'Giao hàng trong giờ hành chính. Gọi trước khi đến.'
};

interface TemplateEditorProps {
    isOpen: boolean;
    onClose: () => void;
    initialConfig: DocTypeConfig;
    onSave: (config: DocTypeConfig) => void;
    settings: AppSettings;
    type: 'order' | 'quote' | 'import' | 'delivery';
}

const DEFAULT_SECTIONS: TemplateSection[] = [
    { id: 'header', visible: true, order: 0, label: 'Tiêu đề & Logo' },
    { id: 'customer_info', visible: true, order: 1, label: 'Thông tin khách hàng' },
    { id: 'items_table', visible: true, order: 2, label: 'Bảng hàng hóa' },
    { id: 'totals', visible: true, order: 3, label: 'Tổng tiền & VAT' },
    { id: 'notes', visible: true, order: 4, label: 'Ghi chú đơn hàng' },
    { id: 'signatures', visible: true, order: 5, label: 'Chữ ký' },
    { id: 'footer_note', visible: true, order: 6, label: 'Lời chào cuối' },
];

const DEFAULT_COLUMNS: TableColumnConfig[] = [
    { key: 'stt', label: 'STT', visible: true, width: 'w-10', align: 'center' },
    { key: 'sku', label: 'Mã hàng', visible: false, width: 'w-24', align: 'left' }, // Hidden by default
    { key: 'name', label: 'Tên hàng hóa', visible: true, align: 'left' },
    { key: 'unit', label: 'ĐVT', visible: true, width: 'w-16', align: 'center' },
    { key: 'quantity', label: 'SL', visible: true, width: 'w-16', align: 'center' },
    { key: 'price', label: 'Đơn giá', visible: true, width: 'w-24', align: 'right' },
    { key: 'total', label: 'Thành tiền', visible: true, width: 'w-28', align: 'right' },
];

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ isOpen, onClose, initialConfig, onSave, settings, type }) => {
    const [config, setConfig] = useState<DocTypeConfig>(initialConfig);
    const [activeTab, setActiveTab] = useState<'layout' | 'content' | 'style' | 'advanced'>('layout');

    // Init defaults if missing
    useEffect(() => {
        if (isOpen) {
            setConfig({
                ...initialConfig,
                sections: initialConfig.sections || DEFAULT_SECTIONS,
                columns: initialConfig.columns || DEFAULT_COLUMNS,
                colorTheme: initialConfig.colorTheme || '#0f172a',
                noteLabel: initialConfig.noteLabel || 'Ghi chú'
            });
        }
    }, [isOpen, initialConfig]);

    const handleSectionToggle = (id: string) => {
        if (!config.sections) return;
        const newSections = config.sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s);
        setConfig({ ...config, sections: newSections });
    };

    const moveSection = (index: number, direction: 'up' | 'down') => {
        if (!config.sections) return;
        const newSections = [...config.sections];
        if (direction === 'up' && index > 0) {
            [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
        } else if (direction === 'down' && index < newSections.length - 1) {
            [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
        }
        // Update order prop
        newSections.forEach((s, i) => s.order = i);
        setConfig({ ...config, sections: newSections });
    };

    const handleColumnToggle = (key: string) => {
        if (!config.columns) return;
        const newCols = config.columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
        setConfig({ ...config, columns: newCols });
    };

    const handleColumnLabelChange = (key: string, label: string) => {
        if (!config.columns) return;
        const newCols = config.columns.map(c => c.key === key ? { ...c, label } : c);
        setConfig({ ...config, columns: newCols });
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Chỉnh sửa mẫu in: ${type.toUpperCase()}`}
            size="2xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button variant="primary" onClick={() => onSave(config)} icon="save">Lưu Cấu Hình</Button>
                </>
            }
        >
            <div className="flex h-[600px] gap-6 -m-4">
                {/* LEFT: Controls */}
                <div className="w-[320px] flex flex-col border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 overflow-y-auto custom-scrollbar">
                    
                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 mb-6 shrink-0 flex-wrap gap-1">
                        <button onClick={() => setActiveTab('layout')} className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${activeTab === 'layout' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>Bố cục</button>
                        <button onClick={() => setActiveTab('content')} className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${activeTab === 'content' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>Nội dung</button>
                        <button onClick={() => setActiveTab('style')} className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${activeTab === 'style' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>Giao diện</button>
                        <button onClick={() => setActiveTab('advanced')} className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${activeTab === 'advanced' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>Mã nguồn</button>
                    </div>

                    {activeTab === 'layout' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Các thành phần (Kéo thả sắp xếp)</h4>
                                <div className="space-y-2">
                                    {config.sections?.sort((a,b) => a.order - b.order).map((section, idx) => (
                                        <div key={section.id} className={`flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border ${section.visible ? 'border-slate-300 dark:border-slate-600 shadow-sm' : 'border-slate-200 dark:border-slate-800 opacity-60'}`}>
                                            <div className="flex flex-col gap-0.5">
                                                <button onClick={() => moveSection(idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">keyboard_arrow_up</span></button>
                                                <button onClick={() => moveSection(idx, 'down')} disabled={idx === (config.sections?.length || 0) - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">keyboard_arrow_down</span></button>
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{section.label || section.id}</span>
                                            </div>
                                            <button onClick={() => handleSectionToggle(section.id)} className={`text-[18px] ${section.visible ? 'text-blue-600' : 'text-slate-300'}`}>
                                                <span className="material-symbols-outlined">{section.visible ? 'visibility' : 'visibility_off'}</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Cột hiển thị</h4>
                                <div className="space-y-2">
                                    {config.columns?.map(col => (
                                        <label key={col.key} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{col.label}</span>
                                            <input type="checkbox" checked={col.visible} onChange={() => handleColumnToggle(col.key)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="space-y-4">
                            <FormField label="Tiêu đề phiếu">
                                <FormInput value={config.title} onChange={e => setConfig({...config, title: e.target.value})} />
                            </FormField>
                            <FormField label="Lời chào cuối (Footer)">
                                <FormTextarea value={config.footerNote} onChange={e => setConfig({...config, footerNote: e.target.value})} rows={3} />
                            </FormField>
                            <FormField label="Tiêu đề Ghi chú">
                                <FormInput value={config.noteLabel || 'Ghi chú'} onChange={e => setConfig({...config, noteLabel: e.target.value})} />
                            </FormField>
                            
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">Tên cột (Tùy chỉnh)</label>
                                <div className="space-y-2">
                                    {config.columns?.filter(c => c.visible).map(col => (
                                        <div key={col.key} className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 w-8">{col.key}</span>
                                            <input 
                                                value={col.label} 
                                                onChange={e => handleColumnLabelChange(col.key, e.target.value)} 
                                                className="flex-1 text-xs border border-slate-300 rounded px-2 py-1"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">Chữ ký (3 Người)</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[0, 1, 2].map((idx) => (
                                        <FormInput 
                                            key={idx}
                                            value={config.signatures[idx] || ''}
                                            onChange={e => {
                                                const newSigs = [...(config.signatures || [])];
                                                newSigs[idx] = e.target.value;
                                                // Ensure array length is sufficient and gaps are empty strings
                                                for(let i=0; i<3; i++) { if(newSigs[i] === undefined) newSigs[i] = ''; }
                                                setConfig({...config, signatures: newSigs});
                                            }}
                                            placeholder={`Chữ ký ${idx + 1} (VD: Người lập)`}
                                            className="text-xs"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'style' && (
                        <div className="space-y-4">
                            <FormField label="Màu chủ đạo (Header bảng)">
                                <div className="flex gap-2 flex-wrap">
                                    {['#0f172a', '#1e40af', '#047857', '#b91c1c', '#7e22ce', '#c2410c'].map(color => (
                                        <button 
                                            key={color}
                                            onClick={() => setConfig({...config, colorTheme: color})}
                                            className={`size-8 rounded-full shadow-sm border-2 ${config.colorTheme === color ? 'border-black dark:border-white scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <input 
                                        type="color" 
                                        value={config.colorTheme} 
                                        onChange={e => setConfig({...config, colorTheme: e.target.value})}
                                        className="size-8 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                                    />
                                </div>
                            </FormField>
                        </div>
                    )}

                    {activeTab === 'advanced' && (
                        <div className="space-y-6">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                                <strong>Biến khả dụng:</strong> {'{{name}}'}, {'{{code}}'}, {'{{date}}'}, {'{{total}}'}, {'{{customerName}}'}, {'{{phone}}'}, {'{{address}}'}.
                            </div>

                            <FormField label="Custom CSS (Styling)">
                                <FormTextarea 
                                    value={config.customCss || ''} 
                                    onChange={e => setConfig({...config, customCss: e.target.value})} 
                                    rows={6}
                                    placeholder=".print-table { font-size: 14px; } .print-header { border: none; }"
                                    className="font-mono text-xs"
                                />
                            </FormField>

                            <FormField label="Custom HTML Header (Override)">
                                <FormTextarea 
                                    value={config.customHeader || ''} 
                                    onChange={e => setConfig({...config, customHeader: e.target.value})} 
                                    rows={4}
                                    placeholder="<div><h1>{{name}}</h1>...</div>"
                                    className="font-mono text-xs"
                                />
                            </FormField>

                            <FormField label="Custom HTML Footer (Override)">
                                <FormTextarea 
                                    value={config.customFooter || ''} 
                                    onChange={e => setConfig({...config, customFooter: e.target.value})} 
                                    rows={4}
                                    placeholder="<div>Footer content...</div>"
                                    className="font-mono text-xs"
                                />
                            </FormField>
                        </div>
                    )}
                </div>

                {/* RIGHT: Preview */}
                <div className="flex-1 bg-slate-200 dark:bg-slate-900 p-8 overflow-y-auto custom-scrollbar flex justify-center">
                    <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[10mm] transform scale-[0.6] origin-top md:scale-[0.7] lg:scale-[0.8] xl:scale-[0.9] transition-transform">
                        <TemplateEngine 
                            data={MOCK_ORDER} 
                            settings={settings} 
                            config={config} 
                            type={type} 
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};
