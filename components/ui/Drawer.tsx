
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Primitives';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl';
}

export const Drawer: React.FC<DrawerProps> = ({ 
  isOpen, onClose, title, subtitle, children, footer, width = 'xl' 
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        
        // Focus management
        setTimeout(() => {
            if (drawerRef.current) {
                const focusable = drawerRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length > 0) {
                    (focusable[0] as HTMLElement).focus();
                } else {
                    drawerRef.current.focus();
                }
            }
        }, 100);
        
        window.addEventListener('keydown', handleKeyDown);
    } else {
        document.body.style.overflow = '';
    }

    return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return createPortal(
    <div 
        className="fixed inset-0 z-drawer flex justify-end bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        aria-labelledby="drawer-title"
    >
      <div 
        ref={drawerRef}
        className={`h-full w-full ${widthClasses[width]} bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-[slideInRight_0.2s_ease-out] border-l border-slate-200 dark:border-slate-800 outline-none`} 
        onClick={e => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900 sticky top-0 z-20 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 id="drawer-title" className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} icon="close" className="rounded-full size-8 p-0 shrink-0" aria-label="Close drawer" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3 sticky bottom-0 z-20 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export const DrawerSection: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</h3>
        {action}
    </div>
    {children}
  </section>
);
