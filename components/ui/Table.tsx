
import React from 'react';
import { TOKENS } from './Tokens';

// A standardized table shell with scroll support
export const TableContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col ${className}`}>
    <div className="flex-1 overflow-auto custom-scrollbar relative">
        {children}
    </div>
  </div>
);

export const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <table className="w-full text-sm text-left border-collapse min-w-[900px] md:min-w-full">
    {children}
  </table>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className={TOKENS.TABLE.HEADER}>
    {children}
  </thead>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className = '', ...props }) => (
  <tr 
    className={`${TOKENS.TABLE.ROW} ${className}`} 
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }> = ({ 
  children, className = '', align = 'left', ...props 
}) => (
  <th className={`${TOKENS.TABLE.HEADER_CELL} text-${align} ${className}`} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }> = ({ 
  children, className = '', align = 'left', ...props 
}) => (
  <td className={`${TOKENS.TABLE.CELL} text-${align} ${className}`} {...props}>
    {children}
  </td>
);

// Empty State for Tables
export const TableEmptyState: React.FC<{ message?: string; icon?: string; action?: React.ReactNode }> = ({ 
  message = "Không tìm thấy dữ liệu", 
  icon = "search_off",
  action
}) => (
  <tr>
    <td colSpan={100} className="px-6 py-20 text-center">
      <div className="flex flex-col items-center justify-center">
        <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4 ring-1 ring-slate-100 dark:ring-slate-700">
            <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600">{icon}</span>
        </div>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">{message}</p>
        {action}
      </div>
    </td>
  </tr>
);
