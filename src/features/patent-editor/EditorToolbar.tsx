// EditorToolbar — 특허 도면 편집기 리본 툴바 (상용 수준)
// 그룹: 기본도구 | 지시선/부호 | 도형 | 선 스타일 | 선 굵기 | 끝단 | 연결선 | 채우기 | 지우기 | 보기 | 작업
import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Brush, Circle, CircleDot, Download, Eraser,
  Frame, Grid3x3, Minus, MousePointer2,
  Save, Slash, Spline, Square, Triangle, X, Diamond,
  ChevronDown,
} from "lucide-react";
import { useEditorStore } from "./useEditorStore";
import type { LineEnd, LineStyle, LineWeight } from "./types";

interface Props {
  onSave: () => void;
  onExport: () => void;
  onClose: () => void;
  onToggleHatch: () => void;
  busy?: boolean;
  standalone?: boolean;
  // B-4: 트레이스
  showUnderlayer: boolean;
  underlayerOpacity: number;
  onToggleUnderlayer: () => void;
  onUnderlayerOpacity: (v: number) => void;
  // B-5: 정렬
  onAlign: (dir: 'left'|'right'|'top'|'bottom'|'centerH'|'centerV') => void;
  // B-6: 도면 번호
  onInsertDrawingTitle?: () => void;
  // B-8: 해상도
  exportScale: 1|2|3|4;
  onExportScale: (v: 1|2|3|4) => void;
}

// ── 공통 버튼 크기: 모든 버튼 h-8 기준 ────────────────────
const BTN_BASE = "inline-flex flex-col items-center justify-center gap-0.5 h-8 px-2 rounded-md border transition-all active:scale-[0.97] text-xs2";
const BTN_ACTIVE = "border-blue-500 bg-blue-50 text-blue-700";
const BTN_INACTIVE = "border-transparent text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-800";
const BTN_OPT = "inline-flex items-center justify-center h-8 px-2 rounded-md border transition-all text-xs2 font-mono";
const DIVIDER = "w-px self-stretch bg-zinc-200 mx-1.5";

function ToolBtn({ active, onClick, title, icon, label, disabled, badge }: {
  active?: boolean; onClick: () => void; title: string;
  icon: ReactNode; label: string; disabled?: boolean; badge?: string;
}) {
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      className={`${BTN_BASE} ${active ? BTN_ACTIVE : BTN_INACTIVE} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} relative`}>
      <span className="relative">
        {icon}
        {badge && <span className="absolute -top-1 -right-1.5 text-xs2 bg-amber-400 text-white rounded-full w-3 h-3 flex items-center justify-center" style={{ fontSize: 7 }}>{badge}</span>}
      </span>
      <span className="leading-none whitespace-nowrap" style={{ fontSize: 9 }}>{label}</span>
    </button>
  );
}

function OptBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`${BTN_OPT} ${active ? BTN_ACTIVE : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'}`}>
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start shrink-0">
      <div className="flex items-center gap-0.5 h-8">{children}</div>
      <p className="text-center w-full text-gray-400 mt-0.5 px-1 truncate" style={{ fontSize: 8 }}>{label}</p>
    </div>
  );
}

