
import React from 'react';
import { TOKENS } from './Tokens';

interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label className={`text-[11px] font-bold uppercase tracking-wider flex justify-between ${error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
        <span>{label} {required && <span className="text-red-500">*</span>}</span>
      </label>
    )}
    {children}
    {error && (
        <span className="text-[10px] font-bold text-red-500 animate-[fadeIn_0.2s_ease-out] flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">error</span>
            {error}
        </span>
    )}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const FormInput = React.forwardRef<HTMLInputElement, InputProps>(({ className = '', error, ...props }, ref) => (
  <input 
    ref={ref}
    className={`${TOKENS.INPUT.BASE} ${TOKENS.INPUT.FOCUS} ${TOKENS.INPUT.SIZE.MD} ${error ? '!border-red-500 focus:!border-red-500 focus:!ring-red-500/20' : ''} ${className}`} 
    {...props} 
  />
));

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const FormSelect = React.forwardRef<HTMLSelectElement, SelectProps>(({ className = '', error, children, ...props }, ref) => (
  <div className="relative">
    <select 
      ref={ref}
      className={`appearance-none ${TOKENS.INPUT.BASE} ${TOKENS.INPUT.FOCUS} ${TOKENS.INPUT.SIZE.MD} pr-8 cursor-pointer ${error ? '!border-red-500 focus:!border-red-500 focus:!ring-red-500/20' : ''} ${className}`} 
      {...props}
    >
      {children}
    </select>
    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 material-symbols-outlined text-[18px]">
      unfold_more
    </span>
  </div>
));

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = '', error, ...props }, ref) => (
  <textarea 
    ref={ref}
    className={`${TOKENS.INPUT.BASE} ${TOKENS.INPUT.FOCUS} p-3 min-h-[100px] resize-none ${error ? '!border-red-500 focus:!border-red-500 focus:!ring-red-500/20' : ''} ${className}`} 
    {...props} 
  />
));
