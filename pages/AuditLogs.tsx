
import React, { useState, useMemo, useEffect } from 'react';
import { AuditLog, AuditAction, AuditModule } from '../types';
import { db } from '../services/db';
import { useDexieTable } from '../hooks/useDexieTable';
import { PageShell, PageHeader, Button } from '../components/ui/Primitives';
import { FilterBar, FilterChip } from '../components/ui/FilterBar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import { AuditTimeline } from '../components/audit/AuditTimeline';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';
import { parseISOToDate } from '../utils/helpers';

const MODULE_TABS: { id: AuditModule | 'all'; label: string }[] = [
    { id: 'all', label: 'Toàn bộ' },
    { id: 'Orders', label: 'Đơn hàng' },
    { id: 'Inventory', label: 'Kho hàng' },
    { id: 'Debts', label: 'Công nợ' },
    { id: 'Imports', label: 'Nhập hàng' },
    { id: 'Partners', label: 'Đối tác' },
    { id: 'Settings', label: 'Cấu hình' }
];

const AuditLogs: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeModule, setActiveModule] = useState<AuditModule | 'all'>('all');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    
    const itemsPerPage = 15;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // --- Filter Logic ---
    const filterFn = useMemo(() => (log: AuditLog) => {
        // 1. Module Scope
        if (activeModule !== 'all' && log.module !== activeModule) return false;

        // 2. Search
        if (debouncedSearch) {
            const lower = debouncedSearch.toLowerCase();
            if (!log.summary.toLowerCase().includes(lower) && 
                !(log.entityCode && log.entityCode.toLowerCase().includes(lower)) &&
                !log.createdByName.toLowerCase().includes(lower)) return false;
        }

        // 3. Date Range
        if (dateRange.from || dateRange.to) {
            const logDate = new Date(log.createdAt);
            if (dateRange.from) {
                const fromDate = parseISOToDate(dateRange.from);
                if (fromDate && logDate < fromDate) return false;
            }
            if (dateRange.to) {
                const toDate = parseISOToDate(dateRange.to);
                if (toDate) {
                    toDate.setHours(23, 59, 59, 999);
                    if (logDate > toDate) return false;
                }
            }
        }

        return true;
    }, [debouncedSearch, activeModule, dateRange]);

    const { data: logs, totalItems, currentPage, setCurrentPage } = useDexieTable<AuditLog>({
        table: db.auditLogs, 
        itemsPerPage, 
        filterFn, 
        defaultSort: 'createdAt'
    });

    const getActionBadge = (action: AuditAction) => {
        const styles: any = {
            Create: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            Update: 'bg-blue-50 text-blue-600 border-blue-100',
            Delete: 'bg-red-50 text-red-600 border-red-100',
            SoftDelete: 'bg-orange-50 text-orange-600 border-orange-100',
            StatusChange: 'bg-purple-50 text-purple-600 border-purple-100',
            Payment: 'bg-teal-50 text-teal-600 border-teal-100',
            Lock: 'bg-gray-100 text-gray-600 border-gray-200'
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[action] || 'bg-slate-100 text-slate-500'}`}>
                {action}
            </span>
        );
    };

    const columns: ColumnDef<AuditLog>[] = [
        { header: 'Thời gian', accessorKey: 'createdAt', width: 'w-40', cell: (l) => <span className="text-xs text-slate-500 font-mono">{new Date(l.createdAt).toLocaleString('vi-VN')}</span> },
        { header: 'Module', accessorKey: 'module', width: 'w-24', cell: (l) => <span className="text-xs font-bold text-slate-500">{l.module}</span> },
        { header: 'Người dùng', accessorKey: 'createdByName', width: 'w-32', cell: (l) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{l.createdByName}</span> },
        { header: 'Hành động', accessorKey: 'action', width: 'w-32', align: 'center', cell: (l) => getActionBadge(l.action) },
        { header: 'Mã Ref', accessorKey: 'entityCode', width: 'w-28', cell: (l) => <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{l.entityCode || '-'}</span> },
        { header: 'Chi tiết', accessorKey: 'summary', cell: (l) => (
            <div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{l.summary}</p>
                {l.tags && l.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                        {l.tags.map(t => (
                            <span key={t} className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-1 rounded">#{t}</span>
                        ))}
                    </div>
                )}
            </div>
        )},
    ];

    return (
        <PageShell>
            <PageHeader 
                title="Nhật Ký Hoạt Động" 
                subtitle="Theo dõi chi tiết mọi thay đổi trong hệ thống." 
            />

            <div className="px-6 py-2 sticky top-0 z-20 bg-slate-50/90 dark:bg-[#0b1121]/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
                <div className="flex gap-4">
                    {MODULE_TABS.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveModule(tab.id)}
                            className={`py-2 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeModule === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <FilterBar
                searchValue={searchTerm}
                onSearch={setSearchTerm}
                placeholder="Tìm nội dung, mã, người dùng..."
                actions={
                    <DateRangeFilter 
                        startDate={dateRange.from} 
                        endDate={dateRange.to} 
                        onChange={(from, to) => setDateRange({ from, to })} 
                    />
                }
            />

            <DataTable 
                data={logs} 
                columns={columns} 
                emptyIcon="history" 
                emptyMessage="Không tìm thấy nhật ký phù hợp"
            />

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                <Pagination 
                    currentPage={currentPage} 
                    totalItems={totalItems} 
                    pageSize={itemsPerPage} 
                    onPageChange={setCurrentPage} 
                />
            </div>
        </PageShell>
    );
};

export default AuditLogs;
