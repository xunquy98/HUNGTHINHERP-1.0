
import React from 'react';
import { AuditLog, AuditAction } from '../../types';
import { formatRelativeTime } from '../../utils/helpers';

interface AuditTimelineProps {
    logs: AuditLog[];
    className?: string;
    onOpenRef?: (entityType: string, entityId: string) => void;
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    Create: { icon: 'add_circle', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', label: 'Tạo mới' },
    Update: { icon: 'edit', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', label: 'Cập nhật' },
    Delete: { icon: 'delete', color: 'text-red-600 bg-red-50 dark:bg-red-900/20', label: 'Xóa' },
    SoftDelete: { icon: 'archive', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', label: 'Lưu trữ' },
    StatusChange: { icon: 'sync_alt', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', label: 'Đổi trạng thái' },
    Payment: { icon: 'payments', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20', label: 'Thanh toán' },
    Adjust: { icon: 'tune', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20', label: 'Điều chỉnh' },
    Lock: { icon: 'lock', color: 'text-gray-600 bg-gray-100', label: 'Khóa' },
};

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ logs, className = '', onOpenRef }) => {
    if (!logs || logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-[48px] opacity-20 mb-2">history_edu</span>
                <p className="text-xs">Chưa có lịch sử hoạt động nào.</p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 relative pl-4 border-l-2 border-slate-100 dark:border-slate-800 ${className}`}>
            {logs.map((log) => {
                const config = ACTION_CONFIG[log.action] || { icon: 'circle', color: 'text-slate-500 bg-slate-100', label: log.action };
                
                // Diff rendering helper
                const renderDiff = () => {
                    if (!log.before || !log.after) return null;
                    const keys = Object.keys(log.after);
                    const changes = keys.filter(k => JSON.stringify(log.before[k]) !== JSON.stringify(log.after[k]));
                    
                    if (changes.length === 0) return null;

                    return (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {changes.map((key, idx) => (
                                <div key={idx} className="flex items-center text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">
                                    <span className="font-bold text-slate-500 mr-1 uppercase">{key}:</span>
                                    <span className="line-through text-slate-400 mr-1">{String(log.before[key])}</span>
                                    <span className="material-symbols-outlined text-[10px] text-slate-300 mx-0.5">arrow_forward</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{String(log.after[key])}</span>
                                </div>
                            ))}
                        </div>
                    );
                };

                return (
                    <div key={log.id} className="relative group">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[25px] top-0 size-5 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-sm z-10 ${config.color.split(' ')[1]}`}>
                            <span className={`material-symbols-outlined text-[12px] ${config.color.split(' ')[0]}`}>{config.icon}</span>
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-1">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{log.createdByName}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${config.color}`}>{config.label}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap" title={new Date(log.createdAt).toLocaleString('vi-VN')}>
                                    {formatRelativeTime(log.createdAt)}
                                </span>
                            </div>

                            {/* Summary */}
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
                                {log.summary}
                            </p>

                            {/* Diff */}
                            {renderDiff()}

                            {/* Tags */}
                            {log.tags && log.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                    {log.tags.map(t => (
                                        <span key={t} className="text-[9px] text-slate-400">#{t}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
