import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { Modal } from './Modal';
import type { LibraryItem } from '../types';

interface SaveContext {
  type: 'patent' | 'paper';
  refNumber: string;
  title: string;
  applicant?: string;
  applicationDate?: string;
  abstract?: string;
  data?: any;
}

interface Props {
  open: boolean;
  context: SaveContext | null;
  onClose: () => void;
}

export function LibrarySaveModal({ open, context, onClose }: Props) {
  const { collections, collectionAdd, ensureUncategorized, libraryAdd } = useStore();
  const toast = useToast();
  const [collectionId, setCollectionId] = useState('');
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (open) {
      setCollectionId('');
      setTags('');
      setNote('');
      setFavorite(false);
    }
  }, [open, context?.refNumber]);

  if (!context) return null;

  const quickAddFolder = () => {
    const name = prompt('새 폴더 이름:');
    if (!name?.trim()) return;
    const c = collectionAdd(name.trim());
    setCollectionId(c.id);
    toast.show(`폴더 추가: ${c.name}`);
  };

  const submit = () => {
    let folderId = collectionId;
    if (!folderId) folderId = ensureUncategorized();
    const tagList = tags.split(',').map(s => s.trim()).filter(Boolean);
    const li: Omit<LibraryItem, 'id' | 'savedAt'> = {
      type: context.type,
      refNumber: context.refNumber,
      title: context.title,
      applicant: context.applicant,
      applicationDate: context.applicationDate,
      abstract: context.abstract,
      collectionId: folderId,
      tags: tagList,
      note: note.trim() || undefined,
      favorite,
      data: context.data,
    };
    libraryAdd(li);
    const colName = collections.find(c => c.id === folderId)?.name || '미분류';
    toast.show(`📚 라이브러리 저장: ${context.refNumber} (${colName})`, 'success');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="라이브러리에 저장"
      footer={<>
        <button className="btn-outline btn-sm" onClick={onClose}>취소</button>
        <button className="btn-primary btn-sm" onClick={submit}>저장</button>
      </>}
    >
      <div className="space-y-3.5">
        <div>
          <div className="text-sm2 text-gray-500 mb-1">자료</div>
          <div className="bg-gray-50 px-3 py-2 rounded text-md2 text-gray-700">
            <div className="font-mono text-sm2 text-blue-700">{context.refNumber}</div>
            <div className="text-md2 font-medium text-gray-800 line-clamp-2">{context.title}</div>
          </div>
        </div>
        <div>
          <label className="label">폴더 <span className="text-red-600">*</span></label>
          <div className="flex gap-1.5 mt-1">
            <select className="input flex-1" value={collectionId} onChange={e => setCollectionId(e.target.value)}>
              <option value="">— 미분류 —</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="btn-outline btn-sm whitespace-nowrap" onClick={quickAddFolder}>+ 새 폴더</button>
          </div>
        </div>
        <div>
          <label className="label">태그 (선택, 쉼표로 구분)</label>
          <input className="input mt-1" value={tags} onChange={e => setTags(e.target.value)} placeholder="예: LiDAR, 자율주행, 딥러닝" />
        </div>
        <div>
          <label className="label">메모 (선택)</label>
          <textarea
            className="input mt-1 min-h-[80px]"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="이 자료를 어떻게 활용할 예정인지 메모하세요"
            maxLength={500}
          />
        </div>
        <label className="flex items-center gap-2 text-md2 text-gray-700 cursor-pointer">
          <input type="checkbox" className="form-checkbox text-blue-700" checked={favorite} onChange={e => setFavorite(e.target.checked)} />
          <span>즐겨찾기에 추가</span>
        </label>
      </div>
    </Modal>
  );
}
