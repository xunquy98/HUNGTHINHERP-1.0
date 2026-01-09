
import React, { useEffect, useState } from 'react';
import { useAppContext, ToastMessage } from '../../contexts/AppContext';

interface ToastItemProps extends ToastMessage {
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ id, type, message, title, duration = 4000, action, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsMounted(true));
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, isPaused]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 500); // Wait for exit animation
  };

  const config = {
    success: {
      icon: 'check_circle',
      // Glassy background with slight tint
      bg: 'bg-white/90 dark:bg-slate-900/90 border-emerald-200/50 dark:border-emerald-800/50',
      textTitle: 'text-emerald-800 dark:text-emerald-100',
      textBody: 'text-emerald-600 dark:text-emerald-300',
      iconColor: 'text-emerald-500',
      progress: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
      shadow: 'shadow-emerald-500/10 dark:shadow-emerald-900/20'
    },
    error: {
      icon: 'error',
      bg: 'bg-white/90 dark:bg-slate-900/90 border-red-200/50 dark:border-red-800/50',
      textTitle: 'text-red-800 dark:text-red-100',
      textBody: 'text-red-600 dark:text-red-300',
      iconColor: 'text-red-500',
      progress: 'bg-gradient-to-r from-red-400 to-red-600',
      shadow: 'shadow-red-500/10 dark:shadow-red-900/20'
    },
    warning: {
      icon: 'warning',
      bg: 'bg-white/90 dark:bg-slate-900/90 border-amber-200/50 dark:border-amber-800/50',
      textTitle: 'text-amber-800 dark:text-amber-100',
      textBody: 'text-amber-600 dark:text-amber-300',
      iconColor: 'text-amber-500',
      progress: 'bg-gradient-to-r from-amber-400 to-amber-600',
      shadow: 'shadow-amber-500/10 dark:shadow-amber-900/20'
    },
    info: {
      icon: 'info',
      bg: 'bg-white/90 dark:bg-slate-900/90 border-blue-200/50 dark:border-blue-800/50',
      textTitle: 'text-blue-800 dark:text-blue-100',
      textBody: 'text-blue-600 dark:text-blue-300',
      iconColor: 'text-blue-500',
      progress: 'bg-gradient-to-r from-blue-400 to-blue-600',
      shadow: 'shadow-blue-500/10 dark:shadow-blue-900/20'
    }
  };

  const theme = config[type];

  return (
    <div 
      className={`
        relative pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl
        transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform will-change-transform
        ${theme.bg} ${theme.shadow}
        ${isMounted && !isExiting ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95'}
        ${isExiting ? 'translate-x-full opacity-0' : ''}
      `}
      role="alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="p-4 flex gap-4 relative z-10">
        {/* Icon Area with Glow */}
        <div className="shrink-0 relative">
            <div className={`absolute inset-0 rounded-full blur-lg opacity-20 ${theme.iconColor} bg-current`}></div>
            <div className={`relative p-2 rounded-xl bg-white/50 dark:bg-black/20 ${theme.iconColor} shadow-sm ring-1 ring-black/5`}>
                <span className="material-symbols-outlined text-[24px] block filled-icon">{theme.icon}</span>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 py-0.5">
            {title && <h4 className={`text-sm font-bold mb-0.5 ${theme.textTitle}`}>{title}</h4>}
            <p className={`text-[13px] font-medium leading-relaxed opacity-90 ${theme.textBody}`}>{message}</p>
            
            {action && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); action.onClick(); handleClose(); }}
                  className="rounded-lg bg-slate-900/5 dark:bg-white/10 px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-slate-900/10 dark:hover:bg-white/20 transition-colors border border-transparent hover:border-current/10"
                >
                  {action.label}
                </button>
              </div>
            )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          className={`shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg opacity-40 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all self-start ${theme.textTitle}`}
          onClick={handleClose}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Modern Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100/50 dark:bg-slate-800/50">
        <div 
            className={`h-full ${theme.progress} shadow-[0_0_10px_rgba(0,0,0,0.1)]`} 
            style={{ 
                width: isExiting ? '0%' : '100%', 
                transition: `width ${duration}ms linear`,
            }} 
        />
      </div>
    </div>
  );
};

export const ToastCenter: React.FC = () => {
  const { toasts, removeToast } = useAppContext();

  return (
    <div 
      aria-live="assertive" 
      className="pointer-events-none fixed inset-0 z-toast flex flex-col items-end justify-start gap-3 px-4 py-6 sm:p-6 sm:pt-20 overflow-hidden"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onClose={removeToast} />
      ))}
    </div>
  );
};
