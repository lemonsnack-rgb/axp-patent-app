// DrawingEditorModal — 배경 유지 오버레이, 고정 크기(900×620), 4단계 워크플로우
// Stage 1~3: 모달 내 처리 / Stage 4(편집): 데스크탑→새 탭, 모바일→인라인 패널
import { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { Icon } from '../../components/Icon';
import { PatentEditor } from '../patent-editor';
import {
  openEditorTab, onEditorResult, isMobile, writeEditorResult,
} from './editorChannel';
import type { DrawingItem, CadCandidate } from './types';
import type { EditorReference, PatentDrawing, InventionComponent } from '../patent-editor';

// 목업 구성요소 (실제는 SpecView ComponentsPanel 데이터에서 주입)
const MOCK_COMPONENTS: InventionComponent[] = [
  { number: '10', name: '데이터 수집부' },
  { number: '20', name: '전처리부' },
  { number: '30', name: '특징 추출부' },
  { number: '40', name: '인식부' },
  { number: '50', name: '출력부' },
];

interface Props {
  drawings: DrawingItem[];
  initialDrawingId: string;
  availableReferences?: EditorReference[];
  onSave: (drawingId: string, updates: Partial<DrawingItem>) => void;
  onClose: () => void;
  /** true: 새 탭 풀스크린 모드 (backdrop 없이 전체 페이지 차지) */
  standalone?: boolean;
}

type WorkStage = 'crop' | 'reselect' | 'converting' | 'decide' | 'editing';

const STEP_LABELS = ['추출 영역 확인', '특허 스타일 변환', '이미지 확정', '편집'];

const LABEL_COLORS: Record<string, string> = {
  '제안기술': 'bg-blue-100 text-blue-700',
  '종래기술': 'bg-gray-100 text-gray-600',
  'AI생성':   'bg-violet-100 text-violet-700',
};

const STAGE_STATUS: Record<string, { label: string; cls: string }> = {
  extracted:        { label: '대기',     cls: 'text-gray-400' },
  'bbox-adjusted':  { label: '준비',     cls: 'text-amber-600' },
  converting:       { label: '변환 중',  cls: 'text-amber-600' },
  'candidate-select':{ label: '선택 대기', cls: 'text-violet-600' },
  editing:          { label: '편집 중',  cls: 'text-blue-600' },
  done:             { label: '완료',     cls: 'text-green-600' },
};

// 목업 SVG 후보 3개
const MOCK_SVGS = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="10" y="10" width="180" height="130" fill="none" stroke="#333" stroke-width="1.5"/><line x1="100" y1="10" x2="100" y2="140" stroke="#999" stroke-width="0.5" stroke-dasharray="4,3"/><rect x="30" y="30" width="60" height="90" fill="none" stroke="#333" stroke-width="1"/><rect x="110" y="30" width="60" height="90" fill="none" stroke="#333" stroke-width="1"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="10" y="10" width="180" height="130" fill="none" stroke="#333" stroke-width="2"/><circle cx="100" cy="75" r="40" fill="none" stroke="#333" stroke-width="1.2"/><line x1="10" y1="75" x2="190" y2="75" stroke="#aaa" stroke-width="0.5" stroke-dasharray="4,3"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="20" y="20" width="160" height="110" fill="none" stroke="#222" stroke-width="1.5" rx="4"/><rect x="40" y="40" width="50" height="70" fill="none" stroke="#555" stroke-width="1"/><rect x="110" y="40" width="50" height="70" fill="none" stroke="#555" stroke-width="1"/><line x1="90" y1="75" x2="110" y2="75" stroke="#333" stroke-width="1"/></svg>`,
];

export function DrawingEditorModal({ drawings, initialDrawingId, availableReferences, onSave, onClose, standalone = false }: Props) {
  const [activeId, setActiveId] = useState(initialDrawingId);
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
  const [editorOpen, setEditorOpen] = useState(() => {
    const d = drawings.find(d => d.id === initialDrawingId);
    return (d?.stage === 'done' || d?.stage === 'editing') && isMobile();
  });
  const [editorTabOpened, setEditorTabOpened] = useState(() => {
    const d = drawings.find(d => d.id === initialDrawingId);
    return (d?.stage === 'done' || d?.stage === 'editing') && !isMobile();
  });
  const [zoomedCandId, setZoomedCandId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [showRegen, setShowRegen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // 편집기 탭 결과 수신 (메인 탭에서만 동작)
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
        setEditorTabOpened(false);
        goStage('editing'); // 편집 완료 상태 유지
      }
    });
    return off;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDraw = drawings.find(d => d.id === activeId);
  const workStage = workStageMap[activeId] || 'crop';

  const goStage = useCallback((s: WorkStage) => {
    setWorkStageMap(m => ({ ...m, [activeId]: s }));
  }, [activeId]);

  // 특허 스타일 변환 실행
  const startConvert = () => {
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
    setShowRegen(false); setRegenPrompt('');
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

  const confirmVersion = () => {
    const selId = selectedMap[activeId];
    if (!selId) return;
    onSave(activeId, { stage: 'editing', selectedCandidateId: selId });
    goStage('editing');

    if (isMobile()) {
      // 모바일: 인라인 모달로 PatentEditor 표시
      setEditorOpen(true);
    } else {
      // 데스크탑: 새 탭으로 전체 워크플로 오픈 (DrawingItem 전체 전달)
      openEditorTab({
        drawingId: activeId,
        drawings,                          // DrawingItem[] 전체
        components: MOCK_COMPONENTS,
        references: [],
        drawingName: activeDraw?.name ?? activeId,
        timestamp: Date.now(),
      });
      setEditorTabOpened(true);
    }
  };

  // PatentEditor 데이터
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

  // 현재 단계 인덱스 (reselect는 0과 같음)
  const stepIdx = workStage === 'reselect' ? 0
    : workStage === 'converting' ? 1
    : workStage === 'decide' ? 2
    : workStage === 'editing' ? 3 : 0;

  // standalone: 풀스크린 wrapper, 모달: backdrop + 고정 크기
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
    : { width: '100%', maxWidth: 900, height: 'min(620px, calc(100vh - 32px))' };

  return (
    <Wrapper>
      <div className={standalone
        ? 'flex flex-col w-full h-full bg-white overflow-hidden'
        : 'bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden w-full'}
        style={innerStyle}>

          {/* ── 헤더 ── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ck-border bg-white shrink-0">
            <div className="flex items-center gap-2">
              <Icon name="image" size={15} className="text-blue-700 shrink-0" />
              <span className="text-base2 font-bold text-gray-800">도면 편집기</span>
            </div>
            <button className="btn-outline btn-xs" onClick={onClose}>
              <Icon name="close" size={12} /> 닫기
            </button>
          </div>

          {/* ── 본문 ── */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* 좌: 도면 목록 — 독립 패널 */}
            <aside className="w-36 border-r border-ck-border bg-ck-bg shrink-0 flex flex-col overflow-hidden">
              {/* 좌측 패널 고정 헤더 */}
              <div className="px-2.5 pt-2.5 pb-1.5 border-b border-ck-border shrink-0">
                <p className="text-xs2 font-semibold text-gray-500 uppercase tracking-wide">
                  도면 목록
                  <span className="ml-1 font-normal text-gray-400">({drawings.length})</span>
                </p>
              </div>
              {/* 도면 카드 목록 — 독립 스크롤 */}
              <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2 space-y-1.5">
                {drawings.map(d => {
                  const isActive = d.id === activeId;
                  const status = STAGE_STATUS[d.stage] || STAGE_STATUS.extracted;
                  const ws = workStageMap[d.id] || 'crop';
                  const isDone = ws === 'editing' || d.stage === 'done';
                  return (
                    <button key={d.id} onClick={() => setActiveId(d.id)}
                      className={clsx(
                        'w-full text-left rounded-lg border p-1.5 transition-all',
                        isActive ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-ck-border bg-white hover:border-blue-300',
                      )}>
                      {/* 썸네일 */}
                      <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden mb-1">
                        {d.exportedImageUrl
                          ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                          : <Icon name="image" size={14} className="text-gray-300" />}
                      </div>
                      <p className="text-xs2 font-semibold text-gray-700 truncate">기호 {d.symbol}</p>
                      <p className="text-xs2 text-gray-500 truncate">{d.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isDone
                          ? <span className="text-xs2 text-green-600 flex items-center gap-0.5"><Icon name="check" size={9} />완료</span>
                          : isActive
                            ? <span className="text-xs2 text-blue-600 font-semibold">작업 중</span>
                            : <span className={clsx('text-xs2', status.cls)}>{status.label}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* 안내 문구 */}
              <div className="px-2 pb-2 shrink-0">
                <p className="text-xs2 text-gray-400 leading-relaxed bg-gray-50 rounded p-1.5 border border-gray-200">
                  도면 1개씩 순서대로 작업하세요.
                </p>
              </div>
            </aside>

            {/* 우: 선택 도면 정보 + 단계 + 콘텐츠 */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

              {/* 우측 패널 고정 헤더: 선택 도면 정보 + 단계 표시 */}
              {activeDraw && (
                <div className="shrink-0 border-b border-ck-border bg-ck-bg px-4 py-2 flex items-center gap-3 flex-wrap">
                  {/* 선택 도면 정보 */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm2 font-bold text-gray-800">기호 {activeDraw.symbol}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm2 font-semibold text-gray-700 truncate max-w-[140px]">{activeDraw.name}</span>
                    <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium shrink-0', LABEL_COLORS[activeDraw.label] || 'bg-gray-100 text-gray-600')}>
                      {activeDraw.label}
                    </span>
                  </div>
                  {/* 단계 표시 */}
                  <div className="flex items-center gap-0.5 ml-auto">
                    {STEP_LABELS.map((label, i) => (
                      <div key={i} className="flex items-center">
                        <div className={clsx(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs2 font-medium transition-all',
                          i === stepIdx ? 'bg-blue-100 text-blue-700' :
                          i < stepIdx  ? 'text-green-600' : 'text-gray-300',
                        )}>
                          {i < stepIdx
                            ? <Icon name="check" size={9} />
                            : <span className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0" style={{ fontSize: 8 }}>{i + 1}</span>}
                          <span className="hidden md:inline">{label}</span>
                        </div>
                        {i < STEP_LABELS.length - 1 && <span className="text-gray-200 mx-0.5 text-xs2">›</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 단계별 콘텐츠 */}
              <div className="flex-1 overflow-y-auto scroll-thin flex flex-col">

              {/* ── Stage 1: 추출 영역 확인 (crop) ── */}
              {(workStage === 'crop' || workStage === 'reselect') && activeDraw && (
                <div className="flex-1 flex flex-col p-4 gap-3">
                  <div>
                    <p className="text-base2 font-bold text-gray-800">추출 영역 확인</p>
                    <p className="text-sm2 text-gray-500">
                      {workStage === 'reselect'
                        ? '원본 이미지에서 변환할 영역을 드래그하여 지정하세요.'
                        : '추출된 도면을 확인하세요.'}
                    </p>
                  </div>

                  {/* 이미지 영역 */}
                  <div className="flex-1 flex flex-col gap-2 min-h-0">
                    {workStage === 'crop' ? (
                      /* 크롭된 이미지만 표시 */
                      <div className="flex-1 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center min-h-0">
                        {activeDraw.exportedImageUrl ? (
                          <img src={activeDraw.exportedImageUrl} className="max-w-full max-h-full object-contain p-3" alt="크롭된 도면" />
                        ) : (
                          <div className="text-center text-gray-400">
                            <Icon name="image" size={40} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-sm2">추출된 도면 영역</p>
                            <p className="text-xs2 text-gray-300 mt-0.5">
                              {activeDraw.name} · {activeDraw.imageSize?.w}×{activeDraw.imageSize?.h}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* 범위 재지정 모드: 원본 + 드래그 영역 */
                      <div className="flex-1 bg-gray-100 rounded-lg border-2 border-blue-400 relative flex items-center justify-center min-h-0">
                        <div className="text-center text-gray-400">
                          <Icon name="image" size={40} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-sm2">원본 전체 이미지</p>
                          <p className="text-xs2 text-gray-400 mt-1">드래그하여 변환 영역 지정</p>
                        </div>
                        {/* 드래그 영역 표시 */}
                        <div className="absolute border-2 border-blue-500 bg-blue-500/15 rounded"
                          style={{ left: '15%', top: '15%', right: '15%', bottom: '15%' }}>
                          <span className="absolute -top-5 left-0 text-xs2 text-blue-600 bg-white px-1 rounded font-semibold">변환 영역</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 하단 버튼 */}
                  <div className="flex items-center justify-between gap-2 shrink-0">
                    {workStage === 'crop' ? (
                      <>
                        <button className="btn-outline btn-sm" onClick={() => goStage('reselect')}>
                          범위 재지정
                        </button>
                        <button className="btn-primary btn-sm" onClick={startConvert}>
                          특허 스타일로 변환하기 →
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-outline btn-sm" onClick={() => goStage('crop')}>
                          ← 취소
                        </button>
                        <button className="btn-primary btn-sm" onClick={startConvert}>
                          이 영역으로 변환하기 →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Stage 2: 변환 중 ── */}
              {workStage === 'converting' && activeDraw && (
                <div className="flex-1 flex flex-col p-4 gap-4">
                  <div>
                    <p className="text-base2 font-bold text-gray-800">특허 스타일로 변환 중…</p>
                    <p className="text-sm2 text-gray-500">AI가 특허 도면 스타일 3가지 버전을 생성하고 있습니다.</p>
                  </div>
                  <div className="flex-1 flex flex-col gap-3 justify-center min-h-0">
                    {/* 원본 + 변환 로딩 */}
                    <div className="flex items-start gap-4">
                      <div className="w-28 shrink-0">
                        <div className="aspect-[4/3] bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                          <Icon name="image" size={20} className="text-gray-300" />
                        </div>
                        <p className="text-xs2 text-gray-400 text-center mt-1 font-medium">원본</p>
                      </div>
                      <div className="text-gray-300 text-lg2 mt-4 shrink-0">→</div>
                      <div className="flex flex-1 gap-2">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="flex-1">
                            <div className="aspect-[4/3] bg-gray-100 rounded-lg border border-gray-200 animate-pulse flex items-center justify-center">
                              <div className="space-y-1.5 w-3/4">
                                <div className="h-2 bg-gray-200 rounded animate-pulse" />
                                <div className="h-2 bg-gray-200 rounded animate-pulse w-2/3" />
                                <div className="h-2 bg-gray-200 rounded animate-pulse" />
                              </div>
                            </div>
                            <p className="text-xs2 text-gray-400 text-center mt-1">버전 {String.fromCharCode(65 + i)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Stage 3: 이미지 확정 ── */}
              {workStage === 'decide' && activeDraw && (
                <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
                  <div className="shrink-0">
                    <p className="text-base2 font-bold text-gray-800">이미지 확정</p>
                    <p className="text-sm2 text-gray-500">원본과 변환 결과를 비교하여 편집할 버전을 선택하세요.</p>
                  </div>

                  {/* 원본 + 변환 결과 나란히 */}
                  <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
                    {/* 좌: 원본 */}
                    <div className="w-36 shrink-0 flex flex-col gap-1">
                      <p className="text-xs2 font-semibold text-gray-500 text-center">원본</p>
                      <div className="flex-1 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                        <div className="text-center text-gray-400 p-2">
                          <Icon name="image" size={24} className="mx-auto text-gray-300 mb-1" />
                          <p className="text-xs2">원본 도면</p>
                        </div>
                      </div>
                    </div>

                    {/* 우: 변환 결과 세로 나열 */}
                    <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto scroll-thin">
                      <p className="text-xs2 font-semibold text-gray-500 shrink-0">변환 결과 — 클릭하여 선택 / 더블클릭하여 확대</p>
                      {candidates.map((cand, i) => {
                        const isSel = cand.id === selCandId;
                        return (
                          <div key={cand.id}
                            onClick={() => setSelectedMap(m => ({ ...m, [activeId]: cand.id }))}
                            onDoubleClick={() => setZoomedCandId(cand.id)}
                            className={clsx(
                              'shrink-0 rounded-lg border-2 p-2 cursor-pointer transition-all group flex gap-2 items-center',
                              isSel ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300',
                            )}>
                            <div className="w-24 shrink-0 aspect-[4/3] bg-gray-50 rounded border border-gray-200 flex items-center justify-center overflow-hidden relative">
                              {cand.svgDataUrl
                                ? <img src={cand.svgDataUrl} className="w-full h-full object-contain p-1" alt="" />
                                : <Icon name="image" size={16} className="text-gray-300" />}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/40 text-white text-xs2 rounded px-1 py-0.5">확대</span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={clsx('w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                                  isSel ? 'border-blue-600 bg-blue-600' : 'border-gray-300')}>
                                  {isSel && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </span>
                                <span className={clsx('text-xs2 font-bold', isSel ? 'text-blue-700' : 'text-gray-600')}>
                                  버전 {String.fromCharCode(65 + i)}
                                </span>
                                {isSel && <span className="text-xs2 text-blue-600 ml-1">선택됨</span>}
                              </div>
                              <p className="text-xs2 text-gray-400">더블클릭하여 확대</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 재생성 + 확정 버튼 */}
                  <div className="shrink-0 flex items-center justify-between gap-2 pt-1 border-t border-ck-border">
                    <div className="flex items-center gap-2">
                      <button className="btn-outline btn-sm" onClick={() => goStage('crop')}>
                        ← 이전 단계
                      </button>
                      {showRegen ? (
                        <div className="flex items-center gap-1.5">
                          <input className="input py-1 text-xs2 w-36"
                            placeholder="예: 더 단순하게"
                            value={regenPrompt}
                            onChange={e => setRegenPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && doRegen()}
                            autoFocus />
                          <button className="btn-primary btn-xs bg-violet-600 border-violet-600" onClick={doRegen}>재생성</button>
                          <button className="btn-outline btn-xs" onClick={() => setShowRegen(false)}>취소</button>
                        </div>
                      ) : (
                        <button className="text-xs2 text-gray-400 hover:text-violet-600 transition-colors flex items-center gap-1"
                          onClick={() => setShowRegen(true)}>
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="10" height="10">
                            <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                            <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                          </svg>
                          다시 생성
                        </button>
                      )}
                    </div>
                    <button className="btn-primary btn-sm" onClick={confirmVersion} disabled={!selCandId}>
                      이 버전으로 편집 시작 →
                    </button>
                  </div>
                </div>
              )}

              {/* ── Stage 4: 편집 ── */}
              {workStage === 'editing' && (
                <div className="flex-1 flex flex-col p-4 gap-3">
                  <div>
                    <p className="text-base2 font-bold text-gray-800">편집</p>
                    <p className="text-sm2 text-gray-500">
                      {editorTabOpened
                        ? '새 탭에서 편집 중입니다. 저장 후 이 창에서 명세서를 함께 확인하세요.'
                        : '편집기를 열어 도면에 선, 부호, 지시선을 추가하세요.'}
                    </p>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    {editorTabOpened ? (
                      /* 새 탭 편집 중 상태 */
                      <div className="card p-6 text-center w-full max-w-sm border-blue-200 bg-blue-50">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="3" width="8" height="5" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/>
                            <rect x="3" y="11" width="8" height="10" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/>
                          </svg>
                        </div>
                        <p className="text-sm2 font-semibold text-blue-800 mb-1">새 탭에서 편집 중</p>
                        <p className="text-xs2 text-blue-600 mb-4">
                          {activeDraw?.name} · 편집기 탭과 이 창을 나란히 열어<br/>명세서를 참고하며 도면을 편집하세요.
                        </p>
                        <div className="flex gap-2 justify-center">
                          <button className="btn-primary btn-sm"
                            onClick={() => {
                              // 편집기 탭을 다시 열기 (이미 열려 있으면 포커스 불가 → 새로 열기)
                              confirmVersion();
                            }}>
                            편집기 탭 다시 열기
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 편집기 미열림 상태 */
                      <div className="card p-6 text-center w-full max-w-xs">
                        <Icon name="image" size={36} className="mx-auto text-blue-200 mb-3" />
                        <p className="text-sm2 text-gray-700 font-semibold mb-1">{activeDraw?.name}</p>
                        <p className="text-xs2 text-gray-400 mb-4">편집 준비 완료</p>
                        <button className="btn-primary btn-sm w-full"
                          onClick={isMobile() ? () => setEditorOpen(true) : confirmVersion}>
                          {isMobile() ? '편집기 열기 →' : '새 탭에서 편집하기 ↗'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    <button className="btn-outline btn-sm" onClick={() => {
                      setEditorTabOpened(false);
                      goStage('decide');
                    }}>
                      ← 버전 다시 선택
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      {/* ── 확대 뷰어 ── */}
      {zoomedCandId && (() => {
        const cand = candidates.find(c => c.id === zoomedCandId);
        const idx = candidates.findIndex(c => c.id === zoomedCandId);
        return (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setZoomedCandId(null)}>
            <div className="bg-white rounded-xl shadow-2xl p-4 w-full max-w-md"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-base2 font-bold text-gray-800">버전 {String.fromCharCode(65 + idx)} — 확대</p>
                <button className="btn-outline btn-xs" onClick={() => setZoomedCandId(null)}>
                  <Icon name="close" size={12} /> 닫기
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center justify-center" style={{ minHeight: 260 }}>
                {cand?.svgDataUrl
                  ? <img src={cand.svgDataUrl} className="max-w-full max-h-60 object-contain" alt="" />
                  : <Icon name="image" size={32} className="text-gray-300" />}
              </div>
              <div className="flex justify-between items-center mt-4">
                <button className="btn-primary btn-sm"
                  onClick={() => { setSelectedMap(m => ({ ...m, [activeId]: zoomedCandId })); setZoomedCandId(null); }}>
                  이 버전 선택
                </button>
                <div className="flex gap-1.5">
                  {candidates.map((c, i) => (
                    <button key={c.id} onClick={() => setZoomedCandId(c.id)}
                      className={clsx('w-7 h-7 rounded border text-xs2 font-bold',
                        c.id === zoomedCandId ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 hover:border-blue-400')}>
                      {String.fromCharCode(65 + i)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      </div>{/* ← inner panel 닫기 */}

      {/* ── PatentEditor (standalone 또는 모바일 인라인) ── */}
      {editorOpen && (standalone || isMobile()) && patentDrawings.length > 0 && (
        <div className={standalone
          ? 'fixed inset-0 bg-white flex flex-col'
          : 'fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4'}>
          <div className={standalone
            ? 'flex flex-col w-full h-full overflow-hidden'
            : 'w-full h-full bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden'}
            style={standalone ? undefined : { maxWidth: '95vw', maxHeight: '95vh' }}>
            <PatentEditor
              drawings={patentDrawings}
              activeDrawingId={activeId}
              availableReferences={availableReferences}
              inventionComponents={MOCK_COMPONENTS}
              onActiveDrawingChange={setActiveId}
              onSaveProject={(id, json) => onSave(id, { savedEditorJson: json, stage: 'editing' })}
              onExportComplete={(id, blob) => {
                const url = URL.createObjectURL(blob);
                onSave(id, { exportedImageUrl: url, stage: 'done' });
                if (standalone) writeEditorResult({ drawingId: id, exportedImageUrl: url, stage: 'done', references: [], timestamp: Date.now() });
              }}
              onComponentsSync={(refs) => {
                const names = refs.map(r => `${r.number} ${r.name}`).join(', ');
                setSyncNotice(`구성요소 갱신 완료: ${names}`);
                setTimeout(() => setSyncNotice(null), 4000);
                if (standalone) writeEditorResult({ drawingId: activeId, stage: 'editing', references: refs, timestamp: Date.now() });
              }}
              onClose={() => {
                setEditorOpen(false);
                if (standalone) goStage('decide');
              }}
            />
          </div>
        </div>
      )}
    </Wrapper>
  );
}
