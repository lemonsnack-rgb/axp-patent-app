import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useStore, taskTypeMeta } from '../store';
import { toast, Button } from '@muhayu/axp-ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Badge, Card, Input } from '../components/ui';
import { PROJECT_COLORS } from './HomeView';
import type { TaskType } from '../types';

const TYPE_CARDS: { type: TaskType; title: string; desc: string; icon: any; color: string }[] = [
  { type: 'spec',          title: '명세서',     desc: '직무발명서를 분석해 명세서 초안을 작성',  icon: 'doc',    color: 'blue' },
  { type: 'patent_search', title: '특허 검색', desc: '국내·해외 특허 선행기술 조사',           icon: 'search', color: 'violet' },
  { type: 'paper_search',  title: '논문 검색', desc: '학술 논문·저널 검색',                     icon: 'paper',  color: 'amber' },
];

export function ProjectDetailView() {
  const {
    projects, activeProjectId, tasks, clients, library,
    setMode, setActiveTaskId,
    projectUpdate, projectRemove, projectToggleFavorite,
    taskUpdate,
  } = useStore();
  const [tab, setTab] = useState<'tasks' | 'library'>('tasks');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [libTypeFilter, setLibTypeFilter] = useState<'all' | 'patent' | 'paper'>('all');
  const menuRef = useRef<HTMLDivElement>(null);

  const p = activeProjectId ? projects.find(x => x.id === activeProjectId) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => document.removeEventListener('click', onClick);
  }, [menuOpen]);

  if (!p) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">프로젝트 정보를 찾을 수 없습니다.</div>;
  }

  const projectTasks = tasks.filter(t => t.folderId === p.id);
  const projectLibrary = library.filter(l => l.fromFolderId === p.id);
  const client = p.clientId ? clients.find(c => c.id === p.clientId) : null;

  const rename = () => {
    const name = prompt('프로젝트 이름 변경:', p.name);
    if (!name?.trim()) return;
    projectUpdate(p.id, { name: name.trim() });
    toast(`프로젝트 이름 변경: ${name.trim()}`);
    setMenuOpen(false);
  };
  const setColor = (c: string) => {
    projectUpdate(p.id, { color: c });
    toast('색상 변경됨');
    setMenuOpen(false);
  };
  const remove = () => {
    const cnt = projectTasks.length;
    if (!confirm(`프로젝트 "${p.name}"을(를) 삭제하시겠습니까?${cnt > 0 ? `\n(소속 작업 ${cnt}개는 미분류로 이동됩니다)` : ''}`)) return;
    // 작업 folderId 제거
    projectTasks.forEach(t => taskUpdate(t.id, { folderId: undefined }));
    projectRemove(p.id);
    toast('프로젝트 삭제됨');
    setMode('home');
  };

  // 라이브러리 필터
  let libFiltered = projectLibrary;
  if (libSearch) {
    const s = libSearch.toLowerCase();
    libFiltered = libFiltered.filter(l =>
      [l.title, l.refNumber, l.applicant].filter(Boolean).join(' ').toLowerCase().includes(s),
    );
  }
  if (libTypeFilter !== 'all') libFiltered = libFiltered.filter(l => l.type === libTypeFilter);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-ck-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-ck-border shrink-0">
        <Button variant="outlined" color="primary" size="sm" onClick={() => setMode('home')} title="프로젝트 목록으로">
          <Icon name="arrow-left" size={13} /> 프로젝트
        </Button>
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color || '#1e5fa6' }} />
        <h2 className="text-lg2 font-bold text-zinc-800 truncate">{p.name}</h2>
        <span className="text-sm2 text-zinc-500">
          {projectTasks.length}건
          {client && ` · ${client.name}`}
          {p.favorite && <span className="ml-2 text-amber-500"><Icon name="star-filled" size={11} className="inline" /></span>}
        </span>

        <div className="ml-auto flex items-center gap-1.5 relative">
          <Button variant="outlined" color="primary" size="sm" onClick={() => setMenuOpen(!menuOpen)} title="프로젝트 설정">
            <Icon name="settings" size={13} /> 설정
          </Button>
          <Button variant="filled" color="primary" size="sm" onClick={() => setNewTaskOpen(true)} title="이 프로젝트에 새 작업 추가">
            <Icon name="plus" size={13} /> 이 프로젝트에 새 작업
          </Button>
          {menuOpen && (
            <div ref={menuRef} className="absolute right-0 top-full mt-1 z-30 bg-white border border-zinc-200 rounded-xl shadow-card-deep py-1.5 min-w-[220px]">
              <MenuItem icon="edit" label="이름 변경" onClick={rename} />
              <MenuItem
                icon={p.favorite ? 'star-filled' : 'star'}
                label={p.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                onClick={() => { projectToggleFavorite(p.id); setMenuOpen(false); }}
              />
              <div className="h-px bg-zinc-100 my-1" />
              <div className="px-3 py-1 text-xs2 text-zinc-400 font-semibold uppercase tracking-wide">색상</div>
              <div className="px-3 py-1.5 flex gap-1.5">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={clsx('w-5 h-5 rounded-full', p.color === c && 'ring-2 ring-offset-1 ring-gray-800')}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <div className="h-px bg-zinc-100 my-1" />
              <MenuItem icon="close" label="프로젝트 삭제" danger onClick={remove} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-ck-border flex items-center px-4 gap-1 shrink-0">
        <TabBtn icon="grid" label="작업" count={projectTasks.length} active={tab === 'tasks'} onClick={() => setTab('tasks')} />
        <TabBtn icon="library" label="라이브러리" count={projectLibrary.length} active={tab === 'library'} onClick={() => setTab('library')} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-thin p-6">
        {tab === 'tasks' && (
          projectTasks.length === 0 ? (
            <EmptyState
              title="이 프로젝트에 작업이 없습니다."
              description="우측 상단 [+ 이 프로젝트에 새 작업]으로 추가하세요."
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {projectTasks.map(t => {
                const meta = taskTypeMeta(t.type);
                return (
                  <Card
                    key={t.id}
                    onClick={() => {
                      setActiveTaskId(t.id);
                      setMode(t.type === 'spec' ? 'spec' : 'search');
                    }}
                    hoverable
                    className="!p-3 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-${meta.color}-600`}><Icon name={meta.icon} size={14} /></span>
                      <span className="text-xs2 text-zinc-500">{meta.label}</span>
                      {t.favorite && <Icon name="star-filled" size={12} className="text-amber-500" />}
                    </div>
                    <div className="text-md2 font-semibold text-gray-800 line-clamp-2 leading-snug">{t.name}</div>
                    {t.techField && <div className="text-xs2 text-gray-400 mt-1.5 truncate">{t.techField}</div>}
                  </Card>
                );
              })}
            </div>
          )
        )}

        {tab === 'library' && (
          <>
            {/* 라이브러리 툴바 */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <Icon name="search" size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-7 py-1.5 text-sm2 w-60"
                  placeholder="제목·번호·출원인 검색..."
                  value={libSearch}
                  onChange={e => setLibSearch(e.target.value)}
                />
              </div>
              <select className="input py-1.5 px-2 text-sm2 w-auto" value={libTypeFilter} onChange={e => setLibTypeFilter(e.target.value as any)}>
                <option value="all">전체</option>
                <option value="patent">특허만</option>
                <option value="paper">논문만</option>
              </select>
              <Button variant="outlined" color="primary" size="sm" className="text-sm2" onClick={() => toast('CSV 내보내기 (mockup)')}>
                ⬇ CSV 내보내기
              </Button>
            </div>

            {/* 라이브러리 표 */}
            {libFiltered.length === 0 ? (
              <EmptyState
                title="이 프로젝트에 저장된 라이브러리 자료가 없습니다."
                description="검색에서 [저장]을 누르면 여기 표시됩니다."
              />
            ) : (
              <Card className="overflow-hidden !p-0">
                <table className="w-full text-md2">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs2 font-semibold text-gray-500">유형</th>
                      <th className="px-3 py-2 text-left text-xs2 font-semibold text-gray-500">번호</th>
                      <th className="px-3 py-2 text-left text-xs2 font-semibold text-gray-500">제목</th>
                      <th className="px-3 py-2 text-left text-xs2 font-semibold text-gray-500">출원인/저자</th>
                      <th className="px-3 py-2 text-left text-xs2 font-semibold text-gray-500">저장일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libFiltered.map(l => (
                      <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <Badge color={l.type === 'patent' ? 'brand' : 'amber'}>{l.type === 'patent' ? '특허' : '논문'}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-sm2 text-blue-700">{l.refNumber}</td>
                        <td className="px-3 py-2 max-w-md truncate">{l.title}</td>
                        <td className="px-3 py-2 text-gray-600">{l.applicant || '-'}</td>
                        <td className="px-3 py-2 text-sm2 text-gray-400">{new Date(l.savedAt).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>

      <NewTaskInProjectModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        projectId={p.id}
        projectName={p.name}
      />
    </div>
  );
}

function TabBtn({ icon, label, count, active, onClick }: { icon: any; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-2.5 text-md2 font-semibold border-b-2 transition-colors',
        active ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800',
      )}
    >
      <Icon name={icon} size={13} /> {label}
      <span className={clsx('ml-1 text-xs2 px-1.5 rounded', active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>{count}</span>
    </button>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-1.5 text-md2 text-left hover:bg-gray-50',
        danger && 'text-red-600 hover:bg-red-50',
      )}
    >
      <Icon name={icon} size={12} /> {label}
    </button>
  );
}

function NewTaskInProjectModal({ open, onClose, projectId, projectName }: { open: boolean; onClose: () => void; projectId: string; projectName: string }) {
  const { projects, taskAdd, setActiveTaskId, setMode, clients, contactByClient } = useStore();
  const [type, setType] = useState<TaskType | null>(null);
  const [name, setName] = useState('');
  const [techField, setTechField] = useState('');
  const [clientId, setClientId] = useState('');
  const [contactId, setContactId] = useState('');

  useEffect(() => {
    if (open) {
      setType(null); setName(''); setTechField(''); setContactId('');
      // 프로젝트 기본 고객사
      const proj = projects.find(p => p.id === projectId);
      setClientId(proj?.clientId || '');
      if (proj?.contactId) setContactId(proj.contactId);
    }
  }, [open, projectId, projects]);

  const contacts = clientId ? contactByClient(clientId) : [];

  const submit = () => {
    if (!type) return;
    const meta = TYPE_CARDS.find(t => t.type === type)!;
    const nt = taskAdd({
      type,
      name: name.trim() || `새 ${meta.title}`,
      folderId: projectId,
      techField: techField.trim() || undefined,
      clientId: clientId || undefined,
      contactId: contactId || undefined,
    });
    toast.success(`작업 추가: ${nt.name} (${projectName})`);
    onClose();
    setActiveTaskId(nt.id);
    setMode(nt.type === 'spec' ? 'spec' : 'search');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`새 작업 — ${projectName}`}
      width="max-w-xl"
      footer={<>
        <Button variant="outlined" color="primary" size="sm" onClick={onClose}>취소</Button>
        <Button variant="filled" color="primary" size="sm" disabled={!type} onClick={submit}>작업 만들기</Button>
      </>}
    >
      <div className="space-y-3.5">
        <div>
          <label className="label">작업 유형 <span className="text-red-600">*</span></label>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {TYPE_CARDS.map(t => (
              <button
                key={t.type}
                onClick={() => setType(t.type)}
                className={clsx(
                  'flex flex-col gap-1 p-3 rounded-lg text-left border-2 transition-all',
                  type === t.type
                    ? 'border-blue-700 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-400',
                )}
              >
                <span className={`w-8 h-8 rounded flex items-center justify-center bg-${t.color}-50 text-${t.color}-700`}>
                  <Icon name={t.icon} size={18} />
                </span>
                <div className="text-md2 font-bold text-gray-800">{t.title}</div>
                <div className="text-xs2 text-gray-500 leading-tight">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {type && (
          <>
            <div>
              <label className="label">작업 이름 (선택)</label>
              <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="비워두면 자동 설정됩니다" />
            </div>
            <div>
              <label className="label">기술분야 (선택)</label>
              <Input className="mt-1" value={techField} onChange={e => setTechField(e.target.value)} maxLength={60} placeholder="예: 자율주행 LIDAR" />
            </div>
            <div>
              <label className="label">고객사 (선택)</label>
              <select className="input mt-1" value={clientId} onChange={e => { setClientId(e.target.value); setContactId(''); }}>
                <option value="">— 미지정 —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {clientId && (
              <div>
                <label className="label">담당자 (선택)</label>
                <select className="input mt-1" value={contactId} onChange={e => setContactId(e.target.value)}>
                  <option value="">— 미지정 —</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>)}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
