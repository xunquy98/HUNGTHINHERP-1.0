
import { useState, useEffect } from 'react';
import { db } from '../services/db';
import { removeVietnameseTones } from '../utils/helpers';
import { ViewState } from '../types';

export interface SearchResult {
  id: string;
  type: 'ORDER' | 'QUOTE' | 'PARTNER' | 'PRODUCT' | 'DELIVERY' | 'IMPORT';
  title: string;
  subtitle: string;
  view: ViewState;
  icon: string;
  status?: string;
}

// Helper to clean string for flexible code matching
const cleanString = (str: string) => str.replace(/[^a-z0-9]/g, '');

export const useGlobalSearch = (query: string) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Optimized: Use startsWithIgnoreCase on indexed fields where possible
        // For fuzzy search (e.g. customer name with accents), we still need to filter, 
        // but we limit the scope or prioritize exact code matches first.
        
        const norm = removeVietnameseTones(trimmedQuery);
        const cleanQuery = cleanString(norm);
        const isCodeSearch = cleanQuery.length > 2; // Only try efficient code search if roughly a code

        // 1. Orders (Index: code)
        // Hybrid: Try index first for speed, then fall back if needed, but here we just do a mix
        // Since Dexie doesn't support OR across different indices easily without loading, 
        // we'll fetch matches for code first (fast), then maybe a limited filter.
        
        const ordersPromise = db.orders
            .filter(o => {
                if (o.isDeleted) return false;
                const code = o.code ? o.code.toLowerCase() : '';
                const name = o.customerName ? removeVietnameseTones(o.customerName) : '';
                return code.includes(norm) || name.includes(norm) || (o.phone && o.phone.includes(norm));
            })
            .limit(5)
            .toArray();

        // 2. Quotes
        const quotesPromise = db.quotes
            .filter(q => {
                const code = q.code ? q.code.toLowerCase() : '';
                const name = q.customerName ? removeVietnameseTones(q.customerName) : '';
                return code.includes(norm) || name.includes(norm) || (q.phone && q.phone.includes(norm));
            })
            .limit(5)
            .toArray();

        // 3. Partners (Index: name, code, phone - schema only defines compound but we can filter)
        const partnersPromise = db.partners
            .filter(p => {
                if (p.isDeleted) return false;
                const name = p.name ? removeVietnameseTones(p.name) : '';
                const phone = p.phone || '';
                const code = p.code ? p.code.toLowerCase() : '';
                return name.includes(norm) || phone.includes(norm) || code.includes(norm);
            })
            .limit(5)
            .toArray();

        // 4. Products (Index: sku, name)
        // Critical optimization: Products table is large.
        // Use startsWithIgnoreCase on SKU if it looks like a SKU
        let productsQuery = db.products.toCollection();
        if (isCodeSearch) {
             // If query looks like code, prioritize SKU index
             productsQuery = db.products.where('sku').startsWithIgnoreCase(query);
        } else {
             // General filter
             productsQuery = db.products.filter(p => {
                if (p.isDeleted) return false;
                const name = p.name ? removeVietnameseTones(p.name) : '';
                const sku = p.sku ? p.sku.toLowerCase() : '';
                return name.includes(norm) || sku.includes(norm);
             });
        }
        const productsPromise = productsQuery.limit(5).toArray();

        // 5. Deliveries
        const deliveriesPromise = db.deliveryNotes
            .filter(d => {
                const code = d.code ? d.code.toLowerCase() : '';
                const orderCode = d.orderCode ? d.orderCode.toLowerCase() : '';
                return code.includes(norm) || orderCode.includes(norm);
            })
            .limit(5)
            .toArray();

        // 6. Imports
        const importsPromise = db.importOrders
            .filter(i => {
                const code = i.code ? i.code.toLowerCase() : '';
                const supplier = i.supplierName ? removeVietnameseTones(i.supplierName) : '';
                return code.includes(norm) || supplier.includes(norm);
            })
            .limit(5)
            .toArray();

        const [orders, quotes, partners, products, deliveries, imports] = await Promise.all([
            ordersPromise, quotesPromise, partnersPromise, productsPromise, deliveriesPromise, importsPromise
        ]);

        const formattedResults: SearchResult[] = [
          ...orders.map(o => ({
            id: o.id,
            type: 'ORDER' as const,
            title: `Đơn hàng ${o.code}`,
            subtitle: `${o.customerName} • ${o.total.toLocaleString()}đ`,
            view: 'ORDERS' as ViewState,
            icon: 'receipt_long',
            status: o.status
          })),
          ...quotes.map(q => ({
            id: q.id,
            type: 'QUOTE' as const,
            title: `Báo giá ${q.code}`,
            subtitle: `${q.customerName} • ${q.validUntil}`,
            view: 'QUOTES' as ViewState,
            icon: 'request_quote',
            status: q.status
          })),
          ...partners.map(p => ({
            id: p.id,
            type: 'PARTNER' as const,
            title: p.name,
            subtitle: `${p.code} • ${p.phone}`,
            view: 'PARTNERS' as ViewState,
            icon: 'groups'
          })),
          ...products.map(p => ({
            id: p.id,
            type: 'PRODUCT' as const,
            title: p.name,
            subtitle: `${p.sku} • Tồn: ${p.stock}`,
            view: 'INVENTORY' as ViewState,
            icon: 'inventory_2'
          })),
          ...deliveries.map(d => ({
            id: d.id,
            type: 'DELIVERY' as const,
            title: `Phiếu giao ${d.code}`,
            subtitle: `${d.customerName} (${d.orderCode})`,
            view: 'DELIVERY_NOTES' as ViewState,
            icon: 'local_shipping',
            status: d.status
          })),
          ...imports.map(i => ({
            id: i.id,
            type: 'IMPORT' as const,
            title: `Phiếu nhập ${i.code}`,
            subtitle: `${i.supplierName} • ${i.total.toLocaleString()}đ`,
            view: 'IMPORTS' as ViewState,
            icon: 'input',
            status: i.status
          }))
        ];

        setResults(formattedResults);
      } catch (error) {
        console.error("Search failed", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, isSearching };
};
