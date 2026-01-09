
import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { useAppContext } from '../contexts/AppContext';
import { generateBusinessAdvisorInsight } from '../services/ai';
import { parseDate, formatCurrency, formatDateISO, getStartOfMonth, getEndOfMonth, parseISOToDate } from '../utils/helpers';
import { ViewState } from '../types';
import { Button } from '../components/ui/Primitives';
import { ReportsFilterBar } from '../components/reports/ReportsFilterBar';
import { PrintPreviewModal } from '../components/print/PrintPreviewModal';
import { ReportTemplate } from '../components/print/Templates';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';

// --- Components ---

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 text-xs min-w-[180px] z-50">
                <p className="font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider text-[10px]">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{entry.name}</span>
                        </div>
                        <span className="font-mono font-black text-slate-900 dark:text-white">
                            {new Intl.NumberFormat('vi-VN').format(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// 1. Improved KPI Card with Sparkline
const KPICard = ({ title, value, subValue, trend, icon, color, chartData, dataKey }: any) => (
    <div className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-32 flex flex-col justify-between p-5 transition-all hover:shadow-md group">
        <div className="flex justify-between items-start z-10">
            <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</span>
                </div>
            </div>
            <div className={`size-8 rounded-lg flex items-center justify-center ${color.bg} ${color.text}`}>
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </div>
        </div>
        
        <div className="flex items-center justify-between z-10 relative">
             <div className="flex items-center gap-1">
                {trend !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${trend >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
                        <span className="material-symbols-outlined text-[10px]">{trend >= 0 ? 'trending_up' : 'trending_down'}</span>
                        {Math.abs(trend).toFixed(1)}%
                    </span>
                )}
                <span className="text-[10px] text-slate-400 font-medium ml-1">{subValue || 'vs kỳ trước'}</span>
            </div>
        </div>

        {/* Sparkline Background */}
        {chartData && chartData.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <Area type="monotone" dataKey={dataKey} stroke={color.hex} fill={color.hex} strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        )}
    </div>
);

const Reports: React.FC<{ onNavigate: (view: ViewState, params?: any) => void }> = ({ onNavigate }) => {
    const { settings, showNotification } = useAppContext();
    
    // --- STATE ---
    const today = new Date();
    const [startDate, setStartDate] = useState(formatDateISO(getStartOfMonth(today)));
    const [endDate, setEndDate] = useState(formatDateISO(getEndOfMonth(today)));
    const [warehouseId, setWarehouseId] = useState(''); 
    
    const [chartMode, setChartMode] = useState<'performance' | 'cashflow'>('performance');
    const [showComparison, setShowComparison] = useState(false);

    const [aiInsight, setAiInsight] = useState<string>('');
    const [aiMeta, setAiMeta] = useState<{ cached: boolean, date?: number } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    // --- DATA FETCHING (Local to Reports) ---
    // Fetch data based on Date Range to optimize performance
    
    // 1. Fetch Orders for Selected Period
    const orders = useLiveQuery(async () => {
        // Since we store date as string DD/MM/YYYY, efficient DB range query is hard.
        // We use createdAt index which is numeric timestamp.
        const startTs = new Date(startDate).getTime();
        const endTs = new Date(endDate).setHours(23,59,59,999);
        
        return db.orders
            .where('createdAt').between(startTs, endTs)
            .filter(o => !o.isDeleted)
            .toArray();
    }, [startDate, endDate]) || [];

    // 2. Fetch Transactions for Selected Period
    const transactions = useLiveQuery(async () => {
        const startTs = new Date(startDate).getTime();
        const endTs = new Date(endDate).setHours(23,59,59,999);
        return db.transactions
            .where('createdAt').between(startTs, endTs)
            .toArray();
    }, [startDate, endDate]) || [];

    // 3. Fetch Products (Lightweight) for Health Check
    const allProducts = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];

    // --- PREVIOUS PERIOD DATA ---
    const rangeDates = useMemo(() => {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);
        return { start, end };
    }, [startDate, endDate]);

    const prevRangeDates = useMemo(() => {
        const duration = rangeDates.end.getTime() - rangeDates.start.getTime();
        const prevEnd = new Date(rangeDates.start.getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - duration);
        return { start: prevStart, end: prevEnd };
    }, [rangeDates]);

    // Fetch Previous Period Orders/Transactions
    const [prevOrders, setPrevOrders] = useState<any[]>([]);
    const [prevTransactions, setPrevTransactions] = useState<any[]>([]);

    useEffect(() => {
        if (!showComparison) {
            setPrevOrders([]);
            setPrevTransactions([]);
            return;
        }
        const fetchPrev = async () => {
            const pOrders = await db.orders
                .where('createdAt').between(prevRangeDates.start.getTime(), prevRangeDates.end.getTime())
                .filter(o => !o.isDeleted).toArray();
            
            const pTxns = await db.transactions
                .where('createdAt').between(prevRangeDates.start.getTime(), prevRangeDates.end.getTime())
                .toArray();
                
            setPrevOrders(pOrders);
            setPrevTransactions(pTxns);
        };
        fetchPrev();
    }, [showComparison, prevRangeDates]);


    // --- DATA PROCESSING ---

    // 1. Main Chart Data
    const chartData = useMemo(() => {
        const dataMap: Record<number, { day: string, revenue: number, profit: number, revenuePrev: number, profitPrev: number, income: number, expense: number }> = {};
        
        const daysInPeriod = Math.ceil((rangeDates.end.getTime() - rangeDates.start.getTime()) / (1000 * 3600 * 24)) + 1;
        
        for (let i = 0; i < daysInPeriod; i++) {
            const d = new Date(rangeDates.start); d.setDate(d.getDate() + i);
            const label = `${d.getDate()}/${d.getMonth()+1}`;
            dataMap[i] = { day: label, revenue: 0, profit: 0, revenuePrev: 0, profitPrev: 0, income: 0, expense: 0 };
        }

        const getIndex = (date: Date, start: Date) => Math.floor((date.getTime() - start.getTime()) / (1000 * 3600 * 24));

        orders.forEach(o => {
            if (o.status === 'Cancelled') return;
            const d = parseDate(o.date);
            if (d >= rangeDates.start && d <= rangeDates.end) {
                const idx = getIndex(d, rangeDates.start);
                if (dataMap[idx]) {
                    dataMap[idx].revenue += o.total;
                    let cost = 0;
                    o.items.forEach((i: any) => cost += (i.costPrice || 0) * i.quantity);
                    dataMap[idx].profit += (o.total - cost);
                }
            }
        });

        if (showComparison) {
            prevOrders.forEach(o => {
                if (o.status === 'Cancelled') return;
                const d = parseDate(o.date);
                if (d >= prevRangeDates.start && d <= prevRangeDates.end) {
                    const idx = getIndex(d, prevRangeDates.start);
                    if (dataMap[idx]) {
                        dataMap[idx].revenuePrev += o.total;
                        let cost = 0;
                        o.items.forEach((i: any) => cost += (i.costPrice || 0) * i.quantity);
                        dataMap[idx].profitPrev += (o.total - cost);
                    }
                }
            });
        }

        transactions.forEach(t => {
            const d = parseDate(t.date);
            if (d >= rangeDates.start && d <= rangeDates.end) {
                const idx = getIndex(d, rangeDates.start);
                if (dataMap[idx]) {
                    if (t.type === 'income') dataMap[idx].income += t.amount;
                    else dataMap[idx].expense += t.amount;
                }
            }
        });

        return Object.values(dataMap);
    }, [orders, transactions, prevOrders, prevTransactions, rangeDates, prevRangeDates, showComparison]);

    // 2. Stats Calculation
    const stats = useMemo(() => {
        const calcStats = (oList: any[], tList: any[]) => {
            let rev = 0, prof = 0, count = 0, cashIn = 0, cashOut = 0;
            oList.forEach(o => {
                if (o.status === 'Cancelled') return;
                rev += o.total;
                count++;
                let cost = 0;
                o.items.forEach((i: any) => cost += (i.costPrice || 0) * i.quantity);
                prof += (o.total - cost);
            });
            tList.forEach(t => {
                if (t.type === 'income') cashIn += t.amount; else cashOut += t.amount;
            });
            return { rev, prof, count, cashIn, cashOut };
        };

        const current = calcStats(orders, transactions);
        const prev = showComparison ? calcStats(prevOrders, prevTransactions) : { rev: 0, prof: 0, count: 0, cashIn: 0, cashOut: 0 };
        const getTrend = (curr: number, old: number) => old === 0 ? 0 : ((curr - old) / old) * 100;

        return {
            revenue: current.rev, revenueTrend: getTrend(current.rev, prev.rev),
            profit: current.prof, profitTrend: getTrend(current.prof, prev.prof),
            orderCount: current.count, orderTrend: getTrend(current.count, prev.count),
            netCash: current.cashIn - current.cashOut, netCashTrend: getTrend(current.cashIn - current.cashOut, prev.cashIn - prev.cashOut),
            margin: current.rev > 0 ? (current.prof / current.rev) * 100 : 0
        };
    }, [orders, transactions, prevOrders, prevTransactions, showComparison]);

    // 3. Top Products
    const topProducts = useMemo(() => {
        const map: Record<string, { name: string, total: number, qty: number, sku: string }> = {};
        let maxTotal = 0;
        orders.forEach(o => {
            if (o.status === 'Cancelled') return;
            o.items.forEach((i: any) => {
                if (!map[i.sku]) map[i.sku] = { name: i.productName, total: 0, qty: 0, sku: i.sku };
                map[i.sku].total += i.total;
                map[i.sku].qty += i.quantity;
                if (map[i.sku].total > maxTotal) maxTotal = map[i.sku].total;
            });
        });
        return {
            items: Object.values(map).sort((a,b) => b.total - a.total).slice(0, 5),
            maxTotal
        };
    }, [orders]);

    // 4. Inventory Health
    const inventoryHealth = useMemo(() => {
        let items = allProducts;
        if (warehouseId) items = items.filter(p => p.location === warehouseId);
        
        const out = items.filter(p => p.stock <= 0).length;
        const low = items.filter(p => p.stock > 0 && p.stock <= (p.minStock || 10)).length;
        const good = items.length - out - low;
        
        return { out, low, good, total: items.length };
    }, [allProducts, warehouseId]);

    // --- EFFECT: Load Cached Insight ---
    useEffect(() => {
        const loadCache = async () => {
            const dateKey = new Date().toISOString().slice(0, 10);
            const cacheKey = `insight-${dateKey}`;
            const cached = await db.aiCache.get(cacheKey);
            
            if (cached && Date.now() < cached.expiresAt) {
                setAiInsight(cached.value);
                setAiMeta({ cached: true, date: cached.timestamp });
            }
        };
        loadCache();
    }, []);

    // --- HANDLERS ---
    const handleGenerateInsight = async () => {
        setIsGenerating(true);
        setAiMeta(null);
        try {
            // Need debts for full insight
            const debts = await db.debtRecords.toArray();
            const ar = debts.filter(d => d.type === 'Receivable' && d.remainingAmount > 0).reduce((s,d) => s + d.remainingAmount, 0);
            const ap = debts.filter(d => d.type === 'Payable' && d.remainingAmount > 0).reduce((s,d) => s + d.remainingAmount, 0);

            const aiData = { revenue: stats.revenue, profit: stats.profit, margin: stats.margin, orderCount: stats.orderCount, topProducts: topProducts.items.map(p => p.name), lowStockCount: inventoryHealth.low + inventoryHealth.out, ar, ap };
            
            const result = await generateBusinessAdvisorInsight(aiData);
            setAiInsight(result.text);
            if (result.cached) {
                setAiMeta({ cached: true, date: result.generatedAt });
            } else {
                setAiMeta({ cached: false, date: Date.now() });
                showNotification('Đã tạo phân tích mới!', 'success');
            }
        } catch (e: any) { 
            showNotification(e.message || 'Lỗi kết nối AI.', 'error'); 
        } finally { 
            setIsGenerating(false); 
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-50/50 dark:bg-[#0b1121] overflow-hidden">
            {/* Removed PageHeader */}

            <ReportsFilterBar 
                startDate={startDate} endDate={endDate} 
                onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                warehouse={warehouseId} onWarehouseChange={setWarehouseId}
                rightActions={<Button variant="outline" icon="print" onClick={() => setIsPrintModalOpen(true)}>In Báo Cáo</Button>}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {/* 1. Improved KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                    <KPICard title="Doanh thu thuần" value={formatCurrency(stats.revenue)} trend={stats.revenueTrend} icon="payments" color={{ bg: 'bg-indigo-100', text: 'text-indigo-600', hex: '#4f46e5' }} chartData={chartData} dataKey="revenue" />
                    <KPICard title="Lợi nhuận gộp" value={formatCurrency(stats.profit)} trend={stats.profitTrend} subValue={`Biên lãi: ${stats.margin.toFixed(1)}%`} icon="query_stats" color={{ bg: 'bg-teal-100', text: 'text-teal-600', hex: '#0d9488' }} chartData={chartData} dataKey="profit" />
                    <KPICard title="Tổng đơn hàng" value={stats.orderCount} trend={stats.orderTrend} icon="shopping_cart" color={{ bg: 'bg-blue-100', text: 'text-blue-600', hex: '#2563eb' }} chartData={chartData} dataKey="revenue" />
                    <KPICard title="Dòng tiền ròng" value={formatCurrency(stats.netCash)} trend={stats.netCashTrend} subValue={stats.netCash >= 0 ? "Dương" : "Âm"} icon="account_balance_wallet" color={{ bg: stats.netCash >= 0 ? 'bg-emerald-100' : 'bg-red-100', text: stats.netCash >= 0 ? 'text-emerald-600' : 'text-red-600', hex: stats.netCash >= 0 ? '#10b981' : '#ef4444' }} chartData={chartData} dataKey="income" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* 2. Main Chart with Comparison */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[450px]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-slate-900 dark:text-white">Xu hướng kinh doanh</h3>
                                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                    <button onClick={() => setChartMode('performance')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartMode === 'performance' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600' : 'text-slate-500'}`}>Hiệu quả</button>
                                    <button onClick={() => setChartMode('cashflow')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartMode === 'cashflow' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600' : 'text-slate-500'}`}>Dòng tiền</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={showComparison} onChange={e => setShowComparison(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-xs font-bold text-slate-500">So sánh kỳ trước</span>
                                </label>
                            </div>
                        </div>
                        
                        <div className="flex-1 w-full min-h-0">
                            {chartMode === 'performance' && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/><stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : `${(v/1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                                        
                                        <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                        <Area type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                                        
                                        {showComparison && <Area type="monotone" dataKey="revenuePrev" name="Kỳ trước" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} fill="none" />}
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                            {chartMode === 'cashflow' && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : `${(v/1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                        <Bar dataKey="income" name="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expense" name="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* 3. Top Products & Health (Right Column) */}
                    <div className="space-y-6">
                        {/* Top Products */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm h-[280px] flex flex-col">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Top sản phẩm</h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                                {topProducts.items.map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`size-6 rounded flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[120px]" title={p.name}>{p.name}</p>
                                                <p className="text-[10px] text-slate-400">{p.qty} đã bán</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(p.total)}</span>
                                            <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(p.total / topProducts.maxTotal) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {topProducts.items.length === 0 && <p className="text-center text-slate-400 text-xs mt-10">Chưa có dữ liệu bán hàng</p>}
                            </div>
                        </div>

                        {/* AI Advisor Card */}
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                                        <h3 className="font-bold text-sm">Góc nhìn AI</h3>
                                    </div>
                                    {aiMeta && (
                                        <span className="text-[10px] opacity-70 bg-black/20 px-2 py-0.5 rounded">
                                            {aiMeta.cached ? 'Đã lưu' : 'Mới'} • {new Date(aiMeta.date!).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="min-h-[100px] text-xs leading-relaxed opacity-90 whitespace-pre-line">
                                    {aiInsight || "Nhấn nút bên dưới để AI phân tích dữ liệu kinh doanh hiện tại và đưa ra lời khuyên."}
                                </div>

                                <button 
                                    onClick={handleGenerateInsight}
                                    disabled={isGenerating}
                                    className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <><span className="material-symbols-outlined animate-spin text-[14px]">sync</span> Đang phân tích...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-[14px]">auto_awesome</span> Phân tích ngay</>
                                    )}
                                </button>
                            </div>
                            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[120px] opacity-10 rotate-12">psychology</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Modal */}
            <PrintPreviewModal 
                isOpen={isPrintModalOpen} 
                onClose={() => setIsPrintModalOpen(false)} 
                title={`Báo Cáo Quản Trị`}
                filename={`BaoCao_${startDate}_${endDate}`}
            >
                <ReportTemplate 
                    data={{
                        period: `${parseISOToDate(startDate)?.toLocaleDateString('vi-VN') || '...'} - ${parseISOToDate(endDate)?.toLocaleDateString('vi-VN') || '...'}`,
                        stats,
                        topProducts: topProducts.items,
                        debtStats: { ar: 0, ap: 0 }, // Placeholder for debt stats in print (can be enhanced)
                        aiInsight: aiInsight
                    }}
                    settings={settings}
                />
            </PrintPreviewModal>
        </div>
    );
};

export default Reports;
