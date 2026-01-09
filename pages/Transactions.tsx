
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { formatCurrency, parseDate, toCSV, downloadTextFile, parseISOToDate, getCurrentDate } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { useDexieTable } from '../hooks/useDexieTable';
import { db } from '../services/db';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { Drawer } from '../components/ui/Drawer';
import Pagination from '../components/Pagination';
import ManualTransactionModal from '../components/ManualTransactionModal';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';

const CATEGORY_LABELS: Record<string, string> = {
    'sale': 'Bán hàng',
    'import': 'Nhập hàng',
    'debt_collection': 'Thu nợ',
    'debt_payment': 'Trả nợ',
    'manual': 'Thủ công',
    'other': 'Khác'
};

const CATEGORY_ICONS: Record<string, string> = {
    'sale': 'shopping_cart',
    'import': 'inventory',
    'debt_collection': 'account_balance_wallet',
    'debt_payment': 'credit_card',
    'manual': 'edit_note',
    'other': 'category'
};

// --- COMPONENT: TRANSACTION ROW ---
interface TransactionRowProps {
    transaction: Transaction;
    onClick: () => void;
}

const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onClick }) => {
    const isIncome = transaction.type === 'income';
    const isTransfer = transaction.method === 'transfer';
    
    return (
        <div 
            onClick={onClick}
            className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer last:border-0"
        >
            <div className="flex items-center gap-4">
                {/* Icon Box */}
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isIncome 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400' 
                    : 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/30 dark:text-rose-400'
                }`}>
                    <span className="material-symbols-outlined text-[20px]">
                        {CATEGORY_ICONS[transaction.category] || 'payments'}
                    </span>
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{transaction.description}</p>
                        {transaction.referenceCode && (
                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                {transaction.referenceCode}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{new Date(transaction.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">{isTransfer ? 'account_balance' : 'payments'}</span>
                            {transaction.method === 'transfer' ? 'Chuyển khoản' : transaction.method === 'card' ? 'Thẻ' : 'Tiền mặt'}
                        </span>
                        {transaction.partnerName && (
                            <>
                                <span>•</span>
                                <span className="truncate max-w-[150px] font-medium text-slate-700 dark:text-slate-300">{transaction.partnerName}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="text-right pl-4">
                <p className={`font-black text-sm md:text-base ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(transaction.amount).replace(' VND', '')}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isIncome ? 'Thu vào' : 'Chi ra'}</p>
            </div>
        </div>
    );
};

