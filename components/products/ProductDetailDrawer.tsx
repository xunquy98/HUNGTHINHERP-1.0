
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { Product, InventoryLog } from '../../types';
import { Drawer, DrawerSection } from '../ui/Drawer';
import { Button } from '../ui/Primitives';
import { formatCurrency, calcAvailableStock, parseDate, parseISOToDate, formatDateISO, getStartOfMonth, getEndOfMonth } from '../../utils/helpers';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PrintPreviewModal } from '../print/PrintPreviewModal';
import { StockCardTemplate } from '../print/Templates';
import { useAppContext } from '../../contexts/AppContext';

interface Props {
    productId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: (p: Product) => void;
    onAdjust: (p: Product) => void;
}

export const ProductDetailDrawer: React.FC<Props> = ({ productId, isOpen, onClose, onEdit, onAdjust }) => {
    const { settings } = useAppContext();
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
    
    // Date filter state for History tab
    const [startDate, setStartDate] = useState(formatDateISO(getStartOfMonth(new Date())));
    const [endDate, setEndDate] = useState(formatDateISO(getEndOfMonth(new Date())));
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const product = useLiveQuery(() => productId ? db.products.get(productId) : undefined, [productId]);
    
    // Fetch logs live.
    const allLogs = useLiveQuery(() => 
        productId ? db.inventoryLogs.where('productId').equals(productId).sortBy('timestamp') : []
    , [productId]);

    // --- LOGIC: Process logs for Chart & Stock Card ---
    // MOVED UP: Must be before conditional return to satisfy React Hooks rules
    const stockData = useMemo(() => {
        if (!allLogs) return { chartData: [], tableRows: [], openingStock: 0, totalIn: 0, totalOut: 0, closingStock: 0 };

        const start = parseISOToDate(startDate) || new Date(0);
        const end = parseISOToDate(endDate);
        if (end) end.setHours(23, 59, 59, 999);

        // 1. Calculate Opening Stock
        let openingStock = 0;
        const prevLogs = allLogs.filter(l => l.timestamp < start.getTime());
        if (prevLogs.length > 0) {
            openingStock = prevLogs[prevLogs.length - 1].newStock;
        } else {
            openingStock = 0; 
        }

        // 2. Filter logs in range
        const logsInRange = allLogs.filter(l => {
            return l.timestamp >= start.getTime() && (!end || l.timestamp <= end.getTime());
        });

        // 3. Build Table Rows (Stock Card)
        let runningBalance = openingStock;
        let totalIn = 0;
        let totalOut = 0;

        const tableRows = logsInRange.map(log => {
            let inQty = 0;
            let outQty = 0;

            if (log.changeAmount > 0) {
                inQty = log.changeAmount;
                totalIn += inQty;
            } else {
                outQty = Math.abs(log.changeAmount);
                totalOut += outQty;
            }
            
            runningBalance = log.newStock;

            return {
                id: log.id,
                date: new Date(log.timestamp).toLocaleDateString('vi-VN'),
                ref: log.referenceCode,
                note: log.note,
                in: inQty,
                out: outQty,
                balance: runningBalance,
                type: log.type
            };
        });

        // 4. Build Chart Data (Daily snapshots)
        const chartData = logsInRange.map(l => ({
            date: new Date(l.timestamp).toLocaleDateString('vi-VN'),
            timestamp: l.timestamp,
            stock: l.newStock
        }));
        
        if (chartData.length > 0) {
            chartData.unshift({
                date: new Date(start).toLocaleDateString('vi-VN'),
                timestamp: start.getTime(),
                stock: openingStock
            });
        }

        return {
            chartData,
            tableRows,
            openingStock,
            totalIn,
            totalOut,
            closingStock: runningBalance
        };
    }, [allLogs, startDate, endDate]);

    if (!isOpen || !product) return null;

    const available = calcAvailableStock(product.stock, product.stockReserved);

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={product.name}
            subtitle={product.sku}
            width="2xl"
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="secondary" className="flex-1" icon="tune" onClick={() => onAdjust(product)}>Kiểm kê</Button>
                    <Button variant="primary" className="flex-1" icon="edit" onClick={() => onEdit(product)}>Chỉnh sửa</Button>
                </div>
            }
        >
            {/* Header Info */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex gap-2">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                        {product.brand}
                    </span>
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                        {product.location || 'Kho chung'}
                    </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Giá bán lẻ</p>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(product.retailPrice)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Giá vốn</p>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(product.importPrice)}</p>
                    </div>
                </div>
            </div>

            {/* Inventory Status */}
            <div className="mb-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Tình trạng kho</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                        <span className="block text-2xl font-black text-emerald-600">{available}</span>
                        <span className="text-[10px] font-bold text-emerald-600/70 uppercase">Khả dụng</span>
                    </div>
                    <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                        <span className="block text-2xl font-black text-orange-600">{product.stockReserved || 0}</span>
                        <span className="text-[10px] font-bold text-orange-600/70 uppercase">Đang giữ</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="block text-2xl font-black text-slate-700 dark:text-slate-300">{product.stock}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Tổng tồn</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 sticky top-0 bg-white dark:bg-slate-900 z-10">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Thông tin
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Thẻ Kho & Lịch sử
                </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px]">
                {activeTab === 'overview' && (
                    <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
                        <DrawerSection title="Chi tiết">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Kích thước</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{product.dimensions || '---'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Mức tồn tối thiểu</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{product.minStock || 0}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Nhà cung cấp gần nhất</span>
                                    <span className="font-medium text-slate-900 dark:text-white text-right max-w-[200px] truncate">{product.lastSupplier || '---'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Ngày tạo</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{product.createdAt ? new Date(product.createdAt).toLocaleDateString('vi-VN') : '---'}</span>
                                </div>
                            </div>
                        </DrawerSection>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                        {/* Filters */}
                        <div className="flex items-center gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-slate-400">→</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex-1"></div>
                            <Button variant="outline" size="sm" icon="print" onClick={() => setIsPrintModalOpen(true)}>In Thẻ</Button>
                        </div>

                        {/* Chart */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stockData.chartData}>
                                    <defs>
                                        <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                    <XAxis dataKey="date" hide />
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}
                                        formatter={(val: number) => [val, 'Tồn kho']}
                                        labelStyle={{ fontSize: '10px', color: '#64748b' }}
                                    />
                                    <Area type="stepAfter" dataKey="stock" stroke="#3b82f6" strokeWidth={2} fill="url(#colorStock)" animationDuration={500} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Summary Table Header */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="text-[9px] text-slate-500 uppercase font-bold block">Đầu kỳ</span>
                                <span className="text-sm font-bold">{stockData.openingStock}</span>
                            </div>
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                <span className="text-[9px] text-emerald-600 uppercase font-bold block">Tổng nhập</span>
                                <span className="text-sm font-bold text-emerald-700">{stockData.totalIn}</span>
                            </div>
                            <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                                <span className="text-[9px] text-red-600 uppercase font-bold block">Tổng xuất</span>
                                <span className="text-sm font-bold text-red-700">{stockData.totalOut}</span>
                            </div>
                        </div>

                        {/* Stock Card Table */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase">
                                    <tr>
                                        <th className="px-3 py-2 w-20">Ngày</th>
                                        <th className="px-3 py-2">Chứng từ & Diễn giải</th>
                                        <th className="px-2 py-2 text-center w-12 text-emerald-600">Nhập</th>
                                        <th className="px-2 py-2 text-center w-12 text-red-600">Xuất</th>
                                        <th className="px-3 py-2 text-center w-12 bg-slate-50 dark:bg-slate-700">Tồn</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {stockData.tableRows.length > 0 ? stockData.tableRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-3 py-2 text-slate-500">{row.date}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    {row.ref && <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1 rounded border border-slate-200 dark:border-slate-700 text-[10px]">{row.ref}</span>}
                                                    <span className="truncate max-w-[150px]">{row.note}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-center font-medium text-emerald-600">{row.in > 0 ? `+${row.in}` : '-'}</td>
                                            <td className="px-2 py-2 text-center font-medium text-red-600">{row.out > 0 ? `-${row.out}` : '-'}</td>
                                            <td className="px-3 py-2 text-center font-bold bg-slate-50/50 dark:bg-slate-800/30">{row.balance}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-8 text-center text-slate-400 italic">Không có phát sinh trong kỳ</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Print Modal */}
            <PrintPreviewModal 
                isOpen={isPrintModalOpen} 
                onClose={() => setIsPrintModalOpen(false)} 
                title={`Thẻ Kho ${product.sku}`}
                filename={`TheKho_${product.sku}_${startDate}_${endDate}`}
            >
                <StockCardTemplate 
                    data={{
                        period: `${parseISOToDate(startDate)?.toLocaleDateString('vi-VN') || '...'} - ${parseISOToDate(endDate)?.toLocaleDateString('vi-VN') || '...'}`,
                        productName: product.name,
                        sku: product.sku,
                        unit: 'Cái',
                        location: product.location,
                        openingStock: stockData.openingStock,
                        closingStock: stockData.closingStock,
                        totalIn: stockData.totalIn,
                        totalOut: stockData.totalOut,
                        rows: stockData.tableRows
                    }}
                    settings={settings}
                />
            </PrintPreviewModal>
        </Drawer>
    );
};
