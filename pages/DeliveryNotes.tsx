
import React, { useState, useMemo, useEffect } from 'react';
import { DeliveryNote, DeliveryStatus } from '../types';
import { exportToCSV, parseDate, formatCurrency, parseISOToDate, getCurrentDate } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import StatusBadge from '../components/StatusBadge';
import { CreateDeliveryModal, PrintDeliveryModal } from '../components/DeliveryModals';
import { useDexieTable } from '../hooks/useDexieTable';
import { db } from '../services/db';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { FilterChip } from '../components/ui/FilterBar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import { ActionMenu } from '../components/ui/ActionMenu';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';
import { useLiveQuery } from 'dexie-react-hooks';

// --- KANBAN CARD COMPONENT ---
interface DeliveryCardProps {
    note: DeliveryNote;
    onClick: () => void;
    onAction: (id: string, status: DeliveryStatus) => void;
}

const DeliveryCard: React.FC<DeliveryCardProps> = ({ note, onClick, onAction }) => {
    return (
        <div 
            onClick={onClick}
            className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md cursor-pointer group transition-all"
        >
            <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{note.code}</span>
                <span className="text-[10px] text-slate-400">{note.date}</span>
            </div>
            <div className="mb-3">
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate" title={note.customerName}>{note.customerName}</p>
                <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(note.address || '')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5 truncate"
                >
                    <span className="material-symbols-outlined text-[12px]">location_on</span>
                    {note.address || 'Tại cửa hàng'}
                </a>
            </div>
            
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-2">
                <div className="flex items-center gap-2">
                    {note.shipperName ? (
                        <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                            <span className="material-symbols-outlined text-[14px] text-indigo-600">person</span>
                            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 max-w-[80px] truncate">{note.shipperName}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] italic text-slate-400">Chưa gán Shipper</span>
                    )}
                </div>

                {/* Quick Action Button based on Status */}
                {note.status === 'Pending' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAction(note.id, 'Shipping'); }}
                        className="size-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
                        title="Bắt đầu giao"
                    >
                        <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    </button>
                )}
                {note.status === 'Shipping' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAction(note.id, 'Delivered'); }}
                        className="size-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                        title="Xác nhận đã giao"
                    >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                )}
            </div>
        </div>
    );
};

