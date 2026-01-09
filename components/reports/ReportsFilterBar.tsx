
import React from 'react';
import { formatDateISO } from '../../utils/helpers';

interface ReportsFilterBarProps {
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
    warehouse: string;
    onWarehouseChange: (val: string) => void;
    className?: string;
    rightActions?: React.ReactNode;
}

export const ReportsFilterBar: React.FC<ReportsFilterBarProps> = ({ 
    startDate, endDate, onDateChange, 
    warehouse, onWarehouseChange,
    className = '',
    rightActions
}) => {
    // Presets
    const handlePreset = (type: 'today' | '7days' | '30days' | 'month' | 'last_month') => {
        const end = new Date();
        const start = new Date();
        
        switch (type) {
            case 'today':
                // start and end are already today
                break;
            case '7days':
                start.setDate(end.getDate() - 6);
                break;
            case '30days':
                start.setDate(end.getDate() - 29);
                break;
            case 'month':
                start.setDate(1);
                break;
            case 'last_month':
                start.setMonth(start.getMonth() - 1);
                start.setDate(1);
                end.setDate(0); // Last day of previous month
                break;
        }
        
        onDateChange(formatDateISO(start), formatDateISO(end));
    };

    // Common Warehouses (matching Imports page logic)
    const warehouses = ['Kho Bạc Đạn', 'Kho Curoa - Xích', 'Kho Sin - Phớt', 'Kho Ống Thủy Lực', 'Kho Xilanh - Khí nén', 'Kho Dầu Mỡ'];

    return (
        <div className={`sticky top-0 z-sticky bg-white/80 dark:bg-[#0b1121]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all ${className}`}>
            <div className="px-6 py-3 space-y-3">
                <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
                    
                    {/* Left: Date Controls */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[42px] items-center">
                            <button onClick={() => handlePreset('today')} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all">Hôm nay</button>
                            <button onClick={() => handlePreset('7days')} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all">7 Ngày</button>
                            <button onClick={() => handlePreset('month')} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all">Tháng này</button>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 h-[42px]">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => onDateChange(e.target.value, endDate)} 
                                className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-0 p-0 w-24"
                            />
                            <span className="text-slate-300 dark:text-slate-600">→</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => onDateChange(startDate, e.target.value)} 
                                className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-0 p-0 w-24"
                            />
                        </div>
                    </div>

                    {/* Right: Warehouse & Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <select 
                            value={warehouse} 
                            onChange={(e) => onWarehouseChange(e.target.value)} 
                            className="h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:border-blue-500 flex-1 lg:flex-none cursor-pointer"
                        >
                            <option value="">Tất cả kho</option>
                            {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                        
                        {rightActions}
                    </div>
                </div>
            </div>
        </div>
    );
};
