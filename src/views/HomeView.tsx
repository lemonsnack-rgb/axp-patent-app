import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { toast, Button } from '@muhayu/axp-ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Input } from '../components/ui';
import clsx from 'clsx';
import type { Project } from '../types';

export const PROJECT_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#84cc16'];

export function HomeView() {
  const { projects, tasks, projectToggleFavorite, setActiveProjectId, setMode } = useStore();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'name' | 'count'>('recent');
  const [newOpen, setNewOpen] = useState(false);

  const counts: Record<string, number> = {};
  for (const t of tasks) if (t.folderId) counts[t.folderId] = (counts[t.folderId] || 0) + 1;

  const list = projects
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // 즐겨찾기 상위 + 선택 정렬
      const favDiff = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
      if (favDiff !== 0) return favDiff;
      if (sort === 'name')  return a.name.localeCompare(b.name, 'ko');
      if (sort === 'count') return (counts[b.id] || 0) - (counts[a.id] || 0);
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-6 bg-zinc-50">
      <div className="flex items-center gap-2 mb-6 ml-auto justify-end">
        <div className="relative">
          <Icon name="search" size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-7 py-1.5 text-sm2 w-44"
            placeholder="프로젝트 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input py-1.5 px-2 text-sm2 w-auto" value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="recent">최근 사용순</option>
          <option value="name">이름순</option>
          <option value="count">작업 많은 순</option>
        </select>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <button
          onClick={() => setNewOpen(true)}
          className="bg-white rounded-xl border-2 border-dashed border-neutral-200 p-4 flex flex-col items-center justify-center gap-2 min-h-[120px] hover:border-brand-300 hover:bg-brand-50 hover:text-brand-400 active:scale-[0.98] transition-all duration-200 text-neutral-400"
        >
          <Icon name="plus" size={32} />
          <div className="font-semibold text-base2">새 프로젝트</div>
          <div className="text-sm2">고객사 / 담당자 정보 포함</div>
        </button>
        {list.map(p => (
          <ProjectCard
            key={p.id}
            p={p}
            count={counts[p.id] || 0}
            onOpen={() => { setActiveProjectId(p.id); setMode('project'); }}
            onToggleFav={() => projectToggleFavorite(p.id)}
          />
        ))}
      </div>

      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function ProjectCard({ p, count, onOpen, onToggleFav }: {
  p: Project; count: number; onOpen: () => void; onToggleFav: () => void;
}) {
  const { clients } = useStore();
  const client = p.clientId ? clients.find(c => c.id === p.clientId) : null;
  return (
    <button
      onClick={onOpen}
      className={clsx(
        'bg-white rounded-xl border shadow-card p-4 text-left transition-all duration-200 min-h-[120px] flex flex-col gap-2 relative active:scale-[0.98]',
        p.favorite ? 'border-amber-300' : 'border-neutral-150',
        'hover:border-brand-200 hover:-translate-y-px hover:shadow-card-hover',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon name="folder" size={20} style={{ color: p.color || '#3B8EF5' }} />
        <span
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          className={clsx(p.favorite ? 'text-amber-500' : 'text-neutral-300 hover:text-neutral-500', 'transition-colors')}
          aria-label={p.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          <Icon name={p.favorite ? 'star-filled' : 'star'} size={13} />
        </span>
      </div>
      <div className="font-semibold text-base2 text-neutral-700 line-clamp-2">{p.name}</div>
      {p.description && <div className="text-sm2 text-neutral-400 line-clamp-2">{p.description}</div>}
      <div className="mt-auto flex items-center justify-between text-xs2">
        <span className={clsx('font-semibold', count > 0 ? 'text-brand-400' : 'text-neutral-300')}>
          {count > 0 ? `${count}건` : '작업 없음'}
        </span>
        {client && <span className="text-neutral-400 truncate">{client.name}</span>}
      </div>
      {/* 진행률 바 (count > 0일 때) */}
      {count > 0 && (
        <div className="h-1 w-full bg-neutral-100 rounded-full mt-1">
          <div className="h-1 bg-brand-400 rounded-full" style={{ width: `${Math.min((count / 5) * 100, 100)}%` }} />
        </div>
      )}
    </button>
  );
}

function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projects, projectAdd, clients, clientAdd, contactByClient, contactAdd, setActiveProjectId, setMode } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [contactId, setContactId] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setClientId('');
      setContactId('');
      setColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
      setFavorite(false);
    }
  }, [open, projects.length]);

  const contacts = clientId ? contactByClient(clientId) : [];

  const quickAddClient = () => {
    const n = prompt('새 고객사 이름:');
    if (!n?.trim()) return;
    const industry = prompt('업종 (선택):') || '';
    const c = clientAdd({ name: n.trim(), industry: industry || undefined });
    setClientId(c.id);
    toast(`고객사 추가: ${c.name}`);
  };
  const quickAddContact = () => {
    if (!clientId) { toast('먼저 고객사를 선택하세요'); return; }
    const n = prompt('담당자 이름:');
    if (!n?.trim()) return;
    const role = prompt('직책/역할 (선택):') || '';
    const email = prompt('이메일 (선택):') || '';
    const c = contactAdd({ clientId, name: n.trim(), role: role || undefined, email: email || undefined });
    setContactId(c.id);
    toast(`담당자 추가: ${c.name}`);
  };

  const submit = () => {
    if (!name.trim()) return;
    const p = projectAdd({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      clientId: clientId || null,
      contactId: contactId || null,
      favorite,
    });
    toast.success(`프로젝트 만들기: ${p.name}`);
    onClose();
    setActiveProjectId(p.id);
    setMode('project');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 프로젝트"
      footer={<>
        <Button variant="outlined" color="primary" size="sm" onClick={onClose}>취소</Button>
        <Button variant="filled" color="primary" size="sm" disabled={!name.trim()} onClick={submit}>프로젝트 만들기</Button>
      </>}
    >
      <div className="space-y-3.5">
        {/* 이름 */}
        <div>
          <label className="label">프로젝트 이름 <span className="text-red-600">*</span></label>
          <Input
            className="mt-1"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 자율주행 LIDAR 분석"
            maxLength={60}
            autoFocus
          />
          <div className="text-xs2 text-zinc-400 mt-1">{name.length} / 60자</div>
        </div>

        {/* 설명 */}
        <div>
          <label className="label">설명 (선택)</label>
          <textarea
            className="input mt-1 min-h-[60px]"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="프로젝트의 목적이나 범위를 적어두면 나중에 찾기 쉬워요"
            maxLength={200}
            rows={2}
          />
        </div>

        {/* 고객사 */}
        <div>
          <label className="label flex items-center gap-1.5">
            고객사 (선택)
            <button
              onClick={() => { onClose(); setMode('clients'); }}
              className="text-xs2 text-blue-600 font-medium hover:underline"
            >고객사 관리 →</button>
          </label>
          <div className="flex gap-1.5 mt-1">
            <select
              className="input flex-1"
              value={clientId}
              onChange={e => { setClientId(e.target.value); setContactId(''); }}
            >
              <option value="">— 미지정 —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.industry ? ` · ${c.industry}` : ''}</option>)}
            </select>
            <Button variant="outlined" color="primary" size="sm" className="whitespace-nowrap" onClick={quickAddClient}>+ 새로 추가</Button>
          </div>
        </div>

        {/* 담당자 — 고객사 선택 시 노출 */}
        {clientId && (
          <div>
            <label className="label">담당자 (선택)</label>
            <div className="flex gap-1.5 mt-1">
              <select className="input flex-1" value={contactId} onChange={e => setContactId(e.target.value)}>
                <option value="">— 미지정 —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>)}
              </select>
              <Button variant="outlined" color="primary" size="sm" className="whitespace-nowrap" onClick={quickAddContact}>+ 새로 추가</Button>
            </div>
          </div>
        )}

        {/* 색상 */}
        <div>
          <label className="label">색상</label>
          <div className="flex gap-1.5 mt-1">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={clsx(
                  'w-7 h-7 rounded-full transition-transform',
                  color === c && 'ring-2 ring-offset-2 ring-gray-800 scale-110',
                )}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* 즐겨찾기 */}
        <label className="flex items-center gap-2 text-md2 text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="form-checkbox text-blue-700"
            checked={favorite}
            onChange={e => setFavorite(e.target.checked)}
          />
          <span>이 프로젝트를 즐겨찾기에 추가</span>
        </label>
      </div>
    </Modal>
  );
}
