
import React, { useState, useRef, useDeferredValue, useEffect, useMemo } from 'react';
import { Product, Partner, PartnerType, PaymentMethod } from '../types';
import { removeVietnameseTones, formatCurrency, calcAvailableStock } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import Pagination from '../components/Pagination';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { PrintPreviewModal } from '../components/QuoteModals';
import { TOKENS } from '../components/ui/Tokens';
import { InlineNumberEdit } from '../components/ui/InlineNumberEdit';
import { POS_CATEGORIES, PRODUCT_BRANDS, PAYMENT_METHOD_OPTIONS } from '../constants/options';
import { useAsyncAction } from '../hooks/useAsyncAction';

interface CartItem extends Product { 
    quantity: number; 
    customPrice?: number;
}

interface HeldCart {
    id: string;
    customer: Partner | null;
    items: CartItem[];
    timestamp: number;
    note: string;
}

const POS: React.FC = () => {
  const { createOrder, showNotification, confirm, settings } = useAppContext();
  
  // --- CATALOG STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery); 
  const [activeBrand, setActiveBrand] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Items per page - Divisible by 3 for the new grid layout
  const itemsPerPage = 15; 

  // --- CART & CHECKOUT STATE ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null); 
  
  const [selectedCustomer, setSelectedCustomer] = useState<Partner | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);
  
  // Financials
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('amount');
  const [vatRate, setVatRate] = useState<number>(settings.finance.vat || 0);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  
  // Features
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [printData, setPrintData] = useState<any | null>(null);

  // Sync vatRate with settings if settings load later
  useEffect(() => {
      if (settings.finance.vat !== undefined) {
          setVatRate(settings.finance.vat);
      }
  }, [settings.finance.vat]);

  // --- 1. DATA FETCHING ---
  const products = useLiveQuery(async () => {
      let collection = db.products.toCollection();
      if (activeBrand !== 'all') collection = db.products.where('brand').equals(activeBrand);
      
      let all = await collection.toArray();
      
      // Filter Soft Deleted
      all = all.filter((p: any) => !p.isDeleted);
      
      if (activeCategory !== 'all') {
          all = all.filter(p => p.location === activeCategory);
      }

      const norm = removeVietnameseTones(deferredSearchQuery.trim());
      if (norm) {
          all = all.filter(p => removeVietnameseTones(`${p.sku} ${p.name}`).includes(norm));
      }
      return all;
  }, [deferredSearchQuery, activeBrand, activeCategory]) || [];

  const filteredCustomers = useLiveQuery(async () => {
      if (!customerSearch) return [];
      const norm = removeVietnameseTones(customerSearch);
      return (await db.partners.where('type').equals(PartnerType.Customer).toArray())
          .filter(p => !p.isDeleted && (removeVietnameseTones(p.name).includes(norm) || p.phone.includes(customerSearch)))
          .slice(0, 5);
  }, [customerSearch]) || [];

  // Reset page when filter changes
  useEffect(() => { 
      setCurrentPage(1); 
  }, [deferredSearchQuery, activeBrand, activeCategory]);

  const totalPages = Math.ceil(products.length / itemsPerPage);
  
  // Clamp Page
  useEffect(() => {
      if (totalPages > 0 && currentPage > totalPages) {
          setCurrentPage(totalPages);
      }
  }, [totalPages, currentPage]);

  const pagedProducts = products.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  // --- 2. CALCULATIONS ---
  const subTotal = useMemo(() => cart.reduce((s, i) => s + ((i.customPrice ?? i.retailPrice) * i.quantity), 0), [cart]);
  
  const discountAmount = useMemo(() => {
      if (discountType === 'percent') {
          const percent = Math.min(100, Math.max(0, discount));
          return Math.min(subTotal, (subTotal * percent) / 100);
      }
      return Math.min(subTotal, Math.max(0, discount));
  }, [subTotal, discount, discountType]);

  const vatAmount = useMemo(() => {
      const taxable = Math.max(0, subTotal - discountAmount);
      return (taxable * Math.max(0, vatRate)) / 100;
  }, [subTotal, discountAmount, vatRate]);

  const finalTotal = Math.max(0, subTotal - discountAmount + vatAmount);

  // --- 3. ACTIONS ---
  
  // Hook for Payment Action (Anti-Double Submit)
  const { execute: processPayment, isLoading: isProcessing } = useAsyncAction(async (isDebt: boolean) => {
      if (cart.length === 0) return;
      if (isDebt && !selectedCustomer) { throw new Error('Vui lòng chọn khách hàng để ghi nợ'); }
      
      if (isDebt && selectedCustomer?.debtLimit) {
          const currentDebt = selectedCustomer.debt || 0;
          if (currentDebt + finalTotal > selectedCustomer.debtLimit) {
              const proceed = await confirm({
                  title: 'CẢNH BÁO HẠN MỨC NỢ',
                  message: `Khách nợ: ${formatCurrency(currentDebt)}. Đơn này: ${formatCurrency(finalTotal)}. Sẽ vượt hạn mức. Tiếp tục?`,
                  type: 'danger',
                  confirmLabel: 'Vẫn ghi nợ'
              });
              if (!proceed) return;
          }
      }

      const orderData = { 
          cart: cart.map(i => ({...i, retailPrice: i.customPrice ?? i.retailPrice})),
          customer: selectedCustomer, 
          customerName: selectedCustomer?.name || 'Khách lẻ', 
          amountPaid: isDebt ? 0 : finalTotal, 
          totalAmount: finalTotal,
          subtotal: subTotal,
          discount: discountAmount,
          vatRate,
          vatAmount,
          paymentMethod,
          status: isDebt ? 'Processing' : 'Completed',
          fulfillmentStatus: 'Delivered',
          paymentStatus: isDebt ? 'Unpaid' : 'Paid'
      };

      const order = await createOrder(orderData);
      
      if (order) { 
          setPrintData({ ...order, items: cart });
          setCart([]); 
          setSelectedCustomer(null); 
          setCustomerSearch(''); 
          setDiscount(0);
          setAmountReceived(0);
          setSelectedCartItemId(null);
      }
  }, {
      // successMessage handled inside createOrder context currently, or we can add here
  });

  // Modern Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (((e.ctrlKey || e.metaKey) && e.key === 'f') || e.key === 'F3') { 
              e.preventDefault(); 
              searchInputRef.current?.focus(); 
          }
          if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F9') { 
              e.preventDefault(); 
              if (cart.length > 0 && !isProcessing) processPayment(false); 
          }
          if (e.key === 'F4') { 
              e.preventDefault(); 
              if(cart.length > 0) handleHoldCart(); 
          }
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCartItemId) {
              const activeTag = document.activeElement?.tagName;
              if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                  e.preventDefault();
                  removeCartItem(selectedCartItemId);
                  setSelectedCartItemId(null);
              }
          }
          if (e.key === 'Escape') { 
              setIsCustomerDropdownOpen(false); 
              setShowHeldCarts(false); 
              searchInputRef.current?.blur(); 
              setSelectedCartItemId(null);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCustomer, heldCarts, selectedCartItemId, isProcessing]);

  const addToCart = (product: Product) => {
    const available = calcAvailableStock(product.stock, product.stockReserved);
    const existingItem = cart.find(item => item.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty + 1 > available) { 
        showNotification(`Sản phẩm chỉ còn ${available} tồn khả dụng!`, 'error'); 
        return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
          return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSelectedCartItemId(product.id);
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
      if (updates.quantity !== undefined) {
          const item = cart.find(i => i.id === id);
          if (item) {
              const available = calcAvailableStock(item.stock, item.stockReserved);
              if (updates.quantity > available) {
                  showNotification(`Số lượng ${updates.quantity} vượt quá tồn kho (${available})`, 'error');
                  return;
              }
          }
      }
      setCart(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
      setSelectedCartItemId(id);
  };

  const removeCartItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const handleDiscountBlur = () => {
      if (discountType === 'percent') {
          if (discount > 100) setDiscount(100);
          if (discount < 0) setDiscount(0);
      } else {
          if (discount > subTotal) setDiscount(subTotal);
          if (discount < 0) setDiscount(0);
      }
  };

  const handleHoldCart = () => {
      if (cart.length === 0) return;
      const newHold: HeldCart = {
          id: `hold-${Date.now()}`,
          customer: selectedCustomer,
          items: cart,
          timestamp: Date.now(),
          note: selectedCustomer ? selectedCustomer.name : `Khách lẻ ${new Date().toLocaleTimeString()}`
      };
      setHeldCarts(prev => [newHold, ...prev]);
      setCart([]);
      setSelectedCustomer(null);
      showNotification('Đã lưu đơn hàng tạm', 'success');
  };

  const handleResumeCart = async (holdId: string) => {
      const target = heldCarts.find(h => h.id === holdId);
      if (target) {
          if (cart.length > 0) {
              const ok = await confirm({
                  title: 'Ghi đè giỏ hàng?',
                  message: 'Giỏ hàng hiện tại sẽ bị thay thế. Bạn có chắc không?',
                  type: 'warning',
                  confirmLabel: 'Ghi đè'
              });
              if(!ok) return;
          }
          setCart(target.items);
          setSelectedCustomer(target.customer);
          setHeldCarts(prev => prev.filter(h => h.id !== holdId));
          setShowHeldCarts(false);
          showNotification('Đã khôi phục đơn hàng', 'success');
      }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] w-full gap-0 bg-slate-50 dark:bg-[#0b1121] overflow-hidden">
      
      {/* === LEFT PANE: CATALOG AREA === */}
      <div className="flex-1 flex min-w-0 h-full border-r border-slate-200 dark:border-slate-800">
        
        {/* 1. Vertical Navigation Rail (Categories) - COMPACT */}
        <div className="w-[60px] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 overflow-y-auto no-scrollbar py-4 gap-3 items-center z-20">
            {POS_CATEGORIES.map(cat => (
                <button 
                    key={cat.id} 
                    onClick={() => setActiveCategory(cat.id)}
                    className={`size-10 flex items-center justify-center rounded-xl transition-all group relative ${
                        activeCategory === cat.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' 
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={cat.label}
                >
                    <span className={`material-symbols-outlined text-[24px] transition-transform duration-300 ${activeCategory === cat.id ? '' : 'group-hover:scale-110'}`}>{cat.icon}</span>
                </button>
            ))}
        </div>

        {/* 2. Main Catalog Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-[#0b1121]">
            
            {/* Sticky Header: Search & Brands */}
            <div className="bg-white/80 dark:bg-[#0b1121]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0 z-10 px-5 py-3 space-y-3">
                
                {/* Search Input */}
                <div className="relative group w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined group-focus-within:text-blue-600 transition-colors">search</span>
                    <input 
                        ref={searchInputRef}
                        className="w-full pl-11 pr-20 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 placeholder:text-slate-400 transition-all shadow-inner"
                        placeholder="Tìm kiếm sản phẩm (Tên, SKU, Quy cách)..." 
                        value={searchQuery} 
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="pointer-events-auto p-1 text-slate-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-[18px]">cancel</span></button>}
                        <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">F3</span>
                    </div>
                </div>

                {/* Brand Filters */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Thương hiệu:</span>
                    <button 
                        onClick={() => setActiveBrand('all')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap ${
                            activeBrand === 'all'
                            ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        Tất cả
                    </button>
                    {PRODUCT_BRANDS.map(brand => (
                        <button 
                            key={brand} 
                            onClick={() => setActiveBrand(activeBrand === brand ? 'all' : brand)} 
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap ${
                                activeBrand === brand 
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 shadow-sm' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {brand}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {products.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="size-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-[40px] opacity-50">inventory_2</span>
                        </div>
                        <p className="font-bold text-sm">Không tìm thấy sản phẩm</p>
                        <p className="text-xs mt-1 opacity-70">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                    </div>
                ) : (
                    // Update: Force 3 columns on large screens
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
                        {pagedProducts.map(p => {
                            const available = calcAvailableStock(p.stock, p.stockReserved);
                            const isLowStock = available <= (p.minStock || 5);
                            const isOut = available <= 0;
                            
                            return (
                            <button 
                                key={p.id} 
                                onClick={() => addToCart(p)} 
                                className="group relative flex flex-col justify-between bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] text-left h-[170px] overflow-hidden"
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        {/* Highlighted Brand Tag */}
                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800 uppercase tracking-wider">{p.brand}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${isOut ? 'bg-red-50 text-red-600 border-red-100' : isLowStock ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                            SL: {available}
                                        </span>
                                    </div>
                                    {/* Increased Name Font Size */}
                                    <h4 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                                        {p.name}
                                    </h4>
                                    {/* Framed SKU */}
                                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-lg inline-block">
                                        {p.sku}
                                    </span>
                                </div>
                                
                                <div className="flex items-end justify-between mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-700">
                                    <span className="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight">
                                        {formatCurrency(p.retailPrice).replace(' VND','')}
                                    </span>
                                    <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-700 group-hover:bg-blue-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">add</span>
                                    </div>
                                </div>
                            </button>
                        )})}
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="p-3 bg-white dark:bg-[#0b1121] border-t border-slate-200 dark:border-slate-800 shrink-0">
                <Pagination currentPage={currentPage} totalItems={products.length} pageSize={itemsPerPage} onPageChange={setCurrentPage} />
            </div>
        </div>
      </div>

      {/* === RIGHT PANE: CART === */}
      <div className="w-[420px] flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-20">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-30">
              <div className="flex gap-2">
                  <div className="relative flex-1 group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-slate-400 group-focus-within:text-blue-500 transition-colors">person</span>
                      </div>
                      <input 
                          ref={customerInputRef}
                          value={customerSearch} 
                          onChange={e => { setCustomerSearch(e.target.value); setIsCustomerDropdownOpen(true); }}
                          onFocus={() => setIsCustomerDropdownOpen(true)}
                          className="w-full pl-10 pr-8 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm font-bold transition-all outline-none"
                          placeholder="Tìm khách hàng (F2)..."
                      />
                      {selectedCustomer && (
                          <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-red-400 hover:text-red-600">
                              <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                      )}
                      
                      {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-fadeIn">
                              {filteredCustomers.map(c => (
                                  <div key={c.id} onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setIsCustomerDropdownOpen(false); }} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0">
                                      <p className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</p>
                                      <div className="flex justify-between mt-0.5">
                                          <p className="text-xs text-slate-500">{c.phone}</p>
                                          {c.debt && c.debt > 0 && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 rounded">Nợ: {formatCurrency(c.debt)}</span>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="relative">
                      <button 
                        onClick={() => setShowHeldCarts(!showHeldCarts)}
                        className={`size-[46px] flex items-center justify-center rounded-xl border transition-all relative ${heldCarts.length > 0 ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'}`}
                        title="Đơn hàng tạm (F4)"
                      >
                          <span className="material-symbols-outlined">pause_circle</span>
                          {heldCarts.length > 0 && <span className="absolute -top-1 -right-1 size-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full shadow-sm">{heldCarts.length}</span>}
                      </button>
                      
                      {showHeldCarts && heldCarts.length > 0 && (
                          <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-fadeIn">
                              <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 font-bold text-xs text-slate-500 uppercase">Đơn đang giữ</div>
                              <div className="max-h-60 overflow-y-auto">
                                  {heldCarts.map(h => (
                                      <div key={h.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center group cursor-pointer" onClick={() => handleResumeCart(h.id)}>
                                          <div>
                                              <p className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[180px]">{h.note}</p>
                                              <p className="text-xs text-slate-500">{new Date(h.timestamp).toLocaleTimeString()} • {h.items.length} SP</p>
                                          </div>
                                          <span className="material-symbols-outlined text-blue-500 opacity-0 group-hover:opacity-100">play_circle</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
                  
                  <button onClick={handleHoldCart} className="size-[46px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors" title="Giữ đơn hiện tại">
                      <span className="material-symbols-outlined">save_as</span>
                  </button>
              </div>
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-50/50 dark:bg-[#0b1121]/50 relative">
              {cart.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-60 pointer-events-none select-none">
                      <div className="size-32 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                          <span className="material-symbols-outlined text-[64px]">shopping_cart</span>
                      </div>
                      <p className="font-bold text-lg text-slate-500">Giỏ hàng trống</p>
                      <p className="text-xs mt-2">Chọn sản phẩm bên trái để thêm</p>
                  </div>
              ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {cart.map((item, idx) => {
                          const available = calcAvailableStock(item.stock, item.stockReserved);
                          const isSelected = selectedCartItemId === item.id;
                          const isWarning = item.quantity > available;

                          return (
                          <div 
                            key={item.id} 
                            onClick={() => setSelectedCartItemId(item.id)}
                            className={`group p-3 transition-all relative ${
                                isSelected 
                                ? 'bg-blue-50 dark:bg-blue-900/10' 
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                              {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}
                              
                              <div className="flex justify-between items-start mb-1">
                                  <div className="min-w-0 pr-2">
                                      <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{item.name}</h4>
                                      <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{item.sku}</span>
                                          {isWarning && <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">warning</span> Quá tồn ({available})</span>}
                                      </div>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); removeCartItem(item.id); }} className="text-slate-300 hover:text-red-500 transition-colors p-1 -mr-2 -mt-2"><span className="material-symbols-outlined text-[16px]">close</span></button>
                              </div>

                              <div className="flex items-end justify-between">
                                  <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg h-7 shadow-sm">
                                      <button onClick={(e) => { e.stopPropagation(); updateCartItem(item.id, { quantity: Math.max(1, item.quantity - 1) }); }} className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-l-lg transition-colors"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                                      <div className="w-8 text-center font-bold text-sm border-x border-slate-100 dark:border-slate-700">
                                          <InlineNumberEdit 
                                              value={item.quantity}
                                              onChange={(val) => updateCartItem(item.id, { quantity: val })}
                                              min={1}
                                              max={available}
                                              align="center"
                                              className="w-full h-full flex items-center justify-center"
                                              inputClassName="text-center h-full text-xs"
                                          />
                                      </div>
                                      <button onClick={(e) => { e.stopPropagation(); updateCartItem(item.id, { quantity: item.quantity + 1 }); }} className="w-7 h-full flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-r-lg transition-colors"><span className="material-symbols-outlined text-[14px]">add</span></button>
                                  </div>

                                  <div className="text-right">
                                      <div className="flex items-center justify-end gap-1 group/price">
                                          <InlineNumberEdit 
                                              value={item.customPrice ?? item.retailPrice} 
                                              onChange={(val) => updateCartItem(item.id, { customPrice: val })}
                                              min={0}
                                              className="font-medium text-[11px] text-slate-500 decoration-dotted underline decoration-slate-300 cursor-text hover:text-blue-600"
                                              align="right"
                                              format={(val) => formatCurrency(val).replace(' VND','')}
                                          />
                                      </div>
                                      <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                                          {formatCurrency((item.customPrice ?? item.retailPrice) * item.quantity).replace(' VND', '')}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )})}
                  </div>
              )}
          </div>

          {/* Checkout Area - Redesigned & Compact */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-40">
              
              {/* Summary Rows - Tighter spacing */}
              <div className="space-y-1 mb-2 text-xs">
                  <div className="flex justify-between items-center text-slate-500">
                      <span className="font-medium">Tạm tính</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(subTotal)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-slate-500">
                      <div className="flex items-center gap-2">
                          <span className="font-medium">Giảm giá</span>
                          <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-0.5">
                              <button onClick={() => { setDiscountType('amount'); setDiscount(0); }} className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${discountType === 'amount' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>$</button>
                              <button onClick={() => { setDiscountType('percent'); setDiscount(0); }} className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${discountType === 'percent' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>%</button>
                          </div>
                      </div>
                      <div className="flex items-center gap-1">
                          <span>-</span>
                          <InlineNumberEdit 
                              value={discount} 
                              onChange={(val) => setDiscount(Math.max(0, val))}
                              onBlur={handleDiscountBlur}
                              className="font-bold text-rose-500 border-b border-dashed border-rose-300 min-w-[40px]"
                              align="right"
                          />
                      </div>
                  </div>

                  <div className="flex justify-between items-center text-slate-500">
                      <div className="flex items-center gap-2">
                          <span className="font-medium">VAT</span>
                          <select 
                              value={vatRate} 
                              onChange={(e) => setVatRate(Number(e.target.value))}
                              className="bg-slate-100 dark:bg-slate-800 border-none rounded px-1 py-0 text-[10px] font-bold outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                          >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={8}>8%</option>
                              <option value={10}>10%</option>
                          </select>
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(vatAmount)}</span>
                  </div>
              </div>

              {/* Big Total - Compact */}
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 p-2 rounded-xl mb-3 border border-blue-100 dark:border-blue-900/30">
                  <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">TỔNG</span>
                  <span className="text-2xl font-black text-blue-700 dark:text-blue-300 tracking-tighter leading-none">{formatCurrency(finalTotal).replace(' VND','')}</span>
              </div>

              {/* Payment Methods - Compact */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                  {PAYMENT_METHOD_OPTIONS.filter(m => m.value !== 'debt').map(m => (
                      <button 
                          key={m.value} 
                          onClick={() => setPaymentMethod(m.value as PaymentMethod)}
                          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border transition-all active:scale-95 ${paymentMethod === m.value ? 'bg-slate-800 border-slate-800 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-sm' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-400 hover:border-slate-300'}`}
                      >
                          <span className="material-symbols-outlined text-[18px] filled-icon">{m.icon}</span>
                          <span className="text-[9px] font-black uppercase tracking-wider">{m.label}</span>
                      </button>
                  ))}
              </div>

              {/* Cash Calculation - Redesigned & Compact */}
              {paymentMethod === 'cash' && (
                  <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 animate-fadeIn">
                      <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase pointer-events-none">Khách đưa</span>
                              <input 
                                  type="number"
                                  value={amountReceived === 0 ? '' : amountReceived} 
                                  onChange={e => setAmountReceived(Number(e.target.value))} 
                                  className="w-full text-right font-mono font-bold text-base bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg pl-20 pr-2 py-1.5 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all" 
                                  placeholder="0"
                              />
                          </div>
                          <button 
                              onClick={() => setAmountReceived(finalTotal)} 
                              className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition-all h-[34px] flex items-center justify-center shrink-0"
                              title="Nhập đủ số tiền"
                          >
                              Đủ
                          </button>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-700 border-dashed">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Tiền thừa</span>
                          <span className={`font-mono font-black text-lg ${amountReceived >= finalTotal ? 'text-emerald-600' : 'text-red-500'}`}>
                              {amountReceived >= finalTotal ? formatCurrency(amountReceived - finalTotal).replace(' VND', '') : `Thiếu ${formatCurrency(finalTotal - amountReceived).replace(' VND', '')}`}
                          </span>
                      </div>
                  </div>
              )}

              {/* Main Actions - Compact */}
              <div className="grid grid-cols-4 gap-2">
                  <button 
                    onClick={() => {
                        if (!selectedCustomer) {
                            showNotification('Vui lòng chọn khách hàng để ghi nợ', 'warning');
                            customerInputRef.current?.focus();
                            return;
                        }
                        processPayment(true);
                    }} 
                    disabled={isProcessing}
                    className="col-span-1 flex flex-col items-center justify-center py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                  >
                      <span className="material-symbols-outlined text-[18px] mb-0.5">history_edu</span>
                      Ghi Nợ
                  </button>
                  <button 
                    onClick={() => processPayment(false)} 
                    disabled={isProcessing}
                    className="col-span-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wide shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isProcessing ? (
                          <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Đang xử lý...</>
                      ) : (
                          <>Thanh toán <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span></>
                      )}
                  </button>
              </div>
          </div>
      </div>

      <PrintPreviewModal isOpen={!!printData} onClose={() => setPrintData(null)} data={printData} />
    </div>
  );
};

export default POS;
