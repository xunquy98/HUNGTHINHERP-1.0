
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, SearchResult } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { CommandPalette } from './CommandPalette'; 
import AIChat from './AIChat';
import { NotificationsDrawer } from './notifications/NotificationsDrawer';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { VoiceCommandButton } from './VoiceCommandButton';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';

interface TopbarProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  onNavigate: (view: ViewState, params?: any) => void;
  currentView: ViewState;
  onMenuClick: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ isDarkMode, toggleTheme, onNavigate, currentView, onMenuClick }) => {
  const { notifications } = useAppContext();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  // --- Inline Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  const { results, isSearching } = useGlobalSearch(searchQuery);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { 
          e.preventDefault(); 
          setIsPaletteOpen(true); 
      }
      if (e.key === 'Escape') {
          setIsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Click Outside to Close Dropdown ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = () => {
      switch(currentView) {
          case 'DASHBOARD': return { title: 'Dashboard', icon: 'grid_view' };
          case 'POS': return { title: 'Bán Hàng (POS)', icon: 'point_of_sale' };
          case 'ORDERS': return { title: 'Đơn Hàng', icon: 'receipt_long' };
          case 'INVENTORY': return { title: 'Kho Hàng', icon: 'inventory_2' };
          case 'PARTNERS': return { title: 'Đối Tác', icon: 'groups' };
          case 'DEBTS': return { title: 'Công Nợ', icon: 'account_balance_wallet' };
          case 'IMPORTS': return { title: 'Nhập Hàng', icon: 'move_to_inbox' };
          case 'TRANSACTIONS': return { title: 'Sổ Quỹ', icon: 'payments' };
          case 'REPORTS': return { title: 'Báo Cáo', icon: 'donut_large' };
          case 'SETTINGS': return { title: 'Cài Đặt', icon: 'tune' };
          case 'QUOTES': return { title: 'Báo Giá', icon: 'request_quote' };
          case 'DELIVERY_NOTES': return { title: 'Vận Chuyển', icon: 'local_shipping' };
          case 'AUDIT_LOGS': return { title: 'Nhật Ký', icon: 'history' };
          case 'SYSTEM_LOGS': return { title: 'Hệ Thống', icon: 'terminal' };
          default: return { title: 'Tổng Quan', icon: 'dashboard' };
      }
  };
  const pageInfo = getPageTitle();

  const handleResultClick = (result: SearchResult) => {
      onNavigate(result.view, { 
          highlightId: result.highlightId || result.id,
          code: result.code 
      });
      setIsDropdownOpen(false);
      setSearchQuery('');
  };

  const handleVoiceSearch = (query: string) => {
      setSearchQuery(query);
      setIsDropdownOpen(true);
  };

  return (
    <header className="h-16 lg:h-20 flex-shrink-0 bg-white/95 dark:bg-[#0b1121]/95 backdrop-blur-xl border-b border-[#74B9C4]/20 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-topbar transition-colors duration-300">
      
      {/* 1. Left: Menu & Page Info */}
      <div className="flex items-center gap-3 lg:gap-5 shrink-0">
          <button onClick={onMenuClick} className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-[#74B9C4]/10 dark:hover:bg-slate-800 lg:hidden transition-colors">
            <span className="material-symbols-outlined">menu</span>
          </button>
          
          <div className="hidden md:flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
              <div className="size-10 rounded-xl bg-gradient-to-br from-[#74B9C4] to-[#5493C9] shadow-md shadow-[#5493C9]/20 flex items-center justify-center text-white border border-white/20">
                  <span className="material-symbols-outlined text-[22px]">{pageInfo.icon}</span>
              </div>
              <div className="flex flex-col justify-center">
                  <span className="text-base font-black text-slate-900 dark:text-white leading-tight tracking-tight">{pageInfo.title}</span>
              </div>
          </div>
      </div>

      {/* 2. Center: Global Search (Inline) */}
      <div className="flex-1 max-w-2xl mx-6 lg:mx-12 relative hidden sm:block" ref={searchContainerRef}>
        <div className="relative group transition-all duration-300">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined group-focus-within:text-[#5493C9] dark:group-focus-within:text-blue-400 transition-colors pointer-events-none">search</span>
            <input 
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }}
                onFocus={() => { if(searchQuery.trim().length > 0) setIsDropdownOpen(true); }}
                className="w-full pl-12 pr-16 py-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 shadow-sm hover:bg-white dark:hover:bg-slate-800 hover:ring-2 hover:ring-[#74B9C4]/20 dark:hover:ring-blue-500/10 hover:border-[#74B9C4]/50 dark:hover:border-blue-500/30 focus:ring-2 focus:ring-[#5493C9]/20 dark:focus:ring-blue-500/20 focus:border-[#5493C9] dark:focus:border-blue-500 outline-none transition-all font-medium text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                placeholder="Tìm kiếm nhanh (Khách hàng, Đơn hàng, SKU...)"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <kbd className="inline-flex items-center h-5 px-1.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-400 dark:text-slate-400 shadow-sm font-mono">⌘K</kbd>
            </div>
        </div>

        {/* Inline Results Dropdown */}
        {isDropdownOpen && searchQuery.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-dropdown animate-fadeIn max-h-[60vh] overflow-y-auto custom-scrollbar">
                {isSearching ? (
                    <div className="p-4 text-center text-slate-500 text-xs font-medium flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[16px]">sync</span> Đang tìm kiếm...
                    </div>
                ) : results.length > 0 ? (
                    <div className="py-2">
                        <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kết quả tìm kiếm</div>
                        {results.map((result) => (
                            <button 
                                key={result.id}
                                onClick={() => handleResultClick(result as SearchResult)}
                                className="w-full text-left px-4 py-2.5 hover:bg-[#74B9C4]/10 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors group border-l-2 border-transparent hover:border-[#5493C9] dark:hover:border-blue-500"
                            >
                                <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-[#5493C9] dark:group-hover:text-blue-400 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors shrink-0 shadow-sm">
                                    <span className="material-symbols-outlined text-[18px]">{result.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-[#5493C9] dark:group-hover:text-blue-400 transition-colors">{result.title}</p>
                                        {result.status && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 shrink-0">{result.status}</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center flex flex-col items-center">
                        <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-[24px] text-slate-400">search_off</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Không tìm thấy kết quả</p>
                        <p className="text-xs text-slate-500 mt-1">Thử từ khóa khác hoặc kiểm tra lại chính tả.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* 3. Right: Utility & Profile */}
      <div className="flex items-center gap-2 lg:gap-4 shrink-0">
        
        {/* Mobile Search Trigger */}
        <button 
            onClick={() => setIsPaletteOpen(true)} 
            className="sm:hidden p-2 text-slate-500 hover:bg-[#74B9C4]/10 dark:hover:bg-slate-800 rounded-xl"
        >
            <span className="material-symbols-outlined">search</span>
        </button>

        {/* VOICE COMMAND BUTTON */}
        <VoiceCommandButton onNavigate={onNavigate} onSearchTrigger={handleVoiceSearch} />

        {/* AI Assistant */}
        <AIChat currentView={currentView} />

        {/* Theme Toggle */}
        <button 
            onClick={toggleTheme}
            className="size-10 rounded-full flex items-center justify-center text-slate-500 hover:text-[#5493C9] dark:hover:text-white bg-transparent hover:bg-[#74B9C4]/10 dark:hover:bg-slate-800 transition-all hidden sm:flex"
            title={isDarkMode ? "Chuyển sang Sáng" : "Chuyển sang Tối"}
        >
            <span className={`material-symbols-outlined text-[20px] transition-transform duration-500 ${isDarkMode ? 'rotate-180' : 'rotate-0'}`}>
                {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
        </button>

        {/* Notifications */}
        <div className="relative">
            <button 
                onClick={() => setIsNotifDrawerOpen(true)}
                className={`relative size-10 rounded-full flex items-center justify-center transition-all ${isNotifDrawerOpen ? 'bg-[#5493C9]/10 text-[#5493C9] dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-500 hover:text-[#5493C9] dark:hover:text-white hover:bg-[#74B9C4]/10 dark:hover:bg-slate-800'}`}
            >
                <span className="material-symbols-outlined text-[22px] filled-icon">notifications</span>
                {notifications.length > 0 && (
                    <span className="absolute top-2.5 right-2.5 size-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
                )}
            </button>
        </div>

      </div>

      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onNavigate={onNavigate} />
      <NotificationsDrawer isOpen={isNotifDrawerOpen} onClose={() => setIsNotifDrawerOpen(false)} onNavigate={onNavigate} />
    </header>
  );
};

export default Topbar;
