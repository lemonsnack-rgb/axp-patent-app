// components/ui/Input.tsx — DESIGN_GUIDE 2-2 기반
import { forwardRef, useState } from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, showPasswordToggle, className, type, ...props }, ref) => {
    const [showPw, setShowPw] = useState(false);
    const inputType = showPasswordToggle ? (showPw ? 'text' : 'password') : type;

    return (
      <div className="relative">
        <input
          ref={ref}
          type={inputType}
          className={clsx(
            'w-full h-[42px] px-3.5 py-2.5 rounded-lg border text-base2 bg-white',
            'placeholder:text-neutral-300 text-neutral-700',
            'transition-all duration-150',
            'focus:outline-none focus:ring-[3px] focus:ring-brand-400/15 focus:border-brand-400',
            error
              ? 'border-red-400 ring-[3px] ring-red-400/10'
              : 'border-neutral-200 hover:border-neutral-300',
            showPasswordToggle && 'pr-10',
            className,
          )}
          {...props}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
          >
            {showPw ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/>
                <line x1="3" y1="3" x2="17" y2="17"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/>
              </svg>
            )}
          </button>
        )}
        {error && <p className="mt-1 text-xs2 text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
