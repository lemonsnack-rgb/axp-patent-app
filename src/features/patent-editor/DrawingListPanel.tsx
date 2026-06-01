import { Star } from "lucide-react";
import type { PatentDrawing } from "./types";

interface Props {
  drawings: PatentDrawing[];
  activeId: string;
  representativeId?: string;
  onSelect: (id: string) => void;
}

export function DrawingListPanel({
  drawings,
  activeId,
  representativeId,
  onSelect,
}: Props) {
  return (
    <aside className="h-full w-full overflow-y-auto bg-ck-bg p-2">
      <div className="mb-1.5 px-1 text-xs2 font-semibold uppercase tracking-wider text-gray-500">
        도면 목록 ({drawings.length})
      </div>
      <ul className="space-y-1.5">
        {drawings.map((d, i) => {
          const isActive = d.id === activeId;
          const isRep = d.id === representativeId;
          return (
            <li key={d.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                title={d.caption}
                className={`group block w-full rounded border p-1 text-left transition ${
                  isActive
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
                    : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/40"
                }`}
              >
                <div className="relative aspect-[10/7] overflow-hidden rounded border border-ck-border bg-white">
                  <img
                    src={d.thumbnailUrl ?? d.sourceImageUrl}
                    alt={d.caption}
                    className="absolute inset-0 h-full w-full object-contain"
                    draggable={false}
                  />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-xs2 font-semibold text-white">
                    {i + 1}
                  </span>
                  {isRep && (
                    <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-amber-500 px-1 py-0.5 text-xs2 font-bold text-white">
                      <Star size={8} fill="currentColor" /> 대표
                    </span>
                  )}
                </div>
                <div
                  className={`mt-1 truncate text-xs2 ${
                    isActive ? "font-semibold text-blue-700" : "text-gray-700"
                  }`}
                >
                  {d.caption || `도 ${i + 1}`}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
