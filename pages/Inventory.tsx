
import React, { useState, useMemo, useEffect } from 'react';
import { Product } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency, removeVietnameseTones, calcAvailableStock, toCSV, downloadTextFile, copyToClipboard } from '../utils/helpers';
import { CreateProductModal, AdjustStockModal } from '../components/InventoryModals';
import { InventoryImportModal } from '../components/inventory/InventoryImportModal';
import { ProductDetailDrawer } from '../components/products/ProductDetailDrawer';
import { useDexieTable, SortItem } from '../hooks/useDexieTable';
import { db } from '../services/db';
import { PageShell, Button } from '../components/ui/Primitives';
import { TableToolbar } from '../components/table/TableToolbar';
import { FilterChip } from '../components/ui/FilterBar';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import Pagination from '../components/Pagination';
import { SavedViews } from '../components/table/SavedViews';
import { useLiveQuery } from 'dexie-react-hooks';
import { WAREHOUSE_CONFIG, PRODUCT_BRANDS } from '../constants/options';
import { Tooltip } from '../components/ui/Tooltip';

// --- CONFIGURATION ---
const WAREHOUSE_ZONES = [
    { id: 'all', label: 'Tất cả kho', icon: 'warehouse', description: 'Tổng hợp toàn bộ hàng hóa' },
    ...WAREHOUSE_CONFIG
];

type StockFilterType = 'all' | 'low' | 'out' | 'plenty';

interface InventoryViewState {
    activeBrand: string;
    activeLocation: string;
    stockFilter: StockFilterType;
    searchTerm: string;
    sortState: SortItem[];
}

const DEFAULT_PRODUCT_STATE: Partial<Product> = {
    sku: '', name: '', brand: '', dimensions: '', importPrice: 0, retailPrice: 0, stock: 0, minStock: 10, location: 'bearing', stockReserved: 0
};

