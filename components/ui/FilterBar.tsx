
import React from 'react';
import { SearchInput } from './Primitives';

interface FilterBarProps {
  onSearch: (val: string) => void;
  searchValue: string;
  placeholder?: string;
  children?: React.ReactNode; // For Dropdowns (Selects)
  chips?: React.ReactNode; // For Status/Tab Chips
  actions?: React.ReactNode; // For Bulk Actions or specialized buttons
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  onSearch, 
  searchValue, 
  placeholder = "Tìm kiếm...", 
  children, 
  chips, 
  actions,
  className = ''
}) => {
  return (
    <div className={`sticky top-0 z-sticky bg-white/80 dark:bg-[#0b1121]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all ${className}`}>
      <div className="px-6 py-3 space-y-3">
        {/* Top Row: Search + Filters + Actions */}
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
          <div className="flex gap-3 flex-1 w-full lg:w-auto overflow-x-auto no-scrollbar items-center">
            <SearchInput 
              value={searchValue} 
              onChange={onSearch} 
              placeholder={placeholder} 
              className="w-full lg:max-w-xs min-w-[200px]" 
            />
            {children}
          </div>
          
          {actions && (
            <div className="shrink-0 animate-fadeIn">
              {actions}
            </div>
          )}
        </div>

        {/* Bottom Row: Chips (Optional) */}
        {chips && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {chips}
          </div>
        )}
      </div>
    </div>
  );
};

export const FilterChip: React.FC<{ 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
  count?: number;
  color?: string; // Tailwind text/bg class set (e.g. "text-red-600 bg-red-50")
}> = ({ label, isActive, onClick, count, color }) => {
  const activeClass = color 
    ? `${color} ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm` 
    : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm';
    
  const inactiveClass = 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700';

  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
        isActive ? activeClass : inactiveClass
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
          {count}
        </span>
      )}
    </button>
  );
};
