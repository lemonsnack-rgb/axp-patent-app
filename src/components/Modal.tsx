import { useEffect } from 'react';
import { Icon } from './Icon';

export function Modal({
  open, onClose, title, children, footer, width = 'max-w-lg',
}: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-up"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-lg shadow-card-deep w-full ${width} flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-base2 text-gray-800">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1" title="닫기 (Esc)">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto scroll-thin flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
