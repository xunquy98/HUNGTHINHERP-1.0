
import React, { useState, useEffect, useRef } from 'react';

interface InlineNumberEditProps {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => React.ReactNode;
  className?: string;
  inputClassName?: string;
  align?: 'left' | 'center' | 'right';
  disabled?: boolean;
  autoFocus?: boolean;
}

export const InlineNumberEdit: React.FC<InlineNumberEditProps> = ({
  value,
  onChange,
  onBlur,
  min = 0,
  max,
  step = 1,
  format,
  className = '',
  inputClassName = '',
  align = 'left',
  disabled = false,
  autoFocus = false
}) => {
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync internal state if external value changes while not editing
  useEffect(() => {
    if (!isEditing) {
        setInputValue(value.toString());
    }
  }, [value, isEditing]);

  const commit = () => {
    let num = parseFloat(inputValue);
    
    // Handle invalid number
    if (isNaN(num)) {
        setInputValue(value.toString());
        setIsEditing(false);
        if (onBlur) onBlur();
        return;
    }
    
    // Clamp
    let finalValue = num;
    if (min !== undefined && finalValue < min) finalValue = min;
    if (max !== undefined && finalValue > max) finalValue = max;

    if (finalValue !== value) {
        onChange(finalValue);
    }
    
    setInputValue(finalValue.toString());
    setIsEditing(false);
    if (onBlur) onBlur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setInputValue(value.toString());
      setIsEditing(false);
      if (onBlur) onBlur();
    }
  };

  if (disabled) {
      return (
        <div className={`text-${align} ${className} opacity-60 cursor-not-allowed`}>
            {format ? format(value) : value}
        </div>
      );
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        step={step}
        min={min}
        max={max}
        className={`w-full bg-white dark:bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 text-${align} ${inputClassName}`}
      />
    );
  }

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      className={`cursor-text hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded px-1.5 py-0.5 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600 text-${align} ${className}`}
      title="Nhấn để chỉnh sửa"
    >
      {format ? format(value) : value}
    </div>
  );
};
