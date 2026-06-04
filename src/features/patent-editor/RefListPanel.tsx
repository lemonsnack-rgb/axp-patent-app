// RefListPanel — ComponentsPanel과 동일한 UX 패턴
// 항목명 입력 → 부호 자동 부여 → ↑↓→← 위계 조작
import { useMemo, useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { EditorReference, InventionComponent } from './types';
import clsx from 'clsx';

interface Props {
  references: EditorReference[];
  onAdd: (ref: EditorReference) => void;
  onUpdate?: (ref: EditorReference) => void;
  /** 전체 목록을 한번에 교체 — autoAssign처럼 번호가 바뀔 때 사용 */
  onBulkUpdate?: (refs: EditorReference[]) => void;
  onDelete: (refNumber: string) => void;
  inventionComponents?: InventionComponent[];
  placedNums?: Set<string>;
  onPlaceRef?: (ref: EditorReference) => void;
  drawingDescription?: string;
  onDrawingDescriptionChange?: (value: string) => void;
}

// ── 트리 구성 ─────────────────────────────────────────────
interface FlatItem { ref: EditorReference; depth: number; }

function buildFlat(refs: EditorReference[]): FlatItem[] {
  const byNum = new Map(refs.map(r => [r.number, r]));
  const byParent = new Map<string | undefined, EditorReference[]>();
  for (const r of refs) {
    const parent = r.parentNumber && byNum.has(r.parentNumber) ? r.parentNumber : undefined;
    const list = byParent.get(parent) ?? [];
    list.push(r);
    byParent.set(parent, list);
  }
  const sortFn = (a: EditorReference, b: EditorReference) =>
    a.number.localeCompare(b.number, undefined, { numeric: true });
  const result: FlatItem[] = [];
  function visit(parent: string | undefined, depth: number) {
    (byParent.get(parent) ?? []).sort(sortFn).forEach(ref => {
      result.push({ ref, depth });
      visit(ref.number, depth + 1);
    });
  }
  visit(undefined, 0);
  return result;
}

// 자동 번호 부여: 트리 순회 순서 기반
function autoAssignNumbers(refs: EditorReference[]): EditorReference[] {
  const flat = buildFlat(refs);
  const d0Counter = { v: 0 };
  const d1Counters = new Map<string, number>(); // parentNumber -> count
  const d2Counters = new Map<string, number>();

  return flat.map(({ ref, depth }) => {
    let newNum = ref.number;
    if (depth === 0) {
      d0Counter.v += 1;
      newNum = String(d0Counter.v * 100);
    } else if (depth === 1) {
      const parent = ref.parentNumber ?? '';
      const cnt = (d1Counters.get(parent) ?? 0) + 1;
      d1Counters.set(parent, cnt);
      const parentNum = parseInt(parent) || (d0Counter.v * 100);
      newNum = String(parentNum + cnt * 10);
    } else {
      const parent = ref.parentNumber ?? '';
      const cnt = (d2Counters.get(parent) ?? 0) + 1;
      d2Counters.set(parent, cnt);
      const parentNum = parseInt(parent) || 110;
      newNum = String(parentNum + cnt);
    }
    return { ...ref, number: newNum };
  });
}

const DEPTH_INDENT = 16;

export function RefListPanel({
  references, onAdd, onUpdate, onBulkUpdate, onDelete,
  inventionComponents, placedNums, onPlaceRef,
  drawingDescription = '', onDrawingDescriptionChange,
}: Props) {
  const [newName, setNewName] = useState('');
  const [dragNum, setDragNum] = useState<string | null>(null);
  const [dropNum, setDropNum] = useState<string | null>(null);
  // 번호 인라인 편집 상태
  const [editingNumKey, setEditingNumKey] = useState<string | null>(null);
  const [editingNumVal, setEditingNumVal] = useState('');
  const [search, setSearch] = useState('');
  // 번호 없는 항목 배치 시도 시 가이드 표시
  const [noNumGuide, setNoNumGuide] = useState<string | null>(null); // ref key
  const [pulseAutoAssign, setPulseAutoAssign] = useState(false);

  const showNoNumGuide = (key: string) => {
    setNoNumGuide(key);
    setPulseAutoAssign(true);
    setTimeout(() => { setNoNumGuide(null); setPulseAutoAssign(false); }, 3000);
  };

  const flat = useMemo(() => buildFlat(references), [references]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.toLowerCase();
    return flat.filter(({ ref }) =>
      ref.number.toLowerCase().includes(q) || (ref.name ?? '').toLowerCase().includes(q)
    );
  }, [flat, search]);

  const hasNums = references.some(r => r.number && r.number !== '');

  // ── 부호 자동 부여 ─────────────────────────────────────
  const autoAssign = () => {
    const updated = autoAssignNumbers(references);
    if (onBulkUpdate) {
      // 번호가 바뀌므로 전체 교체 방식 사용
      onBulkUpdate(updated);
    } else if (onUpdate) {
      updated.forEach(r => onUpdate(r));
    }
  };

  // ── 새 항목 추가 ──────────────────────────────────────
  const addItem = () => {
    if (!newName.trim()) return;
    onAdd({ number: '', name: newName.trim() });
    setNewName('');
  };

  // ── 구성요소 일괄 가져오기 ─────────────────────────────
  const importFromComponents = () => {
    if (!inventionComponents?.length) return;
    inventionComponents.forEach(c => {
      if (!references.some(r => r.name === c.name)) {
        onAdd({ number: c.number || '', name: c.name });
      }
    });
  };

  // ── 계층 조작 ─────────────────────────────────────────
  const indent = (ref: EditorReference) => {
    const idx = flat.findIndex(f => f.ref.number === ref.number);
    if (idx <= 0) return;
    const prev = flat[idx - 1];
    if (prev.depth > flat[idx].depth) return;
    onUpdate?.({ ...ref, parentNumber: prev.ref.number });
  };

  const outdent = (ref: EditorReference) => {
    if (!ref.parentNumber) return;
    const parent = references.find(r => r.number === ref.parentNumber);
    onUpdate?.({ ...ref, parentNumber: parent?.parentNumber });
  };

  const canIndent = (ref: EditorReference) => {
    const idx = flat.findIndex(f => f.ref.number === ref.number);
    return idx > 0 && flat[idx - 1].depth >= flat[idx].depth;
  };

  // 같은 부모 내 순서 변경: 이름으로 비교 (번호가 없을 수 있으므로)
  const getSiblings = (ref: EditorReference) =>
    flat.filter(f => f.ref.parentNumber === ref.parentNumber).map(f => f.ref);

  const moveUp = (ref: EditorReference) => {
    const siblings = getSiblings(ref);
    const idx = siblings.findIndex(r => r.number === ref.number && r.name === ref.name);
    if (idx <= 0) return;
    const above = siblings[idx - 1];
    const tmp = above.name; const tmpNum = above.number;
    onUpdate?.({ ...above, name: ref.name, number: ref.number });
    onUpdate?.({ ...ref, name: tmp, number: tmpNum });
  };

  const moveDown = (ref: EditorReference) => {
    const siblings = getSiblings(ref);
    const idx = siblings.findIndex(r => r.number === ref.number && r.name === ref.name);
    if (idx >= siblings.length - 1) return;
    const below = siblings[idx + 1];
    const tmp = below.name; const tmpNum = below.number;
    onUpdate?.({ ...below, name: ref.name, number: ref.number });
    onUpdate?.({ ...ref, name: tmp, number: tmpNum });
  };

  const canMoveUp = (ref: EditorReference) => {
    const siblings = getSiblings(ref);
    return siblings.length > 1 && (siblings[0].number !== ref.number || siblings[0].name !== ref.name);
  };

  const canMoveDown = (ref: EditorReference) => {
    const siblings = getSiblings(ref);
    const last = siblings[siblings.length - 1];
    return siblings.length > 1 && (last.number !== ref.number || last.name !== ref.name);
  };

  // ── 드래그: 순서 변경 (같은 부모 내) ─────────────────
  const onDragEnd = () => {
    if (dragNum && dropNum && dragNum !== dropNum) {
      const dragRef = references.find(x => x.number === dragNum);
      const dropRef = references.find(x => x.number === dropNum);
      if (dragRef && dropRef && onUpdate && dragRef.parentNumber === dropRef.parentNumber) {
        onUpdate({ ...dragRef, number: dropRef.number, name: dropRef.name });
        onUpdate({ ...dropRef, number: dragRef.number, name: dragRef.name });
      }
    }
    setDragNum(null); setDropNum(null);
  };

  return (
    <aside className="flex h-full w-full flex-col bg-ck-bg overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-ck-border shrink-0 bg-white">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs2 font-semibold text-gray-600">
            도면 부호 <span className="font-normal text-gray-400">({references.length})</span>
          </span>
          <button onClick={autoAssign}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs2 font-semibold border transition-colors',
              pulseAutoAssign
                ? 'bg-blue-600 border-blue-600 text-white animate-pulse ring-2 ring-blue-400 ring-offset-1'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            )}>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="10" height="10">
              <path d="M2 6h8M8 4l2 2-2 2"/>
            </svg>
            {hasNums ? '부호 재부여' : '부호 자동 부여'}
          </button>
        </div>
        {!hasNums && references.length > 0 && (
          <p className="text-xs2 text-gray-400 leading-tight">
            순서 조정 후 <strong className="text-blue-600">부호 자동 부여</strong>를 클릭하면 100, 200... 번호가 할당됩니다.
          </p>
        )}
        {references.length === 0 && (
          <p className="text-xs2 text-gray-400 leading-tight">
            아래에서 구성요소를 추가하세요.
          </p>
        )}
      </div>

      {/* ── 검색 ── */}
      {references.length > 0 && (
        <div className="px-2 py-1.5 border-b border-ck-border shrink-0">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="번호 또는 이름으로 검색…"
            className="w-full text-sm2 rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {/* ── 항목 목록 ── */}
      <div className="flex-1 overflow-y-auto scroll-thin px-2 pt-2 pb-1 space-y-0.5">
        {filtered.length === 0 && references.length === 0 && (
          <div className="py-4 text-center">
            <p className="text-xs2 text-gray-500 font-semibold mb-1">구성요소가 없습니다</p>
            {inventionComponents && inventionComponents.length > 0 ? (
              <button onClick={importFromComponents}
                className="text-xs2 text-blue-600 hover:underline">
                구성요소 단계 항목 가져오기
              </button>
            ) : (
              <p className="text-xs2 text-gray-400">아래 입력창에서 추가하세요.</p>
            )}
          </div>
        )}

        {filtered.map(({ ref: r, depth }) => {
          const isDragging = dragNum === r.number;
          const isDropTarget = dropNum === r.number && dragNum !== r.number;
          return (
            <div key={`${r.number}-${r.name}`}
              style={{ paddingLeft: depth * DEPTH_INDENT }}
              draggable
              onDragStart={() => setDragNum(r.number)}
              onDragOver={e => { e.preventDefault(); setDropNum(r.number); }}
              onDragEnd={onDragEnd}
              className={clsx(
                isDragging && 'opacity-30',
                isDropTarget && 'ring-2 ring-blue-400 ring-offset-1 rounded'
              )}>
              <div className={clsx(
                'flex items-center gap-1 rounded px-1.5 py-1 transition-all group',
                'bg-white border hover:border-blue-300',
                noNumGuide === `${r.number}-${r.name}` ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
              )}>
                {/* 드래그 핸들 */}
                <span className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0 select-none text-xs leading-none px-0.5">
                  <GripVertical size={10} />
                </span>

                {/* 배치 상태 인디케이터 */}
                {placedNums && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-colors ${placedNums.has(r.number) ? 'bg-blue-500' : 'bg-gray-200'}`}
                    title={placedNums.has(r.number) ? '캔버스에 배치됨' : '미배치'}
                  />
                )}

                {/* 부호 번호 배지 — 클릭 시 인라인 편집 */}
                {editingNumKey === `num-${r.name}` ? (
                  <input
                    type="text"
                    className="w-10 text-xs2 font-bold rounded px-1 py-0.5 shrink-0 text-center border border-blue-400 bg-white outline-none"
                    value={editingNumVal}
                    placeholder="100"
                    autoFocus
                    onChange={e => setEditingNumVal(e.target.value)}
                    onBlur={() => {
                      const num = editingNumVal.trim();
                      if (num) onUpdate?.({ ...r, number: num });
                      setEditingNumKey(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const num = editingNumVal.trim();
                        if (num) onUpdate?.({ ...r, number: num });
                        setEditingNumKey(null);
                      }
                      if (e.key === 'Escape') setEditingNumKey(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    title="클릭하여 번호 편집"
                    onClick={() => { setEditingNumKey(`num-${r.name}`); setEditingNumVal(r.number || ''); }}
                    className={clsx(
                      'w-8 text-xs2 font-bold rounded px-1 py-0.5 shrink-0 text-center transition-colors hover:ring-1 hover:ring-blue-400',
                      r.number ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    )}>
                    {r.number || '—'}
                  </button>
                )}

                {/* 이름 편집 (인라인 텍스트 입력) */}
                <input
                  className="text-xs2 text-gray-700 flex-1 bg-transparent outline-none min-w-0 py-0.5"
                  value={r.name ?? ''}
                  placeholder="구성요소 이름..."
                  onChange={e => onUpdate?.({ ...r, name: e.target.value || undefined })}
                />

                {/* 캔버스 배치 버튼 — 항상 표시 (번호 없으면 안내 유도) */}
                {onPlaceRef && (
                  <button
                    onClick={() => {
                      const key = `${r.number}-${r.name}`;
                      if (!r.number) {
                        // 번호 없음 → 부호 자동 부여 유도
                        showNoNumGuide(key);
                      } else {
                        onPlaceRef(r);
                      }
                    }}
                    title={r.number ? `도면에 배치 (지시선 → ${r.number})` : '번호를 먼저 부여하세요 (위 → 버튼 클릭)'}
                    className={clsx(
                      'shrink-0 rounded px-1.5 py-0.5 text-xs2 font-semibold border transition-colors',
                      r.number
                        ? 'text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-400'
                        : 'text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                    )}>
                    배치
                  </button>
                )}

                {/* 편집 버튼 — hover 시 표시 */}
                <div className="flex items-center gap-px shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* ↑ 위로 */}
                  <button onClick={() => moveUp(r)} disabled={!canMoveUp(r)}
                    className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="위로">
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 7l3-4 3 4"/></svg>
                  </button>
                  {/* ↓ 아래로 */}
                  <button onClick={() => moveDown(r)} disabled={!canMoveDown(r)}
                    className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="아래로">
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 3l3 4 3-4"/></svg>
                  </button>
                  <span className="w-px h-3 bg-gray-200 mx-0.5" />
                  {/* → 하위로 */}
                  <button onClick={() => indent(r)} disabled={!canIndent(r)}
                    className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="하위로 (→)">
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 5h6M6 3l2 2-2 2"/></svg>
                  </button>
                  {/* ← 상위로 */}
                  <button onClick={() => outdent(r)} disabled={!r.parentNumber}
                    className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="상위로 (←)">
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M8 5H2M4 3L2 5l2 2"/></svg>
                  </button>
                  <span className="w-px h-3 bg-gray-200 mx-0.5" />
                  {/* 삭제 */}
                  <button
                    onClick={() => { if (window.confirm(`"${r.name || r.number}" 부호를 삭제하시겠습니까?`)) onDelete(r.number); }}
                    className="rounded p-0.5 text-gray-400 hover:text-red-500" title="삭제">
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 2l6 6M8 2l-6 6"/></svg>
                  </button>
                </div>
              </div>
            {/* 번호 없는 항목 배치 시도 시 안내 메시지 */}
            {noNumGuide === `${r.number}-${r.name}` && (
              <div className="mx-1 mb-1 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs2 text-amber-700 flex items-center gap-1.5">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" width="11" height="11">
                  <circle cx="6" cy="6" r="5"/><line x1="6" y1="4" x2="6" y2="6.5"/><circle cx="6" cy="8.5" r="0.5" fill="currentColor"/>
                </svg>
                <span>부호 번호가 없습니다. 먼저 <strong>부호 자동 부여 →</strong>를 클릭하세요.</span>
              </div>
            )}
            </div>
          );
        })}

        {/* 하단 드롭 존 */}
        <div
          onDragOver={e => { e.preventDefault(); setDropNum('__end__'); }}
          className={clsx('h-3 rounded transition-all',
            dropNum === '__end__' && dragNum ? 'ring-2 ring-blue-400 ring-offset-1 bg-blue-50' : ''
          )}
        />
      </div>

      {/* ── 새 항목 추가 (ComponentsPanel과 동일) ── */}
      <div className="px-2 py-2 border-t border-ck-border bg-ck-bg shrink-0 space-y-1">
        <div className="flex gap-1">
          <input
            className="flex-1 text-xs2 rounded border border-gray-300 px-2 py-1.5 focus:border-blue-400 focus:outline-none min-w-0"
            placeholder="새 구성요소 추가..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
          />
          <button onClick={addItem}
            className="shrink-0 px-2 py-1 border border-gray-300 bg-white text-gray-600 rounded hover:border-blue-400 hover:text-blue-600 text-xs2">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M5 2v6M2 5h6"/></svg>
          </button>
        </div>
        {inventionComponents && inventionComponents.length > 0 && references.length === 0 && (
          <button onClick={importFromComponents}
            className="w-full text-xs2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded py-1 border border-blue-200 transition-colors">
            구성요소 단계 항목 가져오기 ({inventionComponents.length}개)
          </button>
        )}
      </div>

      {/* ── 도면의 설명 ── */}
      <div className="border-t border-ck-border shrink-0 flex flex-col" style={{ minHeight: 120, maxHeight: 180 }}>
        <div className="px-2.5 py-1.5 border-b border-ck-border bg-white shrink-0 flex items-center justify-between">
          <p className="text-xs2 font-semibold uppercase tracking-wider text-gray-500">도면의 설명</p>
          <span className="text-xs2 text-gray-400">명세서 반영</span>
        </div>
        <textarea
          value={drawingDescription}
          onChange={e => onDrawingDescriptionChange?.(e.target.value)}
          placeholder="도 N은 ___에 관한 사시도이다. ___부(100)는 ___하고, ___부(200)는 ___한다."
          className="flex-1 resize-none px-2.5 py-2 text-sm2 leading-relaxed focus:outline-none bg-white placeholder-gray-300"
          style={{ minHeight: 90 }}
        />
      </div>
    </aside>
  );
}
