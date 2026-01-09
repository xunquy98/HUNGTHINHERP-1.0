
import { useState, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';

interface UseAsyncActionOptions {
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (result?: any) => void;
    onError?: (error: any) => void;
}

export function useAsyncAction<T = any, A extends any[] = any[]>(
    action: (...args: A) => Promise<T>,
    options: UseAsyncActionOptions = {}
) {
    const [isLoading, setIsLoading] = useState(false);
    const { showNotification } = useAppContext();

    const execute = useCallback(async (...args: A) => {
        if (isLoading) return; // Prevent double click

        setIsLoading(true);
        try {
            const result = await action(...args);
            
            if (options.successMessage) {
                showNotification(options.successMessage, 'success');
            }
            if (options.onSuccess) {
                options.onSuccess(result);
            }
            return result;
        } catch (error: any) {
            console.error("Action failed:", error);
            const msg = options.errorMessage || error.message || 'Đã xảy ra lỗi.';
            showNotification(msg, 'error');
            
            if (options.onError) {
                options.onError(error);
            }
        } finally {
            setIsLoading(false);
        }
    }, [action, isLoading, options, showNotification]);

    return { execute, isLoading };
}