const Transactions: React.FC<{ onNavigate: (view: any) => void; initialParams?: any }> = ({ initialParams }) => {
    const { deleteTransaction, confirm } = useAppContext();

    // --- STATE ---
    const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
    const [fetchedTransaction, setFetchedTransaction] = useState<Transaction | null>(null);
    const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // Advanced Filters
    const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
    const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'transfer' | 'card'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Stats State
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0, count: 0 });

    const itemsPerPage = 20; // Increased for list view

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Handle Initial Params
    useEffect(() => {
        if (initialParams?.highlightId) {
            setSelectedTransactionId(initialParams.highlightId);
            setIsDetailDrawerOpen(true);
        }
    }, [initialParams]);

    // --- FILTER LOGIC ---
    const filterFn = useMemo(() => (t: Transaction) => {
        if (debouncedSearch) {
            const searchLower = debouncedSearch.toLowerCase();
            if (!t.description.toLowerCase().includes(searchLower) &&
                !(t.referenceCode && t.referenceCode.toLowerCase().includes(searchLower)) &&
                !(t.partnerName && t.partnerName.toLowerCase().includes(searchLower))) return false;
        }
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (methodFilter !== 'all' && t.method !== methodFilter) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        
        if (dateRange.from || dateRange.to) {
            const tDate = parseDate(t.date);
            if (dateRange.from) {
                const fromDate = parseISOToDate(dateRange.from);
                if (fromDate && tDate < fromDate) return false;
            }
            if (dateRange.to) {
                const toDate = parseISOToDate(dateRange.to);
                if (toDate) {
                    toDate.setHours(23, 59, 59, 999);
                    if (tDate > toDate) return false;
                }
            }
        }
        return true;
    }, [debouncedSearch, typeFilter, methodFilter, categoryFilter, dateRange]);

    const { data: filteredTransactions, totalItems, currentPage, setCurrentPage, isLoading } = useDexieTable<Transaction>({
        table: db.transactions, itemsPerPage, filterFn, defaultSort: 'date'
    });

    // Group Transactions by Date
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, { items: Transaction[], income: number, expense: number }> = {};
        
        filteredTransactions.forEach(t => {
            if (!groups[t.date]) groups[t.date] = { items: [], income: 0, expense: 0 };
            groups[t.date].items.push(t);
            if (t.type === 'income') groups[t.date].income += t.amount;
            else groups[t.date].expense += t.amount;
        });

        // Sort dates descending
        return Object.entries(groups).sort((a, b) => parseDate(b[0]).getTime() - parseDate(a[0]).getTime());
    }, [filteredTransactions]);

    // --- REAL-TIME STATS CALCULATION ---
    useEffect(() => {
        const calcStats = async () => {
            const all = await db.transactions.toArray();
            const filtered = all.filter(filterFn);
            
            let inc = 0;
            let exp = 0;
            filtered.forEach(t => {
                if (t.type === 'income') inc += t.amount;
                else exp += t.amount;
            });
            setStats({ income: inc, expense: exp, balance: inc - exp, count: filtered.length });
        };
        calcStats();
    }, [filterFn]); 

    // --- HANDLERS ---
    
    useEffect(() => {
        if (selectedTransactionId) {
            const inList = filteredTransactions.find(t => t.id === selectedTransactionId);
            if (inList) setFetchedTransaction(null);
            else if (!fetchedTransaction || fetchedTransaction.id !== selectedTransactionId) db.transactions.get(selectedTransactionId).then(t => { if (t) setFetchedTransaction(t); });
        } else { setFetchedTransaction(null); }
    }, [selectedTransactionId, filteredTransactions, fetchedTransaction]);

    const selectedTransaction = useMemo(() => {
        if (!selectedTransactionId) return null;
        return filteredTransactions.find(t => t.id === selectedTransactionId) || fetchedTransaction;
    }, [filteredTransactions, selectedTransactionId, fetchedTransaction]);

    const handleDelete = async (id: string) => {
        const ok = await confirm({ title: 'Xóa giao dịch?', message: 'Hành động này không thể hoàn tác.', type: 'danger' });
        if (ok) {
            await deleteTransaction(id);
            if (selectedTransactionId === id) { setSelectedTransactionId(null); setIsDetailDrawerOpen(false); }
        }
    };

    const handleRowClick = (t: Transaction) => {
        setSelectedTransactionId(t.id);
        setIsDetailDrawerOpen(true);
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setTypeFilter('all');
        setMethodFilter('all');
        setCategoryFilter('all');
        setDateRange({ from: '', to: '' });
    };

    const handleExportCSV = async () => {
        const all = await db.transactions.toArray();
        const filtered = all.filter(filterFn);
        const data = filtered.map(t => ({ date: t.date, type: t.type === 'income' ? 'Thu' : 'Chi', category: t.category, amount: t.amount, method: t.method === 'transfer' ? 'Chuyển khoản' : t.method === 'card' ? 'Thẻ' : 'Tiền mặt', desc: t.description, partner: t.partnerName, ref: t.referenceCode }));
        const headers = [{ key: 'date', label: 'Ngày' }, { key: 'type', label: 'Loại' }, { key: 'category', label: 'Danh mục' }, { key: 'amount', label: 'Số tiền' }, { key: 'method', label: 'Phương thức' }, { key: 'desc', label: 'Mô tả' }, { key: 'partner', label: 'Đối tác' }, { key: 'ref', label: 'Chứng từ' }];
        downloadTextFile(`SoQuy_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data, headers));
    };

    const TransactionDetailDrawer = () => {
        if (!selectedTransaction) return null;
        const t = selectedTransaction;
        const isIncome = t.type === 'income';
        const isLocked = t.category === 'debt_collection' || t.category === 'debt_payment' || t.category === 'sale' || t.category === 'import'; 

        return (
            <Drawer
                isOpen={isDetailDrawerOpen}
                onClose={() => { setIsDetailDrawerOpen(false); setSelectedTransactionId(null); }}
                title="Chi tiết giao dịch"
                width="md"
                footer={
                    <Button variant="danger" className={`w-full ${isLocked ? 'opacity-70 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' : ''}`} icon={isLocked ? "lock" : "delete"} onClick={() => !isLocked && handleDelete(t.id)} disabled={isLocked}>
                        {isLocked ? 'Giao dịch hệ thống (Không thể xóa)' : 'Xóa giao dịch'}
                    </Button>
                }
            >
                <div className={`p-6 rounded-2xl text-white text-center mb-6 shadow-lg ${isIncome ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-pink-600'}`}>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">{isIncome ? 'Khoản Thu' : 'Khoản Chi'}</p>
                    <h3 className="text-4xl font-black tracking-tight">{formatCurrency(t.amount)}</h3>
                    <p className="text-sm font-medium opacity-90 mt-2 flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[16px]">calendar_today</span> {t.date}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                    <div className="p-4 flex justify-between items-center"><span className="text-xs text-slate-500 font-bold uppercase">Phương thức</span><span className="text-sm font-bold text-slate-900 dark:text-white capitalize flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-slate-400">{t.method === 'transfer' ? 'account_balance' : t.method === 'card' ? 'credit_card' : 'payments'}</span>{t.method === 'transfer' ? 'Chuyển khoản' : t.method === 'card' ? 'Thẻ' : 'Tiền mặt'}</span></div>
                    <div className="p-4 flex justify-between items-center"><span className="text-xs text-slate-500 font-bold uppercase">Danh mục</span><span className="text-sm font-bold text-slate-900 dark:text-white capitalize">{CATEGORY_LABELS[t.category] || t.category}</span></div>
                    {t.partnerName && <div className="p-4 flex justify-between items-center"><span className="text-xs text-slate-500 font-bold uppercase">Đối tác</span><span className="text-sm font-bold text-blue-600 truncate max-w-[200px]">{t.partnerName}</span></div>}
                </div>
                {t.referenceCode && <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center mt-6"><div><p className="text-[10px] font-bold text-blue-500 uppercase">Chứng từ gốc</p><p className="font-mono font-bold text-blue-700 dark:text-blue-300">{t.referenceCode}</p></div>{isLocked && <span className="material-symbols-outlined text-blue-400 text-[20px]">link</span>}</div>}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-6"><label className="text-[11px] font-bold text-slate-500 uppercase mb-2 block">Ghi chú</label><p className="text-sm text-slate-800 dark:text-slate-200">{t.description}</p></div>
            </Drawer>
        );
    };

    const categories = Object.entries(CATEGORY_LABELS);

    return (
        <PageShell>
            {/* Removed PageHeader */}
            
            {/* 1. Compact Dashboard */}
            <div className="px-6 pt-6 pb-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-500/20 relative overflow-hidden group">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80">Tổng thu</p>
                    <p className="text-2xl font-black mt-1">{new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(stats.income)}</p>
                    <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] opacity-10 rotate-12 group-hover:scale-110 transition-transform">trending_up</span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng chi</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(stats.expense)}</p>
                    <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] text-slate-900 opacity-5 rotate-12 group-hover:scale-110 transition-transform">trending_down</span>
                </div>
                <div className={`p-4 rounded-2xl shadow-sm border relative overflow-hidden group ${stats.balance >= 0 ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' : 'bg-red-50 border-red-100'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${stats.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Tồn quỹ hiện tại</p>
                    <p className={`text-2xl font-black mt-1 ${stats.balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600'}`}>{formatCurrency(stats.balance)}</p>
                    <span className={`material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] opacity-10 rotate-12 group-hover:scale-110 transition-transform ${stats.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>account_balance_wallet</span>
                </div>
            </div>

            {/* 2. Filters & Toolbar */}
            <TableToolbar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="Tìm nội dung, mã chứng từ..."
                leftFilters={
                    <div className="flex gap-3 items-center w-full overflow-x-auto no-scrollbar">
                        <DateRangeFilter 
                            startDate={dateRange.from} 
                            endDate={dateRange.to} 
                            onChange={(from, to) => setDateRange({ from, to })} 
                        />

                        {/* Category Pills */}
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px]">
                            <button onClick={() => setTypeFilter('all')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${typeFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Tất cả</button>
                            <button onClick={() => setTypeFilter('income')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${typeFilter === 'income' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Thu</button>
                            <button onClick={() => setTypeFilter('expense')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${typeFilter === 'expense' ? 'bg-white dark:bg-slate-600 shadow text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>Chi</button>
                        </div>

                        {/* Reset Button */}
                        {(searchTerm || typeFilter !== 'all' || dateRange.from || categoryFilter !== 'all') && (
                            <button 
                                onClick={handleResetFilters}
                                className="h-[38px] px-3 rounded-xl border border-red-100 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:hover:bg-red-900/40 text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                            >
                                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                Reset
                            </button>
                        )}
                    </div>
                }
                rightActions={
                    <>
                        <Button variant="outline" icon="file_download" onClick={handleExportCSV} className="hidden sm:flex">Export</Button>
                        <Button variant="primary" icon="add" onClick={() => setIsCreateModalOpen(true)}>Thêm mới</Button>
                    </>
                }
            >
                {/* Horizontal Category Scroll */}
                <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar w-full">
                    <button 
                        onClick={() => setCategoryFilter('all')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${categoryFilter === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                    >
                        Tất cả danh mục
                    </button>
                    {categories.map(([key, label]) => (
                        <button 
                            key={key}
                            onClick={() => setCategoryFilter(key)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all flex items-center gap-1.5 ${categoryFilter === key ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">{CATEGORY_ICONS[key]}</span>
                            {label}
                        </button>
                    ))}
                </div>
            </TableToolbar>

            {/* 3. Timeline List View */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">
                {groupedTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <span className="material-symbols-outlined text-[64px] mb-4 text-slate-300">receipt_long</span>
                        <p className="text-sm font-bold text-slate-500">Chưa có giao dịch nào</p>
                    </div>
                ) : (
                    groupedTransactions.map(([dateStr, group]) => {
                        // Calculate daily net
                        const net = group.income - group.expense;
                        const isToday = dateStr === getCurrentDate();
                        
                        return (
                            <div key={dateStr} className="animate-fadeIn">
                                {/* Sticky Date Header */}
                                <div className="sticky top-0 z-10 bg-[#f8fafc] dark:bg-[#0b1121] py-2 mb-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-800/50">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        {isToday && <span className="bg-blue-600 text-white px-1.5 rounded text-[9px] py-0.5">HÔM NAY</span>}
                                        {dateStr}
                                    </h3>
                                    <div className="flex items-center gap-4 text-xs font-medium">
                                        <span className="text-emerald-600">Thu: {formatCurrency(group.income)}</span>
                                        <span className="text-rose-600">Chi: {formatCurrency(group.expense)}</span>
                                        <span className={`font-bold ${net >= 0 ? 'text-blue-600' : 'text-slate-500'}`}>Ròng: {formatCurrency(net)}</span>
                                    </div>
                                </div>
                                
                                {/* Transaction Cards */}
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                    {group.items.map(t => (
                                        <TransactionRow 
                                            key={t.id} 
                                            transaction={t} 
                                            onClick={() => handleRowClick(t)} 
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={itemsPerPage} onPageChange={setCurrentPage} />
            </div>

            <TransactionDetailDrawer />
            <ManualTransactionModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
        </PageShell>
    );
};

export default Transactions;
