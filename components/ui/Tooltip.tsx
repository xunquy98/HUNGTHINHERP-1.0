
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'right' | 'top' | 'bottom';
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, side = 'right', disabled = false }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Simple positioning logic for sidebar (right side)
      if (side === 'right') {
          setCoords({
            top: rect.top + rect.height / 2,
            left: rect.right + 10
          });
      }
      setVisible(true);
    }
  };

  return (
    <>
      <div 
        ref={triggerRef} 
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={() => setVisible(false)}
        className="w-full"
      >
        {children}
      </div>
      {visible && createPortal(
        <div 
          className="fixed z-toast px-2.5 py-1.5 text-[11px] font-bold text-white bg-slate-900 dark:bg-slate-700 rounded-lg shadow-lg pointer-events-none transform -translate-y-1/2 animate-[fadeIn_0.1s_ease-out] whitespace-nowrap border border-white/10"
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
          {/* Arrow */}
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900 dark:border-r-slate-700"></div>
        </div>,
        document.body
      )}
    </>
  );
};
