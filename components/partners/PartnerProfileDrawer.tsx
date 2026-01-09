
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { Drawer, DrawerSection } from '../ui/Drawer';
import { Button } from '../ui/Primitives';
import StatusBadge from '../StatusBadge';
import { formatCurrency, parseDate } from '../../utils/helpers';
import { Partner, PartnerType } from '../../types';
import { AuditTimeline } from '../audit/AuditTimeline';

interface Props {
    partnerId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: (partner: Partner) => void;
}

export const PartnerProfileDrawer: React.FC<Props> = ({ partnerId, isOpen, onClose, onEdit }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'imports' | 'debts' | 'transactions' | 'history'>('overview');

    const partner = useLiveQuery(() => partnerId ? db.partners.get(partnerId) : undefined, [partnerId]);

    // Related Data Queries
    const relatedOrders = useLiveQuery(async () => {
        if (!partner || partner.type !== PartnerType.Customer) return [];
        // Match by phone or name since customerId isn't strictly enforced on legacy orders
        return db.orders
            .filter(o => (!!partner.phone && o.phone === partner.phone) || o.customerName === partner.name)
            .reverse()
            .limit(50)
            .toArray();
    }, [partner]);

    const relatedImports = useLiveQuery(async () => {
        if (!partner || partner.type !== PartnerType.Supplier) return [];
        return db.importOrders
            .where('supplierId').equals(partner.id)
            .reverse()
            .limit(50)
            .toArray();
    }, [partner]);

    const relatedDebts = useLiveQuery(async () => {
        if (!partner) return [];
        return db.debtRecords
            .where('partnerId').equals(partner.id)
            .reverse()
            .toArray();
    }, [partner]);

    const relatedTransactions = useLiveQuery(async () => {
        if (!partner) return [];
        return db.transactions
            .filter(t => t.partnerName === partner.name)
            .reverse()
            .limit(50)
            .toArray();
    }, [partner]);

    const auditLogs = useLiveQuery(async () => {
        if (!partner) return [];
        return db.auditLogs.where('entityId').equals(partner.id).reverse().toArray();
    }, [partner]);

    if (!isOpen || !partner) return null;

    // --- KPI Calculations ---
    const totalDebt = relatedDebts?.reduce((sum, d) => sum + d.remainingAmount, 0) || 0;
    const overdueCount = relatedDebts?.filter(d => d.status === 'Overdue' && d.remainingAmount > 0).length || 0;
    
    const volumeLabel = partner.type === PartnerType.Customer ? 'Tổng mua hàng' : 'Tổng cung cấp';
    const totalVolume = partner.type === PartnerType.Customer 
        ? relatedOrders?.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0) || 0
        : relatedImports?.filter(i => i.status !== 'Cancelled').reduce((sum, i) => sum + i.total, 0) || 0;

    const renderTabButton = (id: typeof activeTab, label: string, count?: number) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap px-3 ${
                activeTab === id 
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
            {label} {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
        </button>
    );

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={partner.name}
            subtitle={partner.code}
            width="2xl"
            footer={
                <Button variant="primary" className="w-full justify-center" icon="edit" onClick={() => onEdit(partner)}>
                    Chỉnh sửa thông tin
                </Button>
            }
        >
            {/* 1. Header Info */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${partner.type === 'Customer' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                        {partner.type === 'Customer' ? 'Khách hàng' : 'Nhà cung cấp'}
                    </span>
                    {partner.taxId && <span className="text-xs text-slate-500 font-mono">MST: {partner.taxId}</span>}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Liên hệ</p>
                        <p className="font-bold text-slate-900 dark:text-white">{partner.phone}</p>
                        {partner.email && <p className="text-slate-600 dark:text-slate-300">{partner.email}</p>}
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Địa chỉ</p>
                        <p className="text-slate-700 dark:text-slate-300">{partner.address || '---'}</p>
                    </div>
                </div>
            </div>

            {/* 2. KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{volumeLabel}</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate" title={formatCurrency(totalVolume)}>{formatCurrency(totalVolume)}</p>
                </div>
                <div className={`p-3 border rounded-xl ${totalDebt > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'}`}>
                    <p className={`text-[10px] font-bold uppercase ${totalDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {partner.type === 'Supplier' ? 'Nợ phải trả' : 'Nợ phải thu'}
                    </p>
                    <p className={`text-sm font-black ${totalDebt > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {formatCurrency(totalDebt)}
                    </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Phiếu quá hạn</p>
                    <p className={`text-sm font-black ${overdueCount > 0 ? 'text-orange-600' : 'text-slate-900 dark:text-white'}`}>{overdueCount}</p>
                </div>
            </div>

            {/* 3. Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 sticky top-0 bg-white dark:bg-slate-900 z-10 overflow-x-auto no-scrollbar">
                {renderTabButton('overview', 'Tổng quan')}
                {partner.type === PartnerType.Customer && renderTabButton('orders', 'Đơn hàng', relatedOrders?.length)}
                {partner.type === PartnerType.Supplier && renderTabButton('imports', 'Nhập hàng', relatedImports?.length)}
                {renderTabButton('debts', 'Công nợ', relatedDebts?.length)}
                {renderTabButton('transactions', 'Sổ quỹ', relatedTransactions?.length)}
                {renderTabButton('history', 'Lịch sử', auditLogs?.length)}
            </div>

            {/* 4. Tab Content */}
            <div className="pb-4 min-h-[300px]">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <DrawerSection title="Ghi chú">
                            <p className="text-sm text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                Chưa có ghi chú đặc biệt cho đối tác này.
                            </p>
                        </DrawerSection>
                        {/* More summary widgets could go here */}
                    </div>
                )}

                {activeTab === 'orders' && relatedOrders && (
                    <div className="space-y-2">
                        {relatedOrders.map(o => (
                            <div key={o.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:shadow-sm transition-shadow">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-xs text-blue-600">{o.code}</span>
                                        <StatusBadge status={o.status} entityType="Order" size="sm" />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{o.date}</p>
                                </div>
                                <span className="font-bold text-sm">{formatCurrency(o.total)}</span>
                            </div>
                        ))}
                        {relatedOrders.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Chưa có đơn hàng</p>}
                    </div>
                )}

                {activeTab === 'imports' && relatedImports && (
                    <div className="space-y-2">
                        {relatedImports.map(i => (
                            <div key={i.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:shadow-sm transition-shadow">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-xs text-emerald-600">{i.code}</span>
                                        <StatusBadge status={i.status} entityType="Import" size="sm" />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{i.date} {i.invoiceNo && `• HD: ${i.invoiceNo}`}</p>
                                </div>
                                <span className="font-bold text-sm">{formatCurrency(i.total)}</span>
                            </div>
                        ))}
                        {relatedImports.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Chưa có phiếu nhập</p>}
                    </div>
                )}

                {activeTab === 'debts' && relatedDebts && (
                    <div className="space-y-2">
                        {relatedDebts.map(d => (
                            <div key={d.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:shadow-sm transition-shadow">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-xs text-slate-600 dark:text-slate-400">{d.orderCode}</span>
                                        <StatusBadge status={d.status} entityType="Debt" size="sm" />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">Hạn: {d.dueDate}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{formatCurrency(d.totalAmount)}</p>
                                    {d.remainingAmount > 0 && <p className="text-[10px] text-red-500 font-bold">Còn: {formatCurrency(d.remainingAmount)}</p>}
                                </div>
                            </div>
                        ))}
                        {relatedDebts.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Không có công nợ</p>}
                    </div>
                )}

                {activeTab === 'transactions' && relatedTransactions && (
                    <div className="space-y-2">
                        {relatedTransactions.map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:shadow-sm transition-shadow">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.description}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{t.date} • {t.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</p>
                                </div>
                                <span className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                </span>
                            </div>
                        ))}
                        {relatedTransactions.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Chưa có giao dịch</p>}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <AuditTimeline logs={auditLogs || []} />
                    </div>
                )}
            </div>
        </Drawer>
    );
};
