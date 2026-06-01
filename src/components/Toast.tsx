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
            className={
              'px-4 py-2.5 rounded-lg shadow-card-deep text-md2 font-medium animate-fade-up pointer-events-auto max-w-md ' +
              (t.type === 'error'   ? 'bg-red-600 text-white' :
               t.type === 'success' ? 'bg-green-700 text-white' :
                                      'bg-gray-800 text-white')
            }
          >
            {t.text}
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
