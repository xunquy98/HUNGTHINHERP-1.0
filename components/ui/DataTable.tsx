
import React from 'react';
import { TOKENS } from './Tokens';
import { TableContainer, Table, TableHeader, TableHead, TableRow, TableCell } from './Table';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface ColumnDef<T> {
  header: string | React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  sortable?: boolean;
}

interface SortItem {
  key: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  
  // Sorting
  sort?: {
    items: SortItem[];
    onSort: (key: string, isShift: boolean) => void;
  };

  // Selection
  selection?: {
    selectedIds: Set<string>;
    onSelectAll: (checked: boolean) => void;
    onSelectRow: (id: string) => void;
  };

  onRowClick?: (item: T) => void;
  onRowKeyDown?: (e: React.KeyboardEvent, item: T) => void;
  rowClassName?: (item: T) => string;
  emptyMessage?: string;
  emptyIcon?: string;
  emptyAction?: React.ReactNode;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading,
  sort,
  selection,
  onRowClick,
  onRowKeyDown,
  rowClassName,
  emptyMessage = "Không tìm thấy dữ liệu",
  emptyIcon = "search_off",
  emptyAction
}: DataTableProps<T>) {

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden h-full">
        <TableContainer className="h-full bg-white dark:bg-slate-800">
           <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 h-12 sticky top-0 z-header flex items-center px-6">
              <div className="flex gap-4 w-full">
                  {columns.map((col, idx) => (
                      <div key={idx} className={`h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 opacity-50 ${idx === 0 ? 'w-24' : ''}`}></div>
                  ))}
              </div>
           </div>
           <TableSkeleton rows={10} />
        </TableContainer>
      </div>
    );
  }

  if (data.length === 0) {
      return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
            <TableContainer className="h-full bg-white dark:bg-slate-800">
                <Table>
                    <TableHeader>
                        <tr>
                            {columns.map((col, idx) => (
                                <TableHead key={idx} align={col.align || 'left'} className={col.width}>{col.header}</TableHead>
                            ))}
                        </tr>
                    </TableHeader>
                </Table>
                <div className="flex-1 flex items-center justify-center">
                    <EmptyState 
                        title="Danh sách trống"
                        description={emptyMessage}
                        icon={emptyIcon}
                        action={emptyAction}
                    />
                </div>
            </TableContainer>
        </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full">
      <div className="flex-1 overflow-hidden h-full">
        <TableContainer className="h-full bg-white dark:bg-slate-800">
            <Table>
              <TableHeader>
                <tr>
                  {selection && (
                    <TableHead className="w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={data.length > 0 && selection.selectedIds.size === data.length}
                        onChange={(e) => selection.onSelectAll(e.target.checked)}
                      />
                    </TableHead>
                  )}
                  {columns.map((col, idx) => {
                    const sortIndex = sort?.items.findIndex(s => s.key === col.accessorKey);
                    const isSorted = sortIndex !== undefined && sortIndex !== -1;
                    const sortDirection = isSorted ? sort?.items[sortIndex!].direction : null;
                    const priority = isSorted && sort && sort.items.length > 1 ? sortIndex! + 1 : null;

                    return (
                      <TableHead 
                        key={idx} 
                        align={col.align || 'left'} 
                        className={`${col.width} ${col.className} ${col.sortable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none group' : ''}`}
                        onClick={(e) => col.sortable && col.accessorKey && sort?.onSort(col.accessorKey as string, e.shiftKey)}
                        title={col.sortable ? 'Click để sắp xếp (Shift+Click để thêm)' : undefined}
                      >
                        <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                          {col.header}
                          
                          {/* Sort Indicator */}
                          {isSorted && (
                            <div className="flex items-center text-blue-600 dark:text-blue-400">
                                <span className="material-symbols-outlined text-[14px] font-bold">
                                    {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                                {priority && <span className="text-[9px] font-black leading-none ml-0.5">{priority}</span>}
                            </div>
                          )}
                          
                          {/* Ghost Indicator */}
                          {col.sortable && !isSorted && (
                             <span className="material-symbols-outlined text-[14px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">unfold_more</span>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </tr>
              </TableHeader>
              <tbody>
                {data.map((item, index) => {
                  const isSelected = selection?.selectedIds.has(String(item.id));
                  const customRowClass = rowClassName ? rowClassName(item) : '';
                  return (
                    <TableRow 
                      key={item.id} 
                      tabIndex={0} 
                      onKeyDown={(e) => onRowKeyDown && onRowKeyDown(e, item)}
                      className={`cursor-pointer outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-1 focus:ring-inset focus:ring-blue-200 ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''} ${customRowClass}`}
                      onClick={() => onRowClick && onRowClick(item)}
                    >
                      {selection && (
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={isSelected}
                            onChange={() => selection.onSelectRow(String(item.id))}
                          />
                        </TableCell>
                      )}
                      {columns.map((col, idx) => (
                        <TableCell key={idx} align={col.align || 'left'} className={col.className}>
                          {col.cell ? col.cell(item, index) : (col.accessorKey ? (item[col.accessorKey] as any) : '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
        </TableContainer>
      </div>
    </div>
  );
}
