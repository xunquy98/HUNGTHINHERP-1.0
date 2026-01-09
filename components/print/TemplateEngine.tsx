
import React from 'react';
import { formatCurrency, readMoney } from '../../utils/helpers';
import { AppSettings, DocTypeConfig, TableColumnConfig } from '../../types';

// Default Configurations (Fallbacks)
const DEFAULT_SECTIONS = [
    { id: 'header', visible: true, order: 0 },
    { id: 'customer_info', visible: true, order: 1 },
    { id: 'items_table', visible: true, order: 2 },
    { id: 'totals', visible: true, order: 3 },
    { id: 'notes', visible: true, order: 4 },
    { id: 'signatures', visible: true, order: 5 },
    { id: 'footer_note', visible: true, order: 6 },
];

const DEFAULT_COLUMNS: TableColumnConfig[] = [
    { key: 'stt', label: 'STT', visible: true, width: 'w-8', align: 'center' },
    { key: 'name', label: 'Tên hàng hóa, quy cách', visible: true, align: 'left' },
    { key: 'unit', label: 'ĐVT', visible: true, width: 'w-12', align: 'center' },
    { key: 'quantity', label: 'SL', visible: true, width: 'w-14', align: 'center' },
    { key: 'price', label: 'Đơn giá', visible: true, width: 'w-24', align: 'right' },
    { key: 'total', label: 'Thành tiền', visible: true, width: 'w-28', align: 'right' },
];

interface TemplateEngineProps {
    data: any; // Order, Quote, etc.
    settings: AppSettings;
    config: DocTypeConfig;
    type: 'order' | 'quote' | 'import' | 'delivery';
}

