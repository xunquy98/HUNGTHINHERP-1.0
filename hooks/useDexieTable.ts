
import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Table } from 'dexie';

export interface SortItem {
  key: string;
  direction: 'asc' | 'desc';
}

interface UseDexieTableProps<T> {
  table: Table<T, any>;
  itemsPerPage?: number;
  filterFn?: (item: T) => boolean;
  defaultSort?: string;
  includeDeleted?: boolean;
  indexedKeys?: string[];
}

export function useDexieTable<T extends { id: string | number }>(props: UseDexieTableProps<T>) {
  const { table, itemsPerPage = 10, filterFn, defaultSort = 'id', includeDeleted = false, indexedKeys } = props;

  const [currentPage, setCurrentPage] = useState(1);
  // Multi-sort state
  const [sortState, setSortState] = useState<SortItem[]>([{ key: defaultSort, direction: 'desc' }]);

  // 1. Reset Page on Filter Change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterFn, includeDeleted]);

  // Helper: Verify if a key is safe to sort by (must be indexed in Dexie)
  const getSafeSortKey = useCallback((requestedKey: string): string => {
      if (!table || !table.schema) return 'id';
      
      const schema = table.schema;
      const validKeys = new Set<string>();
      
      // Add Primary Key
      if (schema.primKey.keyPath) {
          if (Array.isArray(schema.primKey.keyPath)) {
              schema.primKey.keyPath.forEach(k => validKeys.add(k));
          } else {
              validKeys.add(schema.primKey.keyPath);
          }
      }
      
      // Add Indexes
      schema.indexes.forEach(idx => {
          if (Array.isArray(idx.keyPath)) {
              idx.keyPath.forEach(k => validKeys.add(k));
          } else {
              validKeys.add(idx.keyPath);
          }
      });

      // Add Manually Allowed Keys
      if (indexedKeys) indexedKeys.forEach(k => validKeys.add(k));

      // 1. If requested key is valid, use it
      if (validKeys.has(requestedKey)) return requestedKey;

      // 2. Fallbacks
      if (validKeys.has('createdAt')) return 'createdAt';
      if (validKeys.has('updatedAt')) return 'updatedAt';
      if (validKeys.has('id')) return 'id';
      
      // 3. Ultimate Fallback (Schema PK)
      return schema.primKey.keyPath ? String(schema.primKey.keyPath) : 'id';
  }, [table, indexedKeys]);

  // Fetch Data Live
  const result = useLiveQuery(async () => {
    let collection = table.toCollection();
    
    // Primary Sort (Database Level)
    const primarySort = sortState[0];
    const safeKey = getSafeSortKey(primarySort?.key || defaultSort);

    if (safeKey) {
        collection = table.orderBy(safeKey);
        // Dexie only supports simple reverse for the primary index
        if (primarySort?.direction === 'desc') {
            collection = collection.reverse();
        }
    } else {
        collection = table.reverse(); 
    }

    // Filtering
    collection = collection.filter((item: any) => {
        // 1. Soft Delete Check
        if (!includeDeleted && item.isDeleted) return false;
        // 2. Custom Filter
        if (filterFn && !filterFn(item)) return false;
        return true;
    });

    // Count Total
    const count = await collection.count();

    // Pagination
    const offset = (currentPage - 1) * itemsPerPage;
    const items = await collection.offset(offset).limit(itemsPerPage).toArray();

    // Secondary Sort (In-Memory for current page)
    // This ensures if primary keys are equal, secondary sort applies
    if (sortState.length > 1 || (sortState.length === 1 && sortState[0].key !== safeKey)) {
        items.sort((a: any, b: any) => {
            for (const sort of sortState) {
                const valA = a[sort.key];
                const valB = b[sort.key];
                
                if (valA === valB) continue;
                
                // Handle nulls always last
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;

                if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    return { data: items, totalItems: count };
  }, [table, currentPage, itemsPerPage, sortState, filterFn, includeDeleted, getSafeSortKey]);

  const isLoading = result === undefined;
  const { data = [], totalItems = 0 } = result || {};

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // 2. Clamp Page if out of bounds
  useEffect(() => {
      if (totalPages > 0 && currentPage > totalPages) {
          setCurrentPage(totalPages);
      } else if (totalPages > 0 && currentPage < 1) {
          setCurrentPage(1);
      }
  }, [totalPages, currentPage]);

  const handleSort = (key: string, isShift: boolean) => {
      setSortState(prev => {
          const existingIdx = prev.findIndex(s => s.key === key);
          
          if (!isShift) {
              // Single sort mode
              if (existingIdx !== -1 && existingIdx === 0) {
                  // Toggle existing primary
                  return [{ key, direction: prev[0].direction === 'asc' ? 'desc' : 'asc' }];
              } else {
                  // New primary
                  return [{ key, direction: 'desc' }]; // Default desc for new columns (usually better for dates/amounts)
              }
          } else {
              // Multi sort mode
              const newSort = [...prev];
              if (existingIdx !== -1) {
                  // Toggle direction of existing
                  newSort[existingIdx] = { 
                      ...newSort[existingIdx], 
                      direction: newSort[existingIdx].direction === 'asc' ? 'desc' : 'asc' 
                  };
              } else {
                  // Append new sort
                  if (newSort.length < 3) { // Limit to 3 levels
                      newSort.push({ key, direction: 'desc' });
                  }
              }
              return newSort;
          }
      });
      setCurrentPage(1);
  };

  return {
    data,
    totalItems,
    totalPages,
    currentPage,
    setCurrentPage,
    sortState,
    setSortState,
    requestSort: handleSort,
    isLoading
  };
}
