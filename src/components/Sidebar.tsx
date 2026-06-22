import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useStore, taskTypeMeta } from '../store';
import { TaskItemSkeleton } from './ui/Skeleton';
import { toast, openAlertDialog } from '@muhayu/axp-ui';
import { Icon } from './Icon';
import { QuickNameModal } from './QuickNameModal';
import { EmptyState } from './EmptyState';
import type { Task } from '../types';

export function Sidebar() {
  const {
    mode, setMode, sidebarCollapsed, setSidebarCollapsed,
    tasks, activeTaskId, setActiveTaskId,
    taskToggleFavorite, taskUpdate, taskRemove, taskAdd,
  } = useStore();
  const [taskFilter, setTaskFilter] = useState<'all' | 'fav'>('all');
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{ open: boolean; taskId: string; current: string }>({ open: false, taskId: '', current: '' });

  // 키보드 Cmd/Ctrl+B 사이드바 토글
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const isActive = (k: string) => mode === k || (k === 'home' && mode === 'project');

  const sorted = [...tasks]
    .filter(t => t.type === 'spec')
    .sort((a, b) => b.updatedAt - a.updatedAt);
  let list: Task[];
  if (search) {
    const s = search.toLowerCase();
    list = sorted.filter(t => t.name.toLowerCase().includes(s));
  } else if (taskFilter === 'fav') {
    list = sorted.filter(t => t.favorite);
  } else {
    const favs = sorted.filter(t => t.favorite);
    const others = sorted.filter(t => !t.favorite).slice(0, 20);
    list = [...favs, ...others];
  }

  return (
    <aside
      className={clsx(
        'border-r border-zinc-200 bg-white flex flex-col shrink-0 transition-all duration-200 relative',
        sidebarCollapsed ? 'w-nav-c min-w-nav-c' : 'w-nav min-w-nav',
        sidebarCollapsed && 'max-md:!w-0 max-md:!min-w-0 max-md:overflow-hidden max-md:border-0',
        'max-md:z-30',
      )}
    >
      <nav className="p-2 flex flex-col gap-0.5">
        <NavItem icon="edit"    label="새 작업"    active={isActive('newtask')} collapsed={sidebarCollapsed} onClick={() => setMode('newtask')} primary />
        <NavItem icon="library" label="라이브러리" active={isActive('library')} collapsed={sidebarCollapsed} onClick={() => setMode('library')} />
      </nav>

      {!sidebarCollapsed && (
        <>
          <div className="mx-3 my-2 border-t border-zinc-100" />
          <div className="px-3 flex items-center justify-between gap-1 text-sm2 text-zinc-500 font-semibold mb-1">
            <span>작업 목록</span>
            <span className="text-xs2 bg-zinc-100 px-1.5 rounded">{tasks.length}</span>
          </div>
          <div className="px-3 flex items-center gap-1 mb-1.5">
            <div className="relative flex-1">
              <Icon name="search" size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-6 pr-2 py-1 border border-zinc-200 rounded-md text-sm2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-shadow"
                placeholder="검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setTaskFilter(taskFilter === 'all' ? 'fav' : 'all')}
              className={clsx('w-7 h-7 flex items-center justify-center rounded',
                taskFilter === 'fav' ? 'bg-amber-50 text-amber-500' : 'text-gray-400 hover:bg-gray-100')}
              title={taskFilter === 'fav' ? '즐겨찾기만 보기 중' : '즐겨찾기 필터'}
            >
              <Icon name={taskFilter === 'fav' ? 'star-filled' : 'star'} size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin px-2 py-1.5">
            {list.length === 0 ? (
              search
                ? <EmptyState compact title="검색 결과 없음" />
                : tasks.length === 0
                  ? <div className="space-y-1 px-1 py-2">{[0,1,2].map(i => <TaskItemSkeleton key={i} />)}</div>
                  : <EmptyState compact title="작업이 없습니다." description="새 작업을 시작하세요" />
            ) : list.map(t => (
              <TaskRow
                key={t.id}
                t={t}
                active={t.id === activeTaskId}
                onSelect={() => {
                  if (t.type === 'patent_search' || t.type === 'paper_search') {
                    toast('준비 중입니다. 추후 오픈될 예정입니다.');
                    return;
                  }
                  setActiveTaskId(t.id);
                  setMode(t.type === 'spec' ? 'spec' : 'search');
                }}
                onToggleFav={() => taskToggleFavorite(t.id)}
                menuOpen={menuFor === t.id}
                onMenuToggle={() => setMenuFor(menuFor === t.id ? null : t.id)}
                onRename={() => { setRenameState({ open: true, taskId: t.id, current: t.name }); setMenuFor(null); }}
                onDuplicate={() => {
                  taskAdd({ type: t.type, name: t.name + ' 복사', folderId: t.folderId, clientId: t.clientId, contactId: t.contactId, techField: t.techField });
                  toast('작업 복제됨');
                  setMenuFor(null);
                }}
                onDelete={() => {
                  setMenuFor(null);
                  openAlertDialog(
                    { title: '확인', description: `"${t.name}" 작업을 삭제합니까?`, confirm: '삭제', cancel: '취소' },
                    { theme: 'danger', onConfirm: (ctrl) => { taskRemove(t.id); if (activeTaskId === t.id) setActiveTaskId(null); toast('작업 삭제됨'); ctrl.close(); } }
                  );
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className={clsx('mt-auto border-t border-zinc-100', sidebarCollapsed ? 'p-2' : 'p-3')}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 mt-1">
            <span className="w-7 h-7 rounded-full bg-brand-400 text-white text-xs2 font-semibold flex items-center justify-center">왕</span>
            <div className="text-md2 text-zinc-800">왕일</div>
          </div>
        )}
      </div>
      <QuickNameModal
        open={renameState.open}
        title="작업 이름 변경"
        placeholder={renameState.current}
        onSubmit={name => { taskUpdate(renameState.taskId, { name }); toast('이름 변경 완료'); setRenameState(s => ({ ...s, open: false })); }}
        onClose={() => setRenameState(s => ({ ...s, open: false }))}
      />
    </aside>
  );
}

function NavItem({ icon, label, active, collapsed, onClick, primary }: {
  icon: any; label: string; active: boolean; collapsed: boolean; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-md text-md2 font-medium transition-all active:scale-[0.98]',
        collapsed && 'justify-center px-0',
        active && 'bg-blue-50 text-brand-400',
        !active && primary && 'text-zinc-800 hover:bg-zinc-100',
        !active && !primary && 'text-zinc-600 hover:bg-zinc-100',
      )}
      title={label}
    >
      <Icon name={icon} size={16} />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function TaskRow({ t, active, onSelect, onToggleFav, menuOpen, onMenuToggle, onRename, onDuplicate, onDelete }: {
  t: Task; active: boolean; onSelect: () => void; onToggleFav: () => void;
  menuOpen: boolean; onMenuToggle: () => void;
  onRename: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const meta = taskTypeMeta(t.type);
  const ago = relTime(t.updatedAt);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onMenuToggle();
      }
    };
    setTimeout(() => document.addEventListener('click', onClickOutside), 0);
    return () => document.removeEventListener('click', onClickOutside);
  }, [menuOpen, onMenuToggle]);

  return (
    <div
      className={clsx(
        'group relative w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-all cursor-pointer',
        active ? 'bg-blue-50' : 'hover:bg-zinc-50',
      )}
      onClick={onSelect}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        className={clsx('mt-0.5', t.favorite ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500')}
        title="즐겨찾기"
      >
        <Icon name={t.favorite ? 'star-filled' : 'star'} size={13} />
      </span>
      <span className={clsx('mt-0.5', `text-${meta.color}-600`)}>
        <Icon name={meta.icon} size={13} />
      </span>
      <span className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className={clsx('text-md2 font-medium leading-tight truncate', active ? 'text-brand-400' : 'text-zinc-800')}>
            {t.name}
          </span>
          {(t.name === '직무발명서' || t.name === '미지정') && (
            <span className="shrink-0 text-[10px] px-1 py-px bg-zinc-100 text-zinc-400 rounded font-medium">샘플</span>
          )}
        </div>
        <div className="text-xs2 text-zinc-400 mt-0.5 truncate">
          {t.techField
            ? <><span className="text-zinc-500 font-medium">{t.techField}</span> · {ago}</>
            : ago}
        </div>
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
        className={clsx('w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700',
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
        title="작업 메뉴"
      >
        ⋯
      </button>
      {menuOpen && (
        <div ref={menuRef}
          className="absolute right-2 top-9 z-20 bg-white border border-zinc-200 rounded-xl shadow-card-deep py-1 min-w-[140px]"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onRename} className="w-full text-left px-3 py-1.5 text-md2 hover:bg-zinc-50 transition-colors">이름 변경</button>
          <button onClick={onDuplicate} className="w-full text-left px-3 py-1.5 text-md2 hover:bg-zinc-50 transition-colors">복제</button>
          <div className="h-px bg-zinc-100 my-1" />
          <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-md2 hover:bg-red-50 text-red-600 transition-colors">삭제</button>
        </div>
      )}
    </div>
  );
}

function relTime(ts: number): string {
  if (!ts || !isFinite(ts)) return '날짜 없음';
  const diff = Date.now() - ts;
  if (diff < 0) return '방금';
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}
