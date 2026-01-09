
import React from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title = 'Không có dữ liệu', 
  description = 'Chưa có bản ghi nào được tìm thấy.', 
  icon = 'inbox', 
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="size-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4 ring-1 ring-slate-100 dark:ring-slate-700">
        <span className="material-symbols-outlined text-[40px] text-slate-300 dark:text-slate-600">{icon}</span>
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          {action}
        </div>
      )}
    </div>
  );
};
