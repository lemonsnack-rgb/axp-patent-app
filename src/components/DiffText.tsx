// 단어 diff 렌더링 — 계산은 src/utils/diffWords.ts
import type { DiffSeg } from '../utils/diffWords';

/** mode 'before': 삭제부 강조 / 'after': 추가부 강조 / 'merged': 한 문장 안에서 삭제(취소선)·추가(강조) 동시 표시 */
export function DiffText({ segs, mode }: { segs: DiffSeg[]; mode: 'before' | 'after' | 'merged' }) {
  return (
    <>
      {segs.map((s, i) => {
        if (s.type === 'same') return <span key={i}>{s.text}</span>;
        if (s.type === 'removed') {
          return mode === 'after'
            ? null
            : <span key={i} className="bg-red-100 text-red-700 line-through decoration-red-400 rounded-sm">{s.text}</span>;
        }
        return mode === 'before'
          ? null
          : <span key={i} className="bg-green-100 text-green-800 rounded-sm">{s.text}</span>;
      })}
    </>
  );
}
