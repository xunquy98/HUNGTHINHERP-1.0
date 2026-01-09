
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Primitives';

export interface WizardStep {
    id: string;
    title: string;
    description?: string;
    component: React.ReactNode;
    isValid: boolean;
}

interface WizardProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    steps: WizardStep[];
    onFinish: () => void;
    isFinishing?: boolean;
    finishLabel?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Wizard: React.FC<WizardProps> = ({ 
    isOpen, onClose, title, steps, onFinish, isFinishing = false, finishLabel = "Hoàn tất",
    size = 'lg'
}) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const currentStep = steps[currentStepIndex];

    // Reset on open
    useEffect(() => {
        if (isOpen) setCurrentStepIndex(0);
    }, [isOpen]);

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1 && currentStep.isValid) {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={title}
            size={size}
            footer={
                <div className="flex justify-between w-full">
                    <Button 
                        variant="secondary" 
                        onClick={handleBack} 
                        disabled={currentStepIndex === 0 || isFinishing}
                        icon="arrow_back"
                        className={currentStepIndex === 0 ? 'invisible' : ''}
                    >
                        Quay lại
                    </Button>
                    <div className="flex gap-3">
                        {currentStepIndex < steps.length - 1 ? (
                            <Button 
                                variant="primary" 
                                onClick={handleNext} 
                                disabled={!currentStep.isValid}
                                icon="arrow_forward"
                            >
                                Tiếp tục
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                onClick={onFinish} 
                                disabled={!currentStep.isValid || isFinishing}
                                loading={isFinishing}
                                icon="check"
                                className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                            >
                                {finishLabel}
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <div className="flex flex-col h-full min-h-[400px]">
                {/* Stepper Header */}
                <div className="mb-8 px-2">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-700 -z-10 rounded"></div>
                        {steps.map((step, idx) => {
                            const isCompleted = idx < currentStepIndex;
                            const isActive = idx === currentStepIndex;
                            
                            return (
                                <div key={step.id} className="flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-2">
                                    <div 
                                        className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ring-4 ring-white dark:ring-slate-900 ${
                                            isActive 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110' 
                                            : isCompleted 
                                                ? 'bg-emerald-500 text-white' 
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {isCompleted ? <span className="material-symbols-outlined text-[16px]">check</span> : idx + 1}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {step.title}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 animate-[fadeIn_0.2s_ease-out]">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{currentStep.title}</h3>
                        {currentStep.description && <p className="text-sm text-slate-500">{currentStep.description}</p>}
                    </div>
                    {currentStep.component}
                </div>
            </div>
        </Modal>
    );
};
