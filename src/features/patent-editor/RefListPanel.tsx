// RefListPanel — 도면 부호 목록 (검색·100단위 그룹·계층·도면설명)
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, GripVertical } from 'lucide-react';
import type { EditorReference, InventionComponent, RefShape } from './types';

// 도형 선택 아이콘 SVG
const SHAPES: { id: RefShape; label: string; icon: React.ReactNode }[] = [
  { id: 'rect', label: '사각형', icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><rect x="1" y="3" width="14" height="10" rx="1"/></svg> },
  { id: 'circle', label: '원형', icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><ellipse cx="8" cy="8" rx="7" ry="5"/></svg> },
  { id: 'diamond', label: '다이아몬드', icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><polygon points="8,1 15,8 8,15 1,8"/></svg> },
  { id: 'cylinder', label: '실린더', icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><ellipse cx="8" cy="4" rx="6" ry="2.5"/><line x1="2" y1="4" x2="2" y2="12"/><line x1="14" y1="4" x2="14" y2="12"/><ellipse cx="8" cy="12" rx="6" ry="2.5"/></svg> },
];

interface Props {
  references: EditorReference[];
  onAdd: (ref: EditorReference) => void;
  onUpdate?: (ref: EditorReference) => void;
  onDelete: (refNumber: string) => void;
  inventionComponents?: InventionComponent[];
  placedNums?: Set<string>;
  onPlaceRef?: (ref: EditorReference) => void;
  drawingDescription?: string;
  onDrawingDescriptionChange?: (value: string) => void;
}

// ── 계층 번호 자동 부여 ────────────────────────────────────
function getNextRootNumber(allRefs: EditorReference[]): string {
  const roots = allRefs
    .filter(r => !r.parentNumber)
    .map(r => parseInt(r.number))
    .filter(n => !isNaN(n) && n % 100 === 0);
  return roots.length === 0 ? '100' : String(Math.max(...roots) + 100);
}

// ── 트리 구성 ─────────────────────────────────────────────
interface TreeNode {
  ref: EditorReference;
  children: TreeNode[];
  depth: number;
}

function buildTree(refs: EditorReference[]): TreeNode[] {
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
  function visit(parent: string | undefined, depth: number): TreeNode[] {
    return (byParent.get(parent) ?? []).sort(sortFn).map(ref => ({
      ref, depth, children: visit(ref.number, depth + 1),
    }));
  }
  return visit(undefined, 0);
}

function flattenTree(nodes: TreeNode[]): { ref: EditorReference; depth: number }[] {
  const result: { ref: EditorReference; depth: number }[] = [];
  function walk(ns: TreeNode[]) {
    for (const n of ns) { result.push({ ref: n.ref, depth: n.depth }); walk(n.children); }
  }
  walk(nodes);
  return result;
}

// ── 100단위 그룹 ──────────────────────────────────────────
function getGroupPrefix(number: string): number {
  const n = parseInt(number);
  return isNaN(n) ? 0 : Math.floor(n / 100) * 100;
}

const DEPTH_INDENT = 16; // ComponentsPanel과 통일

