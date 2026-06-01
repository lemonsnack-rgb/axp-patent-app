import { useStore } from '../store';
import { Icon } from './Icon';

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
  const label = MODE_LABELS[mode] || '';
  const showTaskName = (mode === 'spec' || mode === 'search') && active;

  return (
    <header className="h-topbar bg-white border-b border-ck-border flex items-center justify-between px-3 shrink-0">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-between"
          style={{ width: `calc(${sidebarCollapsed ? '72px' : '260px'} - 22px)` }}
        >
          <button
            onClick={() => sidebarCollapsed ? setSidebarCollapsed(false) : setMode('home')}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            title={sidebarCollapsed ? '사이드바 열기' : '프로젝트로 이동'}
          >
            <span className="w-5 h-5 text-blue-700"><Icon name="logo" size={20} /></span>
            {!sidebarCollapsed && <span className="font-semibold text-base2 text-gray-800">AXPlain.ai</span>}
          </button>
          {!sidebarCollapsed && (
            <button onClick={() => setSidebarCollapsed(true)} className="btn-ghost p-1" title="사이드바 토글">
              <Icon name="hamburger" size={16} />
            </button>
          )}
        </div>
        <span className="text-md2 text-gray-500 ml-2">
          {label}
          {showTaskName && active && (
            <>
              <span className="mx-1 text-gray-300">—</span>
              <span className="text-gray-800 font-medium">{active.name}</span>
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button className="btn-ghost" title="도움말"><Icon name="help" /></button>
        <button className="btn-ghost relative" title="알림">
          <Icon name="bell" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <button className="btn-ghost text-sm2 px-2" title="언어">KR</button>
      </div>
    </header>
  );
}
