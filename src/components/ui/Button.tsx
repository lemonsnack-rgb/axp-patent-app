// components/ui/Button.tsx — DESIGN_GUIDE 2-1 기반
import { forwardRef } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-brand-400 text-white hover:bg-brand-500 active:bg-brand-600 disabled:bg-neutral-100 disabled:text-neutral-300',
  secondary: 'bg-transparent text-brand-400 border border-brand-400 hover:bg-brand-50 active:bg-brand-100 disabled:border-neutral-200 disabled:text-neutral-300',
  ghost:     'bg-transparent text-neutral-500 border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100 disabled:text-neutral-300',
  danger:    'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:bg-neutral-100 disabled:text-neutral-300',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs2 gap-1',
  sm: 'h-8 px-3 text-sm2 gap-1.5',
  md: 'h-10 px-5 text-base2 gap-2',
  lg: 'h-12 px-6 text-lg2 gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        className={clsx(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
