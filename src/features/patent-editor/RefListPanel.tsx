import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { EditorReference } from "./types";

interface Props {
  references: EditorReference[];
  onAdd: (ref: EditorReference) => void;
  onUpdate?: (ref: EditorReference) => void;
  onDelete: (refNumber: string) => void;
}

interface FlatNode {
  ref: EditorReference;
  depth: number;
}

function flattenTree(refs: EditorReference[]): FlatNode[] {
  const allNums = new Set(refs.map((r) => r.number));
  const byParent = new Map<string | undefined, EditorReference[]>();
  for (const r of refs) {
    const parent =
      r.parentNumber && allNums.has(r.parentNumber) ? r.parentNumber : undefined;
    const list = byParent.get(parent) ?? [];
    list.push(r);
    byParent.set(parent, list);
  }
  const sortFn = (a: EditorReference, b: EditorReference) =>
    a.number.localeCompare(b.number, undefined, { numeric: true });
  const result: FlatNode[] = [];
  const visit = (parent: string | undefined, depth: number) => {
    const children = (byParent.get(parent) ?? []).sort(sortFn);
    for (const c of children) {
      result.push({ ref: c, depth });
      visit(c.number, depth + 1);
    }
  };
  visit(undefined, 0);
  return result;
}

export function RefListPanel({ references, onAdd, onUpdate, onDelete }: Props) {
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [editingNum, setEditingNum] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const flat = useMemo(() => flattenTree(references), [references]);

  const submitNew = () => {
    const trimmedNum = num.trim();
    if (!trimmedNum) return;
    if (references.some((r) => r.number === trimmedNum)) {
      alert("이미 존재하는 부호 번호입니다.");
      return;
    }
    onAdd({ number: trimmedNum, name: name.trim() || undefined });
    setNum("");
    setName("");
  };

  const commitNameEdit = (ref: EditorReference) => {
    const trimmed = editName.trim();
    if (trimmed !== (ref.name ?? "")) {
      onUpdate?.({ ...ref, name: trimmed || undefined });
    }
    setEditingNum(null);
  };

  const indent = (idx: number) => {
    if (!onUpdate) return;
    const cur = flat[idx];
    if (!cur) return;
    // 같은 depth의 바로 위 형제 찾기
    for (let i = idx - 1; i >= 0; i--) {
      if (flat[i].depth === cur.depth) {
        // sibling 발견 → 그것의 자식으로
        onUpdate({ ...cur.ref, parentNumber: flat[i].ref.number });
        return;
      }
      if (flat[i].depth < cur.depth) return; // 위 형제 없음
    }
  };

  const outdent = (idx: number) => {
    if (!onUpdate) return;
    const cur = flat[idx];
    if (!cur || !cur.ref.parentNumber) return;
    // 현재 parent의 parent로
    const parent = references.find((r) => r.number === cur.ref.parentNumber);
    onUpdate({ ...cur.ref, parentNumber: parent?.parentNumber });
  };

  return (
    <aside className="flex h-full w-full flex-col bg-ck-bg p-2">
      <div className="mb-1.5 px-1 text-xs2 font-semibold uppercase tracking-wider text-gray-500">
        도면 부호 ({references.length})
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto">
        {flat.length === 0 ? (
          <li className="py-4 text-center text-xs2 text-gray-400">
            등록된 부호 없음
          </li>
        ) : (
          flat.map(({ ref: r, depth }, idx) => {
            const isEditing = editingNum === r.number;
            const hasParent = !!r.parentNumber;
            // 위 형제 존재 여부
            let canIndent = false;
            for (let i = idx - 1; i >= 0; i--) {
              if (flat[i].depth === depth) {
                canIndent = true;
                break;
              }
              if (flat[i].depth < depth) break;
            }
            return (
              <li
                key={r.number}
                className="flex items-center gap-0.5 rounded border border-ck-border bg-white px-1 py-0.5 text-sm2"
                style={{ paddingLeft: 4 + depth * 10 }}
                title={
                  hasParent ? `상위: ${r.parentNumber}` : undefined
                }
              >
                {depth > 0 && (
                  <span className="text-gray-300 select-none">↳</span>
                )}
                <span className="min-w-[2.5em] font-mono font-semibold text-gray-900">
                  {r.number}
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitNameEdit(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        (e.currentTarget as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingNum(null);
                    }}
                    autoFocus
                    placeholder="이름"
                    className="flex-1 min-w-0 rounded border border-blue-400 px-1 py-0 text-sm2 focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!onUpdate) return;
                      setEditingNum(r.number);
                      setEditName(r.name ?? "");
                    }}
                    title="이름 수정"
                    className="flex flex-1 min-w-0 items-center gap-0.5 text-left text-gray-600 hover:text-blue-700"
                  >
                    <span className="truncate">
                      {r.name ?? (
                        <span className="italic text-gray-400">(이름 없음)</span>
                      )}
                    </span>
                    {onUpdate && (
                      <Pencil
                        size={9}
                        className="shrink-0 text-gray-300 group-hover:text-blue-500"
                      />
                    )}
                  </button>
                )}
                {onUpdate && (
                  <>
                    <button
                      type="button"
                      onClick={() => outdent(idx)}
                      disabled={!hasParent}
                      title="내어쓰기 (상위 단계로)"
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ChevronLeft size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => indent(idx)}
                      disabled={!canIndent}
                      title="들여쓰기 (위 형제의 자식으로)"
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ChevronRight size={11} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(r.number)}
                  title="이 부호 + 사용 객체 일괄 삭제"
                  className="rounded p-0.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={11} />
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-2 space-y-1 border-t border-ck-border pt-2">
        <div className="text-xs2 font-semibold text-gray-500">
          새 부호 추가
        </div>
        <input
          type="text"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="번호"
          className="w-full rounded border border-gray-300 px-1.5 py-0.5 text-sm2 focus:border-blue-500 focus:outline-none"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 (선택)"
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNew();
          }}
          className="w-full rounded border border-gray-300 px-1.5 py-0.5 text-sm2 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={submitNew}
          disabled={!num.trim()}
          className="flex w-full items-center justify-center gap-1 rounded border border-blue-600 bg-blue-600 px-2 py-1 text-xs2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <Plus size={10} /> 추가
        </button>
      </div>
    </aside>
  );
}
