// SpecView
import { useEffect, useRef, useState } from 'react';
import { SpecEditorView } from './SpecEditorView';
import { DrawingEditorModal } from '../features/drawing-workflow/DrawingEditorModal';
import { MOCK_DRAWINGS } from '../features/drawing-workflow/types';
import {
  openEditorTab, onEditorResult, isMobile,
} from '../features/drawing-workflow/editorChannel';
import type { InventionComponent } from '../features/patent-editor';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { PreviewModal } from '../components/PreviewModal';
import type { PreviewSection } from '../components/PreviewModal';
import clsx from 'clsx';
import {
  generateTitleCandidates, generateAbstractCandidates,
  generateComponentCandidates,
} from '../features/spec/mockAiService';
import type { SpecAnalysisResult, SpecAnalysisState } from '../features/spec/types';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import { analyzePromptClarity, generateIntentOptions, generateMockModification } from '../features/ai/clarityAnalyzer';

type StepId = 'upload' | 'title' | 'description' | 'components' | 'drawings' | 'claims' | 'abstract';
const STEPS: { id: StepId; num: number; short: string }[] = [
  { id: 'upload', num: 1, short: '시작' },
  { id: 'title', num: 2, short: '명칭' },
  { id: 'description', num: 3, short: '설명' },
  { id: 'components', num: 4, short: '구성요소' },
  { id: 'drawings', num: 5, short: '도면' },
  { id: 'claims', num: 6, short: '청구항' },
  { id: 'abstract', num: 7, short: '요약서' },
];

const STEP_LABEL: Partial<Record<StepId, string>> = {
  title: '발명의 명칭', description: '발명의 설명', components: '구성요소',
  drawings: '도면', claims: '청구항', abstract: '요약서',
};
const CONFIRM_LABEL: Partial<Record<StepId, string>> = {
  title: '발명의 명칭 선택 완료', description: '발명의 설명 선택 완료',
  components: '구성요소 선택 완료', drawings: '도면 선택 완료',
  claims: '청구항 선택 완료', abstract: '요약서 선택 완료',
};
const AI_NEXT: Record<StepId, string> = {
  upload: '업로드하신 문서를 분석했습니다. 발명의 명칭 후보를 생성합니다.',
  title: '발명 명칭을 확정했습니다. 발명의 설명 항목을 분석합니다.',
  description: '설명 항목을 확정했습니다. 발명의 구성요소를 추출합니다.',
  components: '구성요소를 확정했습니다. 업로드된 도면을 분석합니다.',
  drawings: '도면을 확정했습니다. 청구항을 생성합니다.',
  claims: '청구항을 확정했습니다. 요약서를 생성합니다.',
  abstract: '모든 분석 항목이 확정되었습니다. 명세서를 생성할 준비가 완료되었습니다.',
};
const GUIDE_CANDS: Record<string, string[]> = {
  title: [
    '인공지능 기반 자율주행 차량의 라이다 객체 감지 장치 및 방법',
    '딥러닝을 이용한 3D 포인트 클라우드 실시간 객체 인식 시스템',
    '자율주행 환경에서의 다중 센서 융합 기반 객체 검출 방법',
  ],
  description: [
    '기술분야: 본 발명은 자율주행 차량에서 라이다 센서를 이용한 객체 감지 분야에 관한 것이다.',
    '배경기술: 자율주행 기술의 발전으로 LiDAR 기반 3D 객체 감지가 핵심 기술로 부각되고 있다.',
    '해결과제: 기존 방식의 실시간 처리 속도 한계 및 불완전한 포인트 클라우드 처리 문제를 해결한다.',
    '해결수단: 딥러닝 기반 PointNet++ 아키텍처를 적용하여 포인트 클라우드를 직접 처리한다.',
    '효과: 처리 속도 40% 향상 및 객체 인식 정확도 95% 이상 달성.',
  ],
  abstract: [
    '본 발명은 자율주행 차량에서 라이다 센서를 이용하여 주변 객체를 실시간으로 감지하고 분류하는 장치 및 방법에 관한 것이다.',
  ],
};

