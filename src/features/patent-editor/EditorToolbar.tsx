import {
  Brush,
  Circle,
  CircleDot,
  Download,
  Eraser,
  Frame,
  Grid3x3,
  Hash,
  Minus,
  MousePointer2,
  MoveRight,
  PaintBucket,
  Save,
  Slash,
  Spline,
  Square,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEditorStore } from "./useEditorStore";
import type { LeaderCurve, LineEnd, LineStyle, ToolMode } from "./types";

interface Props {
  onSave: () => void;
  onExport: () => void;
  onClose: () => void;
  onToggleHatch: () => void;
  busy?: boolean;
}

const TOOLS: { mode: ToolMode; label: string; icon: ReactNode }[] = [
  { mode: "select", label: "선택", icon: <MousePointer2 size={14} /> },
  { mode: "line", label: "선 그리기", icon: <Slash size={14} /> },
  { mode: "text", label: "참조번호", icon: <Hash size={14} /> },
  { mode: "ref-circle", label: "원형번호", icon: <CircleDot size={14} /> },
  { mode: "rect", label: "사각", icon: <Square size={14} /> },
  { mode: "circle", label: "원", icon: <Circle size={14} /> },
  { mode: "marquee-eraser", label: "영역지움", icon: <Eraser size={14} /> },
  { mode: "brush-eraser", label: "브러시", icon: <Brush size={14} /> },
];

const LINE_STYLES: { v: LineStyle; label: string }[] = [
  { v: "solid", label: "───" },
  { v: "dashed", label: "─ ─" },
  { v: "dash-dot", label: "─·─" },
  { v: "dash-double-dot", label: "─··" },
];

const LINE_ENDS: { v: LineEnd; label: ReactNode; title: string }[] = [
  { v: "plain", label: "—", title: "없음" },
  { v: "dot", label: "●", title: "점" },
  { v: "arrow", label: <MoveRight size={12} />, title: "화살표" },
];

const LEADER_CURVES: { v: LeaderCurve; label: ReactNode; title: string }[] = [
  {
    v: "straight",
    label: (
      <span className="inline-flex items-center gap-1">
        <Minus size={12} />
        직선
      </span>
    ),
    title: "직선 지시선",
  },
  {
    v: "s-curve",
    label: (
      <span className="inline-flex items-center gap-1">
        <Spline size={12} />
        S곡선
      </span>
    ),
    title: "S자 곡선 지시선",
  },
];

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-md2 rounded border transition ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-gray-300 bg-white text-gray-700 hover:bg-ck-bg"
      }`}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({
  onSave,
  onExport,
  onClose,
  onToggleHatch,
  busy,
}: Props) {
  const tool = useEditorStore((s) => s.tool);
  const lineStyle = useEditorStore((s) => s.lineStyle);
  const lineEnd = useEditorStore((s) => s.lineEnd);
  const leaderCurve = useEditorStore((s) => s.leaderCurve);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showMarginGuide = useEditorStore((s) => s.showMarginGuide);
  const setTool = useEditorStore((s) => s.setTool);
  const setLineStyle = useEditorStore((s) => s.setLineStyle);
  const setLineEnd = useEditorStore((s) => s.setLineEnd);
  const setLeaderCurve = useEditorStore((s) => s.setLeaderCurve);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleMarginGuide = useEditorStore((s) => s.toggleMarginGuide);

  return (
    <div className="border-b border-ck-border bg-ck-bg">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TOOLS.map((t) => (
            <Btn
              key={t.mode}
              active={tool === t.mode}
              onClick={() => setTool(t.mode)}
              title={t.label}
            >
              {t.icon}
              <span>{t.label}</span>
            </Btn>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Btn onClick={onSave} title="임시저장">
            <Save size={14} />
            <span>임시저장</span>
          </Btn>
          <button
            type="button"
            onClick={onExport}
            disabled={busy}
            title="1-bit 흑백 PNG 내보내기"
            className="btn-primary btn-xs"
          >
            <Download size={14} />
            <span>{busy ? "변환 중…" : "다운로드"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            title="닫기"
            className="btn-outline btn-xs"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-ck-border bg-white text-md2 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">선:</span>
          {LINE_STYLES.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setLineStyle(s.v)}
              className={`px-2 py-0.5 border rounded font-mono text-sm2 ${
                lineStyle === s.v
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-ck-bg"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-gray-500">끝단:</span>
          {LINE_ENDS.map((e) => (
            <button
              key={e.v}
              type="button"
              onClick={() => setLineEnd(e.v)}
              title={e.title}
              className={`inline-flex items-center justify-center w-7 h-6 border rounded text-sm2 ${
                lineEnd === e.v
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-ck-bg"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-gray-500">선 모양:</span>
          {LEADER_CURVES.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => setLeaderCurve(c.v)}
              title={c.title}
              className={`inline-flex items-center justify-center px-2 h-6 border rounded text-sm2 ${
                leaderCurve === c.v
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-ck-bg"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="border-l border-ck-border h-5" />

        <button
          type="button"
          onClick={onToggleHatch}
          className="inline-flex items-center gap-1 px-2 py-0.5 border border-gray-300 rounded bg-white hover:bg-ck-bg"
          title="선택된 도형에 45° 해칭 토글"
        >
          <PaintBucket size={12} />
          <span>해칭</span>
        </button>

        <button
          type="button"
          onClick={toggleGrid}
          className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded ${
            showGrid
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-300 bg-white text-gray-700 hover:bg-ck-bg"
          }`}
          title="그리드 표시 토글 (내보내기에는 미포함)"
        >
          <Grid3x3 size={12} />
          <span>그리드</span>
        </button>

        <button
          type="button"
          onClick={toggleMarginGuide}
          className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded ${
            showMarginGuide
              ? "border-red-500 bg-red-50 text-red-700"
              : "border-gray-300 bg-white text-gray-700 hover:bg-ck-bg"
          }`}
          title="여백 가이드 표시 토글 (내보내기에는 미포함)"
        >
          <Frame size={12} />
          <span>여백</span>
        </button>
      </div>
    </div>
  );
}
