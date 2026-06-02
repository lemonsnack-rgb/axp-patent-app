// components/ui/Badge.tsx — 작업 유형, 상태 표시용
import clsx from 'clsx';

type BadgeColor = 'brand' | 'violet' | 'amber' | 'green' | 'red' | 'neutral';

interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
  brand:   'bg-brand-50 text-brand-600',
  violet:  'bg-violet-50 text-violet-600',
  amber:   'bg-amber-50 text-amber-600',
  green:   'bg-green-50 text-green-700',
  red:     'bg-red-50 text-red-600',
  neutral: 'bg-neutral-100 text-neutral-500',
};

export function Badge({ color = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs2 font-medium',
      colorClasses[color],
      className,
    )}>
      {children}
    </span>
  );
}
