
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ImportOrder, ImportStatus, ImportItem } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency, formatInputDate, parseDate, parseISOToDate, toCSV, downloadTextFile } from '../utils/helpers';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { DateRangeFilter } from '../components/filters/DateRangeFilter';
import { CreateImportModal, PrintImportModal, ReceiveItemsModal, CreatePurchaseReturnModal } from '../components/ImportModals';
import { Drawer } from '../components/ui/Drawer';
import { ImportWizard } from '../components/imports/ImportWizard';

const Imports: React.FC<{ onNavigate?: any, initialParams?: any }> = ({ initialParams }) => {
    const { lockDocument, updateImportStatus, confirm, showNotification } = useAppContext();

    // --- STATE ---
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [fetchedOrder, setFetchedOrder] = useState<ImportOrder | null>(null);
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [printData, setPrintData] = useState<ImportOrder | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<ImportStatus | 'all'>('all');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    const itemsPerPage = 15;
    const [currentPage, setCurrentPage] = useState(1);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Handle URL Params
    useEffect(() => {
        if (initialParams?.highlightId) {
            setSelectedOrderId(initialParams.highlightId);
        }
    }, [initialParams]);

    // --- DATA ---
    const queryResult = useLiveQuery(async () => {
        let collection = db.importOrders.orderBy('createdAt').reverse();
        
        const all = await collection.toArray();
        
        const filtered = all.filter(order => {
            if (debouncedSearch) {
                const lower = debouncedSearch.toLowerCase();
                if (!order.code.toLowerCase().includes(lower) && !order.supplierName.toLowerCase().includes(lower)) return false;
            }
            if (statusFilter !== 'all' && order.status !== statusFilter) return false;
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
        });

        // Pagination
        const offset = (currentPage - 1) * itemsPerPage;
        return {
            data: filtered.slice(offset, offset + itemsPerPage),
            totalItems: filtered.length
        };
    }, [debouncedSearch, statusFilter, dateRange, currentPage]);

    const { data: importOrders = [], totalItems = 0 } = queryResult || {};

    // Fallback Fetch for Drawer
    useEffect(() => {
        if (selectedOrderId) {
            const inList = importOrders.find(o => o.id === selectedOrderId);
            if (inList) setFetchedOrder(null);
            else if (!fetchedOrder || fetchedOrder.id !== selectedOrderId) {
                db.importOrders.get(selectedOrderId).then(o => { if (o) setFetchedOrder(o); });
            }
        } else {
            setFetchedOrder(null);
        }
    }, [selectedOrderId, importOrders, fetchedOrder]);

    const selectedOrder = useMemo(() => {
        if (!selectedOrderId) return null;
        return importOrders.find(o => o.id === selectedOrderId) || fetchedOrder;
    }, [importOrders, selectedOrderId, fetchedOrder]);

    // --- ACTIONS ---
    const handleLockImport = async () => {
        if (!selectedOrderId) return;
        const ok = await confirm({ title: 'Khóa phiếu nhập?', message: 'Phiếu sẽ không thể chỉnh sửa sau khi khóa.', type: 'warning' });
        if (ok) await lockDocument('Import', selectedOrderId);
    };

    const handleUpdateImport = async (id: string, status: ImportStatus) => {
        if (status === 'Cancelled') {
            const ok = await confirm({ title: 'Hủy phiếu nhập?', message: 'Hành động này sẽ hủy phiếu nhưng KHÔNG hoàn trả tồn kho tự động (cần xử lý thủ công nếu đã nhập).', type: 'danger' });
            if (!ok) return;
        }
        await updateImportStatus(id, status);
        if(fetchedOrder && fetchedOrder.id === id) setFetchedOrder({ ...fetchedOrder, status });
    };

    const handleExportCSV = async () => {
        const all = await db.importOrders.toArray();
        const data = all.map(i => ({
            code: i.code, date: i.date, supplier: i.supplierName, total: i.total, status: i.status, warehouse: i.warehouse
        }));
        const csv = toCSV(data, [
            { key: 'code', label: 'Mã Phiếu' }, { key: 'date', label: 'Ngày Nhập' },
            { key: 'supplier', label: 'Nhà Cung Cấp' }, { key: 'total', label: 'Tổng Tiền' },
            { key: 'status', label: 'Trạng Thái' }, { key: 'warehouse', label: 'Kho' }
        ]);
        downloadTextFile(`NhapKho_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    };

    // --- COLUMNS ---
    const columns: ColumnDef<ImportOrder>[] = [
        { header: 'Mã phiếu', accessorKey: 'code', sortable: true, width: 'w-32', cell: (i) => <span className="font-mono font-bold text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">{i.code}</span> },
        { header: 'Nhà cung cấp', accessorKey: 'supplierName', sortable: true, cell: (i) => <span className="font-bold text-slate-900 dark:text-white text-sm">{i.supplierName}</span> },
        { header: 'Ngày nhập', accessorKey: 'date', sortable: true, width: 'w-32', cell: (i) => <span className="text-xs text-slate-500 font-medium">{i.date}</span> },
        { header: 'Tổng tiền', accessorKey: 'total', align: 'right', width: 'w-36', sortable: true, cell: (i) => <span className="font-black text-slate-900 dark:text-white text-sm">{formatCurrency(i.total)}</span> },
        { header: 'Trạng thái', accessorKey: 'status', align: 'center', width: 'w-32', cell: (i) => <StatusBadge status={i.status} entityType="Import" /> },
        { header: 'Tác vụ', align: 'center', width: 'w-24', cell: (i) => (
            <div className="flex items-center justify-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); setPrintData(i); }} className="size-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-[18px]">print</span></button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedOrderId(i.id); }} className="size-8 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-[18px]">visibility</span></button>
            </div>
        )}
    ];

    // --- DRAWER CONTENT ---
    const ImportDetailDrawer = () => {
        if (!selectedOrder) return null;
        
        // Fetch related data
        const purchaseReturnNotes = useLiveQuery(() => db.purchaseReturnNotes.where('importCode').equals(selectedOrder.code).toArray(), [selectedOrder.code]) || [];
        const receivingNotes = useLiveQuery(() => db.receivingNotes.where('importCode').equals(selectedOrder.code).toArray(), [selectedOrder.code]) || [];

        const isLocked = !!selectedOrder.lockedAt;

        return (
            <Drawer
                isOpen={!!selectedOrderId}
                onClose={() => setSelectedOrderId(null)}
                title={selectedOrder.code}
                subtitle={`${selectedOrder.date} • ${selectedOrder.supplierName}`}
                width="2xl"
                footer={
                    <div className="flex gap-3 w-full">
                        <Button variant="outline" className="flex-1" icon="print" onClick={() => setPrintData(selectedOrder)}>In Phiếu</Button>
                        
                        {(selectedOrder.status === 'Pending' || selectedOrder.status === 'Receiving') && (
                            <Button variant="primary" className="flex-[2]" icon="inventory" onClick={() => setIsReceiveModalOpen(true)} disabled={isLocked}>Nhập Kho</Button>
                        )}
                        
                        {(selectedOrder.status === 'Completed' || selectedOrder.status === 'Received' || selectedOrder.status === 'Receiving') && (
                            <Button variant="secondary" className="flex-1 text-red-600 hover:bg-red-50" icon="keyboard_return" onClick={() => setIsReturnModalOpen(true)}>Trả NCC</Button>
                        )}

                        {selectedOrder.status !== 'Cancelled' && (
                            <Button variant="danger" icon="cancel" onClick={() => handleUpdateImport(selectedOrder.id, 'Cancelled')}>Hủy Phiếu</Button>
                        )}
                    </div>
                }
            >
                <div className="space-y-8 pb-6">
                    {/* Header Summary */}
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <StatusBadge status={selectedOrder.status} entityType="Import" size="md" />
                            {isLocked && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">lock</span> Đã khóa</span>}
                        </div>
                        {!isLocked && !selectedOrder.status.includes('Cancel') && (
                            <Button variant="ghost" size="sm" onClick={handleLockImport} icon="lock" className="text-slate-400 hover:text-red-500">Khóa</Button>
                        )}
                    </div>

                    {/* Items Table */}
                    <section>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Chi tiết hàng hóa</h3>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Sản phẩm</th>
                                        <th className="px-4 py-3 text-center w-16">Đặt</th>
                                        <th className="px-4 py-3 text-center w-16 text-emerald-600">Nhận</th>
                                        <th className="px-4 py-3 text-right">Đơn giá</th>
                                        <th className="px-4 py-3 text-right">Tổng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {selectedOrder.items.map((item, idx) => {
                                        const received = item.receivedQuantity || 0;
                                        const percent = item.quantity > 0 ? (received / item.quantity) * 100 : 0;
                                        
                                        return (
                                            <tr key={idx}>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-900 dark:text-white">{item.productName}</div>
                                                    <div className="text-[10px] font-mono text-slate-500">{item.sku}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-500">{item.quantity}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="font-bold text-emerald-600">{received}</span>
                                                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${percent}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.price)}</td>
                                                <td className="px-4 py-3 text-right font-black">{formatCurrency(item.total)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Receiving History */}
                    {receivingNotes.length > 0 && (
                        <section>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Lịch sử nhập kho</h3>
                            <div className="space-y-2">
                                {receivingNotes.map(rn => (
                                    <div key={rn.id} className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px]">inventory</span> 
                                                {rn.code}
                                            </div>
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">{rn.date} • {rn.notes || 'Không ghi chú'}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm block">
                                                {rn.items.reduce((s, i) => s + i.quantity, 0)} sản phẩm
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Returns History */}
                    {purchaseReturnNotes.length > 0 && (
                        <section>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Lịch sử trả hàng</h3>
                            <div className="space-y-2">
                                {purchaseReturnNotes.map(rn => (
                                    <div key={rn.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px]">keyboard_return</span> 
                                                {rn.code}
                                            </div>
                                            <p className="text-[10px] text-red-500 mt-0.5">{rn.date} • {rn.method === 'debt_deduction' ? 'Trừ công nợ' : 'Hoàn tiền'}</p>
                                        </div>
                                        <span className="font-black text-red-600">{formatCurrency(rn.refundAmount)}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </Drawer>
        );
    };

    return (
        <PageShell>
            {/* Removed PageHeader */}

            <TableToolbar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="Tìm mã phiếu, NCC..."
                leftFilters={
                    <DateRangeFilter startDate={dateRange.from} endDate={dateRange.to} onChange={(from, to) => setDateRange({ from, to })} />
                }
                rightActions={
                    <>
                        <Button variant="outline" icon="file_download" onClick={handleExportCSV}>Excel</Button>
                        <Button variant="primary" icon="add" onClick={() => setIsCreateModalOpen(true)}>Tạo mới</Button>
                    </>
                }
            >
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
                    {(['all', 'Pending', 'Receiving', 'Received', 'Completed', 'Cancelled'] as const).map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${statusFilter === s ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50'}`}>
                            {s === 'all' ? 'Tất cả' : s === 'Pending' ? 'Nháp' : s === 'Receiving' ? 'Đang nhập' : s === 'Received' ? 'Đã nhập kho' : s === 'Completed' ? 'Hoàn tất' : 'Đã hủy'}
                        </button>
                    ))}
                </div>
            </TableToolbar>

            <div className="flex-1 overflow-hidden px-6 pt-4 pb-2">
                <DataTable 
                    data={importOrders} 
                    columns={columns} 
                    emptyIcon="inventory" 
                    emptyMessage="Chưa có phiếu nhập hàng"
                    onRowClick={(i) => setSelectedOrderId(i.id)}
                />
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={itemsPerPage} onPageChange={setCurrentPage} />
            </div>

            <ImportWizard isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            <ImportDetailDrawer />
            <PrintImportModal isOpen={!!printData} onClose={() => setPrintData(null)} data={printData} />
            
            {/* Action Modals */}
            {selectedOrder && (
                <>
                    <ReceiveItemsModal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} importOrder={selectedOrder} />
                    <CreatePurchaseReturnModal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} importOrder={selectedOrder} />
                </>
            )}
        </PageShell>
    );
};

export default Imports;