export const TemplateEngine: React.FC<TemplateEngineProps> = ({ data, settings, config, type }) => {
    // Merge defaults
    const sections = (config.sections || DEFAULT_SECTIONS).sort((a, b) => a.order - b.order);
    const columns = config.columns || DEFAULT_COLUMNS;
    const themeColor = config.colorTheme || '#1e3a8a'; 

    const isQuote = type === 'quote';
    const isImport = type === 'import';
    const isDelivery = type === 'delivery';

    // Helper: Calculate totals if missing (common in Delivery Notes)
    const calculatedSubtotal = data.subtotal ?? data.items?.reduce((sum: number, item: any) => sum + (item.total || item.price * item.quantity || 0), 0) ?? 0;
    const finalTotal = data.total ?? calculatedSubtotal;

    // --- SECTIONS ---

    const renderHeader = () => (
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-400">
            {/* Logo & Company Info */}
            <div className="flex gap-4 items-center w-2/3">
                {settings.general.logo && (
                    <img src={settings.general.logo} alt="Logo" className="h-14 w-auto object-contain" />
                )}
                <div>
                    <h1 className="text-sm font-black uppercase tracking-tight leading-tight text-slate-900 mb-1">
                        {settings.general.name}
                    </h1>
                    <div className="text-[10px] text-slate-700 space-y-0.5 leading-snug">
                        <p><span className="font-bold">Địa chỉ:</span> {settings.general.address}</p>
                        <p><span className="font-bold">Điện thoại:</span> {settings.general.phone} {settings.general.email && <span>- Email: {settings.general.email}</span>}</p>
                        {settings.general.taxId && <p><span className="font-bold">Mã số thuế:</span> {settings.general.taxId}</p>}
                        {settings.general.website && <p><span className="font-bold">Website:</span> {settings.general.website}</p>}
                    </div>
                </div>
            </div>
            
            {/* Title & Code */}
            <div className="w-1/3 text-right">
                <h2 className="text-lg font-black uppercase" style={{ color: themeColor }}>
                    {config.title}
                </h2>
                <div className="mt-0.5">
                    <p className="text-[11px] font-bold text-slate-800">Số: {data.code}</p>
                    <p className="text-[10px] text-slate-500 italic">Ngày: {data.date}</p>
                </div>
            </div>
        </div>
    );

    const renderCustomerInfo = () => (
        <div className="mb-4 flex gap-6 text-[11px] leading-snug text-slate-800">
            {/* Left: Partner Info */}
            <div className="flex-1">
                <div className="flex mb-1">
                    <span className="font-bold w-20 shrink-0">{isImport ? 'Nhà CC:' : isDelivery ? 'Người nhận:' : 'Khách hàng:'}</span>
                    <span className="font-bold uppercase">{isImport ? data.supplierName : data.customerName}</span>
                </div>
                <div className="flex mb-1">
                    <span className="font-bold w-20 shrink-0">Địa chỉ:</span>
                    <span className="flex-1">{data.address || '---'}</span>
                </div>
                <div className="flex">
                    <span className="font-bold w-20 shrink-0">Điện thoại:</span>
                    <span>{data.phone || '---'}</span>
                    {data.taxId && (
                        <>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="font-bold mr-1">MST:</span>
                            <span>{data.taxId}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Right: Meta Info (New Column) */}
            <div className="w-[35%] pl-4 border-l border-slate-300/50">
                <p className="font-bold text-slate-900 mb-1.5 border-b border-slate-300/50 pb-0.5">Thông tin khác</p>
                {!isDelivery && (
                    <div className="flex justify-between mb-1">
                        <span className="text-slate-600">Hình thức TT:</span>
                        <span className="font-bold">{data.paymentMethod === 'transfer' ? 'Chuyển khoản' : data.paymentMethod === 'card' ? 'Thẻ' : 'Tiền mặt'}</span>
                    </div>
                )}
            </div>
        </div>
    );

    const renderTable = () => {
        const visibleCols = columns.filter(c => c.visible);
        
        return (
            <div className="mb-4">
                <table className="w-full text-[11px] border-collapse border border-slate-300">
                    <thead>
                        <tr className="text-white bg-slate-700" style={{ backgroundColor: themeColor }}>
                            {visibleCols.map((col, idx) => (
                                <th 
                                    key={col.key} 
                                    className={`py-1.5 px-1.5 font-bold border border-slate-300/50 text-${col.align || 'left'} ${col.width || ''}`}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-slate-800">
                        {data.items?.map((item: any, i: number) => (
                            <tr key={i} className="border-b border-slate-300">
                                {visibleCols.map(col => {
                                    let content: any = '';
                                    const val = item[col.key];

                                    if (col.key === 'stt') content = i + 1;
                                    else if (col.key === 'name') content = (
                                        <span className="font-medium">{item.productName || item.name}</span>
                                    );
                                    else if (col.key === 'price') content = (item.price || item.retailPrice || 0).toLocaleString('vi-VN');
                                    else if (col.key === 'total') content = <span className="font-bold">{(item.total || (item.price * item.quantity) || 0).toLocaleString('vi-VN')}</span>;
                                    else content = val;

                                    return (
                                        <td key={col.key} className={`py-1 px-1.5 border-r border-slate-300 text-${col.align || 'left'} align-middle`}>
                                            {content}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderTotals = () => (
        <div className="flex flex-col">
            {/* Numbers Section (Right Aligned) */}
            <div className="flex justify-end mb-4">
                <div className="w-1/2 space-y-1 text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-slate-200 border-dashed">
                        <span className="font-bold text-slate-600">Cộng tiền hàng:</span>
                        <span className="font-bold text-slate-900">{formatCurrency(data.subtotal ?? calculatedSubtotal)}</span>
                    </div>
                    
                    {data.discount > 0 && (
                        <div className="flex justify-between py-0.5 border-b border-slate-200 border-dashed">
                            <span className="font-bold text-slate-600">Chiết khấu:</span>
                            <span className="font-bold text-slate-900">-{formatCurrency(data.discount)}</span>
                        </div>
                    )}
                    
                    {(data.vatAmount > 0 || (data.vatRate !== undefined && data.vatRate > 0)) && (
                        <div className="flex justify-between py-0.5 border-b border-slate-200 border-dashed">
                            <span className="font-bold text-slate-600">Thuế GTGT ({data.vatRate || 0}%):</span>
                            <span className="font-bold text-slate-900">{formatCurrency(data.vatAmount || 0)}</span>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-1">
                        <span className="font-black uppercase text-slate-800">Tổng thanh toán:</span>
                        <span className="text-base font-black" style={{ color: themeColor }}>{formatCurrency(finalTotal)}</span>
                    </div>
                </div>
            </div>

            {/* Amount In Words (Left Aligned) */}
            <div className="mb-4 flex gap-2 text-[11px] italic bg-slate-50 p-2 rounded border border-slate-200 justify-start text-left w-full">
                <strong className="text-slate-800 not-italic shrink-0">Bằng chữ:</strong> 
                <span className="text-slate-700">{readMoney(finalTotal)}</span>
            </div>
        </div>
    );

    const renderNotes = () => (
        data.notes ? (
            <div className="mb-4 text-[11px] text-slate-800 italic text-left w-full">
                <span className="font-bold not-italic">{config.noteLabel || 'Ghi chú'}:</span> {data.notes}
            </div>
        ) : null
    );

    const renderSignatures = () => (
        <div className="grid grid-cols-3 gap-4 mt-4 mb-2 page-break-inside-avoid">
            {config.signatures.map((label, idx) => (
                <div key={idx} className="text-center">
                    <p className="font-bold uppercase text-[10px] mb-12 text-slate-800 tracking-wider">{label}</p>
                    <p className="text-[9px] text-slate-400 italic">(Ký, họ tên)</p>
                </div>
            ))}
        </div>
    );

    const renderFooterNote = () => (
        config.footerNote ? (
            <div className="mt-auto pt-3 text-center text-[9px] text-slate-500 italic border-t border-slate-200">
                {config.footerNote}
            </div>
        ) : null
    );

    // Map section IDs to render functions
    const sectionMap: Record<string, () => React.ReactNode> = {
        header: renderHeader,
        customer_info: renderCustomerInfo,
        items_table: renderTable,
        totals: renderTotals,
        notes: renderNotes,
        signatures: renderSignatures,
        footer_note: renderFooterNote,
    };

    return (
        <div className="flex flex-col min-h-full bg-white text-slate-900 font-sans p-6 leading-normal relative">
            {sections.map(section => (
                <React.Fragment key={section.id}>
                    {section.visible && sectionMap[section.id] ? sectionMap[section.id]() : null}
                </React.Fragment>
            ))}
        </div>
    );
};
