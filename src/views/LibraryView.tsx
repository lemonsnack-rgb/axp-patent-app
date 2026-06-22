import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { toast, openAlertDialog, Button } from '@muhayu/axp-ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { LibrarySaveModal } from '../components/LibrarySaveModal';
import { LibraryDetailModal } from '../components/LibraryDetailModal';
import clsx from 'clsx';
import { EmptyState } from '../components/EmptyState';
import { Badge, Card, Input } from '../components/ui';
import type { LibraryItem, LibraryCollection } from '../types';

type DrillFilter = { id: string };

export function LibraryView() {
  const { library, collections, collectionAdd, collectionToggleFavorite, collectionRemove, ensureUncategorized } = useStore();
  const [drill, setDrill] = useState<DrillFilter | null>(null);
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => { ensureUncategorized(); }, []);

  const uncatCol = collections.find(c => c._system === 'uncat');
  const userCols = [...collections]
    .filter(c => !c._system)
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  const renderFolder = (c: LibraryCollection) => {
    const cnt = library.filter(l => l.collectionId === c.id).length;
    const isActive = drill?.id === c.id;
    const isUncat = c._system === 'uncat';
    return (
      <Card
        key={c.id}
        onClick={() => setDrill({ id: c.id })}
        hoverable
        selected={isActive}
        className={clsx(
          '!p-4 flex items-start gap-3 relative min-h-[84px]',
          !isUncat && c.favorite && 'border-amber-300',
        )}
      >
        {!isUncat && (
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
        )}
        <span className={clsx(
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
          isUncat ? 'bg-zinc-100 text-zinc-400' : 'bg-zinc-100 text-zinc-500',
        )}>
          <Icon name="folder" size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base2 text-zinc-800 truncate">{c.name}</div>
          <div className="text-sm2 text-zinc-500">{cnt}개</div>
          {!isUncat && (
            <button
              onClick={e => {
                e.stopPropagation();
                openAlertDialog(
                  { title: '확인', description: `"${c.name}" 폴더를 삭제합니다.\n저장된 항목은 분류로 이동됩니다.`, confirm: '삭제', cancel: '취소' },
                  { theme: 'danger', onConfirm: (ctrl) => { collectionRemove(c.id); toast(`폴더 삭제: ${c.name}`); ctrl.close(); } }
                );
              }}
              className="opacity-0 group-hover:opacity-100 absolute bottom-1 right-1.5 text-xs2 text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded"
            >삭제</button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-6 bg-zinc-50">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-md2 text-zinc-500">폴더 {userCols.length}개</span>
        {drill && (
          <Button variant="text" size="sm" className="ml-2 text-xs2 px-2 py-1" onClick={() => setDrill(null)}>
            ← 전체 폴더
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        <button
          onClick={() => setNewOpen(true)}
          className="bg-white rounded-xl border-2 border-dashed border-zinc-300 p-4 flex items-center gap-3 hover:border-blue-500 hover:bg-blue-50 hover:text-brand-400 active:scale-[0.98] min-h-[84px] text-zinc-500 transition-all"
        >
          <span className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
            <Icon name="plus" size={18} />
          </span>
          <div>
            <div className="font-semibold text-base2">새 폴더</div>
            <div className="text-sm2">폴더를 추가해 보세요</div>
          </div>
        </button>
        {userCols.map(c => renderFolder(c))}
        {uncatCol && renderFolder(uncatCol)}
      </div>

      {drill && (
        <DrillDownItems
          filterId={drill.id}
          sort={sort}
          onSortChange={setSort}
          onOpenDetail={setDetailId}
        />
      )}

      <NewCollectionModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={name => { collectionAdd(name); setNewOpen(false); }} />
      <LibraryDetailModal id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function DrillDownItems({ filterId, sort, onSortChange, onOpenDetail }: {
  filterId: string; sort: 'recent' | 'title';
  onSortChange: (s: 'recent' | 'title') => void; onOpenDetail: (id: string) => void;
}) {
  const { library, collections, libraryToggleFavorite } = useStore();

  const col = collections.find(c => c.id === filterId);
  let items: LibraryItem[] = library.filter(l => l.collectionId === filterId);

  if (sort === 'title') items = [...items].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  else items = [...items].sort((a, b) => b.savedAt - a.savedAt);

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base2 font-semibold text-zinc-700">{col?.name || '폴더'}</span>
        <span className="text-sm2 text-zinc-400">{items.length}개</span>
        <select className="input ml-auto py-1 px-2 text-sm2 w-auto" value={sort} onChange={e => onSortChange(e.target.value as 'recent' | 'title')}>
          <option value="recent">최근 저장</option>
          <option value="title">제목순</option>
        </select>
      </div>
      {items.length === 0 ? (
        <EmptyState compact title="저장이 없습니다." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {items.map(it => (
            <Card
              key={it.id}
              onClick={() => onOpenDetail(it.id)}
              hoverable
              className="!p-3 relative"
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
                <Badge color={it.type === 'patent' ? 'brand' : 'amber'}>
                  {it.type === 'patent' ? '특허' : '논문'}
                </Badge>
                <span className="text-xs2 text-gray-500 font-mono">{it.refNumber}</span>
              </div>
              <div className="text-md2 font-semibold text-gray-800 mb-1 line-clamp-2 leading-snug pr-6">{it.title}</div>
              {it.applicant && (
                <div className="text-xs2 text-gray-500">
                  {it.applicant}{it.applicationDate ? ` · ${it.applicationDate}` : ''}
                </div>
              )}
              {it.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {it.tags.slice(0, 4).map(t => <span key={t} className="text-xs2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">#{t}</span>)}
                  {it.tags.length > 4 && <span className="text-xs2 text-gray-400">+{it.tags.length - 4}</span>}
                </div>
              )}
              {it.note && (
                <div className="text-xs2 text-gray-500 mt-2 line-clamp-2 italic">메모: {it.note}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function NewCollectionModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (n: string) => void }) {
  const [name, setName] = useState('');

  useEffect(() => { if (open) setName(''); }, [open]);

  return (
    <Modal
      open={open} onClose={onClose} title="새 폴더"
      footer={<>
        <Button variant="outlined" color="primary" size="sm" onClick={onClose}>취소</Button>
        <Button variant="filled" color="primary" size="sm" disabled={!name.trim()} onClick={() => { if (name.trim()) { onCreate(name.trim()); toast(`폴더 추가: ${name.trim()}`); } }}>추가</Button>
      </>}
    >
      <div>
        <label className="label">폴더 이름 <span className="text-red-600">*</span></label>
        <Input
          className="mt-1"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="예: 논문 자료, 프로젝트 참고"
          maxLength={40}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onCreate(name.trim()); toast(`폴더 추가: ${name.trim()}`); } }}
        />
      </div>
    </Modal>
  );
}

export { LibrarySaveModal };
