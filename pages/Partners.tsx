
import React, { useState, useMemo, useEffect } from 'react';
import { Partner, PartnerType } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency, removeVietnameseTones, toCSV, downloadTextFile, formatRelativeTime } from '../utils/helpers';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import { ActionMenu } from '../components/ui/ActionMenu';
import { CreatePartnerModal } from '../components/PartnerModals';
import { PartnerProfileDrawer } from '../components/partners/PartnerProfileDrawer';
import { useDexieTable } from '../hooks/useDexieTable';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

const PartnerStatCard = ({ title, value, icon, color, subValue }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
        <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${color} bg-opacity-10 text-opacity-100`}>
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{title}</p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-none mt-1">{value}</h3>
            {subValue && <p className="text-[10px] font-medium text-slate-400 mt-1 truncate">{subValue}</p>}
        </div>
    </div>
);

const Partners: React.FC<{ onNavigate?: any, initialParams?: any }> = ({ initialParams }) => {
  const { deletePartner, confirm } = useAppContext();
  
  // State
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [partnerToEdit, setPartnerToEdit] = useState<Partner | undefined>(undefined);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [activeTab, setActiveTab] = useState<PartnerType>('Customer');

  const itemsPerPage = 15;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300); 
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle Initial Params
  useEffect(() => {
    if (initialParams?.highlightId) {
        setSelectedPartnerId(initialParams.highlightId);
    }
  }, [initialParams]);

  // Live Stats Calculation (Optimized)
  const stats = useLiveQuery(async () => {
      let customerCount = 0;
      let supplierCount = 0;
      let totalReceivable = 0;
      let totalPayable = 0;

      await db.partners.filter(p => !p.isDeleted).each(p => {
          if (p.type === 'Customer') {
              customerCount++;
              totalReceivable += (p.debt || 0);
          } else if (p.type === 'Supplier') {
              supplierCount++;
              totalPayable += (p.debt || 0);
          }
      });

      return { customerCount, supplierCount, totalReceivable, totalPayable };
  }, [], { customerCount: 0, supplierCount: 0, totalReceivable: 0, totalPayable: 0 });

  // Filter Logic
  const filterFn = useMemo(() => (p: Partner) => {
      if (p.type !== activeTab) return false;

      if (debouncedSearch) {
          const lower = removeVietnameseTones(debouncedSearch);
          if (!removeVietnameseTones(p.name).includes(lower) && 
              !p.phone.includes(lower) && 
              !(p.taxId && p.taxId.includes(lower)) &&
              !p.code.toLowerCase().includes(lower)) return false;
      }
      return true;
  }, [debouncedSearch, activeTab]);

  const { data: partners, totalItems, currentPage, setCurrentPage, sortState, requestSort, isLoading } = useDexieTable<Partner>({
      table: db.partners,
      itemsPerPage,
      filterFn,
      defaultSort: 'updatedAt'
  });

  // Actions
  const handleEdit = (partner: Partner) => {
      setPartnerToEdit(partner);
      setModalMode('edit');
      setIsCreateModalOpen(true);
  };

  const handleCreate = () => {
      setPartnerToEdit({ type: activeTab } as Partner); 
      setModalMode('create');
      setIsCreateModalOpen(true);
  };

  const handleDelete = async (id: string) => {
      const ok = await confirm({ title: 'Xóa đối tác?', message: 'Hành động này sẽ xóa đối tác nhưng giữ lại các giao dịch liên quan.', type: 'danger' });
      if (ok) await deletePartner(id);
  };

  const handleExport = async () => {
      const all = await db.partners.filter(p => !p.isDeleted && p.type === activeTab).toArray();
      const data = all.map(p => ({
          code: p.code, name: p.name, type: p.type, phone: p.phone, 
          address: p.address, taxId: p.taxId, debt: p.debt
      }));
      downloadTextFile(`DSDoiTac_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`, toCSV(data, [
          { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên' }, 
          { key: 'taxId', label: 'MST' },
          { key: 'phone', label: 'SĐT' }, { key: 'address', label: 'Địa chỉ' },
          { key: 'debt', label: 'Công nợ' }
      ]));
  };

  const columns: ColumnDef<Partner>[] = [
      { header: 'Mã', accessorKey: 'code', sortable: true, width: 'w-24', cell: (p) => <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{p.code}</span> },
      { header: 'Đối tác', accessorKey: 'name', sortable: true, cell: (p) => (
          <div className="flex items-center gap-3 group">
              <div className={`size-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 uppercase transition-transform group-hover:scale-105 ${
                  p.type === 'Customer' 
                    ? ['bg-blue-500', 'bg-indigo-500', 'bg-cyan-500'][p.name.charCodeAt(0) % 3]
                    : ['bg-orange-500', 'bg-amber-500', 'bg-red-500'][p.name.charCodeAt(0) % 3]
              }`}>
                  {p.name.charAt(0)}
              </div>
              <div className="min-w-[150px]">
                  <div className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[250px] group-hover:text-blue-600 transition-colors">{p.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">history</span>
                      {formatRelativeTime(p.updatedAt)}
                  </div>
              </div>
          </div>
      )},
      { header: 'MST', accessorKey: 'taxId', width: 'w-28', cell: (p) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 select-all">{p.taxId || '---'}</span>
      )},
      { header: 'Liên hệ', accessorKey: 'phone', width: 'w-36', cell: (p) => (
          <div className="group flex items-center justify-between pr-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">{p.phone}</div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-lg p-0.5 ml-2">
                  <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()} className="size-6 flex items-center justify-center rounded hover:bg-emerald-50 text-emerald-600 transition-colors" title="Gọi điện">
                      <span className="material-symbols-outlined text-[14px]">call</span>
                  </a>
                  <button onClick={e => e.stopPropagation()} className="size-6 flex items-center justify-center rounded hover:bg-blue-50 text-blue-600 transition-colors" title="Zalo / Tin nhắn">
                      <span className="material-symbols-outlined text-[14px]">chat</span>
                  </button>
              </div>
          </div>
      )},
      { header: 'Địa chỉ', accessorKey: 'address', cell: (p) => (
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate block max-w-[200px]" title={p.address}>{p.address || '---'}</span>
      )},
      { header: 'Công nợ & Hạn mức', accessorKey: 'debt', align: 'left', width: 'w-48', sortable: true, cell: (p) => {
          const debt = p.debt || 0;
          const limit = p.debtLimit || 0;
          const percent = limit > 0 ? Math.min(100, (debt / limit) * 100) : 0;
          const isPositive = debt > 0;
          
          return (
              <div className="w-full">
                  <div className="flex justify-between items-end mb-1">
                      <span className={`font-mono font-black text-sm ${isPositive ? (p.type === 'Customer' ? 'text-blue-600' : 'text-orange-600') : 'text-slate-400'}`}>
                          {formatCurrency(debt)}
                      </span>
                      {limit > 0 && <span className="text-[9px] text-slate-400 font-bold">{Math.round(percent)}%</span>}
                  </div>
                  {limit > 0 && (
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                              className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : percent > 50 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${percent}%` }}
                          ></div>
                      </div>
                  )}
                  {limit > 0 && <p className="text-[9px] text-slate-400 mt-0.5 text-right">Hạn mức: {formatCurrency(limit)}</p>}
              </div>
          );
      }},
      { header: 'Tác vụ', align: 'center', width: 'w-20', cell: (p) => (
          <div className="flex items-center justify-center gap-1">
              <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedPartnerId(p.id); }}
                  className="size-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-colors"
              >
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
              </button>
              <ActionMenu items={[
                  { label: 'Sửa thông tin', icon: 'edit', onClick: () => handleEdit(p) },
                  { label: 'Tạo đơn hàng', icon: 'add_shopping_cart', onClick: () => {}, disabled: p.type === 'Supplier' },
                  { label: 'Xóa đối tác', icon: 'delete', onClick: () => handleDelete(p.id), danger: true }
              ]} />
          </div>
      )}
  ];

  return (
    <PageShell>
        {/* Removed PageHeader */}
        
        <div className="px-6 pt-6 pb-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <PartnerStatCard 
                title="Tổng Khách Hàng" 
                value={stats.customerCount} 
                icon="groups" 
                color="text-blue-600 bg-blue-500" 
            />
            <PartnerStatCard 
                title="Tổng Nhà Cung Cấp" 
                value={stats.supplierCount} 
                icon="local_shipping" 
                color="text-orange-600 bg-orange-500" 
            />
            {activeTab === 'Customer' ? (
                <PartnerStatCard 
                    title="Nợ Phải Thu" 
                    value={formatCurrency(stats.totalReceivable)} 
                    icon="account_balance_wallet" 
                    color="text-red-600 bg-red-500" 
                    subValue="Cần thu hồi"
                />
            ) : (
                <PartnerStatCard 
                    title="Nợ Phải Trả" 
                    value={formatCurrency(stats.totalPayable)} 
                    icon="payments" 
                    color="text-amber-600 bg-amber-500" 
                    subValue="Cần thanh toán"
                />
            )}
        </div>

        <TableToolbar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder={`Tìm ${activeTab === 'Customer' ? 'khách hàng' : 'nhà cung cấp'}...`}
            leftFilters={
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => setActiveTab('Customer')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'Customer' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[16px]">person</span> Khách hàng
                    </button>
                    <button 
                        onClick={() => setActiveTab('Supplier')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'Supplier' ? 'bg-white dark:bg-slate-600 shadow text-orange-600 dark:text-orange-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[16px]">local_shipping</span> Nhà cung cấp
                    </button>
                </div>
            }
            rightActions={
                <>
                    <Button variant="outline" icon="file_download" onClick={handleExport}>Excel</Button>
                    <Button variant="primary" icon="add" onClick={handleCreate}>
                        Thêm {activeTab === 'Customer' ? 'Khách' : 'NCC'}
                    </Button>
                </>
            }
        />

        <div className="flex-1 overflow-hidden px-6 pt-4 pb-2">
            <DataTable 
                data={partners}
                columns={columns}
                sort={{ items: sortState, onSort: requestSort }}
                isLoading={isLoading}
                onRowClick={(p) => setSelectedPartnerId(p.id)}
                emptyIcon="groups"
                emptyMessage={`Chưa có ${activeTab === 'Customer' ? 'khách hàng' : 'nhà cung cấp'} nào`}
            />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
            <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={itemsPerPage} onPageChange={setCurrentPage} />
        </div>

        <CreatePartnerModal 
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            mode={modalMode}
            initialData={partnerToEdit}
        />

        <PartnerProfileDrawer 
            partnerId={selectedPartnerId}
            isOpen={!!selectedPartnerId}
            onClose={() => setSelectedPartnerId(null)}
            onEdit={handleEdit}
        />
    </PageShell>
  );
};

export default Partners;
