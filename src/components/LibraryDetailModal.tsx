import { useState } from 'react';
import { useStore } from '../store';
import { toast, Button } from '@muhayu/axp-ui';
import { Modal } from './Modal';
import { Badge, Input } from './ui';
import type { LibraryItem } from '../types';

export function LibraryDetailModal({ id, onClose, onReview }: { id: string | null; onClose: () => void; onReview?: (item: LibraryItem) => void }) {
  const { library, collections, libraryUpdate, libraryRemove, libraryToggleFavorite } = useStore();
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [editingTags, setEditingTags] = useState(false);
  const [tagsText, setTagsText] = useState('');

  if (!id) return null;
  const it = library.find(l => l.id === id);
  if (!it) return null;
  const col = it.collectionId ? collections.find(c => c.id === it.collectionId) : null;

  const saveNote = () => {
    libraryUpdate(it.id, { note: noteText.trim() || undefined });
    setEditingNote(false);
    toast('메모 저장됨');
  };
  const saveTags = () => {
    const tags = tagsText.split(',').map(s => s.trim()).filter(Boolean);
    libraryUpdate(it.id, { tags });
    setEditingTags(false);
    toast('태그 저장됨');
  };
  const setCollection = (cid: string) => {
    libraryUpdate(it.id, { collectionId: cid || null });
    toast('폴더 이동됨');
  };

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      title="자료 상세"
      width="max-w-2xl"
      footer={<>
        <Button
          variant="outlined"
          color="primary"
          size="sm"
          className="mr-auto text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => { if (confirm('이 자료를 삭제할까요?')) { libraryRemove(it.id); toast('자료 삭제됨'); onClose(); } }}
        >삭제</Button>
        {onReview && it.data && (
          <Button variant="outlined" color="primary" size="sm" onClick={() => { onReview(it); onClose(); }}>
            📄 전체 상세페이지 보기 ↗
          </Button>
        )}
        <Button variant="filled" color="primary" size="sm" onClick={onClose}>닫기</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge color={it.type === 'patent' ? 'brand' : 'amber'}>{it.type === 'patent' ? '특허' : '논문'}</Badge>
          <span className="font-mono text-md2 text-gray-700">{it.refNumber}</span>
          <button
            onClick={() => libraryToggleFavorite(it.id)}
            className={'ml-auto px-2 py-1 rounded text-md2 ' + (it.favorite ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500')}
          >
            {it.favorite ? '★ 즐겨찾기' : '☆ 즐겨찾기'}
          </button>
        </div>

        <h3 className="text-lg2 font-bold text-gray-800 leading-snug">{it.title}</h3>

        {(it.applicant || it.applicationDate) && (
          <div className="text-md2 text-gray-600">
            {it.applicant && <span>{it.applicant}</span>}
            {it.applicationDate && <span> · {it.applicationDate}</span>}
          </div>
        )}

        {it.abstract && (
          <div>
            <div className="text-sm2 font-semibold text-gray-500 mb-1">요약</div>
            <div className="bg-gray-50 p-3 rounded text-md2 text-gray-700 leading-relaxed">{it.abstract}</div>
          </div>
        )}

        <div className="border-t border-gray-100 pt-3 space-y-3">
          {/* 폴더 변경 */}
          <div className="flex items-center gap-2">
            <span className="text-sm2 font-semibold text-gray-500 w-16">폴더</span>
            <select
              className="input py-1 text-md2 flex-1"
              value={it.collectionId || ''}
              onChange={e => setCollection(e.target.value)}
            >
              <option value="">— 미분류 —</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {col && <Badge color="neutral" className="text-xs2" style={{ background: `${col.color}22`, color: col.color }}>{col.name}</Badge>}
          </div>

          {/* 태그 */}
          <div className="flex items-start gap-2">
            <span className="text-sm2 font-semibold text-gray-500 w-16 mt-1">태그</span>
            <div className="flex-1">
              {!editingTags ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {it.tags.length === 0
                    ? <span className="text-md2 text-gray-400">태그 없음</span>
                    : it.tags.map(t => <Badge key={t} color="neutral">#{t}</Badge>)}
                  <Button
                    variant="text"
                    className="text-xs2 px-2 py-0.5"
                    onClick={() => { setTagsText(it.tags.join(', ')); setEditingTags(true); }}
                  >편집</Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Input className="py-1 text-md2 flex-1" value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="쉼표로 구분" autoFocus />
                  <Button variant="filled" color="primary" size="sm" onClick={saveTags}>저장</Button>
                  <Button variant="outlined" color="primary" size="sm" onClick={() => setEditingTags(false)}>취소</Button>
                </div>
              )}
            </div>
          </div>

          {/* 메모 */}
          <div className="flex items-start gap-2">
            <span className="text-sm2 font-semibold text-gray-500 w-16 mt-1">메모</span>
            <div className="flex-1">
              {!editingNote ? (
                <div className="flex items-start gap-2">
                  <div className="flex-1 text-md2 text-gray-700 italic min-h-[24px]">{it.note || '메모 없음'}</div>
                  <Button
                    variant="text"
                    className="text-xs2 px-2 py-0.5"
                    onClick={() => { setNoteText(it.note || ''); setEditingNote(true); }}
                  >편집</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <textarea className="input py-1.5 text-md2 min-h-[80px]" value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="outlined" color="primary" size="sm" onClick={() => setEditingNote(false)}>취소</Button>
                    <Button variant="filled" color="primary" size="sm" onClick={saveNote}>저장</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs2 text-gray-400">저장: {new Date(it.savedAt).toLocaleString('ko-KR')}</div>
      </div>
    </Modal>
  );
}
