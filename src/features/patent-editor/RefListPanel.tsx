// RefListPanel — 도면 부호 목록 (검색·100단위 그룹·계층·도면설명)
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, ChevronsUp, ChevronsDown } from 'lucide-react';
import type { EditorReference, InventionComponent } from './types';

interface Props {
  references: EditorReference[];
  onAdd: (ref: EditorReference) => void;
  onUpdate?: (ref: EditorReference) => void;
  onDelete: (refNumber: string) => void;
  inventionComponents?: InventionComponent[];
  /** 명세서에 들어갈 도면의 설명 */
  drawingDescription?: string;
  onDrawingDescriptionChange?: (value: string) => void;
}

// ── 계층 번호 자동 부여 ────────────────────────────────────
function getNextChildNumber(parentNumber: string, allRefs: EditorReference[]): string {
  const parentNum = parseInt(parentNumber);
  if (isNaN(parentNum)) return String(parseInt(parentNumber) + 1);
  // 100 → 110, 110 → 111 (끝자리 0이면 ×10 단위, 아니면 1 단위)
  const step = parentNum % 10 === 0 ? 10 : 1;
  const siblings = allRefs
    .filter(r => r.parentNumber === parentNumber)
    .map(r => parseInt(r.number))
    .filter(n => !isNaN(n));
  return siblings.length === 0
    ? String(parentNum + step)
    : String(Math.max(...siblings) + step);
}

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
      ref,
      depth,
      children: visit(ref.number, depth + 1),
    }));
  }
  return visit(undefined, 0);
}

