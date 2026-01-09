
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Quote, QuoteStatus } from '../types';
import { exportToCSV, parseDate, formatCurrency, parseISOToDate, getDaysDiff, generateUUID, formatDateDDMMYYYY, getCurrentDate } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import StatusBadge from '../components/StatusBadge';
import { CreateQuoteModal, PrintPreviewModal } from '../components/QuoteModals';
import { QuoteDetailDrawer } from '../components/quotes/QuoteDetailDrawer';
import { useDexieTable } from '../hooks/useDexieTable';
import { db } from '../services/db';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';

// --- SUB-COMPONENTS ---

const QuoteStatCard = ({ title, value, icon, color, subValue }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group">
        <div className="flex justify-between items-start z-10">
            <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</h3>
            </div>
            <div className={`size-10 rounded-lg flex items-center justify-center ${color} bg-opacity-10 text-opacity-100`}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
        </div>
        {subValue && <p className="text-xs text-slate-400 mt-2 font-medium z-10">{subValue}</p>}
        <span className={`material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] opacity-5 transition-transform group-hover:scale-110 ${color.replace('bg-', 'text-')}`}>{icon}</span>
    </div>
);

const Quotes: React.FC<{ onNavigate?: any, initialParams?: any }> = ({ initialParams }) => {
  const { deleteQuote, convertQuoteToOrder, confirm, showNotification, createQuote, updateQuote } = useAppContext();
  
  // Router Params
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');

  // --- STATE ---
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [fetchedQuote, setFetchedQuote] = useState<Quote | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  
  // Print State
  const [printData, setPrintData] = useState<Quote | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const itemsPerPage = 10;

  // Handle URL Params (Code or ID)
  useEffect(() => {
      const loadFromUrl = async () => {
          if (code) {
              const quote = await db.quotes.where('code').equals(code).first();
              if (quote) {
                  setSelectedQuoteId(quote.id);
                  setFetchedQuote(quote);
              }
          } else if (highlightId) {
              setSelectedQuoteId(highlightId);
          }
      };
      loadFromUrl();
  }, [code, highlightId]);

  // Debounce Search
  useEffect(() => { 
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300); 
    return () => clearTimeout(timer); 
  }, [searchTerm]);

  // --- STATS CALCULATION (Live) ---
  const allQuotes = useDexieTable<Quote>({ table: db.quotes }).data; 
  
  const stats = useMemo(() => {
      const pending = allQuotes.filter(q => q.status === 'Draft' || q.status === 'Sent');
      const accepted = allQuotes.filter(q => q.status === 'Accepted');
      const total = allQuotes.length;
      
      const pendingValue = pending.reduce((sum, q) => sum + q.total, 0);
      const conversionRate = total > 0 ? (accepted.length / total) * 100 : 0;
      
      // Expiring soon (within 3 days) or expired, and not yet accepted/rejected
      const today = new Date(); today.setHours(0,0,0,0);
      const risk = allQuotes.filter(q => {
          if (q.status === 'Accepted' || q.status === 'Rejected' || q.status === 'Cancelled') return false;
          const validDate = parseDate(q.validUntil);
          const diff = (validDate.getTime() - today.getTime()) / (86400000);
          return diff <= 3; 
      }).length;

      return { pendingValue, conversionRate, risk };
  }, [allQuotes]);

  // --- FILTER LOGIC ---
  const filterFn = useMemo(() => (q: Quote) => {
      if (debouncedSearch) {
          const lower = debouncedSearch.toLowerCase();
          if (!q.code.toLowerCase().includes(lower) && !q.customerName.toLowerCase().includes(lower)) return false;
      }
      
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;

      if (dateRange.from || dateRange.to) {
          const d = parseDate(q.date);
          if (dateRange.from) {
              const fromDate = parseISOToDate(dateRange.from);
              if (fromDate && d < fromDate) return false;
          }
          if (dateRange.to) {
              const toDate = parseISOToDate(dateRange.to);
              if (toDate) {
                  toDate.setHours(23, 59, 59, 999);
                  if (d > toDate) return false;
              }
          }
      }
      return true;
  }, [debouncedSearch, statusFilter, dateRange]);

  const { data: quotes, totalItems, currentPage, setCurrentPage, sortState, setSortState, requestSort, isLoading } = useDexieTable<Quote>({
      table: db.quotes, itemsPerPage, filterFn, defaultSort: 'createdAt'
  });

  // Fallback Fetch Logic for Drawer
  useEffect(() => {
    if (selectedQuoteId) {
        const inList = quotes.find(q => q.id === selectedQuoteId);
        if (inList) {
            setFetchedQuote(null); // Clear manual fetch if found in list
        } else if (!fetchedQuote || fetchedQuote.id !== selectedQuoteId) {
            db.quotes.get(selectedQuoteId).then(q => {
                if (q) setFetchedQuote(q);
            });
        }
    } else {
        setFetchedQuote(null);
    }
  }, [selectedQuoteId, quotes, fetchedQuote]);

  const selectedQuote = useMemo(() => {
      if (!selectedQuoteId) return null;
      return quotes.find(q => q.id === selectedQuoteId) || fetchedQuote;
  }, [quotes, selectedQuoteId, fetchedQuote]);

  // --- ACTIONS ---
  const handleCreate = () => {
      setModalMode('create');
      setIsCreateModalOpen(true);
  };

  const handleEdit = (quote: Quote) => {
      setSelectedQuoteId(quote.id);
      setIsCreateModalOpen(true);
      setModalMode('edit');
  };

  const handleDelete = async (id: string) => {
      const ok = await confirm({ title: 'Xóa báo giá?', message: 'Dữ liệu sẽ bị xóa vĩnh viễn.', type: 'danger' });
      if(ok) {
          await deleteQuote(id);
          if(selectedQuoteId === id) setSelectedQuoteId(null);
      }
  };

  const handleConvertToOrder = async (id: string) => {
      const ok = await confirm({ 
          title: 'Chốt đơn hàng ngay?', 
          message: 'Hệ thống sẽ tạo đơn hàng mới từ báo giá này.', 
          type: 'info',
          confirmLabel: 'Tạo đơn hàng'
      });
      if(ok) {
          await convertQuoteToOrder(id, { method: 'transfer', amountPaid: 0 });
          showNotification('Đã chuyển thành đơn hàng!', 'success');
      }
  };

  const handleDuplicate = async (q: Quote) => {
      const newQuote = {
          ...q,
          code: '', 
          status: 'Draft' as QuoteStatus,
          date: getCurrentDate(),
          validUntil: formatDateDDMMYYYY(new Date(Date.now() + 7 * 86400000)),
          customerName: `${q.customerName} (Copy)`,
          customerId: q.customerId
      };
      
      await createQuote(newQuote);
      showNotification('Đã nhân bản báo giá', 'success');
  };

  const handleQuickStatusChange = async (id: string, newStatus: QuoteStatus) => {
      await updateQuote({ id, status: newStatus });
      if(fetchedQuote && fetchedQuote.id === id) setFetchedQuote({...fetchedQuote, status: newStatus});
  };

  // --- COLUMNS ---
  const columns: ColumnDef<Quote>[] = [
      { 
          header: 'Mã báo giá', 
          accessorKey: 'code', 
          sortable: true, 
          width: 'w-36', 
          cell: (q) => (
            <span className="font-mono font-bold text-xs text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-800">{q.code}</span>
          )
      },
      { 
          header: 'Khách hàng', 
          accessorKey: 'customerName', 
          sortable: true, 
          cell: (q) => (
            <div className="flex items-center gap-3">
                <div className={`size-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm shrink-0 uppercase ${
                    ['bg-purple-500', 'bg-blue-500', 'bg-pink-500', 'bg-indigo-500'][q.customerName.charCodeAt(0) % 4]
                }`}>
                    {q.customerName.charAt(0)}
                </div>
                <div className="min-w-[150px]">
                    <div className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[250px]" title={q.customerName}>{q.customerName}</div>
                    <div className="text-[10px] text-slate-400 hidden sm:block">{q.phone || '---'}</div>
                </div>
            </div>
          )
      },
      { 
          header: 'Ngày tạo', 
          accessorKey: 'date', 
          sortable: true, 
          width: 'w-28',
          align: 'center',
          cell: (q) => <span className="text-xs font-medium text-slate-500">{q.date}</span>
      },
      { 
          header: 'Hiệu lực', 
          accessorKey: 'validUntil', 
          width: 'w-32', 
          align: 'center', 
          cell: (q) => {
            const target = parseDate(q.validUntil);
            const now = new Date(); now.setHours(0,0,0,0);
            const isExpired = target < now;
            const isSoon = !isExpired && (target.getTime() - now.getTime()) / 86400000 <= 3;

            return (
                <div className={`text-xs font-bold ${
                    q.status === 'Accepted' || q.status === 'Rejected' ? 'text-slate-400' :
                    isExpired ? 'text-red-600' : 
                    isSoon ? 'text-orange-500' : 
                    'text-emerald-600'
                }`}>
                    {q.validUntil}
                </div>
            );
          }
      },
      { 
          header: 'Trạng thái', 
          accessorKey: 'status', 
          width: 'w-32', 
          align: 'center', 
          cell: (q) => (
              <div onClick={(e) => {e.stopPropagation(); handleQuickStatusChange(q.id, q.status === 'Draft' ? 'Sent' : q.status === 'Sent' ? 'Accepted' : 'Draft')}} className="cursor-pointer hover:opacity-80 transition-opacity" title="Click để chuyển nhanh trạng thái">
                  <StatusBadge status={q.status} entityType="Quote" />
              </div>
          )
      },
      { 
          header: 'Tổng tiền', 
          accessorKey: 'total', 
          width: 'w-40', 
          align: 'right', 
          sortable: true, 
          cell: (q) => (
            <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{formatCurrency(q.total)}</span>
          ) 
      },
      { 
          header: 'Tác vụ', 
          align: 'center', 
          width: 'w-20', 
          cell: (q) => (
          <div className="flex items-center justify-center gap-1">
              <button 
                  onClick={(e) => { e.stopPropagation(); setPrintData(q); }}
                  className="size-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-colors"
                  title="In phiếu"
              >
                  <span className="material-symbols-outlined text-[18px]">print</span>
              </button>
              <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedQuoteId(q.id); }}
                  className="size-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-center transition-colors"
                  title="Xem chi tiết"
              >
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
              </button>
          </div>
      )}
  ];

  return (
    <PageShell>
        {/* Removed PageHeader */}

        {/* 1. Mini Dashboard */}
        <div className="px-6 pt-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <QuoteStatCard 
                title="Đang chờ xử lý" 
                value={formatCurrency(stats.pendingValue)} 
                icon="pending_actions" 
                color="text-blue-600 bg-blue-500"
                subValue="Giá trị tiềm năng"
            />
            <QuoteStatCard 
                title="Tỷ lệ chốt đơn" 
                value={`${stats.conversionRate.toFixed(1)}%`} 
                icon="check_circle" 
                color="text-emerald-600 bg-emerald-500"
                subValue="Hiệu suất bán hàng"
            />
            <QuoteStatCard 
                title="Cần chú ý" 
                value={`${stats.risk} phiếu`} 
                icon="event_busy" 
                color="text-orange-600 bg-orange-500"
                subValue="Sắp hết hạn / Hết hạn"
            />
        </div>

        {/* 2. Filter Bar with Tabs */}
        <TableToolbar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Tìm mã BG, khách hàng..."
            leftFilters={
                <div className="flex gap-2 items-center overflow-x-auto no-scrollbar">
                    <DateRangeFilter 
                        startDate={dateRange.from} 
                        endDate={dateRange.to} 
                        onChange={(from, to) => setDateRange({ from, to })} 
                    />
                </div>
            }
            rightActions={
                <>
                    <Button variant="outline" icon="file_download" onClick={async () => exportToCSV(await db.quotes.toArray(), 'DanhSachBaoGia')}>Excel</Button>
                    <Button variant="primary" icon="add" onClick={handleCreate}>Tạo mới</Button>
                </>
            }
        >
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
                {(['all', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                            statusFilter === s 
                            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        {s === 'all' ? 'Tất cả' : s === 'Draft' ? 'Nháp' : s === 'Sent' ? 'Đã gửi' : s === 'Accepted' ? 'Đã chốt' : s === 'Rejected' ? 'Từ chối' : 'Hết hạn'}
                    </button>
                ))}
            </div>
        </TableToolbar>

        {/* 3. Data Table */}
        <div className="flex-1 overflow-hidden px-6 pt-4 pb-2">
            <DataTable 
                data={quotes}
                columns={columns}
                sort={{ items: sortState, onSort: requestSort }}
                emptyIcon="request_quote"
                emptyMessage="Chưa có báo giá nào"
                emptyAction={<Button variant="primary" icon="add" size="sm" onClick={handleCreate}>Tạo báo giá đầu tiên</Button>}
                onRowClick={(q) => setSelectedQuoteId(q.id)}
                isLoading={isLoading}
            />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
            <Pagination 
                currentPage={currentPage} 
                totalItems={totalItems} 
                pageSize={itemsPerPage} 
                onPageChange={setCurrentPage} 
            />
        </div>

        {/* Modals & Drawers */}
        <CreateQuoteModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setIsCreateModalOpen(false)} 
            mode={modalMode} 
            initialData={selectedQuote} 
        />
        
        <QuoteDetailDrawer 
            quote={selectedQuote}
            isOpen={!!selectedQuoteId && !isCreateModalOpen} // Only show if modal isn't opening (to prevent overlap when editing)
            onClose={() => setSelectedQuoteId(null)}
            onEdit={handleEdit}
            onConvert={handleConvertToOrder}
            onPrint={(q) => setPrintData(q)}
            onDuplicate={handleDuplicate}
            onStatusChange={handleQuickStatusChange}
            onDelete={handleDelete}
        />

        <PrintPreviewModal isOpen={!!printData} onClose={() => setPrintData(null)} data={printData} />
    </PageShell>
  );
};

export default Quotes;
