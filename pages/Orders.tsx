
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Order, ViewState, OrderStatus } from '../types';
import { parseDate, formatCurrency, toCSV, downloadTextFile, parseISOToDate, formatInputDate, getCurrentDate } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import StatusBadge from '../components/StatusBadge';
import { PrintPreviewModal } from '../components/QuoteModals';
import { CreateDeliveryModal } from '../components/DeliveryModals';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer'; 
import { useDexieTable, SortItem } from '../hooks/useDexieTable';
import { db } from '../services/db';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';
import { ActionMenu } from '../components/ui/ActionMenu';
import { SavedViews } from '../components/table/SavedViews';
import { DebtPayDrawer } from '../components/debts/DebtPayDrawer';
import { useLiveQuery } from 'dexie-react-hooks';

// --- SUB-COMPONENTS (COMPACT VERSION) ---

const OrderStatCard = ({ title, value, icon, color, subValue }: any) => (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 transition-all hover:shadow-md">
        <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${color} bg-opacity-10 text-opacity-100`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{title}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none">{value}</h3>
                {subValue && <span className="text-[10px] font-medium text-slate-400 truncate hidden xl:inline-block">{subValue}</span>}
            </div>
        </div>
    </div>
);

type PaymentFilterType = 'all' | 'paid' | 'unpaid' | 'partial';

interface OrdersViewState {
    filterStatus: OrderStatus | 'all';
    dateRange: { from: string; to: string };
    paymentFilter: PaymentFilterType;
    searchTerm: string;
    sortState: SortItem[];
}

const Orders: React.FC<{ onNavigate?: (view: ViewState, params?: any) => void; initialParams?: any }> = ({ onNavigate }) => {
  const { updateOrderStatus, deleteOrder, confirm, deliveryNotes, returnNotes, lockDocument, finalizeOrderWithDelivery, showNotification } = useAppContext();
  
  // Router Hooks
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');

  // --- STATE ---
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [fetchedOrder, setFetchedOrder] = useState<Order | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  
  // Modals
  const [printData, setPrintData] = useState<any | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryOrderTarget, setDeliveryOrderTarget] = useState<string | undefined>(undefined);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [targetDebtId, setTargetDebtId] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterType>('all');
  
  const [showArchived, setShowArchived] = useState(false);
  const itemsPerPage = 15;

  // Handle URL Params
  useEffect(() => {
      const loadFromUrl = async () => {
          if (code) {
              const order = await db.orders.where('code').equals(code).first();
              if (order) {
                  setSelectedOrderId(order.id);
                  setFetchedOrder(order);
              }
          } else if (highlightId) {
              setSelectedOrderId(highlightId);
          }
      };
      loadFromUrl();
  }, [code, highlightId]);

  useEffect(() => { 
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300); 
    return () => clearTimeout(timer); 
  }, [searchTerm]);

  // --- STATS (Optimized) ---
  const stats = useLiveQuery(async () => {
      const todayStr = getCurrentDate();
      
      // Execute queries in parallel for better performance
      const [todayOrders, pendingCount, shippingCount, unpaidOrders] = await Promise.all([
          // Revenue: Fetch only today's orders
          db.orders.where('date').equals(todayStr).filter(o => !o.isDeleted && o.status !== 'Cancelled').toArray(),
          // Pending Count: Use count() directly
          db.orders.where('status').equals('PendingPayment').filter(o => !o.isDeleted).count(),
          // Shipping Count: Use count() directly
          db.orders.where('status').anyOf('Processing', 'Shipping').filter(o => !o.isDeleted).count(),
          // Unpaid Total: Filter iteratively (expensive but optimized to not hold object references if we used each(), but here toArray is fine for debt subset)
          db.orders.filter(o => !o.isDeleted && o.status !== 'Cancelled' && (o.amountPaid < o.total)).toArray()
      ]);

      const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
      const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + Math.max(0, o.total - o.amountPaid), 0);

      return { todayRevenue, pendingCount, shippingCount, unpaidTotal };
  }, []) || { todayRevenue: 0, pendingCount: 0, shippingCount: 0, unpaidTotal: 0 };

  // Status counts for tabs (Live)
  const statusCounts = useLiveQuery(async () => {
      const counts: Record<string, number> = {};
      await db.orders.filter(o => !o.isDeleted).each(o => {
          counts[o.status] = (counts[o.status] || 0) + 1;
      });
      return counts;
  }, []) || {};

  // --- FILTER LOGIC ---
  const filterFn = useMemo(() => (order: Order) => {
      // 1. Search
      if (debouncedSearch) {
          const lower = debouncedSearch.toLowerCase();
          if (!order.code.toLowerCase().includes(lower) && 
              !order.customerName.toLowerCase().includes(lower) &&
              !order.phone.includes(lower)) return false;
      }
      // 2. Status
      if (filterStatus !== 'all' && order.status !== filterStatus) return false;
      // 3. Payment
      if (paymentFilter !== 'all') {
          const isPaid = order.amountPaid >= order.total;
          const isUnpaid = order.amountPaid === 0;
          if (paymentFilter === 'paid' && !isPaid) return false;
          if (paymentFilter === 'unpaid' && !isUnpaid) return false;
          if (paymentFilter === 'partial' && (isPaid || isUnpaid)) return false;
      }
      // 4. Date Range
      if (dateRange.from || dateRange.to) {
          const d = parseDate(order.date);
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
  }, [debouncedSearch, filterStatus, paymentFilter, dateRange]);

  const { data: orders, totalItems, currentPage, setCurrentPage, sortState, setSortState, requestSort, isLoading } = useDexieTable<Order>({
      table: db.orders, itemsPerPage, filterFn, defaultSort: 'createdAt', includeDeleted: showArchived
  });

  // --- VIEW STATE MANAGEMENT ---
  const currentViewState: OrdersViewState = {
      filterStatus, dateRange, paymentFilter, searchTerm, sortState
  };

  const handleApplyView = (state: OrdersViewState) => {
      setFilterStatus(state.filterStatus);
      setDateRange(state.dateRange);
      setPaymentFilter(state.paymentFilter);
      setSearchTerm(state.searchTerm);
      if (state.sortState) setSortState(state.sortState);
  };

  const handleClearView = () => {
      setFilterStatus('all');
      setDateRange({ from: '', to: '' });
      setPaymentFilter('all');
      setSearchTerm('');
      setSortState([{ key: 'createdAt', direction: 'desc' }]);
  };

  const handleExportCSV = async () => {
      const allOrders = await db.orders.toArray();
      const filtered = allOrders.filter(o => !o.isDeleted || showArchived).filter(filterFn);
      
      const exportData = filtered.map(o => ({
          code: o.code, date: o.date, customer: o.customerName, phone: o.phone,
          total: o.total, amountPaid: o.amountPaid, remaining: o.total - o.amountPaid, status: o.status
      }));
      const headers = [
          { key: 'code', label: 'Mã đơn' }, { key: 'date', label: 'Ngày' },
          { key: 'customer', label: 'Khách hàng' }, { key: 'phone', label: 'SĐT' },
          { key: 'total', label: 'Tổng tiền' }, { key: 'amountPaid', label: 'Đã thanh toán' },
          { key: 'status', label: 'Trạng thái' }
      ];
      downloadTextFile(`DonHang_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(exportData, headers));
  };

  // Fallback Fetch
  useEffect(() => {
    if (selectedOrderId) {
        const inList = orders.find(o => o.id === selectedOrderId);
        if (inList) { setFetchedOrder(null); } 
        else if (!fetchedOrder || fetchedOrder.id !== selectedOrderId) {
            db.orders.get(selectedOrderId).then(o => { if (o) setFetchedOrder(o); });
        }
    } else { setFetchedOrder(null); }
  }, [selectedOrderId, orders, fetchedOrder]);

  const selectedOrder = useMemo(() => {
      if (!selectedOrderId) return null;
      return orders.find(o => o.id === selectedOrderId) || fetchedOrder;
  }, [orders, selectedOrderId, fetchedOrder]);

  const isDrawerLoading = !!selectedOrderId && !selectedOrder;

  // --- ACTIONS ---
  const handleQuickAction = async (id: string, action: OrderStatus) => {
      if (action === 'Cancelled') {
          const ok = await confirm({ title: 'Hủy đơn hàng?', message: 'Hành động này sẽ hủy đơn hàng và hoàn trả tồn kho. Bạn có chắc chắn không?', type: 'danger', confirmLabel: 'Xác nhận Hủy' });
          if (!ok) return;
      }
      await updateOrderStatus(id, action);
      if (fetchedOrder && fetchedOrder.id === id) setFetchedOrder({ ...fetchedOrder, status: action });
  };

  const handleDelete = async (id: string) => {
      const ok = await confirm({ title: 'Xóa đơn hàng?', message: 'Đơn hàng sẽ bị hủy và tồn kho sẽ được hoàn trả. Không thể hoàn tác.', type: 'danger' });
      if (ok) await deleteOrder(id);
  };

  const handleDelivery = (id: string) => {
      setDeliveryOrderTarget(id);
      setIsDeliveryModalOpen(true);
  };

  const handleQuickDelivery = async (order: Order) => {
      const ok = await confirm({
          title: 'Giao hàng nhanh?',
          message: 'Tạo phiếu giao hàng cho toàn bộ sản phẩm và chuyển trạng thái sang "Vận chuyển".',
          confirmLabel: 'Giao ngay',
          type: 'info'
      });
      if (!ok) return;

      try {
          await finalizeOrderWithDelivery(order.id, {
              code: `PGH-${Date.now().toString().slice(-6)}`,
              date: formatInputDate(new Date().toISOString().slice(0, 10)),
              customerName: order.customerName,
              address: '',
              shipperName: '',
              shipperPhone: '',
              notes: 'Giao nhanh từ đơn hàng',
              items: order.items,
              status: 'Shipping',
              orderCode: order.code
          });
          showNotification('Đã tạo phiếu giao hàng nhanh', 'success');
      } catch (e) {
          showNotification('Lỗi khi tạo phiếu giao', 'error');
      }
  };

  const handlePaymentClick = async (order: Order) => {
      const debt = await db.debtRecords.where({ orderCode: order.code }).first();
      if (debt) {
          setTargetDebtId(debt.id);
          setIsPaymentDrawerOpen(true);
      } else {
          showNotification('Đơn hàng này không có công nợ ghi nhận (Thanh toán ngay hoặc chưa tạo nợ).', 'info');
      }
  };

  const handleLockOrder = async () => {
      if (!selectedOrderId) return;
      const ok = await confirm({ title: 'Khóa đơn hàng?', message: 'Đơn hàng sẽ bị khóa và không thể chỉnh sửa thông tin.', type: 'warning', confirmLabel: 'Khóa ngay' });
      if (ok) await lockDocument('Order', selectedOrderId);
  };

  // Bulk Actions
  const handleBulkPrint = () => {
      showNotification(`Đang chuẩn bị in ${selectedRowIds.size} đơn hàng...`, 'info');
      setSelectedRowIds(new Set());
  };

  const handleBulkStatus = async (status: OrderStatus) => {
      const ok = await confirm({ title: 'Cập nhật hàng loạt?', message: `Chuyển ${selectedRowIds.size} đơn hàng sang trạng thái "${status}"?`, type: 'info' });
      if (!ok) return;
      
      const ids = Array.from(selectedRowIds);
      for (const id of ids) {
          await updateOrderStatus(id, status);
      }
      setSelectedRowIds(new Set());
      showNotification('Đã cập nhật trạng thái', 'success');
  };

  // --- COLUMNS ---
  const columns: ColumnDef<Order>[] = [
      { 
          header: 'Mã đơn', 
          accessorKey: 'code', 
          sortable: true, 
          width: 'w-32', 
          cell: (o) => (
            <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">{o.code}</span>
          )
      },
      {
          header: 'Ngày lập',
          accessorKey: 'date',
          sortable: true,
          width: 'w-28',
          cell: (o) => <span className="text-xs text-slate-500 font-medium">{o.date}</span>
      },
      { 
          header: 'Khách hàng', 
          accessorKey: 'customerName', 
          sortable: true, 
          cell: (o) => (
            <div className="flex items-center gap-3">
                <div className={`size-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm shrink-0 uppercase ${
                    ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500'][o.customerName.charCodeAt(0) % 5]
                }`}>
                    {o.customerName.charAt(0)}
                </div>
                <div className="min-w-[150px]">
                    <div className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[200px]" title={o.customerName}>{o.customerName}</div>
                    <div className="text-[10px] text-slate-400 hidden sm:block">{o.phone}</div>
                </div>
            </div>
          )
      },
      { 
          header: 'Quy trình', 
          accessorKey: 'status', 
          align: 'center', 
          width: 'w-32', 
          cell: (o) => <StatusBadge status={o.status} entityType="Order" /> 
      },
      { 
          header: 'Thanh toán', 
          align: 'center', 
          width: 'w-32', 
          cell: (o) => {
            const isPaid = o.amountPaid >= o.total;
            const isUnpaid = o.amountPaid === 0;
            const isPartial = !isPaid && !isUnpaid;
            
            return (
                <div 
                    onClick={(e) => { e.stopPropagation(); if(!isPaid) handlePaymentClick(o); }} 
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${
                        isPaid ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                        isUnpaid ? 'bg-red-50 border-red-100 text-red-700 cursor-pointer hover:bg-red-100' :
                        'bg-amber-50 border-amber-100 text-amber-700 cursor-pointer hover:bg-amber-100'
                    }`}
                >
                    <span className={`size-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : isUnpaid ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                    <span className="text-[10px] font-bold uppercase">{isPaid ? 'Đã trả' : isUnpaid ? 'Chưa trả' : 'Một phần'}</span>
                </div>
            );
          }
      },
      { 
          header: 'Tổng tiền', 
          accessorKey: 'total', 
          align: 'right', 
          width: 'w-36', 
          sortable: true, 
          cell: (o) => (
            <div className="flex flex-col items-end">
                <span className="font-black text-slate-900 dark:text-white text-sm">{formatCurrency(o.total)}</span>
                {o.amountPaid > 0 && o.amountPaid < o.total && (
                    <span className="text-[9px] text-slate-400">Còn: {formatCurrency(o.total - o.amountPaid)}</span>
                )}
            </div>
          ) 
      },
      { 
          header: 'Tác vụ', 
          align: 'center', 
          width: 'w-24', 
          cell: (o) => (
            <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                {/* Quick Print */}
                <button 
                    onClick={(e) => { e.stopPropagation(); setPrintData(o); }}
                    className="size-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-colors"
                    title="In phiếu"
                >
                    <span className="material-symbols-outlined text-[18px]">print</span>
                </button>

                {/* Quick Delivery */}
                {(o.status === 'Processing' || o.status === 'PendingPayment') && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleQuickDelivery(o); }}
                        className="size-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-center transition-colors"
                        title="Giao nhanh"
                    >
                        <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                    </button>
                )}

                <ActionMenu items={[
                    { label: 'Chi tiết', icon: 'visibility', onClick: () => setSelectedOrderId(o.id) },
                    { label: 'Hủy đơn', icon: 'block', onClick: () => handleQuickAction(o.id, 'Cancelled'), danger: true, disabled: o.status === 'Cancelled' || o.status === 'Completed' },
                    { label: 'Xóa', icon: 'delete', onClick: () => handleDelete(o.id), danger: true }
                ]} />
            </div>
          )
      }
  ];

  return (
    <PageShell className="h-full">
        {/* Removed PageHeader */}
        
        {/* 1. KPI Dashboard (COMPACT VERSION) */}
        <div className="px-6 pt-6 pb-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <OrderStatCard 
                title="Doanh thu hôm nay" 
                value={formatCurrency(stats.todayRevenue)} 
                icon="payments" 
                color="text-blue-600 bg-blue-500"
            />
            <OrderStatCard 
                title="Chờ xử lý" 
                value={stats.pendingCount} 
                icon="hourglass_empty" 
                color="text-orange-600 bg-orange-500"
                subValue="Đơn chưa duyệt"
            />
            <OrderStatCard 
                title="Cần giao hàng" 
                value={stats.shippingCount} 
                icon="local_shipping" 
                color="text-indigo-600 bg-indigo-500"
                subValue="Đang giao"
            />
            <OrderStatCard 
                title="Chưa thanh toán" 
                value={formatCurrency(stats.unpaidTotal)} 
                icon="money_off" 
                color="text-red-600 bg-red-500"
                subValue="Công nợ"
            />
        </div>

        {/* Scrollable Container for Table */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 pb-0 max-w-[1920px] mx-auto w-full">
            <TableToolbar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="Tìm mã đơn, khách..."
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
                        <SavedViews 
                            pageKey="orders"
                            currentState={currentViewState}
                            onApply={handleApplyView}
                            onClear={handleClearView}
                        />
                        <Button variant="outline" icon="file_download" onClick={handleExportCSV} className="hidden sm:flex">Export</Button>
                        <Button variant="primary" icon="add" onClick={() => onNavigate && onNavigate('POS')}>Bán hàng</Button>
                    </>
                }
            >
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
                    {(['all', 'PendingPayment', 'Processing', 'Shipping', 'Completed', 'Cancelled'] as const).map(s => {
                        const count = s === 'all' ? 0 : statusCounts[s] || 0;
                        return (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 ${
                                    filterStatus === s 
                                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                }`}
                            >
                                {s === 'all' ? 'Tất cả' : s === 'PendingPayment' ? 'Chờ duyệt' : s === 'Processing' ? 'Đang xử lý' : s === 'Shipping' ? 'Vận chuyển' : s === 'Completed' ? 'Hoàn thành' : 'Đã hủy'}
                                {s !== 'all' && count > 0 && <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-[9px]">{count}</span>}
                            </button>
                        );
                    })}
                </div>
            </TableToolbar>

            {/* This div grows to fill space and allows internal scrolling */}
            <div className="flex-1 min-h-0 overflow-hidden mt-4 relative">
                <DataTable 
                    data={orders}
                    columns={columns}
                    sort={{ items: sortState, onSort: requestSort }}
                    selection={{
                        selectedIds: selectedRowIds,
                        onSelectAll: (checked) => {
                            if (checked) setSelectedRowIds(new Set(orders.map(o => o.id)));
                            else setSelectedRowIds(new Set());
                        },
                        onSelectRow: (id) => {
                            const newSet = new Set(selectedRowIds);
                            if (newSet.has(id)) newSet.delete(id);
                            else newSet.add(id);
                            setSelectedRowIds(newSet);
                        }
                    }}
                    emptyIcon="receipt_long"
                    emptyMessage="Chưa có đơn hàng nào"
                    emptyAction={<Button variant="primary" icon="add" size="sm" onClick={() => onNavigate && onNavigate('POS')}>Bán hàng ngay</Button>}
                    onRowClick={(o) => setSelectedOrderId(o.id)}
                    isLoading={isLoading}
                />

                {/* Bulk Actions Floating Bar */}
                {selectedRowIds.size > 0 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-6 animate-fadeIn z-50">
                        <span className="font-bold text-sm whitespace-nowrap">{selectedRowIds.size} đã chọn</span>
                        <div className="h-4 w-px bg-slate-700"></div>
                        <button onClick={handleBulkPrint} className="flex items-center gap-2 hover:text-blue-400 transition-colors text-sm font-medium">
                            <span className="material-symbols-outlined text-[18px]">print</span> In phiếu
                        </button>
                        <button onClick={() => handleBulkStatus('Processing')} className="flex items-center gap-2 hover:text-indigo-400 transition-colors text-sm font-medium">
                            <span className="material-symbols-outlined text-[18px]">check_box</span> Duyệt đơn
                        </button>
                        <button onClick={() => handleBulkStatus('Completed')} className="flex items-center gap-2 hover:text-emerald-400 transition-colors text-sm font-medium">
                            <span className="material-symbols-outlined text-[18px]">done_all</span> Hoàn tất
                        </button>
                        <div className="h-4 w-px bg-slate-700"></div>
                        <button onClick={() => setSelectedRowIds(new Set())} className="hover:text-red-400 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={itemsPerPage} onPageChange={setCurrentPage} />
            </div>
        </div>

        <OrderDetailDrawer 
            isOpen={!!selectedOrderId}
            isLoading={isDrawerLoading}
            onClose={() => setSelectedOrderId(null)}
            order={selectedOrder}
            onPrint={() => selectedOrder && setPrintData(selectedOrder)}
            onDelivery={() => selectedOrder && handleDelivery(selectedOrder.id)}
            onPayment={handlePaymentClick}
            onReturn={() => setIsReturnModalOpen(true)}
            onAction={handleQuickAction}
            onDelete={handleDelete}
            onLock={handleLockOrder}
            relatedDeliveries={deliveryNotes.filter(n => n.orderCode === selectedOrder?.code)}
            relatedReturns={returnNotes.filter(n => n.orderCode === selectedOrder?.code)}
        />

        <PrintPreviewModal isOpen={!!printData} onClose={() => setPrintData(null)} data={printData} />
        <CreateDeliveryModal isOpen={isDeliveryModalOpen} onClose={() => setIsDeliveryModalOpen(false)} initialOrderId={deliveryOrderTarget} />
        <DebtPayDrawer isOpen={isPaymentDrawerOpen} onClose={() => setIsPaymentDrawerOpen(false)} debtId={targetDebtId} />
    </PageShell>
  );
};

export default Orders;
