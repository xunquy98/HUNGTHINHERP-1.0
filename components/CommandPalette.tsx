
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchResult, ViewState } from '../types';
import { useGlobalSearch } from '../hooks/useGlobalSearch';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: ViewState, params?: any) => void;
}

const QUICK_ACTIONS = [
    { id: 'act-pos', title: 'Bán hàng (POS)', subtitle: 'Tạo đơn hàng mới', icon: 'point_of_sale', view: 'POS' as ViewState, type: 'ACTION' },
    { id: 'act-quotes', title: 'Báo giá', subtitle: 'Quản lý & tạo báo giá', icon: 'request_quote', view: 'QUOTES' as ViewState, type: 'ACTION' },
    { id: 'act-orders', title: 'Đơn hàng', subtitle: 'Danh sách đơn bán', icon: 'receipt_long', view: 'ORDERS' as ViewState, type: 'ACTION' },
    { id: 'act-imports', title: 'Nhập hàng', subtitle: 'Quản lý nhập kho', icon: 'move_to_inbox', view: 'IMPORTS' as ViewState, type: 'ACTION' },
    { id: 'act-inventory', title: 'Kho hàng', subtitle: 'Tồn kho & Sản phẩm', icon: 'inventory_2', view: 'INVENTORY' as ViewState, type: 'ACTION' },
    { id: 'act-partners', title: 'Đối tác', subtitle: 'Khách hàng & Nhà cung cấp', icon: 'groups', view: 'PARTNERS' as ViewState, type: 'ACTION' },
    { id: 'act-debts', title: 'Công nợ', subtitle: 'Phải thu & Phải trả', icon: 'account_balance_wallet', view: 'DEBTS' as ViewState, type: 'ACTION' },
    { id: 'act-transactions', title: 'Sổ quỹ', subtitle: 'Thu chi tiền mặt', icon: 'payments', view: 'TRANSACTIONS' as ViewState, type: 'ACTION' },
    { id: 'act-reports', title: 'Báo cáo', subtitle: 'Hiệu quả kinh doanh', icon: 'donut_large', view: 'REPORTS' as ViewState, type: 'ACTION' },
    { id: 'act-settings', title: 'Cài đặt', subtitle: 'Cấu hình hệ thống', icon: 'settings', view: 'SETTINGS' as ViewState, type: 'ACTION' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'search' | 'actions'>('search');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Use existing global search logic
    const { results: searchResults, isSearching } = useGlobalSearch(query);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setActiveTab('search'); // Default to search input
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Derived list based on state
    const filteredActions = useMemo(() => {
        if (!query) return QUICK_ACTIONS;
        const lower = query.toLowerCase();
        return QUICK_ACTIONS.filter(a => 
            a.title.toLowerCase().includes(lower) || 
            a.subtitle.toLowerCase().includes(lower)
        );
    }, [query]);

    const displayList = useMemo(() => {
        if (activeTab === 'actions') return filteredActions;
        
        // Search Tab logic: if query is empty, show actions as default empty state suggestions?
        // Or keep it strictly separate. Let's make it smart:
        // If empty query in search tab -> empty state or maybe recent items (not implemented).
        // Let's stick to showing nothing or "Start typing" in search tab if empty.
        
        if (!query) return []; 
        return searchResults;
    }, [activeTab, query, filteredActions, searchResults]);

    // Handle Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, displayList.length - 1));
                    scrollSelectedIntoView(selectedIndex + 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                    scrollSelectedIntoView(selectedIndex - 1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    const selected = displayList[selectedIndex];
                    if (selected) handleSelect(selected);
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                case 'Tab':
                    e.preventDefault();
                    setActiveTab(prev => prev === 'search' ? 'actions' : 'search');
                    setSelectedIndex(0);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, displayList, selectedIndex, activeTab]);

    const scrollSelectedIntoView = (index: number) => {
        if (listRef.current) {
            const items = listRef.current.children;
            if (items[index]) {
                items[index].scrollIntoView({ block: 'nearest' });
            }
        }
    };

    const handleSelect = (item: any) => {
        if (item.type === 'ACTION') {
            onNavigate(item.view);
        } else {
            // Search Result
            onNavigate(item.view, { 
                highlightId: item.highlightId || item.id,
                code: item.code 
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh] bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.1s_ease-out]" onClick={onClose}>
            <div 
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10 flex flex-col mx-4 transform transition-all" 
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input Area */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="material-symbols-outlined text-slate-400 text-[24px]">
                        {activeTab === 'search' ? 'search' : 'bolt'}
                    </span>
                    <input 
                        ref={inputRef}
                        className="flex-1 bg-transparent border-none outline-none text-lg text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
                        placeholder={activeTab === 'search' ? "Tìm kiếm dữ liệu..." : "Tìm thao tác nhanh..."}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                    />
                    <div className="flex gap-2 text-[10px] font-bold text-slate-400">
                        <span className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">TAB</span>
                        <span>đổi tab</span>
                        <span className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">ESC</span>
                        <span>đóng</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    <button 
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'search' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        onClick={() => { setActiveTab('search'); setSelectedIndex(0); inputRef.current?.focus(); }}
                    >
                        Kết quả tìm kiếm
                    </button>
                    <button 
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'actions' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        onClick={() => { setActiveTab('actions'); setSelectedIndex(0); inputRef.current?.focus(); }}
                    >
                        Thao tác nhanh
                    </button>
                </div>

                {/* Content List */}
                <div 
                    ref={listRef}
                    className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2 space-y-1 min-h-[300px]"
                >
                    {/* Loading State for Search */}
                    {activeTab === 'search' && isSearching && (
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                            <span className="material-symbols-outlined animate-spin text-3xl mb-2">sync</span>
                            <p className="text-xs">Đang tìm kiếm...</p>
                        </div>
                    )}

                    {/* Empty State for Search */}
                    {activeTab === 'search' && !query && !isSearching && (
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">keyboard</span>
                            <p className="text-xs">Nhập từ khóa để tìm kiếm Đơn hàng, Sản phẩm, Đối tác...</p>
                        </div>
                    )}

                    {/* Empty Result */}
                    {displayList.length === 0 && query && !isSearching && (
                        <div className="py-12 text-center text-slate-400">
                            <p className="text-xs">Không tìm thấy kết quả phù hợp.</p>
                        </div>
                    )}

                    {/* Items */}
                    {displayList.map((item: any, index) => (
                        <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                                index === selectedIndex 
                                ? 'bg-blue-600 text-white shadow-md transform scale-[1.01]' 
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                                index === selectedIndex ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}>
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold truncate ${index === selectedIndex ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                        {item.title}
                                    </span>
                                    {item.status && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                            index === selectedIndex ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                        }`}>
                                            {item.status}
                                        </span>
                                    )}
                                </div>
                                <p className={`text-xs truncate mt-0.5 ${index === selectedIndex ? 'text-blue-100' : 'text-slate-500'}`}>
                                    {item.subtitle}
                                </p>
                            </div>
                            {index === selectedIndex && (
                                <span className="material-symbols-outlined text-[18px]">keyboard_return</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
