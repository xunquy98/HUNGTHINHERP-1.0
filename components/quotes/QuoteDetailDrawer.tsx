
import React from 'react';
import { Quote, QuoteStatus } from '../../types';
import { Drawer, DrawerSection } from '../ui/Drawer';
import { Button } from '../ui/Primitives';
import StatusBadge from '../StatusBadge';
import { formatCurrency, parseDate, getDaysDiff } from '../../utils/helpers';

interface QuoteDetailDrawerProps {
    quote: Quote | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: (q: Quote) => void;
    onConvert: (id: string) => void;
    onPrint: (q: Quote) => void;
    onDuplicate: (q: Quote) => void;
    onStatusChange: (id: string, status: QuoteStatus) => void;
    onDelete: (id: string) => void;
}

export const QuoteDetailDrawer: React.FC<QuoteDetailDrawerProps> = ({ 
    quote, isOpen, onClose, 
    onEdit, onConvert, onPrint, onDuplicate, onStatusChange, onDelete 
}) => {
    if (!isOpen || !quote) return null;

    const isExpired = parseDate(quote.validUntil) < new Date();
    const daysLeft = getDaysDiff(parseDate(quote.validUntil)) * -1; // Invert logic for future date

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={quote.code}
            subtitle={`Ngày tạo: ${quote.date}`}
            width="xl"
            footer={
                <div className="flex flex-col gap-3 w-full">
                    {/* Primary Workflow Actions */}
                    <div className="flex gap-3">
                        {quote.status === 'Sent' && (
                            <Button 
                                variant="primary" 
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" 
                                icon="shopping_cart_checkout" 
                                onClick={() => onConvert(quote.id)}
                            >
                                Chốt đơn hàng
                            </Button>
                        )}
                        {quote.status === 'Draft' && (
                            <Button 
                                variant="primary" 
                                className="flex-1" 
                                icon="send" 
                                onClick={() => onStatusChange(quote.id, 'Sent')}
                            >
                                Đánh dấu Đã gửi
                            </Button>
                        )}
                        <Button variant="secondary" className="flex-1" icon="print" onClick={() => onPrint(quote)}>In Báo giá</Button>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <Button variant="ghost" className="flex-1" icon="content_copy" onClick={() => onDuplicate(quote)}>Nhân bản</Button>
                        {quote.status !== 'Accepted' && (
                            <Button variant="ghost" className="flex-1" icon="edit" onClick={() => onEdit(quote)}>Chỉnh sửa</Button>
                        )}
                        <Button variant="ghost" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" icon="delete" onClick={() => onDelete(quote.id)}>Xóa</Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-6">
                {/* 1. Status & Validity Card */}
                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trạng thái</span>
                            <div className="mt-1"><StatusBadge status={quote.status} entityType="Quote" size="md" /></div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hiệu lực đến</span>
                            <div className={`mt-1 font-bold flex items-center justify-end gap-1 ${isExpired ? 'text-red-600' : daysLeft <= 3 ? 'text-orange-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {isExpired && <span className="material-symbols-outlined text-[16px]">event_busy</span>}
                                {quote.validUntil}
                            </div>
                        </div>
                    </div>
                    
                    {/* Quick Status Actions */}
                    {quote.status === 'Sent' && (
                        <div className="flex gap-2 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => onStatusChange(quote.id, 'Rejected')}
                                className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            >
                                Khách từ chối
                            </button>
                            <button 
                                onClick={() => onStatusChange(quote.id, 'Draft')}
                                className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Quay lại nháp
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. Customer Info */}
                <DrawerSection title="Khách hàng">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                {quote.customerName.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{quote.customerName}</p>
                                <p className="text-xs text-slate-500">{quote.phone}</p>
                            </div>
                        </div>
                        {quote.address && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                <span className="material-symbols-outlined text-[14px] mt-0.5">location_on</span>
                                {quote.address}
                            </p>
                        )}
                    </div>
                </DrawerSection>

                {/* 3. Items Table */}
                <DrawerSection title="Chi tiết báo giá" action={<span className="text-xs font-bold text-slate-500">{quote.items.length} sản phẩm</span>}>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Sản phẩm</th>
                                    <th className="px-3 py-3 text-center">SL</th>
                                    <th className="px-4 py-3 text-right">Đơn giá</th>
                                    <th className="px-4 py-3 text-right">Tổng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                {quote.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-900 dark:text-white truncate max-w-[180px]">{item.productName}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{item.sku}</p>
                                        </td>
                                        <td className="px-3 py-3 text-center font-bold text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.price)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                                <tr>
                                    <td colSpan={3} className="px-4 py-2 text-right text-xs font-bold text-slate-500 uppercase">Tổng cộng</td>
                                    <td className="px-4 py-2 text-right font-black text-blue-600 text-base">{formatCurrency(quote.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </DrawerSection>

                {quote.notes && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl text-sm">
                        <p className="font-bold text-yellow-800 dark:text-yellow-500 text-xs uppercase mb-1">Ghi chú</p>
                        <p className="text-yellow-900 dark:text-yellow-200 italic">{quote.notes}</p>
                    </div>
                )}
            </div>
        </Drawer>
    );
};
