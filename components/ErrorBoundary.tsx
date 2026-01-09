
import React, { ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/Primitives";
import { db } from "../services/db";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Log to DB
    try {
        db.errorLogs.add({
            timestamp: Date.now(),
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            severity: 'error',
            route: window.location.hash || window.location.pathname,
            userAgent: navigator.userAgent
        });
    } catch (e) {
        console.error("Failed to log error to DB:", e);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0b1121] p-6 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 text-center border border-slate-200 dark:border-slate-700 animate-[fadeIn_0.3s_ease-out]">
            <div className="size-20 mx-auto bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-5xl text-red-500">
                error_outline
              </span>
            </div>
            
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              Đã xảy ra lỗi!
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              Hệ thống gặp sự cố không mong muốn. Vui lòng tải lại trang hoặc liên hệ quản trị viên nếu lỗi vẫn tiếp diễn.
            </p>

            {this.state.error && (
              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-left mb-6 overflow-hidden">
                <p className="text-[10px] font-mono text-red-600 dark:text-red-400 break-words">
                  Error: {this.state.error.message}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Button 
                variant="primary" 
                onClick={this.handleReload} 
                className="w-full justify-center"
                icon="refresh"
              >
                Tải lại trang
              </Button>
              
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 font-medium">
                  Hỗ trợ kỹ thuật: 0909 123 456 (Admin)
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <>{(this as any).props.children}</>;
  }
}
