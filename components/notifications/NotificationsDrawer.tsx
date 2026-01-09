
import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { ViewState } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Primitives';

interface NotificationsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: ViewState, params?: any) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose, onNavigate }) => {
    const { notifications, dismissNotification, clearAllDismissed } = useAppContext();
    const [filter, setFilter] = useState<'all' | 'danger' | 'warning'>('all');

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'all') return true;
        return n.severity === filter;
    });

    const handleAction = (n: typeof notifications[0]) => {
        if (n.link) {
            onNavigate(n.link.view, n.link.params);
            onClose();
        }
    };

    const getIcon = (type: string, severity: string) => {
        if (severity === 'danger') return 'error';
        if (severity === 'warning') return 'warning';
        return type === 'debt' ? 'account_balance_wallet' : type === 'inventory' ? 'inventory_2' : 'info';
    };

    const getColor = (severity: string) => {
        if (severity === 'danger') return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        if (severity === 'warning') return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    };

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title="Thông Báo Hệ Thống"
            subtitle={`Tổng: ${notifications.length} tin chưa đọc`}
            width="md"
            footer={
                <div className="flex justify-between w-full">
                    <Button variant="ghost" className="text-slate-500" onClick={clearAllDismissed}>Khôi phục đã ẩn</Button>
                    <Button variant="primary" onClick={onClose}>Đóng</Button>
                </div>
            }
        >
            <div className="flex gap-2 mb-4 sticky top-0 bg-white dark:bg-slate-900 z-10 py-2 border-b border-slate-100 dark:border-slate-800">
                {(['all', 'danger', 'warning'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                            filter === f 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        {f === 'all' ? 'Tất cả' : f === 'danger' ? 'Nguy cấp' : 'Cảnh báo'}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <span className="material-symbols-outlined text-[48px] mb-2 opacity-20">notifications_off</span>
                        <p className="text-sm">Không có thông báo mới.</p>
                    </div>
                ) : (
                    filteredNotifications.map(n => (
                        <div key={n.id} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex gap-3 hover:shadow-md transition-shadow relative group">
                            <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${getColor(n.severity)}`}>
                                <span className="material-symbols-outlined text-[20px]">{getIcon(n.type, n.severity)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{n.title}</h4>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-slate-400 mt-2">{new Date(n.timestamp).toLocaleString('vi-VN')}</p>
                                
                                {n.link && (
                                    <button 
                                        onClick={() => handleAction(n)}
                                        className="mt-2 text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        Xem chi tiết <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => dismissNotification(n.id)}
                                className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
                                title="Ẩn thông báo"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </Drawer>
    );
};
