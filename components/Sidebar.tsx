
import React from 'react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

const MENU_GROUPS = [
  {
    label: 'Tổng quan',
    items: [
      { id: 'DASHBOARD', label: 'Tổng quan', icon: 'grid_view', badge: 'AI' },
    ]
  },
  {
    label: 'Kinh doanh',
    items: [
      { id: 'POS', label: 'Bán hàng (POS)', icon: 'point_of_sale' },
      { id: 'ORDERS', label: 'Đơn hàng', icon: 'receipt_long' },
      { id: 'QUOTES', label: 'Báo giá', icon: 'request_quote' },
    ]
  },
  {
    label: 'Kho vận',
    items: [
      { id: 'INVENTORY', label: 'Kho hàng', icon: 'inventory_2' },
      { id: 'IMPORTS', label: 'Nhập hàng', icon: 'move_to_inbox' },
      { id: 'DELIVERY_NOTES', label: 'Giao hàng', icon: 'local_shipping' },
    ]
  },
  {
    label: 'Tài chính & Đối tác',
    items: [
      { id: 'PARTNERS', label: 'Đối tác', icon: 'groups' },
      { id: 'DEBTS', label: 'Công nợ', icon: 'account_balance_wallet' },
      { id: 'TRANSACTIONS', label: 'Sổ quỹ', icon: 'payments' },
    ]
  }
];

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const isSettingsActive = currentView === 'SETTINGS';

  return (
    <aside 
        className="h-full bg-gradient-to-b from-[#74B9C4] to-[#5493C9] dark:from-[#0F172A] dark:to-[#1E293B] border-r border-white/10 dark:border-slate-800 flex flex-col relative z-sticky shadow-2xl w-full text-white transition-colors duration-300"
    >
      <style>{`
        .sidebar-icon {
            transition: font-variation-settings 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .sidebar-btn:hover .sidebar-icon {
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            transform: scale(1.2) rotate(6deg);
        }
        .sidebar-btn.active .sidebar-icon {
            font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24;
            transform: scale(1.1);
        }
        .sidebar-btn:active .sidebar-icon {
            transform: scale(0.95) rotate(-3deg);
        }
        /* Settings Icon Specific */
        .sidebar-btn:hover .settings-icon {
            transform: none; /* Override standard rotation */
            animation: spin 3s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
      `}</style>

      {/* 1. Brand Logo Area */}
      <div className="h-[72px] flex items-center shrink-0 border-b border-white/10 dark:border-slate-800 px-6 gap-3">
          <div className="size-10 flex items-center justify-center rounded-xl bg-white text-[#4A86BF] dark:bg-[#334155] dark:text-[#38bdf8] shadow-lg shrink-0 transition-colors group cursor-pointer hover:scale-105 duration-300">
              <span className="material-symbols-outlined text-[24px]">dataset</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-[18px] font-black text-white leading-none tracking-tight font-sans">HƯNG THỊNH</h1>
            <span className="text-[11px] font-bold text-blue-50 dark:text-slate-400 uppercase tracking-[0.2em] mt-1">Enterprise</span>
          </div>
      </div>

      {/* 2. Navigation Menu */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 space-y-8 overflow-x-hidden">
          {MENU_GROUPS.map((group, idx) => (
            <div key={idx} className="relative">
              {/* Section Label */}
              <div className="px-4 mb-2">
                  <h3 className="text-[11px] font-bold text-white/60 dark:text-slate-500 uppercase tracking-widest">
                      {group.label}
                  </h3>
              </div>
              
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const isActive = currentView === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => onChangeView(item.id as ViewState)}
                      className={`sidebar-btn group w-full flex items-center transition-all duration-200 gap-3 px-4 py-3 rounded-xl mb-1 relative overflow-hidden ${
                        isActive 
                        ? 'active bg-white text-[#4A86BF] shadow-lg font-bold dark:bg-[#334155] dark:text-[#38bdf8] dark:shadow-none' 
                        : 'text-white font-medium hover:bg-white/10 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <span className="sidebar-icon material-symbols-outlined shrink-0 text-[22px] relative z-10">
                        {item.icon}
                      </span>
                      
                      <span className="text-[14px] flex-1 text-left truncate tracking-wide relative z-10">
                        {item.label}
                      </span>
                      
                      {/* Badge */}
                      {(item as any).badge && (
                        <span className={`relative z-10 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest border ${
                            isActive 
                            ? 'bg-[#4A86BF]/10 text-[#4A86BF] border-[#4A86BF]/20 dark:bg-[#38bdf8]/10 dark:text-[#38bdf8] dark:border-[#38bdf8]/20' 
                            : 'bg-white/20 text-white border-white/20 group-hover:border-white/40 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                        }`}>{(item as any).badge}</span>
                      )}

                      {/* Hover Shine Effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
      </div>

      {/* 3. Footer Profile */}
      <div className="p-4 mt-auto border-t border-white/10 dark:border-slate-800">
          <div 
            onClick={() => onChangeView('SETTINGS')}
            className={`sidebar-btn rounded-xl transition-all duration-300 cursor-pointer p-3 flex items-center gap-3 group border border-transparent ${
                isSettingsActive 
                ? 'active bg-white text-[#4A86BF] shadow-lg dark:bg-[#334155] dark:text-[#38bdf8] dark:shadow-none' 
                : 'hover:bg-white/10 hover:border-white/10 dark:hover:bg-slate-800 dark:hover:border-slate-700'
            }`}
          >
              <div className={`size-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner ring-1 shrink-0 group-hover:scale-105 transition-transform backdrop-blur-sm ${
                  isSettingsActive
                  ? 'bg-[#4A86BF]/10 text-[#4A86BF] ring-[#4A86BF]/20 dark:bg-[#38bdf8]/10 dark:text-[#38bdf8] dark:ring-[#38bdf8]/20'
                  : 'bg-white/20 text-white ring-white/20 dark:bg-slate-700 dark:ring-slate-600'
              }`}>
                  XQ
              </div>
              
              <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${isSettingsActive ? 'text-[#4A86BF] dark:text-[#38bdf8]' : 'text-white'}`}>Xun Quý</p>
                  <p className={`text-[11px] font-medium truncate ${isSettingsActive ? 'text-[#4A86BF]/70 dark:text-[#38bdf8]/70' : 'text-blue-50 dark:text-slate-400'}`}>Quản trị viên</p>
              </div>
              
              <span className={`sidebar-icon settings-icon material-symbols-outlined text-[20px] ${
                  isSettingsActive 
                  ? 'text-[#4A86BF] dark:text-[#38bdf8]' 
                  : 'text-blue-100 dark:text-slate-500 group-hover:text-white'
              }`}>settings</span>
          </div>
      </div>
    </aside>
  );
};

export default Sidebar;