const Inventory: React.FC<{ initialParams?: any }> = ({ initialParams }) => {
  const { adjustStock, addProduct, updateProduct, deleteProduct, confirm, showNotification } = useAppContext();

  // --- UI STATE ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [productFormData, setProductFormData] = useState<Partial<Product>>(DEFAULT_PRODUCT_STATE);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  
  // Drawer State
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // --- FILTER STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeBrand, setActiveBrand] = useState('all');
  const [activeLocation, setActiveLocation] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');

  const itemsPerPage = 15;

  useEffect(() => {
      if (initialParams?.highlightId) {
          const id = initialParams.highlightId;
          setSelectedProductId(id);
          setIsDetailDrawerOpen(true);
      }
  }, [initialParams]);

  useEffect(() => { 
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300); 
    return () => clearTimeout(timer); 
  }, [searchTerm]);

  // --- DATA & COUNTS ---
  const allProducts = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
  
  const zoneCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      WAREHOUSE_ZONES.forEach(z => counts[z.id] = 0);
      
      allProducts.forEach(p => {
          counts['all']++;
          const loc = p.location || 'other';
          if (counts[loc] !== undefined) counts[loc]++;
          else counts['other'] = (counts['other'] || 0) + 1;
      });
      return counts;
  }, [allProducts]);

  // --- FILTER LOGIC ---
  const filterFn = useMemo(() => (p: Product) => {
      if (debouncedSearch) {
          const norm = removeVietnameseTones(debouncedSearch);
          if (!removeVietnameseTones(p.name).includes(norm) && !p.sku.toLowerCase().includes(norm)) return false;
      }
      if (activeBrand !== 'all' && p.brand !== activeBrand) return false;
      
      // Location Filter
      if (activeLocation !== 'all') {
          if (activeLocation === 'other') {
             const mainZones = WAREHOUSE_CONFIG.map(z => z.id);
             if (p.location && mainZones.includes(p.location)) return false;
          } else {
             if (p.location !== activeLocation) return false;
          }
      }

      const available = calcAvailableStock(p.stock, p.stockReserved);
      if (stockFilter === 'low' && available > (p.minStock || 10)) return false;
      if (stockFilter === 'out' && available > 0) return false;
      if (stockFilter === 'plenty' && available <= (p.minStock || 10)) return false;
      return true;
  }, [debouncedSearch, activeBrand, activeLocation, stockFilter]);

  const { data: products, totalItems, currentPage, setCurrentPage, sortState, setSortState, requestSort, isLoading } = useDexieTable<Product>({
      table: db.products, itemsPerPage, filterFn, defaultSort: 'updatedAt'
  });

  // --- DYNAMIC SUMMARY ---
  const summary = useMemo(() => {
      const zoneProducts = allProducts.filter(p => {
          if (activeLocation === 'all') return true;
          if (activeLocation === 'other') {
              const mainZones = WAREHOUSE_CONFIG.map(z => z.id);
              return !p.location || !mainZones.includes(p.location);
          }
          return p.location === activeLocation;
      });

      const totalValue = zoneProducts.reduce((sum, p) => sum + (p.stock * p.importPrice), 0);
      const lowStockCount = zoneProducts.filter(p => p.stock <= (p.minStock || 10)).length;
      const outOfStockCount = zoneProducts.filter(p => p.stock <= 0).length;
      
      return { totalValue, lowStockCount, outOfStockCount, totalCount: zoneProducts.length };
  }, [allProducts, activeLocation]);

  // --- HANDLERS ---
  const currentViewState: InventoryViewState = {
      activeBrand, activeLocation, stockFilter, searchTerm, sortState
  };

  const handleApplyView = (state: InventoryViewState) => {
      setActiveBrand(state.activeBrand);
      setActiveLocation(state.activeLocation);
      setStockFilter(state.stockFilter);
      setSearchTerm(state.searchTerm);
      if (state.sortState) setSortState(state.sortState);
  };

  const handleClearView = () => {
      setActiveBrand('all');
      setActiveLocation('all');
      setStockFilter('all');
      setSearchTerm('');
      setSortState([{ key: 'updatedAt', direction: 'desc' }]);
  };

  const handleEdit = (product: Product) => {
      setProductFormData(product);
      setModalMode('edit');
      setIsCreateModalOpen(true);
  };

  const handleViewDetail = (product: Product) => {
      setSelectedProductId(product.id);
      setIsDetailDrawerOpen(true);
  };

  const handleCreate = () => {
      setProductFormData({
          ...DEFAULT_PRODUCT_STATE,
          location: activeLocation !== 'all' && activeLocation !== 'other' ? activeLocation : 'bearing'
      });
      setModalMode('create');
      setIsCreateModalOpen(true);
  };

  const handleSaveProduct = async () => {
      try {
          if (modalMode === 'create') {
              await addProduct(productFormData as any);
              showNotification('Thêm sản phẩm thành công', 'success');
          } else {
              await updateProduct(productFormData as Product);
              showNotification('Cập nhật sản phẩm thành công', 'success');
          }
          setIsCreateModalOpen(false);
      } catch (e) {
          showNotification('Lỗi khi lưu sản phẩm', 'error');
      }
  };

  const handleDelete = async (id: string) => {
      const ok = await confirm({ title: 'Xóa sản phẩm?', message: 'Sản phẩm sẽ bị đánh dấu xóa (Soft Delete).', type: 'danger' });
      if (ok) await deleteProduct(id);
  };

  const handleAdjustStock = async (qty: number, minStock: number) => {
      if (!adjustingProduct) return;
      await adjustStock(adjustingProduct.id, qty, 'Kiểm kê nhanh', minStock);
      setAdjustingProduct(null);
      showNotification('Đã cập nhật tồn kho', 'success');
  };

  const handleExport = async () => {
      const data = allProducts.filter(filterFn).map(p => ({ sku: p.sku, name: p.name, brand: p.brand, location: p.location, stock: p.stock, reserved: p.stockReserved, available: calcAvailableStock(p.stock, p.stockReserved), retailPrice: p.retailPrice }));
      const headers = [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Tên' }, { key: 'brand', label: 'Hãng' }, { key: 'location', label: 'Vị trí' }, { key: 'stock', label: 'Tồn thực' }, { key: 'reserved', label: 'Đang giữ' }, { key: 'available', label: 'Khả dụng' }, { key: 'retailPrice', label: 'Giá bán' }];
      downloadTextFile(`TonKho_${activeLocation}_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data, headers));
  };

  const handleCopy = (text: string, label: string) => {
      copyToClipboard(text);
      showNotification(`Đã copy ${label}`, 'success');
  };

  const columns: ColumnDef<Product>[] = [
      { 
          header: '#', 
          width: 'w-10', 
          align: 'center', 
          cell: (_, idx) => <span className="text-slate-400 text-[10px] font-bold">{(currentPage - 1) * itemsPerPage + idx + 1}</span> 
      },
      { 
          header: 'Mã SKU', 
          accessorKey: 'sku', 
          sortable: true,
          width: 'w-32', 
          cell: (p) => (
            <div 
                className="group/sku flex items-center gap-2 cursor-pointer" 
                onClick={(e) => { e.stopPropagation(); handleCopy(p.sku, 'Mã SKU'); }}
                title="Click để copy SKU"
            >
                <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden">
                    {p.image ? (
                        <img src={p.image} alt="" className="w-full h-full object-cover opacity-80" />
                    ) : (
                        <span className="material-symbols-outlined text-[14px] text-slate-300">image</span>
                    )}
                </div>
                <div className="min-w-0">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 block truncate group-hover/sku:underline decoration-dashed">{p.sku}</span>
                </div>
            </div>
          ) 
      },
      { 
          header: 'Hiệu', 
          accessorKey: 'brand', 
          sortable: true,
          width: 'w-24',
          cell: (p) => (
            <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                {p.brand}
            </span>
          )
      },
      { 
          header: 'Tên sản phẩm', 
          accessorKey: 'name', 
          sortable: true, 
          cell: (p) => (
            <div className="min-w-[180px]">
                <div 
                    className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2 leading-snug cursor-pointer hover:text-blue-600 transition-colors" 
                    title={p.name}
                    onClick={(e) => { e.stopPropagation(); handleCopy(p.name, 'Tên sản phẩm'); }}
                >
                    {p.name}
                </div>
                {activeLocation === 'all' && p.location && (
                    <div className="mt-1">
                        <span className="border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/50 text-[9px] text-slate-500">
                            {WAREHOUSE_ZONES.find(z => z.id === p.location)?.label || p.location}
                        </span>
                    </div>
                )}
            </div>
          )
      },
      { 
          header: 'Kích thước', 
          accessorKey: 'dimensions', 
          width: 'w-32',
          cell: (p) => (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate block max-w-[120px]" title={p.dimensions}>
                {p.dimensions || '---'}
            </span>
          )
      },
      { 
          header: 'Giá', 
          accessorKey: 'retailPrice', 
          sortable: true, 
          align: 'right',
          width: 'w-28',
          cell: (p) => {
              const margin = p.retailPrice > 0 ? ((p.retailPrice - p.importPrice) / p.retailPrice) * 100 : 0;
              const marginColor = margin > 30 ? 'text-emerald-500' : margin > 15 ? 'text-blue-500' : 'text-orange-500';
              
              return (
                <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(p.retailPrice)}</span>
                    <div className="flex items-center gap-1 text-[9px]">
                        <span className="text-slate-400">Vốn: {new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(p.importPrice)}</span>
                        <span className={`${marginColor} font-bold`}>({margin.toFixed(0)}%)</span>
                    </div>
                </div>
              );
          }
      },
      { 
          header: 'Tồn kho', 
          accessorKey: 'stock', 
          align: 'center', 
          sortable: true, 
          width: 'w-32',
          cell: (p) => {
            const available = calcAvailableStock(p.stock, p.stockReserved);
            const reserved = p.stockReserved || 0;
            const min = p.minStock || 10;
            
            let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
            if (available <= 0) badgeClass = 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
            else if (available <= min) badgeClass = 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';

            return (
                <div className="flex flex-col items-center w-full">
                    <div className={`flex items-center justify-between w-full px-2 py-1 rounded-lg border text-xs font-bold mb-1 ${badgeClass}`}>
                        <span>Khả dụng</span>
                        <span className="text-sm">{available}</span>
                    </div>
                    {(reserved > 0 || p.stock !== available) && (
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-medium w-full px-1">
                            <div className="flex-1 flex justify-between">
                                <span>Thực:</span> <b>{p.stock}</b>
                            </div>
                            {reserved > 0 && (
                                <div className="flex-1 flex justify-between text-orange-600">
                                    <span>Giữ:</span> <b>{reserved}</b>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
          }
      },
      { 
          header: '', 
          align: 'center', 
          width: 'w-24', 
          cell: (p) => (
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => { e.stopPropagation(); setAdjustingProduct(p); }}
                    className="size-7 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center justify-center transition-colors"
                    title="Kiểm kê nhanh"
                >
                    <span className="material-symbols-outlined text-[16px]">inventory</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                    className="size-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-colors"
                    title="Sửa thông tin"
                >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="size-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors"
                    title="Xóa"
                >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>
          )
      }
  ];

  const activeZoneInfo = WAREHOUSE_ZONES.find(z => z.id === activeLocation) || WAREHOUSE_ZONES[0];

  return (
    <PageShell>
        {/* Removed PageHeader */}
        
        <div className="flex flex-col lg:flex-row h-full overflow-hidden">
            {/* LEFT SIDEBAR: WAREHOUSE ZONES */}
            <aside className={`bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-full lg:w-20' : 'w-full lg:w-64'}`}>
                <div className={`p-4 border-b border-slate-100 dark:border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isSidebarCollapsed && (
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Phân Kho</h3>
                            <div className="text-[10px] text-slate-500 truncate">Chọn khu vực</div>
                        </div>
                    )}
                    <button 
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="size-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={isSidebarCollapsed ? "Mở rộng" : "Thu gọn"}
                    >
                        <span className="material-symbols-outlined text-[20px]">{isSidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {WAREHOUSE_ZONES.map(zone => {
                        const isActive = activeLocation === zone.id;
                        const count = zoneCounts[zone.id] || 0;
                        
                        const ButtonContent = (
                            <button
                                onClick={() => setActiveLocation(zone.id)}
                                className={`flex items-center gap-3 py-3 rounded-xl transition-all text-left group relative ${
                                    isSidebarCollapsed ? 'justify-center w-full' : 'w-full px-3'
                                } ${
                                    isActive 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-blue-600'
                                }`}>
                                    <span className="material-symbols-outlined text-[18px]">{zone.icon}</span>
                                </div>
                                
                                {!isSidebarCollapsed && (
                                    <div className="flex-1 min-w-0 animate-[fadeIn_0.2s_ease-out]">
                                        <div className="flex justify-between items-center">
                                            <p className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{zone.label}</p>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                            }`}>{count}</span>
                                        </div>
                                        <p className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>{zone.description}</p>
                                    </div>
                                )}
                            </button>
                        );

                        return (
                            <React.Fragment key={zone.id}>
                                {isSidebarCollapsed ? (
                                    <Tooltip content={`${zone.label} (${count})`} side="right">
                                        {ButtonContent}
                                    </Tooltip>
                                ) : (
                                    ButtonContent
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </aside>

            {/* RIGHT CONTENT: DATA */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] dark:bg-[#0b1121]">
                
                {/* Context Aware Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pt-6 pb-2">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center"><span className="material-symbols-outlined">monetization_on</span></div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-500 uppercase font-bold truncate">Giá trị {activeLocation !== 'all' ? 'kho này' : 'tồn kho'}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white truncate" title={formatCurrency(summary.totalValue)}>{new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(summary.totalValue)}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center"><span className="material-symbols-outlined">inventory_2</span></div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Tổng mã hàng</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">{summary.totalCount}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-orange-300 transition-colors" onClick={() => setStockFilter('low')}>
                        <div className="size-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center"><span className="material-symbols-outlined">warning</span></div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Sắp hết hàng</p>
                            <p className="text-lg font-black text-orange-600">{summary.lowStockCount}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-red-300 transition-colors" onClick={() => setStockFilter('out')}>
                        <div className="size-10 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center"><span className="material-symbols-outlined">production_quantity_limits</span></div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Hết hàng</p>
                            <p className="text-lg font-black text-red-600">{summary.outOfStockCount}</p>
                        </div>
                    </div>
                </div>

                <TableToolbar
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    placeholder={`Tìm trong ${activeZoneInfo.label}...`}
                    leftFilters={
                        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <select value={activeBrand} onChange={e => setActiveBrand(e.target.value)} className="h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none flex-1 sm:flex-none cursor-pointer hover:border-blue-400 transition-colors">
                                <option value="all">Tất cả hãng</option>
                                {PRODUCT_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    }
                    rightActions={
                        <>
                            <SavedViews 
                                pageKey="inventory"
                                currentState={currentViewState}
                                onApply={handleApplyView}
                                onClear={handleClearView}
                            />
                            <Button variant="outline" icon="file_download" onClick={handleExport} className="hidden sm:flex">Export</Button>
                            <Button variant="outline" icon="upload_file" onClick={() => setIsImportModalOpen(true)} className="hidden sm:flex">Import</Button>
                            <Button variant="primary" icon="add" onClick={handleCreate}>Thêm mới</Button>
                        </>
                    }
                >
                    <FilterChip label="Tất cả" isActive={stockFilter === 'all'} onClick={() => setStockFilter('all')} />
                    <FilterChip label="Sắp hết" isActive={stockFilter === 'low'} onClick={() => setStockFilter('low')} color="text-orange-600 bg-orange-50 dark:bg-orange-900/20" count={summary.lowStockCount} />
                    <FilterChip label="Hết hàng" isActive={stockFilter === 'out'} onClick={() => setStockFilter('out')} color="text-red-600 bg-red-50 dark:bg-red-900/20" count={summary.outOfStockCount} />
                </TableToolbar>

                <DataTable 
                    data={products}
                    columns={columns}
                    sort={{ items: sortState, onSort: requestSort }}
                    emptyIcon={activeZoneInfo.icon}
                    emptyMessage={`Không có sản phẩm nào trong ${activeZoneInfo.label}`}
                    emptyAction={<Button variant="primary" size="sm" icon="add" onClick={handleCreate}>Thêm vào kho này</Button>}
                    onRowClick={handleViewDetail}
                    isLoading={isLoading}
                />

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                    <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={itemsPerPage} onPageChange={setCurrentPage} />
                </div>
            </div>
        </div>

        <CreateProductModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleSaveProduct} data={productFormData} setData={setProductFormData} mode={modalMode} />
        
        <AdjustStockModal product={adjustingProduct} onClose={() => setAdjustingProduct(null)} onSave={handleAdjustStock} initialQty={adjustingProduct?.stock || 0} initialMin={adjustingProduct?.minStock || 10} />
        
        <InventoryImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onSuccess={() => { /* maybe refresh or toast */ }} />

        <ProductDetailDrawer 
            isOpen={isDetailDrawerOpen} 
            onClose={() => setIsDetailDrawerOpen(false)} 
            productId={selectedProductId}
            onEdit={(p) => { setIsDetailDrawerOpen(false); handleEdit(p); }}
            onAdjust={(p) => { setIsDetailDrawerOpen(false); setAdjustingProduct(p); }}
        />
    </PageShell>
  );
};

export default Inventory;
