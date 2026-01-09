
import React from 'react';
import { TOKENS } from './Tokens';

// --- PAGE LAYOUT ---

/**
 * PageShell: The main wrapper for page content.
 * Features:
 * - Full height flex container
 * - Horizontal centering for ultra-wide screens (max-w-[1920px])
 * - Consistent background
 */
export const PageShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`flex flex-col h-full w-full relative overflow-hidden bg-[#f8fafc] dark:bg-[#0b1121] mx-auto max-w-[1920px] ${className}`}>
    {children}
  </div>
);

export const PageHeader: React.FC<{ 
  title: string; 
  subtitle?: string; 
  actions?: React.ReactNode; 
  className?: string 
}> = ({ title, subtitle, actions, className = '' }) => (
  <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 shrink-0 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-lg relative overflow-hidden ${className}`}>
    
    {/* Decorative Background Elements */}
    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
    <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
    
    <div className="relative z-10">
      <h1 className="text-3xl font-black tracking-tight text-white leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-base font-medium text-blue-50 mt-1 leading-relaxed opacity-90">
          {subtitle}
        </p>
      )}
    </div>
    {actions && <div className="relative z-10 flex items-center gap-3">{actions}</div>}
  </div>
);

// --- CONTAINERS ---

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, className = '', noPadding = false, ...props 
}) => (
  <div className={`${TOKENS.CARD.BASE} ${className}`} {...props}>
    <div className={noPadding ? '' : 'p-5'}>
        {children}
    </div>
  </div>
);

// --- INTERACTIVE ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: string;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ 
  children, variant = 'primary', size = 'md', icon, loading, className = '', ...props 
}, ref) => {
  const variantClass = variant === 'primary' ? TOKENS.BUTTON.VARIANT.PRIMARY :
                       variant === 'secondary' ? TOKENS.BUTTON.VARIANT.SECONDARY :
                       variant === 'danger' ? TOKENS.BUTTON.VARIANT.DANGER :
                       variant === 'ghost' ? TOKENS.BUTTON.VARIANT.GHOST :
                       TOKENS.BUTTON.VARIANT.OUTLINE;
                       
  const sizeClass = size === 'sm' ? TOKENS.BUTTON.SIZE.SM :
                    size === 'lg' ? TOKENS.BUTTON.SIZE.LG :
                    size === 'icon' ? TOKENS.BUTTON.SIZE.ICON :
                    TOKENS.BUTTON.SIZE.MD;

  return (
    <button ref={ref} className={`${TOKENS.BUTTON.BASE} ${variantClass} ${sizeClass} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[1.2em]">progress_activity</span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[1.2em]">{icon}</span>
      ) : null}
      {children}
    </button>
  );
});

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, variant = 'neutral', size = 'sm', className = '' 
}) => {
  const variantClass = variant === 'success' ? TOKENS.BADGE.VARIANT.SUCCESS :
                       variant === 'warning' ? TOKENS.BADGE.VARIANT.WARNING :
                       variant === 'danger' ? TOKENS.BADGE.VARIANT.DANGER :
                       variant === 'info' ? TOKENS.BADGE.VARIANT.INFO :
                       TOKENS.BADGE.VARIANT.NEUTRAL;

  const sizeClass = size === 'md' ? TOKENS.BADGE.SIZE.MD : TOKENS.BADGE.SIZE.SM;

  return (
    <span className={`${TOKENS.BADGE.BASE} ${variantClass} ${sizeClass} ${className}`}>
      {children}
    </span>
  );
};

export const SearchInput: React.FC<{ 
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = "Tìm kiếm...", className = '' }) => (
  <div className={`relative group ${className}`}>
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px] transition-colors group-focus-within:text-blue-600">
      search
    </span>
    <input 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className={`${TOKENS.INPUT.BASE} ${TOKENS.INPUT.FOCUS} ${TOKENS.INPUT.SIZE.MD} pl-10 pr-4`}
      placeholder={placeholder} 
    />
  </div>
);
