
import React from 'react';
import { formatDateISO, addDays, getStartOfMonth, getEndOfMonth } from '../../utils/helpers';

interface DateRangeFilterProps {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    onChange: (start: string, end: string) => void;
    className?: string;
}

type PresetType = 'today' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom' | 'all';

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ 
    startDate, 
    endDate, 
    onChange, 
    className = '' 
}) => {
    
    const handlePreset = (type: PresetType) => {
        const today = new Date();
        let start = '';
        let end = '';

        if (type === 'all') {
            onChange('', '');
            return;
        }

        if (type === 'today') {
            start = formatDateISO(today);
            end = formatDateISO(today);
        } else if (type === '7days') {
            start = formatDateISO(addDays(today, -6));
            end = formatDateISO(today);
        } else if (type === '30days') {
            start = formatDateISO(addDays(today, -29));
            end = formatDateISO(today);
        } else if (type === 'this_month') {
            start = formatDateISO(getStartOfMonth(today));
            end = formatDateISO(getEndOfMonth(today));
        } else if (type === 'last_month') {
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            start = formatDateISO(getStartOfMonth(lastMonth));
            end = formatDateISO(getEndOfMonth(lastMonth));
        }

        onChange(start, end);
    };

    const getActivePreset = (): PresetType => {
        if (!startDate && !endDate) return 'all';
        
        const today = new Date();
        const startStr = formatDateISO(today);
        
        if (startDate === startStr && endDate === startStr) return 'today';
        if (startDate === formatDateISO(addDays(today, -6)) && endDate === startStr) return '7days';
        if (startDate === formatDateISO(getStartOfMonth(today)) && endDate === formatDateISO(getEndOfMonth(today))) return 'this_month';
        
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        if (startDate === formatDateISO(getStartOfMonth(lastMonth)) && endDate === formatDateISO(getEndOfMonth(lastMonth))) return 'last_month';

        return 'custom';
    };

    const activePreset = getActivePreset();
    const isInvalid = startDate && endDate && startDate > endDate;

    return (
        <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 ${className}`}>
            {/* Presets */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 h-[38px] items-center overflow-x-auto no-scrollbar max-w-full">
                <button 
                    onClick={() => handlePreset('all')} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activePreset === 'all' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Tất cả
                </button>
                <button 
                    onClick={() => handlePreset('today')} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activePreset === 'today' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Hôm nay
                </button>
                <button 
                    onClick={() => handlePreset('7days')} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activePreset === '7days' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    7 ngày
                </button>
                <button 
                    onClick={() => handlePreset('this_month')} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activePreset === 'this_month' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Tháng này
                </button>
                <button 
                    onClick={() => handlePreset('last_month')} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activePreset === 'last_month' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Tháng trước
                </button>
            </div>

            {/* Inputs */}
            <div className={`flex items-center gap-2 bg-white dark:bg-slate-900 border rounded-xl px-2 h-[38px] transition-colors ${isInvalid ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => onChange(e.target.value, endDate)} 
                    className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-0 p-0 w-[85px] outline-none"
                />
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => onChange(startDate, e.target.value)} 
                    className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-0 p-0 w-[85px] outline-none"
                />
                {(startDate || endDate) && (
                    <button 
                        onClick={() => onChange('', '')}
                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Xóa lọc ngày"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                )}
            </div>
        </div>
    );
};
