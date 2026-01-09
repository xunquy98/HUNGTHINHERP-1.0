
import React, { useEffect, useRef } from 'react';
import { Button } from './Primitives';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', 
  onConfirm, onCancel, type = 'info' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen) {
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
        }
      }
    };

    if (isOpen) {
        // Focus the Cancel button by default for safety
        setTimeout(() => cancelBtnRef.current?.focus(), 50);
        window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const config = {
    danger: {
      icon: 'error',
      iconBg: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      ring: 'ring-red-50 dark:ring-red-900/10',
      confirmVariant: 'danger' as const,
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
    },
    warning: {
      icon: 'warning',
      iconBg: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      ring: 'ring-orange-50 dark:ring-orange-900/10',
      confirmVariant: 'primary' as const,
      confirmClass: 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 border-orange-500'
    },
    info: {
      icon: 'info',
      iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      ring: 'ring-blue-50 dark:ring-blue-900/10',
      confirmVariant: 'primary' as const,
      confirmClass: 'shadow-lg shadow-blue-600/30'
    }
  };

  const theme = config[type];

  return (
    <div 
        className="fixed inset-0 z-alert flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
    >
      <div 
        ref={containerRef}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-[scaleIn_0.3s_cubic-bezier(0.16,1,0.3,1)] ring-1 ring-white/10"
      >
        <div className="p-8 text-center">
            {/* Animated Icon */}
            <div className={`mx-auto size-16 rounded-full mb-6 flex items-center justify-center relative ${theme.iconBg}`}>
                <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${theme.iconBg}`}></div>
                <div className={`absolute inset-0 rounded-full ring-8 ${theme.ring}`}></div>
                <span className="material-symbols-outlined text-[32px] relative z-10">{theme.icon}</span>
            </div>
            
            <h3 id="confirm-title" className="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight tracking-tight">
                {title}
            </h3>
            <p id="confirm-desc" className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed px-2">
              {message}
            </p>
        </div>
        
        <div className="px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <Button 
            ref={cancelBtnRef}
            variant="secondary" 
            className="flex-1 justify-center h-11 text-sm font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700" 
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button 
            variant={theme.confirmVariant} 
            className={`flex-1 justify-center h-11 text-sm font-bold ${theme.confirmClass}`} 
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
