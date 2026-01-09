
import React from 'react';
import { Badge } from './ui/Primitives';
import { getStatusBadgeProps } from '../utils/statusBadges';

interface StatusBadgeProps {
  status: string;
  entityType?: string; // 'Order' | 'Quote' | 'Import' | 'Debt' | 'Delivery' | 'Payment' | 'Fulfillment'
  type?: 'badge' | 'dot';
  size?: 'sm' | 'md';
  className?: string;
  label?: string; // Optional override
  showIcon?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  entityType = 'default',
  type = 'badge', 
  size = 'sm', 
  className = '', 
  label,
  showIcon = false
}) => {
  const config = getStatusBadgeProps(status, entityType);
  const text = label || config.label;
  const variant = config.variant;

  // Dot style rendering (Used in compact lists)
  if (type === 'dot') {
    const dotColors = {
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      danger: 'bg-rose-500',
      info: 'bg-blue-500',
      neutral: 'bg-slate-400'
    };
    
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className={`size-2 rounded-full ${dotColors[variant]} shadow-sm ring-1 ring-white dark:ring-slate-900`}></span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${
            variant === 'success' ? 'text-emerald-700 dark:text-emerald-400' :
            variant === 'warning' ? 'text-amber-700 dark:text-amber-400' :
            variant === 'danger' ? 'text-rose-700 dark:text-rose-400' :
            variant === 'info' ? 'text-blue-700 dark:text-blue-400' :
            'text-slate-600 dark:text-slate-400'
        }`}>
            {text}
        </span>
      </div>
    );
  }

  // Standard Badge
  return (
    <Badge variant={variant} size={size} className={`${className} ${showIcon ? 'pl-1.5' : ''}`}>
      {showIcon && config.icon && <span className="material-symbols-outlined text-[14px] mr-1">{config.icon}</span>}
      {text}
    </Badge>
  );
};

export default StatusBadge;
