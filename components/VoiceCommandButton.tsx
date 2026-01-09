
import React from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { ViewState } from '../types';

interface VoiceCommandButtonProps {
    onNavigate: (view: ViewState, params?: any) => void;
    onSearchTrigger: (query: string) => void; // Callback to open search with query
}

export const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({ onNavigate, onSearchTrigger }) => {
    const { isListening, isProcessing, feedback, startListening } = useVoiceAssistant(onNavigate, onSearchTrigger);

    return (
        <div className="relative flex items-center">
            {/* Visual Feedback Label */}
            {(isListening || isProcessing || feedback) && (
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-lg animate-[fadeIn_0.2s_ease-out] z-50 flex items-center gap-2">
                    {isListening && <span className="size-2 bg-red-500 rounded-full animate-pulse"></span>}
                    {isProcessing && <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>}
                    {feedback}
                </div>
            )}

            <button
                onClick={startListening}
                disabled={isListening || isProcessing}
                className={`size-10 rounded-full flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
                    isListening 
                    ? 'bg-red-500 text-white shadow-red-500/50 shadow-lg scale-110' 
                    : isProcessing
                        ? 'bg-indigo-500 text-white shadow-indigo-500/50 shadow-lg scale-105'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
                title="Ra lệnh bằng giọng nói"
            >
                {/* Ripple Effect when listening */}
                {isListening && (
                    <span className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-75"></span>
                )}
                
                <span className="material-symbols-outlined text-[20px] relative z-10">
                    {isProcessing ? 'psychology' : 'mic'}
                </span>
            </button>
        </div>
    );
};
