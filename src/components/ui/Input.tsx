import { forwardRef, useState } from 'react';
import { Input as AxpInput } from '@muhayu/axp-ui';
import clsx from 'clsx';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, showPasswordToggle, className, type, ...props }, ref) => {
    const [showPw, setShowPw] = useState(false);
    const inputType = showPasswordToggle ? (showPw ? 'text' : 'password') : type;

    return (
      <div className="relative w-full">
        <AxpInput
          ref={ref}
          type={inputType}
          invalid={!!error}
          className={clsx('w-full', showPasswordToggle && 'pr-10', className)}
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
