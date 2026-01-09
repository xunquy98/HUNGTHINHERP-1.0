
import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ViewState } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency, parseDate, parseISOToDate } from '../utils/helpers';
import { PageShell, Button } from '../components/ui/Primitives';
import { Skeleton } from '../components/ui/Skeleton';
import { generateBusinessAdvisorInsight } from '../services/ai';

interface DashboardProps {
  onNavigate: (view: ViewState, params?: any) => void;
}

type TimeRange = 'week' | 'month';

// --- SUB-COMPONENTS ---

// Updated: Icon-Only Ultra Compact Glassmorphism Button
const HeaderActionButton = ({ label, icon, onClick, delay }: any) => (
    <button 
        onClick={onClick}
        title={label} // Tooltip text for accessibility
        className="flex items-center justify-center rounded-2xl w-14 h-14 sm:w-16 sm:h-16 transition-all duration-300 hover:scale-105 active:scale-95 group bg-white/10 hover:bg-white/20 border border-white/10 shadow-md shadow-purple-900/10 backdrop-blur-sm relative overflow-hidden"
        style={{ animationDelay: `${delay}ms` }}
    >
        {/* Icon */}
        <div className="size-8 sm:size-9 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors shadow-inner">
            <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-white drop-shadow-md">{icon}</span>
        </div>
        
        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
);

// Ultra Compact Modern Gradient Welcome Header
const WelcomeHeader = ({ user, onNavigate }: { user: { name: string }, onNavigate: (view: ViewState) => void }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    
    const hourInt = time.getHours();
    const greeting = hourInt < 12 ? "Chào buổi sáng," : hourInt < 18 ? "Chào buổi chiều," : "Chào buổi tối,";
    const dateStr = time.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl p-4 sm:p-5 shadow-xl shadow-purple-500/10 w-full flex flex-col md:flex-row items-center justify-between gap-4 group">
            
            {/* Decorative Background Circles */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            
            {/* Left: Clock & Greeting */}
            <div className="relative z-10 flex flex-row md:flex-col items-center md:items-start justify-between w-full md:w-auto gap-4">
                <div className="flex flex-col items-start">
                    <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 mb-1 shadow-sm">
                        <span className="material-symbols-outlined text-[12px] text-white">calendar_today</span>
                        <span className="text-[10px] font-bold font-mono text-white tracking-wide">{dateStr}</span>
                    </div>

                    <div className="text-4xl sm:text-5xl font-black tracking-tighter text-white leading-none flex items-baseline drop-shadow-sm">
                        {hours}
                        <span className="animate-pulse text-white/70 -translate-y-0.5 mx-0.5">:</span>
                        {minutes}
                    </div>
                </div>

                <div className="flex items-center gap-2 md:mt-1">
                    <p className="text-xs sm:text-sm text-blue-100 font-medium whitespace-nowrap text-right md:text-left">
                        {greeting} <strong className="text-white block md:inline">{user.name}</strong>
                    </p>
                    <span className="text-xl animate-wave origin-[70%_70%] inline-block filter drop-shadow-md">👋</span>
                </div>
            </div>

            {/* Right: Integrated Quick Actions (Icon Only) */}
            <div className="relative z-10 grid grid-cols-3 min-[450px]:grid-cols-6 gap-3 sm:gap-4 shrink-0 w-full md:w-auto justify-items-center md:justify-items-end">
                <HeaderActionButton 
                    label="Bán hàng (POS)" 
                    icon="point_of_sale" 
                    onClick={() => onNavigate('POS')} 
                    delay={0}
                />
                <HeaderActionButton 
                    label="Nhập kho" 
                    icon="archive" 
                    onClick={() => onNavigate('IMPORTS')} 
                    delay={50}
                />
                <HeaderActionButton 
                    label="Thu/Chi" 
                    icon="payments" 
                    onClick={() => onNavigate('TRANSACTIONS')} 
                    delay={100}
                />
                <HeaderActionButton 
                    label="Thêm đối tác" 
                    icon="person_add" 
                    onClick={() => onNavigate('PARTNERS')} 
                    delay={150}
                />
                <HeaderActionButton 
                    label="Báo cáo" 
                    icon="donut_large" 
                    onClick={() => onNavigate('REPORTS')} 
                    delay={200}
                />
                <HeaderActionButton 
                    label="Nhật ký hệ thống" 
                    icon="terminal" 
                    onClick={() => onNavigate('SYSTEM_LOGS')} 
                    delay={250}
                />
            </div>

            <style>{`
                @keyframes wave {
                    0% { transform: rotate(0deg); }
                    10% { transform: rotate(14deg); }
                    20% { transform: rotate(-8deg); }
                    30% { transform: rotate(14deg); }
                    40% { transform: rotate(-4deg); }
                    50% { transform: rotate(10deg); }
                    60% { transform: rotate(0deg); }
                    100% { transform: rotate(0deg); }
                }
                .animate-wave { animation: wave 2.5s infinite; }
            `}</style>
        </div>
    );
};

