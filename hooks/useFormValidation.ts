
import { useState, useRef } from 'react';

export const useFormValidation = <T extends Record<string, any>>() => {
    const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
    const fieldRefs = useRef<Partial<Record<keyof T, HTMLElement | null>>>({});

    // Register ref for a field
    const register = (key: keyof T) => (el: HTMLElement | null) => {
        fieldRefs.current[key] = el;
    };

    // Helper to focus the first field with an error
    const focusFirstError = (currentErrors: Partial<Record<keyof T, string>>) => {
        const keys = Object.keys(currentErrors) as Array<keyof T>;
        if (keys.length > 0) {
            // Find the first ref that exists and matches an error key
            for (const key of keys) {
                const el = fieldRefs.current[key];
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                    break;
                }
            }
        }
    };

    return { 
        errors, 
        setErrors, 
        register, 
        focusFirstError,
        clearErrors: (key?: keyof T) => {
            if (key) {
                setErrors(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            } else {
                setErrors({});
            }
        }
    };
};
