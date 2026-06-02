import { useStore } from '../store';
import { Icon } from './Icon';

// ★ 도움말 URL — 준비되면 아래 주소를 교체하세요
const HELP_URL = 'https://axplain.ai/help'; // TODO: 실제 URL로 교체

const MODE_LABELS: Record<string, string> = {
  newtask: '새 작업',
  home:    '프로젝트',
  project: '프로젝트',
  library: '라이브러리',
  clients: '고객사',
  search:  '선행기술 검색',
  spec:    '명세서 작성',
};

export function TopBar() {
  const { mode, sidebarCollapsed, setSidebarCollapsed, setMode, tasks, activeTaskId } = useStore();
  const active = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
  // 검색 모드에서 작업 유형에 따라 레이블 구분
  const label = mode === 'search' && active
    ? (active.type === 'patent_search' ? '특허 검색' : active.type === 'paper_search' ? '논문 검색' : '선행기술 검색')
    : MODE_LABELS[mode] || '';
  const showTaskName = (mode === 'spec' || mode === 'search') && active;

  return (
    <header className="h-topbar bg-white border-b border-zinc-200 flex items-center justify-between px-3 shrink-0">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-between"
          style={{ width: `calc(${sidebarCollapsed ? '72px' : '260px'} - 22px)` }}
        >
          <button
            onClick={() => sidebarCollapsed ? setSidebarCollapsed(false) : setMode('home')}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all"
            title={sidebarCollapsed ? '사이드바 열기' : '프로젝트로 이동'}
          >
            <span className="w-5 h-5 text-blue-600"><Icon name="logo" size={20} /></span>
            {!sidebarCollapsed && <span className="font-semibold text-base2 text-zinc-800">AXPlain.ai</span>}
          </button>
          {!sidebarCollapsed && (
            <button onClick={() => setSidebarCollapsed(true)} className="btn-ghost p-1" title="사이드바 토글">
              <Icon name="hamburger" size={16} />
            </button>
          )}
        </div>
        <span className="text-md2 text-zinc-500 ml-2">
          {label}
          {showTaskName && active && (
            <>
              <span className="mx-1 text-zinc-300">/</span>
              <span className="text-zinc-800 font-medium">{active.name}</span>
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          title="도움말 (새 탭에서 열기)"
        ><Icon name="help" /></a>
        <button className="btn-ghost relative" title="알림">
          <Icon name="bell" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <button className="btn-ghost text-sm2 px-2" title="언어">KR</button>
      </div>
    </header>
  );
}