const DeliveryNotes: React.FC<{ initialParams?: any }> = ({ initialParams }) => {
  const { updateDeliveryNoteStatus, deleteDeliveryNote, confirm, showNotification } = useAppContext();
  
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [fetchedNote, setFetchedNote] = useState<DeliveryNote | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [printData, setPrintData] = useState<DeliveryNote | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [shipperFilter, setShipperFilter] = useState<string>('all');

  // Handle Initial Params
  useEffect(() => {
      if (initialParams?.highlightId) {
          setSelectedNoteId(initialParams.highlightId);
      }
  }, [initialParams]);

  // Debounce Search
  useEffect(() => { 
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300); 
    return () => clearTimeout(timer); 
  }, [searchTerm]);

  // --- DATA ---
  const allNotes = useLiveQuery(() => db.deliveryNotes.filter(n => !n.isDeleted).toArray()) || [];

  const stats = useMemo(() => {
      const todayStr = getCurrentDate();
      const pending = allNotes.filter(n => n.status === 'Pending').length;
      const shipping = allNotes.filter(n => n.status === 'Shipping').length;
      const deliveredToday = allNotes.filter(n => n.status === 'Delivered' && n.date === todayStr).length;
      return { pending, shipping, deliveredToday };
  }, [allNotes]);

  const shippers = useMemo(() => {
      const names = new Set<string>();
      allNotes.forEach(n => { if (n.shipperName) names.add(n.shipperName); });
      return Array.from(names).sort();
  }, [allNotes]);

  // --- FILTER LOGIC ---
  const filterFn = useMemo(() => (note: DeliveryNote) => {
      if (debouncedSearch) { 
        const searchLower = debouncedSearch.toLowerCase(); 
        if (!note.code.toLowerCase().includes(searchLower) && 
            !note.orderCode.toLowerCase().includes(searchLower) && 
            !note.customerName.toLowerCase().includes(searchLower) &&
            !(note.shipperName && note.shipperName.toLowerCase().includes(searchLower))) return false; 
      }
      if (statusFilter !== 'all' && note.status !== statusFilter) return false;
      if (shipperFilter !== 'all') {
          if (shipperFilter === 'unassigned') { if (note.shipperName) return false; } 
          else { if (note.shipperName !== shipperFilter) return false; }
      }
      if (dateRange.from || dateRange.to) {
          const dDate = parseDate(note.date);
          if (dateRange.from) {
              const fromDate = parseISOToDate(dateRange.from);
              if (fromDate && dDate < fromDate) return false;
          }
          if (dateRange.to) {
              const toDate = parseISOToDate(dateRange.to);
              if (toDate) {
                  toDate.setHours(23, 59, 59, 999);
                  if (dDate > toDate) return false;
              }
          }
      }
      return true;
  }, [debouncedSearch, statusFilter, dateRange, shipperFilter]);

  const { data: filteredNotes, totalItems, currentPage, setCurrentPage, sortState, requestSort, isLoading } = useDexieTable<DeliveryNote>({ 
    table: db.deliveryNotes, itemsPerPage: 200, filterFn, defaultSort: 'createdAt' // Increase items per page for Board view
  });

  // Kanban Buckets
  const kanbanData = useMemo(() => {
      if (viewMode !== 'board') return null;
      return {
          pending: filteredNotes.filter(n => n.status === 'Pending'),
          shipping: filteredNotes.filter(n => n.status === 'Shipping'),
          completed: filteredNotes.filter(n => n.status === 'Delivered' || n.status === 'Cancelled')
      };
  }, [filteredNotes, viewMode]);

  // Fallback Fetch
  useEffect(() => {
    if (selectedNoteId) {
        const inList = filteredNotes.find(n => n.id === selectedNoteId);
        if (inList) setFetchedNote(null);
        else if (!fetchedNote || fetchedNote.id !== selectedNoteId) db.deliveryNotes.get(selectedNoteId).then(n => { if (n) setFetchedNote(n); });
    } else { setFetchedNote(null); }
  }, [selectedNoteId, filteredNotes, fetchedNote]);

  const selectedNote = useMemo(() => {
      if (!selectedNoteId) return null;
      return filteredNotes.find(n => n.id === selectedNoteId) || fetchedNote;
  }, [filteredNotes, selectedNoteId, fetchedNote]);

  // --- ACTIONS ---
  const handleResetFilters = () => {
      setSearchTerm(''); setStatusFilter('all'); setDateRange({ from: '', to: '' }); setShipperFilter('all');
  };

  const handleDelete = async (id: string) => {
      const ok = await confirm({ title: 'Xóa phiếu giao?', message: 'Hành động này chỉ xóa phiếu khỏi danh sách, không ảnh hưởng tồn kho.', type: 'danger' });
      if (ok) {
          await deleteDeliveryNote(id);
          if (selectedNoteId === id) setSelectedNoteId(null);
      }
  };

  const handleStatusChange = async (id: string, newStatus: DeliveryStatus) => {
      if (newStatus === 'Cancelled') {
          const ok = await confirm({ title: 'Hủy vận chuyển?', message: 'Đơn hàng liên quan sẽ được chuyển về trạng thái "Đang xử lý".', type: 'warning' });
          if (!ok) return;
      }
      await updateDeliveryNoteStatus(id, newStatus);
      if (fetchedNote && fetchedNote.id === id) setFetchedNote({...fetchedNote, status: newStatus});
  };

  // Bulk Actions
  const handleBulkStatus = async (status: DeliveryStatus) => {
      const ok = await confirm({ title: 'Cập nhật hàng loạt?', message: `Chuyển ${selectedRowIds.size} phiếu sang trạng thái "${status}"?`, type: 'info' });
      if (!ok) return;
      
      const ids = Array.from(selectedRowIds);
      for (const id of ids) {
          await updateDeliveryNoteStatus(id, status);
      }
      setSelectedRowIds(new Set());
      showNotification(`Đã cập nhật ${ids.length} phiếu`, 'success');
  };

  // --- DRAWER ---
  const NoteDetailDrawer = () => {
    if (!selectedNote) return null;

    // Visual Timeline Calculation
    const steps = [
        { label: 'Đã tạo', completed: true, icon: 'receipt_long' },
        { label: 'Đang giao', completed: selectedNote.status === 'Shipping' || selectedNote.status === 'Delivered', icon: 'local_shipping' },
        { label: 'Hoàn tất', completed: selectedNote.status === 'Delivered', icon: 'check_circle' }
    ];
    if (selectedNote.status === 'Cancelled') steps[2] = { label: 'Đã hủy', completed: true, icon: 'cancel' };

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedNoteId(null); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    return (
      <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/20 backdrop-blur-sm" onClick={() => setSelectedNoteId(null)}>
          <div className="h-full w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-[slideInRight_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
              
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900 sticky top-0 z-20">
                  <div>
                      <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{selectedNote.code}</h2>
                          <StatusBadge status={selectedNote.status} entityType="Delivery" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px]">receipt_long</span> 
                          Đơn gốc: <span className="font-bold text-blue-600 font-mono">{selectedNote.orderCode}</span>
                      </p>
                  </div>
                  <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setPrintData(selectedNote)} icon="print" title="In phiếu" />
                      <Button variant="ghost" size="sm" onClick={() => setSelectedNoteId(null)} icon="close" className="rounded-full size-8 p-0" />
                  </div>
              </div>

              {/* Stepper Timeline */}
              <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between relative">
                      <div className="absolute left-0 top-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-10"></div>
                      {steps.map((step, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-900 px-2">
                              <div className={`size-8 rounded-full flex items-center justify-center transition-colors ${step.completed ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                  <span className="material-symbols-outlined text-[16px]">{step.icon}</span>
                              </div>
                              <span className={`text-[10px] font-bold uppercase ${step.completed ? 'text-blue-600' : 'text-slate-400'}`}>{step.label}</span>
                          </div>
                      ))}
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {/* Customer Info */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px]">person_pin_circle</span> Nơi giao hàng
                          </h4>
                          <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-600 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-500">{selectedNote.date}</span>
                      </div>
                      <div className="p-4">
                          <p className="font-bold text-slate-900 dark:text-white text-base">{selectedNote.customerName}</p>
                          <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedNote.address || '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-sm text-blue-600 hover:underline mt-1 flex items-start gap-2"
                          >
                              <span className="material-symbols-outlined text-[16px]">location_on</span>
                              {selectedNote.address || 'Tại cửa hàng'}
                          </a>
                          {selectedNote.notes && (
                              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-100 dark:border-yellow-900/30 text-xs text-yellow-800 dark:text-yellow-500 italic">
                                  <span className="font-bold not-italic">Ghi chú:</span> {selectedNote.notes}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Shipper Info */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">local_shipping</span> Người vận chuyển
                            </h4>
                        </div>
                        <div className="p-4 flex items-center gap-4">
                            <div className="size-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <span className="font-black text-lg">{selectedNote.shipperName ? selectedNote.shipperName.charAt(0).toUpperCase() : '?'}</span>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{selectedNote.shipperName || 'Chưa phân công'}</p>
                                <p className="text-xs text-slate-500 font-mono">{selectedNote.shipperPhone || '---'}</p>
                            </div>
                        </div>
                  </div>

                  {/* Items List */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px]">inventory_2</span> Hàng hóa bàn giao
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400">{selectedNote.items.length} mặt hàng</span>
                      </div>
                      <table className="w-full text-sm text-left">
                          <thead className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700">
                              <tr>
                                  <th className="px-4 py-2">Sản phẩm</th>
                                  <th className="px-4 py-2 text-center w-20">SL</th>
                                  <th className="px-4 py-2 text-center w-20">ĐVT</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {selectedNote.items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                      <td className="px-4 py-3">
                                          <div className="font-bold text-slate-800 dark:text-slate-200">{item.productName}</div>
                                          <div className="text-[10px] font-mono text-slate-500">{item.sku}</div>
                                      </td>
                                      <td className="px-4 py-3 text-center font-bold text-blue-600">{item.quantity}</td>
                                      <td className="px-4 py-3 text-center text-slate-500 text-xs">{item.unit}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                  {selectedNote.status === 'Pending' && (
                      <Button variant="primary" className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-blue-500/20" icon="local_shipping" onClick={() => handleStatusChange(selectedNote.id, 'Shipping')}>
                          Bắt đầu giao hàng
                      </Button>
                  )}
                  {selectedNote.status === 'Shipping' && (
                      <Button variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" icon="check_circle" onClick={() => handleStatusChange(selectedNote.id, 'Delivered')}>
                          Xác nhận đã giao
                      </Button>
                  )}
                  
                  {selectedNote.status !== 'Delivered' && selectedNote.status !== 'Cancelled' && (
                      <Button variant="danger" className="w-12 bg-red-50 text-red-600 border-red-100 hover:bg-red-100 dark:bg-red-900/10 dark:border-red-900/30" icon="cancel" onClick={() => handleStatusChange(selectedNote.id, 'Cancelled')} title="Hủy phiếu" />
                  )}
                  
                  {selectedNote.status === 'Cancelled' && (
                      <Button variant="danger" className="flex-1" icon="delete" onClick={() => handleDelete(selectedNote.id)}>Xóa vĩnh viễn</Button>
                  )}
                  
                  {selectedNote.status === 'Delivered' && (
                      <Button variant="secondary" className="flex-1" disabled>Đã hoàn thành</Button>
                  )}
              </div>
          </div>
      </div>
    );
  };

  const columns: ColumnDef<DeliveryNote>[] = [
    { header: 'Mã phiếu', accessorKey: 'code', sortable: true, width: 'w-28', cell: (n) => <span className="font-mono font-bold text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">{n.code}</span> },
    { header: 'Khách hàng', accessorKey: 'customerName', sortable: true, cell: (n) => (
        <div className="min-w-[150px]">
            <div className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[200px]" title={n.customerName}>{n.customerName}</div>
            <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(n.address || '')}`} 
                target="_blank" 
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-blue-500 hover:underline truncate max-w-[200px] flex items-center gap-1"
            >
                {n.address || 'Tại cửa hàng'}
            </a>
        </div>
    )},
    { header: 'Ngày giao', accessorKey: 'date', sortable: true, width: 'w-32', align: 'center', cell: (n) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{n.date}</span> },
    { header: 'Shipper', accessorKey: 'shipperName', width: 'w-36', cell: (n) => (
        n.shipperName ? (
            <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                    {n.shipperName.charAt(0)}
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{n.shipperName}</span>
            </div>
        ) : (
            <span className="text-[10px] italic text-slate-400">Chưa gán</span>
        )
    )},
    { header: 'Trạng thái', accessorKey: 'status', align: 'center', width: 'w-32', cell: (n) => <StatusBadge status={n.status} entityType="Delivery" /> },
    { header: 'Tác vụ', align: 'center', width: 'w-24', cell: (n) => (
        <div className="flex items-center justify-center gap-1">
            <button 
                onClick={(e) => { e.stopPropagation(); setPrintData(n); }}
                className="size-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-colors"
                title="In phiếu"
            >
                <span className="material-symbols-outlined text-[18px]">print</span>
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); setSelectedNoteId(n.id); }}
                className="size-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-center transition-colors"
                title="Chi tiết"
            >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
        </div>
    )}
  ];

  return (
    <PageShell>
      {/* Removed PageHeader */}

      {/* Quick Stats */}
      <div className="px-6 pt-6 pb-2 grid grid-cols-3 gap-4">
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl flex items-center gap-3">
              <div className="size-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-orange-600 shadow-sm">
                  <span className="material-symbols-outlined">hourglass_top</span>
              </div>
              <div>
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Chờ giao hàng</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{stats.pending}</p>
              </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl flex items-center gap-3">
              <div className="size-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 shadow-sm">
                  <span className="material-symbols-outlined">local_shipping</span>
              </div>
              <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Đang vận chuyển</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{stats.shipping}</p>
              </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl flex items-center gap-3">
              <div className="size-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-600 shadow-sm">
                  <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Giao xong hôm nay</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{stats.deliveredToday}</p>
              </div>
          </div>
      </div>

      <TableToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Mã phiếu, đơn hàng, khách..."
        leftFilters={
            <div className="flex gap-3 flex-1 w-full lg:w-auto items-center overflow-x-auto no-scrollbar">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px]">
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-400'}`} title="Danh sách"><span className="material-symbols-outlined text-[18px]">list</span></button>
                    <button onClick={() => setViewMode('board')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'board' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-400'}`} title="Bảng Kanban"><span className="material-symbols-outlined text-[18px]">view_kanban</span></button>
                </div>

                <DateRangeFilter 
                    startDate={dateRange.from} 
                    endDate={dateRange.to} 
                    onChange={(from, to) => setDateRange({ from, to })} 
                />

                <select 
                    value={shipperFilter}
                    onChange={e => setShipperFilter(e.target.value)}
                    className="h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold px-3 outline-none focus:border-blue-500 cursor-pointer min-w-[150px]"
                >
                    <option value="all">Tất cả Shipper</option>
                    <option value="unassigned">Chưa gán</option>
                    {shippers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {(searchTerm || statusFilter !== 'all' || dateRange.from || shipperFilter !== 'all') && (
                    <button 
                        onClick={handleResetFilters}
                        className="h-[38px] px-3 rounded-xl border border-red-100 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:hover:bg-red-900/40 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                        Reset
                    </button>
                )}
            </div>
        }
        rightActions={
            <div className="flex gap-2">
                <Button variant="outline" icon="file_download" onClick={async () => exportToCSV(await db.deliveryNotes.toArray(), 'DSPhieuGiao')}>Excel</Button>
                <Button variant="primary" icon="add" onClick={() => setIsCreateModalOpen(true)}>Tạo Phiếu</Button>
            </div>
        }
      >
        {(['all', 'Pending', 'Shipping', 'Delivered', 'Cancelled'] as const).map(status => (
          <FilterChip 
            key={status}
            label={status === 'all' ? 'Tất cả' : status === 'Pending' ? 'Chờ giao' : status === 'Shipping' ? 'Đang giao' : status === 'Delivered' ? 'Đã giao' : 'Đã hủy'}
            isActive={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          />
        ))}
      </TableToolbar>

      {/* Main Content: List or Board */}
      {viewMode === 'list' ? (
          <div className="flex-1 overflow-hidden px-6 pt-4 pb-2 relative">
            <DataTable
                data={filteredNotes}
                columns={columns}
                isLoading={isLoading}
                sort={{ items: sortState, onSort: requestSort }}
                selection={{
                    selectedIds: selectedRowIds,
                    onSelectAll: (c) => setSelectedRowIds(c ? new Set(filteredNotes.map(n => n.id)) : new Set()),
                    onSelectRow: (id) => setSelectedRowIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })
                }}
                emptyIcon="local_shipping"
                emptyMessage="Không tìm thấy phiếu giao hàng"
                onRowClick={(note) => setSelectedNoteId(note.id)}
            />
            {selectedRowIds.size > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-6 animate-fadeIn z-50">
                    <span className="font-bold text-sm whitespace-nowrap">{selectedRowIds.size} đã chọn</span>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <button onClick={() => handleBulkStatus('Shipping')} className="flex items-center gap-2 hover:text-blue-400 transition-colors text-sm font-medium">
                        <span className="material-symbols-outlined text-[18px]">local_shipping</span> Đi giao
                    </button>
                    <button onClick={() => handleBulkStatus('Delivered')} className="flex items-center gap-2 hover:text-emerald-400 transition-colors text-sm font-medium">
                        <span className="material-symbols-outlined text-[18px]">check_circle</span> Hoàn tất
                    </button>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <button onClick={() => setSelectedRowIds(new Set())} className="hover:text-red-400 transition-colors"><span className="material-symbols-outlined text-[18px]">close</span></button>
                </div>
            )}
          </div>
      ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
              <div className="flex gap-6 h-full min-w-[900px]">
                  {/* Column 1: Pending */}
                  <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 h-full">
                      <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl sticky top-0 z-10">
                          <h3 className="font-black text-xs text-orange-600 uppercase tracking-widest flex items-center gap-2">
                              <span className="size-2 rounded-full bg-orange-500"></span> Chờ giao hàng
                          </h3>
                          <span className="bg-slate-100 dark:bg-slate-800 text-xs font-bold px-2 py-0.5 rounded-md">{kanbanData?.pending.length || 0}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                          {kanbanData?.pending.map(n => (
                              <DeliveryCard key={n.id} note={n} onClick={() => setSelectedNoteId(n.id)} onAction={handleStatusChange} />
                          ))}
                      </div>
                  </div>

                  {/* Column 2: Shipping */}
                  <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 h-full">
                      <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl sticky top-0 z-10">
                          <h3 className="font-black text-xs text-blue-600 uppercase tracking-widest flex items-center gap-2">
                              <span className="size-2 rounded-full bg-blue-500"></span> Đang vận chuyển
                          </h3>
                          <span className="bg-slate-100 dark:bg-slate-800 text-xs font-bold px-2 py-0.5 rounded-md">{kanbanData?.shipping.length || 0}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                          {kanbanData?.shipping.map(n => (
                              <DeliveryCard key={n.id} note={n} onClick={() => setSelectedNoteId(n.id)} onAction={handleStatusChange} />
                          ))}
                      </div>
                  </div>

                  {/* Column 3: Completed */}
                  <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 h-full">
                      <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl sticky top-0 z-10">
                          <h3 className="font-black text-xs text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                              <span className="size-2 rounded-full bg-emerald-500"></span> Đã hoàn tất / Hủy
                          </h3>
                          <span className="bg-slate-100 dark:bg-slate-800 text-xs font-bold px-2 py-0.5 rounded-md">{kanbanData?.completed.length || 0}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                          {kanbanData?.completed.map(n => (
                              <DeliveryCard key={n.id} note={n} onClick={() => setSelectedNoteId(n.id)} onAction={handleStatusChange} />
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Footer Pagination (Only visible in list view) */}
      {viewMode === 'list' && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
              <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={200} onPageChange={setCurrentPage} />
          </div>
      )}

      <NoteDetailDrawer />
      <CreateDeliveryModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <PrintDeliveryModal isOpen={!!printData} onClose={() => setPrintData(null)} data={printData} />
    </PageShell>
  );
};

export default DeliveryNotes;
