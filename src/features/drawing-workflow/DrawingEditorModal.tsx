// DrawingEditorModal — 배경 유지 오버레이 모달
// Stage A: 추출 영역 확인 → Stage B: 변환 중 → Stage C: 버전 선택 → Stage D: 편집
import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { Icon } from '../../components/Icon';
import { PatentEditor } from '../patent-editor';
import type { DrawingItem, CadCandidate } from './types';
import type { EditorReference, PatentDrawing } from '../patent-editor';

interface Props {
  drawings: DrawingItem[];
  initialDrawingId: string;
  availableReferences?: EditorReference[];
  onSave: (drawingId: string, updates: Partial<DrawingItem>) => void;
  onClose: () => void;
}

type ModalStage = 'bbox' | 'converting' | 'candidates' | 'editing';

const STAGE_LABELS: Record<ModalStage, string> = {
  bbox:       '추출 영역 확인',
  converting: '변환 중',
  candidates: '버전 선택',
  editing:    '편집',
};

const STAGE_ORDER: ModalStage[] = ['bbox', 'converting', 'candidates', 'editing'];

const LABEL_COLORS: Record<string, string> = {
  '제안기술': 'bg-blue-100 text-blue-700',
  '종래기술': 'bg-gray-100 text-gray-600',
  'AI생성':   'bg-violet-100 text-violet-700',
};