const DashboardStatCard = ({ title, value, subValue, icon, color, onClick }: any) => (
    <div 
        onClick={onClick}
        className="group relative bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden h-full flex flex-col justify-between"
    >
        <div className="flex justify-between items-start z-10 relative">
            <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-1">
                    {value}
                </h3>
            </div>
            <div className={`size-12 rounded-xl flex items-center justify-center ${color} bg-opacity-10 text-opacity-100 transition-transform group-hover:scale-110`}>
                <span className="material-symbols-outlined text-[24px]">{icon}</span>
            </div>
        </div>
        {subValue && (
            <p className="text-xs font-medium text-slate-400 flex items-center gap-1 z-10 relative mt-2">
                {subValue}
            </p>
        )}
        <div className={`absolute -bottom-6 -right-6 text-[100px] opacity-5 pointer-events-none ${color.replace('bg-', 'text-')}`}>
            <span className="material-symbols-outlined">{icon}</span>
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-xs min-w-[150px]">
                <p className="font-bold text-slate-500 mb-2 uppercase tracking-wider text-[10px]">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full ring-1 ring-white dark:ring-slate-900" style={{ backgroundColor: entry.color }}></span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{entry.name}</span>
                        </div>
                        <span className="font-mono font-black text-slate-900 dark:text-white">
                            {new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// --- MAIN PAGE ---

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser, showNotification } = useAppContext();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  
  // AI State
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // --- LOCAL DATA FETCHING ---
  
  // 1. Snapshot Data
  const snapshotData = useLiveQuery(async () => {
      const debts = await db.debtRecords.where('remainingAmount').above(0).toArray();
      const ar = debts.filter(d => d.type === 'Receivable' && d.status !== 'Void').reduce((s,d) => s + d.remainingAmount, 0);
      const ap = debts.filter(d => d.type === 'Payable' && d.status !== 'Void').reduce((s,d) => s + d.remainingAmount, 0);
      const overdueDebts = debts.filter(d => d.status === 'Overdue' && d.type === 'Receivable').slice(0, 5);

      const now = new Date();
      const transactions = await db.transactions.toArray();
      let cashIn = 0;
      let cashOut = 0;
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Robust Date Parsing for Transactions
      const getTxnDate = (dStr: string) => {
          if (dStr.includes('/')) return parseDate(dStr);
          return new Date(dStr);
      };

      transactions.forEach(t => {
          const d = getTxnDate(t.date);
          if (d >= startMonth) {
              if (t.type === 'income') cashIn += t.amount; else cashOut += t.amount;
          }
      });

      return { ar, ap, overdueDebts, cashIn, cashOut };
  });
  
  const snapshot = snapshotData || { ar: 0, ap: 0, overdueDebts: [], cashIn: 0, cashOut: 0 };

  // 2. Performance & Top Products Data (Improved Logic)
  const performanceData = useLiveQuery(async () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      
      if (timeRange === 'week') start.setDate(end.getDate() - 6);
      else start.setDate(1);

      const allOrders = await db.orders.filter(o => !o.isDeleted && o.status !== 'Cancelled').toArray();
      
      let revenue = 0;
      let profit = 0;
      let count = 0;
      
      // Initialize daily map with 0 values to ensure continuous chart
      const dailyMap: Record<string, { date: string, revenue: number, profit: number, timestamp: number }> = {};
      const productMap: Record<string, { name: string, qty: number, total: number }> = {};

      // Robust date helper
      const getSafeDate = (dStr: string) => {
          if (!dStr) return new Date(0);
          if (dStr.includes('/')) return parseDate(dStr); // DD/MM/YYYY
          return new Date(dStr); // ISO
      };

      // Pre-fill days
      const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (86400000));
      for(let i = 0; i <= dayDiff; i++) {
          const d = new Date(start); 
          d.setDate(d.getDate() + i);
          // Use YYYY-MM-DD as key for strict matching
          const key = d.toISOString().split('T')[0];
          const label = `${d.getDate()}/${d.getMonth()+1}`;
          dailyMap[key] = { date: label, revenue: 0, profit: 0, timestamp: d.getTime() };
      }

      allOrders.forEach(o => {
          const d = getSafeDate(o.date);
          // Normalize to midnight for comparison
          d.setHours(0,0,0,0);
          
          if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
              revenue += o.total;
              count++;
              let cost = 0;
              
              // Process Items
              o.items.forEach(i => {
                  cost += (i.costPrice || 0) * i.quantity;
                  
                  // Top Products Logic
                  if (!productMap[i.sku]) productMap[i.sku] = { name: i.productName, qty: 0, total: 0 };
                  productMap[i.sku].qty += i.quantity;
                  productMap[i.sku].total += i.total;
              });

              const orderProfit = o.total - cost;
              profit += orderProfit;
              
              // Update Map (using ISO Date Key)
              // We need to construct local date ISO string to match the pre-filled keys
              // Simple hack: d is a Date object, use offset to get local YYYY-MM-DD
              const offset = d.getTimezoneOffset();
              const localDate = new Date(d.getTime() - (offset*60*1000));
              const key = localDate.toISOString().split('T')[0];

              if(dailyMap[key]) {
                  dailyMap[key].revenue += o.total;
                  dailyMap[key].profit += orderProfit;
              }
          }
      });

      // Sort Top Products
      const topProducts = Object.values(productMap)
          .sort((a,b) => b.total - a.total)
          .slice(0, 5);

      // Convert dailyMap to sorted array
      const chartData = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp);

      return { revenue, profit, count, chartData, topProducts };
  }, [timeRange]);
  
  const performance = performanceData || { revenue: 0, profit: 0, count: 0, chartData: [], topProducts: [] };

  // 3. Alerts Data
  const alertsData = useLiveQuery(async () => {
      const lowStock = await db.products
          .filter(p => !p.isDeleted && (p.stock < 0 || p.stock <= (p.minStock || 10)))
          .limit(5)
          .toArray();
      
      return { inventoryIssues: lowStock };
  });
  
  const alerts = alertsData || { inventoryIssues: [] };

  // Computed loading state
  const isLoading = !snapshotData || !performanceData;

  // AI Handler
  const handleGenerateAi = async () => {
      setIsGeneratingAi(true);
      try {
          const result = await generateBusinessAdvisorInsight({
              revenue: performance.revenue,
              profit: performance.profit,
              margin: performance.revenue > 0 ? (performance.profit/performance.revenue)*100 : 0,
              orderCount: performance.count,
              topProducts: performance.topProducts.map(p => p.name),
              ar: snapshot.ar,
              ap: snapshot.ap,
              lowStockCount: alerts.inventoryIssues.length
          });
          setAiInsight(result.text);
      } catch (e) {
          showNotification('Không thể kết nối với chuyên gia AI', 'error');
      } finally {
          setIsGeneratingAi(false);
      }
  };

  return (
    <PageShell className="h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 w-full mx-auto">
            
            {/* 1. HERO SECTION */}
            <WelcomeHeader user={currentUser} onNavigate={onNavigate} />

            {/* 2. KPI METRICS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 animate-[fadeIn_0.5s_ease-out]">
                <DashboardStatCard 
                    title="Doanh Thu" 
                    value={isLoading ? <Skeleton width={100} /> : formatCurrency(performance.revenue)} 
                    subValue={`${performance.count} đơn hàng ${timeRange === 'week' ? 'tuần này' : 'tháng này'}`}
                    icon="payments" 
                    color="bg-blue-500 text-blue-600" 
                    onClick={() => onNavigate('ORDERS')}
                />
                <DashboardStatCard 
                    title="Lợi Nhuận" 
                    value={isLoading ? <Skeleton width={100} /> : formatCurrency(performance.profit)} 
                    subValue={`Biên lãi: ${performance.revenue > 0 ? ((performance.profit/performance.revenue)*100).toFixed(1) : 0}%`}
                    icon="trending_up" 
                    color="bg-emerald-500 text-emerald-600"
                    onClick={() => onNavigate('REPORTS')}
                />
                <DashboardStatCard 
                    title="Dòng Tiền Ròng" 
                    value={isLoading ? <Skeleton width={100} /> : formatCurrency(snapshot.cashIn - snapshot.cashOut)} 
                    subValue={`Vào: ${new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(snapshot.cashIn)} • Ra: ${new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(snapshot.cashOut)}`}
                    icon="account_balance" 
                    color={snapshot.cashIn - snapshot.cashOut >= 0 ? "bg-indigo-500 text-indigo-600" : "bg-orange-500 text-orange-600"}
                    onClick={() => onNavigate('TRANSACTIONS')}
                />
                <DashboardStatCard 
                    title="Công Nợ Phải Thu" 
                    value={isLoading ? <Skeleton width={100} /> : formatCurrency(snapshot.ar)} 
                    subValue={`${snapshot.overdueDebts.length} khách nợ quá hạn`}
                    icon="assignment_late" 
                    color="bg-rose-500 text-rose-600"
                    onClick={() => onNavigate('DEBTS')}
                />
            </div>

            {/* 3. MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-6">
                
                {/* LEFT COLUMN (2/3): CHART & TOP PRODUCTS */}
                <div className="xl:col-span-2 space-y-6">
                    
                    {/* CHART SECTION */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[400px]">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500">monitoring</span>
                                    Hiệu quả kinh doanh
                                </h3>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex text-xs font-bold">
                                {[{ id: 'week', label: '7 Ngày' }, { id: 'month', label: 'Tháng này' }].map(opt => (
                                    <button 
                                        key={opt.id} 
                                        onClick={() => setTimeRange(opt.id as TimeRange)} 
                                        className={`px-3 py-1.5 rounded-lg transition-all ${timeRange === opt.id ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-0 p-4">
                            {isLoading ? <Skeleton width="100%" height="100%" /> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={performance.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(0)}M` : `${(val/1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeDasharray: '3 3' }} />
                                        <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                        <Area type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* TOP PRODUCTS */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-yellow-500">star</span>
                                Sản phẩm bán chạy
                            </h3>
                            <button onClick={() => onNavigate('REPORTS')} className="text-xs font-bold text-blue-600 hover:underline">Chi tiết</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold text-[10px] uppercase">
                                    <tr>
                                        <th className="px-5 py-3 w-10">#</th>
                                        <th className="px-5 py-3">Sản phẩm</th>
                                        <th className="px-5 py-3 text-center">Số lượng</th>
                                        <th className="px-5 py-3 text-right">Doanh số</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {performance.topProducts.map((p: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-5 py-3 text-center">
                                                <span className={`size-6 rounded flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                            </td>
                                            <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                                            <td className="px-5 py-3 text-center font-bold text-slate-600 dark:text-slate-400">{p.qty}</td>
                                            <td className="px-5 py-3 text-right font-black text-slate-800 dark:text-slate-200">
                                                {formatCurrency(p.total)}
                                            </td>
                                        </tr>
                                    ))}
                                    {performance.topProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-4 text-center text-slate-400 text-xs">Chưa có dữ liệu bán hàng</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN (1/3): AI ADVISOR & ALERTS */}
                <div className="xl:col-span-1 space-y-6">
                    
                    {/* AI Advisor Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden min-h-[250px] flex flex-col">
                        <div className="relative z-10 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner">
                                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                                    </div>
                                    <h3 className="font-bold text-sm uppercase tracking-wide">Góc nhìn AI</h3>
                                </div>
                                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded border border-white/20">BETA</span>
                            </div>
                            
                            <div className="flex-1 bg-black/10 rounded-xl p-3 border border-white/5 backdrop-blur-sm text-xs leading-relaxed opacity-90 whitespace-pre-line mb-4 custom-scrollbar overflow-y-auto max-h-[200px]">
                                {aiInsight || "Bấm nút bên dưới để AI phân tích toàn bộ dữ liệu kinh doanh hiện tại và đưa ra lời khuyên chiến lược cho bạn."}
                            </div>

                            <button 
                                onClick={handleGenerateAi}
                                disabled={isGeneratingAi}
                                className="w-full py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isGeneratingAi ? (
                                    <><span className="material-symbols-outlined animate-spin text-[16px]">sync</span> Đang phân tích...</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[16px]">auto_awesome</span> Phân tích ngay</>
                                )}
                            </button>
                        </div>
                        {/* Decor */}
                        <span className="material-symbols-outlined absolute -bottom-6 -right-6 text-[150px] opacity-10 rotate-12 pointer-events-none">psychology</span>
                    </div>

                    {/* Alerts & Actions */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                                <span className="material-symbols-outlined text-red-500 text-[18px]">notifications_active</span>
                                Cần xử lý
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            {alerts.inventoryIssues.length > 0 ? (
                                alerts.inventoryIssues.map((p: any) => (
                                    <div key={p.id} className="flex items-center p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 group cursor-pointer hover:shadow-sm transition-all" onClick={() => onNavigate('INVENTORY', { highlightId: p.id })}>
                                        <div className="size-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-orange-500 shadow-sm shrink-0 mr-3">
                                            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                                            <p className="text-[10px] text-orange-600 font-bold mt-0.5">
                                                {p.stock < 0 ? 'Tồn kho âm' : 'Sắp hết hàng'} • <span className="text-slate-500 font-normal">Còn: {p.stock}</span>
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                                    <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Kho hàng ổn định</span>
                                </div>
                            )}

                            {snapshot.overdueDebts.length > 0 && (
                                <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nợ quá hạn</p>
                                    {snapshot.overdueDebts.map((d: any) => (
                                        <div key={d.id} className="flex items-center p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors" onClick={() => onNavigate('DEBTS', { highlightId: d.id })}>
                                            <span className="size-2 bg-red-500 rounded-full mr-2"></span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{d.partnerName}</p>
                                                <p className="text-[10px] text-red-500">{formatCurrency(d.remainingAmount)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
    </PageShell>
  );
};

export default Dashboard;