// ── 더보기 드롭다운 — Portal 방식 (툴바 overflow-x:auto 클리핑 우회) ───
function MoreBtn({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(p => !p);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      // 버튼 클릭은 handleOpen이 처리
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative">
      <button type="button" ref={btnRef} onClick={handleOpen}
        className={`${BTN_BASE} ${open ? BTN_ACTIVE : BTN_INACTIVE} w-7`}
        title={label}>
        <ChevronDown size={10} />
        <span style={{ fontSize: 8 }}>더보기</span>
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-ck-border rounded-lg shadow-lg p-2 min-w-[150px]"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setOpen(false)}>
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

function MoreItem({ icon, label, onClick, disabled }: {
  icon: ReactNode; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm2 text-left transition-colors
        ${disabled ? 'opacity-40 cursor-not-allowed text-gray-400' : 'hover:bg-blue-50 text-gray-700 hover:text-blue-700'}`}>
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
      {disabled && <span className="ml-auto text-xs2 text-gray-300">(준비중)</span>}
    </button>
  );
}

// ── 데이터 정의 ────────────────────────────────────────────

// 선 스타일 시각화 (특허 도면 KS 규격)
const LINE_STYLES: { v: LineStyle; svg: string; label: string }[] = [
  { v: 'solid',            svg: 'M2,8 L26,8',                                    label: '실선' },
  { v: 'dashed',           svg: 'M2,8 L8,8 M12,8 L18,8 M22,8 L26,8',            label: '파선' },
  { v: 'dash-dot',         svg: 'M2,8 L9,8 M12,8 L13.5,8 M16,8 L23,8 M26,8 L27.5,8', label: '1점쇄' },
  { v: 'dash-double-dot',  svg: 'M2,8 L8,8 M11,8 L12.5,8 M15,8 L16.5,8 M19,8 L25,8', label: '2점쇄' },
  { v: 'dotted',           svg: 'M2,8 L3,8 M6,8 L7,8 M10,8 L11,8 M14,8 L15,8 M18,8 L19,8 M22,8 L23,8 M26,8 L27,8', label: '점선' },
];

// 선 굵기
const LINE_WEIGHTS: { v: LineWeight; sw: number; label: string }[] = [
  { v: 'thin',   sw: 0.5, label: '가는' },
  { v: 'normal', sw: 1.5, label: '보통' },
  { v: 'thick',  sw: 3,   label: '굵은' },
];

// 끝단
const LINE_ENDS: { v: LineEnd; label: string; title: string }[] = [
  { v: 'plain',       label: '—',   title: '끝단 없음' },
  { v: 'dot',         label: '●',   title: '점' },
  { v: 'arrow',       label: '→',   title: '속이 찬 화살표' },
  { v: 'open-arrow',  label: '▷',   title: '속이 빈 화살표' },
];

export function EditorToolbar({
  onSave, onExport, onClose, onToggleHatch, busy, standalone,
  showUnderlayer, underlayerOpacity, onToggleUnderlayer, onUnderlayerOpacity,
  onAlign, onInsertDrawingTitle,
  exportScale, onExportScale,
}: Props) {
  const tool          = useEditorStore(s => s.tool);
  const lineStyle     = useEditorStore(s => s.lineStyle);
  const lineWeight    = useEditorStore(s => s.lineWeight);
  const lineEnd       = useEditorStore(s => s.lineEnd);
  const leaderCurve   = useEditorStore(s => s.leaderCurve);
  const fillStyle     = useEditorStore(s => s.fillStyle);
  const showGrid      = useEditorStore(s => s.showGrid);
  const showMarginGuide = useEditorStore(s => s.showMarginGuide);
  const setTool       = useEditorStore(s => s.setTool);
  const setLineStyle  = useEditorStore(s => s.setLineStyle);
  const setLineWeight = useEditorStore(s => s.setLineWeight);
  const setLineEnd    = useEditorStore(s => s.setLineEnd);
  const setLeaderCurve = useEditorStore(s => s.setLeaderCurve);
  const setFillStyle  = useEditorStore(s => s.setFillStyle);
  const toggleGrid    = useEditorStore(s => s.toggleGrid);
  const toggleMarginGuide = useEditorStore(s => s.toggleMarginGuide);

  return (
    <div className="border-b border-ck-border bg-ck-bg shrink-0 overflow-x-auto scroll-thin">
      <div className="flex items-end gap-0 px-2 py-1 min-w-max">

        {/* ── 기본 도구 ── */}
        <Group label="기본 도구">
          <ToolBtn active={tool === 'select'} onClick={() => setTool('select')}
            title="선택 (V)" icon={<MousePointer2 size={14} />} label="선택" />
        </Group>
        <div className={DIVIDER} />

        {/* ── 지시선 / 부호 ── */}
        <Group label="지시선 · 부호">
          <ToolBtn active={tool === 'line'} onClick={() => setTool('line')}
            title="선/지시선 (L)" icon={<Slash size={14} />} label="지시선" />
          <ToolBtn active={tool === 'text'} onClick={() => setTool('text')}
            title="참조번호 달기 (T)" icon={<span className="font-bold text-sm">A</span>} label="번호달기" />
          <ToolBtn active={tool === 'ref-circle'} onClick={() => setTool('ref-circle')}
            title="원형 부호 달기 (C)" icon={<CircleDot size={14} />} label="원형번호" />
          {/* B-2: 치수선 */}
          <ToolBtn active={tool === 'dimension'} onClick={() => setTool('dimension')}
            title="치수선 (D)"
            icon={<svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.3">
              <line x1="1" y1="7" x2="15" y2="7"/>
              <polyline points="3,4 1,7 3,10"/>
              <polyline points="13,4 15,7 13,10"/>
              <line x1="1" y1="3" x2="1" y2="11"/>
              <line x1="15" y1="3" x2="15" y2="11"/>
            </svg>}
            label="치수선" />
        </Group>
        <div className={DIVIDER} />

        {/* ── 도형 ── */}
        <Group label="도형">
          {/* B-3: 텍스트 단독 */}
          <ToolBtn active={tool === 'standalone-text'} onClick={() => setTool('standalone-text')}
            title="텍스트 단독 삽입 (T키)" icon={<span className="font-serif font-bold text-base leading-none">T</span>} label="텍스트" />
          <ToolBtn active={tool === 'rect'} onClick={() => setTool('rect')}
            title="사각형 (R)" icon={<Square size={14} />} label="사각형" />
          <ToolBtn active={tool === 'circle'} onClick={() => setTool('circle')}
            title="원/타원 (O)" icon={<Circle size={14} />} label="원" />
          <ToolBtn active={tool === 'triangle'} onClick={() => setTool('triangle')}
            title="삼각형" icon={<Triangle size={14} />} label="삼각형" />
          <ToolBtn active={tool === 'diamond'} onClick={() => setTool('diamond')}
            title="마름모" icon={<Diamond size={14} />} label="마름모" />
          <MoreBtn label="도형 더보기">
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="7,1 13,13 1,13"/></svg>} label="삼각형" onClick={() => setTool('triangle')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="7,1 13,7 7,13 1,7"/></svg>} label="마름모" onClick={() => setTool('diamond')} />
            {/* B-1: 활성화된 도형들 */}
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="7,1 13,4 13,10 7,13 1,10 1,4"/></svg>} label="육각형" onClick={() => setTool('hexagon')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" stroke="none"><path d="M1,6 H8 M8,3 L13,7 L8,11 Z"/></svg>} label="화살표 도형" onClick={() => setTool('arrow-shape')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="1,13 4,7 7,10 10,4 13,8"/></svg>} label="자유 폴리라인" onClick={() => setTool('polygon')} />
          </MoreBtn>
        </Group>
        <div className={DIVIDER} />

        {/* ── 선 스타일 ── */}
        <Group label="선 스타일">
          {LINE_STYLES.slice(0, 4).map(s => (
            <OptBtn key={s.v} active={lineStyle === s.v} onClick={() => setLineStyle(s.v)} title={s.label}>
              <svg width="28" height="16" viewBox="0 0 28 16">
                <path d={s.svg} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </OptBtn>
          ))}
          <MoreBtn label="선 더보기">
            {LINE_STYLES.map(s => (
              <MoreItem key={s.v}
                icon={<svg width="28" height="14" viewBox="0 0 28 14"><path d={s.svg} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                label={s.label}
                onClick={() => setLineStyle(s.v)} />
            ))}
          </MoreBtn>
        </Group>
        <div className={DIVIDER} />

        {/* ── 선 굵기 ── */}
        <Group label="선 굵기">
          {LINE_WEIGHTS.map(w => (
            <OptBtn key={w.v} active={lineWeight === w.v} onClick={() => setLineWeight(w.v)} title={w.label}>
              <svg width="22" height="16" viewBox="0 0 22 16">
                <line x1="2" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth={w.sw} strokeLinecap="round"/>
              </svg>
            </OptBtn>
          ))}
        </Group>
        <div className={DIVIDER} />

        {/* ── 끝단 ── */}
        <Group label="끝단">
          {LINE_ENDS.map(e => (
            <OptBtn key={e.v} active={lineEnd === e.v} onClick={() => setLineEnd(e.v)} title={e.title}>
              <span className="text-sm2">{e.label}</span>
            </OptBtn>
          ))}
        </Group>
        <div className={DIVIDER} />

        {/* ── 연결선 모양 ── */}
        <Group label="연결선">
          <OptBtn active={leaderCurve === 'straight'} onClick={() => setLeaderCurve('straight')} title="직선 지시선">
            <Minus size={13} />
            <span className="ml-1 text-xs2">직선</span>
          </OptBtn>
          <OptBtn active={leaderCurve === 's-curve'} onClick={() => setLeaderCurve('s-curve')} title="S자 곡선 지시선">
            <Spline size={13} />
            <span className="ml-1 text-xs2">S자</span>
          </OptBtn>
          {/* B-7: 꺾인 지시선 */}
          <OptBtn active={leaderCurve === 'elbow'} onClick={() => setLeaderCurve('elbow')} title="꺾인 지시선 (L자)">
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M4,13 L4,4 L18,4"/>
              <polygon points="2,14 4,11 6,14" fill="currentColor" stroke="none"/>
            </svg>
            <span className="ml-1 text-xs2">꺾임</span>
          </OptBtn>
        </Group>
        <div className={DIVIDER} />

        {/* ── 채우기 ── */}
        <Group label="채우기">
          <OptBtn active={fillStyle === 'none'} onClick={() => setFillStyle('none')} title="채우기 없음">
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="2" y1="14" x2="14" y2="2" stroke="#ef4444" strokeWidth="1" strokeLinecap="round"/></svg>
          </OptBtn>
          <OptBtn active={fillStyle === 'hatch'} onClick={() => { setFillStyle('hatch'); onToggleHatch(); }} title="사선 채우기 (특허 규격)">
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1"/>{[...Array(6)].map((_,i)=><line key={i} x1={2+i*2-2} y1={14} x2={2+i*2+8} y2={2} stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>)}</svg>
          </OptBtn>
          <OptBtn active={fillStyle === 'cross-hatch'} onClick={() => setFillStyle('cross-hatch')} title="격자 채우기">
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1"/>{[...Array(4)].map((_,i)=><g key={i}><line x1={2} y1={2+i*4} x2={14} y2={2+i*4+4} stroke="currentColor" strokeWidth="0.7"/><line x1={2+i*4} y1={2} x2={2+i*4+4} y2={14} stroke="currentColor" strokeWidth="0.7"/></g>)}</svg>
          </OptBtn>
        </Group>
        <div className={DIVIDER} />

        {/* ── 지우기 ── */}
        <Group label="지우기">
          <ToolBtn active={tool === 'marquee-eraser'} onClick={() => setTool('marquee-eraser')}
            title="영역 지우기 — 드래그로 흰색 마스크" icon={<Eraser size={14} />} label="영역" />
          <ToolBtn active={tool === 'brush-eraser'} onClick={() => setTool('brush-eraser')}
            title="브러시 지우기 — 자유 드로잉" icon={<Brush size={14} />} label="브러시" />
        </Group>
        <div className={DIVIDER} />

        {/* ── 보기 ── */}
        <Group label="보기">
          <OptBtn active={showGrid} onClick={toggleGrid} title="격자 표시/숨김 (내보내기 미포함)">
            <Grid3x3 size={13} />
            <span className="ml-1 text-xs2">격자</span>
          </OptBtn>
          <OptBtn active={showMarginGuide} onClick={toggleMarginGuide} title="여백 가이드 표시/숨김">
            <Frame size={13} />
            <span className="ml-1 text-xs2">여백</span>
          </OptBtn>
          {/* B-4: 트레이스 */}
          <OptBtn active={showUnderlayer} onClick={onToggleUnderlayer} title="원본 이미지 트레이스 모드">
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="2" y="2" width="12" height="10" rx="1" opacity="0.35" fill="currentColor"/>
              <path d="M2,10 L5,7 L8,9 L11,6 L14,9" strokeWidth="1.6"/>
            </svg>
            <span className="ml-1 text-xs2">트레이스</span>
          </OptBtn>
          {showUnderlayer && (
            <div className="flex items-center gap-1 h-8 ml-1">
              <input type="range" min={10} max={70} step={5}
                value={underlayerOpacity}
                onChange={e => onUnderlayerOpacity(Number(e.target.value))}
                className="w-16 accent-blue-600" style={{ height: 4 }} />
              <span className="text-xs2 text-zinc-400 w-7">{underlayerOpacity}%</span>
            </div>
          )}
          {/* B-6: 도면 번호 */}
          <MoreBtn label="보기 더보기">
            <MoreItem
              icon={<svg width="14" height="14" viewBox="0 0 14 14"><text x="1" y="11" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">도1</text></svg>}
              label="도면 번호 삽입 (도 N)"
              onClick={() => onInsertDrawingTitle?.()}
            />
          </MoreBtn>
        </Group>

        {/* B-5: 정렬 */}
        <div className={DIVIDER} />
        <Group label="정렬">
          <MoreBtn label="정렬">
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="2" x2="2" y2="12"/><rect x="4" y="4" width="4" height="3" rx="0.5"/><rect x="4" y="8" width="6" height="3" rx="0.5"/></svg>}
              label="왼쪽 정렬" onClick={() => onAlign('left')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="2" x2="12" y2="12"/><rect x="6" y="4" width="4" height="3" rx="0.5"/><rect x="4" y="8" width="6" height="3" rx="0.5"/></svg>}
              label="오른쪽 정렬" onClick={() => onAlign('right')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="2" x2="12" y2="2"/><rect x="3" y="4" width="3" height="4" rx="0.5"/><rect x="7" y="4" width="3" height="6" rx="0.5"/></svg>}
              label="위쪽 정렬" onClick={() => onAlign('top')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="12" x2="12" y2="12"/><rect x="3" y="4" width="3" height="4" rx="0.5"/><rect x="7" y="2" width="3" height="6" rx="0.5"/></svg>}
              label="아래쪽 정렬" onClick={() => onAlign('bottom')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="7" y1="2" x2="7" y2="12"/><rect x="4" y="4" width="6" height="3" rx="0.5"/><rect x="3" y="8" width="8" height="3" rx="0.5"/></svg>}
              label="수평 중앙 정렬" onClick={() => onAlign('centerH')} />
            <MoreItem icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="7" x2="12" y2="7"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="3" width="3" height="8" rx="0.5"/></svg>}
              label="수직 중앙 정렬" onClick={() => onAlign('centerV')} />
          </MoreBtn>
        </Group>

        {/* ── 작업 (우측 정렬) ── */}
        <div className="flex-1 min-w-[16px]" />
        <div className="flex items-center gap-1.5 pb-4">
          <button type="button" onClick={onSave} title="저장 (Ctrl+S)"
            className="inline-flex items-center gap-1.5 h-8 px-3 border border-zinc-300 rounded-md bg-white text-sm2 text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all">
            <Save size={13} />
            <span>저장</span>
          </button>
          {/* B-8: 해상도 선택 */}
          <select value={exportScale} onChange={e => onExportScale(Number(e.target.value) as 1|2|3|4)}
            className="h-8 border border-zinc-300 rounded px-1.5 text-xs2 bg-white text-zinc-600" title="내보내기 해상도">
            <option value={1}>×1 · 화면</option>
            <option value={2}>×2 · 144dpi</option>
            <option value={3}>×3 · 216dpi</option>
            <option value={4}>×4 · 288dpi</option>
          </select>
          <button type="button" onClick={onExport} disabled={busy}
            title="PNG 내보내기"
            className="inline-flex items-center gap-1.5 h-8 px-3 border border-blue-600 rounded-md bg-blue-600 text-sm2 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all">
            <Download size={13} />
            <span>{busy ? '처리 중…' : '내보내기'}</span>
          </button>
          {!standalone && (
            <button type="button" onClick={onClose} title="편집 종료"
              className="inline-flex items-center gap-1.5 h-8 px-3 border border-zinc-300 rounded-md bg-white text-sm2 text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all">
              <X size={13} />
              <span>종료</span>
            </button>
          )}
          {/* B-9: 단축키 도움말 */}
          <div className={DIVIDER} />
          <ShortcutHelpBtn />
        </div>
      </div>
    </div>
  );
}

// B-9: 단축키 도움말 버튼
function ShortcutHelpBtn() {
  const [open, setOpen] = useState(false);
  const SHORTCUTS = [
    ['V', '선택'],      ['L', '지시선'],
    ['T', '텍스트'],    ['R', '사각형'],
    ['O', '원'],        ['P', '폴리라인'],
    ['D', '치수선'],    ['E', '지우기'],
    ['G', '그리드'],    ['Esc', '선택해제'],
    ['Ctrl+C', '복사'], ['Ctrl+V', '붙여넣기'],
    ['Delete', '삭제'], ['Ctrl+A', '전체선택'],
    ['Ctrl+Z', '취소'], ['Ctrl+Y', '다시실행'],
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`${BTN_BASE} w-7 ${open ? BTN_ACTIVE : BTN_INACTIVE}`}
        title="단축키 도움말">
        <span className="text-sm font-bold">?</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 p-3 w-56"
          onMouseLeave={() => setOpen(false)}>
          <p className="text-xs2 font-bold text-zinc-600 mb-2">단축키</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-300 rounded text-xs2 font-mono shrink-0">{k}</kbd>
                <span className="text-xs2 text-zinc-500">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
