// components/ui/Skeleton.tsx — DESIGN_GUIDE 4-4 기반
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export function Skeleton({ className, variant = 'rect' }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-neutral-100',
        variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded h-4' : 'rounded-lg',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** 작업 목록 아이템 스켈레톤 */
export function TaskItemSkeleton() {
  return (
    <div className="px-2 py-1.5 flex flex-col gap-1.5">
      <Skeleton variant="text" className="w-3/4 h-3.5" />
      <Skeleton variant="text" className="w-1/2 h-3" />
    </div>
  );
}

/** 카드 스켈레톤 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-neutral-150 p-5 shadow-card space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="w-8 h-8" />
        <Skeleton variant="text" className="flex-1 h-4" />
      </div>
      <Skeleton variant="text" className="w-full h-3" />
      <Skeleton variant="text" className="w-2/3 h-3" />
      <div className="flex gap-2 mt-2">
        <Skeleton variant="rect" className="h-6 w-16 rounded-full" />
        <Skeleton variant="rect" className="h-6 w-12 rounded-full" />
      </div>
    </div>
  );
}

/** 검색 결과 빈 상태 */
export function SearchEmptySkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-neutral-400">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-neutral-200">
        <circle cx="21" cy="21" r="15"/><line x1="32" y1="32" x2="44" y2="44"/>
      </svg>
      <div className="text-center">
        <p className="text-base2 font-medium text-neutral-500">검색 결과가 없습니다</p>
        <p className="text-sm2 text-neutral-400 mt-1">검색어를 변경하거나 필터를 조정해 보세요</p>
      </div>
    </div>
  );
}
