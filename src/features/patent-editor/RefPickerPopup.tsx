import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { EditorReference } from "./types";

interface Props {
  availableReferences: EditorReference[];
  position: { x: number; y: number };
  initialRef?: EditorReference;
  title?: string;
  onConfirm: (ref: EditorReference, isNew: boolean) => void;
  onCancel: () => void;
}

export function RefPickerPopup({
  availableReferences,
  position,
  initialRef,
  title,
  onConfirm,
  onCancel,
}: Props) {
  const [query, setQuery] = useState(initialRef?.number ?? "");
  const [addMode, setAddMode] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return availableReferences;
    const q = trimmed.toLowerCase();
    return availableReferences.filter(
      (r) =>
        r.number.toLowerCase().includes(q) ||
        (r.name?.toLowerCase().includes(q) ?? false),
    );
  }, [availableReferences, trimmed]);

  const hasExactMatch = availableReferences.some(
    (r) => r.number === trimmed,
  );

  const submitNew = () => {
    const num = (newNumber.trim() || trimmed).trim();
    if (!num) return;
    const name = newName.trim() || undefined;
    onConfirm({ number: num, name }, true);
  };

  return (
    <div
      className="absolute z-30 w-72 rounded-md border border-gray-300 bg-white shadow-2xl"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-ck-border px-3 py-2">
        <span className="text-md2 font-semibold text-gray-700">
          {title ?? "도면부호 선택"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          title="닫기"
          className="text-gray-400 hover:text-gray-700"
        >
          <X size={14} />
        </button>
      </div>

      {!addMode && (
        <>
          <div className="relative px-3 pt-2">
            <Search
              size={12}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="번호 또는 이름 검색"
              className="w-full rounded border border-gray-300 py-1 pl-6 pr-2 text-md2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto px-1 py-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm2 text-gray-400">
                일치하는 부호 없음
              </li>
            ) : (
              filtered.map((r) => {
                const isCurrent = initialRef?.number === r.number;
                return (
                  <li key={r.number}>
                    <button
                      type="button"
                      onClick={() => onConfirm(r, false)}
                      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-md2 hover:bg-blue-50 ${
                        isCurrent ? "bg-blue-50" : ""
                      }`}
                    >
                      <span className="font-mono font-semibold text-gray-900">
                        {r.number}
                      </span>
                      <span className="flex-1 truncate text-gray-600">
                        {r.name ?? "(이름 없음)"}
                      </span>
                      {isCurrent && (
                        <span className="text-xs2 text-blue-600">현재</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-gray-100 p-2">
            <button
              type="button"
              onClick={() => {
                setNewNumber(trimmed && !hasExactMatch ? trimmed : "");
                setNewName("");
                setAddMode(true);
              }}
              className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-gray-300 py-1 text-sm2 text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
            >
              <Plus size={12} />
              <span>
                {trimmed && !hasExactMatch
                  ? `'${trimmed}' 신규 부호로 추가`
                  : "새 부호 추가"}
              </span>
            </button>
          </div>
        </>
      )}

      {addMode && (
        <div className="space-y-2 px-3 py-3">
          <div>
            <label className="mb-0.5 block text-xs2 font-semibold text-gray-500">
              번호 (필수)
            </label>
            <input
              type="text"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="예: 200"
              className="w-full rounded border border-gray-300 px-2 py-1 text-md2 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs2 font-semibold text-gray-500">
              이름 (선택)
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 베어링"
              className="w-full rounded border border-gray-300 px-2 py-1 text-md2 focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
              }}
            />
          </div>
          <div className="flex justify-end gap-1 pt-1">
            <button
              type="button"
              onClick={() => setAddMode(false)}
              className="rounded border border-gray-300 px-2 py-1 text-sm2 text-gray-600 hover:bg-ck-bg"
            >
              뒤로
            </button>
            <button
              type="button"
              onClick={submitNew}
              disabled={!newNumber.trim()}
              className="rounded border border-blue-600 bg-blue-600 px-2 py-1 text-sm2 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
