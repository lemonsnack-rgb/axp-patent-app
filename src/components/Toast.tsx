import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ToastItem { id: number; text: string; type?: 'info' | 'success' | 'error' }

interface ToastCtx { show: (text: string, type?: 'info' | 'success' | 'error') => void }

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = ++idRef.current;
    setItems(prev => [...prev, { id, text, type }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  // 전역 호출 가능
  useEffect(() => {
    (window as any).showToast = show;
    return () => { delete (window as any).showToast; };
  }, [show]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map(t => (
          <div
            key={t.id}
            role="alert"
            aria-live="polite"
            className={
              'flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-base2 font-medium animate-fade-up pointer-events-auto max-w-md ' +
              (t.type === 'error'   ? 'bg-red-500 text-white' :
               t.type === 'success' ? 'bg-green-500 text-white' :
                                      'bg-neutral-800 text-white')
            }
          >
            {t.type === 'success' && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" className="shrink-0"><polyline points="2,8 6,12 14,4"/></svg>}
            {t.type === 'error'   && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14" className="shrink-0"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg>}
            {(!t.type || t.type === 'info') && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14" className="shrink-0"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="8"/><line x1="8" y1="11" x2="8" y2="11"/></svg>}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}
