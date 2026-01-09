
import React, { useState, useMemo, useEffect } from 'react';
import { DebtRecord } from '../types';
import { removeVietnameseTones, parseDate, formatCurrency, getCurrentDate, toCSV, downloadTextFile, getDaysDiff, parseISOToDate } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { FilterChip } from '../components/ui/FilterBar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import { DebtPayDrawer } from '../components/debts/DebtPayDrawer';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';
import { ActionMenu } from '../components/ui/ActionMenu';
import { useDexieTable } from '../hooks/useDexieTable';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

type DebtFilterStatus = 'all' | 'Overdue' | 'DueSoon' | 'Normal';

const Debts: React.FC = () => {
  const { batchProcessDebtPayment, addPaymentToDebt, confirm } = useAppContext();
  
  // Data Fetching
  const debtRecords = useLiveQuery(() => db.debtRecords.toArray()) || [];
  const partners = useLiveQuery(() => db.partners.toArray()) || [];
  
  // --- UI State ---
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [isHistoryMode, setIsHistoryMode] = useState(false); 

  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtFilterStatus>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof DebtRecord; direction: 'asc' | 'desc' }>({ key: 'dueDate', direction: 'asc' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'transfer' as 'cash' | 'transfer', notes: '' });
  const [selectedPartnerForBatch, setSelectedPartnerForBatch] = useState<string>('');

  // Debounce Search
  useEffect(() => { 
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300); 
    return () => clearTimeout(timer); 
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [activeTab, isHistoryMode, debouncedSearch, dateRange, statusFilter]);

  // --- STATS CALCULATION (Global) ---
  const stats = useMemo(() => {
      let receivable = 0;
      let payable = 0;
      let overdue = 0;
      
      debtRecords.forEach(d => {
          if (d.status === 'Void') return;
          if (d.remainingAmount > 0) {
              if (d.type === 'Receivable') receivable += d.remainingAmount;
              else payable += d.remainingAmount;
              
              if (d.status === 'Overdue') overdue += d.remainingAmount;
          }
      });

      return { receivable, payable, overdue, net: receivable - payable };
  }, [debtRecords]);

  // --- FILTER & SORT LOGIC ---
  const filteredRecords = useMemo(() => {
    let result = debtRecords.filter(record => {
      // 1. Type Filter
      const matchesType = record.type === (activeTab === 'receivable' ? 'Receivable' : 'Payable');
      if (!matchesType) return false;

      // 2. History Mode
      const isPaid = record.remainingAmount <= 0;
      if (isHistoryMode && !isPaid) return false;
      if (!isHistoryMode && isPaid) return false;

      // 3. Search
      if (debouncedSearch) {
          const normSearch = removeVietnameseTones(debouncedSearch);
          if (!removeVietnameseTones(record.partnerName).includes(normSearch) && !record.orderCode.toLowerCase().includes(normSearch)) return false;
      }
      
      // 4. Status Filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
          const today = new Date(); today.setHours(0,0,0,0);
          const dueDate = parseDate(record.dueDate);
          const isOverdue = dueDate < today && record.remainingAmount > 0;
          const isDueSoon = !isOverdue && (dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24) <= 3 && record.remainingAmount > 0;
          
          if (statusFilter === 'Overdue') matchesStatus = isOverdue;
          else if (statusFilter === 'DueSoon') matchesStatus = isDueSoon;
          else if (statusFilter === 'Normal') matchesStatus = !isOverdue && !isDueSoon && record.remainingAmount > 0;
      }
      if (!matchesStatus) return false;

      // 5. Date Range
      if (dateRange.from || dateRange.to) {
          const targetDate = isHistoryMode ? new Date(record.updatedAt) : parseDate(record.dueDate); 
          if (dateRange.from) {
              const fromDate = parseISOToDate(dateRange.from);
              if (fromDate && targetDate < fromDate) return false;
          }
          if (dateRange.to) {
              const toDate = parseISOToDate(dateRange.to);
              if (toDate) {
                  toDate.setHours(23, 59, 59, 999);
                  if (targetDate > toDate) return false;
              }
          }
      }

      return true; 
    });

    // Sort
    return result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        // Custom sort for dates
        if (sortConfig.key === 'dueDate' || sortConfig.key === 'issueDate') {
             const dateA = parseDate(valA as string).getTime();
             const dateB = parseDate(valB as string).getTime();
             return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

  }, [debtRecords, activeTab, isHistoryMode, debouncedSearch, statusFilter, dateRange, sortConfig]);

  // Aging Buckets for Board View
  const agingBoard = useMemo(() => {
      const buckets: Record<string, { title: string, items: DebtRecord[], color: string }> = {
          current: { title: 'Trong hạn & 0-7 ngày', items: [], color: 'border-emerald-500' },
          days8_30: { title: 'Quá hạn 8-30 ngày', items: [], color: 'border-amber-500' },
          days31_60: { title: 'Quá hạn 31-60 ngày', items: [], color: 'border-orange-500' },
          days60plus: { title: 'Quá hạn > 60 ngày', items: [], color: 'border-rose-500' }
      };
      
      filteredRecords.forEach(record => {
          const dueDate = parseDate(record.dueDate);
          const daysOverdue = getDaysDiff(dueDate);
          
          if (daysOverdue <= 7) buckets.current.items.push(record);
          else if (daysOverdue <= 30) buckets.days8_30.items.push(record);
          else if (daysOverdue <= 60) buckets.days31_60.items.push(record);
          else buckets.days60plus.items.push(record);
      });
      return buckets;
  }, [filteredRecords]);

  // Pagination Logic
  const totalItems = filteredRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedData = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
      if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
      else if (currentPage < 1) setCurrentPage(1);
  }, [totalPages, currentPage]);

  // --- ACTIONS ---
  const handleSort = (key: string) => {
      setSortConfig(prev => ({
          key: key as keyof DebtRecord,
          direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const handleResetFilters = () => {
      setSearchTerm('');
      setDateRange({ from: '', to: '' });
      setStatusFilter('all');
  };

  const handleExportCSV = () => {
      const exportData = filteredRecords.map(d => ({ partner: d.partnerName, code: d.orderCode, issueDate: d.issueDate, dueDate: d.dueDate, total: d.totalAmount, remaining: d.remainingAmount, type: d.type === 'Receivable' ? 'Phải thu' : 'Phải trả', status: d.status }));
      const headers = [{ key: 'partner', label: 'Đối tác' }, { key: 'code', label: 'Chứng từ' }, { key: 'issueDate', label: 'Ngày tạo' }, { key: 'dueDate', label: 'Hạn TT' }, { key: 'total', label: 'Tổng tiền' }, { key: 'remaining', label: 'Còn lại' }];
      downloadTextFile(`CongNo_${activeTab}_${isHistoryMode ? 'LichSu' : 'HienTai'}_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(exportData, headers));
  };

  const handleOpenPayment = (debt: DebtRecord) => {
      setSelectedDebtId(debt.id);
      setIsDrawerOpen(true);
  };

  const handleQuickCollect = async (debt: DebtRecord) => {
      const ok = await confirm({
          title: 'Thu tiền mặt ngay?',
          message: `Xác nhận thu đủ ${formatCurrency(debt.remainingAmount)} bằng Tiền mặt từ ${debt.partnerName}?`,
          confirmLabel: 'Thu ngay',
          type: 'info'
      });
      if(ok) {
          await addPaymentToDebt(debt.id, {
              amount: debt.remainingAmount,
              method: 'cash',
              notes: `Thu nhanh ${debt.orderCode}`,
              date: new Date().toLocaleDateString('en-GB')
          });
      }
  };

  const handleBatchPayment = async () => {
      if (!selectedPartnerForBatch || paymentForm.amount <= 0) return;
      const targetDebts = filteredRecords.filter(r => r.partnerId === selectedPartnerForBatch).sort((a,b) => parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime());
      
      const allocations = [];
      let remaining = paymentForm.amount;
      for (const debt of targetDebts) {
          if (remaining <= 0) break;
          const pay = Math.min(remaining, debt.remainingAmount);
          allocations.push({ debtId: debt.id, amount: pay });
          remaining -= pay;
      }
      
      const partner = partners.find(p => p.id === selectedPartnerForBatch);
      await batchProcessDebtPayment(selectedPartnerForBatch, { 
          amount: paymentForm.amount, 
          date: getCurrentDate(), 
          method: paymentForm.method, 
          notes: paymentForm.notes || (activeTab === 'receivable' ? 'Thu nợ gộp' : 'Trả nợ gộp'), 
          partnerName: partner?.name 
      }, allocations);
      
      setIsBatchModalOpen(false); 
      setPaymentForm({ amount: 0, method: 'transfer', notes: '' });
  };

  // --- COLUMNS ---
  const columns: ColumnDef<DebtRecord>[] = [
      { header: 'Đối tác', accessorKey: 'partnerName', sortable: true, cell: (d) => (
          <div className="flex items-center gap-3">
              <div className={`size-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm shrink-0 uppercase ${activeTab === 'receivable' ? 'bg-blue-500' : 'bg-orange-500'}`}>
                  {d.partnerName.charAt(0)}
              </div>
              <div className="min-w-[150px]">
                  <div className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[200px]" title={d.partnerName}>{d.partnerName}</div>
                  <div className="text-[10px] text-slate-400">{d.partnerPhone || '---'}</div>
              </div>
          </div>
      )},
      { header: 'Chứng từ', accessorKey: 'orderCode', sortable: true, width: 'w-32', cell: (d) => (
          <span className="font-mono font-bold text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
              {d.orderCode}
          </span>
      )},
      { header: 'Ngày tạo', accessorKey: 'issueDate', width: 'w-28', sortable: true, className: 'hidden sm:table-cell text-xs text-slate-500' },
      { header: isHistoryMode ? 'Hoàn tất' : 'Hạn TT', accessorKey: 'dueDate', width: 'w-28', sortable: true, cell: (d) => {
          const today = new Date(); today.setHours(0,0,0,0);
          const isOverdue = !isHistoryMode && parseDate(d.dueDate) < today && d.remainingAmount > 0;
          return isHistoryMode ? (
              <span className="text-xs font-bold text-emerald-600">{new Date(d.updatedAt).toLocaleDateString('vi-VN')}</span>
          ) : (
              <span className={`text-xs font-bold ${isOverdue ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-slate-600'}`}>{d.dueDate}</span>
          );
      }},
      { header: 'Giá trị', accessorKey: 'totalAmount', width: 'w-32', align: 'right', sortable: true, cell: (d) => <span className="text-xs text-slate-500 font-medium">{formatCurrency(d.totalAmount)}</span> },
      { header: 'Còn lại', accessorKey: 'remainingAmount', width: 'w-40', align: 'right', sortable: true, cell: (d) => {
          const percent = d.totalAmount > 0 ? ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100 : 100;
          return (
              <div className="flex flex-col items-end">
                  <span className={`font-black text-sm ${d.remainingAmount === 0 ? 'text-slate-400' : activeTab === 'receivable' ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrency(d.remainingAmount)}
                  </span>
                  {!isHistoryMode && (
                      <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div>
                      </div>
                  )}
              </div>
          );
      }},
      { header: 'Trạng thái', accessorKey: 'status', width: 'w-28', align: 'center', sortable: true, cell: (d) => <StatusBadge status={d.status} entityType="Debt" /> },
      { header: 'Tác vụ', align: 'center', width: 'w-20', cell: (d) => (
          <div className="flex items-center justify-center gap-1">
              {!isHistoryMode && activeTab === 'receivable' && (
                  <button 
                      onClick={(e) => { e.stopPropagation(); handleQuickCollect(d); }}
                      className="size-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 flex items-center justify-center transition-colors"
                      title="Thu tiền mặt ngay"
                  >
                      <span className="material-symbols-outlined text-[18px]">payments</span>
                  </button>
              )}
              <ActionMenu items={[
                  { label: 'Chi tiết & TT', icon: 'visibility', onClick: () => handleOpenPayment(d) }
              ]} />
          </div>
      )}
  ];

  return (
    <PageShell>
      {/* Removed PageHeader */}

      {/* Quick Stats Dashboard */}
      <div className="px-6 pt-6 pb-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center"><span className="material-symbols-outlined">arrow_downward</span></div>
              <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Phải thu (KH)</p>
                  <p className="text-lg font-black text-blue-700 dark:text-blue-400 truncate" title={formatCurrency(stats.receivable)}>{new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(stats.receivable)}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
              <div className="size-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center"><span className="material-symbols-outlined">arrow_upward</span></div>
              <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Phải trả (NCC)</p>
                  <p className="text-lg font-black text-orange-700 dark:text-orange-400 truncate" title={formatCurrency(stats.payable)}>{new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(stats.payable)}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 border-l-4 border-l-red-500">
              <div className="size-10 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center"><span className="material-symbols-outlined">warning</span></div>
              <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Nợ quá hạn</p>
                  <p className="text-lg font-black text-red-600 truncate">{new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(stats.overdue)}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center"><span className="material-symbols-outlined">account_balance</span></div>
              <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Dòng tiền ròng</p>
                  <p className={`text-lg font-black truncate ${stats.net >= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {stats.net > 0 ? '+' : ''}{new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(stats.net)}
                  </p>
              </div>
          </div>
      </div>

      <TableToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Tìm đối tác, mã chứng từ..."
          leftFilters={
              <div className="flex gap-3 items-center w-full overflow-x-auto no-scrollbar">
                  {/* Segmented Type Control */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px] items-center shrink-0">
                      <button onClick={() => setActiveTab('receivable')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${activeTab === 'receivable' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}>Phải thu</button>
                      <button onClick={() => setActiveTab('payable')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${activeTab === 'payable' ? 'bg-white dark:bg-slate-600 shadow text-orange-600 dark:text-orange-400' : 'text-slate-400 hover:text-slate-600'}`}>Phải trả</button>
                  </div>

                  <DateRangeFilter 
                      startDate={dateRange.from} 
                      endDate={dateRange.to} 
                      onChange={(from, to) => setDateRange({ from, to })} 
                  />

                  {/* Reset Button */}
                  {(searchTerm || statusFilter !== 'all' || dateRange.from) && (
                      <button 
                          onClick={handleResetFilters}
                          className="h-[38px] px-3 rounded-xl border border-red-100 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:hover:bg-red-900/40 text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                      >
                          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                          Reset
                      </button>
                  )}

                  {/* Mode Switcher */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px] items-center shrink-0">
                      <button onClick={() => setIsHistoryMode(false)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${!isHistoryMode ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                          Đang nợ <span className="bg-slate-200 dark:bg-slate-700 px-1.5 rounded-full text-[9px]">{debtRecords.filter(d => d.type === (activeTab === 'receivable' ? 'Receivable' : 'Payable') && d.remainingAmount > 0).length}</span>
                      </button>
                      <button onClick={() => setIsHistoryMode(true)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isHistoryMode ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'}`}>Lịch sử</button>
                  </div>
              </div>
          }
          rightActions={
              !isHistoryMode && (
                <div className="flex gap-2">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px]">
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-400'}`} title="Danh sách"><span className="material-symbols-outlined text-[18px]">list</span></button>
                        <button onClick={() => setViewMode('board')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'board' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-400'}`} title="Tuổi nợ"><span className="material-symbols-outlined text-[18px]">view_kanban</span></button>
                    </div>
                    <Button variant="outline" icon="file_download" onClick={handleExportCSV}>Excel</Button>
                    <Button variant="primary" icon="price_check" onClick={() => { setIsBatchModalOpen(true); setPaymentForm({ amount: 0, method: 'transfer', notes: '' }); }}>
                        {activeTab === 'receivable' ? 'Thu gộp' : 'Trả gộp'}
                    </Button>
                </div>
              )
          }
      >
          {!isHistoryMode && (['all', 'Overdue', 'DueSoon', 'Normal'] as const).map(item => (
              <FilterChip 
                key={item} 
                label={item === 'all' ? 'Tất cả' : item === 'Overdue' ? 'Quá hạn' : item === 'DueSoon' ? 'Sắp đến hạn' : 'Trong hạn'} 
                isActive={statusFilter === item} 
                onClick={() => setStatusFilter(item)} 
                color={item === 'Overdue' ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : item === 'DueSoon' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : undefined}
              />
          ))}
      </TableToolbar>

      {/* VIEW CONTENT */}
      {viewMode === 'list' || isHistoryMode ? (
          <>
            <div className="flex-1 overflow-hidden px-6 pt-4 pb-2">
                <DataTable
                    data={paginatedData}
                    columns={columns}
                    sort={{ 
                        items: [{ key: sortConfig.key, direction: sortConfig.direction }], 
                        onSort: handleSort 
                    }}
                    emptyIcon="account_balance_wallet"
                    emptyMessage={isHistoryMode ? "Chưa có lịch sử thanh toán" : "Không có khoản nợ nào"}
                    onRowClick={handleOpenPayment}
                />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={itemsPerPage} onPageChange={setCurrentPage} />
            </div>
          </>
      ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
              <div className="flex gap-4 h-full min-w-[1000px]">
                  {Object.entries(agingBoard).map(([key, bucket]) => {
                      const b = bucket as { title: string, items: DebtRecord[], color: string };
                      return (
                      <div key={key} className="flex-1 flex flex-col h-full bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                          <div className={`p-4 border-b-2 ${b.color} bg-white dark:bg-slate-900 rounded-t-2xl flex justify-between items-center sticky top-0`}>
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{b.title}</h3>
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{b.items.length}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                              {b.items.map((d: DebtRecord) => (
                                  <div key={d.id} onClick={() => handleOpenPayment(d)} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
                                      <div className="flex justify-between items-start mb-2">
                                          <div className="font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-700 px-1.5 rounded">{d.orderCode}</div>
                                          <StatusBadge status={d.status} entityType="Debt" type="dot" />
                                      </div>
                                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate mb-1" title={d.partnerName}>{d.partnerName}</p>
                                      <div className="flex justify-between items-end">
                                          <span className="text-[10px] text-slate-500">{d.dueDate}</span>
                                          <span className={`font-black text-sm ${activeTab === 'receivable' ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(d.remainingAmount)}</span>
                                      </div>
                                  </div>
                              ))}
                              {b.items.length === 0 && <div className="text-center text-slate-400 text-xs py-8 italic">Không có phiếu nợ</div>}
                          </div>
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-b-2xl border-t border-slate-100 dark:border-slate-800 text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase mr-2">Tổng:</span>
                              <span className="font-black text-sm">{formatCurrency(b.items.reduce((s,i) => s + i.remainingAmount, 0))}</span>
                          </div>
                      </div>
                  )})}
              </div>
          </div>
      )}
      
      {/* Batch Modal */}
      {isBatchModalOpen && (
          <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" aria-modal="true" role="dialog">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-white/10">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">{activeTab === 'receivable' ? 'Thu nợ gộp (FIFO)' : 'Thanh toán nợ gộp (FIFO)'}</h3>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Chọn đối tác</label>
                          <select value={selectedPartnerForBatch} onChange={e => setSelectedPartnerForBatch(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold" autoFocus>
                              <option value="">-- Chọn đối tác --</option>
                              {partners.filter(p => p.type === (activeTab === 'receivable' ? 'Customer' : 'Supplier')).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Số tiền thanh toán</label>
                          <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})} className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-lg font-black text-emerald-600" />
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => setPaymentForm({...paymentForm, method: 'cash'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${paymentForm.method === 'cash' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500'}`}>Tiền mặt</button>
                          <button onClick={() => setPaymentForm({...paymentForm, method: 'transfer'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${paymentForm.method === 'transfer' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500'}`}>Chuyển khoản</button>
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                      <Button variant="secondary" className="flex-1" onClick={() => setIsBatchModalOpen(false)}>Hủy</Button>
                      <Button variant="primary" className="flex-[2]" onClick={handleBatchPayment}>Xác nhận</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Quick Pay Drawer */}
      <DebtPayDrawer 
          isOpen={isDrawerOpen} 
          onClose={() => setIsDrawerOpen(false)} 
          debtId={selectedDebtId} 
      />
    </PageShell>
  );
};

export default Debts;
