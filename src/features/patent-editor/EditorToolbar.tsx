// EditorToolbar — 파워포인트 스타일 리본 툴바
// 그룹 구조로 기능 확장에 유연하게 대응
import {
  Brush, Circle, CircleDot, Download, Eraser, Frame,
  Grid3x3, Minus, MousePointer2, MoveRight, PaintBucket,
  Save, Slash, Spline, Square, X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEditorStore } from './useEditorStore';
import type { LeaderCurve, LineEnd, LineStyle, ToolMode } from './types';

interface Props {
  onSave: () => void;
  onExport: () => void;
  onClose: () => void;
  onToggleHatch: () => void;
  busy?: boolean;
}

// 도구 그룹 1: 그리기 도구
const DRAW_TOOLS: { mode: ToolMode; label: string; icon: ReactNode }[] = [
  { mode: 'select',         label: '선택',    icon: <MousePointer2 size={14} /> },
  { mode: 'line',           label: '선',      icon: <Slash size={14} /> },
  { mode: 'text',           label: '번호 달기', icon: <span className="font-bold text-xs2">A</span> },
  { mode: 'ref-circle',     label: '원형 번호', icon: <CircleDot size={14} /> },
  { mode: 'rect',           label: '사각형',  icon: <Square size={14} /> },
  { mode: 'circle',         label: '원',      icon: <Circle size={14} /> },
  { mode: 'marquee-eraser', label: '영역 지우기', icon: <Eraser size={14} /> },
  { mode: 'brush-eraser',   label: '브러시',  icon: <Brush size={14} /> },
];

const LINE_STYLES: { v: LineStyle; label: string }[] = [
  { v: 'solid',            label: '───' },
  { v: 'dashed',           label: '─ ─' },
  { v: 'dash-dot',         label: '─·─' },
  { v: 'dash-double-dot',  label: '─··' },
];

const LINE_ENDS: { v: LineEnd; label: ReactNode; title: string }[] = [
  { v: 'plain', label: '—',                  title: '끝 없음' },
  { v: 'dot',   label: '●',                  title: '점' },
  { v: 'arrow', label: <MoveRight size={12} />, title: '화살표' },
];

const LEADER_CURVES: { v: LeaderCurve; label: ReactNode; title: string }[] = [
  { v: 'straight', label: <span className="flex items-center gap-0.5"><Minus size={11} />직선</span>,    title: '직선 연결선' },
  { v: 's-curve',  label: <span className="flex items-center gap-0.5"><Spline size={11} />S자</span>,   title: 'S자 연결선' },
];

// 툴 버튼 컴포넌트
function ToolBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded border transition min-w-[44px] text-xs2 ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-transparent bg-transparent text-gray-600 hover:border-gray-300 hover:bg-white'
      }`}>
      {children}
    </button>
  );
}

// 옵션 버튼 (선 스타일, 끝단 등)
function OptBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`inline-flex items-center justify-center px-2 py-1 border rounded text-sm2 transition ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-ck-bg'
      }`}>
      {children}
    </button>
  );
}

// 그룹 구분선
function Divider() {
  return <div className="w-px self-stretch bg-gray-200 mx-1" />;
}

// 그룹 컨테이너 (레이블 + 버튼들)
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-stretch">
      <div className="flex items-center gap-0.5 px-0.5">{children}</div>
      <p className="text-center text-xs2 text-gray-400 mt-0.5 px-1" style={{ fontSize: 9 }}>{label}</p>
    </div>
  );
}

export function EditorToolbar({ onSave, onExport, onClose, onToggleHatch, busy }: Props) {
  const tool       = useEditorStore(s => s.tool);
  const lineStyle  = useEditorStore(s => s.lineStyle);
  const lineEnd    = useEditorStore(s => s.lineEnd);
  const leaderCurve = useEditorStore(s => s.leaderCurve);
  const showGrid   = useEditorStore(s => s.showGrid);
  const showMarginGuide = useEditorStore(s => s.showMarginGuide);
  const setTool    = useEditorStore(s => s.setTool);
  const setLineStyle = useEditorStore(s => s.setLineStyle);
  const setLineEnd = useEditorStore(s => s.setLineEnd);
  const setLeaderCurve = useEditorStore(s => s.setLeaderCurve);
  const toggleGrid = useEditorStore(s => s.toggleGrid);
  const toggleMarginGuide = useEditorStore(s => s.toggleMarginGuide);

  return (
    <div className="border-b border-ck-border bg-ck-bg shrink-0">
      <div className="flex items-end gap-0 px-2 py-1.5 overflow-x-auto scroll-thin">

        {/* 그룹: 그리기 도구 */}
        <Group label="그리기 도구">
          {DRAW_TOOLS.map(t => (
            <ToolBtn key={t.mode} active={tool === t.mode} onClick={() => setTool(t.mode)} title={t.label}>
              {t.icon}
              <span style={{ fontSize: 9 }}>{t.label}</span>
            </ToolBtn>
          ))}
        </Group>

        <Divider />

        {/* 그룹: 선 스타일 */}
        <Group label="선 스타일">
          {LINE_STYLES.map(s => (
            <OptBtn key={s.v} active={lineStyle === s.v} onClick={() => setLineStyle(s.v)} title={s.label}>
              <span className="font-mono">{s.label}</span>
            </OptBtn>
          ))}
        </Group>

        <Divider />

        {/* 그룹: 끝 모양 */}
        <Group label="끝 모양">
          {LINE_ENDS.map(e => (
            <OptBtn key={e.v} active={lineEnd === e.v} onClick={() => setLineEnd(e.v)} title={e.title}>
              {e.label}
            </OptBtn>
          ))}
        </Group>

        <Divider />

        {/* 그룹: 연결선 */}
        <Group label="연결선">
          {LEADER_CURVES.map(c => (
            <OptBtn key={c.v} active={leaderCurve === c.v} onClick={() => setLeaderCurve(c.v)} title={c.title}>
              {c.label}
            </OptBtn>
          ))}
        </Group>

        <Divider />

        {/* 그룹: 보기 */}
        <Group label="보기">
          <OptBtn active={false} onClick={onToggleHatch} title="선택 도형에 사선 채우기">
            <PaintBucket size={13} />
            <span className="ml-1 text-xs2">사선 채우기</span>
          </OptBtn>
          <OptBtn active={showGrid} onClick={toggleGrid} title="격자 표시">
            <Grid3x3 size={13} />
            <span className="ml-1 text-xs2">격자</span>
          </OptBtn>
          <OptBtn active={showMarginGuide} onClick={toggleMarginGuide} title="여백 표시">
            <Frame size={13} />
            <span className="ml-1 text-xs2">여백</span>
          </OptBtn>
        </Group>

        {/* 우측 작업 버튼 (flex-1로 밀기) */}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 pb-0.5">
          <button type="button" onClick={onSave} title="저장"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded bg-white text-sm2 text-gray-700 hover:bg-ck-bg">
            <Save size={13} /> 저장
          </button>
          <button type="button" onClick={onExport} disabled={busy} title="PNG로 내보내기"
            className="btn-primary btn-xs">
            <Download size={13} />
            <span>{busy ? '처리 중…' : '내보내기'}</span>
          </button>
          <button type="button" onClick={onClose} title="편집 종료"
            className="btn-outline btn-xs">
            <X size={13} /> 종료
          </button>
        </div>
      </div>
    </div>
  );
}