function flattenTree(nodes: TreeNode[]): { ref: EditorReference; depth: number }[] {
  const result: { ref: EditorReference; depth: number }[] = [];
  function walk(ns: TreeNode[]) {
    for (const n of ns) {
      result.push({ ref: n.ref, depth: n.depth });
      walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

// ── 100단위 그룹 ──────────────────────────────────────────
function getGroupPrefix(number: string): number {
  const n = parseInt(number);
  return isNaN(n) ? 0 : Math.floor(n / 100) * 100;
}

export function RefListPanel({
  references, onAdd, onUpdate, onDelete,
  inventionComponents,
  drawingDescription = '',
  onDrawingDescriptionChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [editingNum, setEditingNum] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newNum, setNewNum] = useState('');
  const [newName, setNewName] = useState('');
  const [linkedComp, setLinkedComp] = useState('');
  // addingChildOf: 향후 인라인 하위 추가 UI 확장 시 사용 예정
  const setAddingChildOf = (_: string | null) => {};

  const tree = useMemo(() => buildTree(references), [references]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  // 검색 필터
  const filtered = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.toLowerCase();
    return flat.filter(({ ref }) =>
      ref.number.toLowerCase().includes(q) || (ref.name ?? '').toLowerCase().includes(q)
    );
  }, [flat, search]);

  // 100단위 그룹 목록
  const groups = useMemo(() => {
    const prefixes = [...new Set(filtered.map(f => getGroupPrefix(f.ref.number)))].sort((a, b) => a - b);
    return prefixes.map(prefix => ({
      prefix,
      items: filtered.filter(f => getGroupPrefix(f.ref.number) === prefix),
    }));
  }, [filtered]);

  const toggleGroup = (prefix: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(prefix) ? next.delete(prefix) : next.add(prefix);
      return next;
    });
  };

  // 새 부호 추가 (루트)
  const submitNew = () => {
    const num = newNum.trim() || getNextRootNumber(references);
    if (references.some(r => r.number === num)) { alert('이미 존재하는 번호입니다.'); return; }
    const compName = inventionComponents?.find(c => c.number === linkedComp)?.name;
    onAdd({ number: num, name: compName || newName.trim() || undefined });
    setNewNum(''); setNewName(''); setLinkedComp('');
  };

  // 하위 항목 추가
  const submitChild = (parentNumber: string) => {
    const num = getNextChildNumber(parentNumber, references);
    if (references.some(r => r.number === num)) {
      const unique = String(parseInt(num) + 1);
      onAdd({ number: unique, parentNumber, name: undefined });
    } else {
      onAdd({ number: num, parentNumber, name: undefined });
    }
    setAddingChildOf(null);
  };

  const commitNameEdit = (ref: EditorReference) => {
    const trimmed = editName.trim();
    if (trimmed !== (ref.name ?? '')) onUpdate?.({ ...ref, name: trimmed || undefined });
    setEditingNum(null);
  };

  return (
    <aside className="flex h-full w-full flex-col bg-ck-bg overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-ck-border shrink-0 bg-white">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs2 font-semibold uppercase tracking-wider text-gray-500">
            도면 부호 <span className="font-normal text-gray-400">({references.length})</span>
          </span>
          <button type="button" onClick={submitNew}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs2 border border-blue-500 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="새 도면 부호 추가 (번호 + 이름)">
            <Plus size={10} /> 추가
          </button>
        </div>
        {/* 목적 설명 */}
        <p className="text-xs2 text-gray-400 leading-tight">
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

      {/* ── 새 부호 추가 ── */}
      <div className="px-2 py-1.5 border-b border-ck-border bg-white shrink-0 space-y-1">
        <p className="text-xs2 text-gray-400 font-semibold">새 부호 추가</p>
        <input type="text" value={newNum} onChange={e => setNewNum(e.target.value)}
          placeholder={`부호 번호 (자동: ${getNextRootNumber(references)})`}
          title="100, 200, 300... 특허 도면 부호 번호"
          className="w-full text-sm2 rounded border border-gray-300 px-1.5 py-0.5 focus:border-blue-500 focus:outline-none" />
        {inventionComponents && inventionComponents.length > 0 ? (
          <select value={linkedComp} onChange={e => { setLinkedComp(e.target.value); const c = inventionComponents.find(c => c.number === e.target.value); if (c) setNewName(c.name); }}
            title="구성요소와 연결 — 구성요소 이름이 부호 이름으로 사용됩니다"
            className="w-full text-sm2 rounded border border-gray-300 px-1.5 py-0.5 focus:border-blue-500 focus:outline-none">
            <option value="">— 구성요소 연결</option>
            {inventionComponents.map(c => <option key={c.number} value={c.number}>({c.number}) {c.name}</option>)}
          </select>
        ) : (
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="이름 (선택)"
            onKeyDown={e => e.key === 'Enter' && submitNew()}
            className="w-full text-sm2 rounded border border-gray-300 px-1.5 py-0.5 focus:border-blue-500 focus:outline-none" />
        )}
      </div>

      {/* ── 부호 목록 (그룹·계층·스크롤) ── */}
      <div className="flex-1 overflow-y-auto scroll-thin">
        {groups.length === 0 && (
          <div className="px-3 py-4 text-center space-y-1.5">
            <p className="text-xs2 text-gray-500 font-semibold">구성요소가 없습니다</p>
            <p className="text-xs2 text-gray-400 leading-relaxed">
              구성요소 단계에서 확정한 항목이<br/>자동으로 여기에 나타납니다.<br/>
              없는 경우 [추가] 버튼을 눌러<br/>번호(100, 200...)와 이름을 입력하세요.
            </p>
          </div>
        )}
        {groups.map(({ prefix, items }) => {
          const collapsed = collapsedGroups.has(prefix);
          const groupLabel = prefix === 0 ? '기타' : `${prefix}번대`;
          return (
            <div key={prefix}>
              {/* 그룹 헤더 */}
              <button type="button" onClick={() => toggleGroup(prefix)}
                className="w-full flex items-center gap-1 px-2 py-1 bg-gray-100 border-b border-ck-border hover:bg-gray-200 text-left">
                {collapsed ? <ChevronRight size={11} className="text-gray-500 shrink-0" /> : <ChevronDown size={11} className="text-gray-500 shrink-0" />}
                <span className="text-xs2 font-semibold text-gray-600">{groupLabel}</span>
                <span className="text-xs2 text-gray-400 ml-1">({items.length})</span>
              </button>

              {/* 그룹 아이템 */}
              {!collapsed && items.map(({ ref: r, depth }) => {
                const isEditing = editingNum === r.number;
                return (
                  <div key={r.number}
                    className="flex items-center gap-0.5 border-b border-ck-border/50 bg-white hover:bg-ck-bg text-sm2 group"
                    style={{ paddingLeft: 8 + depth * 12, paddingRight: 4, paddingTop: 3, paddingBottom: 3 }}>
                    {depth > 0 && <span className="text-gray-300 text-xs2 shrink-0">↳</span>}

                    {/* 번호 */}
                    <span className="font-mono font-semibold text-gray-800 shrink-0 min-w-[2.8em]">{r.number}</span>

                    {/* 이름 */}
                    {isEditing ? (
                      <input type="text" value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => commitNameEdit(r)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitNameEdit(r);
                          if (e.key === 'Escape') setEditingNum(null);
                        }}
                        autoFocus
                        className="flex-1 min-w-0 rounded border border-blue-400 px-1 py-0 text-sm2 focus:outline-none"
                      />
                    ) : (
                      <button type="button" onClick={() => { if (!onUpdate) return; setEditingNum(r.number); setEditName(r.name ?? ''); }}
                        className="flex-1 min-w-0 text-left text-gray-600 hover:text-blue-700 flex items-center gap-0.5">
                        <span className="truncate">{r.name ?? <span className="italic text-gray-400">(이름 없음)</span>}</span>
                        {onUpdate && <Pencil size={8} className="shrink-0 opacity-0 group-hover:opacity-60" />}
                      </button>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* 하위 추가 */}
                      <button type="button" onClick={() => submitChild(r.number)} title="하위 항목 추가"
                        className="rounded p-0.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600">
                        <ChevronsDown size={10} />
                      </button>
                      {/* 상위로 이동 */}
                      {r.parentNumber && onUpdate && (
                        <button type="button" onClick={() => {
                          const parent = references.find(x => x.number === r.parentNumber);
                          onUpdate({ ...r, parentNumber: parent?.parentNumber });
                        }} title="상위로 이동" className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <ChevronsUp size={10} />
                        </button>
                      )}
                      {/* 삭제 */}
                      <button type="button" onClick={() => onDelete(r.number)} title="삭제"
                        className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={10} />
                      </button>
                    </div>
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
