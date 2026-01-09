
import React from 'react';
import { SearchInput } from '../ui/Primitives';

interface TableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  leftFilters?: React.ReactNode;
  rightActions?: React.ReactNode;
  children?: React.ReactNode; // Slot for bottom content like Chips/Tabs
  className?: string;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchValue,
  onSearchChange,
  placeholder = "Tìm kiếm...",
  leftFilters,
  rightActions,
  children,
  className = ''
}) => {
  return (
    <div className={`sticky top-0 z-sticky bg-white/80 dark:bg-[#0b1121]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all ${className}`}>
      <div className="px-6 py-3 space-y-3">
        {/* Top Row: Search - Left Filters - Right Actions */}
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
          <div className="flex gap-3 flex-1 w-full lg:w-auto items-center overflow-x-auto no-scrollbar">
            <SearchInput 
              value={searchValue} 
              onChange={onSearchChange} 
              placeholder={placeholder}
              className="w-full lg:max-w-xs min-w-[200px]"
            />
            {leftFilters}
          </div>
          
          {rightActions && (
            <div className="shrink-0 flex items-center gap-2 animate-fadeIn">
              {rightActions}
            </div>
          )}
        </div>

        {/* Bottom Row: Additional Filters/Chips */}
        {children && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