export function SpecView() {
  const { tasks, activeTaskId, taskUpdate } = useStore();
  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
  const savedSpec = task?.id ? loadSpecState(task.id) : null;

  const [mainView, setMainView] = useState<'analysis' | 'editor'>(savedSpec?.mainView ?? 'analysis');
  const handleSetMainView = (v: 'analysis' | 'editor') => setMainView(v);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  const [specFocusCtx, setSpecFocusCtx] = useState<FocusCtx | null>(null);
  const guidePanelInputRef = useRef<HTMLInputElement>(null);
  const [descMode] = useState<string>('view');
  const [descSubInfo, setDescSubInfo] = useState<{
    subStep: number; currentLabel: string; allDone: boolean; doConfirm: (() => void) | null;
  }>({ subStep: 0, currentLabel: '기술분야', allDone: false, doConfirm: null });
  const [confirmedComponents, setConfirmedComponents] = useState<InventionComponent[]>([
    { number: '100', name: '데이터 수집부' },
    { number: '200', name: '전처리부' },
    { number: '300', name: '특징 추출부' },
    { number: '400', name: '인식부' },
    { number: '500', name: '출력부' },
  ]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compModalMounted, setCompModalMounted] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<StepId>>(new Set());
  const [phase, setPhase] = useState<'upload' | 'direct' | 'flow' | 'done'>(savedSpec?.phase ?? 'upload');
  const [curStep, setCurStep] = useState<StepId>((savedSpec?.curStep as StepId) ?? 'upload');
  const [confirmed, setConfirmed] = useState<Partial<Record<StepId, string>>>((savedSpec?.confirmed as Partial<Record<StepId, string>>) ?? {});
  const [guideStep, setGuideStep] = useState<StepId>((savedSpec?.curStep as StepId) ?? 'title');
  const [gSel, setGSel] = useState<Partial<Record<StepId, string>>>((savedSpec?.gSel as Partial<Record<StepId, string>>) ?? {});

  const [diTitle, setDiTitle] = useState(savedSpec?.diTitle ?? '');
  const [diField, setDiField] = useState(savedSpec?.diField ?? '');
  const [diContent, setDiContent] = useState(savedSpec?.diContent ?? '');
  const [diProblem, setDiProblem] = useState(savedSpec?.diProblem ?? '');
  const [diKeywords, setDiKeywords] = useState(savedSpec?.diKeywords ?? '');
  // 기초자료 보기 패널
  const [sourceDataOpen, setSourceDataOpen] = useState(false);

  // AI 분석 생성 후보 (mockAiService 연결)
  const [titleCandidates, setTitleCandidates] = useState<string[]>(savedSpec?.titleCandidates ?? []);
  const [abstractCandidates, setAbstractCandidates] = useState<string[]>(savedSpec?.abstractCandidates ?? []);
  const [aiComponents, setAiComponents] = useState<{ id: number; text: string; sel: boolean; num: string; depth: number }[]>(
    (savedSpec?.componentItems as { id: number; text: string; sel: boolean; num: string; depth: number }[]) ?? []
  );
  const [analyzing, setAnalyzing] = useState(false);

  const flowRef = useRef<HTMLDivElement>(null);
  const flowSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 자동 저장 — 400ms 디바운스
  useEffect(() => {
    if (!task?.id) return;
    if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current);
    flowSaveTimerRef.current = setTimeout(() => {
      saveSpecState(task.id, {
        phase,
        curStep,
        confirmed: confirmed as SpecAnalysisState['confirmed'],
        gSel: gSel as SpecAnalysisState['gSel'],
        diTitle, diField, diContent, diProblem, diKeywords,
        titleCandidates,
        abstractCandidates,
        componentItems: aiComponents as SpecAnalysisState['componentItems'],
        mainView,
      });
    }, 400);
    return () => { if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current); };
  }, [phase, curStep, confirmed, gSel, diTitle, diField, diContent,
      diProblem, diKeywords, titleCandidates, abstractCandidates, aiComponents, mainView, task?.id]);

  // U7: 분석 진행 중 이탈 확인
  useEffect(() => {
    if (phase !== 'flow') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '분석이 진행 중입니다. 페이지를 떠나시겠습니까?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const si = (id: StepId) => STEPS.findIndex(s => s.id === id);
  const isConfirmed = (id: StepId) => id in confirmed;
  const isSpecialStep = (id: StepId) =>
    id === 'description' || id === 'components' || id === 'drawings' || id === 'claims' || id === 'abstract';
  const isVisible = (id: StepId) => {
    if (id === 'upload') return true;
    if (phase === 'upload' || phase === 'direct') return false;
    return si(id) <= si(curStep);
  };

  const resetAnalysis = () => {
    if (!window.confirm('처음부터 다시 시작하면 모든 분석 내용이 삭제됩니다. 계속하시겠습니까?')) return;
    setPhase('upload');
    setCurStep('upload');
    setConfirmed({});
    setGSel({});
    setTitleCandidates([]);
    setAbstractCandidates([]);
    setAiComponents([]);
    if (task?.id) {
      saveSpecState(task.id, {
        phase: 'upload', curStep: 'upload',
        confirmed: {}, gSel: {},
        titleCandidates: [], abstractCandidates: [], componentItems: [],
        mainView: 'analysis',
      });
    }
  };

  const confirm = (id: StepId) => {
    const val = gSel[id] || GUIDE_CANDS[id]?.[0] || '(확정)';
    setConfirmed(p => ({ ...p, [id]: val }));
    // U5: 이전 확정 카드 자동 접기
    setExpandedCards(new Set()); // 새 단계 확정 시 모두 접음
    const next = STEPS[si(id) + 1];
    if (next) { setCurStep(next.id); setGuideStep(next.id); }
    else setPhase('done');
    setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
  };
  const reselect = (id: StepId) => {
    const p = { ...confirmed }; delete p[id];
    setConfirmed(p); setCurStep(id); setGuideStep(id);
  };
  const startFlow = (override?: { title: string; field: string; content: string }) => {
    const title   = override?.title   ?? diTitle.trim();
    const field   = override?.field   ?? diField.trim();
    const content = override?.content ?? diContent.trim();
    if (!title || !field || !content) return;
    setAnalyzing(true);
    const input = { title, field, content, problem: diProblem.trim(), keywords: diKeywords.trim() };
    setTimeout(() => {
      const comps = generateComponentCandidates(input);
      setTitleCandidates(generateTitleCandidates(input));
      setAbstractCandidates(generateAbstractCandidates(input));
      setAiComponents(comps);
      // 이전 확정 상태 초기화 (새 분석 시작)
      setConfirmed({});
      setGSel({});
      setPhase('flow');
      setCurStep('title');
      setGuideStep('title');
      setAnalyzing(false);
      // 발명 제목으로 작업명 자동 업데이트 (기본값일 때만)
      if (task?.id && title && (!task.name || task.name === '새 명세서' || task.name === '새 작업')) {
        const taskName = title.length > 40 ? title.slice(0, 40) + '…' : title;
        taskUpdate(task.id, { name: taskName });
      }
      setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    }, 1500);
  };
  const doneCount = Object.keys(confirmed).length;

  // 미리보기 섹션 구성 — 확정된 내용 기반 (B16 fix)
  const makePreviewSections = (): PreviewSection[] => {
    const title = gSel['title'] || confirmed['title'] || task?.name || '';
    const descRaw = gSel['description'] || confirmed['description'] || '';
    const extractDesc = (label: string) => {
      const m = descRaw.match(new RegExp(`【${label}】\\n([^【]*)`));
      return m?.[1]?.trim() || '';
    };
    const claims = gSel['claims'] || confirmed['claims'] || '';
    const abstract = gSel['abstract'] || confirmed['abstract'] || '';
    return [
      { label: '발명의 명칭', content: title },
      { label: '기술분야', content: extractDesc('기술분야') },
      { label: '배경기술', content: extractDesc('배경기술') },
      { label: '해결하고자 하는 과제', content: extractDesc('해결하려는 과제') },
      { label: '과제의 해결 수단', content: extractDesc('과제의 해결 수단') },
      { label: '발명의 효과', content: extractDesc('발명의 효과') },
      { label: '청구범위', content: claims },
      { label: '요약서', content: abstract },
    ].filter(s => s.content.trim());
  };

  // 에디터 진입 시 analysisResult 구성 (#58 fix)
  const makeAnalysisResult = (): SpecAnalysisResult => {
    const title = gSel['title'] || confirmed['title'] || diTitle || task?.name || '';
    const descRaw = gSel['description'] || confirmed['description'] || '';
    const extractDescSec = (label: string) => {
      const m = descRaw.match(new RegExp(`【${label}】\\n([^【]*)`));
      return m?.[1]?.trim() || '';
    };
    const comps = aiComponents.filter(c => c.sel);
    const drawDesc = (MOCK_DRAWINGS as any[]).map((d, i) => `도 ${i + 1}은 ${d.name}.`).join('\n');
    const detail = comps.length > 0
      ? comps.map(c => {
          const name = c.text.split(':')[0];
          const desc = (c.text.split(':')[1] || '').trim();
          return `상기 ${name}${c.num ? `(${c.num})` : ''}은 ${desc || '관련 기능을 수행한다.'}`;
        }).join('\n\n')
      : '';
    return {
      title,
      tech: extractDescSec('기술분야'),
      bg: extractDescSec('배경기술'),
      problem: extractDescSec('해결하려는 과제'),
      solution: extractDescSec('과제의 해결 수단'),
      effect: extractDescSec('발명의 효과'),
      drawDesc,
      detail,
      claims: gSel['claims'] || confirmed['claims'] || '',
      abstract: gSel['abstract'] || confirmed['abstract'] || '',
      drawings: MOCK_DRAWINGS as any[],
      componentItems: comps as any[],
    };
  };

  if (mainView === 'editor') {
    return (
      <>
        <SpecEditorView
          task={task}
          onBack={() => handleSetMainView('analysis')}
          confirmedTitle={gSel['title'] || confirmed['title'] || diTitle}
          analysisResult={makeAnalysisResult()}
        />
        {previewOpen && <PreviewModal taskName={task?.name} sections={makePreviewSections()} onClose={() => setPreviewOpen(false)} />}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">



      {/* 기초자료 보기 슬라이드 패널 — fixed overlay (B9: absolute → content 가림 수정) */}
      {sourceDataOpen && (
        <>
          <div className="fixed inset-0 z-20 bg-black/20" onClick={() => setSourceDataOpen(false)} aria-hidden="true" />
          <div className="fixed top-0 right-0 z-30 h-full w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col" style={{ maxHeight: '100vh' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-sm2 font-semibold text-gray-800">기초자료</span>
            <button onClick={() => setSourceDataOpen(false)} className="text-gray-400 hover:text-gray-600">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 text-xs2">
            {diTitle ? (
              <>
                <div><p className="font-semibold text-gray-500 mb-1">발명의 명칭 (가제)</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5">{diTitle}</p></div>
                {diField && <div><p className="font-semibold text-gray-500 mb-1">기술 분야</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5">{diField}</p></div>}
                {diContent && <div><p className="font-semibold text-gray-500 mb-1">발명의 핵심 내용</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">{diContent}</p></div>}
                {diProblem && <div><p className="font-semibold text-gray-500 mb-1">해결하려는 과제</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">{diProblem}</p></div>}
                {diKeywords && <div><p className="font-semibold text-gray-500 mb-1">참고 키워드 / 선행기술</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5">{diKeywords}</p></div>}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Icon name="doc" size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm2">직접 입력한 기초자료가 없습니다.</p>
                <p className="text-xs2 mt-1">파일 업로드 또는 직접 입력으로<br/>기초자료를 추가해주세요.</p>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Stepper — 에디터 컬럼 내부: 에디터 너비 기준으로 중앙 정렬 */}
          <div className="relative flex items-center border-b border-ck-border shrink-0" style={{ height: 48 }}>
            {(phase === 'flow' || phase === 'done') && (
              <button
                onClick={resetAnalysis}
                className="absolute left-4 text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1 z-10"
                title="처음부터 다시 시작"
              >
                ↺ 다시 시작
              </button>
            )}
            <div className="flex items-center justify-center w-full overflow-x-auto scroll-thin px-2 md:px-24">
              {STEPS.map((s, i) => {
                const isDone = si(s.id) < si(curStep) && (phase === 'flow' || phase === 'done');
                const active = s.id === curStep && (phase === 'flow' || phase === 'done');
                const locked = phase !== 'flow' && phase !== 'done' && s.id !== 'upload';
                const prevDone = i > 0 && si(STEPS[i - 1].id) < si(curStep) && (phase === 'flow' || phase === 'done');
                return (
                  <div key={s.id} className="flex items-center shrink-0">
                    {i > 0 && (
                      <div className={clsx('h-0.5 shrink-0 mx-1', prevDone ? 'bg-green-500' : 'bg-gray-200')}
                        style={{ width: 20 }} />
                    )}
                    <button
                      disabled={locked}
                      onClick={() => { if (!locked && (phase === 'flow' || phase === 'done')) { setCurStep(s.id); if (s.id !== 'upload') setGuideStep(s.id); } }}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors',
                        active && 'border-blue-200 bg-blue-50',
                        !active && 'border-transparent',
                        locked && 'cursor-default opacity-60',
                      )}>
                      <span className={clsx(
                        'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 border-2',
                        active && 'border-blue-600 bg-blue-600 text-white',
                        isDone && !active && 'border-green-500 bg-green-500 text-white',
                        locked && 'border-gray-300 bg-white text-gray-400',
                        !active && !isDone && !locked && 'border-gray-400 bg-white text-gray-500',
                      )}>
                        {isDone && !active ? <Icon name="check" size={10} /> : s.num}
                      </span>
                      <span className={clsx(
                        'text-sm2 max-md:hidden',
                        active && 'max-md:inline text-blue-700 font-semibold',
                        isDone && !active && 'text-green-700 font-medium',
                        locked && 'text-gray-400',
                        !active && !isDone && !locked && 'text-gray-500',
                      )}>{s.short}</span>
                    </button>
                  </div>
                );
              })}
            </div>
            {/* 모바일 전용 진행 표시 */}
            {(phase === 'flow' || phase === 'done') && (
              <div className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 text-xs2 text-zinc-400 pointer-events-none">
                {STEPS.findIndex(s => s.id === curStep) + 1} / {STEPS.length}
              </div>
            )}
          </div>

        <div ref={flowRef} className="flex-1 overflow-y-auto scroll-thin bg-ck-bg">
          <div className="max-w-3xl mx-auto py-8 px-4 space-y-3">

            {/* 업로드 존 — PDF 파일 업로드 전용 */}
            {phase !== 'flow' && phase !== 'done' && phase !== 'direct' && (
              <div className="text-center py-4">
                <Icon name="doc" size={48} className="text-blue-700 mx-auto mb-3" />
                <h2 className="text-lg2 font-bold text-gray-800 mb-2">새 특허 명세서 작성</h2>
                <p className="text-md2 text-gray-500 mb-6">직무발명서(PDF)를 업로드하면 AI가 자동으로 분석합니다.</p>
                <div
                  onClick={() => {
                    if (phase !== 'upload') return;
                    // 테스트용: 기본값으로 즉시 분석 시작 (state 업데이트 대기 없이 override 전달)
                    startFlow({
                      title:   diTitle.trim()   || '직무발명서',
                      field:   diField.trim()   || '기술',
                      content: diContent.trim() || '발명 내용',
                    });
                  }}
                  className={`border-2 border-dashed rounded-xl p-10 mb-5 transition-all ${phase === 'upload' ? 'border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30' : 'border-gray-200 opacity-50'}`}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-gray-400">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-md2 text-gray-600">직무발명서 PDF를 업로드 하세요.</p>
                </div>
              </div>
            )}

            {/* 직접입력 폼 — 원본: AI 분석 시작 후에도 계속 표시 (필드 잠금) */}
            {(phase === 'direct' || ((phase === 'flow' || phase === 'done') && diTitle.trim())) && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50">
                  <Icon name="edit" size={20} className="text-blue-700" />
                  <div>
                    <h3 className="text-base2 font-semibold text-gray-800">발명 기초 내용 입력</h3>
                    <p className="text-sm2 text-gray-500">아래 항목을 입력하면 AI가 명세서 항목을 분석합니다. <span className="text-red-500">*</span> 표시는 필수 항목입니다.</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { label: '발명의 명칭 (가제)', ph: '예: 인공지능 기반 특허 명세서 자동 생성 시스템', val: diTitle, set: setDiTitle, req: true },
                    { label: '기술 분야', ph: '예: 인공지능, 자연어 처리, 특허 자동화', val: diField, set: setDiField, req: true },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-sm2 font-semibold text-gray-700 mb-1">{f.label}{f.req && <span className="text-red-500 ml-0.5">*</span>}</label>
                      <input className="input py-2" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm2 font-semibold text-gray-700 mb-1">발명의 핵심 내용<span className="text-red-500 ml-0.5">*</span></label>
                    <textarea className="input py-2" rows={4} placeholder="발명의 핵심 기술과 구성, 작동 원리 등을 자유롭게 기술하세요..." value={diContent} onChange={e => setDiContent(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm2 font-semibold text-gray-700 mb-1">해결하려는 과제</label>
                    <textarea className="input py-2" rows={2} placeholder="기존 기술의 문제점 또는 본 발명이 해결하려는 과제를 입력하세요..." value={diProblem} onChange={e => setDiProblem(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm2 font-semibold text-gray-700 mb-1">참고 키워드 / 선행기술</label>
                    <input className="input py-2" placeholder="예: 트랜스포머, GPT, KR10-2023-0012345" value={diKeywords} onChange={e => setDiKeywords(e.target.value)} />
                  </div>
                </div>
                {/* flow/done 상태에서는 버튼 숨김 (폼은 읽기전용으로 계속 표시) */}
                {phase === 'direct' && (
                  <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <button className="btn-outline btn-sm" onClick={() => {
                      if ((diTitle || diContent) && !window.confirm('입력한 내용이 삭제됩니다. 계속할까요?')) return;
                      setPhase('upload');
                    }}>취소</button>
                    <button className="btn-primary btn-sm" onClick={() => startFlow()}
                      disabled={!diTitle.trim() || !diField.trim() || !diContent.trim() || analyzing}>
                      {analyzing
                        ? <><span className="inline-block animate-spin mr-1">↻</span>AI 분석 중...</>
                        : <><Icon name="star" size={13} /> AI 분석 시작</>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {(phase === 'flow' || phase === 'done') && (
              <>
                <AiMsg text={AI_NEXT.upload} />
                {STEPS.slice(1).map(s => {
                  if (!isVisible(s.id)) return null;
                  const isDone = si(s.id) < si(curStep) && (phase === 'flow' || phase === 'done');
                  return (
                    <div key={s.id} className="space-y-3">
                      <AiMsg text={
                        isSpecialStep(s.id) ? (
                          <><strong>{STEP_LABEL[s.id]}</strong><br />
                          업로드 내용을 기반으로 {STEP_LABEL[s.id]} 항목을 준비했습니다. 아래에서 확인하고 항목을 채우세요.</>
                        ) : (
                          <><strong>{STEP_LABEL[s.id]}</strong><br />
                          업로드 내용을 기반으로 {STEP_LABEL[s.id]} 후보를 생성했습니다. 아래에서 선택하거나 직접 입력하세요.</>
                        )
                      } />
                      {/* 현재 단계 후보 카드 인라인 — 비특수 단계만 */}
                      {s.id === guideStep && !isDone && !isSpecialStep(s.id) && (
                        <InlineCandidateCards
                          stepId={s.id}
                          cands={(s.id === 'title' ? (titleCandidates.length > 0 ? titleCandidates : undefined) : undefined) || GUIDE_CANDS[s.id] || []}
                          gSel={gSel}
                          setGSel={setGSel}
                          setFocusCtx={setSpecFocusCtx}
                          guidePanelInputRef={guidePanelInputRef}
                        />
                      )}
                      {/* 현재 단계 특수 패널 인라인 */}
                      {s.id === guideStep && !isDone && isSpecialStep(s.id) && (
                        <div className="mt-3">
                          {s.id === 'description' && (
                            <DescriptionPanel
                              onUpdate={v => setGSel(p => ({ ...p, description: v }))}
                              onSubInfoChange={setDescSubInfo}
                              onFocusContext={setSpecFocusCtx}
                              guidePanelInputRef={guidePanelInputRef}
                            />
                          )}
                          {s.id === 'components' && (
                            <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2 ml-1.5">
                              <div className="rounded-xl border-2 border-zinc-200 bg-white p-3">
                                <div className="flex items-center justify-between mb-2.5">
                                  <span className="text-xs2 font-semibold text-gray-600">AI 추출 구성요소 ({confirmedComponents.length}개)</span>
                                  <button
                                    onClick={() => { setCompModalOpen(true); setCompModalMounted(true); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs2 font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                  >
                                    <Icon name="edit" size={10} />
                                    구성요소 편집 →
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  {confirmedComponents.slice(0, 6).map(c => (
                                    <div key={c.number || c.name} className="flex items-center gap-2 py-0.5">
                                      <span className="text-xs2 font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded w-10 text-center shrink-0">{c.number || '—'}</span>
                                      <span className="text-sm2 text-gray-700">{c.name}</span>
                                    </div>
                                  ))}
                                  {confirmedComponents.length > 6 && (
                                    <p className="text-xs2 text-gray-400 pl-12">+{confirmedComponents.length - 6}개 더</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {s.id === 'drawings' && (
                            <DrawingsPanel
                              done={false}
                              onConfirm={() => confirm('drawings')}
                              onUpdate={v => setGSel(p => ({ ...p, drawings: v }))}
                              inventionComponents={confirmedComponents}
                            />
                          )}
                          {s.id === 'claims' && (
                            <ClaimsPanel
                              done={false}
                              onConfirm={() => confirm('claims')}
                              onUpdate={v => setGSel(p => ({ ...p, claims: v }))}
                              onFocusContext={setSpecFocusCtx}
                              guidePanelInputRef={guidePanelInputRef}
                            />
                          )}
                          {s.id === 'abstract' && (
                            <AbstractPanel
                              done={false}
                              onConfirm={() => confirm('abstract')}
                              onUpdate={v => setGSel(p => ({ ...p, abstract: v }))}
                              onFocusContext={setSpecFocusCtx}
                              guidePanelInputRef={guidePanelInputRef}
                            />
                          )}
                        </div>
                      )}
                      {isDone && (() => {
                        const isExpanded = expandedCards.has(s.id);
                        const confirmedVal = confirmed[s.id] || '';
                        // U4: 도면 완료 요약 표시
                        const drawingSummary = s.id === 'drawings'
                          ? confirmedVal.split('\n')[0] // "도면 N개 중 M개 편집 완료"
                          : null;
                        // 짧은 요약 (접힌 상태에서 표시)
                        const summary = drawingSummary ||
                          confirmedVal.split('\n')[0]?.slice(0, 60) + (confirmedVal.length > 60 ? '...' : '');
                        return (
                          <>
                            <div className="flex items-start gap-3 flex-row-reverse">
                              <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs2 font-bold flex items-center justify-center shrink-0">나</div>
                              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 shadow-xs min-w-0 break-words max-w-[calc(100%-2.75rem)]">
                                {/* 헤더: 항상 표시 (U5: 클릭으로 접기/펼치기) */}
                                <button
                                  className="w-full flex items-center gap-2 text-left"
                                  onClick={() => setExpandedCards(prev => {
                                    const next = new Set(prev);
                                    next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                                    return next;
                                  })}
                                >
                                  <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><Icon name="check" size={10} /></span>
                                  <span className="text-sm2 font-semibold text-blue-700 flex-1 min-w-0">{CONFIRM_LABEL[s.id]}</span>
                                  {!isExpanded && <span className="text-xs2 text-gray-400 truncate max-w-[160px]">{summary}</span>}
                                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10"
                                    className={clsx('text-gray-400 shrink-0 transition-transform', isExpanded && 'rotate-180')}>
                                    <path d="M2 4l3 3 3-3"/>
                                  </svg>
                                </button>
                                {/* 상세 내용: 펼쳐진 상태에서만 */}
                                {isExpanded && (
                                  <div className="mt-2">
                                    <div className="bg-white rounded-lg border border-blue-100 p-3 mb-2">
                                      {s.id === 'description' ? (
                                        <div className="space-y-2">
                                          {confirmedVal.split('\n\n').filter(Boolean).map((block, bi) => {
                                            const lines = block.split('\n');
                                            const label = lines[0]?.replace(/[【】]/g, '').trim();
                                            const content = lines.slice(1).join('\n').trim();
                                            return (
                                              <div key={bi}>
                                                <p className="text-xs2 font-bold text-blue-700 mb-0.5">{label}</p>
                                                <p className="text-xs2 text-gray-700 leading-relaxed">{content}</p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : s.id === 'claims' ? (
                                        <div className="space-y-2">
                                          {confirmedVal.split('\n\n').filter(Boolean).map((block, bi) => {
                                            if (bi === 0) return <p key={bi} className="text-xs2 font-bold text-green-700">{block}</p>;
                                            const lines = block.split('\n');
                                            const header = lines[0];
                                            const content = lines.slice(1).join(' ').trim();
                                            const isFirst = bi === 1;
                                            return (
                                              <div key={bi} className={clsx('pl-2 border-l-2', isFirst ? 'border-purple-400' : 'border-amber-300')}>
                                                <p className={clsx('text-xs2 font-bold mb-0.5', isFirst ? 'text-purple-700' : 'text-amber-700')}>{header}</p>
                                                <p className="text-xs2 text-gray-600 leading-relaxed line-clamp-2">{content}</p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-sm2 text-gray-700 leading-relaxed">{confirmedVal}</p>
                                      )}
                                    </div>
                                    <button onClick={() => reselect(s.id)} className="text-xs2 text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                      <Icon name="chevron-left" size={10} /> 다시 선택
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <AiMsg text={AI_NEXT[s.id]} />
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
                {phase === 'done' && (
                  <div className="text-center py-8">
                    <Icon name="logo" size={40} className="text-blue-700 mx-auto mb-3" />
                    <h3 className="text-lg2 font-bold text-gray-800 mb-2">모든 분석이 완료되었습니다</h3>
                    {task?.id && sessionStorage.getItem(`axp_mainview_${task.id}`) === 'editor' ? (
                      <>
                        <p className="text-md2 text-gray-500 mb-4">이미 생성된 명세서 에디터로 돌아갈 수 있습니다.</p>
                        <button
                          onClick={() => handleSetMainView('editor')}
                          className="btn-primary btn-sm mx-auto flex items-center gap-1.5">
                          <Icon name="doc" size={13} /> 명세서 에디터 열기 →
                        </button>
                      </>
                    ) : (
                      <p className="text-md2 text-gray-500">
                        확정된 내용을 바탕으로 특허 명세서를 AI가 생성합니다.<br/>
                        <span className="text-blue-700 font-medium">오른쪽 패널</span>의{' '}
                        <strong>명세서 AI 생성</strong> 버튼을 눌러 시작하세요.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {/* 네비게이션 바 — 본문 하단 */}
        {(phase === 'flow' || phase === 'done') && (
          <div className="shrink-0 border-t border-ck-border bg-white w-full">
            <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
              <button
                onClick={() => {
                  const idx = STEPS.findIndex(s => s.id === guideStep);
                  if (idx > 1) { setGuideStep(STEPS[idx - 1].id); if (phase === 'done') setPhase('flow'); }
                }}
                disabled={STEPS.findIndex(s => s.id === guideStep) <= 1}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >← 이전</button>
              <div className="flex items-center gap-2">
                {guideStep === 'drawings' && !confirmed['drawings'] && (
                  <button onClick={() => confirm('drawings')} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">건너뛰기</button>
                )}
                {doneCount >= 5 ? (
                  <button onClick={() => handleSetMainView('editor')} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 transition-colors">명세서 AI 생성</button>
                ) : guideStep === 'description' ? (
                  descSubInfo.allDone ? (
                    <button onClick={() => confirm('description')} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 transition-colors">다음 →</button>
                  ) : (
                    <button onClick={() => descSubInfo.doConfirm?.()} disabled={descMode === 'prompt' || descMode === 'diff'} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-40 transition-colors">다음 →</button>
                  )
                ) : !isSpecialStep(guideStep) ? (
                  <button onClick={() => { const cur = gSel[guideStep]; if (cur?.trim()) confirm(guideStep); }} disabled={!gSel[guideStep]?.trim()} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-40 transition-colors">다음 →</button>
                ) : (
                  <button onClick={() => confirm(guideStep)} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 transition-colors">다음 →</button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>

        {/* 모바일 배경 오버레이 */}
        {mobileGuideOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileGuideOpen(false)}
          />
        )}

        {(phase === 'flow' || phase === 'done') && (
          <GuidePanel
            key={`guide-panel-${guideStep}`}
            step={guideStep}
            confirmed={confirmed}
            mobileOpen={mobileGuideOpen}
            onMobileClose={() => setMobileGuideOpen(false)}
            focusCtx={specFocusCtx}
            setFocusCtx={setSpecFocusCtx}
            chatInputRef={guidePanelInputRef}
          />
        )}

        {/* 모바일 전용: AI 가이드 FAB */}
        {(phase === 'flow' || phase === 'done') && (
          <button
            className="md:hidden fixed bottom-5 right-4 z-30 bg-blue-600 text-white rounded-full px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform"
            onClick={() => setMobileGuideOpen(true)}
            aria-label="AI 가이드 열기"
          >
            <Icon name="star" size={14} />
            AI 가이드
          </button>
        )}
      </div>
      {previewOpen && <PreviewModal taskName={task?.name} sections={makePreviewSections()} onClose={() => setPreviewOpen(false)} />}
      {compModalMounted && (
        <div
          style={{ display: compModalOpen ? undefined : 'none' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setCompModalOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 560, maxWidth: '90vw', maxHeight: '82vh' }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 shrink-0">
              <span className="text-base2 font-bold text-gray-800">구성요소 편집</span>
              <button onClick={() => setCompModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <ComponentsPanel
                done={false}
                onConfirm={() => setCompModalOpen(false)}
                onUpdate={v => setGSel(p => ({ ...p, components: v }))}
                onComponentsChange={setConfirmedComponents}
                initialItems={aiComponents}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AiMsg({ text }: { text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs2 font-bold flex items-center justify-center shrink-0">AI</div>
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-md2 text-gray-700 shadow-xs max-w-2xl">
        {text}
      </div>
    </div>
  );
}

// ── GuidePanel 공유 타입 ────────────────────────────────────────
type FocusCtx = { text: string; label: string; apply: (newText: string) => void };
type GuideChatMsg = {
  id: number;
  role: 'user' | 'ai';
  text: string;
  proposed?: string;
  applyFn?: () => void;
  intentOptions?: string[];
  selectedIntent?: string;
  sourceMsg?: string;
  sourceFocusCtx?: FocusCtx;
  applied?: boolean;
};

// ── 본문 인라인 후보 카드 ─────────────────────────────────────────
function InlineCandidateCards({
  stepId, cands, gSel, setGSel, setFocusCtx, guidePanelInputRef,
}: {
  stepId: StepId;
  cands: string[];
  gSel: Partial<Record<StepId, string>>;
  setGSel: React.Dispatch<React.SetStateAction<Partial<Record<StepId, string>>>>;
  setFocusCtx: (ctx: FocusCtx | null) => void;
  guidePanelInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const curSel = gSel[stepId] || cands[0] || '';
  const [editVals, setEditVals] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!gSel[stepId] && cands[0]) {
      setGSel(p => ({ ...p, [stepId]: cands[0] }));
    }
  }, [stepId, cands[0]]);

  const getCardVal = (i: number) => editVals[i] ?? cands[i];

  const selectCard = (i: number) => {
    const cardVal = getCardVal(i);
    setGSel(p => ({ ...p, [stepId]: cardVal }));
    setFocusCtx({ text: cardVal, label: STEP_LABEL[stepId] || stepId, apply: (newText) => { setEditVals(prev => ({ ...prev, [i]: newText })); setGSel(p => ({ ...p, [stepId]: newText })); } });
  };
  const requestAI = (i: number) => {
    selectCard(i);
    setTimeout(() => guidePanelInputRef.current?.focus(), 50);
  };

  return (
    <div className="space-y-2 mt-3">
      {cands.map((c, i) => {
        const cardVal = getCardVal(i);
        const letter = letters[i] || String(i + 1);
        const isSelected = curSel === cardVal || curSel === c;
        return (
          <div
            key={i}
            onClick={() => selectCard(i)}
            className={clsx(
              'rounded-xl border-2 p-3 cursor-pointer transition-all bg-white',
              isSelected && 'border-blue-600 bg-blue-50 shadow-sm',
              !isSelected && 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30',
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={clsx(
                'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0',
                isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
              )}>{letter}</span>
              {isSelected && <span className="text-xs2 text-blue-600 font-semibold">✓ 선택됨</span>}
              <div className="ml-auto">
                <button
                  onClick={e => { e.stopPropagation(); requestAI(i); }}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                  AI 수정
                </button>
              </div>
            </div>
            <p className="text-sm2 font-semibold text-gray-800 leading-snug">{cardVal}</p>
          </div>
        );
      })}

      {/* 직접 입력 */}
      <div className={clsx(
        'rounded-xl border-2 p-3 bg-white transition-all',
        !cands.includes(curSel) && curSel.trim() ? 'border-blue-600 bg-blue-50' : 'border-zinc-200',
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 bg-gray-200 text-gray-500">
            {letters[cands.length] || 'D'}
          </span>
          <span className="text-xs2 text-gray-500 font-semibold">직접 입력</span>
        </div>
        <textarea
          className="w-full text-sm2 font-semibold bg-transparent outline-none resize-none"
          style={{ color: !cands.includes(curSel) && curSel ? '#1f2937' : '#9ca3af', fontStyle: !cands.includes(curSel) && curSel ? 'normal' : 'italic' }}
          placeholder={`${STEP_LABEL[stepId]}을 직접 입력하세요`}
          value={cands.includes(curSel) ? '' : curSel}
          onChange={e => setGSel(p => ({ ...p, [stepId]: e.target.value }))}
          onClick={e => e.stopPropagation()}
          rows={2}
        />
      </div>

    </div>
  );
}

function GuidePanel({ step, confirmed, mobileOpen, onMobileClose, focusCtx, setFocusCtx, chatInputRef }: {
  step: StepId;
  confirmed: Partial<Record<StepId, string>>;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  focusCtx: FocusCtx | null;
  setFocusCtx: (ctx: FocusCtx | null) => void;
  chatInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDone = step in confirmed;
  // 채팅 상태
  const [guideChatMsgs, setGuideChatMsgs] = useState<GuideChatMsg[]>([]);
  const [guideChatInput, setGuideChatInput] = useState('');
  const guideChatIdRef = useRef(0);
  const guideChatEndRef = useRef<HTMLDivElement>(null);
  const [localText, setLocalText] = useState('');

  // focusCtx 변경(섹션 선택, AI 적용) 시 편집 텍스트 동기화
  useEffect(() => {
    setLocalText(focusCtx?.text ?? '');
  }, [focusCtx]);

  const QA_REPLIES: Record<string, string> = {
    '청구항': '청구항은 특허 보호 범위를 정의합니다. 독립항과 종속항으로 구성됩니다.',
    '명칭': '발명의 명칭은 발명의 핵심 기술을 간결하게 표현해야 합니다.',
    '구성요소': '구성요소는 발명의 각 기술 요소를 분리하여 도면 부호와 함께 기재합니다.',
    '도면': '도면은 발명의 구성요소를 시각화하며, 각 부호(100, 200...)로 연결됩니다.',
  };

  const runGuideModification = (
    instruction: string,
    ctx: FocusCtx,
    sourceMsg: string,
    selectedIntent?: string,
  ) => {
    const proposed = generateMockModification(ctx.text, instruction);
    const label = selectedIntent ? `[${selectedIntent}] 방향으로 수정했습니다.` : `${ctx.label} 수정안입니다.`;
    setGuideChatMsgs(prev => [...prev, {
      id: ++guideChatIdRef.current,
      role: 'ai',
      text: label,
      proposed,
      applyFn: () => ctx.apply(proposed),
      sourceMsg,
      selectedIntent,
      sourceFocusCtx: ctx,
    }]);
    setTimeout(() => guideChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const sendGuideChat = (override?: string) => {
    const msg = (override ?? guideChatInput).trim();
    if (!msg) return;
    if (!override) setGuideChatInput('');
    // 사용자가 textarea에서 직접 편집한 내용을 AI 컨텍스트로 사용
    const capturedCtx = focusCtx ? { ...focusCtx, text: localText } : null;
    setGuideChatMsgs(prev => [...prev, { id: ++guideChatIdRef.current, role: 'user', text: msg }]);

    setTimeout(() => {
      if (!capturedCtx) {
        const matchKey = Object.keys(QA_REPLIES).find(k => msg.includes(k));
        const aiText = matchKey
          ? QA_REPLIES[matchKey]
          : `"${msg.slice(0, 20)}"에 대해 답변드립니다. 텍스트 영역을 클릭하면 AI가 해당 내용을 수정해드릴 수 있습니다.`;
        setGuideChatMsgs(prev => [...prev, { id: ++guideChatIdRef.current, role: 'ai', text: aiText }]);
        setTimeout(() => guideChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
      }
      // 명확도 판단 (TODO: API 교체)
      const clarity = analyzePromptClarity(msg);
      if (clarity === 'direct') {
        runGuideModification(msg, capturedCtx, msg);
      } else {
        const options = generateIntentOptions(msg);
        setGuideChatMsgs(prev => [...prev, {
          id: ++guideChatIdRef.current,
          role: 'ai',
          text: '어떤 방향으로 수정할까요?',
          intentOptions: options,
          sourceMsg: msg,
          sourceFocusCtx: capturedCtx,
        }]);
        setTimeout(() => guideChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    }, 500);
  };

  const selectGuideIntent = (msgId: number, intent: string) => {
    const msg = guideChatMsgs.find(m => m.id === msgId);
    if (!msg?.sourceFocusCtx) return;
    setGuideChatMsgs(prev => prev.map(m =>
      m.id === msgId ? { ...m, intentOptions: undefined, selectedIntent: intent, text: `[${intent}] 방향 선택됨` } : m
    ));
    setTimeout(() => runGuideModification(intent, msg.sourceFocusCtx!, msg.sourceMsg || intent, intent), 400);
  };

  const regenerateGuideChat = (msg: GuideChatMsg) => {
    if (!msg.sourceFocusCtx) return;
    const instruction = msg.selectedIntent || msg.sourceMsg || '다시 생성';
    setGuideChatMsgs(prev => prev.filter(m => m.id !== msg.id));
    setTimeout(() => runGuideModification(instruction, msg.sourceFocusCtx!, instruction, msg.selectedIntent), 400);
  };

  // 리사이즈 핸들 — 원본 artifact-resize-handle 동일
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const startX = e.clientX;
    const startW = panel.offsetWidth;
    const onMove = (mv: MouseEvent) => {
      const diff = startX - mv.clientX;
      const newW = Math.min(Math.max(startW + diff, 320), 700);
      panel.style.width = newW + 'px';
      panel.style.minWidth = newW + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <aside ref={panelRef} className={clsx(
      'bg-white flex-col overflow-hidden',
      // 데스크탑: 인라인 우측 사이드 패널
      'md:flex md:relative md:shrink-0 md:border-l md:border-ck-border',
      'md:w-[320px] md:min-w-[260px] md:max-w-[480px]',
      // 모바일: 하단 고정 시트
      'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50',
      'max-md:h-[72vh] max-md:rounded-t-2xl max-md:shadow-2xl',
      'max-md:border-t max-md:border-ck-border',
      'max-md:transition-transform max-md:duration-300 max-md:ease-out',
      mobileOpen ? 'flex max-md:translate-y-0' : 'max-md:hidden md:flex',
    )}>
      {/* 모바일 전용: 시트 핸들바 + 닫기 */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-ck-border shrink-0 relative">
        <div className="w-8 h-1 bg-zinc-300 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
        <span className="font-semibold text-sm">AI 가이드</span>
        <button onClick={onMobileClose} className="btn-ghost p-1" aria-label="가이드 닫기">
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* 리사이즈 핸들 — 원본 artifact-resize-handle (데스크탑에서만) */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 z-10 transition-colors"
        style={{ background: 'transparent' }}
        title="패널 너비 조정"
      />

      {/* 헤더 — 스텝바(48px)와 수직 정렬, 데스크탑 단일 행 */}
      <div className="hidden md:flex shrink-0 items-center gap-2 px-4 border-b border-ck-border bg-gray-50 ml-1.5" style={{ height: 48 }}>
        <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)' }}>AI</div>
        <span className="text-sm font-bold text-gray-800">AI 어시스턴트</span>
        {isDone && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            <Icon name="check" size={10} /> 확정됨
          </span>
        )}
      </div>
      {/* 모바일 헤더 — 기존 스타일 유지 */}
      <div className="md:hidden px-4 py-3 border-b border-ck-border bg-gray-50 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs2 font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)' }}>AI</div>
          <span className="text-base2 font-bold text-gray-800">AI 어시스턴트</span>
          {isDone && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <Icon name="check" size={10} /> 확정됨
            </span>
          )}
        </div>
        <p className="text-sm2 text-gray-500 leading-snug">카드를 선택하고 AI에게 수정을 요청하거나 질문하세요.</p>
      </div>

      {/* 선택된 콘텐츠 — 전체 내용 표시 + 직접 편집 가능 */}
      {focusCtx ? (
        <div className="shrink-0 mx-3 mt-2 mb-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs2 text-blue-600 font-semibold">✎ 선택됨</span>
            <span className="text-xs2 text-zinc-400">· {focusCtx.label}</span>
          </div>
          <textarea
            className="w-full text-sm2 text-gray-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 outline-none resize-none leading-relaxed focus:border-blue-400 transition-colors overflow-y-auto scroll-thin"
            value={localText}
            rows={3}
            onChange={e => {
              setLocalText(e.target.value);
              focusCtx.apply(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
            }}
            ref={el => {
              if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
            }}
          />
        </div>
      ) : (
        <div className="shrink-0 mx-3 mt-2 mb-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg">
          <p className="text-xs2 text-zinc-400">왼쪽 본문에서 카드를 선택하면 AI에게 수정을 요청할 수 있습니다.</p>
        </div>
      )}


      {/* 채팅 영역 — flex-1로 남은 공간 차지 */}
      <div className="flex-1 border-t border-ck-border ml-1.5 bg-white flex flex-col overflow-hidden">
        {/* 메시지 이력 */}
        {guideChatMsgs.length > 0 && (
          <div className="flex-1 overflow-y-auto scroll-thin px-3 py-2 space-y-2 bg-zinc-50">
            {guideChatMsgs.map(m => (
              <div key={m.id} className={clsx('flex gap-1.5', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'ai' && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)' }}>AI</div>
                )}
                {m.role === 'user' ? (
                  <div className="rounded-xl px-2.5 py-1.5 text-xs2 leading-relaxed max-w-[85%] bg-blue-600 text-white">
                    {m.text}
                  </div>
                ) : (
                  <div className="rounded-xl text-xs2 leading-relaxed max-w-[85%] bg-zinc-200 text-zinc-800 overflow-hidden">
                    <p className="px-2.5 pt-1.5 pb-1">{m.text}</p>
                    {/* 패턴 B: 방향 선택지 */}
                    {m.intentOptions && (
                      <div className="flex flex-wrap gap-1 px-2.5 pb-2">
                        {m.intentOptions.map((opt, i) => (
                          <button key={i}
                            onClick={() => selectGuideIntent(m.id, opt)}
                            className="px-2 py-0.5 text-xs2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* 수정안 + 적용/다시생성 */}
                    {m.proposed && (
                      <>
                        <div className="mx-2 mb-1.5 rounded-lg bg-white border border-zinc-300 p-2">
                          <p className="text-xs2 font-semibold text-zinc-400 mb-0.5">수정안</p>
                          <p className="text-xs2 text-zinc-800 leading-relaxed whitespace-pre-wrap">{m.proposed}</p>
                        </div>
                        <div className="flex gap-1 px-2 pb-2">
                          <button
                            disabled={m.applied}
                            onClick={() => {
                              m.applyFn?.();
                              setFocusCtx(focusCtx ? { ...focusCtx, text: m.proposed! } : null);
                              setGuideChatMsgs(prev => prev.map(msg => msg.id === m.id ? { ...msg, applied: true } : msg));
                            }}
                            className={clsx(
                              'flex-1 py-1 text-xs2 font-semibold rounded-lg transition-colors',
                              m.applied ? 'bg-green-100 text-green-700 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700',
                            )}
                          >
                            {m.applied ? '✓ 적용됨' : '✓ 적용'}
                          </button>
                          <button
                            onClick={() => regenerateGuideChat(m)}
                            className="px-2.5 py-1 text-xs2 text-zinc-500 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors">
                            ↺ 다시 생성
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={guideChatEndRef} />
          </div>
        )}
        {guideChatMsgs.length === 0 && <div className="flex-1" />}
        {/* 컨텍스트 표시 */}
        {!focusCtx && (
          <div className="shrink-0 px-3 pt-1.5 pb-0">
          </div>
        )}
        {focusCtx && (
          <div className="shrink-0 px-3 pt-1.5 pb-0">
            <div className="flex items-center gap-1 text-xs2">
              <span className="text-blue-600 font-semibold shrink-0">수정 요청 중</span>
              <span className="text-zinc-400">· {focusCtx.label}</span>
            </div>
          </div>
        )}
        {/* 입력창 — 항상 표시 */}
        <div className="shrink-0 flex gap-2 items-center px-3 py-2">
          <input
            ref={chatInputRef}
            type="text"
            className="flex-1 text-xs2 border border-zinc-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 transition-colors"
            placeholder={focusCtx ? `"${focusCtx.label}" 수정 요청...` : 'AI에게 질문하세요...'}
            value={guideChatInput}
            onChange={e => setGuideChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendGuideChat(); } }}
          />
          <button
            onClick={() => sendGuideChat()}
            disabled={!guideChatInput.trim()}
            className="shrink-0 w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" width="12" height="12">
              <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z" fill="white" stroke="none"/>
            </svg>
          </button>
        </div>
      </div>

    </aside>
  );
}

// 구성요소 패널 (#20)
interface CompItem { id: number; text: string; sel: boolean; num: string; depth: number }
const INIT_COMPS: CompItem[] = [
  { id: 1, text: '데이터 수집부: 라이다 센서로부터 3D 포인트 클라우드 데이터를 수집', sel: true, num: '', depth: 0 },
  { id: 2, text: '전처리부: 노이즈 제거 및 다운샘플링을 통해 데이터 전처리 수행', sel: true, num: '', depth: 0 },
  { id: 3, text: '특징 추출부: PointNet++ 아키텍처를 적용하여 포인트 특징 추출', sel: true, num: '', depth: 0 },
  { id: 4, text: '인식부: 딥러닝 모델을 이용하여 객체 분류 및 위치 추정', sel: true, num: '', depth: 0 },
  { id: 5, text: '출력부: 인식된 객체의 3D 위치, 크기, 종류를 출력', sel: true, num: '', depth: 0 },
];

function extractCompName(text: string): string {
  const colonIdx = text.indexOf(':');
  return colonIdx > 0 ? text.slice(0, colonIdx).trim() : text.trim();
}

// depth+순서 기반 부호 자동 계산
function calcAutoNums(items: CompItem[]): CompItem[] {
  const next = items.map(it => ({ ...it }));
  let d0 = 0, d1 = 0, d2 = 0;
  let base0 = 0, base1 = 0;
  next.forEach(item => {
    if (!item.sel) { item.num = ''; return; }
    const d = item.depth ?? 0;
    if (d === 0) {
      d0++; d1 = 0; d2 = 0;
      base0 = d0 * 100; base1 = 0;
      item.num = String(base0);
    } else if (d === 1) {
      d1++; d2 = 0;
      base1 = base0 + d1 * 10;
      item.num = String(base1);
    } else {
      d2++;
      item.num = String(base1 + d2);
    }
  });
  return next;
}

function ComponentsPanel({ done, onUpdate, onComponentsChange, initialItems }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  onComponentsChange?: (comps: InventionComponent[]) => void;
  initialItems?: { id: number; text: string; sel: boolean; num: string; depth: number }[];
}) {
  const initData = (initialItems && initialItems.length > 0) ? initialItems : INIT_COMPS;
  const [items, setItems] = useState<CompItem[]>(initData as CompItem[]);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    const data = (initialItems && initialItems.length > 0) ? initialItems : INIT_COMPS;
    const selected = (data as CompItem[]).filter(it => it.sel);
    onUpdate(selected.map(it => `${it.num || '—'} ${it.text}`).join('\n'));
    onComponentsChange?.(selected.map(it => ({ number: it.num || '', name: extractCompName(it.text) })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upd = (next: CompItem[]) => {
    setItems(next);
    const selected = next.filter(it => it.sel);
    onUpdate(selected.map(it => `${it.num || '—'} ${it.text}`).join('\n'));
    onComponentsChange?.(selected.map(it => ({ number: it.num || '', name: extractCompName(it.text) })));
  };

  const hasNums = (arr: CompItem[]) => arr.some(it => it.num);

  const applyUpd = (next: CompItem[]) => upd(hasNums(next) ? calcAutoNums(next) : next);

  const moveUp   = (idx: number) => { if (idx===0||done) return; const a=[...items]; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; applyUpd(a); };
  const moveDown = (idx: number) => { if (idx===items.length-1||done) return; const a=[...items]; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; applyUpd(a); };
  const indent   = (id: number)  => { if (!done) applyUpd(items.map(it => it.id===id ? {...it, depth: Math.min(it.depth+1,2)} : it)); };
  const outdent  = (id: number)  => { if (!done) applyUpd(items.map(it => it.id===id ? {...it, depth: Math.max(it.depth-1,0)} : it)); };
  const remove   = (id: number)  => {
    if (!done) {
      const item = items.find(it => it.id === id);
      if (!window.confirm(`"${item?.text ? item.text.slice(0, 30) : '이 구성요소'}"를 삭제하시겠습니까?`)) return;
      upd(items.filter(it => it.id !== id));
    }
  };
  const autoAssign = () => { if (!done) upd(calcAutoNums(items)); };
  const add = () => {
    if (!newText.trim()||done) return;
    upd([...items, { id: Date.now(), text: newText.trim(), sel: true, num: '', depth: 0 }]);
    setNewText('');
  };

  // → 활성 조건: idx>0이고 바로 위 항목이 유효한 부모(depth <= 현재 depth)
  const canIndent = (idx: number, item: CompItem) =>
    item.depth < 2 && idx > 0 && items[idx-1].depth >= item.depth;

  // HTML5 Drag & Drop
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDropIdx(idx); };
  const onDragEnd   = () => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      const a = [...items];
      const [moved] = a.splice(dragIdx, 1);
      a.splice(dropIdx > dragIdx ? dropIdx - 1 : dropIdx, 0, moved);
      applyUpd(a);
    }
    setDragIdx(null); setDropIdx(null);
  };

  const DEPTH_INDENT = 16;

  return (
    <>
      <div className="flex-1 overflow-y-auto scroll-thin p-3">
        {/* 헤더 + 부호 자동 부여 */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs2 font-semibold text-gray-600">AI 추출 구성요소</span>
          {!done && (
            <button onClick={autoAssign}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs2 font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="10" height="10">
                <path d="M2 6h8M8 4l2 2-2 2"/>
              </svg>
              부호 자동 부여
            </button>
          )}
        </div>
        {!done && (
          <p className="text-xs2 text-gray-400 mb-2">
            순서 조정 후 <strong className="text-blue-600">부호 자동 부여</strong>를 클릭하면 100, 200... 번호가 할당됩니다.
          </p>
        )}

        <div className="space-y-0.5">
          {items.map((item, idx) => (
            <div key={item.id}
              style={{ paddingLeft: item.depth * DEPTH_INDENT }}
              draggable={!done}
              onDragStart={() => onDragStart(idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
              className={clsx(
                !item.sel && 'opacity-50',
                dragIdx === idx && 'opacity-30',
                dropIdx === idx && dragIdx !== idx && 'ring-2 ring-blue-400 ring-offset-1 rounded'
              )}>
              <div className={clsx(
                'flex items-center gap-1 rounded px-1.5 py-1 transition-all group',
                item.sel && !done ? 'bg-white border border-gray-200 hover:border-blue-300' : '',
                !item.sel ? 'bg-gray-50 border border-dashed border-gray-200' : '',
                done && item.sel ? 'bg-green-50 border border-green-200' : ''
              )}>
                {/* 드래그 핸들 */}
                <span className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0 select-none text-xs leading-none px-0.5">⠿</span>

                {/* 부호 배지 */}
                <span className={clsx(
                  'w-8 text-xs2 font-bold rounded px-1 py-0.5 shrink-0 text-center',
                  item.num ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                )}>
                  {item.num || '—'}
                </span>

                {/* 텍스트 */}
                {!done ? (
                  <input
                    className="text-xs2 text-gray-700 flex-1 bg-transparent outline-none min-w-0 py-0.5"
                    value={item.text}
                    placeholder="구성요소 이름..."
                    onChange={e => upd(items.map(it => it.id===item.id ? {...it, text: e.target.value} : it))}
                  />
                ) : (
                  <span className="text-xs2 text-gray-700 flex-1 min-w-0 truncate">{item.text}</span>
                )}

                {/* 액션 버튼 — hover 시 표시 */}
                {!done && (
                  <div className="flex items-center gap-px shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveUp(idx)} disabled={idx===0}
                      className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="위로">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 7l3-4 3 4"/></svg>
                    </button>
                    <button onClick={() => moveDown(idx)} disabled={idx===items.length-1}
                      className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="아래로">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 3l3 4 3-4"/></svg>
                    </button>
                    <span className="w-px h-3 bg-gray-200 mx-0.5" />
                    <button onClick={() => indent(item.id)} disabled={!canIndent(idx, item)}
                      className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="하위로 (→)">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 5h6M6 3l2 2-2 2"/></svg>
                    </button>
                    <button onClick={() => outdent(item.id)} disabled={item.depth<=0}
                      className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="상위로 (←)">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M8 5H2M4 3L2 5l2 2"/></svg>
                    </button>
                    <span className="w-px h-3 bg-gray-200 mx-0.5" />
                    <button onClick={() => remove(item.id)}
                      className="p-0.5 text-gray-400 hover:text-red-500" title="삭제">
                      <Icon name="close" size={9} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 하단 드롭 존 — 마지막 위치로 드래그 허용 */}
          {!done && (
            <div
              onDragOver={e => { e.preventDefault(); setDropIdx(items.length); }}
              className={clsx(
                'h-3 rounded transition-all',
                dropIdx === items.length && dragIdx !== null ? 'ring-2 ring-blue-400 ring-offset-1 bg-blue-50' : ''
              )}
            />
          )}
        </div>

        {/* 새 구성요소 추가 */}
        {!done && (
          <div className="flex gap-1 mt-3">
            <input className="input text-xs2 py-1.5 flex-1" placeholder="새 구성요소 추가..." value={newText}
              onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key==='Enter' && add()} />
            <button onClick={add} className="btn-outline btn-xs px-2"><Icon name="plus" size={12} /></button>
          </div>
        )}
      </div>
      {done && (
        <div className="p-3 border-t border-gray-100 bg-green-50 shrink-0">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium"><Icon name="check" size={13} /> 구성요소 확정 완료</div>
        </div>
      )}
    </>
  );
}

// 도면 패널 (#21)

// DrawingsPanel — 썸네일/기호/라벨/도면명 표시, 단일 편집 버튼
function DrawingsPanel({ done, onUpdate, inventionComponents }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  inventionComponents?: InventionComponent[];
}) {
  const [drawings, setDrawings] = useState(() => MOCK_DRAWINGS.map(d => ({ ...d })));
  // 모바일 전용 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStartId, setModalStartId] = useState('');
  const [newTabNotice, setNewTabNotice] = useState(false);

  const handleSave = (drawingId: string, updates: Partial<typeof drawings[0]>) => {
    const next = drawings.map(d => d.id === drawingId ? { ...d, ...updates } : d);
    setDrawings(next);
    onUpdate(next.filter(d => d.stage === 'done').map(d => `기호${d.symbol} ${d.name}: ${d.description}`).join('\n\n'));
  };

  // 편집기 탭 결과 수신 (데스크탑 새 탭 편집 후 반영)
  useEffect(() => {
    const off = onEditorResult((result) => {
      handleSave(result.drawingId, {
        stage: result.stage,
        savedEditorJson: result.editorJson,
        exportedImageUrl: result.exportedImageUrl,
      });
    });
    return off;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEditor = (id: string) => {
    if (isMobile()) {
      setModalStartId(id);
      setModalOpen(true);
    } else {
      const draw = drawings.find(d => d.id === id);
      const opened = openEditorTab({
        drawingId: id,
        drawings,
        components: inventionComponents ?? [],
        references: (inventionComponents ?? []).map(c => ({ number: c.number, name: c.name })),
        drawingName: draw?.name ?? id,
        timestamp: Date.now(),
      });
      if (opened) {
        setNewTabNotice(true);
        setTimeout(() => setNewTabNotice(false), 4000);
      } else {
        // 팝업 차단 시 모달로 폴백
        setModalStartId(id);
        setModalOpen(true);
      }
    }
  };

  const LABEL_STYLES: Record<string, string> = {
    '제안기술': 'bg-blue-100 text-blue-700',
    '종래기술': 'bg-gray-100 text-gray-600',
    'AI생성':   'bg-violet-100 text-violet-700',
  };

  const STAGE_LABEL: Record<string, { text: string; cls: string }> = {
    'extracted':        { text: '영역 확인 필요',    cls: 'bg-amber-100 text-amber-700' },
    'bbox-adjusted':    { text: '영역 확인 완료 ✓', cls: 'bg-blue-100 text-blue-700' },
    'converting':       { text: '변환 중',           cls: 'bg-violet-100 text-violet-700' },
    'candidate-select': { text: '후보 선택 필요',    cls: 'bg-orange-100 text-orange-700' },
    'editing':          { text: '편집 중',            cls: 'bg-sky-100 text-sky-700' },
    'done':             { text: '편집 완료',          cls: 'bg-green-100 text-green-700' },
  };

  const doneCount = drawings.filter(d => d.stage === 'done').length;

  return (
    <>
      {newTabNotice && (
        <div className="mx-3 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs2 text-blue-700 flex items-center gap-1.5 shrink-0">
          <span>↗</span>
          도면 편집기가 새 탭에서 열렸습니다. 편집 완료 후 이 탭으로 돌아오세요.
        </div>
      )}
      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3 ml-1.5">
        {/* 헤더 */}
        <p className="text-xs2 font-semibold text-gray-500 mb-2.5">
          추출된 도면 <span className="font-normal text-gray-400">({drawings.length}개 · 완료 {doneCount}개)</span>
        </p>

        <div className="grid grid-cols-2 gap-2">
        {drawings.map(d => {
          const isEditable = !done;
          const isDone = d.stage === 'done';
          const stageBadge = STAGE_LABEL[d.stage];
          return (
            <div key={d.id}
              className={clsx(
                'rounded-xl border-2 overflow-hidden transition-all flex flex-col bg-white',
                isDone ? 'border-green-200' : 'border-zinc-200',
                done && 'opacity-60',
              )}>
              {/* 썸네일 (상단, 큰 영역) */}
              <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden relative">
                {d.exportedImageUrl
                  ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                  : <Icon name="image" size={28} className="text-gray-200" />}
                {/* 상태 배지 오버레이 */}
                {stageBadge && (
                  <span className={clsx(
                    'absolute bottom-1.5 left-1.5 text-xs2 px-2 py-0.5 rounded-full font-semibold shadow-sm',
                    stageBadge.cls,
                  )}>
                    {stageBadge.text}
                  </span>
                )}
              </div>

              {/* 메타 */}
              <div className="px-2.5 pt-2 pb-1.5 flex-1">
                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                  <span className="text-xs2 font-bold text-gray-700">기호 {d.symbol}</span>
                  <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium shrink-0', LABEL_STYLES[d.label])}>
                    {d.label}
                  </span>
                </div>
                <p className="text-xs2 text-gray-700 font-semibold leading-snug line-clamp-2">{d.name}</p>
              </div>

              {/* 편집 버튼 */}
              {isEditable && (
                <button
                  onClick={() => openEditor(d.id)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs2 font-semibold transition-colors border-t border-gray-100 text-blue-600 hover:bg-blue-50 shrink-0">
                  <Icon name="edit" size={10} />
                  도면 편집 →
                </button>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {done && (
        <div className="p-3 border-t border-ck-border bg-green-50 shrink-0 ml-1.5">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium">
            <Icon name="check" size={13} /> 도면 확정 완료 ({doneCount}개 편집 완료)
          </div>
        </div>
      )}

      {modalOpen && (
        <DrawingEditorModal
          drawings={drawings}
          initialDrawingId={modalStartId}
          availableReferences={(inventionComponents ?? []).map(c => ({ number: c.number, name: c.name }))}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ── 청구항 패널 (#22) — n개 독립항 다중 선택 + 독립항별 종속항 + AI 재생성 ──
// Phase 'indep' : 독립항 후보 중 n개 체크박스 선택
// Phase 'dep'   : 선택된 독립항별 종속항 섹션 + AI 재생성 인라인 UI

interface IndepCandState {
  id: number; label: string; text: string;
  selected: boolean;
  editing: boolean; editVal: string;
  aiOpen: boolean; aiPromptVal: string;
  aiProposed: string; aiDiffOpen: boolean; aiDiffSel: 'current' | 'proposed';
}

const INDEP_CANDS_INIT: Omit<IndepCandState, 'selected'|'editing'|'editVal'|'aiOpen'|'aiPromptVal'|'aiProposed'|'aiDiffOpen'|'aiDiffSel'>[] = [
  {
    id: 1, label: 'A',
    text: '라이다 센서로부터 3차원 포인트 클라우드 데이터를 획득하는 데이터 수집부;\n상기 포인트 클라우드 데이터에서 지면 포인트를 분리하고 노이즈를 제거하는 전처리부;\n딥러닝 모델을 적용하여 객체를 분류하는 인식부를 포함하며,\n실시간 3D 객체 인식이 가능한 라이다 기반 객체 감지 장치.',
  },
  {
    id: 2, label: 'B',
    text: '라이다 센서로부터 포인트 클라우드 데이터를 획득하는 단계;\n상기 포인트 클라우드 데이터를 기둥(Pillar) 단위로 구성하여 2D 의사 이미지를 생성하는 전처리 단계;\nPointNet++ 기반 딥러닝 모델을 이용하여 객체를 인식하는 인식 단계를 포함하는, 라이다 기반 객체 감지 방법.',
  },
];

interface DepItemState {
  id: number; text: string; sel: boolean; expanded: boolean;
  editing: boolean; editVal: string;
  aiOpen: boolean; aiPromptVal: string;
  aiProposed: string; aiDiffOpen: boolean; aiDiffSel: 'current' | 'proposed';
}

// 독립항별 더미 종속항 — 실제에서는 AI가 독립항 텍스트 기반으로 생성
const MOCK_DEPS_BY_INDEP: Record<number, Pick<DepItemState,'text'|'sel'>[]> = {
  1: [
    { sel: true,  text: '제1항에 있어서, 상기 전처리부는 RANSAC 알고리즘을 이용하여 지면 포인트를 분리하는, 라이다 기반 객체 감지 장치.' },
    { sel: true,  text: '제1항에 있어서, 상기 인식부는 PointNet++ 기반의 다층 신경망을 포함하는, 라이다 기반 객체 감지 장치.' },
    { sel: true,  text: '제2항에 있어서, 상기 다층 신경망은 포인트 클라우드를 기둥(pillar) 단위로 처리하는, 라이다 기반 객체 감지 장치.' },
    { sel: false, text: '제1항에 있어서, 상기 데이터 수집부는 복수의 라이다 센서를 포함하는, 라이다 기반 객체 감지 장치.' },
    { sel: true,  text: '제1항에 있어서, 상기 출력부는 3D 바운딩 박스를 이용하여 감지된 객체의 위치 및 크기를 표시하는, 라이다 기반 객체 감지 장치.' },
  ],
  2: [
    { sel: true,  text: '제1항에 있어서, 상기 전처리 단계는 RANSAC 알고리즘으로 지면 포인트를 분리하는 단계를 포함하는, 라이다 기반 객체 감지 방법.' },
    { sel: true,  text: '제1항에 있어서, 상기 인식 단계는 인식된 객체에 3D 바운딩 박스를 할당하는 단계를 더 포함하는, 라이다 기반 객체 감지 방법.' },
    { sel: false, text: '제2항에 있어서, 상기 3D 바운딩 박스는 객체의 방위각을 포함하는, 라이다 기반 객체 감지 방법.' },
  ],
};

interface DepGroupState { generated: boolean; items: DepItemState[]; newText: string }


function ClaimsPanel({ done, onUpdate, onFocusContext, guidePanelInputRef }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void; onFocusContext?: (ctx: { text: string; label: string; apply: (t: string) => void }) => void; guidePanelInputRef?: React.RefObject<HTMLInputElement | null> }) {
  const [claimsPhase, setClaimsPhase] = useState<'indep' | 'dep'>('indep');

  // 독립항 후보 상태 (n개 다중 선택)
  const [cands, setCands] = useState<IndepCandState[]>(
    INDEP_CANDS_INIT.map(c => ({ ...c, selected: c.id === 1, editing: false, editVal: c.text, aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const }))
  );

  // 독립항별 종속항 그룹
  const [depGroups, setDepGroups] = useState<Record<number, DepGroupState>>({});

  // 선택된 독립항 목록
  const selectedCands = cands.filter(c => c.selected);

  // 마운트 시 초기 요약을 상위로 전달 → 확정 카드에 실제 내용 표시
  useEffect(() => {
    const sel = INDEP_CANDS_INIT.filter((_, i) => i === 0);
    onUpdate(`독립항 1개, 종속항 0개\n\n청구항 1.\n${sel[0].text}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 전체 요약을 상위로 전달 (청구항 번호 자동 부여)
  const syncUpdate = (updCands: IndepCandState[], updGroups: Record<number, DepGroupState>) => {
    const selCands = updCands.filter(c => c.selected);
    let num = 0;
    const lines: string[] = [];
    selCands.forEach(c => {
      const text = c.editing ? c.editVal : c.text;
      lines.push(`청구항 ${++num}.\n${text}`);
      const grp = updGroups[c.id];
      if (grp?.generated) {
        grp.items.filter(d => d.sel).forEach(d => {
          lines.push(`청구항 ${++num}.\n${d.text}`);
        });
      }
    });
    const indepCount = selCands.length;
    const depCount = selCands.reduce((acc, c) => {
      const grp = updGroups[c.id];
      return acc + (grp?.items.filter(d => d.sel).length ?? 0);
    }, 0);
    onUpdate(`독립항 ${indepCount}개, 종속항 ${depCount}개\n\n${lines.join('\n\n')}`);
  };

  const requestAIClaim = (text: string, label: string, applyFn: (t: string) => void) => {
    onFocusContext?.({ text, label, apply: applyFn });
    setTimeout(() => guidePanelInputRef?.current?.focus(), 50);
  };

  // 독립항 선택 토글
  const toggleIndep = (id: number) => {
    const next = cands.map(c => c.id === id ? { ...c, selected: !c.selected } : c);
    setCands(next);
    syncUpdate(next, depGroups);
  };

  // 독립항 Phase B로 이동 — 선택된 독립항의 종속항 자동 생성
  const confirmIndep = () => {
    if (selectedCands.length === 0) return;
    const autoGroups = { ...depGroups };
    cands.filter(c => c.selected).forEach(c => {
      if (!autoGroups[c.id]?.generated) {
        const items = (MOCK_DEPS_BY_INDEP[c.id] ?? MOCK_DEPS_BY_INDEP[1]).map((d, i) => ({
          id: i + 1, ...d, expanded: false, editing: false, editVal: d.text,
          aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const,
        }));
        autoGroups[c.id] = { generated: true, items, newText: '' };
      }
    });
    setDepGroups(autoGroups);
    setClaimsPhase('dep');
    syncUpdate(cands, autoGroups);
  };

  // 독립항 AI 재생성 — prompt → diff 모드로 전환 (mock 생성)
  const regenIndep = (id: number) => {
    const c = cands.find(x => x.id === id);
    if (!c) return;
    const baseText = c.aiDiffOpen && c.aiProposed ? c.aiProposed : (c.editing ? c.editVal : c.text);
    const proposed = `${c.aiPromptVal.trim() ? `[${c.aiPromptVal.trim()} 반영] ` : ''}${baseText.split(';')[0]}; 상기 구성의 유기적 결합을 통해 높은 정확도와 실시간 처리를 달성하는, ${baseText.includes('장치') ? '라이다 기반 객체 감지 장치.' : '라이다 기반 객체 감지 방법.'}`;
    const next = cands.map(x => x.id === id ? { ...x, aiOpen: false, aiPromptVal: '', aiProposed: proposed, aiDiffOpen: true, aiDiffSel: 'proposed' as const } : x);
    setCands(next);
  };

  // 독립항 diff 선택 완료
  const applyIndepDiff = (id: number) => {
    const c = cands.find(x => x.id === id);
    if (!c) return;
    const finalText = c.aiDiffSel === 'proposed' ? c.aiProposed : (c.editing ? c.editVal : c.text);
    const next = cands.map(x => x.id === id ? { ...x, text: finalText, editVal: finalText, aiDiffOpen: false, aiProposed: '', aiDiffSel: 'proposed' as const } : x);
    setCands(next);
    syncUpdate(next, depGroups);
  };

  // 종속항 AI 생성 (mock)
  const generateDeps = (indepId: number) => {
    const mockItems = (MOCK_DEPS_BY_INDEP[indepId] ?? MOCK_DEPS_BY_INDEP[1]).map((d, i) => ({
      id: i + 1, ...d, expanded: false, editing: false, editVal: d.text, aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const,
    }));
    const next: Record<number, DepGroupState> = { ...depGroups, [indepId]: { generated: true, items: mockItems, newText: '' } };
    setDepGroups(next);
    syncUpdate(cands, next);
  };

  // 종속항 토글
  const toggleDep = (indepId: number, depId: number) => {
    if (done) return;
    const grp = depGroups[indepId];
    if (!grp) return;
    const next = { ...depGroups, [indepId]: { ...grp, items: grp.items.map(d => d.id === depId ? { ...d, sel: !d.sel } : d) } };
    setDepGroups(next);
    syncUpdate(cands, next);
  };

  const removeDep = (indepId: number, depId: number) => {
    const grp = depGroups[indepId];
    if (!grp) return;
    const next = { ...depGroups, [indepId]: { ...grp, items: grp.items.filter(d => d.id !== depId) } };
    setDepGroups(next);
    syncUpdate(cands, next);
  };

  const addDep = (indepId: number) => {
    const grp = depGroups[indepId];
    if (!grp || !grp.newText.trim()) return;
    const maxId = grp.items.reduce((m, d) => Math.max(m, d.id), 0);
    const newItem: DepItemState = { id: maxId + 1, text: grp.newText.trim(), sel: true, expanded: false, editing: false, editVal: grp.newText.trim(), aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' };
    const next = { ...depGroups, [indepId]: { ...grp, items: [...grp.items, newItem], newText: '' } };
    setDepGroups(next);
    syncUpdate(cands, next);
  };

  const regenDep = (indepId: number, depId: number) => {
    const grp = depGroups[indepId];
    if (!grp) return;
    const dep = grp.items.find(d => d.id === depId);
    if (!dep) return;
    const baseText = dep.aiDiffOpen && dep.aiProposed ? dep.aiProposed : dep.text;
    const suffix = baseText.includes('장치') ? ', 라이다 기반 객체 감지 장치.' : ', 라이다 기반 객체 감지 방법.';
    const proposed = `${baseText.split('있어서')[0]}있어서, ${dep.aiPromptVal.trim() || '상기 구성을 더 구체적으로 포함하는'}${suffix}`;
    const next = { ...depGroups, [indepId]: { ...grp, items: grp.items.map(d => d.id === depId ? { ...d, aiOpen: false, aiPromptVal: '', aiProposed: proposed, aiDiffOpen: true, aiDiffSel: 'proposed' as const } : d) } };
    setDepGroups(next);
  };

  // 종속항 diff 선택 완료
  const applyDepDiff = (indepId: number, depId: number) => {
    const grp = depGroups[indepId];
    if (!grp) return;
    const dep = grp.items.find(d => d.id === depId);
    if (!dep) return;
    const finalText = dep.aiDiffSel === 'proposed' ? dep.aiProposed : dep.text;
    const next = { ...depGroups, [indepId]: { ...grp, items: grp.items.map(d => d.id === depId ? { ...d, text: finalText, editVal: finalText, aiDiffOpen: false, aiProposed: '', aiDiffSel: 'proposed' as const } : d) } };
    setDepGroups(next);
    syncUpdate(cands, next);
  };

  void applyIndepDiff; void regenIndep; void regenDep; void applyDepDiff;

  const updateDepGroup = (indepId: number, patch: Partial<DepGroupState>) => {
    setDepGroups(p => ({ ...p, [indepId]: { ...p[indepId], ...patch } }));
  };

  // 청구항 전체 카운트
  const totalIndep = selectedCands.length;
  const totalDep = selectedCands.reduce((acc, c) => acc + (depGroups[c.id]?.items.filter(d => d.sel).length ?? 0), 0);

  // ── Phase A: 독립항 다중 선택 (체크박스) ─────────────────────────────
  if (claimsPhase === 'indep') {
    return (
      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2.5 ml-1.5">
        <p className="text-xs2 text-gray-500 leading-relaxed">
          기초자료를 분석하여 독립항 후보를 생성했습니다.<br />
          <span className="text-blue-700 font-medium">여러 개를 선택</span>할 수 있습니다.
        </p>

        {cands.map(cand => (
          <div key={cand.id}
            className={clsx('rounded-lg border-2 transition-all',
              cand.selected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-ck-border bg-ck-bg opacity-70'
            )}>

            {/* 헤더 — 체크박스 + 뱃지만 */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2 cursor-pointer"
              onClick={() => { if (!done) { toggleIndep(cand.id); onFocusContext?.({ text: cand.text, label: `독립항 ${cand.label}`, apply: (newText) => setCands(p => p.map(c => c.id === cand.id ? { ...c, text: newText, editVal: newText } : c)) }); } }}>
              <button
                onClick={e => { e.stopPropagation(); if (!done) toggleIndep(cand.id); }}
                className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                  cand.selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white hover:border-blue-400')}>
                {cand.selected && <Icon name="check" size={9} />}
              </button>
              <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs2 font-bold shrink-0',
                cand.selected ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-600')}>
                {cand.label}
              </span>
              <span className="text-xs2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">독립항</span>
              {!done && (
                <div className="ml-auto">
                  <button
                    onClick={e => { e.stopPropagation(); requestAIClaim(cand.text, `독립항 ${cand.label}`, (newText) => setCands(p => p.map(c => c.id === cand.id ? { ...c, text: newText, editVal: newText } : c))); }}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                    AI 수정
                  </button>
                </div>
              )}
            </div>

            {/* 본문 — 3가지 모드 전환 (DescriptionPanel과 동일 패턴) */}
            <div className="px-3 pb-3">

              {/* 일반 모드: textarea (항상 편집 가능) */}
              {(
                <div className={clsx('rounded-lg border-2 transition-all',
                  !done ? 'border-ck-border focus-within:border-blue-400' : 'border-green-300 bg-green-50')}>
                  {!done ? (
                    <textarea
                      className="w-full text-xs2 text-gray-800 bg-transparent px-3 py-3 outline-none resize-none leading-relaxed rounded-lg overflow-hidden"
                      value={cand.text}
                      rows={Math.max(4, Math.ceil(cand.text.length / 40))}
                      placeholder="독립항 내용을 입력하거나 수정하세요..."
                      onClick={e => e.stopPropagation()}
                      onFocus={() => onFocusContext?.({
                        text: cand.text,
                        label: `독립항 ${cand.label}`,
                        apply: (newText) => setCands(p => p.map(c => c.id === cand.id ? { ...c, text: newText, editVal: newText } : c)),
                      })}
                      onChange={e => setCands(p => p.map(c => c.id === cand.id ? { ...c, text: e.target.value } : c))}
                      ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    />
                  ) : (
                    <p className="text-xs2 text-gray-700 leading-relaxed px-3 py-3">{cand.text}</p>
                  )}
                </div>
              )}


            </div>{/* /본문 px-3 pb-3 */}
          </div>
        ))}

        {!done && (
          <button
            onClick={confirmIndep}
            disabled={selectedCands.length === 0}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm2 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-1">
            선택한 독립항 {selectedCands.length > 0 ? `${selectedCands.length}개` : ''} 으로 종속항 구성 →
          </button>
        )}
      </div>
    );
  }

  // ── Phase B: 독립항별 종속항 섹션 ───────────────────────────────────
  // 청구항 번호 계산
  let claimNum = 0;
  const indepNums: Record<number, number> = {};
  selectedCands.forEach(c => { indepNums[c.id] = ++claimNum; depGroups[c.id]?.items.filter(d => d.sel).forEach(() => { ++claimNum; }); });
  claimNum = 0; // reset to recompute inline

  return (
    <>
      <div className="flex-1 overflow-y-auto scroll-thin p-3 ml-1.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs2 font-semibold text-gray-600">
            청구항 구성 — 독립항 {totalIndep}개, 종속항 {totalDep}개
          </span>
          {!done && (
            <button onClick={() => setClaimsPhase('indep')}
              className="text-xs2 text-blue-600 hover:underline">
              ← 독립항 재선택
            </button>
          )}
        </div>

        {selectedCands.map(indep => {
          const indepClaimNum = ++claimNum;
          const grp = depGroups[indep.id] ?? { generated: false, items: [], newText: '' };

          return (
            <div key={indep.id} className="rounded-xl border border-zinc-200 overflow-hidden">
              {/* 독립항 헤더 */}
              <div className="border-b px-3 py-2.5 bg-blue-50 border-blue-200">
                {/* 타이틀 (항상 표시) */}
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer"
                  onClick={() => !done && onFocusContext?.({ text: indep.text, label: `독립항 ${indep.label}`, apply: (newText) => setCands(p => p.map(c => c.id === indep.id ? { ...c, text: newText, editVal: newText } : c)) })}
                >
                  <Icon name="check" size={11} className="text-blue-600" />
                  <span className="text-xs2 font-bold text-blue-700">청구항 {indepClaimNum} · 독립항 {indep.label}</span>
                  {!done && (
                    <div className="ml-auto">
                      <button
                        onClick={e => { e.stopPropagation(); requestAIClaim(indep.text, `독립항 ${indep.label}`, (newText) => setCands(p => p.map(c => c.id === indep.id ? { ...c, text: newText, editVal: newText } : c))); }}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                        AI 수정
                      </button>
                    </div>
                  )}
                </div>

                {/* 일반 모드: textarea */}
                {(
                  <div className="rounded border border-blue-200 focus-within:border-blue-400 transition-all">
                    <textarea
                      className="w-full text-xs2 text-blue-900 bg-transparent px-2.5 py-2 outline-none resize-none leading-relaxed overflow-hidden"
                      value={indep.text}
                      rows={Math.max(3, Math.ceil(indep.text.length / 45))}
                      onClick={e => e.stopPropagation()}
                      onFocus={() => onFocusContext?.({
                        text: indep.text,
                        label: `독립항 ${indep.label}`,
                        apply: (newText) => setCands(p => p.map(c => c.id === indep.id ? { ...c, text: newText, editVal: newText } : c)),
                      })}
                      onChange={e => setCands(p => p.map(c => c.id === indep.id ? { ...c, text: e.target.value } : c))}
                      ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    />
                  </div>
                )}

              </div>

              {/* 종속항 섹션 */}
              <div className="p-2.5 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs2 font-semibold text-gray-500">
                    종속항 ({grp.items.filter(d => d.sel).length}개 선택)
                  </span>
                  {!done && (
                    <button onClick={() => generateDeps(indep.id)}
                      className="text-xs2 text-gray-400 hover:text-violet-600 flex items-center gap-1 transition-colors">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="10" height="10">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/><path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                      재생성
                    </button>
                  )}
                </div>

                {(
                  <>
                    {grp.items.map((dep, depLocalIdx) => {
                      if (dep.sel) ++claimNum;
                      const depLocalNum = depLocalIdx + 1; // 그룹 내 1,2,3...
                      return (
                        <div key={dep.id}
                          className={clsx('rounded-lg border transition-all',
                            dep.sel && !done ? 'border-blue-200 bg-white' : '',
                            !dep.sel ? 'border-gray-200 bg-gray-50 opacity-60' : '',
                            done && dep.sel ? 'border-green-200 bg-green-50/30' : ''
                          )}>
                          {/* 헤더: 체크박스 + 종속항 N + 삭제 */}
                          <div
                            className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer"
                            onClick={() => !done && onFocusContext?.({ text: dep.text, label: `종속항 ${dep.id}`, apply: (newText) => { const next = { ...depGroups, [indep.id]: { ...grp, items: grp.items.map(d => d.id === dep.id ? { ...d, text: newText, editVal: newText } : d) } }; setDepGroups(next); syncUpdate(cands, next); } })}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); toggleDep(indep.id, dep.id); }}
                              className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                                dep.sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white hover:border-blue-400')}>
                              {dep.sel && <Icon name="check" size={8} />}
                            </button>
                            <span className={clsx('text-xs2 font-bold shrink-0', dep.sel ? 'text-blue-700' : 'text-gray-400')}>
                              종속항 {depLocalNum}
                            </span>
                            {!done && (
                              <button onClick={() => removeDep(indep.id, dep.id)}
                                className="shrink-0 text-gray-300 hover:text-red-400 ml-auto">
                                <Icon name="close" size={9} />
                              </button>
                            )}
                          </div>

                          {/* 항상 펼침 */}
                          <div className="px-2.5 pb-2.5 border-t border-gray-100 pt-2">
                              {/* 일반 모드: textarea */}
                              {(
                                <div className="rounded border border-gray-200 focus-within:border-blue-400 transition-all">
                                  <textarea
                                    className="w-full text-xs2 text-gray-800 bg-transparent px-2.5 py-2 outline-none resize-none leading-relaxed"
                                    value={dep.text}
                                    rows={Math.max(6, Math.ceil(dep.text.length / 40))}
                                    onFocus={() => onFocusContext?.({
                                      text: dep.text,
                                      label: `종속항 ${dep.id}`,
                                      apply: (newText) => {
                                        const next = { ...depGroups, [indep.id]: { ...grp, items: grp.items.map(d => d.id === dep.id ? { ...d, text: newText, editVal: newText } : d) } };
                                        setDepGroups(next);
                                        syncUpdate(cands, next);
                                      },
                                    })}
                                    onChange={e => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, text: e.target.value } : d) })}
                                  />
                                </div>
                              )}
                            </div>
                        </div>
                      );
                    })}

                    {/* 직접 추가 */}
                    {!done && (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          className="input text-xs2 py-1 flex-1"
                          placeholder={`제${indepClaimNum}항에 있어서, ...`}
                          value={grp.newText}
                          onChange={e => updateDepGroup(indep.id, { newText: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && addDep(indep.id)}
                        />
                        <button onClick={() => addDep(indep.id)} className="btn-outline btn-xs px-2 shrink-0">
                          <Icon name="plus" size={11} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <div className="p-3 border-t border-gray-100 bg-green-50 shrink-0 ml-1.5">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium">
            <Icon name="check" size={13} /> 청구항 확정 완료 (독립항 {totalIndep}개, 종속항 {totalDep}개)
          </div>
        </div>
      )}
    </>
  );
}

// ── 발명의 설명 패널 — 섹션별 1개 생성, 편집/프롬프트 수정/Diff 채택 ──
const DESC_SECTIONS: { key: string; label: string; badge2?: string; text: string }[] = [
  {
    key: 'tech', label: '기술분야',
    text: '본 발명은 자율주행 기술에 관한 것으로, 보다 구체적으로는 라이다(LiDAR) 센서 데이터를 활용한 실시간 3D 객체 인식 장치 및 방법에 관한 것이다. 특히, 포인트 클라우드 데이터의 효율적인 전처리와 딥러닝 기반 객체 탐지를 결합하여 자율주행 환경에서의 안전성을 향상시키는 기술에 관한 것이다.',
  },
  {
    key: 'bg', label: '배경기술', badge2: '선행기술 3건 기반',
    text: '자율주행 차량에서 주변 환경 인식은 안전한 주행을 위한 핵심 기술이다. 기존의 카메라 기반 인식 방법은 조명 조건에 민감하고 거리 정보가 부정확한 한계가 있다. 이에 라이다 센서를 활용한 3D 인식 기술이 주목받고 있으나, 기존 복셀(Voxel) 기반 처리 방식은 연산량이 많아 실시간 처리에 어려움이 있으며, 포인트 단위 처리 방식은 근거리·원거리 객체 간 밀도 차이로 인해 탐지 정확도가 불균일한 문제가 있다.',
  },
  {
    key: 'problem', label: '해결하려는 과제',
    text: '본 발명은 상기와 같은 문제점을 해결하기 위해 안출된 것으로, 라이다 포인트 클라우드 데이터를 효율적으로 전처리하여 실시간 처리 속도를 확보하면서도, 근거리·원거리 객체 모두에 대해 높은 탐지 정확도를 달성할 수 있는 3D 객체 인식 장치 및 방법을 제공하는 것을 목적으로 한다.',
  },
  {
    key: 'solution', label: '과제의 해결 수단',
    text: '본 발명의 과제를 해결하기 위한 수단으로, 라이다 포인트 클라우드 데이터를 입력받는 데이터 수집부(100)와, 입력된 데이터를 정규화·필터링하는 전처리부(200)와, 딥러닝 기반 특징을 추출하는 특징 추출부(300)와, 최종 객체를 분류하는 인식부(400)와, 인식 결과를 자율주행 제어부에 전달하는 출력부(500)를 포함한다.',
  },
  {
    key: 'effect', label: '발명의 효과',
    text: '본 발명에 의하면, 딥러닝 기반의 포인트 클라우드 처리를 통해 기존 방식 대비 처리 속도가 40% 향상되고, 객체 인식 정확도가 95% 이상 달성된다. 또한, 야간 및 악천후 환경에서도 안정적인 객체 인식 성능을 유지할 수 있으며, 다양한 자율주행 플랫폼에 적용 가능하다.',
  },
];

// 발명의 설명 패널 — 5개 섹션 동시 표시, 섹션 클릭으로 AI 패널 연결
function DescriptionPanel({ onUpdate, onSubInfoChange, onFocusContext, guidePanelInputRef }: {
  onUpdate: (v: string) => void;
  onSubInfoChange?: (info: { subStep: number; currentLabel: string; allDone: boolean; doConfirm: (() => void) | null }) => void;
  onFocusContext?: (ctx: { text: string; label: string; apply: (t: string) => void }) => void;
  guidePanelInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(DESC_SECTIONS.map(s => [s.key, s.text]))
  );
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // 항상 확정 준비 완료 상태 — 하단 바에서 바로 다음 단계 진행 가능
  useEffect(() => {
    onSubInfoChange?.({ subStep: 0, currentLabel: '발명의 설명', allDone: true, doConfirm: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // texts 변경 시 상위에 동기화
  useEffect(() => {
    onUpdate(DESC_SECTIONS.map(s => `【${s.label}】\n${texts[s.key] || s.text}`).join('\n\n'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts]);

  const selectSection = (key: string) => {
    setActiveKey(key);
    const sec = DESC_SECTIONS.find(s => s.key === key);
    if (!sec) return;
    onFocusContext?.({
      text: texts[key] || sec.text,
      label: sec.label,
      apply: (newText) => setTexts(p => ({ ...p, [key]: newText })),
    });
  };

  const requestAI = (key: string) => {
    selectSection(key);
    setTimeout(() => guidePanelInputRef?.current?.focus(), 50);
  };

  return (
    <div className="space-y-2">
      {DESC_SECTIONS.map(sec => {
        const isActive = activeKey === sec.key;
        const cardText = texts[sec.key] ?? sec.text;
        return (
          <div
            key={sec.key}
            onClick={() => selectSection(sec.key)}
            className={clsx(
              'rounded-xl border-2 p-3 cursor-pointer transition-all bg-white',
              isActive && 'border-blue-600 bg-blue-50 shadow-sm',
              !isActive && 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30',
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={clsx(
                'text-xs2 font-bold px-2 py-0.5 rounded-full shrink-0',
                isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600',
              )}>{sec.label}</span>
              {isActive && <span className="text-xs2 text-blue-600 font-semibold">✓ 선택됨</span>}
              <div className="ml-auto">
                <button
                  onClick={e => { e.stopPropagation(); requestAI(sec.key); }}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                  AI 수정
                </button>
              </div>
            </div>
            <p className="text-sm2 text-gray-700 leading-relaxed">{cardText}</p>
          </div>
        );
      })}
    </div>
  );
}


// ── 요약서 패널 — A(상세) + B(간결) 2개 후보 ──
const ABSTRACT_CANDS = [
  {
    letter: 'A', charCount: 187, badge2: null,
    text: '본 발명은 자율주행 차량에 장착된 라이다 센서에서 수신한 포인트 클라우드 데이터를 기반으로 실시간 객체 인식 및 분류를 수행하는 장치 및 방법에 관한 것으로, RANSAC 기반 전처리와 PointNet++ 딥러닝 모델을 결합하여 보행자, 차량, 자전거 등 다양한 객체를 높은 정확도로 인식하고 추적한다.',
  },
  {
    letter: 'B', charCount: 132, badge2: '간결 버전',
    text: '라이다 포인트 클라우드의 전처리와 딥러닝 기반 3D 객체 탐지를 결합한 실시간 객체 인식 장치로, 자율주행 환경에서 다양한 객체를 정확하게 인식·추적하는 기술에 관한 것이다.',
  },
];

function AbstractPanel({ done, onUpdate, onFocusContext, guidePanelInputRef }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  onFocusContext?: (ctx: { text: string; label: string; apply: (t: string) => void }) => void;
  guidePanelInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editVals, setEditVals] = useState<Record<number, string>>({});

  const getVal = (i: number) => editVals[i] ?? ABSTRACT_CANDS[i].text;

  const selectCand = (i: number) => {
    setSelectedIdx(i);
    onFocusContext?.({
      text: getVal(i),
      label: '요약서',
      apply: (newText) => { setEditVals(prev => ({ ...prev, [i]: newText })); onUpdate(newText); },
    });
  };

  const requestAI = (i: number) => {
    selectCand(i);
    setTimeout(() => guidePanelInputRef?.current?.focus(), 50);
  };

  return (
    <>
      <div className="mx-3 mt-3 mb-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 shrink-0">
        <p className="text-xs2 text-blue-700">명세서 전체 내용을 기반으로 <strong>요약서 2개 후보</strong>를 생성했습니다. 선택하거나 수정하세요.</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2 ml-1.5">
        {ABSTRACT_CANDS.map((cand, i) => {
          const isSelected = selectedIdx === i && !done;
          const isConfirmed = done && selectedIdx === i;
          return (
            <div
              key={cand.letter}
              onClick={() => !done && selectCand(i)}
              className={clsx(
                'rounded-xl border-2 p-3 cursor-pointer transition-all bg-white',
                isSelected && 'border-blue-600 bg-blue-50 shadow-sm',
                isConfirmed && 'border-green-500 bg-green-50',
                !isSelected && !isConfirmed && !done && 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30',
                done && !isConfirmed && 'border-gray-200 opacity-60',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={clsx('w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0',
                  isSelected || isConfirmed ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500')}>
                  {cand.letter}
                </span>
                {cand.badge2 && <span className="text-xs2 text-gray-500 font-medium">{cand.badge2}</span>}
                <span className="text-xs2 text-gray-400">{getVal(i).length}자</span>
                {isSelected && <span className="text-xs2 text-blue-600 font-semibold">✓ 선택됨</span>}
                {!done && (
                  <div className="ml-auto">
                    <button
                      onClick={e => { e.stopPropagation(); requestAI(i); }}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                      AI 수정
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm2 text-gray-700 leading-relaxed">{getVal(i)}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

