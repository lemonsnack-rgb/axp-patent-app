// components/ui/Card.tsx — DESIGN_GUIDE 2-3 기반
import { forwardRef } from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  hoverable?: boolean;
  children: React.ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ selected, hoverable = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'bg-white rounded-xl border p-5 shadow-card transition-all duration-200',
          selected
            ? 'border-brand-400 shadow-[0_0_0_2px_rgba(59,142,245,0.2)] bg-brand-50'
            : 'border-neutral-150',
          hoverable && !selected && [
            'hover:border-brand-200 hover:shadow-card-hover hover:-translate-y-px cursor-pointer',
          ],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';
