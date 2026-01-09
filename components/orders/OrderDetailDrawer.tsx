
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { Order, OrderStatus, DeliveryNote, ReturnNote } from '../../types';
import { Drawer, DrawerSection } from '../ui/Drawer';
import { Button } from '../ui/Primitives';
import { DetailSkeleton } from '../ui/Skeleton';
import StatusBadge from '../StatusBadge';
import { formatCurrency } from '../../utils/helpers';
import { AuditTimeline } from '../audit/AuditTimeline';
import { useAppContext } from '../../contexts/AppContext';

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  // Actions
  onPrint: () => void;
  onDelivery: () => void;
  onPayment: (order: Order) => void;
  onReturn: () => void;
  onAction: (id: string, status: OrderStatus) => void;
  onDelete: (id: string) => void;
  onLock: () => void;
  // Data
  relatedDeliveries?: DeliveryNote[];
  relatedReturns?: ReturnNote[];
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order, isOpen, isLoading = false, onClose,
  onPrint, onDelivery, onPayment, onReturn, onAction, onDelete, onLock,
  relatedDeliveries = [], relatedReturns = []
}) => {
  const { confirm } = useAppContext();
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');

  const auditLogs = useLiveQuery(async () => {
      if (!order) return [];
      return db.auditLogs
          .where('entityId').equals(order.id)
          .reverse()
          .toArray();
  }, [order?.id]);

  // If not open, return null immediately
  if (!isOpen) return null;

  // Render Skeleton if loading
  if (isLoading) {
      return (
          <Drawer isOpen={isOpen} onClose={onClose} title="Đang tải..." width="2xl">
              <DetailSkeleton />
          </Drawer>
      );
  }

  // If not loading and no order, return null (or could be an error state)
  if (!order) return null;

  const isLocked = !!order.lockedAt;
  const isCancelled = order.status === 'Cancelled';
  const isCompleted = order.status === 'Completed';
  const isShipping = order.status === 'Shipping';
  const hasDelivery = relatedDeliveries && relatedDeliveries.length > 0;

  const amountPaid = order.amountPaid || 0;
  const remaining = Math.max(0, order.total - amountPaid);

  const handleCompleteOrder = async () => {
      const ok = await confirm({
          title: 'Hoàn tất đơn hàng?',
          message: 'Đơn hàng sẽ được chuyển sang trạng thái hoàn thành.',
          confirmLabel: 'Xác nhận',
          type: 'info'
      });
      if (ok) {
          onAction(order.id, 'Completed');
      }
  };

  const handleDeliveryClick = async () => {
      if (isShipping) {
          const ok = await confirm({
              title: 'Tạo thêm phiếu giao?',
              message: 'Đơn hàng này đang được vận chuyển. Bạn có chắc chắn muốn tạo thêm phiếu giao hàng khác không?',
              confirmLabel: 'Tạo thêm',
              type: 'warning'
          });
          if (!ok) return;
      }
      onDelivery();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={order.code}
      subtitle={order.date}
      width="2xl"
      footer={
        <>
            <div className="flex-1 flex gap-3">
                <Button variant="outline" icon="print" onClick={onPrint} className="flex-1">In</Button>
                {!isCancelled && !isCompleted && (
                    <Button 
                        variant="secondary" 
                        icon="local_shipping" 
                        onClick={handleDeliveryClick} 
                        disabled={isLocked} // Only disable if locked, allow for Shipping status (Option 3)
                        className="flex-1"
                        title={isShipping ? "Tạo thêm phiếu giao hàng" : "Tạo phiếu giao hàng"}
                    >
                        {isShipping ? 'Giao thêm' : 'Giao hàng'}
                    </Button>
                )}
                {(isCompleted || order.status === 'Shipping') && (
                    <Button variant="secondary" icon="keyboard_return" onClick={onReturn} className="flex-1 text-red-600 hover:bg-red-50">Trả hàng</Button>
                )}
            </div>
            {!isCancelled && (
               <div className="flex gap-2">
                   {remaining > 0 && (
                       <Button 
                           variant="primary" 
                           className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white" 
                           icon="payments" 
                           onClick={() => onPayment(order)}
                       >
                           Thanh toán
                       </Button>
                   )}
                   {order.status !== 'Completed' && (
                       <Button variant="primary" icon="check" onClick={handleCompleteOrder} disabled={isLocked}>Hoàn thành</Button>
                   )}
               </div>
            )}
        </>
      }
    >
      {/* 1. Header & Actions */}
      <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
              <StatusBadge status={order.status} entityType="Order" size="md" />
              {isLocked && <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold border border-red-100 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">lock</span> Đã khóa</span>}
          </div>
          {!isLocked && !isCancelled && (
              <Button variant="ghost" size="sm" onClick={onLock} icon="lock" title="Khóa đơn hàng" className="text-slate-400 hover:text-red-500 hover:bg-red-50">Khóa</Button>
          )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
          <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              Thông tin chi tiết
          </button>
          <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              Lịch sử ({auditLogs?.length || 0})
          </button>
      </div>

      {activeTab === 'info' && (
          <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                {/* 2. Summary Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Card */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khách hàng</h4>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-base truncate relative z-10">{order.customerName}</p>
                        <p className="text-sm text-slate-500 mt-0.5 relative z-10">{order.phone}</p>
                        <span className="material-symbols-outlined absolute -right-2 -bottom-2 text-[64px] text-slate-50 dark:text-slate-700/50 z-0">person</span>
                    </div>

                    {/* Financial Card */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thanh toán</h4>
                            <StatusBadge status={order.paymentStatus || (amountPaid >= order.total ? 'Paid' : 'Unpaid')} entityType="Payment" type="dot" />
                        </div>
                        <div className="flex justify-between items-end relative z-10">
                            <div>
                                <p className="text-xs text-slate-500">Đã trả</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(amountPaid)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Còn nợ</p>
                                <p className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatCurrency(remaining)}</p>
                            </div>
                        </div>
                        <span className="material-symbols-outlined absolute -right-2 -bottom-2 text-[64px] text-slate-50 dark:text-slate-700/50 z-0">payments</span>
                    </div>
                </div>

                {/* 2.5 Related Deliveries (NEW SECTION) */}
                {hasDelivery && (
                    <DrawerSection title="Phiếu giao hàng liên quan">
                        <div className="space-y-2">
                            {relatedDeliveries.map(dn => (
                                <div key={dn.id} className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300">
                                            <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{dn.code}</p>
                                            <p className="text-[10px] text-slate-500">{dn.date} • {dn.shipperName || 'Chưa gán shipper'}</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={dn.status} entityType="Delivery" size="sm" />
                                </div>
                            ))}
                        </div>
                    </DrawerSection>
                )}

                {/* 3. Items Table */}
                <DrawerSection title="Chi tiết đơn hàng" action={<span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{order.items.length} SP</span>}>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-3 py-2">Sản phẩm</th>
                                    <th className="px-3 py-2 text-center">SL</th>
                                    <th className="px-3 py-2 text-right">Đơn giá</th>
                                    <th className="px-3 py-2 text-right">Tổng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {order.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-3 py-2">
                                            <div className="font-medium text-slate-900 dark:text-white truncate max-w-[180px]" title={item.productName}>{item.productName}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                                        <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(item.price)}</td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold text-slate-500 uppercase">Tổng cộng</td>
                                    <td className="px-3 py-2 text-right font-black text-blue-600 text-base">{formatCurrency(order.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </DrawerSection>

                {/* Danger Zone */}
                {!isCancelled && (
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">warning</span> Khu vực nguy hiểm
                        </h4>
                        <Button 
                            variant="danger" 
                            className="w-full justify-center bg-red-50 text-red-600 hover:bg-red-100 border-red-100 dark:bg-red-900/10 dark:border-red-900/30 dark:hover:bg-red-900/20" 
                            onClick={() => onAction(order.id, 'Cancelled')}
                            icon="block"
                        >
                            Hủy đơn hàng này
                        </Button>
                        <p className="text-[10px] text-slate-400 mt-2 text-center">Hành động này sẽ hoàn trả tồn kho và hủy công nợ liên quan.</p>
                    </div>
                )}
          </div>
      )}

      {activeTab === 'history' && (
          <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
              <AuditTimeline logs={auditLogs || []} />
          </div>
      )}
    </Drawer>
  );
};
