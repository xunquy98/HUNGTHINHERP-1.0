
import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height, circle }) => {
  return (
    <div 
      className={`animate-pulse bg-slate-200 dark:bg-slate-700 ${circle ? 'rounded-full' : 'rounded-lg'} ${className}`}
      style={{ width, height }}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
    <div className="w-full">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800/50">
                <Skeleton width={40} height={40} className="rounded-md shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton width="40%" height={14} />
                    <Skeleton width="25%" height={10} />
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0 hidden sm:flex">
                    <Skeleton width={80} height={14} />
                    <Skeleton width={60} height={10} />
                </div>
                <Skeleton width={32} height={32} circle className="shrink-0" />
            </div>
        ))}
    </div>
);

export const DetailSkeleton: React.FC = () => (
    <div className="space-y-8 animate-pulse p-2">
        {/* Header */}
        <div className="flex justify-between items-start">
            <div className="space-y-3">
                <Skeleton width={200} height={32} />
                <Skeleton width={120} height={16} />
            </div>
            <div className="flex gap-2">
                <Skeleton width={32} height={32} circle />
                <Skeleton width={32} height={32} circle />
            </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-4">
            <Skeleton height={120} className="w-full" />
            <Skeleton height={120} className="w-full" />
        </div>

        {/* Content Body */}
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Skeleton width={150} height={20} />
                <Skeleton width={60} height={20} />
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
                <Skeleton width="100%" height={40} />
                <Skeleton width="100%" height={40} />
                <Skeleton width="100%" height={40} />
            </div>
        </div>
        
        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
            <Skeleton height={44} className="flex-1" />
            <Skeleton height={44} className="flex-[2]" />
        </div>
    </div>
);
