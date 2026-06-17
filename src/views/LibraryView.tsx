import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { LibrarySaveModal } from '../components/LibrarySaveModal';
import { LibraryDetailModal } from '../components/LibraryDetailModal';
import clsx from 'clsx';
import { EmptyState } from '../components/EmptyState';
import type { LibraryItem } from '../types';

type DrillFilter = null | { kind: 'all' } | { kind: 'collection'; id: string } | { kind: 'tag'; tag: string };

const COLLECTION_COLORS = ['#1e5fa6', '#10b981', '#f59e0b', '#6d28d9', '#dc2626', '#0ea5e9', '#84cc16', '#ec4899'];

export function LibraryView() {
  const { library, collections, collectionAdd, collectionToggleFavorite, collectionRemove } = useStore();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<DrillFilter>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; onConfirm: () => void }>({ open: false, message: '', onConfirm: () => {} });
  const showConfirm = (message: string, onConfirm: () => void) => setConfirmState({ open: true, message, onConfirm });

  const sortedCols = [...collections].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  // 모든 자료 태그 추출
  const allTags = Array.from(new Set(library.flatMap(l => l.tags || []))).sort();

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-6 bg-zinc-50">
      <div className="flex items-center gap-2 mb-6 justify-end">
        <div className="relative">
          <Icon name="search" size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-7 py-1.5 text-sm2 w-60"
            placeholder="제목·출원인·태그 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-outline btn-sm" onClick={() => setNewOpen(true)}>+ 새 폴더</button>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm2 text-gray-500">
        <span className="text-md2">폴더 {collections.length}개</span>
        {drill && (
          <button className="ml-2 btn-ghost text-xs2 px-2 py-1" onClick={() => setDrill(null)}>
            ← 라이브러리 메인
          </button>
        )}
      </div>

      {/* 빈 상태 안내 */}
      {collections.length === 0 && (
        <EmptyState
          icon="library"
          title="라이브러리가 비어 있습니다"
          description={"특허·논문 검색에서 저장한 자료가 여기에 표시됩니다.\n폴더를 만들어 자료를 분류해 보세요."}
        />
      )}

      {/* 폴더 그리드 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {/* 전체 자료 카드 */}
        <div
          onClick={() => setDrill({ kind: 'all' })}
          className={clsx(
            'card p-4 flex items-start gap-3 cursor-pointer hover:border-blue-500 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all min-h-[84px]',
            drill?.kind === 'all' && 'ring-2 ring-blue-500',
          )}
        >
          <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
            <Icon name="library" size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base2 text-zinc-800">전체 자료</div>
            <div className="text-sm2 text-zinc-500">{library.length}건</div>
          </div>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="card border-dashed border-zinc-300 p-4 flex items-center gap-3 hover:border-blue-500 hover:bg-blue-50 hover:text-brand-400 active:scale-[0.98] min-h-[84px] text-zinc-500 transition-all"
        >
          <span className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center"><Icon name="plus" size={18} /></span>
          <div>
            <div className="font-semibold text-base2">새 폴더</div>
            <div className="text-sm2">자료를 분류해 보세요</div>
          </div>
        </button>
        {sortedCols.map(c => {
          const cnt = library.filter(l => l.collectionId === c.id).length;
          const isActive = drill?.kind === 'collection' && drill.id === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setDrill({ kind: 'collection', id: c.id })}
              className={clsx(
                'card p-4 flex items-start gap-3 cursor-pointer relative hover:border-blue-500 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all min-h-[84px]',
                c.favorite && 'border-amber-300',
                isActive && 'ring-2 ring-blue-500',
              )}
            >
              <button
                onClick={e => { e.stopPropagation(); collectionToggleFavorite(c.id); }}
                className={clsx(
                  'absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100',
                  c.favorite ? 'text-amber-500' : 'text-gray-300',
                )}
                title="즐겨찾기"
              >
                <Icon name={c.favorite ? 'star-filled' : 'star'} size={13} />
              </button>
              <span
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${c.color}22`, color: c.color }}
              ><Icon name="folder" size={18} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base2 text-zinc-800 truncate">{c.name}</div>
                <div className="text-sm2 text-zinc-500">{cnt}건</div>
                {c._system !== 'uncat' && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      showConfirm(`"${c.name}" 폴더를 삭제할까요?\n자료는 미분류로 이동됩니다.`, () => { collectionRemove(c.id); toast.show(`폴더 삭제: ${c.name}`); });
                    }}
                    className="opacity-0 hover:opacity-100 absolute bottom-1 right-1.5 text-xs2 text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded"
                  >삭제</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 태그 행 */}
      {allTags.length > 0 && (
        <section className="mt-6">
          <div className="text-sm2 font-semibold text-zinc-500 mb-2">태그 {allTags.length}개</div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(t => {
              const cnt = library.filter(l => (l.tags || []).includes(t)).length;
              const isActive = drill?.kind === 'tag' && drill.tag === t;
              return (
                <button
                  key={t}
                  onClick={() => setDrill({ kind: 'tag', tag: t })}
                  className={clsx(
                    'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm2 border transition-all active:scale-[0.98]',
                    isActive
                      ? 'bg-brand-400 text-white border-blue-600'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-blue-50 hover:border-blue-300 hover:text-brand-400',
                  )}
                >
                  #{t} <span className={clsx('text-xs2', isActive ? 'text-white/80' : 'text-gray-400')}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 드릴다운: 자료 카드 (drill 선택 또는 검색어 입력 시 표시) */}
      {(drill || search) && (
        <DrillDownItems
          filter={drill ?? { kind: 'all' }}
          search={search}
          sort={sort}
          onSortChange={setSort}
          onOpenDetail={setDetailId}
        />
      )}

      <NewCollectionModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={(name, color) => { collectionAdd(name, color); setNewOpen(false); }} />
      <LibraryDetailModal id={detailId} onClose={() => setDetailId(null)} />
      <ConfirmModal
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={() => { confirmState.onConfirm(); setConfirmState(s => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </div>
  );
}

function DrillDownItems({ filter, search, sort, onSortChange, onOpenDetail }: {
  filter: Exclude<DrillFilter, null>; search: string; sort: 'recent' | 'title';
  onSortChange: (s: 'recent' | 'title') => void; onOpenDetail: (id: string) => void;
}) {
  const { library, collections, libraryToggleFavorite } = useStore();

  let items: LibraryItem[] = library;
  let label = '자료';
  if (filter.kind === 'all') {
    label = '전체 자료';
  } else if (filter.kind === 'collection') {
    const c = collections.find(x => x.id === filter.id);
    label = `폴더 · ${c?.name || ''}`;
    items = items.filter(l => l.collectionId === filter.id);
  } else if (filter.kind === 'tag') {
    label = `태그 · #${filter.tag}`;
    items = items.filter(l => (l.tags || []).includes(filter.tag));
  }
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(l =>
      [l.title, l.applicant, l.refNumber, (l.tags||[]).join(' '), l.note]
        .filter(Boolean).join(' ').toLowerCase().includes(s),
    );
  }
  if (sort === 'title') items = [...items].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  else items = [...items].sort((a, b) => b.savedAt - a.savedAt);

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base2 font-semibold text-zinc-700">{label}</span>
        <span className="text-sm2 text-zinc-400">{items.length}건</span>
        <select className="input ml-auto py-1 px-2 text-sm2 w-auto" value={sort} onChange={e => onSortChange(e.target.value as any)}>
          <option value="recent">최근 저장순</option>
          <option value="title">제목순</option>
        </select>
      </div>
      {items.length === 0 ? (
        <EmptyState compact title="자료가 없습니다." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {items.map(it => {
            const col = it.collectionId ? collections.find(c => c.id === it.collectionId) : null;
            return (
              <div
                key={it.id}
                onClick={() => onOpenDetail(it.id)}
                className="card p-3 relative cursor-pointer hover:border-blue-500 hover:shadow-card-hover active:scale-[0.98] transition-all"
              >
                <button
                  onClick={e => { e.stopPropagation(); libraryToggleFavorite(it.id); }}
                  className={clsx('absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100',
                    it.favorite ? 'text-amber-500' : 'text-gray-300')}
                  title="즐겨찾기"
                >
                  <Icon name={it.favorite ? 'star-filled' : 'star'} size={13} />
                </button>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`badge ${it.type === 'patent' ? 'badge-blue' : 'badge-amber'}`}>
                    {it.type === 'patent' ? '특허' : '논문'}
                  </span>
                  <span className="text-xs2 text-gray-500 font-mono">{it.refNumber}</span>
                </div>
                <div className="text-md2 font-semibold text-gray-800 mb-1 line-clamp-2 leading-snug pr-6">{it.title}</div>
                {it.applicant && (
                  <div className="text-xs2 text-gray-500">
                    {it.applicant}{it.applicationDate ? ` · ${it.applicationDate}` : ''}
                  </div>
                )}
                {col && (
                  <div className="flex items-center gap-1 text-xs2 mt-2" style={{ color: col.color }}>
                    <Icon name="folder" size={10} />
                    <span className="text-gray-500">{col.name}</span>
                  </div>
                )}
                {it.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {it.tags.slice(0, 4).map(t => <span key={t} className="text-xs2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">#{t}</span>)}
                    {it.tags.length > 4 && <span className="text-xs2 text-gray-400">+{it.tags.length - 4}</span>}
                  </div>
                )}
                {it.note && (
                  <div className="text-xs2 text-gray-500 mt-2 line-clamp-2 italic">📝 {it.note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NewCollectionModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (n: string, c: string) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLLECTION_COLORS[0]);
  const toast = useToast();

  useEffect(() => { if (open) { setName(''); setColor(COLLECTION_COLORS[0]); } }, [open]);

  return (
    <Modal
      open={open} onClose={onClose} title="새 폴더"
      footer={<>
        <button className="btn-outline btn-sm" onClick={onClose}>취소</button>
        <button className="btn-primary btn-sm" disabled={!name.trim()} onClick={() => { onCreate(name.trim(), color); toast.show(`폴더 추가: ${name.trim()}`); }}>만들기</button>
      </>}
    >
      <div className="space-y-3">
        <div>
          <label className="label">폴더 이름 <span className="text-red-600">*</span></label>
          <input className="input mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="예: 자율주행 선행기술" maxLength={40} autoFocus />
        </div>
        <div>
          <label className="label">색상</label>
          <div className="flex gap-1.5 mt-1">
            {COLLECTION_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={clsx('w-7 h-7 rounded-full transition-transform',
                  color === c && 'ring-2 ring-offset-2 ring-gray-800 scale-110')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export { LibrarySaveModal };