// 목업 CAD 후보 SVG
const MOCK_CAD_SVGS = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="10" y="10" width="180" height="130" fill="none" stroke="#333" stroke-width="1.5"/><line x1="100" y1="10" x2="100" y2="140" stroke="#999" stroke-width="0.5" stroke-dasharray="4,3"/><rect x="30" y="30" width="60" height="90" fill="none" stroke="#333" stroke-width="1"/><rect x="110" y="30" width="60" height="90" fill="none" stroke="#333" stroke-width="1"/><text x="100" y="155" text-anchor="middle" font-size="8" fill="#666">안 A</text></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="10" y="10" width="180" height="130" fill="none" stroke="#333" stroke-width="2"/><circle cx="100" cy="75" r="40" fill="none" stroke="#333" stroke-width="1.2"/><line x1="10" y1="75" x2="190" y2="75" stroke="#aaa" stroke-width="0.5" stroke-dasharray="4,3"/><text x="100" y="155" text-anchor="middle" font-size="8" fill="#666">안 B</text></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="20" y="20" width="160" height="110" fill="none" stroke="#222" stroke-width="1.5" rx="4"/><rect x="40" y="40" width="50" height="70" fill="none" stroke="#555" stroke-width="1"/><rect x="110" y="40" width="50" height="70" fill="none" stroke="#555" stroke-width="1"/><line x1="90" y1="75" x2="110" y2="75" stroke="#333" stroke-width="1"/><text x="100" y="148" text-anchor="middle" font-size="8" fill="#666">안 C</text></svg>`,
];

export function DrawingEditorModal({ drawings, initialDrawingId, availableReferences, onSave, onClose }: Props) {
  const [activeId, setActiveId] = useState(initialDrawingId);
  const [stageMap, setStageMap] = useState<Record<string, ModalStage>>(() => {
    const m: Record<string, ModalStage> = {};
    drawings.forEach(d => {
      if (d.stage === 'done' || d.stage === 'editing') m[d.id] = 'editing';
      else if (d.stage === 'candidate-select') m[d.id] = 'candidates';
      else if (d.stage === 'converting') m[d.id] = 'converting';
      else m[d.id] = 'bbox';
    });
    return m;
  });
  const [candidatesMap, setCandidatesMap] = useState<Record<string, CadCandidate[]>>({});
  const [selectedCandMap, setSelectedCandMap] = useState<Record<string, string>>({});
  const [regenPrompt, setRegenPrompt] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [zoomedCandId, setZoomedCandId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(() => {
    const d = drawings.find(d => d.id === initialDrawingId);
    return d?.stage === 'done' || d?.stage === 'editing';
  });

  const activeDraw = drawings.find(d => d.id === activeId);
  const activeStage = stageMap[activeId] || 'bbox';
  const stageIdx = STAGE_ORDER.indexOf(activeStage);

  const [bbox, setBbox] = useState(() => activeDraw?.bbox || { x: 0, y: 0, w: 200, h: 150 });

  const goStage = useCallback((stage: ModalStage) => {
    setStageMap(m => ({ ...m, [activeId]: stage }));
  }, [activeId]);

  // 특허 스타일 변환 시작
  const startConversion = () => {
    goStage('converting');
    setTimeout(() => {
      const cands: CadCandidate[] = MOCK_CAD_SVGS.map((svg, i) => ({
        id: `cand-${activeId}-${i}`,
        svgDataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      }));
      setCandidatesMap(m => ({ ...m, [activeId]: cands }));
      setSelectedCandMap(m => ({ ...m, [activeId]: cands[0].id }));
      goStage('candidates');
    }, 1500);
  };

  // 재생성
  const regenConversion = () => {
    setShowRegenInput(false);
    setRegenPrompt('');
    goStage('converting');
    setTimeout(() => {
      const cands: CadCandidate[] = MOCK_CAD_SVGS.map((svg, i) => ({
        id: `regen-${activeId}-${i}`,
        svgDataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      }));
      setCandidatesMap(m => ({ ...m, [activeId]: cands }));
      setSelectedCandMap(m => ({ ...m, [activeId]: cands[0].id }));
      goStage('candidates');
    }, 1200);
  };

  // 버전 확정 → 편집
  const goEditing = () => {
    const selId = selectedCandMap[activeId];
    if (!selId) return;
    onSave(activeId, { stage: 'editing', selectedCandidateId: selId });
    goStage('editing');
    setEditorOpen(true);
  };

  // PatentEditor용 데이터
  const patentDrawings: PatentDrawing[] = drawings
    .filter(d => stageMap[d.id] === 'editing' || d.stage === 'done')
    .map(d => {
      const cands = candidatesMap[d.id] || d.cadCandidates || [];
      const selId = selectedCandMap[d.id] || d.selectedCandidateId;
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

  const drawingIdx = drawings.findIndex(d => d.id === activeId);
  const selectedCandId = selectedCandMap[activeId] ?? candidatesMap[activeId]?.[0]?.id;
  const candidates = candidatesMap[activeId] || [];
  const selectedCand = candidates.find(c => c.id === selectedCandId);

  return (
    <>
      {/* ── 백드롭 + 모달 패널 ── */}
      <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
        <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col"
          style={{ minHeight: 520, maxHeight: 'calc(100vh - 48px)' }}>

          {/* ── 모달 헤더 ── */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-ck-border bg-white rounded-t-xl shrink-0">
            <Icon name="image" size={15} className="text-blue-700" />
            <span className="text-base2 font-bold text-gray-800">도면 편집</span>
            {activeDraw && (
              <span className="text-sm2 text-gray-500">
                — 기호 {activeDraw.symbol} · {activeDraw.name}
              </span>
            )}

            {/* 스테이지 인디케이터 */}
            <div className="flex items-center gap-1 ml-4">
              {STAGE_ORDER.map((s, i) => (
                <div key={s} className="flex items-center">
                  <span className={clsx(
                    'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center border-2 transition-all',
                    i < stageIdx  ? 'bg-green-500 border-green-500 text-white' :
                    i === stageIdx ? 'bg-blue-700 border-blue-700 text-white' :
                    'bg-white border-gray-300 text-gray-400',
                  )}>
                    {i < stageIdx ? <Icon name="check" size={9} /> : i + 1}
                  </span>
                  <span className={clsx('text-xs2 ml-1 mr-2 hidden sm:block',
                    i === stageIdx ? 'text-blue-700 font-semibold' : 'text-gray-400',
                  )}>{STAGE_LABELS[s]}</span>
                  {i < STAGE_ORDER.length - 1 && (
                    <div className={clsx('h-0.5 w-3 mr-1', i < stageIdx ? 'bg-green-400' : 'bg-gray-200')} />
                  )}
                </div>
              ))}
            </div>

            <button className="ml-auto btn-outline btn-xs" onClick={onClose}>
              <Icon name="close" size={12} /> 닫기
            </button>
          </div>

          {/* ── 본문 ── */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* 좌: 도면 목록 */}
            <aside className="w-36 border-r border-ck-border bg-ck-bg overflow-y-auto scroll-thin shrink-0 p-2">
              <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">도면 목록</p>
              {drawings.map(d => {
                const ds = stageMap[d.id] || 'bbox';
                const isActive = d.id === activeId;
                return (
                  <button key={d.id} onClick={() => setActiveId(d.id)}
                    className={clsx('w-full text-left rounded-lg border p-2 mb-1.5 transition-all',
                      isActive ? 'border-blue-500 bg-blue-50' : 'border-ck-border bg-white hover:border-gray-300')}>
                    <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center mb-1 overflow-hidden">
                      {d.exportedImageUrl
                        ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                        : <Icon name="image" size={14} className="text-gray-300" />}
                    </div>
                    <p className="text-xs2 font-semibold text-gray-700 truncate">기호 {d.symbol}</p>
                    <p className="text-xs2 text-gray-400 truncate">{d.name}</p>
                    <div className="mt-0.5">
                      {(ds as string) === 'done' || d.stage === 'done' ? (
                        <span className="text-xs2 text-green-600 flex items-center gap-0.5"><Icon name="check" size={9} /> 완료</span>
                      ) : ds === 'converting' ? (
                        <span className="text-xs2 text-amber-600">변환 중…</span>
                      ) : ds === 'editing' ? (
                        <span className="text-xs2 text-blue-600">편집 중</span>
                      ) : ds === 'candidates' ? (
                        <span className="text-xs2 text-violet-600">선택 대기</span>
                      ) : (
                        <span className="text-xs2 text-gray-400">대기</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* 우: 스테이지별 콘텐츠 */}
            <div className="flex-1 overflow-y-auto scroll-thin">

              {/* ── STAGE A: 추출 영역 확인 ── */}
              {activeStage === 'bbox' && activeDraw && (
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-base2 font-bold text-gray-800 mb-0.5">추출 영역 확인</p>
                    <p className="text-sm2 text-gray-500">도면 영역을 확인하고 필요하면 변환 범위를 조정하세요.</p>
                  </div>

                  <div className="card p-3 flex items-center gap-3">
                    <span className={clsx('text-xs2 px-2 py-0.5 rounded-full font-semibold', LABEL_COLORS[activeDraw.label] || 'bg-gray-100 text-gray-600')}>
                      {activeDraw.label}
                    </span>
                    <span className="text-sm2 font-semibold text-gray-700">기호 {activeDraw.symbol} — {activeDraw.name}</span>
                    {activeDraw.imageSize && (
                      <span className="text-xs2 text-gray-400 ml-auto">{activeDraw.imageSize.w}×{activeDraw.imageSize.h}</span>
                    )}
                  </div>

                  {/* 이미지 + 영역 표시 */}
                  <div className="card p-4">
                    <div className="relative bg-gray-100 rounded-lg border border-gray-200 overflow-hidden" style={{ height: 280 }}>
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <Icon name="image" size={36} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-sm2">직무발명서에서 추출된 도면</p>
                          <p className="text-xs2 text-gray-400">p.{activeDraw.pageNumber} · {activeDraw.imageSize?.w}×{activeDraw.imageSize?.h}</p>
                        </div>
                      </div>
                      <div
                        className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
                        style={{
                          left: `${(bbox.x / (activeDraw.imageSize?.w || 300)) * 100}%`,
                          top: `${(bbox.y / (activeDraw.imageSize?.h || 300)) * 100}%`,
                          width: `${(bbox.w / (activeDraw.imageSize?.w || 300)) * 100}%`,
                          height: `${(bbox.h / (activeDraw.imageSize?.h || 300)) * 100}%`,
                        }}>
                        <span className="absolute -top-5 left-0 text-xs2 text-blue-600 font-semibold bg-white px-1 rounded">변환 영역</span>
                      </div>
                    </div>
                    <p className="text-xs2 text-gray-400 mt-2">※ 영역을 드래그하여 변환 범위를 조정하세요</p>
                  </div>

                  <div className="card p-3">
                    <p className="text-xs2 font-semibold text-gray-500 mb-1">설명</p>
                    <p className="text-sm2 text-gray-700 leading-relaxed">{activeDraw.description}</p>
                  </div>

                  <div className="flex justify-between gap-2">
                    <button className="btn-outline btn-sm" onClick={() => setBbox(activeDraw.bbox)}>
                      초기화
                    </button>
                    <button className="btn-primary btn-sm" onClick={startConversion}>
                      특허 스타일로 변환하기 →
                    </button>
                  </div>
                </div>
              )}

              {/* ── STAGE B: 변환 중 ── */}
              {activeStage === 'converting' && activeDraw && (
                <div className="p-5">
                  <p className="text-base2 font-bold text-gray-800 mb-1">특허 스타일로 변환 중…</p>
                  <p className="text-sm2 text-gray-500 mb-4">AI가 특허 도면 스타일로 변환하는 중입니다.</p>

                  {/* 원본 이미지 */}
                  <div className="mb-4">
                    <div className="h-48 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Icon name="image" size={28} className="mx-auto mb-1 text-gray-300" />
                        <p className="text-xs2">원본</p>
                      </div>
                    </div>
                  </div>

                  {/* 로딩 후보 자리 */}
                  <div>
                    <p className="text-xs2 text-gray-400 mb-2">변환 결과 생성 중 ({3}개 버전)…</p>
                    <div className="flex gap-2">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="flex-1">
                          <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 animate-pulse" />
                          <p className="text-xs2 text-gray-400 text-center mt-1">안 {String.fromCharCode(65 + i)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STAGE C: 버전 선택 ── */}
              {activeStage === 'candidates' && activeDraw && (
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-base2 font-bold text-gray-800 mb-0.5">버전 선택</p>
                    <p className="text-sm2 text-gray-500">변환된 버전 중 편집할 이미지를 선택하세요.</p>
                  </div>

                  {/* 선택된 버전 크게 보기 */}
                  <div className="card p-3">
                    <p className="text-xs2 font-semibold text-gray-500 mb-2 flex items-center gap-1">
                      <Icon name="check" size={10} className="text-blue-600" />
                      선택된 버전
                      {selectedCand && (
                        <span className="ml-1 text-blue-600">
                          — 안 {String.fromCharCode(65 + candidates.findIndex(c => c.id === selectedCandId))}
                        </span>
                      )}
                    </p>
                    <div className="relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center" style={{ height: 220 }}>
                      {selectedCand?.svgDataUrl ? (
                        <img src={selectedCand.svgDataUrl} className="max-w-full max-h-full object-contain p-2" alt="선택된 버전" />
                      ) : (
                        <div className="text-center text-gray-400">
                          <Icon name="image" size={28} className="mx-auto text-gray-300" />
                          <p className="text-xs2 mt-1">아래에서 선택하세요</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 후보 썸네일 (하단) */}
                  <div>
                    <p className="text-xs2 font-semibold text-gray-500 mb-2">후보 이미지 — 클릭하여 선택 / 더블클릭하여 확대</p>
                    <div className="flex gap-2">
                      {candidates.map((cand, i) => {
                        const isSelected = cand.id === selectedCandId;
                        return (
                          <div key={cand.id}
                            onClick={() => setSelectedCandMap(m => ({ ...m, [activeId]: cand.id }))}
                            onDoubleClick={() => setZoomedCandId(cand.id)}
                            className={clsx(
                              'flex-1 cursor-pointer rounded-lg border-2 p-1.5 transition-all group',
                              isSelected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300',
                            )}>
                            <div className="aspect-[4/3] bg-gray-50 rounded border border-gray-100 flex items-center justify-center overflow-hidden mb-1 relative">
                              {cand.svgDataUrl
                                ? <img src={cand.svgDataUrl} className="w-full h-full object-contain p-1" alt="" />
                                : <Icon name="image" size={16} className="text-gray-300" />}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/40 text-white text-xs2 rounded px-1.5 py-0.5">확대</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={clsx('w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                                isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300')}>
                                {isSelected && <span className="w-1 h-1 rounded-full bg-white" />}
                              </span>
                              <span className={clsx('text-xs2 font-semibold', isSelected ? 'text-blue-700' : 'text-gray-500')}>
                                안 {String.fromCharCode(65 + i)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs2 text-gray-400 mt-1.5">※ 더블클릭하면 확대하여 볼 수 있습니다</p>
                  </div>

                  {/* 재생성 */}
                  <div>
                    {showRegenInput ? (
                      <div className="rounded-lg border border-violet-300 bg-violet-50 p-3">
                        <p className="text-xs2 font-semibold text-violet-700 mb-1.5">재생성 지시사항</p>
                        <input
                          className="input py-1.5 text-sm2 w-full mb-2"
                          placeholder="예: 선을 더 굵게 / 더 단순하게 / 단면도 스타일로"
                          value={regenPrompt}
                          onChange={e => setRegenPrompt(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && regenConversion()}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button className="btn-outline btn-xs" onClick={() => setShowRegenInput(false)}>취소</button>
                          <button className="btn-primary btn-xs bg-violet-600 border-violet-600 hover:bg-violet-700"
                            onClick={regenConversion}>다시 생성</button>
                        </div>
                      </div>
                    ) : (
                      <button className="flex items-center gap-1.5 text-xs2 text-gray-500 hover:text-violet-700 transition-colors"
                        onClick={() => setShowRegenInput(true)}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="11" height="11">
                          <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                          <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                        </svg>
                        결과가 마음에 들지 않으면 다시 생성
                      </button>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <button className="btn-outline btn-sm" onClick={() => goStage('bbox')}>
                      ← 이전 단계
                    </button>
                    <button className="btn-primary btn-sm" onClick={goEditing} disabled={!selectedCandId}>
                      이 버전으로 편집 시작 →
                    </button>
                  </div>
                </div>
              )}

              {/* ── STAGE D: 편집 대기 ── */}
              {activeStage === 'editing' && (
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-base2 font-bold text-gray-800 mb-0.5">편집</p>
                    <p className="text-sm2 text-gray-500">편집기를 열어 도면을 수정하거나 부호를 추가하세요.</p>
                  </div>
                  <div className="card p-6 flex flex-col items-center gap-3 text-center">
                    <Icon name="image" size={32} className="text-blue-300" />
                    <p className="text-sm2 text-gray-600">{activeDraw?.name} 도면이 편집 준비되었습니다.</p>
                    <button className="btn-primary btn-sm" onClick={() => setEditorOpen(true)}>
                      편집기 열기 →
                    </button>
                  </div>
                  <div className="flex justify-start">
                    <button className="btn-outline btn-sm" onClick={() => goStage('candidates')}>
                      ← 버전 다시 선택
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── 하단 내비게이션 (편집 단계 제외) ── */}
          {activeStage !== 'editing' && activeStage !== 'candidates' && (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-ck-border bg-ck-bg shrink-0 rounded-b-xl">
              <button className="btn-outline btn-sm" disabled={drawingIdx === 0}
                onClick={() => setActiveId(drawings[drawingIdx - 1].id)}>
                ← 이전 도면
              </button>
              <span className="text-xs2 text-gray-400">{drawingIdx + 1} / {drawings.length}</span>
              <button className="btn-outline btn-sm" disabled={drawingIdx === drawings.length - 1}
                onClick={() => setActiveId(drawings[drawingIdx + 1].id)}>
                다음 도면 →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 후보 확대 뷰어 ── */}
      {zoomedCandId && (() => {
        const cand = candidates.find(c => c.id === zoomedCandId);
        const candIdx = candidates.findIndex(c => c.id === zoomedCandId);
        return (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setZoomedCandId(null)}>
            <div className="relative bg-white rounded-xl shadow-2xl p-4 max-w-lg w-full"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-base2 font-bold text-gray-800">
                  안 {String.fromCharCode(65 + candIdx)} — 확대 보기
                </p>
                <button className="btn-outline btn-xs" onClick={() => setZoomedCandId(null)}>
                  <Icon name="close" size={12} /> 닫기
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center justify-center" style={{ minHeight: 280 }}>
                {cand?.svgDataUrl
                  ? <img src={cand.svgDataUrl} className="max-w-full max-h-64 object-contain" alt="" />
                  : <Icon name="image" size={32} className="text-gray-300" />}
              </div>
              <div className="flex justify-between items-center mt-4">
                <button className="btn-outline btn-sm"
                  onClick={() => {
                    setSelectedCandMap(m => ({ ...m, [activeId]: zoomedCandId }));
                    setZoomedCandId(null);
                  }}>
                  이 버전 선택
                </button>
                <div className="flex gap-2">
                  {candidates.map((c, i) => (
                    <button key={c.id}
                      onClick={() => setZoomedCandId(c.id)}
                      className={clsx('w-7 h-7 rounded border text-xs2 font-bold transition-all',
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

      {/* ── PatentEditor 모달 ── */}
      {editorOpen && patentDrawings.length > 0 && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="relative w-full h-full bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxWidth: '95vw', maxHeight: '95vh' }}>
            <PatentEditor
              drawings={patentDrawings}
              activeDrawingId={activeId}
              availableReferences={availableReferences}
              onActiveDrawingChange={setActiveId}
              onSaveProject={(id, json) => onSave(id, { savedEditorJson: json, stage: 'editing' })}
              onExportComplete={(id, blob) => {
                const url = URL.createObjectURL(blob);
                onSave(id, { exportedImageUrl: url, stage: 'done' });
              }}
              onClose={() => setEditorOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
