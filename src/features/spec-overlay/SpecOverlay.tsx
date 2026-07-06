// 기능명세 부착 미리보기(개발/리뷰용) — "명세 모드" 토글.
// 켜면 data-spec 요소에 ID 뱃지·외곽선을 표시하고, 클릭하면 해당 명세를 우측 패널로 조회한다.
import { useState, useEffect } from 'react';
import { SPEC_CATALOG } from './specCatalog';

export function SpecOverlay() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // 명세 모드 on/off → body 클래스 토글(외곽선·뱃지는 CSS가 처리)
  useEffect(() => {
    if (active) document.body.classList.add('spec-mode');
    else { document.body.classList.remove('spec-mode'); setSelected(null); }
    return () => document.body.classList.remove('spec-mode');
  }, [active]);

  // 명세 모드에서 data-spec 요소 클릭 → 원래 동작 차단하고 명세 조회
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-spec]') as HTMLElement | null;
      if (!el) return;
      const id = el.getAttribute('data-spec');
      if (id && SPEC_CATALOG[id]) {
        e.preventDefault();
        e.stopPropagation();
        setSelected(id);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 선택한 항목(같은 ID의 모든 요소)에 하이라이트 클래스 부여
  useEffect(() => {
    const CLS = 'spec-selected';
    document.querySelectorAll('.' + CLS).forEach(el => el.classList.remove(CLS));
    if (active && selected) {
      document.querySelectorAll(`[data-spec="${selected}"]`).forEach(el => el.classList.add(CLS));
    }
    return () => document.querySelectorAll('.' + CLS).forEach(el => el.classList.remove(CLS));
  }, [selected, active]);

  const entry = selected ? SPEC_CATALOG[selected] : null;

  return (
    <>
      <button
        onClick={() => setActive(v => !v)}
        className={`fixed bottom-4 left-4 z-[100] px-3 py-2 rounded-full shadow-lg text-xs2 font-bold transition-colors ${
          active ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-50'
        }`}
        title="기능명세 부착 미리보기 (개발/리뷰용). 켜면 요소에 명세 ID가 표시되고, 클릭하면 명세를 조회합니다."
      >
        {active ? '● 명세 모드 ON (클릭하여 조회)' : '명세 모드'}
      </button>

      {entry && (
        <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[380px] bg-white border-l border-gray-200 shadow-2xl flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="font-mono text-xs2 font-bold bg-indigo-600 text-white rounded px-1.5 py-0.5">{entry.id}</span>
            <span className="font-bold text-gray-800 flex-1 min-w-0 truncate">{entry.component}</span>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1" title="닫기 (Esc)">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-xs2 text-gray-400">{entry.screen}</div>
            <SpecField label="표시 정보·구성" value={entry.display} />
            <SpecField label="기능·상호작용" value={entry.interaction} />
            <SpecField label="사전조건" value={entry.precondition} />
            <SpecField label="사후결과" value={entry.postcondition} />
            <div className="pt-2 mt-2 border-t border-gray-100 text-xs2 text-gray-400">
              출처: docs/기능정의서.md · 「메뉴·화면별 기능명세」
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SpecField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs2 font-semibold text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm2 text-gray-800 leading-relaxed">{value}</div>
    </div>
  );
}
