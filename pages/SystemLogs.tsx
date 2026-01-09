
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { useDexieTable } from '../hooks/useDexieTable';
import { AuditLog, AuditAction, ErrorLog, ReconcileIssue } from '../types';
import { PageShell, PageHeader, Button } from '../components/ui/Primitives';
import { FilterBar, FilterChip } from '../components/ui/FilterBar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import { useAppContext } from '../contexts/AppContext';
import { downloadTextFile, parseISOToDate, toCSV, formatRelativeTime } from '../utils/helpers';
import { Table } from 'dexie';
import { Drawer, DrawerSection } from '../components/ui/Drawer';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';

// Define a strict ErrorLog type where id is required
interface TableErrorLog extends Omit<ErrorLog, 'id'> {
    id: number;
}

// --- SUB-COMPONENTS ---

const StatCard = ({ title, value, icon, color, subValue, onClick, isActive }: any) => (
    <div 
        onClick={onClick}
        className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer ${
            isActive 
            ? `bg-white dark:bg-slate-800 border-${color.split(' ')[0].replace('text-', '')} ring-1 ring-${color.split(' ')[0].replace('text-', '')} shadow-lg` 
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
        }`}
    >
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h3>
            </div>
            <div className={`size-10 rounded-xl flex items-center justify-center ${color} bg-opacity-10 text-opacity-100`}>
                <span className="material-symbols-outlined text-[24px]">{icon}</span>
            </div>
        </div>
        {subValue && (
            <div className="relative z-10 mt-4 flex items-center gap-2">
                <span className={`flex size-1.5 rounded-full ${color.replace('text-', 'bg-')}`}></span>
                <p className="text-xs font-medium text-slate-500">{subValue}</p>
            </div>
        )}
        <span className={`material-symbols-outlined absolute -bottom-4 -right-4 text-[100px] opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12 ${color.replace('bg-', 'text-')}`}>{icon}</span>
    </div>
);

// Improvement 1: Smart Diff Viewer
const SmartDiffViewer = ({ before, after }: { before: any, after: any }) => {
    if (!before && !after) return <p className="text-sm text-slate-400 italic">Không có dữ liệu thay đổi.</p>;
    
    // Calculate differences
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const changes: { key: string, oldVal: any, newVal: any }[] = [];

    allKeys.forEach(key => {
        const oldVal = before ? before[key] : undefined;
        const newVal = after ? after[key] : undefined;
        
        // Simple equality check (works for primitives, ignores deep objects for now to keep UI clean)
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            // Ignore internal keys
            if (key === 'updatedAt' || key === 'createdAt') return;
            changes.push({ key, oldVal, newVal });
        }
    });

    if (changes.length === 0) return <p className="text-sm text-slate-400 italic">Không phát hiện thay đổi nội dung (Chỉ thay đổi metadata).</p>;

    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                        <th className="px-4 py-2 w-1/4">Trường dữ liệu</th>
                        <th className="px-4 py-2 w-1/3">Giá trị cũ</th>
                        <th className="px-4 py-2 w-1/3">Giá trị mới</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {changes.map((change, idx) => (
                        <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">{change.key}</td>
                            <td className="px-4 py-3 text-red-600 dark:text-red-400 line-through decoration-red-300 text-xs break-all">
                                {change.oldVal !== undefined && change.oldVal !== null ? String(change.oldVal) : <span className="italic opacity-50">null</span>}
                            </td>
                            <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold text-xs break-all">
                                {change.newVal !== undefined && change.newVal !== null ? String(change.newVal) : <span className="italic opacity-50">null</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const LogDetailDrawer = ({ 
    isOpen, 
    onClose, 
    data, 
    type 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    data: any; 
    type: 'error' | 'audit' 
}) => {
    if (!data) return null;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={type === 'error' ? 'Chi tiết lỗi hệ thống' : 'Chi tiết hoạt động'}
            subtitle={type === 'error' ? `Mã lỗi: #${data.id}` : `Ref: ${data.entityCode || data.id}`}
            width="2xl"
        >
            <div className="space-y-8 pb-6">
                {/* Header Summary Card */}
                <div className={`p-5 rounded-2xl border flex items-start gap-4 shadow-sm ${type === 'error' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30'}`}>
                    <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${type === 'error' ? 'bg-white text-red-600' : 'bg-white text-blue-600'}`}>
                        <span className="material-symbols-outlined text-[28px]">{type === 'error' ? 'error' : 'history_edu'}</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-1 leading-snug">
                            {type === 'error' ? data.message : data.summary}
                        </h4>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
                            <span className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-md border border-black/5">
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                {new Date(data.timestamp || data.createdAt).toLocaleString('vi-VN')}
                            </span>
                            {type === 'audit' && (
                                <span className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-md border border-black/5">
                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                    {data.createdByName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                {type === 'error' ? (
                    <div className="space-y-6">
                        <DrawerSection title="Chi tiết lỗi (Stack Trace)">
                            <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-700">
                                {data.stack || 'Không có thông tin stack trace.'}
                            </div>
                        </DrawerSection>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Đường dẫn (Route)</p>
                                <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{data.route || 'Unknown'}</p>
                            </div>
                            <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Trình duyệt (User Agent)</p>
                                <p className="text-xs text-slate-500 truncate" title={data.userAgent}>{data.userAgent || 'Unknown'}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] uppercase text-slate-400 font-bold">Phân hệ</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{data.module}</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] uppercase text-slate-400 font-bold">Đối tượng</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{data.entityType}</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] uppercase text-slate-400 font-bold">Hành động</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{data.action}</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] uppercase text-slate-400 font-bold">ID Bản ghi</p>
                                <p className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs truncate" title={data.entityId}>{data.entityId}</p>
                            </div>
                        </div>

                        {/* Improvement 1: Use Smart Diff Viewer */}
                        <DrawerSection title="Chi tiết thay đổi">
                            <SmartDiffViewer before={data.before} after={data.after} />
                        </DrawerSection>
                        
                        {data.tags && data.tags.length > 0 && (
                            <DrawerSection title="Thẻ (Tags)">
                                <div className="flex flex-wrap gap-2">
                                    {data.tags.map((t: string) => (
                                        <span key={t} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
                                            #{t}
                                        </span>
                                    ))}
                                </div>
                            </DrawerSection>
                        )}
                    </div>
                )}
            </div>
        </Drawer>
    );
}

// --- MAIN PAGE ---

const SystemLogs: React.FC = () => {
    const { generateDebugBundle, reconcileData, showNotification } = useAppContext();
    const [activeTab, setActiveTab] = useState<'audit' | 'errors' | 'health'>('audit');
    
    // --- Error Logs State ---
    const [errorSearch, setErrorSearch] = useState('');
    const [debouncedErrorSearch, setDebouncedErrorSearch] = useState('');
    const [errorDateRange, setErrorDateRange] = useState({ from: '', to: '' });
    
    // --- Audit Logs State ---
    const [auditSearch, setAuditSearch] = useState('');
    const [debouncedAuditSearch, setDebouncedAuditSearch] = useState('');
    const [auditDateRange, setAuditDateRange] = useState({ from: '', to: '' });
    const [auditFilter, setAuditFilter] = useState('all');

    // --- Health State ---
    const [healthIssues, setHealthIssues] = useState<ReconcileIssue[] | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [checkProgress, setCheckProgress] = useState(0);

    // --- Detail Drawer State ---
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [drawerType, setDrawerType] = useState<'error' | 'audit'>('error');

    // Dashboard Stats
    const [stats, setStats] = useState({ errorCountToday: 0, auditCountToday: 0, systemHealth: 100 });

    useEffect(() => {
        const t = setTimeout(() => setDebouncedErrorSearch(errorSearch), 300);
        return () => clearTimeout(t);
    }, [errorSearch]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedAuditSearch(auditSearch), 300);
        return () => clearTimeout(t);
    }, [auditSearch]);

    // Calculate Stats
    useEffect(() => {
        const calc = async () => {
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const ts = todayStart.getTime();
            
            const errs = await db.errorLogs.where('timestamp').above(ts).count();
            const auds = await db.auditLogs.where('createdAt').above(ts).count();
            
            setStats({
                errorCountToday: errs,
                auditCountToday: auds,
                systemHealth: Math.max(0, 100 - (errs * 5)) 
            });
        };
        calc();
        // Refresh every minute to look "live"
        const interval = setInterval(calc, 60000);
        return () => clearInterval(interval);
    }, [activeTab]);

    const handleExportBundle = async () => {
        try {
            const bundle = await generateDebugBundle();
            downloadTextFile(`debug-bundle-${new Date().toISOString().slice(0,10)}.json`, bundle, 'application/json');
            showNotification('Đã xuất gói tin gỡ lỗi thành công', 'success');
        } catch (e) {
            showNotification('Lỗi xuất gói tin', 'error');
        }
    };

    const handleExportAuditCSV = async () => {
        const allLogs = await db.auditLogs.toArray();
        const csvData = allLogs.map(l => ({
            Time: new Date(l.createdAt).toLocaleString('vi-VN'),
            User: l.createdByName,
            Action: l.action,
            Module: l.module,
            Summary: l.summary,
            Ref: l.entityCode || ''
        }));
        const content = toCSV(csvData, [
            { key: 'Time', label: 'Thời gian' },
            { key: 'User', label: 'Người dùng' },
            { key: 'Action', label: 'Hành động' },
            { key: 'Module', label: 'Phân hệ' },
            { key: 'Summary', label: 'Nội dung' },
            { key: 'Ref', label: 'Mã tham chiếu' }
        ]);
        downloadTextFile(`AuditLog_${new Date().toISOString().slice(0,10)}.csv`, content);
        showNotification('Đã xuất CSV nhật ký', 'success');
    };

    const runHealthCheck = async () => {
        if (isChecking) return;
        setIsChecking(true);
        setCheckProgress(0);
        setHealthIssues(null);

        const interval = setInterval(() => {
            setCheckProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.floor(Math.random() * 10);
            });
        }, 200);

        try {
            const issues = await reconcileData();
            clearInterval(interval);
            setCheckProgress(100);
            setTimeout(() => {
                setHealthIssues(issues);
                setIsChecking(false);
            }, 500);
        } catch (e) {
            clearInterval(interval);
            setIsChecking(false);
            showNotification('Lỗi khi kiểm tra hệ thống', 'error');
        }
    };

    // --- Error Table Logic ---
    const errorFilterFn = useMemo(() => (log: TableErrorLog) => {
        if (debouncedErrorSearch) {
            const lower = debouncedErrorSearch.toLowerCase();
            if (!log.message.toLowerCase().includes(lower) && !(log.route && log.route.toLowerCase().includes(lower))) return false;
        }
        if (errorDateRange.from || errorDateRange.to) {
            const logDate = new Date(log.timestamp);
            if (errorDateRange.from) {
                const fromDate = parseISOToDate(errorDateRange.from);
                if (fromDate && logDate < fromDate) return false;
            }
            if (errorDateRange.to) {
                const toDate = parseISOToDate(errorDateRange.to);
                if (toDate) {
                    toDate.setHours(23, 59, 59, 999);
                    if (logDate > toDate) return false;
                }
            }
        }
        return true;
    }, [debouncedErrorSearch, errorDateRange]);

    const { data: errors, totalItems: totalErrors, currentPage: errorPage, setCurrentPage: setErrorPage } = useDexieTable<TableErrorLog>({
        table: db.errorLogs as unknown as Table<TableErrorLog, any>,
        itemsPerPage: 15,
        filterFn: errorFilterFn,
        defaultSort: 'timestamp'
    });

    const errorColumns: ColumnDef<TableErrorLog>[] = [
        { header: 'Thời gian', accessorKey: 'timestamp', width: 'w-40', cell: (l) => <span className="text-xs text-slate-500 font-mono">{formatRelativeTime(l.timestamp)}</span> },
        { header: 'Mức độ', accessorKey: 'severity', width: 'w-24', align: 'center', cell: (l) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${l.severity === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{l.severity}</span> },
        { header: 'Thông báo lỗi', accessorKey: 'message', cell: (l) => <span className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1" title={l.message}>{l.message}</span> },
        { header: 'Đường dẫn', accessorKey: 'route', width: 'w-32', cell: (l) => <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded truncate block max-w-[200px]">{l.route || '-'}</span> },
        { header: 'Chi tiết', width: 'w-20', align: 'center', cell: (l) => (
            <button onClick={() => { setSelectedItem(l); setDrawerType('error'); }} className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
        )}
    ];

    // --- Audit Table Logic ---
    const auditFilterFn = useMemo(() => (log: AuditLog) => {
        if (debouncedAuditSearch) {
            const lower = debouncedAuditSearch.toLowerCase();
            if (!log.summary.toLowerCase().includes(lower) && 
                !(log.entityCode && log.entityCode.toLowerCase().includes(lower)) &&
                !log.createdByName.toLowerCase().includes(lower)) return false;
        }
        if (auditFilter !== 'all' && log.entityType !== auditFilter) return false;
        
        if (auditDateRange.from || auditDateRange.to) {
            const logDate = new Date(log.createdAt);
            if (auditDateRange.from) {
                const fromDate = parseISOToDate(auditDateRange.from);
                if (fromDate && logDate < fromDate) return false;
            }
            if (auditDateRange.to) {
                const toDate = parseISOToDate(auditDateRange.to);
                if (toDate) {
                    toDate.setHours(23, 59, 59, 999);
                    if (logDate > toDate) return false;
                }
            }
        }
        return true;
    }, [debouncedAuditSearch, auditFilter, auditDateRange]);

    const { data: audits, totalItems: totalAudits, currentPage: auditPage, setCurrentPage: setAuditPage } = useDexieTable<AuditLog>({
        table: db.auditLogs,
        itemsPerPage: 15,
        filterFn: auditFilterFn,
        defaultSort: 'createdAt'
    });

    const getActionBadge = (action: AuditAction) => {
        const styles: Record<string, string> = {
            Create: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
            Update: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
            Delete: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
            SoftDelete: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
            StatusChange: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
            Payment: 'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800',
            Restore: 'bg-lime-50 text-lime-600 border-lime-100 dark:bg-lime-900/20 dark:text-lime-400 dark:border-lime-800',
            Adjust: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
            Lock: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
        };
        return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[action] || 'bg-slate-100 text-slate-500'}`}>{action}</span>;
    };

    const auditColumns: ColumnDef<AuditLog>[] = [
        { header: 'Thời gian', accessorKey: 'createdAt', width: 'w-40', cell: (l) => <span className="text-xs text-slate-500 font-mono" title={new Date(l.createdAt).toLocaleString('vi-VN')}>{formatRelativeTime(l.createdAt)}</span> },
        { header: 'Người dùng', accessorKey: 'createdByName', width: 'w-32', cell: (l) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{l.createdByName}</span> },
        { header: 'Hành động', accessorKey: 'action', width: 'w-32', align: 'center', cell: (l) => getActionBadge(l.action) },
        { header: 'Đối tượng', accessorKey: 'entityType', width: 'w-24', cell: (l) => <div className="flex flex-col"><span className="text-xs font-bold text-slate-800 dark:text-slate-200">{l.entityType}</span>{l.entityCode && <span className="text-[10px] text-slate-400 font-mono cursor-pointer hover:text-blue-500 hover:underline" onClick={(e) => { e.stopPropagation(); setAuditSearch(l.entityCode || ''); }}>{l.entityCode}</span>}</div>},
        { header: 'Chi tiết', accessorKey: 'summary', cell: (l) => <span className="text-sm text-slate-600 dark:text-slate-300 line-clamp-1">{l.summary}</span> },
        { header: 'Xem', width: 'w-16', align: 'center', cell: (l) => (
            <button onClick={() => { setSelectedItem(l); setDrawerType('audit'); }} className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
        )}
    ];

    // Improvement 3: Row coloring logic
    const auditRowClass = (log: AuditLog) => {
        if (log.severity === 'error') return 'bg-red-50/50 dark:bg-red-900/10 border-l-4 !border-l-red-500';
        if (log.severity === 'warn') return 'bg-orange-50/50 dark:bg-orange-900/10 border-l-4 !border-l-orange-500';
        if (log.action === 'Delete' || log.action === 'SoftDelete') return 'border-l-4 !border-l-slate-300';
        return '';
    };

    return (
        <PageShell>
            <PageHeader 
                title="Nhật Ký Hệ Thống" 
                subtitle="Theo dõi hoạt động & Công cụ quản trị."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" icon="bug_report" onClick={handleExportBundle}>Gói tin gỡ lỗi</Button>
                    </div>
                }
            />

            {/* Dashboard Stats */}
            <div className="px-6 pt-2 pb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Điểm ổn định" 
                    value={`${stats.systemHealth}%`} 
                    icon="health_and_safety" 
                    color="text-emerald-500 bg-emerald-500" 
                    subValue={stats.systemHealth > 80 ? 'Hệ thống ổn định' : 'Cần kiểm tra'}
                    isActive={activeTab === 'health'}
                    onClick={() => setActiveTab('health')}
                />
                <StatCard 
                    title="Hoạt động hôm nay" 
                    value={stats.auditCountToday} 
                    icon="history" 
                    color="text-blue-500 bg-blue-500" 
                    subValue="Hành động được ghi lại"
                    isActive={activeTab === 'audit'}
                    onClick={() => setActiveTab('audit')}
                />
                <StatCard 
                    title="Lỗi phát sinh" 
                    value={stats.errorCountToday} 
                    icon="error" 
                    color={stats.errorCountToday === 0 ? 'text-emerald-500 bg-emerald-500' : 'text-red-500 bg-red-500'}
                    subValue="Lỗi ứng dụng trong 24h"
                    isActive={activeTab === 'errors'}
                    onClick={() => setActiveTab('errors')}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl overflow-hidden shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                
                {/* Tabs */}
                <div className="px-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-6 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('audit')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">history_edu</span> Hoạt động
                    </button>
                    <button onClick={() => setActiveTab('errors')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'errors' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">bug_report</span> Lỗi hệ thống
                    </button>
                    <button onClick={() => setActiveTab('health')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'health' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">monitor_heart</span> Sức khỏe dữ liệu
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'errors' && (
                        <>
                            <FilterBar 
                                searchValue={errorSearch} 
                                onSearch={setErrorSearch} 
                                placeholder="Tìm nội dung lỗi, route..." 
                                actions={
                                    <DateRangeFilter 
                                        startDate={errorDateRange.from} 
                                        endDate={errorDateRange.to} 
                                        onChange={(from, to) => setErrorDateRange({ from, to })} 
                                    />
                                }
                            />
                            <DataTable 
                                data={errors} 
                                columns={errorColumns} 
                                emptyIcon="check_circle" 
                                emptyMessage="Tuyệt vời! Không có lỗi nào được ghi nhận." 
                            />
                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                                <Pagination currentPage={errorPage} totalItems={totalErrors} pageSize={15} onPageChange={setErrorPage} />
                            </div>
                        </>
                    )}

                    {activeTab === 'audit' && (
                        <>
                            <FilterBar 
                                searchValue={auditSearch} 
                                onSearch={setAuditSearch} 
                                placeholder="Tìm nhật ký, mã, user..." 
                                actions={
                                    <div className="flex items-center gap-2">
                                        <DateRangeFilter 
                                            startDate={auditDateRange.from} 
                                            endDate={auditDateRange.to} 
                                            onChange={(from, to) => setAuditDateRange({ from, to })} 
                                        />
                                        <Button variant="outline" size="sm" icon="download" onClick={handleExportAuditCSV}>Xuất Excel</Button>
                                    </div>
                                }
                                chips={
                                    // Improvement 4: Contextual Filters
                                    <>
                                        {['all', 'Order', 'Product', 'Partner', 'Debt', 'Import', 'System'].map(type => (
                                            <FilterChip key={type} label={type === 'all' ? 'Tất cả' : type} isActive={auditFilter === type} onClick={() => setAuditFilter(type)} />
                                        ))}
                                    </>
                                }
                            />
                            <DataTable 
                                data={audits} 
                                columns={auditColumns} 
                                emptyIcon="history" 
                                emptyMessage="Không có nhật ký nào" 
                                rowClassName={auditRowClass}
                            />
                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                                <Pagination currentPage={auditPage} totalItems={totalAudits} pageSize={15} onPageChange={setAuditPage} />
                            </div>
                        </>
                    )}

                    {activeTab === 'health' && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* Scanner Banner */}
                                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h2 className="text-2xl font-black mb-2">Chẩn đoán Sức khỏe Dữ liệu</h2>
                                        <p className="text-blue-100 max-w-lg mb-6 leading-relaxed opacity-90">Hệ thống sẽ quét toàn bộ cơ sở dữ liệu để tìm các lỗi không đồng nhất, bao gồm tồn kho sai lệch, công nợ không khớp và các liên kết bị hỏng.</p>
                                        
                                        {!isChecking && !healthIssues && (
                                            <button 
                                                onClick={runHealthCheck}
                                                className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">play_arrow</span> Bắt đầu quét ngay
                                            </button>
                                        )}

                                        {isChecking && (
                                            <div className="max-w-md">
                                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-blue-200">
                                                    <span>Đang kiểm tra...</span>
                                                    <span>{checkProgress}%</span>
                                                </div>
                                                <div className="h-2 bg-blue-900/30 rounded-full overflow-hidden">
                                                    <div className="h-full bg-white rounded-full transition-all duration-300 ease-out" style={{ width: `${checkProgress}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                                        <span className="material-symbols-outlined text-[250px]">radar</span>
                                    </div>
                                </div>

                                {/* Results */}
                                {healthIssues && (
                                    <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Kết quả kiểm tra</h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${healthIssues.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {healthIssues.length} vấn đề được tìm thấy
                                            </span>
                                        </div>

                                        {healthIssues.length === 0 ? (
                                            <div className="p-8 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-col items-center text-center gap-4">
                                                <div className="size-16 bg-emerald-100 dark:bg-emerald-800/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                                                    <span className="material-symbols-outlined text-[32px]">check_circle</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">Hệ thống khỏe mạnh!</h4>
                                                    <p className="text-emerald-600 dark:text-emerald-400 mt-1">Không tìm thấy lỗi dữ liệu nào. Cơ sở dữ liệu của bạn đang ở trạng thái tốt nhất.</p>
                                                </div>
                                                <Button variant="secondary" onClick={() => setHealthIssues(null)} className="mt-2">Hoàn tất</Button>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {healthIssues.map((issue, idx) => (
                                                    <div key={idx} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex items-start gap-4 hover:shadow-md transition-all group">
                                                        <div className={`mt-1 size-10 rounded-lg flex items-center justify-center shrink-0 ${issue.severity === 'High' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'}`}>
                                                            <span className="material-symbols-outlined text-[20px]">{issue.severity === 'High' ? 'error' : 'warning'}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <span className="font-bold text-slate-800 dark:text-white text-sm">{issue.type}</span>
                                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${issue.severity === 'High' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{issue.severity}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{issue.message}</p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <code className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 font-mono">ID: {issue.entityName || issue.entityId}</code>
                                                            </div>
                                                            
                                                            {issue.suggestedFix && (
                                                                <div className="mt-3 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                                                                    <span className="material-symbols-outlined text-[16px] shrink-0">lightbulb</span>
                                                                    <span><span className="font-bold">Gợi ý:</span> {issue.suggestedFix}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Thử sửa lỗi này">
                                                            <span className="material-symbols-outlined text-[20px]">build</span>
                                                        </button>
                                                    </div>
                                                ))}
                                                <div className="flex justify-center mt-4">
                                                    <Button variant="secondary" onClick={() => setHealthIssues(null)} icon="refresh">Quét lại</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <LogDetailDrawer 
                isOpen={!!selectedItem} 
                onClose={() => setSelectedItem(null)} 
                data={selectedItem} 
                type={drawerType} 
            />
        </PageShell>
    );
};

export default SystemLogs;
