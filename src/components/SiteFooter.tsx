// 전역 서비스 푸터 — CK.Patent를 하나의 서비스로 인지시키는 기본 요소.
// 이용약관·개인정보처리방침·연락처·FAQ 진입 링크 + 회사/저작권 표기. (공통·횡단 COM-080)
import { useStore } from '../store';
import type { AppMode } from '../types';

const LINKS: { mode: AppMode; label: string }[] = [
  { mode: 'terms',   label: '이용약관' },
  { mode: 'privacy', label: '개인정보처리방침' },
  { mode: 'contact', label: '연락처' },
  { mode: 'faq',     label: 'FAQ' },
];

export function SiteFooter() {
  const { setMode } = useStore();
  return (
    <footer
      data-spec="COM-080"
      className="shrink-0 border-t border-gray-200 bg-white px-4 py-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs2 text-gray-400"
    >
      <span className="font-semibold text-gray-500">CK.Patent</span>
      <span className="text-gray-300">·</span>
      {LINKS.map(l => (
        <button
          key={l.mode}
          onClick={() => setMode(l.mode)}
          className="hover:text-brand-400 hover:underline transition-colors"
        >{l.label}</button>
      ))}
      <span className="flex-1" />
      <span>© 2026 muhayu · CK.Patent — 특허 선행기술조사·명세서 작성 플랫폼</span>
    </footer>
  );
}
