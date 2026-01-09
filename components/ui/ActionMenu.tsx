
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ActionMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  triggerIcon?: string;
  className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ items, triggerIcon = 'more_vert', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // Calculate position: Align top-right of menu with bottom-right of trigger
      // Menu width is w-48 (12rem = 192px)
      const menuWidth = 192; 
      
      let top = rect.bottom + scrollY + 4;
      let left = rect.right + scrollX - menuWidth;

      // Basic viewport boundary check
      if (left < 0) left = rect.left + scrollX; // Flip to left align if not enough space on left (rare for action column)
      
      // If bottom overflow, flip upwards (simplistic check)
      if (rect.bottom + 200 > window.innerHeight) {
          top = rect.top + scrollY - 4 - (items.length * 40 + 20); // Approx height
      }

      setCoords({ top, left });
      setIsOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    // Close on scroll to prevent detached floating menu
    const handleScroll = () => { if(isOpen) setIsOpen(false); }; 

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          toggle(e as any);
      }
      if (isOpen && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          triggerRef.current?.focus();
      }
  };

  return (
    <>
      <button 
        ref={triggerRef}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={`size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-blue-500/50 outline-none ${isOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : ''} ${className}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Actions"
      >
        <span className="material-symbols-outlined text-[20px]">{triggerIcon}</span>
      </button>

      {isOpen && createPortal(
        <div 
          ref={menuRef}
          className="fixed z-toast w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1.5 flex flex-col animate-[fadeIn_0.1s_ease-out] origin-top-right focus:outline-none"
          style={{ top: coords.top, left: coords.left }}
          role="menu"
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); if(!item.disabled) { item.onClick(); setIsOpen(false); } }}
              disabled={item.disabled}
              className={`px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors w-full
                ${item.danger 
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' 
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              role="menuitem"
            >
              {item.icon && <span className="material-symbols-outlined text-[18px]">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
