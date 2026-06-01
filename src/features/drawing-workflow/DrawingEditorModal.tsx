// DrawingEditorModal — 심리스 스테이지 모달
// Stage A: B박스 조정 → Stage B: 변환 중 → Stage C: 후보 선택 → Stage D: PatentEditor
import { useState, useRef, useCallback } from 'react';
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
  bbox: 'B박스 조정',
  converting: 'CAD 변환',
  candidates: '후보 선택',
  editing: '편집',
};

const STAGE_ORDER: ModalStage[] = ['bbox', 'converting', 'candidates', 'editing'];

const LABEL_COLORS: Record<string, string> = {
  '제안기술': 'bg-blue-100 text-blue-700',
  '종래기술': 'bg-gray-100 text-gray-600',
  'AI생성': 'bg-violet-100 text-violet-700',
};

// 목업 CAD 후보 SVG (실제는 API 결과)
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
      else if (d.stage === 'bbox-adjusted') m[d.id] = 'bbox';
      else m[d.id] = 'bbox';
    });
    return m;
  });
  const [candidatesMap, setCandidatesMap] = useState<Record<string, CadCandidate[]>>({});
  const [selectedCandMap, setSelectedCandMap] = useState<Record<string, string>>({});
  const [regenPrompt, setRegenPrompt] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [editorOpen, setEditorOpen] = useState(() =>
    drawings.find(d => d.id === initialDrawingId)?.stage === 'done' ||
    drawings.find(d => d.id === initialDrawingId)?.stage === 'editing'
  );

  const activeDraw = drawings.find(d => d.id === activeId);
  const activeStage = stageMap[activeId] || 'bbox';
  const stageIdx = STAGE_ORDER.indexOf(activeStage);

  // B박스 조정 상태
  const [bbox, setBbox] = useState(() => activeDraw?.bbox || { x: 0, y: 0, w: 200, h: 150 });
  
  
  const imgRef = useRef<HTMLDivElement>(null);

  const goStage = useCallback((stage: ModalStage) => {
    setStageMap(m => ({ ...m, [activeId]: stage }));
  }, [activeId]);

  // CAD 변환 시작
  const startConversion = () => {
    goStage('converting');
    // mock: 1.5초 후 3개 후보 생성
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

  // 후보 선택 → 편집 모달 열기
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

  const handlePrevDrawing = () => {
    const idx = drawings.findIndex(d => d.id === activeId);
    if (idx > 0) setActiveId(drawings[idx - 1].id);
  };
  const handleNextDrawing = () => {
    const idx = drawings.findIndex(d => d.id === activeId);
    if (idx < drawings.length - 1) setActiveId(drawings[idx + 1].id);
  };

  const drawingIdx = drawings.findIndex(d => d.id === activeId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── 모달 헤더 ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-ck-border bg-white shrink-0">
        <Icon name="image" size={16} className="text-blue-700" />
        <span className="text-base2 font-bold text-gray-800">도면 편집기</span>
        {activeDraw && (
          <span className="text-sm2 text-gray-500 ml-1">
            — 기호 {activeDraw.symbol} · {activeDraw.name}
          </span>
        )}

        {/* 스테이지 인디케이터 */}
        <div className="flex items-center gap-1 ml-4">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className="flex items-center">
              <span className={clsx(
                'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center border-2 transition-all',
                i < stageIdx ? 'bg-green-500 border-green-500 text-white' :
                i === stageIdx ? 'bg-blue-700 border-blue-700 text-white' :
                'bg-white border-gray-300 text-gray-400',
              )}>
                {i < stageIdx ? <Icon name="check" size={9} /> : i + 1}
              </span>
              <span className={clsx('text-xs2 ml-1 mr-2',
                i === stageIdx ? 'text-blue-700 font-semibold' : 'text-gray-400',
              )}>{STAGE_LABELS[s]}</span>
              {i < STAGE_ORDER.length - 1 && (
                <div className={clsx('h-0.5 w-4', i < stageIdx ? 'bg-green-400' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button className="btn-outline btn-xs" onClick={onClose}>
            <Icon name="close" size={12} /> 닫기
          </button>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 좌: 도면 목록 (항상 고정) */}
        <aside className="w-44 border-r border-ck-border bg-ck-bg overflow-y-auto scroll-thin shrink-0 p-2">
          <p className="text-xs2 font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">도면 목록</p>
          {drawings.map((d) => {
            const ds = stageMap[d.id] || 'bbox';
            const isActive = d.id === activeId;
            return (
              <button key={d.id} onClick={() => setActiveId(d.id)}
                className={clsx('w-full text-left rounded-lg border p-2 mb-1.5 transition-all',
                  isActive ? 'border-blue-500 bg-blue-50' : 'border-ck-border bg-white hover:border-gray-300')}>
                {/* 썸네일 placeholder */}
                <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center mb-1.5 overflow-hidden">
                  {d.exportedImageUrl
                    ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                    : <Icon name="image" size={16} className="text-gray-300" />}
                </div>
                <p className="text-xs2 font-semibold text-gray-700 truncate">기호 {d.symbol}</p>
                <p className="text-xs2 text-gray-500 truncate">{d.name}</p>
                {/* 상태 배지 */}
                <div className="mt-1">
                  {(ds as string) === 'done' || d.stage === 'done' ? (
                    <span className="text-xs2 text-green-600 flex items-center gap-0.5">
                      <Icon name="check" size={9} /> 완료
                    </span>
                  ) : ds === 'converting' ? (
                    <span className="text-xs2 text-amber-600">변환 중…</span>
                  ) : ds === 'editing' ? (
                    <span className="text-xs2 text-blue-600">편집 중</span>
                  ) : ds === 'candidates' ? (
                    <span className="text-xs2 text-violet-600">후보 선택</span>
                  ) : (
                    <span className="text-xs2 text-gray-400">대기</span>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        {/* 우: 스테이지별 콘텐츠 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto scroll-thin p-5">

            {/* ── STAGE A: B박스 조정 ── */}
            {activeStage === 'bbox' && activeDraw && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div>
                  <p className="text-base2 font-bold text-gray-800 mb-1">B박스 조정</p>
                  <p className="text-sm2 text-gray-500">추출된 도면 영역을 확인하고 변환 범위를 조정하세요.</p>
                </div>

                {/* 도면 정보 */}
                <div className="card p-3 flex items-center gap-3">
                  <span className={clsx('text-xs2 px-2 py-0.5 rounded-full font-semibold', LABEL_COLORS[activeDraw.label])}>
                    {activeDraw.label}
                  </span>
                  <span className="text-sm2 font-semibold text-gray-700">기호 {activeDraw.symbol} — {activeDraw.name}</span>
                  {activeDraw.imageSize && (
                    <span className="text-xs2 text-gray-400 ml-auto">{activeDraw.imageSize.w}×{activeDraw.imageSize.h}</span>
                  )}
                </div>

                {/* 이미지 + B박스 편집 */}
                <div className="card p-4">
                  <div className="relative bg-gray-100 rounded-lg border border-gray-200 overflow-hidden"
                    style={{ height: 320 }}
                    ref={imgRef}>
                    {/* 원본 이미지 placeholder */}
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <Icon name="image" size={40} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm2">직무발명서에서 추출된 도면</p>
                        <p className="text-xs2 text-gray-300">p.{activeDraw.pageNumber} · {activeDraw.imageSize?.w}×{activeDraw.imageSize?.h}</p>
                      </div>
                    </div>
                    {/* B박스 오버레이 */}
                    <div
                      className="absolute border-2 border-blue-500 cursor-move bg-blue-500/10"
                      style={{
                        left: `${(bbox.x / (activeDraw.imageSize?.w || 300)) * 100}%`,
                        top: `${(bbox.y / (activeDraw.imageSize?.h || 300)) * 100}%`,
                        width: `${(bbox.w / (activeDraw.imageSize?.w || 300)) * 100}%`,
                        height: `${(bbox.h / (activeDraw.imageSize?.h || 300)) * 100}%`,
                      }}
                    >
                      <span className="absolute -top-5 left-0 text-xs2 text-blue-600 font-semibold bg-white px-1 rounded">
                        변환 영역
                      </span>
                    </div>
                  </div>
                  <p className="text-xs2 text-gray-400 mt-2">※ B박스를 드래그하여 CAD 변환 범위를 조정하세요</p>
                </div>

                {/* 도면 설명 */}
                <div className="card p-3">
                  <p className="text-xs2 font-semibold text-gray-500 mb-1">설명</p>
                  <p className="text-sm2 text-gray-700 leading-relaxed">{activeDraw.description}</p>
                </div>

                <div className="flex justify-end gap-2">
                  <button className="btn-outline btn-sm" onClick={() => setBbox(activeDraw.bbox)}>
                    초기화
                  </button>
                  <button className="btn-primary btn-sm" onClick={startConversion}>
                    CAD 변환하기 →
                  </button>
                </div>
              </div>
            )}

            {/* ── STAGE B: 변환 중 ── */}
            {activeStage === 'converting' && activeDraw && (
              <div className="max-w-2xl mx-auto">
                <p className="text-base2 font-bold text-gray-800 mb-4">CAD 변환 중</p>
                <div className="flex items-start gap-4">
                  {/* 원본 (작게) */}
                  <div className="w-24 shrink-0">
                    <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                      <Icon name="image" size={20} className="text-gray-300" />
                    </div>
                    <p className="text-xs2 text-gray-400 text-center mt-1">원본</p>
                  </div>
                  <div className="text-gray-400 text-lg2 mt-4">→</div>
                  {/* 로딩 스켈레톤 3개 */}
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex-1">
                      <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 animate-pulse flex items-center justify-center">
                        <div className="space-y-1.5 w-3/4">
                          <div className="h-2 bg-gray-200 rounded animate-pulse" />
                          <div className="h-2 bg-gray-200 rounded animate-pulse w-2/3" />
                          <div className="h-2 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </div>
                      <p className="text-xs2 text-gray-400 text-center mt-1">안 {String.fromCharCode(65 + i)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm2 text-gray-500 mt-4 text-center">AI가 3가지 CAD 스타일 버전을 생성 중입니다...</p>
              </div>
            )}

            {/* ── STAGE C: 후보 선택 ── */}
            {activeStage === 'candidates' && activeDraw && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div>
                  <p className="text-base2 font-bold text-gray-800 mb-1">CAD 버전 선택</p>
                  <p className="text-sm2 text-gray-500">3가지 변환 결과 중 편집할 버전을 선택하세요.</p>
                </div>

                <div className="flex items-start gap-3">
                  {/* 원본 (참고용, 작게) */}
                  <div className="w-20 shrink-0">
                    <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center opacity-60">
                      <Icon name="image" size={16} className="text-gray-300" />
                    </div>
                    <p className="text-xs2 text-gray-400 text-center mt-1">원본</p>
                  </div>
                  <div className="text-gray-300 text-base2 mt-3">→</div>
                  {/* 3개 후보 */}
                  {(candidatesMap[activeId] || []).map((cand, i) => {
                    const isSelected = (selectedCandMap[activeId] || candidatesMap[activeId]?.[0]?.id) === cand.id;
                    return (
                      <div key={cand.id} onClick={() => setSelectedCandMap(m => ({ ...m, [activeId]: cand.id }))}
                        className={clsx('flex-1 cursor-pointer rounded-lg border-2 p-2 transition-all',
                          isSelected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300')}>
                        <div className="aspect-[4/3] bg-gray-50 rounded border border-gray-200 flex items-center justify-center overflow-hidden mb-1.5">
                          {cand.svgDataUrl
                            ? <img src={cand.svgDataUrl} className="w-full h-full object-contain p-1" alt="" />
                            : <Icon name="image" size={20} className="text-gray-300" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={clsx('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300')}>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={clsx('text-xs2 font-semibold', isSelected ? 'text-blue-700' : 'text-gray-500')}>
                            안 {String.fromCharCode(65 + i)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
                    <button
                      className="flex items-center gap-1.5 text-xs2 text-gray-500 hover:text-violet-700 transition-colors"
                      onClick={() => setShowRegenInput(true)}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="11" height="11">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                      결과가 마음에 들지 않으면 다시 생성
                    </button>
                  )}
                </div>

                <div className="flex justify-end">
                  <button className="btn-primary btn-sm" onClick={goEditing}
                    disabled={!selectedCandMap[activeId]}>
                    이 버전으로 편집 →
                  </button>
                </div>
              </div>
            )}

            {/* ── STAGE D: 편집 대기 (편집기는 별도 모달) ── */}
            {activeStage === 'editing' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div>
                  <p className="text-base2 font-bold text-gray-800 mb-1">편집</p>
                  <p className="text-sm2 text-gray-500">편집기를 열어 도면을 수정하거나 부호를 추가하세요.</p>
                </div>
                <div className="card p-5 flex flex-col items-center gap-3 text-center">
                  <Icon name="image" size={32} className="text-blue-300" />
                  <p className="text-sm2 text-gray-600">
                    {activeDraw?.name} 도면이 편집 준비되었습니다.
                  </p>
                  <button className="btn-primary btn-sm" onClick={() => setEditorOpen(true)}>
                    편집기 열기 →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── 하단 내비게이션 ── */}
          {(activeStage !== 'editing') && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-ck-border bg-ck-bg shrink-0">
              <button className="btn-outline btn-sm" disabled={drawingIdx === 0} onClick={handlePrevDrawing}>
                ← 이전 도면
              </button>
              <span className="text-xs2 text-gray-400">
                {drawingIdx + 1} / {drawings.length}
              </span>
              <button className="btn-outline btn-sm" disabled={drawingIdx === drawings.length - 1} onClick={handleNextDrawing}>
                다음 도면 →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PatentEditor 별도 모달 (z-60, DrawingEditorModal 위에 겹침) ── */}
      {editorOpen && patentDrawings.length > 0 && (
        <div className="fixed inset-0 z-60 flex flex-col bg-white">
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
      )}
    </div>
  );
}
