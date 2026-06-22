// DrawingEditorModal — 3단계 (영역 확인 → 스타일 변환 → 도면 편집)
// 모든 단계가 하나의 UI 안에서 연속적으로 진행됨
import React, { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { Icon } from '../../components/Icon';
import { PatentEditor } from '../patent-editor';
import { onEditorResult, writeEditorResult } from './editorChannel';
import type { DrawingItem, CadCandidate } from './types';
import type { EditorReference, PatentDrawing, InventionComponent } from '../patent-editor';
import { Button } from '@muhayu/axp-ui';

// availableReferences(구성요소)를 InventionComponent 형식으로 변환
function refsToComponents(refs: EditorReference[]): InventionComponent[] {
  return refs.map(r => ({ number: r.number, name: r.name ?? '' })).filter(c => c.name);
}

interface Props {
  drawings: DrawingItem[];
  initialDrawingId: string;
  availableReferences?: EditorReference[];
  onSave: (drawingId: string, updates: Partial<DrawingItem>) => void;
  onClose: () => void;
  standalone?: boolean;
}

// 내부 작업 단계 (converting은 스타일 변환 단계 내 로딩 상태)
type WorkStage = 'crop' | 'reselect' | 'converting' | 'decide' | 'editing';

// 사용자에게 보이는 3단계
const STEP_LABELS = ['영역 확인', '스타일 변환', '도면 편집'];

const LABEL_COLORS: Record<string, string> = {
  '제안기술': 'bg-blue-100 text-blue-700',
  '종래기술': 'bg-gray-100 text-gray-600',
  'AI생성':   'bg-violet-100 text-violet-700',
};

const WORK_STAGE_BADGE: Record<string, { text: string; cls: string }> = {
  'crop':       { text: '영역 확인',  cls: 'bg-amber-100 text-amber-700' },
  'reselect':   { text: '영역 확인',  cls: 'bg-amber-100 text-amber-700' },
  'converting': { text: '변환 중',    cls: 'bg-violet-100 text-violet-700' },
  'decide':     { text: '후보 선택',  cls: 'bg-orange-100 text-orange-700' },
  'editing':    { text: '편집 중',    cls: 'bg-sky-100 text-sky-700' },
};

const MOCK_SVGS = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="10" y="10" width="180" height="130" fill="none" stroke="#333" stroke-width="1.5"/><line x1="100" y1="10" x2="100" y2="140" stroke="#999" stroke-width="0.5" stroke-dasharray="4,3"/><rect x="30" y="30" width="60" height="90" fill="none" stroke="#333" stroke-width="1"/><rect x="110" y="30" width="60" height="90" fill="none" stroke="#333" stroke-width="1"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="10" y="10" width="180" height="130" fill="none" stroke="#333" stroke-width="2"/><circle cx="100" cy="75" r="40" fill="none" stroke="#333" stroke-width="1.2"/><line x1="10" y1="75" x2="190" y2="75" stroke="#aaa" stroke-width="0.5" stroke-dasharray="4,3"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="20" y="20" width="160" height="110" fill="none" stroke="#222" stroke-width="1.5" rx="4"/><rect x="40" y="40" width="50" height="70" fill="none" stroke="#555" stroke-width="1"/><rect x="110" y="40" width="50" height="70" fill="none" stroke="#555" stroke-width="1"/><line x1="90" y1="75" x2="110" y2="75" stroke="#333" stroke-width="1"/></svg>`,
];

export function DrawingEditorModal({ drawings, initialDrawingId, availableReferences, onSave, onClose, standalone = false }: Props) {
  const [activeId, setActiveId] = useState(initialDrawingId);
  const [localDrawings, setLocalDrawings] = useState(drawings);
  const [workStageMap, setWorkStageMap] = useState<Record<string, WorkStage>>(() => {
    const m: Record<string, WorkStage> = {};
    drawings.forEach(d => {
      if (d.stage === 'done' || d.stage === 'editing') m[d.id] = 'editing';
      else if (d.stage === 'candidate-select') m[d.id] = 'decide';
      else m[d.id] = 'crop';
    });
    return m;
  });
  const [candidatesMap, setCandidatesMap] = useState<Record<string, CadCandidate[]>>({});
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  // 도면 부호 목록 — availableReferences(구성요소)로 초기화, 편집 중 변경 가능
  const [localRefs, setLocalRefs] = useState<EditorReference[]>(() => availableReferences ?? []);
  const [zoomedCandId, setZoomedCandId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [showRegen, setShowRegen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  // B-box 상태 — 도면별 독립 관리 (퍼센트, 0~100)
  const [cropBoxMap, setCropBoxMap] = useState<Record<string, {x1:number; y1:number; x2:number; y2:number}>>(() => {
    const m: Record<string, {x1:number; y1:number; x2:number; y2:number}> = {};
    drawings.forEach(d => { m[d.id] = { x1: 15, y1: 15, x2: 85, y2: 85 }; });
    return m;
  });
  const cropBox = cropBoxMap[activeId] ?? { x1: 15, y1: 15, x2: 85, y2: 85 };
  const cropContainerRef = React.useRef<HTMLDivElement>(null);
  type CropHandle = 'move'|'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
  const cropDragRef = React.useRef<{ type: CropHandle; startX: number; startY: number; startBox: { x1:number; y1:number; x2:number; y2:number }; } | null>(null);

  const startCropDrag = (type: CropHandle, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropContainerRef.current) return;
    cropDragRef.current = { type, startX: e.clientX, startY: e.clientY, startBox: { ...cropBox } };

    const onMove = (ev: MouseEvent) => {
      const d = cropDragRef.current;
      const c = cropContainerRef.current;
      if (!d || !c) return;
      const r = c.getBoundingClientRect();
      const dx = ((ev.clientX - d.startX) / r.width) * 100;
      const dy = ((ev.clientY - d.startY) / r.height) * 100;
      const b = d.startBox;
      const M = 10; // 최소 크기 %
      let x1=b.x1, y1=b.y1, x2=b.x2, y2=b.y2;
      if (d.type === 'move') { x1=b.x1+dx; y1=b.y1+dy; x2=b.x2+dx; y2=b.y2+dy; }
      else {
        if (d.type.includes('w')) x1 = Math.min(b.x1+dx, b.x2-M);
        if (d.type.includes('e')) x2 = Math.max(b.x2+dx, b.x1+M);
        if (d.type.includes('n')) y1 = Math.min(b.y1+dy, b.y2-M);
        if (d.type.includes('s')) y2 = Math.max(b.y2+dy, b.y1+M);
      }
      x1=Math.max(0,Math.min(x1,100)); y1=Math.max(0,Math.min(y1,100));
      x2=Math.max(0,Math.min(x2,100)); y2=Math.max(0,Math.min(y2,100));
      setCropBoxMap(m => ({ ...m, [activeId]: { x1, y1, x2, y2 } }));
    };
    const onUp = () => {
      cropDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const [isRepresentative, setIsRepresentative] = useState(() =>
    drawings.find(d => d.id === initialDrawingId)?.isRepresentative ?? false
  );

  // 도면 전환 시 UI 상태 초기화
  useEffect(() => {
    setEditingName(false);
    setNameDraft('');
    setZoomedCandId(null);
    setShowRegen(false);
    setRegenPrompt('');
    setIsRepresentative(drawings.find(d => d.id === activeId)?.isRepresentative ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // 메인 탭: 편집기 탭 결과 수신
  useEffect(() => {
    const off = onEditorResult((result) => {
      onSave(result.drawingId, {
        stage: result.stage,
        savedEditorJson: result.editorJson,
        exportedImageUrl: result.exportedImageUrl,
      });
      if (result.stage === 'done') {
        setSyncNotice('도면 편집 완료 — 결과가 반영되었습니다.');
        setTimeout(() => setSyncNotice(null), 4000);
      }
    });
    return off;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDraw = localDrawings.find(d => d.id === activeId);
  const workStage = workStageMap[activeId] || 'crop';

  // 메타데이터(명칭/분류/캡션) 편집 — 내부 상태 갱신 + 부모로 전파
  const handleSave = (id: string, updates: Partial<DrawingItem>) => {
    setLocalDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    onSave(id, updates);
  };

  const goStage = useCallback((s: WorkStage) => {
    setWorkStageMap(m => ({ ...m, [activeId]: s }));
  }, [activeId]);

  // 스타일 변환 실행 — bbox 조정 내용 저장 후 변환 시작
  const startConvert = () => {
    // ① adjustedBbox 저장 (퍼센트 → 픽셀 변환)
    const activeDraw = drawings.find(d => d.id === activeId);
    const imgW = activeDraw?.imageSize?.w ?? 800;
    const imgH = activeDraw?.imageSize?.h ?? 600;
    const adjustedBbox = {
      x: Math.round(cropBox.x1 / 100 * imgW),
      y: Math.round(cropBox.y1 / 100 * imgH),
      w: Math.round((cropBox.x2 - cropBox.x1) / 100 * imgW),
      h: Math.round((cropBox.y2 - cropBox.y1) / 100 * imgH),
    };
    handleSave(activeId, { adjustedBbox, stage: 'bbox-adjusted' });

    // ② 변환 시작
    goStage('converting');
    setTimeout(() => {
      const cands = MOCK_SVGS.map((svg, i) => ({
        id: `c-${activeId}-${i}`,
        svgDataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      }));
      setCandidatesMap(m => ({ ...m, [activeId]: cands }));
      setSelectedMap(m => ({ ...m, [activeId]: cands[0].id }));
      goStage('decide');
    }, 1800);
  };

  const doRegen = () => {
    setShowRegen(false);
    setRegenPrompt('');
    goStage('converting');
    setTimeout(() => {
      const cands = MOCK_SVGS.map((svg, i) => ({
        id: `r-${activeId}-${i}`,
        svgDataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      }));
      setCandidatesMap(m => ({ ...m, [activeId]: cands }));
      setSelectedMap(m => ({ ...m, [activeId]: cands[0].id }));
      goStage('decide');
    }, 1500);
  };

  // 버전 확정 → 도면 편집 단계로 직접 이동
  const confirmVersion = () => {
    const selId = selectedMap[activeId];
    if (!selId) return;
    handleSave(activeId, { stage: 'editing', selectedCandidateId: selId });
    goStage('editing');
  };

  // PatentEditor용 데이터
  const patentDrawings: PatentDrawing[] = drawings
    .filter(d => workStageMap[d.id] === 'editing' || d.stage === 'done')
    .map(d => {
      const cands = candidatesMap[d.id] || d.cadCandidates || [];
      const selId = selectedMap[d.id] || d.selectedCandidateId;
      const selCand = cands.find(c => c.id === selId) || cands[0];
      return {
        id: d.id,
        caption: `${d.symbol}. ${d.name}`,
        description: d.description,
        sourceImageUrl: selCand?.svgDataUrl || d.originalImageUrl || '',
        thumbnailUrl: d.exportedImageUrl,
        savedEditorDataJson: d.savedEditorJson,
      };
    });

  const candidates = candidatesMap[activeId] || [];
  const selCandId = selectedMap[activeId] ?? candidates[0]?.id;

  // 3단계 인덱스 매핑 (converting은 스타일 변환=1의 로딩 상태)
  const stepIdx =
    workStage === 'crop' || workStage === 'reselect' ? 0 :
    workStage === 'converting' || workStage === 'decide' ? 1 : 2;

  // Wrapper: standalone=풀스크린 / 모달=backdrop
  const Wrapper = standalone
    ? ({ children }: { children: React.ReactNode }) => (
        <div className="fixed inset-0 flex flex-col bg-white">{children}</div>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <>
          {syncNotice && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-green-600 text-white text-sm2 font-semibold px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-fade-up">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {syncNotice}
            </div>
          )}
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            {children}
          </div>
        </>
      );

  const innerStyle = standalone
    ? undefined
    : { width: '100%', maxWidth: 1020, height: 'min(640px, calc(100vh - 32px))' };

  return (
    <Wrapper>
      <div className={standalone
        ? 'flex flex-col w-full h-full bg-white overflow-hidden'
        : 'bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden w-full'}
        style={innerStyle}>

        {/* ── 공통 헤더 (모든 단계에서 유지) ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ck-border bg-white shrink-0">
          <Icon name="image" size={15} className="text-blue-700 shrink-0" />
          <span className="text-base2 font-bold text-gray-800">도면 편집기</span>
          {activeDraw && (
            <>
              <span className="text-gray-300 mx-0.5">·</span>
              {editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={() => {
                    const v = nameDraft.trim();
                    if (v && v !== activeDraw.name) handleSave(activeId, { name: v });
                    setEditingName(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="text-sm2 text-gray-700 font-semibold bg-white border border-blue-400 rounded px-1.5 py-0.5 outline-none max-w-[200px]"
                />
              ) : (
                <button
                  onClick={() => { setNameDraft(activeDraw.name); setEditingName(true); }}
                  className="flex items-center gap-1 text-sm2 text-gray-700 hover:text-blue-700 truncate max-w-[140px] group"
                  title="클릭하여 도면 명칭 편집"
                >
                  {activeDraw.name}
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="9" height="9" className="opacity-0 group-hover:opacity-60 shrink-0">
                    <path d="M6.5 1.5l2 2L3 9H1V7z"/>
                  </svg>
                </button>
              )}
              <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium shrink-0', LABEL_COLORS[activeDraw.label] || 'bg-gray-100 text-gray-600')}>
                {activeDraw.label}
              </span>
              {/* 대표도면 지정 (편집 단계에서만 표시) */}
              {workStage === 'editing' && (
                <button
                  onClick={() => {
                    const next = !isRepresentative;
                    setIsRepresentative(next);
                    handleSave(activeId, { isRepresentative: next });
                  }}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded border text-xs2 font-semibold transition-all shrink-0',
                    isRepresentative
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-400 hover:border-amber-400 hover:text-amber-600',
                  )}>
                  ★ {isRepresentative ? '대표도면' : '대표도면 지정'}
                </button>
              )}
            </>
          )}
          {/* standalone 모드에서는 StandaloneEditor의 ✕ 버튼이 담당 */}
          {!standalone && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outlined" color="primary" size="xs" onClick={onClose}>
                <Icon name="close" size={12} /> 닫기
              </Button>
            </div>
          )}
        </div>

        {/* ── 서브헤더: 단계 표시 (도면 편집 단계에서는 숨김 — 헤더에 이미 표시) ── */}
        {activeDraw && workStage !== 'editing' && (
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-ck-border bg-ck-bg shrink-0">
            <div className="flex items-center gap-1 ml-auto">
              {STEP_LABELS.map((label, i) => (
                <div key={i} className="flex items-center">
                  <div className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs2 font-medium transition-all',
                    i === stepIdx ? 'bg-blue-100 text-blue-700 font-semibold' :
                    i < stepIdx  ? 'text-green-600' : 'text-gray-400',
                  )}>
                    {i < stepIdx
                      ? <Icon name="check" size={9} />
                      : <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center shrink-0" style={{ fontSize: 8 }}>{i + 1}</span>}
                    <span>{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <span className={clsx('mx-1 text-xs2', i < stepIdx ? 'text-green-400' : 'text-gray-200')}>›</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 본문: 단계별 콘텐츠 ── */}
        <div className={clsx(
          'flex flex-1 overflow-hidden min-h-0',
          // 도면 편집 단계에서는 좌측 패널 없이 전체 너비 사용
          workStage !== 'editing' && 'flex',
        )}>
          {/* 좌: 도면 목록 패널 (모달/standalone 모든 모드에서 상시 표시) */}
          <aside className="w-36 border-r border-ck-border bg-ck-bg shrink-0 flex flex-col overflow-hidden">
              <div className="px-2.5 pt-2.5 pb-1.5 border-b border-ck-border shrink-0">
                <p className="text-xs2 font-semibold text-gray-500 uppercase tracking-wide">
                  도면 목록 <span className="font-normal text-gray-400">({localDrawings.length})</span>
                </p>
              </div>
              <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2 space-y-1.5">
                {localDrawings.map(d => {
                  const isActive = d.id === activeId;
                  const ws = workStageMap[d.id] || 'crop';
                  const statusBadge = d.stage === 'done'
                    ? { text: '편집 완료', cls: 'bg-green-100 text-green-700' }
                    : WORK_STAGE_BADGE[ws] ?? { text: '대기', cls: 'bg-gray-100 text-gray-500' };
                  return (
                    <div
                      key={d.id}
                      onClick={() => setActiveId(d.id)}
                      className={clsx(
                        'rounded-lg border p-1.5 transition-all cursor-pointer',
                        isActive ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-ck-border bg-white hover:border-blue-300 hover:bg-blue-50/40',
                      )}>
                      <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden mb-1">
                        {d.exportedImageUrl
                          ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                          : <Icon name="image" size={14} className="text-gray-300" />}
                      </div>
                      <p className="text-xs2 font-semibold text-gray-700 truncate">{d.name || '(명칭 없음)'}</p>
                      <div className="mt-1">
                        {isActive
                          ? <span className="text-[9px] px-1.5 py-px rounded-full bg-blue-600 text-white font-semibold">▶ 진행 중</span>
                          : <span className={clsx('text-[9px] px-1.5 py-px rounded-full font-semibold', statusBadge.cls)}>{statusBadge.text}</span>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

          {/* 우: 단계별 콘텐츠 */}
          <div className={clsx(
            'min-h-0 flex flex-col overflow-hidden',
            workStage === 'editing' ? 'flex-1' : 'flex-1',
          )}>

            {/* ── 단계 1: 영역 확인 (crop + reselect 통합 — bbox 편집 즉시 활성화) ── */}
            {(workStage === 'crop' || workStage === 'reselect') && activeDraw && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* 중앙: bbox 편집 UI (항상 표시) */}
                  <div className="flex-1 flex flex-col min-h-0 p-4 gap-2">
                    <p className="text-xs2 font-semibold text-gray-400 shrink-0">
                      수집된 도면 — 파란 박스를 드래그하여 변환 영역을 지정하세요
                    </p>
                    {/* bbox 편집 UI — crop/reselect 모두 동일 */}
                    <div
                      ref={cropContainerRef}
                      className="flex-1 bg-gray-100 rounded-lg border border-gray-200 relative overflow-hidden select-none"
                      style={{ cursor: 'default' }}
                    >
                      {/* 배경 이미지 또는 플레이스홀더 */}
                      {(activeDraw.originalImageUrl || activeDraw.exportedImageUrl)
                        ? <img src={activeDraw.originalImageUrl || activeDraw.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                        : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-2">
                            <Icon name="image" size={48} className="text-gray-200" />
                            <p className="text-sm2 font-semibold text-gray-400 text-center px-6">{activeDraw.description || activeDraw.name}</p>
                            <p className="text-xs2 text-gray-300 text-center px-6">실제 서비스에서는 직무발명서에서 추출된 도면 이미지가 표시됩니다</p>
                          </div>
                        )}
                      {/* 어두운 마스크 (bbox 밖) */}
                      <div className="absolute inset-0 bg-black/25 pointer-events-none" />
                      {/* bbox 편집 영역 */}
                      <div
                        className="absolute border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]"
                        style={{ left:`${cropBox.x1}%`, top:`${cropBox.y1}%`, width:`${cropBox.x2-cropBox.x1}%`, height:`${cropBox.y2-cropBox.y1}%`, cursor:'move' }}
                        onMouseDown={e => startCropDrag('move', e)}
                      >
                        <span className="absolute -top-6 left-0 text-xs2 text-white bg-blue-600 px-1.5 py-0.5 rounded font-semibold shadow whitespace-nowrap">
                          변환 영역 — 드래그하여 조정
                        </span>
                        {/* 8방향 핸들 */}
                        {(['nw','n','ne','e','se','s','sw','w'] as const).map(h => {
                          const pos: React.CSSProperties = {};
                          if (h.includes('n')) pos.top='-5px'; if (h.includes('s')) pos.bottom='-5px'; if (!h.includes('n')&&!h.includes('s')) pos.top='calc(50% - 5px)';
                          if (h.includes('w')) pos.left='-5px'; if (h.includes('e')) pos.right='-5px'; if (!h.includes('w')&&!h.includes('e')) pos.left='calc(50% - 5px)';
                          const cursors: Record<string,string> = {nw:'nw-resize',n:'n-resize',ne:'ne-resize',e:'e-resize',se:'se-resize',s:'s-resize',sw:'sw-resize',w:'w-resize'};
                          return <div key={h} className="absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm z-10 shadow-sm" style={{...pos, cursor: cursors[h]}} onMouseDown={e => { e.stopPropagation(); startCropDrag(h, e); }} />;
                        })}
                        {/* 영역 크기 표시 */}
                        <span className="absolute bottom-1 right-1 text-xs2 text-white/70 font-mono">
                          {Math.round(cropBox.x2-cropBox.x1)}% × {Math.round(cropBox.y2-cropBox.y1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* 우측: 캡션 */}
                  <div className="w-48 shrink-0 border-l border-ck-border bg-ck-bg flex flex-col overflow-y-auto scroll-thin p-3 gap-3">
                    <div>
                      <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wide mb-1.5">도면 정보</p>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs2 text-gray-400 block mb-0.5">명칭</span>
                          <input
                            value={activeDraw.name}
                            onChange={e => handleSave(activeId, { name: e.target.value })}
                            placeholder="도면 명칭"
                            className="w-full text-xs2 font-semibold text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400 transition-colors"
                          />
                        </div>
                        <div>
                          <span className="text-xs2 text-gray-400 block mb-0.5">분류</span>
                          <select
                            value={activeDraw.label}
                            onChange={e => handleSave(activeId, { label: e.target.value as DrawingItem['label'] })}
                            className={clsx('w-full text-xs2 font-medium rounded px-2 py-1 border-0 outline-none cursor-pointer', LABEL_COLORS[activeDraw.label] || 'bg-gray-100 text-gray-600')}
                          >
                            <option value="제안기술">제안기술</option>
                            <option value="종래기술">종래기술</option>
                            <option value="AI생성">AI생성</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wide mb-1.5">캡션</p>
                      <textarea
                        value={activeDraw.description}
                        onChange={e => handleSave(activeId, { description: e.target.value })}
                        placeholder="도면 캡션·설명"
                        rows={4}
                        className="w-full text-xs2 text-gray-600 leading-relaxed bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400 resize-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
                {/* 하단 버튼 */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-ck-border bg-white shrink-0">
                  <div className="flex items-center gap-2">
                    <Button variant="outlined" color="primary" size="sm" onClick={onClose}>취소</Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="sm"
                      onClick={() => setCropBoxMap(m => ({ ...m, [activeId]: { x1: 15, y1: 15, x2: 85, y2: 85 } }))}>
                      영역 초기화
                    </Button>
                  </div>
                  <Button variant="filled" color="primary" size="sm" className="flex items-center gap-1.5" onClick={startConvert}>
                    <Icon name="check" size={13} /> 영역 확인 완료 — 변환 시작
                  </Button>
                </div>
              </div>
            )}

            {/* ── 단계 2: 스타일 변환 (변환 중 / 후보 선택 통합) ── */}
            {(workStage === 'converting' || workStage === 'decide') && activeDraw && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                {workStage === 'converting' ? (
                  /* 변환 중: 인라인 로딩 */
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="flex items-center gap-6">
                      <div className="w-28 aspect-[4/3] bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                        <Icon name="image" size={20} className="text-gray-300" />
                      </div>
                      <div className="text-gray-300 text-xl">→</div>
                      <div className="flex gap-3">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-24">
                            <div className="aspect-[4/3] bg-gray-100 rounded-lg border border-gray-200 animate-pulse flex items-center justify-center">
                              <div className="space-y-1.5 w-3/4">
                                <div className="h-2 bg-gray-200 rounded animate-pulse" />
                                <div className="h-2 bg-gray-200 rounded animate-pulse w-2/3" />
                                <div className="h-2 bg-gray-200 rounded animate-pulse" />
                              </div>
                            </div>
                            <p className="text-xs2 text-gray-400 text-center mt-1">버전 {String.fromCharCode(65+i)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm2 text-gray-500">특허 도면 스타일로 변환 중입니다…</p>
                  </div>
                ) : (
                  /* 후보 선택 */
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* 원본 + 선택된 변환본 나란히 */}
                    <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">
                      <div className="flex-1 min-h-0 flex flex-col border-r border-ck-border overflow-hidden">
                        <div className="px-3 py-1.5 bg-ck-bg shrink-0 border-b border-ck-border">
                          <p className="text-xs2 font-semibold text-gray-500">원본</p>
                        </div>
                        <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-hidden">
                          <div className="text-center text-gray-400 p-4">
                            <Icon name="image" size={36} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-sm2">원본 도면</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="px-3 py-1.5 bg-ck-bg shrink-0 border-b border-ck-border">
                          <p className="text-xs2 font-semibold text-gray-500">
                            {selCandId
                              ? `선택된 변환 결과 — 버전 ${String.fromCharCode(65 + candidates.findIndex(c => c.id === selCandId))}`
                              : '변환 결과 (아래에서 선택)'}
                          </p>
                        </div>
                        <div className="flex-1 bg-gray-50 flex items-center justify-center overflow-hidden"
                          style={{ outline: selCandId ? '2px solid #bfdbfe' : 'none', outlineOffset: '-2px' }}>
                          {selCandId ? (
                            (() => {
                              const sc = candidates.find(c => c.id === selCandId);
                              return sc?.svgDataUrl
                                ? <img src={sc.svgDataUrl} className="max-w-full max-h-full object-contain p-4" alt="" />
                                : <Icon name="image" size={36} className="text-gray-300" />;
                            })()
                          ) : (
                            <div className="text-center text-gray-400 p-4">
                              <Icon name="image" size={36} className="mx-auto mb-2 text-gray-200" />
                              <p className="text-sm2">아래에서 선택하세요</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 하단: 변환 후보 썸네일 */}
                    <div className="shrink-0 border-t border-ck-border bg-ck-bg px-4 py-2">
                      <p className="text-xs2 text-gray-400 mb-1.5">변환 후보 — 클릭하여 선택</p>
                      <div className="flex gap-2">
                        {candidates.map((cand, i) => {
                          const isSel = cand.id === selCandId;
                          return (
                            <div key={cand.id}
                              onClick={() => setSelectedMap(m => ({ ...m, [activeId]: cand.id }))}
                              className={clsx(
                                'w-20 shrink-0 cursor-pointer rounded-lg border-2 p-1 transition-all',
                                isSel ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300',
                              )}>
                              <div className="aspect-[4/3] bg-gray-50 rounded border border-gray-100 flex items-center justify-center overflow-hidden mb-1">
                                {cand.svgDataUrl
                                  ? <img src={cand.svgDataUrl} className="w-full h-full object-contain" alt="" />
                                  : <Icon name="image" size={12} className="text-gray-300" />}
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <span className={clsx('w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                                  isSel ? 'border-blue-600 bg-blue-600' : 'border-gray-300')}>
                                  {isSel && <span className="w-1 h-1 rounded-full bg-white" />}
                                </span>
                                <span className={clsx('font-bold', isSel ? 'text-blue-700' : 'text-gray-500')} style={{ fontSize: 10 }}>
                                  버전 {String.fromCharCode(65 + i)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 하단 버튼 */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-ck-border bg-white shrink-0">
                  <div className="flex items-center gap-2">
                    <Button variant="outlined" color="primary" size="sm" onClick={() => goStage('crop')}>← 영역 확인</Button>
                    {workStage === 'decide' && (showRegen ? (
                      <div className="flex items-center gap-1.5">
                        <input className="input py-1 text-xs2 w-32" placeholder="예: 더 단순하게"
                          value={regenPrompt} onChange={e => setRegenPrompt(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && doRegen()} autoFocus />
                        <Button variant="filled" color="primary" size="xs" className="bg-violet-600 border-violet-600" onClick={doRegen}>재변환</Button>
                        <Button variant="outlined" color="primary" size="xs" onClick={() => setShowRegen(false)}>취소</Button>
                      </div>
                    ) : (
                      <button className="text-xs2 text-gray-400 hover:text-violet-600 flex items-center gap-1" onClick={() => setShowRegen(true)}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="10" height="10">
                          <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                          <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                        </svg>
                        다시 변환
                      </button>
                    ))}
                  </div>
                  {workStage === 'decide' && (
                    <Button variant="filled" color="primary" size="sm" onClick={confirmVersion} disabled={!selCandId}>
                      이 버전으로 편집 시작 →
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── 단계 3: 도면 편집 (PatentEditor 인라인) ── */}
            {workStage === 'editing' && (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {patentDrawings.length > 0 ? (
                  <PatentEditor
                    drawings={patentDrawings}
                    activeDrawingId={activeId}
                    availableReferences={localRefs}
                    inventionComponents={refsToComponents(localRefs)}
                    singleDrawingMode={true}
                    onActiveDrawingChange={() => {}}
                    onReferenceAdd={ref => setLocalRefs(p => [...p, ref])}
                    onReferenceUpdate={ref => setLocalRefs(p => p.map(r => {
                      // 번호가 없으면 이름으로 매칭
                      const match = r.number ? r.number === ref.number : r.name === ref.name;
                      return match ? ref : r;
                    }))}
                    onReferenceBulkUpdate={refs => setLocalRefs(refs)}
                    onReferenceDelete={num => setLocalRefs(p => p.filter(r => r.number !== num && r.name !== num))}
                    onSaveProject={(id, json) => {
                      onSave(id, { savedEditorJson: json, stage: 'editing' });
                      if (standalone) writeEditorResult({ drawingId: id, editorJson: json, stage: 'editing', references: [], timestamp: Date.now() });
                    }}
                    onExportComplete={(id, blob) => {
                      const url = URL.createObjectURL(blob);
                      onSave(id, { exportedImageUrl: url, stage: 'done' });
                      if (standalone) writeEditorResult({ drawingId: id, exportedImageUrl: url, stage: 'done', references: [], timestamp: Date.now() });
                    }}
                    onComponentsSync={(refs) => {
                      setSyncNotice(`구성요소 갱신: ${refs.map(r => `${r.number} ${r.name}`).join(', ')}`);
                      setTimeout(() => setSyncNotice(null), 4000);
                    }}
                    onClose={() => goStage('decide')}
                    standalone={standalone}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400">
                    <p className="text-sm2">편집 데이터를 불러오는 중…</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* 확대 뷰어 */}
      {zoomedCandId && (() => {
        const cand = candidates.find(c => c.id === zoomedCandId);
        const idx = candidates.findIndex(c => c.id === zoomedCandId);
        return (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setZoomedCandId(null)}>
            <div className="bg-white rounded-xl shadow-2xl p-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-base2 font-bold">버전 {String.fromCharCode(65+idx)} — 확대</p>
                <Button variant="outlined" color="primary" size="xs" onClick={() => setZoomedCandId(null)}><Icon name="close" size={12} /> 닫기</Button>
              </div>
              <div className="bg-gray-50 rounded-lg border p-4 flex items-center justify-center" style={{ minHeight: 260 }}>
                {cand?.svgDataUrl ? <img src={cand.svgDataUrl} className="max-w-full max-h-60 object-contain" alt="" /> : <Icon name="image" size={32} className="text-gray-300" />}
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="filled" color="primary" size="sm" onClick={() => { setSelectedMap(m => ({...m, [activeId]: zoomedCandId!})); setZoomedCandId(null); }}>이 버전 선택</Button>
                <div className="flex gap-1.5">
                  {candidates.map((c,i) => (
                    <button key={c.id} onClick={() => setZoomedCandId(c.id)}
                      className={clsx('w-7 h-7 rounded border text-xs2 font-bold', c.id === zoomedCandId ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500')}>
                      {String.fromCharCode(65+i)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </Wrapper>
  );
}