export function RefListPanel({
  references, onAdd, onUpdate, onDelete,
  inventionComponents, placedNums, onPlaceRef,
  drawingDescription = '', onDrawingDescriptionChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [expandedNum, setExpandedNum] = useState<string | null>(null);
  const [newNum, setNewNum] = useState('');
  const [newName, setNewName] = useState('');
  const [linkedComp, setLinkedComp] = useState('');
  const [dragNum, setDragNum] = useState<string | null>(null);
  const [dropNum, setDropNum] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(references), [references]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.toLowerCase();
    return flat.filter(({ ref }) =>
      ref.number.toLowerCase().includes(q) || (ref.name ?? '').toLowerCase().includes(q)
    );
  }, [flat, search]);

  const groups = useMemo(() => {
    const prefixes = [...new Set(filtered.map(f => getGroupPrefix(f.ref.number)))].sort((a, b) => a - b);
    return prefixes.map(prefix => ({
      prefix,
      items: filtered.filter(f => getGroupPrefix(f.ref.number) === prefix),
    }));
  }, [filtered]);

  const toggleGroup = (prefix: number) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(prefix) ? next.delete(prefix) : next.add(prefix);
      return next;
    });

  // ── 새 부호 추가 ──────────────────────────────────────────
  const submitNew = () => {
    const num = newNum.trim() || getNextRootNumber(references);
    if (references.some(r => r.number === num)) { alert('이미 존재하는 번호입니다.'); return; }
    const compName = inventionComponents?.find(c => c.number === linkedComp)?.name;
    onAdd({ number: num, name: compName || newName.trim() || undefined });
    setNewNum(''); setNewName(''); setLinkedComp('');
  };

  // ── 계층 조작 (ComponentsPanel과 동일 방식) ───────────────

  // 들여쓰기(→): 바로 위 항목의 자식으로 만들기
  const indent = (ref: EditorReference) => {
    const idx = flat.findIndex(f => f.ref.number === ref.number);
    if (idx <= 0) return;
    const prev = flat[idx - 1];
    // 바로 위 항목이 같은 레벨이거나 상위 레벨이어야 indent 가능
    if (prev.depth > flat[idx].depth) return;
    onUpdate?.({ ...ref, parentNumber: prev.ref.number });
  };

  // 내어쓰기(←): 부모의 형제 레벨로 올리기
  const outdent = (ref: EditorReference) => {
    if (!ref.parentNumber) return;
    const parent = references.find(r => r.number === ref.parentNumber);
    onUpdate?.({ ...ref, parentNumber: parent?.parentNumber });
  };

  // 위로 이동: 같은 부모 내에서 위의 형제와 번호 교환
  const moveUp = (ref: EditorReference) => {
    const siblings = references
      .filter(r => r.parentNumber === ref.parentNumber)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    const idx = siblings.findIndex(r => r.number === ref.number);
    if (idx <= 0) return;
    const above = siblings[idx - 1];
    // 번호 교환
    const tempName = ref.name;
    onUpdate?.({ ...ref, number: above.number, name: above.name });
    onUpdate?.({ ...above, number: ref.number, name: tempName });
  };

  // 아래로 이동: 같은 부모 내에서 아래 형제와 번호 교환
  const moveDown = (ref: EditorReference) => {
    const siblings = references
      .filter(r => r.parentNumber === ref.parentNumber)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    const idx = siblings.findIndex(r => r.number === ref.number);
    if (idx >= siblings.length - 1) return;
    const below = siblings[idx + 1];
    const tempName = ref.name;
    onUpdate?.({ ...ref, number: below.number, name: below.name });
    onUpdate?.({ ...below, number: ref.number, name: tempName });
  };

  // 들여쓰기 가능 여부: 바로 위 항목이 있어야 함
  const canIndent = (ref: EditorReference) => {
    const idx = flat.findIndex(f => f.ref.number === ref.number);
    return idx > 0 && flat[idx - 1].depth >= flat[idx].depth;
  };

  // 위로 이동 가능 여부: 같은 부모 내 첫 번째가 아닐 때
  const canMoveUp = (ref: EditorReference) => {
    const siblings = references.filter(r => r.parentNumber === ref.parentNumber);
    const sorted = siblings.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return sorted[0]?.number !== ref.number;
  };

  // 아래로 이동 가능 여부: 같은 부모 내 마지막이 아닐 때
  const canMoveDown = (ref: EditorReference) => {
    const siblings = references.filter(r => r.parentNumber === ref.parentNumber);
    const sorted = siblings.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return sorted[sorted.length - 1]?.number !== ref.number;
  };

  // ── 드래그: 순서 변경만 (reparent 없음) ─────────────────
  const onDragEnd = () => {
    if (dragNum && dropNum && dragNum !== dropNum) {
      const dragRef = references.find(x => x.number === dragNum);
      const dropRef = references.find(x => x.number === dropNum);
      // 같은 부모(같은 레벨)일 때만 순서 교환
      if (dragRef && dropRef && onUpdate && dragRef.parentNumber === dropRef.parentNumber) {
        const tempName = dragRef.name;
        onUpdate({ ...dragRef, number: dropRef.number, name: dropRef.name });
        onUpdate({ ...dropRef, number: dragRef.number, name: tempName });
      }
    }
    setDragNum(null); setDropNum(null);
  };

  return (
    <aside className="flex h-full w-full flex-col bg-ck-bg overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-ck-border shrink-0 bg-white">
        <span className="text-xs2 font-semibold uppercase tracking-wider text-gray-500">
          도면 부호 <span className="font-normal text-gray-400">({references.length})</span>
        </span>
        <p className="text-xs2 text-gray-400 leading-tight mt-0.5">
          구성요소 위치를 캔버스에서 클릭·드래그로 지정합니다
        </p>
      </div>

      {/* ── 검색 ── */}
      <div className="px-2 py-1.5 border-b border-ck-border shrink-0">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="번호 또는 이름으로 검색…"
          className="w-full text-sm2 rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* ── 새 부호 추가 (폼 + 제출 버튼이 함께) ── */}
      <div className="px-2 py-1.5 border-b border-ck-border bg-white shrink-0 space-y-1">
        <p className="text-xs2 text-gray-500 font-semibold">새 부호 추가</p>
        <div className="flex gap-1">
          <input type="text" value={newNum} onChange={e => setNewNum(e.target.value)}
            placeholder={`번호 (자동: ${getNextRootNumber(references)})`}
            title="100, 200, 300... 특허 도면 부호 번호"
            onKeyDown={e => e.key === 'Enter' && submitNew()}
            className="w-20 text-sm2 rounded border border-gray-300 px-1.5 py-0.5 focus:border-blue-500 focus:outline-none shrink-0" />
          {inventionComponents && inventionComponents.length > 0 ? (
            <select value={linkedComp} onChange={e => {
              setLinkedComp(e.target.value);
              const c = inventionComponents.find(c => c.number === e.target.value);
              if (c) setNewName(c.name);
            }}
              title="구성요소 단계에서 확정한 항목과 연결"
              className="flex-1 text-sm2 rounded border border-gray-300 px-1.5 py-0.5 focus:border-blue-500 focus:outline-none min-w-0">
              <option value="">— 구성요소 연결</option>
              {inventionComponents.map(c => <option key={c.number} value={c.number}>({c.number}) {c.name}</option>)}
            </select>
          ) : (
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="이름 (선택)"
              onKeyDown={e => e.key === 'Enter' && submitNew()}
              className="flex-1 text-sm2 rounded border border-gray-300 px-1.5 py-0.5 focus:border-blue-500 focus:outline-none" />
          )}
          <button type="button" onClick={submitNew}
            className="shrink-0 px-2 py-0.5 text-xs2 font-semibold bg-blue-500 text-white rounded hover:bg-blue-600 border border-blue-500"
            title="새 도면 부호 추가">
            + 추가
          </button>
        </div>
      </div>

      {/* ── 부호 목록 ── */}
      <div className="flex-1 overflow-y-auto scroll-thin">
        {groups.length === 0 && (
          <div className="px-3 py-4 text-center space-y-1.5">
            <p className="text-xs2 text-gray-500 font-semibold">구성요소가 없습니다</p>
            <p className="text-xs2 text-gray-400 leading-relaxed">
              구성요소 단계에서 확정한 항목이<br/>자동으로 여기에 나타납니다.<br/>
              없는 경우 위 [+ 추가]를 눌러<br/>번호(100, 200...)와 이름을 입력하세요.
            </p>
          </div>
        )}
        {groups.map(({ prefix, items }) => {
          const collapsed = collapsedGroups.has(prefix);
          const groupLabel = prefix === 0 ? '기타' : `${prefix}번대`;
          return (
            <div key={prefix}>
              <button type="button" onClick={() => toggleGroup(prefix)}
                className="w-full flex items-center gap-1 px-2 py-1 bg-gray-100 border-b border-ck-border hover:bg-gray-200 text-left">
                {collapsed ? <ChevronRight size={11} className="text-gray-500 shrink-0" /> : <ChevronDown size={11} className="text-gray-500 shrink-0" />}
                <span className="text-xs2 font-semibold text-gray-600">{groupLabel}</span>
                <span className="text-xs2 text-gray-400 ml-1">({items.length})</span>
              </button>

              {!collapsed && items.map(({ ref: r, depth }) => {
                const isDragging = dragNum === r.number;
                const isDropTarget = dropNum === r.number && dragNum !== r.number;
                return (
                  <div key={r.number}>
                    <div
                      draggable
                      onDragStart={() => setDragNum(r.number)}
                      onDragOver={e => { e.preventDefault(); setDropNum(r.number); }}
                      onDragEnd={onDragEnd}
                      className={`flex items-center gap-0.5 border-b border-ck-border/50 bg-white hover:bg-ck-bg text-sm2 group transition-all ${isDragging ? 'opacity-30' : ''} ${isDropTarget ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                      style={{ paddingLeft: 8 + depth * DEPTH_INDENT, paddingRight: 4, paddingTop: 3, paddingBottom: 3 }}>

                      {/* 드래그 핸들 */}
                      <GripVertical size={10} className="text-gray-300 cursor-grab shrink-0" />
                      {depth > 0 && <span className="text-gray-300 text-xs2 shrink-0">↳</span>}

                      {/* 배치 상태 인디케이터 */}
                      {placedNums && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 transition-colors ${placedNums.has(r.number) ? 'bg-blue-500' : 'bg-gray-200'}`}
                          title={placedNums.has(r.number) ? '캔버스에 배치됨' : '미배치'}
                        />
                      )}

                      {/* 번호 */}
                      <span className="font-mono font-semibold text-gray-800 shrink-0 min-w-[2.8em]">{r.number}</span>

                      {/* 이름 (클릭 → 확장 편집) */}
                      <button type="button"
                        onClick={() => setExpandedNum(expandedNum === r.number ? null : r.number)}
                        className="flex-1 min-w-0 text-left text-gray-600 hover:text-blue-700 flex items-center gap-0.5">
                        <span className="truncate">{r.name ?? <span className="italic text-gray-400">(이름 없음)</span>}</span>
                        {r.shape && (
                          <span className="shrink-0 text-gray-300 text-xs2 ml-0.5">
                            {SHAPES.find(s => s.id === r.shape)?.icon}
                          </span>
                        )}
                      </button>

                      {/* ── 액션 버튼 (hover, ComponentsPanel과 동일 방식) ── */}
                      <div className="flex items-center gap-px shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* ↑ 위로 */}
                        <button type="button" onClick={() => moveUp(r)} disabled={!canMoveUp(r)}
                          className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="위로">
                          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 7l3-4 3 4"/></svg>
                        </button>
                        {/* ↓ 아래로 */}
                        <button type="button" onClick={() => moveDown(r)} disabled={!canMoveDown(r)}
                          className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="아래로">
                          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 3l3 4 3-4"/></svg>
                        </button>
                        <span className="w-px h-3 bg-gray-200 mx-0.5" />
                        {/* → 들여쓰기 (하위로) */}
                        <button type="button" onClick={() => indent(r)} disabled={!canIndent(r)}
                          className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="하위로 (→)">
                          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 5h6M6 3l2 2-2 2"/></svg>
                        </button>
                        {/* ← 내어쓰기 (상위로) */}
                        <button type="button" onClick={() => outdent(r)} disabled={!r.parentNumber}
                          className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="상위로 (←)">
                          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M8 5H2M4 3L2 5l2 2"/></svg>
                        </button>
                        <span className="w-px h-3 bg-gray-200 mx-0.5" />
                        {/* 캔버스 배치 */}
                        {onPlaceRef && (
                          <button type="button" onClick={() => onPlaceRef(r)}
                            title="도면에 배치"
                            className="rounded px-1 py-0.5 text-blue-600 hover:bg-blue-50 text-xs2 font-semibold border border-blue-200 hover:border-blue-400 transition-colors">
                            배치
                          </button>
                        )}
                        {/* 삭제 */}
                        <button type="button"
                          onClick={() => { if (window.confirm(`"${r.name || r.number}" 부호를 삭제하시겠습니까?`)) onDelete(r.number); }}
                          title="삭제"
                          className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>

                    {/* 확장 편집 패널 (이름 + 도형 선택) */}
                    {expandedNum === r.number && onUpdate && (
                      <div className="bg-blue-50 border-b border-blue-100 px-3 py-2 space-y-1.5"
                        style={{ paddingLeft: 8 + depth * DEPTH_INDENT + 8 }}>
                        <input type="text" defaultValue={r.name ?? ''} placeholder="이름 (선택)"
                          onBlur={e => { const v = e.target.value.trim(); if (v !== (r.name ?? '')) onUpdate({ ...r, name: v || undefined }); }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setExpandedNum(null); }}
                          className="w-full text-xs2 rounded border border-blue-200 bg-white px-1.5 py-0.5 focus:border-blue-400 focus:outline-none"
                        />
                        <div className="flex gap-1">
                          {SHAPES.map(s => (
                            <button key={s.id} type="button"
                              onClick={() => onUpdate({ ...r, shape: r.shape === s.id ? undefined : s.id })}
                              title={s.label}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1 rounded border text-xs2 transition-all ${
                                r.shape === s.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600'
                              }`}>
                              {s.icon}
                              <span className="text-[9px] leading-none">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── 도면의 설명 ── */}
      <div className="border-t border-ck-border shrink-0 flex flex-col" style={{ minHeight: 120, maxHeight: 200 }}>
        <div className="px-2.5 py-1.5 border-b border-ck-border bg-white shrink-0 flex items-center justify-between">
          <p className="text-xs2 font-semibold uppercase tracking-wider text-gray-500">도면의 설명</p>
          <span className="text-xs2 text-gray-400">명세서 반영</span>
        </div>
        <textarea
          value={drawingDescription}
          onChange={e => onDrawingDescriptionChange?.(e.target.value)}
          placeholder={`도 N은 ___에 관한 사시도이다. ___부(100)는 ___하고, ___부(200)는 ___한다.`}
          className="flex-1 resize-none px-2.5 py-2 text-sm2 leading-relaxed focus:outline-none bg-white placeholder-gray-300"
          style={{ minHeight: 90 }}
        />
      </div>
    </aside>
  );
}
