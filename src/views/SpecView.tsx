// SpecView
import { useEffect, useRef, useState } from 'react';
import { SpecEditorView } from './SpecEditorView';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { Card, Input } from '../components/ui';
import { openAlertDialog, Button, Textarea } from '@muhayu/axp-ui';
import { PreviewModal } from '../components/PreviewModal';
import type { PreviewSection } from '../components/PreviewModal';
import clsx from 'clsx';
import {
  generateTitleCandidates,
  generateComponentCandidates,
  MOCK_INDEPENDENT_CLAIM_SETS,
  MOCK_DRAWINGS,
  MOCK_EMBODIMENT,
  getMockExtractResult,
  mockPartialModify,
} from '../features/spec/mockAiService';
import type { DrawingItem as WorkflowDrawingItem } from '../features/drawing-workflow/types';
import { openEditorTab, onEditorResult } from '../features/drawing-workflow/editorChannel';
import type {
  SpecAnalysisState, SpecStepId, StepConfig,
  TitleCandidate, SpecComponentItem,
  InventionContext, MidspecSection, InventionDescriptionItem, Drawing,
} from '../features/spec/types';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import { analyzePromptClarity, generateIntentOptions, generateMockModification } from '../features/ai/clarityAnalyzer';

type StepId = SpecStepId;
const STEPS: StepConfig[] = [
  { id: 'upload',      label: '업로드',      step: 1 },
  { id: 'description', label: '발명 설명',   step: 2 },
  { id: 'title',       label: '제목·요약',   step: 3 },
  { id: 'components',  label: '구성요소',    step: 4 },
  { id: 'drawings',    label: '도면',        step: 5 },
  { id: 'claims',      label: '청구항',      step: 6 },
  { id: 'midspec',     label: '중간명세서',  step: 7 },
];

const STEP_LABEL: Partial<Record<StepId, string>> = {
  title: '발명의 명칭', description: '발명의 설명', components: '구성요소',
  drawings: '도면', claims: '청구항', midspec: '중간명세서',
};

const AI_NEXT: Record<StepId, string> = {
  upload:      '업로드하신 문서를 분석했습니다. 발명의 설명 항목을 분석합니다.',
  description: '설명 항목을 확정했습니다. 발명의 명칭 후보를 생성합니다.',
  title:       '발명 명칭을 확정했습니다. 발명의 구성요소를 추출합니다.',
  components:  '구성요소를 확정했습니다. 업로드된 도면을 분석합니다.',
  drawings:    '도면을 확정했습니다. 청구항을 생성합니다.',
  claims:      '청구항을 확정했습니다. 중간명세서를 확인하고 편집하세요.',
  midspec:     '중간명세서를 확정했습니다. 명세서 에디터로 이동합니다.',
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
    '효과: 처리 속도 40% 향상 및 객체 인식 정확도 95% 이상 달성.',
  ],
};

export function SpecView() {
  const { tasks, activeTaskId, taskUpdate, projects } = useStore();
  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
  const projectName = task?.folderId ? (projects.find(p => p.id === task.folderId)?.name ?? '') : '';
  const savedSpec = task?.id ? loadSpecState(task.id) : null;

  const [mainView, setMainView] = useState<'analysis' | 'editor'>(savedSpec?.mainView ?? 'analysis');
  const handleSetMainView = (v: 'analysis' | 'editor') => setMainView(v);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  const [specFocusCtx, setSpecFocusCtx] = useState<FocusCtx | null>(null);
  const guidePanelInputRef = useRef<HTMLTextAreaElement>(null);
  const [context, setContext] = useState<InventionContext>(
    savedSpec?.context ?? {
      title: '', summary: '', elements: [], previous: [], proposed: [], drawings: [],
    }
  );
  const [midspec, setMidspec] = useState<MidspecSection[] | undefined>(savedSpec?.midspec);
  const [previewOpen, setPreviewOpen] = useState(false);
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

  // AI 분석 생성 후보
  const [titleCandidates, setTitleCandidates] = useState<TitleCandidate[]>(
    savedSpec?.titleCandidates ?? []
  );
  const [aiComponents, setAiComponents] = useState<SpecComponentItem[]>(
    savedSpec?.context?.elements
      ? savedSpec.context.elements.map((el, i) => ({ ...el, id: i + 1, depth: 0, sel: true }))
      : []
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  const flowRef = useRef<HTMLDivElement>(null);
  const flowSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showConfirm = (message: string, onConfirm: () => void) => openAlertDialog(
    { title: '확인', description: message, confirm: '확인', cancel: '취소' },
    { theme: 'primary', onConfirm: (ctrl) => { onConfirm(); ctrl.close(); } }
  );

  // 자동 저장 — 400ms 디바운스
  useEffect(() => {
    if (!task?.id) return;
    setSaveStatus('saving');
    if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current);
    flowSaveTimerRef.current = setTimeout(() => {
      saveSpecState(task.id, {
        phase,
        curStep,
        confirmed: confirmed as SpecAnalysisState['confirmed'],
        gSel: gSel as SpecAnalysisState['gSel'],
        diTitle, diField, diContent, diProblem, diKeywords,
        titleCandidates,
        context,
        midspec,
        mainView,
      });
      setSaveStatus('saved');
    }, 400);
    return () => { if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current); };
  }, [phase, curStep, confirmed, gSel, diTitle, diField, diContent,
      diProblem, diKeywords, titleCandidates, context, midspec, mainView, task?.id]);

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
  const isSpecialStep = (id: StepId) =>
    id === 'description' || id === 'components' || id === 'drawings' || id === 'claims' || id === 'midspec';
  const isVisible = (id: StepId) => {
    if (id === 'upload') return true;
    if (phase === 'upload' || phase === 'direct') return false;
    return si(id) <= si(curStep);
  };

  const resetAnalysis = () => {
    showConfirm('처음부터 다시 시작하면 모든 분석 내용이 삭제됩니다.\n계속하시겠습니까?', () => {
      setPhase('upload');
      setCurStep('upload');
      setConfirmed({});
      setGSel({});
      setTitleCandidates([]);
      setAiComponents([]);
      setContext({ title: '', summary: '', elements: [], previous: [], proposed: [], drawings: [] });
      setMidspec(undefined);
      if (task?.id) {
        saveSpecState(task.id, {
          phase: 'upload', curStep: 'upload',
          confirmed: {}, gSel: {},
          titleCandidates: [],
          context: { title: '', summary: '', elements: [], previous: [], proposed: [], drawings: [] },
          midspec: undefined,
          mainView: 'analysis',
        });
      }
    });
  };

  const confirm = (id: StepId) => {
    const val = gSel[id] || GUIDE_CANDS[id]?.[0] || '(확정)';
    setConfirmed(p => ({ ...p, [id]: val }));
    // 확정 제목을 InventionContext 단일 원천에 역기록
    if (id === 'title') setContext(p => ({ ...p, title: val }));
    // claims 확정 시 중간명세서 자동 로드
    if (id === 'claims' && !midspec) {
      import('../features/spec/mockAiService').then(({ MOCK_MIDSPEC }) => {
        setMidspec(MOCK_MIDSPEC);
      });
    }
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
    if (!title || !content) return;
    setAnalyzing(true);
    setLoadingStage(1);
    const input = { title, field, content, problem: diProblem.trim(), keywords: diKeywords.trim() };
    setTimeout(() => setLoadingStage(2), 500);
    setTimeout(() => setLoadingStage(3), 1000);
    setTimeout(() => {
      const extractResult = getMockExtractResult();
      const comps = generateComponentCandidates(input);
      setContext(extractResult);
      setTitleCandidates(generateTitleCandidates(input));
      setAiComponents(comps);
      setConfirmed({});
      setGSel({});
      setPhase('flow');
      setCurStep('description');
      setGuideStep('description');
      setAnalyzing(false);
      setLoadingStage(0);
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
    return [
      { label: '발명의 명칭', content: title },
      { label: '기술분야', content: extractDesc('기술분야') },
      { label: '배경기술', content: extractDesc('배경기술') },
      { label: '해결하고자 하는 과제', content: extractDesc('해결하려는 과제') },
      { label: '발명의 효과', content: extractDesc('발명의 효과') },
      { label: '청구범위', content: claims },
    ].filter(s => s.content.trim());
  };

  if (mainView === 'editor') {
    return (
      <>
        <SpecEditorView
          task={task}
          onBack={() => handleSetMainView('analysis')}
          confirmedTitle={gSel['title'] || confirmed['title'] || diTitle}
          midspec={midspec}
          context={context}
          confirmedClaimsText={gSel['claims'] || confirmed['claims'] || ''}
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

          {/* 작업 컨텍스트 + 저장 상태 */}
          {task && (
            <div className="shrink-0 px-4 py-1 bg-white border-b border-gray-100 flex items-center gap-2 min-h-[26px]">
              {projectName && <span className="text-xs2 text-gray-400 truncate max-w-[120px]">{projectName}</span>}
              {projectName && <span className="text-xs2 text-gray-300">›</span>}
              <span className="text-xs2 text-gray-600 font-medium truncate flex-1">{task.name}</span>
              <span className={clsx('text-xs2 shrink-0', saveStatus === 'saving' ? 'text-blue-400' : 'text-gray-300')}>
                {saveStatus === 'saving' ? '저장 중...' : '저장됨'}
              </span>
            </div>
          )}

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
                    <div
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1 rounded-full border cursor-default select-none',
                        active && 'border-blue-200 bg-blue-50',
                        !active && 'border-transparent',
                        locked && 'opacity-60',
                      )}>
                      <span className={clsx(
                        'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 border-2',
                        active && 'border-blue-600 bg-brand-400 text-white',
                        isDone && !active && 'border-green-500 bg-green-500 text-white',
                        locked && 'border-gray-300 bg-white text-gray-400',
                        !active && !isDone && !locked && 'border-gray-400 bg-white text-gray-500',
                      )}>
                        {isDone && !active ? <Icon name="check" size={10} /> : s.step}
                      </span>
                      <span className={clsx(
                        'text-sm2 max-md:hidden',
                        active && 'max-md:inline text-brand-400 font-semibold',
                        isDone && !active && 'text-green-700 font-medium',
                        locked && 'text-gray-400',
                        !active && !isDone && !locked && 'text-gray-500',
                      )}>{s.label}</span>
                    </div>
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

            {/* 업로드 존 — PDF 파일 업로드 */}
            {phase !== 'flow' && phase !== 'done' && !analyzing && (
              <div className="text-center py-4">
                <Icon name="doc" size={48} className="text-brand-400 mx-auto mb-3" />
                <h2 className="text-lg2 font-bold text-gray-800 mb-2">새 특허 명세서 작성</h2>
                <p className="text-md2 text-gray-500 mb-6">직무발명서(PDF)를 업로드하면 AI가 자동으로 분석합니다.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                    const content = `[${file.name}] 파일이 업로드되었습니다.`;
                    setDiTitle(nameWithoutExt);
                    setDiContent(content);
                    startFlow({ title: nameWithoutExt, field: '', content });
                    e.target.value = '';
                  }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-10 mb-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-gray-400">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-md2 text-gray-600">직무발명서 PDF를 업로드 하세요.</p>
                  <p className="text-xs2 text-gray-400 mt-1">.pdf 지원</p>
                </div>
              </div>
            )}

            {/* 분석 로딩 화면 */}
            {analyzing && (
              <div className="flex flex-col items-center py-16 gap-8">
                <div className="w-full max-w-xs space-y-3">
                  {[
                    { stage: 1, label: 'PDF 텍스트 추출 중...' },
                    { stage: 2, label: '발명 구성요소 파악 중...' },
                    { stage: 3, label: '명세서 항목 분석 중...' },
                  ].map(s => (
                    <div key={s.stage} className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                      loadingStage === s.stage && 'bg-blue-50',
                    )}>
                      <div className={clsx(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300',
                        loadingStage > s.stage ? 'bg-green-100' :
                        loadingStage === s.stage ? 'bg-blue-100' : 'bg-gray-100',
                      )}>
                        {loadingStage > s.stage ? (
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-green-600"><polyline points="3,8 7,12 13,4" /></svg>
                        ) : loadingStage === s.stage ? (
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-blue-500 animate-spin" style={{ transformOrigin: 'center' }}><circle cx="8" cy="8" r="5" strokeDasharray="20 12" /></svg>
                        ) : (
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><circle cx="8" cy="8" r="5" /></svg>
                        )}
                      </div>
                      <span className={clsx(
                        'text-sm2 transition-colors duration-300',
                        loadingStage > s.stage ? 'text-green-700' :
                        loadingStage === s.stage ? 'text-brand-400 font-semibold' : 'text-gray-400',
                      )}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="w-56 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(5, (loadingStage / 3) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* 직접입력 폼 — 원본: AI 분석 시작 후에도 계속 표시 (필드 잠금) */}
            {phase === 'direct' && (
              <Card className="overflow-hidden !p-0">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50">
                  <Icon name="edit" size={20} className="text-brand-400" />
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
                      <Input className="py-2" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
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
                    <Input className="py-2" placeholder="예: 트랜스포머, GPT, KR10-2023-0012345" value={diKeywords} onChange={e => setDiKeywords(e.target.value)} />
                  </div>
                </div>
                {/* flow/done 상태에서는 버튼 숨김 (폼은 읽기전용으로 계속 표시) */}
                {phase === 'direct' && (
                  <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <Button variant="outlined" color="primary" size="sm" onClick={() => {
                      if (diTitle || diContent) {
                        showConfirm('입력한 내용이 삭제됩니다. 계속할까요?', () => setPhase('upload'));
                      } else {
                        setPhase('upload');
                      }
                    }}>취소</Button>
                    <Button variant="filled" color="primary" size="sm" onClick={() => startFlow()}
                      disabled={!diTitle.trim() || !diField.trim() || !diContent.trim() || analyzing}>
                      {analyzing
                        ? <><span className="inline-block animate-spin mr-1">↻</span>AI 분석 중...</>
                        : <><Icon name="star" size={13} /> AI 분석 시작</>}
                    </Button>
                  </div>
                )}
              </Card>
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
                      {/* 단계 콘텐츠 — isDone 시 전체 딤 처리 */}
                      <div className={isDone ? 'opacity-60 pointer-events-none select-none' : ''}>
                        {s.id === 'title' && (
                          <TitleCandidateCards
                            candidates={titleCandidates}
                            gSel={gSel}
                            setGSel={setGSel}
                            setFocusCtx={setSpecFocusCtx}
                            guidePanelInputRef={guidePanelInputRef}
                          />
                        )}
                        {s.id === 'description' && (
                          <DescriptionItemCards
                            previous={context.previous}
                            proposed={context.proposed}
                            onToggle={(type, idx) => setContext(p => ({
                              ...p,
                              [type]: p[type].map((item, i) => i === idx ? { ...item, adopted: !item.adopted } : item),
                            }))}
                            onChange={(type, idx, text) => setContext(p => ({
                              ...p,
                              [type]: p[type].map((item, i) => i === idx ? { ...item, text } : item),
                            }))}
                            onAdd={(type, text, label) => setContext(p => ({
                              ...p,
                              [type]: [...p[type], { label, text }],
                            }))}
                            onRemove={(type, idx) => setContext(p => ({
                              ...p,
                              [type]: p[type].filter((_, i) => i !== idx),
                            }))}
                            setFocusCtx={setSpecFocusCtx}
                            guidePanelInputRef={guidePanelInputRef}
                          />
                        )}
                        {(s.id === 'components' || s.id === 'drawings' || s.id === 'claims' || s.id === 'midspec') && (
                          <div className="mt-3">
                            {s.id === 'components' && (
                              <ComponentsPanel
                                done={isDone}
                                onConfirm={() => confirm('components')}
                                onUpdate={v => setGSel(p => ({ ...p, components: v }))}
                                onComponentsChange={(comps) => {
                                  setAiComponents(comps);
                                  // 채택된 구성요소를 InventionContext.elements 단일 원천에 동기화 (InventionElement로 정제)
                                  setContext(p => ({
                                    ...p,
                                    elements: comps.filter(c => c.sel).map(c => ({
                                      symbol: c.symbol, value_ko: c.value_ko, value_en: c.value_en,
                                      description: c.description, hypernym_ko: c.hypernym_ko, hypernym_en: c.hypernym_en,
                                    })),
                                  }));
                                }}
                                initialItems={aiComponents}
                              />
                            )}
                            {s.id === 'drawings' && (
                              <DrawingsPanel
                                done={isDone}
                                onConfirm={() => confirm('drawings')}
                                onUpdate={v => setGSel(p => ({ ...p, drawings: v }))}
                                drawings={context.drawings}
                                onUpdateDrawings={next => setContext(p => ({ ...p, drawings: next }))}
                              />
                            )}
                            {s.id === 'claims' && (
                              <ClaimsPanel
                                done={isDone}
                                onConfirm={() => confirm('claims')}
                                onUpdate={v => setGSel(p => ({ ...p, claims: v }))}
                                onFocusContext={setSpecFocusCtx}
                                guidePanelInputRef={guidePanelInputRef}
                              />
                            )}
                            {s.id === 'midspec' && (
                              <MidspecPanel
                                done={isDone}
                                sections={midspec ?? []}
                                onUpdate={(next) => {
                                  setMidspec(next);
                                  setGSel(p => ({ ...p, midspec: next.map(s => `【${s.label}】\n${s.blocks.map(b => b.text).join('\n')}`).join('\n\n') }));
                                }}
                                onGoToEditor={() => {
                                  const embodimentSection: MidspecSection = {
                                    key: 'embodiment_description',
                                    label: '실시예 (구체적 내용)',
                                    blocks: MOCK_EMBODIMENT,
                                  };
                                  const nextMidspec = [
                                    ...(midspec ?? []).filter(s => s.key !== 'embodiment_description'),
                                    embodimentSection,
                                  ];
                                  setMidspec(nextMidspec);
                                  confirm('midspec');
                                  handleSetMainView('editor');
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      {/* 수정 버튼 — 딤 영역 하단, 포인터 정상 */}
                      {isDone && (
                        <div className="flex justify-end mt-1">
                          <button
                            onClick={() => reselect(s.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs2 text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                          >
                            <Icon name="edit" size={10} /> 수정
                          </button>
                        </div>
                      )}
                      {isDone && <AiMsg text={AI_NEXT[s.id]} />}
                    </div>
                  );
                })}
                {phase === 'done' && (
                  <div className="text-center py-8">
                    <Icon name="logo" size={40} className="text-brand-400 mx-auto mb-3" />
                    <h3 className="text-lg2 font-bold text-gray-800 mb-2">모든 분석 항목이 확정되었습니다</h3>
                    <p className="text-md2 text-gray-500 mb-5">확정된 내용을 바탕으로 명세서 초안을 편집하세요.</p>
                    <Button
                      variant="filled" color="primary" size="sm"
                      onClick={() => handleSetMainView('editor')}
                      className="mx-auto flex items-center gap-1.5">
                      <Icon name="doc" size={13} /> 명세서 초안 편집으로 이동 →
                    </Button>
                    {task?.id && sessionStorage.getItem(`axp_mainview_${task.id}`) === 'editor' && (
                      <p className="text-xs2 text-gray-400 mt-3">이미 진행 중인 편집 내용이 있습니다 — 이어서 편집할 수 있습니다.</p>
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
              <div>
                {STEPS.findIndex(s => s.id === guideStep) > 1 && (
                  <button
                    onClick={() => {
                      const idx = STEPS.findIndex(s => s.id === guideStep);
                      setGuideStep(STEPS[idx - 1].id);
                      if (phase === 'done') setPhase('flow');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  >← 이전</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {guideStep === 'drawings' && !confirmed['drawings'] && (
                  <button onClick={() => confirm('drawings')} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">건너뛰기</button>
                )}
                {doneCount >= 5 ? (
                  <button onClick={() => handleSetMainView('editor')} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-blue-800 transition-colors">명세서 초안 편집 →</button>
                ) : !isSpecialStep(guideStep) ? (
                  <button onClick={() => { const cur = gSel[guideStep]; if (cur?.trim()) confirm(guideStep); }} disabled={!gSel[guideStep]?.trim()} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-blue-800 disabled:opacity-40 transition-colors">다음 →</button>
                ) : (
                  <button onClick={() => confirm(guideStep)} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-blue-800 transition-colors">다음 →</button>
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

        {/* 모바일 전용: AI 어시스턴트 FAB */}
        {(phase === 'flow' || phase === 'done') && (
          <button
            className="md:hidden fixed bottom-5 right-4 z-30 bg-brand-400 text-white rounded-full px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform"
            onClick={() => setMobileGuideOpen(true)}
            aria-label="AI 어시스턴트 열기"
          >
            <Icon name="star" size={14} />
            AI 어시스턴트
          </button>
        )}
      </div>
      {previewOpen && <PreviewModal taskName={task?.name} sections={makePreviewSections()} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function AiMsg({ text }: { text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border-l-2 border-blue-200 pl-3">
      <div className="text-md2 text-zinc-500 leading-relaxed py-0.5">
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

// ── 텍스트 선택 AI 수정 팝오버 ──────────────────────────────────────────────
type SelState = { start: number; end: number; originalValue: string; apply: (newText: string) => void; top: number; left: number } | null;

function TextSelectionPopover({
  position, preview, onApply, onClose,
}: {
  position: { top: number; left: number };
  preview: string;
  onApply: (instruction: string) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState('');
  return (
    <div
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
      className="bg-white border border-blue-200 rounded-xl shadow-xl px-3 py-2 flex items-center gap-2"
      onMouseDown={e => e.preventDefault()}
    >
      <span className="text-xs2 text-gray-400 shrink-0 max-w-[80px] truncate">&ldquo;{preview}&rdquo;</span>
      <input
        autoFocus
        className="text-xs2 border border-gray-200 rounded-lg px-2 py-1 outline-none w-32 focus:border-blue-400"
        placeholder="수정 지시..."
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onApply(instruction); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
      />
      <button
        onClick={() => onApply(instruction)}
        className="shrink-0 text-xs2 px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
      >적용</button>
      <button onClick={onClose} className="shrink-0 text-xs2 text-gray-400 hover:text-gray-600">✕</button>
    </div>
  );
}

// ── 발명의 명칭 후보 카드 (title + abstract) ──────────────────────
function TitleCandidateCards({
  candidates, gSel, setGSel, setFocusCtx, guidePanelInputRef,
}: {
  candidates: TitleCandidate[];
  gSel: Partial<Record<StepId, string>>;
  setGSel: React.Dispatch<React.SetStateAction<Partial<Record<StepId, string>>>>;
  setFocusCtx: (ctx: FocusCtx | null) => void;
  guidePanelInputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const curSel = gSel['title'] || '';
  const [titleEdits, setTitleEdits] = useState<Record<string, string>>({});
  const [abstractEdits, setAbstractEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!gSel['title'] && candidates[0]) {
      setGSel(p => ({ ...p, title: candidates[0].title }));
    }
  }, [candidates.length]);

  const isFromCandidates = (val: string) =>
    candidates.some(c => (titleEdits[c.id] ?? c.title) === val || c.title === val);

  const requestAI = (text: string, label: string, applyFn: (t: string) => void) => {
    setFocusCtx({ text, label, apply: applyFn });
    setTimeout(() => guidePanelInputRef.current?.focus(), 50);
  };

  return (
    <div className="space-y-2 mt-3">
      {candidates.map((c, i) => {
        const titleVal = titleEdits[c.id] ?? c.title;
        const abstractVal = abstractEdits[c.id] ?? c.summary;
        const letter = letters[i] || String(i + 1);
        const isSelected = curSel === titleVal || curSel === c.title;
        return (
          <div
            key={c.id}
            onClick={() => setGSel(p => ({ ...p, title: titleVal }))}
            className={clsx(
              'rounded-xl border-2 p-3 cursor-pointer transition-all bg-white',
              isSelected && 'border-blue-600 bg-blue-50 shadow-sm',
              !isSelected && 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30',
            )}
          >
            {/* 카드 헤더 */}
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx(
                'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0',
                isSelected ? 'bg-brand-400 text-white' : 'bg-gray-200 text-gray-500',
              )}>{letter}</span>
              {isSelected && <span className="text-xs2 text-blue-600 font-semibold">✓ 선택됨</span>}
            </div>
            {/* 명칭 행 */}
            <div className="flex items-start gap-2 mb-1.5">
              <div className="flex-1 min-w-0">
                <span className="text-xs2 text-gray-400 font-medium block mb-0.5">명칭</span>
                <p className="text-sm2 font-semibold text-gray-800 leading-snug">{titleVal}</p>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setGSel(p => ({ ...p, title: titleVal }));
                  requestAI(titleVal, '발명의 명칭', (newText) => {
                    setTitleEdits(prev => ({ ...prev, [c.id]: newText }));
                    setGSel(p => ({ ...p, title: newText }));
                  });
                }}
                className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors mt-4"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                AI 수정
              </button>
            </div>
            {/* 개요 행 */}
            <div className="flex items-start gap-2 pt-1.5 border-t border-gray-100">
              <div className="flex-1 min-w-0">
                <span className="text-xs2 text-gray-400 font-medium block mb-0.5">개요</span>
                <p className="text-xs2 text-gray-500 leading-relaxed">{abstractVal}</p>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  requestAI(abstractVal, '개요', (newText) => {
                    setAbstractEdits(prev => ({ ...prev, [c.id]: newText }));
                  });
                }}
                className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors mt-4"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                AI 수정
              </button>
            </div>
            {/* 추천 이유 행 */}
            {c.reason && (
              <div className="pt-1.5 border-t border-gray-100 mt-1">
                <span className="text-xs2 text-gray-300 font-medium block mb-0.5">추천 이유</span>
                <p className="text-xs2 text-gray-400 leading-relaxed italic">{c.reason}</p>
              </div>
            )}
          </div>
        );
      })}
      <div className={clsx(
        'rounded-xl border-2 p-3 bg-white transition-all',
        !isFromCandidates(curSel) && curSel.trim() ? 'border-blue-600 bg-blue-50' : 'border-zinc-200',
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 bg-gray-200 text-gray-500">
            {letters[candidates.length] || 'D'}
          </span>
          <span className="text-xs2 text-gray-500 font-semibold">직접 입력</span>
        </div>
        <textarea
          className="w-full text-sm2 font-semibold bg-transparent outline-none resize-none"
          style={{
            color: !isFromCandidates(curSel) && curSel ? '#1f2937' : '#9ca3af',
            fontStyle: !isFromCandidates(curSel) && curSel ? 'normal' : 'italic',
          }}
          placeholder="발명의 명칭을 직접 입력하세요"
          value={isFromCandidates(curSel) ? '' : curSel}
          onChange={e => setGSel(p => ({ ...p, title: e.target.value }))}
          onClick={e => e.stopPropagation()}
          rows={2}
        />
      </div>
    </div>
  );
}

// ── 발명의 설명 항목 카드 (제안기술 / 종래기술 그룹) ──────────────────
const DESC_LABEL_MAP: Record<string, string> = {
  background: '배경기술', implementation: '구현', objective: '목적', effect: '효과',
};

function DescriptionItemCards({
  previous, proposed, onToggle, onChange, onAdd, onRemove, setFocusCtx, guidePanelInputRef,
}: {
  previous: InventionDescriptionItem[];
  proposed: InventionDescriptionItem[];
  onToggle: (type: 'previous' | 'proposed', idx: number) => void;
  onChange: (type: 'previous' | 'proposed', idx: number, text: string) => void;
  onAdd: (type: 'previous' | 'proposed', text: string, label: InventionDescriptionItem['label']) => void;
  onRemove: (type: 'previous' | 'proposed', idx: number) => void;
  setFocusCtx?: (ctx: FocusCtx | null) => void;
  guidePanelInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [tab, setTab] = useState<'previous' | 'proposed'>('proposed');
  const [selState, setSelState] = useState<SelState>(null);
  const [addLabel, setAddLabel] = useState<{ previous: InventionDescriptionItem['label']; proposed: InventionDescriptionItem['label'] }>({
    previous: 'background',
    proposed: 'objective',
  });
  const [addTexts, setAddTexts] = useState({ previous: '', proposed: '' });

  if (previous.length === 0 && proposed.length === 0) {
    return (
      <div className="mt-3 text-center py-6 text-gray-400">
        <p className="text-sm2">발명의 설명 항목을 생성 중입니다...</p>
      </div>
    );
  }

  const handleAdd = (type: 'previous' | 'proposed') => {
    const text = addTexts[type].trim();
    if (!text) return;
    onAdd(type, text, addLabel[type]);
    setAddTexts(p => ({ ...p, [type]: '' }));
  };

  const renderColumn = (type: 'previous' | 'proposed', items: InventionDescriptionItem[]) => {
    const accent = type === 'proposed' ? 'blue' : 'amber';
    return (
      <div>
        <div className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-2 text-xs2 font-bold',
          accent === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
        )}>
          <span>{type === 'proposed' ? '제안기술' : '종래기술'}</span>
          <span className="opacity-60 font-normal">{items.filter(i => i.adopted !== false).length}/{items.length} 채택</span>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => {
            const isAdopted = item.adopted !== false;
            const isAiItem = item.adopted !== undefined;
            const sublabel = DESC_LABEL_MAP[item.label] ?? item.label;
            return (
              <div
                key={idx}
                className={clsx(
                  'rounded-xl border-2 p-3 bg-white transition-all',
                  isAdopted
                    ? (accent === 'blue' ? 'border-blue-300' : 'border-amber-300')
                    : 'border-zinc-200 opacity-50',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs2 text-gray-400 font-medium">{sublabel}</span>
                  {isAiItem ? (
                    <button
                      onClick={() => onToggle(type, idx)}
                      className={clsx(
                        'shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
                        isAdopted
                          ? 'bg-brand-400 border-blue-600 text-white'
                          : 'border-gray-300 bg-white hover:border-blue-400',
                      )}
                      title={isAdopted ? '미채택으로 변경' : '채택'}
                    >
                      {isAdopted && <Icon name="check" size={8} />}
                    </button>
                  ) : (
                    <button
                      onClick={() => onRemove(type, idx)}
                      className="text-xs2 text-gray-300 hover:text-red-400 transition-colors"
                    >✕</button>
                  )}
                  {setFocusCtx && isAdopted && (
                    <button
                      onClick={() => {
                        setFocusCtx({ text: item.text, label: sublabel, apply: (newText) => onChange(type, idx, newText) });
                        setTimeout(() => guidePanelInputRef?.current?.focus(), 50);
                      }}
                      className="ml-auto flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                      AI 수정
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full text-sm2 text-gray-700 leading-relaxed bg-transparent outline-none resize-none min-h-[48px]"
                  value={item.text}
                  disabled={!isAdopted}
                  rows={Math.max(2, Math.ceil(item.text.length / 42))}
                  onChange={e => onChange(type, idx, e.target.value)}
                  placeholder="항목 내용..."
                  onMouseUp={e => {
                    if (!isAdopted) return;
                    const ta = e.currentTarget;
                    if (ta.selectionStart !== ta.selectionEnd) {
                      const rect = ta.getBoundingClientRect();
                      setSelState({ start: ta.selectionStart, end: ta.selectionEnd, originalValue: ta.value, apply: (newText) => onChange(type, idx, newText), top: rect.bottom + 4, left: rect.left });
                    }
                  }}
                />
              </div>
            );
          })}
          {/* 항목 추가 행 */}
          <div className={clsx(
            'rounded-xl border-2 border-dashed p-2.5 transition-colors',
            accent === 'blue' ? 'border-blue-200 focus-within:border-blue-400' : 'border-amber-200 focus-within:border-amber-400',
          )}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs2 text-gray-400">+ 항목 추가</span>
              <select
                value={addLabel[type]}
                onChange={e => setAddLabel(p => ({ ...p, [type]: e.target.value as InventionDescriptionItem['label'] }))}
                className="ml-auto text-xs2 border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 outline-none"
              >
                <option value="background">배경기술</option>
                <option value="implementation">구현방법</option>
                <option value="objective">목적</option>
                <option value="effect">효과</option>
              </select>
            </div>
            <div className="flex gap-1.5 items-end">
              <textarea
                className="flex-1 text-sm2 bg-transparent outline-none resize-none text-gray-700 placeholder-gray-400 min-h-[40px]"
                placeholder="내용 입력..."
                rows={2}
                value={addTexts[type]}
                onChange={e => setAddTexts(p => ({ ...p, [type]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(type); } }}
              />
              <button
                onClick={() => handleAdd(type)}
                disabled={!addTexts[type].trim()}
                className={clsx(
                  'shrink-0 text-xs2 font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40',
                  accent === 'blue' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                )}
              >추가</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    {selState && (
      <TextSelectionPopover
        position={{ top: selState.top, left: selState.left }}
        preview={selState.originalValue.slice(selState.start, selState.end).slice(0, 20)}
        onApply={instruction => {
          const before = selState.originalValue.slice(0, selState.start);
          const selected = selState.originalValue.slice(selState.start, selState.end);
          const after = selState.originalValue.slice(selState.end);
          selState.apply(before + mockPartialModify(selected, instruction) + after);
          setSelState(null);
        }}
        onClose={() => setSelState(null)}
      />
    )}
    <div className="mt-3">
      {/* lg+: 2컬럼 */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
        {renderColumn('proposed', proposed)}
        {renderColumn('previous', previous)}
      </div>
      {/* lg 미만: 탭 */}
      <div className="lg:hidden">
        <div className="flex border-b border-gray-200 mb-3">
          {(['proposed', 'previous'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {t === 'previous' ? '종래기술' : '제안기술'}
            </button>
          ))}
        </div>
        {tab === 'previous'
          ? renderColumn('previous', previous)
          : renderColumn('proposed', proposed)}
      </div>
    </div>
    </>
  );
}

function GuidePanel({ step, confirmed, mobileOpen, onMobileClose, focusCtx, setFocusCtx, chatInputRef }: {
  step: StepId;
  confirmed: Partial<Record<StepId, string>>;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  focusCtx: FocusCtx | null;
  setFocusCtx: (ctx: FocusCtx | null) => void;
  chatInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDone = step in confirmed;
  // 채팅 상태
  const [guideChatMsgs, setGuideChatMsgs] = useState<GuideChatMsg[]>([]);
  const [guideChatInput, setGuideChatInput] = useState('');
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const guideChatIdRef = useRef(0);
  const guideChatEndRef = useRef<HTMLDivElement>(null);
  const [localText, setLocalText] = useState('');
  const [isEditingCtx, setIsEditingCtx] = useState(false);

  useEffect(() => {
    const el = (chatInputRef?.current ?? localTextareaRef.current);
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [guideChatInput, chatInputRef]);

  // focusCtx 변경(섹션 선택, AI 적용) 시 편집 텍스트 동기화 + 편집 모드 리셋
  useEffect(() => {
    setLocalText(focusCtx?.text ?? '');
    setIsEditingCtx(false);
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
        <span className="font-semibold text-sm">AI 어시스턴트</span>
        <Button variant="text" size="icon-sm" onClick={onMobileClose} aria-label="가이드 닫기">
          <Icon name="close" size={16} />
        </Button>
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
        {focusCtx && !isDone && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs2 px-2 py-0.5 rounded-full bg-blue-100 text-brand-400 font-medium">
            ✎ {focusCtx.label} 수정 중
          </span>
        )}
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
      </div>

      {/* 선택된 콘텐츠 — 미리보기/편집 모드 토글 */}
      {focusCtx ? (
        <div className="shrink-0 mx-3 mt-2 mb-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs2 text-blue-600 font-semibold">✎ 선택됨</span>
              <span className="text-xs2 text-zinc-400">· {focusCtx.label}</span>
            </div>
            <button
              onClick={() => setIsEditingCtx(prev => !prev)}
              className="text-xs2 text-blue-500 hover:text-brand-400 transition-colors font-medium"
            >
              {isEditingCtx ? '접기' : '편집'}
            </button>
          </div>
          {isEditingCtx ? (
            <Textarea
              className="w-full text-sm2 text-gray-800 bg-blue-50 px-3 py-2 leading-relaxed scroll-thin"
              value={localText}
              rows={4}
              autoFocus
              onChange={e => {
                setLocalText(e.target.value);
                focusCtx.apply(e.target.value);
              }}
            />
          ) : (
            <div
              className="w-full text-sm2 text-gray-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 leading-relaxed line-clamp-3 cursor-pointer hover:bg-blue-100 hover:border-blue-300 transition-colors"
              onClick={() => setIsEditingCtx(true)}
              title="클릭하여 직접 편집"
            >
              {localText}
            </div>
          )}
          {!isEditingCtx && (
            <p className="text-xs2 text-zinc-400 mt-0.5 pl-1">클릭하거나 '편집'을 눌러 직접 수정할 수 있습니다.</p>
          )}
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
                  <div className="rounded-xl px-2.5 py-1.5 text-xs2 leading-relaxed max-w-[85%] bg-brand-400 text-white">
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
                              m.applied ? 'bg-green-100 text-green-700 cursor-default' : 'bg-brand-400 text-white hover:bg-brand-400',
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
        <div className="shrink-0 flex gap-2 items-end px-3 py-2">
          <Textarea
            ref={chatInputRef ?? localTextareaRef}
            rows={2}
            className="flex-1 px-3 py-2"
            placeholder={focusCtx ? `"${focusCtx.label}" 수정 요청...` : 'AI에게 질문하세요...'}
            value={guideChatInput}
            onChange={e => setGuideChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGuideChat(); } }}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => sendGuideChat()}
            disabled={!guideChatInput.trim()}
            className="shrink-0 w-7 h-7 rounded-xl bg-brand-400 hover:bg-brand-400 disabled:opacity-40 flex items-center justify-center transition-colors">
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
interface CompItem { id: number; text: string; sel: boolean; num: string; depth: number; englishName?: string; definition?: string; parent?: string }
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

function specItemToCompItem(el: SpecComponentItem): CompItem {
  return {
    id: el.id,
    text: el.value_ko + (el.description ? ': ' + el.description : ''),
    sel: el.sel,
    num: el.symbol,
    depth: el.depth,
    englishName: el.value_en,
    definition: el.hypernym_ko,
    parent: '',
  };
}

function compItemToSpecItem(item: CompItem, origMap: Map<number, SpecComponentItem>): SpecComponentItem {
  const orig = origMap.get(item.id);
  return {
    symbol: item.num,
    value_ko: extractCompName(item.text),
    value_en: item.englishName ?? orig?.value_en ?? '',
    description: item.text.includes(':') ? item.text.split(':').slice(1).join(':').trim() : (orig?.description ?? ''),
    hypernym_ko: item.definition ?? orig?.hypernym_ko ?? '',
    hypernym_en: orig?.hypernym_en ?? '',
    id: item.id,
    depth: item.depth,
    sel: item.sel,
  };
}

function ComponentsPanel({ done, onUpdate, onComponentsChange, initialItems }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  onComponentsChange?: (comps: SpecComponentItem[]) => void;
  initialItems?: SpecComponentItem[];
}) {
  const initData: CompItem[] = (initialItems && initialItems.length > 0)
    ? initialItems.map(specItemToCompItem)
    : INIT_COMPS;
  const origMapRef = useRef(new Map<number, SpecComponentItem>(initialItems?.map(el => [el.id, el]) ?? []));
  const [items, setItems] = useState<CompItem[]>(initData);
  const [focusId, setFocusId] = useState<number | null>(null);

  useEffect(() => {
    const selected = initData.filter(it => it.sel);
    onUpdate(selected.map(it => `${it.num || '—'} ${it.text}`).join('\n'));
    onComponentsChange?.(selected.map(it => compItemToSpecItem(it, origMapRef.current)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upd = (next: CompItem[]) => {
    setItems(next);
    const selected = next.filter(it => it.sel);
    onUpdate(selected.map(it => {
      let line = `${it.num || '—'} ${extractCompName(it.text)}`;
      if (it.englishName) line += ` (${it.englishName})`;
      return line;
    }).join('\n'));
    onComponentsChange?.(next.map(it => compItemToSpecItem(it, origMapRef.current)));
  };

  const hasNums = (arr: CompItem[]) => arr.some(it => it.num);

  const applyUpd = (next: CompItem[]) => upd(hasNums(next) ? calcAutoNums(next) : next);

  const moveUp   = (idx: number) => { if (idx===0||done) return; const a=[...items]; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; applyUpd(a); };
  const moveDown = (idx: number) => { if (idx===items.length-1||done) return; const a=[...items]; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; applyUpd(a); };
  const indent   = (id: number)  => { if (!done) applyUpd(items.map(it => it.id===id ? {...it, depth: Math.min(it.depth+1,2)} : it)); };
  const outdent  = (id: number)  => { if (!done) applyUpd(items.map(it => it.id===id ? {...it, depth: Math.max(it.depth-1,0)} : it)); };
  const autoAssign = () => { if (!done) upd(calcAutoNums(items)); };
  const add = () => {
    if (done) return;
    const id = Date.now();
    upd([...items, { id, text: '', sel: true, num: '', depth: 0, englishName: '', definition: '', parent: '' }]);
    setFocusId(id);
  };
  // AI 추가 — 자연어 지시로 새 구성요소를 추가 (mock). 기존 항목은 절대 건드리지 않아 손실 없음.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const submitAiComponent = () => {
    const instr = aiInput.trim();
    if (!instr || done) return;
    const id = Date.now();
    upd([...items, {
      id,
      text: instr.length > 24 ? instr.slice(0, 24) : instr,
      sel: true, num: '', depth: 0,
      englishName: '',
      definition: `${instr} (AI 제안 — 상세 설명·영문명·상위어를 보완하세요)`,
      parent: '',
    }]);
    setAiInput('');
    setAiOpen(false);
    setFocusId(id);
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
            <div className="flex items-center gap-1">
              <button onClick={() => setAiOpen(o => !o)}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs2 font-semibold border transition-colors',
                  aiOpen ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100',
                )}
                title="자연어 지시로 AI가 구성요소를 추가">
                <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                AI 추가
              </button>
              <button onClick={autoAssign}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs2 font-semibold bg-blue-50 border border-blue-200 text-brand-400 hover:bg-blue-100 transition-colors">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="10" height="10">
                  <path d="M2 6h8M8 4l2 2-2 2"/>
                </svg>
                부호 자동 부여
              </button>
            </div>
          )}
        </div>
        {/* AI 추가 입력 바 */}
        {!done && aiOpen && (
          <div className="mb-2 rounded-lg border-2 border-violet-200 bg-violet-50/40 p-2">
            <div className="flex gap-1.5 items-end">
              <textarea
                autoFocus
                className="flex-1 text-xs2 bg-white border border-violet-200 rounded px-2 py-1 outline-none focus:border-violet-400 resize-none min-h-[36px]"
                placeholder="추가할 구성요소를 설명하세요. 예: 사용자 인증을 처리하는 보안 모듈 (Enter로 추가)"
                rows={2}
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAiComponent(); } }}
              />
              <button
                onClick={submitAiComponent}
                disabled={!aiInput.trim()}
                className="shrink-0 text-xs2 font-semibold px-2.5 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >추가</button>
            </div>
          </div>
        )}
        {!done && (
          <p className="text-xs2 text-gray-400 mb-2">
            순서 조정 후 <strong className="text-blue-600">부호 자동 부여</strong>를 클릭하면 100, 200... 번호가 할당됩니다.
          </p>
        )}

        <div className="space-y-2">
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
                dropIdx === idx && dragIdx !== idx && 'ring-2 ring-blue-400 ring-offset-1 rounded-lg'
              )}>
              <div className={clsx(
                'rounded-lg border p-2 space-y-1.5 transition-all group',
                item.sel && !done ? 'bg-white border-gray-200 hover:border-blue-300' : '',
                !item.sel ? 'bg-gray-50 border-dashed border-gray-200' : '',
                done && item.sel ? 'bg-green-50 border-green-200' : ''
              )}>
                {/* 컨트롤 행: 채택 + 드래그 + 부호 + 순서 조정 */}
                <div className="flex items-center gap-1">
                  {!done && (
                    <button
                      onClick={() => upd(items.map(it => it.id===item.id ? {...it, sel: !it.sel} : it).filter(it => it.sel || it.text.trim()))}
                      className={clsx(
                        'shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
                        item.sel
                          ? 'bg-brand-400 border-blue-600 text-white'
                          : 'border-gray-300 bg-white hover:border-blue-400',
                      )}
                      title={item.sel ? '미채택으로 변경' : '채택'}
                    >
                      {item.sel && <Icon name="check" size={8} />}
                    </button>
                  )}
                  <span className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0 select-none text-xs leading-none px-0.5">⠿</span>
                  <span className={clsx(
                    'w-8 text-xs2 font-bold rounded px-1 py-0.5 shrink-0 text-center',
                    item.num ? 'bg-blue-100 text-brand-400' : 'bg-gray-100 text-gray-400'
                  )}>
                    {item.num || '—'}
                  </span>
                  {!done && (
                    <div className="flex items-center gap-px shrink-0 ml-auto">
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
                    </div>
                  )}
                </div>

                {/* 필드 행 — 라벨 컬럼 정렬 (명칭/영문명/정의/상위어) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs2 text-gray-400 w-11 shrink-0">명칭</span>
                    {!done ? (
                      <input
                        ref={el => { if (el && item.id === focusId) { el.focus(); setFocusId(null); } }}
                        className="flex-1 text-xs2 text-gray-800 font-medium bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-blue-300 focus:bg-white transition-colors min-w-0"
                        value={item.text}
                        placeholder="구성요소 명칭..."
                        onChange={e => upd(items.map(it => it.id===item.id ? {...it, text: e.target.value} : it))}
                      />
                    ) : (
                      <span className="flex-1 text-xs2 text-gray-800 font-medium min-w-0 truncate">{item.text}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs2 text-gray-400 w-11 shrink-0">영문명</span>
                    {!done ? (
                      <input
                        className="flex-1 text-xs2 text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-blue-300 focus:bg-white transition-colors"
                        value={item.englishName || ''}
                        placeholder="English name"
                        onChange={e => upd(items.map(it => it.id===item.id ? {...it, englishName: e.target.value} : it))}
                      />
                    ) : (
                      <span className="flex-1 text-xs2 text-gray-500">{item.englishName || <span className="text-gray-300">—</span>}</span>
                    )}
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-xs2 text-gray-400 w-11 shrink-0 mt-0.5">정의</span>
                    {!done ? (
                      <Textarea
                        className="flex-1 text-xs2 text-gray-600 bg-gray-50 px-2 py-0.5"
                        value={item.definition || ''}
                        placeholder="구성요소의 기능·역할 설명"
                        rows={2}
                        onChange={e => upd(items.map(it => it.id===item.id ? {...it, definition: e.target.value} : it))}
                      />
                    ) : (
                      <span className="flex-1 text-xs2 text-gray-500 leading-relaxed">{item.definition || <span className="text-gray-300">—</span>}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs2 text-gray-400 w-11 shrink-0">상위어</span>
                    {!done ? (
                      <input
                        className="flex-1 text-xs2 text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-blue-300 focus:bg-white transition-colors"
                        value={item.parent || ''}
                        placeholder="상위 개념 / hypernym"
                        onChange={e => upd(items.map(it => it.id===item.id ? {...it, parent: e.target.value} : it))}
                      />
                    ) : (
                      <span className="flex-1 text-xs2 text-gray-500">{item.parent || <span className="text-gray-300">—</span>}</span>
                    )}
                  </div>
                </div>
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

        {/* 새 구성요소 추가 — 빈 카드 생성 후 인라인 편집 */}
        {!done && (
          <button
            onClick={add}
            className="w-full mt-3 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 border-dashed border-gray-200 text-xs2 font-semibold text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
          >
            <Icon name="plus" size={12} /> 구성요소 추가
          </button>
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

const DRAWING_LABEL_MAP: Record<string, { text: string; cls: string }> = {
  proposed_implementation: { text: '제안기술', cls: 'bg-blue-100 text-brand-400' },
  previous_implementation: { text: '종래기술', cls: 'bg-gray-100 text-gray-600' },
  background:              { text: '배경',     cls: 'bg-zinc-100 text-zinc-600' },
  effect:                  { text: '효과',     cls: 'bg-violet-100 text-violet-700' },
};

function toWorkflowDrawingItem(drawing: Drawing, idx: number): WorkflowDrawingItem {
  const bbox = drawing.image.bbox
    ? { x: drawing.image.bbox.x1, y: drawing.image.bbox.y1, w: drawing.image.bbox.x2 - drawing.image.bbox.x1, h: drawing.image.bbox.y2 - drawing.image.bbox.y1 }
    : { x: 0, y: 0, w: 0, h: 0 };
  const labelMap: Record<string, WorkflowDrawingItem['label']> = {
    proposed_implementation: '제안기술',
    previous_implementation: '종래기술',
    background: '종래기술',
    effect: '제안기술',
  };
  return {
    id: String(idx),
    symbol: idx + 1,
    label: labelMap[drawing.detail.label] ?? 'AI생성',
    name: drawing.detail.name,
    description: drawing.detail.description,
    applied: drawing.useForSpec ?? false,
    pageNumber: 1,
    stage: 'bbox-adjusted',
    originalImageUrl: drawing.image.file.data ? `data:${drawing.image.file.media_type};base64,${drawing.image.file.data}` : '',
    bbox,
  };
}

function openDrawingInNewTab(data: string, mediaType: string, bbox?: { x1: number; y1: number; x2: number; y2: number }) {
  if (!data) return;
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    if (bbox) {
      const w = bbox.x2 - bbox.x1;
      const h = bbox.y2 - bbox.y1;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, bbox.x1, bbox.y1, w, h, 0, 0, w, h);
    } else {
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);
    }
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, 'image/png');
  };
  img.src = `data:${mediaType};base64,${data}`;
}

function CroppedCanvas({ data, mediaType, bbox }: { data: string; mediaType: string; bbox: { x1: number; y1: number; x2: number; y2: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new window.Image();
    img.onload = () => {
      const w = bbox.x2 - bbox.x1;
      const h = bbox.y2 - bbox.y1;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, bbox.x1, bbox.y1, w, h, 0, 0, w, h);
    };
    img.src = `data:${mediaType};base64,${data}`;
  }, [data, mediaType, bbox.x1, bbox.y1, bbox.x2, bbox.y2]);
  return <canvas ref={canvasRef} className="w-full h-full object-contain" />;
}

function DrawingsPanel({ done, onUpdate, drawings: propDrawings, onUpdateDrawings }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  drawings?: Drawing[];
  onUpdateDrawings?: (next: Drawing[]) => void;
}) {
  const [drawStage, setDrawStage] = useState<1 | 2 | 3>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawings = propDrawings ?? MOCK_DRAWINGS;

  const updateDrawings = (next: Drawing[]) => {
    onUpdateDrawings?.(next);
    onUpdate(next.filter(d => d.useForSpec).map(d => `${d.detail.symbol} ${d.detail.name}: ${d.detail.description}`).join('\n\n'));
  };

  useEffect(() => {
    return onEditorResult((result) => {
      const idx = parseInt(result.drawingId, 10);
      if (!isNaN(idx) && result.adjustedBbox) {
        const ab = result.adjustedBbox;
        updateDrawings(drawings.map((d, i) =>
          i === idx ? { ...d, image: { ...d.image, bbox: { x1: ab.x, y1: ab.y, x2: ab.x + ab.w, y2: ab.y + ab.h } } } : d
        ));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings]);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = (ev.target?.result as string).split(',')[1] ?? '';
      const newDrawing: Drawing = {
        image: { file: { data: base64, media_type: file.type as 'image/png' }, bbox: undefined },
        detail: { symbol: `도면${drawings.length + 1}`, name: file.name.replace(/\.[^.]+$/, ''), description: '', label: 'proposed_implementation' },
        included: true, useForSpec: false, isRepresentative: false,
      };
      updateDrawings([...drawings, newDrawing]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleIncluded = (idx: number) => {
    if (done) return;
    const next = drawings.map((d, i) => i === idx ? { ...d, included: !(d.included ?? true) } : d);
    updateDrawings(next);
  };

  const toggleUseForSpec = (idx: number) => {
    if (done) return;
    const next = drawings.map((d, i) => i === idx ? { ...d, useForSpec: !(d.useForSpec ?? false) } : d);
    updateDrawings(next);
  };

  const setRepresentative = (idx: number) => {
    if (done) return;
    const next = drawings.map((d, i) => ({ ...d, isRepresentative: i === idx }));
    updateDrawings(next);
  };

  const cloneDrawing = (idx: number) => {
    if (done) return;
    const orig = drawings[idx];
    const copy: Drawing = { ...orig, detail: { ...orig.detail, symbol: `${orig.detail.symbol}-복사` }, isRepresentative: false };
    const next = [...drawings.slice(0, idx + 1), copy, ...drawings.slice(idx + 1)];
    updateDrawings(next);
  };

  const includedDrawings = drawings.filter(d => d.included !== false);
  const specDrawings = includedDrawings.filter(d => d.useForSpec);

  const STAGE_LABELS = ['포함 여부', '용도 분류', '대표도면'];

  const renderThumbnail = (d: Drawing, extra?: React.ReactNode) => {
    const hasData = !!d.image.file.data;
    const bbox = d.image.bbox;
    return (
      <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden relative group">
        {hasData
          ? (bbox
            ? <CroppedCanvas data={d.image.file.data} mediaType={d.image.file.media_type} bbox={bbox} />
            : <img src={`data:${d.image.file.media_type};base64,${d.image.file.data}`} className="w-full h-full object-contain" alt="" />)
          : <Icon name="image" size={28} className="text-gray-200" />}
        {hasData && (
          <button
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-white/90 rounded text-gray-500 hover:text-blue-600 transition-opacity text-xs2 leading-none"
            onClick={e => { e.stopPropagation(); openDrawingInNewTab(d.image.file.data, d.image.file.media_type, bbox); }}
            title="새 탭에서 열기"
          >↗</button>
        )}
        {extra}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3 ml-1.5">
      {/* Stage 탭 */}
      <div className="flex gap-1 mb-3">
        {STAGE_LABELS.map((label, i) => {
          const s = (i + 1) as 1 | 2 | 3;
          return (
            <button
              key={s}
              onClick={() => setDrawStage(s)}
              className={clsx(
                'flex-1 py-1.5 text-xs2 font-semibold rounded-lg border transition-colors',
                drawStage === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600',
              )}
            >
              {`${s}단계: ${label}`}
            </button>
          );
        })}
      </div>

      {/* Stage 1: 포함 여부 */}
      {drawStage === 1 && (
        <>
          <p className="text-xs2 text-gray-500 mb-2">
            전체 도면 <span className="font-semibold">{drawings.length}개</span> · 포함 <span className="font-semibold">{includedDrawings.length}개</span>
          </p>
          {drawings.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm2">도면이 없습니다.</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {drawings.map((d, idx) => {
              const included = d.included !== false;
              const labelInfo = DRAWING_LABEL_MAP[d.detail.label] ?? { text: d.detail.label, cls: 'bg-gray-100 text-gray-600' };
              return (
                <div key={idx} className={clsx(
                  'rounded-xl border-2 overflow-hidden flex flex-col bg-white transition-all',
                  included ? 'border-blue-300' : 'border-zinc-200 opacity-60',
                  done && 'pointer-events-none',
                )}>
                  {renderThumbnail(d)}
                  <div className="px-2.5 pt-1.5 pb-1">
                    <div className="flex items-center gap-1 flex-wrap mb-0.5">
                      <span className="text-xs2 font-bold text-gray-700">{d.detail.symbol}</span>
                      <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', labelInfo.cls)}>{labelInfo.text}</span>
                    </div>
                    <p className="text-xs2 text-gray-700 font-semibold leading-snug line-clamp-1">{d.detail.name}</p>
                  </div>
                  {!done && (
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => toggleIncluded(idx)}
                        className={clsx(
                          'flex-1 py-1.5 text-xs2 font-semibold transition-colors',
                          included ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:bg-gray-50',
                        )}
                      >{included ? '✓ 포함' : '제외'}</button>
                      <button
                        onClick={() => openEditorTab({
                          drawingId: String(idx),
                          drawings: drawings.map(toWorkflowDrawingItem),
                          components: [],
                          references: [],
                          drawingName: d.detail.name,
                          timestamp: Date.now(),
                        })}
                        className="px-2.5 py-1.5 text-xs2 font-semibold border-l border-gray-100 text-blue-500 hover:bg-blue-50 transition-colors"
                      >범위 조정</button>
                      <button
                        onClick={() => cloneDrawing(idx)}
                        className="px-2.5 py-1.5 text-xs2 font-semibold border-l border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                      >복제</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!done && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs2 font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Icon name="plus" size={11} />
                이미지 추가
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileAdd} />
              <button
                onClick={() => setDrawStage(2)}
                className="flex-1 py-2 text-xs2 font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
              >2단계: 용도 분류 →</button>
            </div>
          )}
        </>
      )}

      {/* Stage 2: 용도 분류 */}
      {drawStage === 2 && (
        <>
          <p className="text-xs2 text-gray-500 mb-2">
            포함된 도면 <span className="font-semibold">{includedDrawings.length}개</span> · 명세서 포함 <span className="font-semibold">{specDrawings.length}개</span>
          </p>
          {includedDrawings.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm2">1단계에서 포함할 도면을 선택해주세요.</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {drawings.map((d, idx) => {
              if (d.included === false) return null;
              const isForSpec = d.useForSpec ?? false;
              const labelInfo = DRAWING_LABEL_MAP[d.detail.label] ?? { text: d.detail.label, cls: 'bg-gray-100 text-gray-600' };
              return (
                <div key={idx} className={clsx(
                  'rounded-xl border-2 overflow-hidden flex flex-col bg-white transition-all',
                  isForSpec ? 'border-blue-300' : 'border-zinc-200',
                  done && 'pointer-events-none',
                )}>
                  <div className={clsx('w-full aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden relative group', !isForSpec && 'grayscale opacity-60')}>
                    {d.image.file.data
                      ? (d.image.bbox
                        ? <CroppedCanvas data={d.image.file.data} mediaType={d.image.file.media_type} bbox={d.image.bbox} />
                        : <img src={`data:${d.image.file.media_type};base64,${d.image.file.data}`} className="w-full h-full object-contain" alt="" />)
                      : <Icon name="image" size={28} className="text-gray-200" />}
                    {d.image.file.data && (
                      <button
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-white/90 rounded text-gray-500 hover:text-blue-600 transition-opacity text-xs2 leading-none"
                        onClick={e => { e.stopPropagation(); openDrawingInNewTab(d.image.file.data, d.image.file.media_type, d.image.bbox); }}
                        title="새 탭에서 열기"
                      >↗</button>
                    )}
                  </div>
                  <div className="px-2.5 pt-1.5 pb-1">
                    <div className="flex items-center gap-1 flex-wrap mb-0.5">
                      <span className="text-xs2 font-bold text-gray-700">{d.detail.symbol}</span>
                      <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', labelInfo.cls)}>{labelInfo.text}</span>
                    </div>
                    <p className="text-xs2 text-gray-700 font-semibold leading-snug line-clamp-1">{d.detail.name}</p>
                  </div>
                  {!done && (
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => toggleUseForSpec(idx)}
                        className={clsx(
                          'flex-1 py-1.5 text-xs2 font-semibold transition-colors',
                          isForSpec ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:bg-gray-50',
                        )}
                      >{isForSpec ? '✓ 명세서 포함' : 'AI 참고용'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setDrawStage(1)}
              className="flex-1 py-2 text-xs2 font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
            >← 1단계</button>
            {!done && (
              <button
                onClick={() => setDrawStage(3)}
                className="flex-1 py-2 text-xs2 font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
              >3단계: 대표도면 →</button>
            )}
          </div>
        </>
      )}

      {/* Stage 3: 대표도면 선택 */}
      {drawStage === 3 && (
        <>
          <p className="text-xs2 text-gray-500 mb-2">
            명세서 포함 도면 중 <span className="font-semibold">대표도면</span> 1개를 선택하세요.
          </p>
          {specDrawings.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm2">2단계에서 명세서 포함 도면을 선택해주세요.</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {drawings.map((d, idx) => {
              if (d.included === false || !d.useForSpec) return null;
              const isRepresentative = d.isRepresentative ?? false;
              return (
                <button
                  key={idx}
                  onClick={() => !done && setRepresentative(idx)}
                  className={clsx(
                    'rounded-xl border-2 overflow-hidden flex flex-col bg-white transition-all text-left',
                    isRepresentative ? 'border-blue-500 ring-2 ring-blue-200' : 'border-zinc-200 hover:border-blue-300',
                    done && 'pointer-events-none',
                  )}
                >
                  {renderThumbnail(d, isRepresentative ? (
                    <span className="absolute top-1.5 right-1.5 text-xs2 px-2 py-0.5 rounded-full font-semibold bg-blue-600 text-white">대표도</span>
                  ) : undefined)}
                  <div className="px-2.5 pt-1.5 pb-2">
                    <div className="flex items-center gap-1.5">
                      <div className={clsx(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        isRepresentative ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
                      )}>
                        {isRepresentative && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs2 font-bold text-gray-700">{d.detail.symbol}</span>
                    </div>
                    <p className="text-xs2 text-gray-700 font-semibold leading-snug line-clamp-1 mt-0.5">{d.detail.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setDrawStage(2)}
              className="flex-1 py-2 text-xs2 font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
            >← 2단계</button>
          </div>
        </>
      )}

    </div>
  );
}

// ── 독립항 세트 권리범위 레이블 매핑 ──────────────────────────────────────────
const SCOPE_LABELS: Record<string, { label: string; sub: string }> = {
  BROAD:        { label: '넓은 권리범위', sub: '청구 범위 최대화 — 심사 대응 필요' },
  INTERMEDIATE: { label: '균형 권리범위', sub: '등록 가능성과 보호 범위 균형' },
  NARROW:       { label: '한정 권리범위', sub: '구체 구성 한정 — 등록 용이' },
};

const CATEGORY_LABEL: Record<string, string> = {
  MACHINE:       '장치항',
  PROCESS:       '방법항',
  MANUFACTURE:   '제조항',
  COMPOSITION:   '조성물항',
};

interface DepItemState {
  id: number; text: string; sel: boolean;
  editing: boolean; editVal: string;
}
interface DepGroupState { generated: boolean; items: DepItemState[]; newText: string }

// 선택된 세트의 각 claim별 종속항 그룹 (key: claimIndex 숫자)
type DepGroupsForSet = Record<number, DepGroupState>;

function ClaimsPanel({ done, onUpdate, onFocusContext, guidePanelInputRef }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  onFocusContext?: (ctx: { text: string; label: string; apply: (t: string) => void }) => void;
  guidePanelInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [claimsPhase, setClaimsPhase] = useState<'indep' | 'dep'>('indep');
  const [claimSets] = useState(MOCK_INDEPENDENT_CLAIM_SETS);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(2); // 기본: INTERMEDIATE
  const [claimSelState, setClaimSelState] = useState<SelState>(null);
  const [preference, setPreference] = useState<{ abstraction: string; categories: string[]; descriptions: Record<string, string> }>({
    abstraction: 'INTERMEDIATE',
    categories: ['MACHINE', 'PROCESS'],
    descriptions: {},
  });
  const [depGroupsMap, setDepGroupsMap] = useState<Record<number, DepGroupsForSet>>({});
  const [claimTexts, setClaimTexts] = useState<Record<number, Record<number, string>>>({}); // setIdx → claimIdx → text
  const [depLevel, setDepLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM'); // 종속항 개수 레벨 (API claim_count_level)

  const getClaimText = (setIdx: number, claimIdx: number): string => {
    return claimTexts[setIdx]?.[claimIdx] ?? claimSets[setIdx]?.claims[claimIdx]?.value ?? '';
  };
  const setClaimText = (setIdx: number, claimIdx: number, text: string) => {
    setClaimTexts(p => ({ ...p, [setIdx]: { ...(p[setIdx] ?? {}), [claimIdx]: text } }));
  };

  const selectedSet = selectedSetIndex !== null ? claimSets[selectedSetIndex] ?? null : null;

  // 전체 요약을 상위에 동기화
  const syncUpdate = (idx: number | null, groups: Record<number, DepGroupsForSet>) => {
    const set = idx !== null ? claimSets[idx] : null;
    if (!set || idx === null) { onUpdate('독립항 0개, 종속항 0개'); return; }
    let num = 0;
    const lines: string[] = [];
    const setGroups = groups[idx] ?? {};
    set.claims.forEach((claim, ci) => {
      const text = claimTexts[idx]?.[ci] ?? claim.value;
      const indepNum = ++num;
      lines.push(`청구항 ${indepNum}.\n${text}`);
      const grp = setGroups[ci];
      if (grp?.generated) {
        grp.items.filter(d => d.sel).forEach(d => {
          const correctedText = d.text.replace(new RegExp(`제${ci + 1}항에 있어서`, 'g'), `제${indepNum}항에 있어서`);
          lines.push(`청구항 ${++num}.\n${correctedText}`);
        });
      }
    });
    const indepCount = set.claims.length;
    const depCount = Object.values(setGroups).reduce((acc, g) => acc + ((g as DepGroupState)?.items.filter(d => d.sel).length ?? 0), 0);
    onUpdate(`독립항 ${indepCount}개, 종속항 ${depCount}개\n\n${lines.join('\n\n')}`);
  };

  // 마운트 시 초기값 동기화
  useEffect(() => {
    if (selectedSet && selectedSetIndex !== null) {
      const text = selectedSet.claims.map((c, i) => `청구항 ${i + 1}.\n${c.value}`).join('\n\n');
      onUpdate(`독립항 ${selectedSet.claims.length}개, 종속항 0개\n\n${text}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 종속항 템플릿 풀 (개수 레벨에 따라 slice)
  const depTemplates = (ref: string, suffix: string): string[] => [
    `${ref}항에 있어서, 상기 처리부는 딥러닝 알고리즘을 포함하는, ${suffix}`,
    `${ref}항에 있어서, 상기 입력부는 복수의 센서를 포함하는, ${suffix}`,
    `${ref}항에 있어서, 상기 출력부는 처리 결과를 시각화하여 표시하는, ${suffix}`,
    `${ref}항에 있어서, 상기 구성은 클라우드 환경에서 동작하는, ${suffix}`,
    `${ref}항에 있어서, 상기 처리부는 결과를 저장하는 저장 모듈을 더 포함하는, ${suffix}`,
    `${ref}항에 있어서, 상기 입력부는 사용자 인증 수단을 더 포함하는, ${suffix}`,
  ];
  const LEVEL_DEP_COUNT: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = { LOW: 2, MEDIUM: 4, HIGH: 6 };
  const genDepItems = (ci: number, claim: { category: string }, level: 'LOW' | 'MEDIUM' | 'HIGH'): DepItemState[] => {
    const suffix = claim.category === 'MACHINE' ? '데이터 처리 시스템.' : '데이터 처리 방법.';
    const ref = `제${ci + 1}`;
    return depTemplates(ref, suffix).slice(0, LEVEL_DEP_COUNT[level]).map((text, i) => ({
      id: i + 1, sel: true, text, editing: false, editVal: '',
    }));
  };
  // 개수 레벨 변경 → 선택 세트 종속항 재생성
  const applyDepLevel = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    setDepLevel(level);
    if (selectedSetIndex === null || !selectedSet) return;
    const groups: DepGroupsForSet = {};
    selectedSet.claims.forEach((claim, ci) => {
      groups[ci] = { generated: true, newText: '', items: genDepItems(ci, claim, level) };
    });
    const nextMap = { ...depGroupsMap, [selectedSetIndex]: groups };
    setDepGroupsMap(nextMap);
    syncUpdate(selectedSetIndex, nextMap);
  };

  const confirmIndep = () => {
    if (selectedSetIndex === null || !selectedSet) return;
    const autoGroups: DepGroupsForSet = {};
    selectedSet.claims.forEach((claim, ci) => {
      if (!(depGroupsMap[selectedSetIndex]?.[ci]?.generated)) {
        autoGroups[ci] = { generated: true, newText: '', items: genDepItems(ci, claim, depLevel) };
      } else {
        autoGroups[ci] = depGroupsMap[selectedSetIndex]![ci];
      }
    });
    const nextMap = { ...depGroupsMap, [selectedSetIndex]: autoGroups };
    setDepGroupsMap(nextMap);
    setClaimsPhase('dep');
    syncUpdate(selectedSetIndex, nextMap);
  };

  const toggleDep = (claimIdx: number, depId: number) => {
    if (done || selectedSetIndex === null) return;
    const setGroups = depGroupsMap[selectedSetIndex] ?? {};
    const grp = setGroups[claimIdx];
    if (!grp) return;
    const next = { ...setGroups, [claimIdx]: { ...grp, items: grp.items.map(d => d.id === depId ? { ...d, sel: !d.sel } : d) } };
    const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
    setDepGroupsMap(nextMap);
    syncUpdate(selectedSetIndex, nextMap);
  };

  const removeDep = (claimIdx: number, depId: number) => {
    if (selectedSetIndex === null) return;
    const setGroups = depGroupsMap[selectedSetIndex] ?? {};
    const grp = setGroups[claimIdx];
    if (!grp) return;
    const next = { ...setGroups, [claimIdx]: { ...grp, items: grp.items.filter(d => d.id !== depId) } };
    const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
    setDepGroupsMap(nextMap);
    syncUpdate(selectedSetIndex, nextMap);
  };

  const addDep = (claimIdx: number) => {
    if (selectedSetIndex === null) return;
    const setGroups = depGroupsMap[selectedSetIndex] ?? {};
    const grp = setGroups[claimIdx];
    if (!grp || !grp.newText.trim()) return;
    const maxId = grp.items.reduce((m, d) => Math.max(m, d.id), 0);
    const newItem: DepItemState = { id: maxId + 1, text: grp.newText.trim(), sel: true, editing: false, editVal: grp.newText.trim() };
    const next = { ...setGroups, [claimIdx]: { ...grp, items: [...grp.items, newItem], newText: '' } };
    const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
    setDepGroupsMap(nextMap);
    syncUpdate(selectedSetIndex, nextMap);
  };

  const updateDepNewText = (claimIdx: number, text: string) => {
    if (selectedSetIndex === null) return;
    const setGroups = depGroupsMap[selectedSetIndex] ?? {};
    const grp = setGroups[claimIdx] ?? { generated: true, newText: '', items: [] };
    const nextMap = { ...depGroupsMap, [selectedSetIndex]: { ...setGroups, [claimIdx]: { ...grp, newText: text } } };
    setDepGroupsMap(nextMap);
  };

  // ── Phase A: 세트 단일 선택 (라디오) ───────────────────────────────────────
  if (claimsPhase === 'indep') {
    const filteredSetIndices = claimSets
      .map((_set, idx) => idx)
      .filter(idx => {
        const set = claimSets[idx];
        const abstractMatch = preference.abstraction === 'ALL' || set.abstraction_level === preference.abstraction;
        const categoryMatch = preference.categories.length === 0 || set.claims.some(c => preference.categories.includes(c.category));
        return abstractMatch && categoryMatch;
      });

    return (
      <>
      {claimSelState && (
        <TextSelectionPopover
          position={{ top: claimSelState.top, left: claimSelState.left }}
          preview={claimSelState.originalValue.slice(claimSelState.start, claimSelState.end).slice(0, 20)}
          onApply={instruction => {
            const before = claimSelState.originalValue.slice(0, claimSelState.start);
            const selected = claimSelState.originalValue.slice(claimSelState.start, claimSelState.end);
            const after = claimSelState.originalValue.slice(claimSelState.end);
            claimSelState.apply(before + mockPartialModify(selected, instruction) + after);
            setClaimSelState(null);
          }}
          onClose={() => setClaimSelState(null)}
        />
      )}
      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2.5 ml-1.5">
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
          <p className="text-xs2 text-brand-400 font-medium">AI가 권리범위별 독립항 세트를 생성했습니다.</p>
          <p className="text-xs2 text-gray-500 mt-0.5">각 세트는 장치항·방법항 쌍으로 구성됩니다. <strong className="text-gray-700">1개를 선택</strong>하면 종속항이 구성됩니다.</p>
        </div>

        {/* Preference UI */}
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 space-y-2">
          <p className="text-xs2 font-semibold text-gray-600">권리범위 설정</p>
          <div>
            <p className="text-xs2 text-gray-400 mb-1">추상화 수준</p>
            <div className="flex gap-1.5">
              {(['BROAD', 'INTERMEDIATE', 'NARROW'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => !done && setPreference(p => ({ ...p, abstraction: level }))}
                  className={clsx(
                    'flex-1 py-1 text-xs2 font-semibold rounded-lg border transition-colors',
                    preference.abstraction === level
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300',
                  )}
                >
                  {SCOPE_LABELS[level]?.label.replace(' 권리범위', '') ?? level}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs2 text-gray-400 mb-1">카테고리 (복수 선택)</p>
            <div className="flex gap-1.5 flex-wrap">
              {(['MACHINE', 'PROCESS', 'MANUFACTURE', 'COMPOSITION'] as const).map(cat => {
                const active = preference.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => !done && setPreference(p => ({
                      ...p,
                      categories: active ? p.categories.filter(c => c !== cat) : [...p.categories, cat],
                    }))}
                    className={clsx(
                      'px-2 py-0.5 text-xs2 font-semibold rounded-lg border transition-colors',
                      active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300',
                    )}
                  >{CATEGORY_LABEL[cat]}</button>
                );
              })}
            </div>
            {/* 카테고리별 설명(description) preference — API independent-claim/set preference.claims[].description */}
            {preference.categories.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {preference.categories.map(cat => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <span className="text-xs2 font-semibold text-purple-600 w-14 shrink-0">{CATEGORY_LABEL[cat] ?? cat}</span>
                    <input
                      className="flex-1 text-xs2 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-purple-300 transition-colors"
                      placeholder="이 카테고리 청구항의 방향·강조점 (선택)"
                      value={preference.descriptions[cat] ?? ''}
                      disabled={done}
                      onChange={e => setPreference(p => ({ ...p, descriptions: { ...p.descriptions, [cat]: e.target.value } }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {filteredSetIndices.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-xs2">선택한 조건에 맞는 세트가 없습니다.</div>
        )}

        {filteredSetIndices.map(setIdx => {
          const set = claimSets[setIdx];
          const isSelected = selectedSetIndex === setIdx;
          const scopeInfo = SCOPE_LABELS[set.abstraction_level] ?? { label: set.abstraction_level, sub: '' };
          return (
            <div
              key={setIdx}
              onClick={() => { if (!done) { setSelectedSetIndex(setIdx); syncUpdate(setIdx, depGroupsMap); } }}
              className={clsx(
                'rounded-xl border-2 transition-all cursor-pointer',
                isSelected
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
              )}
            >
              <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                <button
                  onClick={e => { e.stopPropagation(); if (!done) { setSelectedSetIndex(setIdx); syncUpdate(setIdx, depGroupsMap); } }}
                  className={clsx(
                    'w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white hover:border-blue-400'
                  )}
                  style={{ width: '18px', height: '18px' }}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-white block" />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={clsx('text-sm2 font-semibold', isSelected ? 'text-blue-700' : 'text-gray-700')}>
                    {scopeInfo.label}
                  </span>
                  <span className="text-xs2 text-gray-400 ml-2">{scopeInfo.sub}</span>
                </div>
                {isSelected && !done && (
                  <span className="text-xs2 text-blue-600 font-semibold shrink-0">선택됨</span>
                )}
              </div>

              <div className="px-3 pb-3 space-y-1.5">
                {set.claims.map((claim, ci) => {
                  const text = getClaimText(setIdx, ci);
                  const catLabel = CATEGORY_LABEL[claim.category] ?? claim.category;
                  return (
                    <div key={ci} className={clsx(
                      'rounded-lg border px-3 py-2',
                      isSelected ? 'border-blue-200 bg-white' : 'border-zinc-100 bg-zinc-50'
                    )}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs2 px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700">{catLabel}</span>
                        {!done && isSelected && (
                          <button
                            onClick={e => { e.stopPropagation(); onFocusContext?.({ text, label: `${scopeInfo.label} — ${catLabel}`, apply: (newText) => setClaimText(setIdx, ci, newText) }); setTimeout(() => guidePanelInputRef?.current?.focus(), 50); }}
                            className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                            수정 요청
                          </button>
                        )}
                      </div>
                      {isSelected && !done ? (
                        <textarea
                          className="w-full text-xs2 text-gray-800 bg-transparent outline-none resize-none leading-relaxed overflow-hidden"
                          value={text}
                          rows={Math.max(3, Math.ceil(text.length / 44))}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { setClaimText(setIdx, ci, e.target.value); syncUpdate(setIdx, depGroupsMap); }}
                          onFocus={() => onFocusContext?.({ text, label: `${scopeInfo.label} — ${catLabel}`, apply: (newText) => setClaimText(setIdx, ci, newText) })}
                          onMouseUp={e => { const ta = e.currentTarget; if (ta.selectionStart !== ta.selectionEnd) { const rect = ta.getBoundingClientRect(); setClaimSelState({ start: ta.selectionStart, end: ta.selectionEnd, originalValue: ta.value, apply: (newText) => { setClaimText(setIdx, ci, newText); syncUpdate(setIdx, depGroupsMap); }, top: rect.bottom + 4, left: rect.left }); } }}
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        />
                      ) : (
                        <p className="text-xs2 text-gray-600 leading-relaxed line-clamp-3">{text}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!done && (
          <button
            onClick={confirmIndep}
            disabled={selectedSetIndex === null}
            className="w-full py-2.5 border border-blue-400 text-blue-600 bg-blue-50 rounded-lg text-sm2 font-medium hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectedSetIndex !== null
              ? `선택한 세트로 종속항 구성 →`
              : '세트를 선택하세요'}
          </button>
        )}
      </div>
      </>
    );
  }

  // ── Phase B: 선택된 세트의 각 claim별 종속항 ──────────────────────────────
  if (!selectedSet || selectedSetIndex === null) return null;
  const setGroups = depGroupsMap[selectedSetIndex] ?? {};
  const scopeInfo = SCOPE_LABELS[selectedSet.abstraction_level] ?? { label: selectedSet.abstraction_level, sub: '' };
  const totalDep = Object.values(setGroups).reduce((acc, g) => acc + ((g as DepGroupState)?.items.filter(d => d.sel).length ?? 0), 0);

  let globalClaimNum = 0;

  return (
    <>
    {claimSelState && (
      <TextSelectionPopover
        position={{ top: claimSelState.top, left: claimSelState.left }}
        preview={claimSelState.originalValue.slice(claimSelState.start, claimSelState.end).slice(0, 20)}
        onApply={instruction => {
          const before = claimSelState.originalValue.slice(0, claimSelState.start);
          const selected = claimSelState.originalValue.slice(claimSelState.start, claimSelState.end);
          const after = claimSelState.originalValue.slice(claimSelState.end);
          claimSelState.apply(before + mockPartialModify(selected, instruction) + after);
          setClaimSelState(null);
        }}
        onClose={() => setClaimSelState(null)}
      />
    )}
    <div className="flex-1 overflow-y-auto scroll-thin p-3 ml-1.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs2 font-semibold text-gray-600">
          <span className="text-blue-700">{scopeInfo.label}</span>
          {' '}— 독립항 {selectedSet.claims.length}개, 종속항 {totalDep}개
        </span>
        {!done && (
          <button onClick={() => setClaimsPhase('indep')} className="text-xs2 text-blue-600 hover:underline">
            ← 세트 재선택
          </button>
        )}
      </div>

      {/* 종속항 개수 레벨 (API claim_count_level) */}
      {!done && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <span className="text-xs2 font-semibold text-gray-500 shrink-0">종속항 분량</span>
          <div className="flex gap-1">
            {([['LOW', '적게'], ['MEDIUM', '보통'], ['HIGH', '많이']] as const).map(([lv, label]) => (
              <button
                key={lv}
                onClick={() => applyDepLevel(lv)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs2 font-semibold border transition-colors',
                  depLevel === lv
                    ? 'bg-brand-400 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300',
                )}
              >{label}</button>
            ))}
          </div>
          <span className="text-xs2 text-gray-400 ml-auto">레벨 변경 시 종속항이 재생성됩니다</span>
        </div>
      )}

      {selectedSet.claims.map((claim, ci) => {
        const indepNum = ++globalClaimNum;
        const grp = setGroups[ci] ?? { generated: false, items: [], newText: '' };
        const catLabel = CATEGORY_LABEL[claim.category] ?? claim.category;
        const claimText = getClaimText(selectedSetIndex, ci);

        return (
          <div key={ci} className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="border-b px-3 py-2.5 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-1.5 cursor-pointer"
                onClick={() => !done && onFocusContext?.({ text: claimText, label: `독립항 ${ci + 1} (${catLabel})`, apply: (newText) => setClaimText(selectedSetIndex, ci, newText) })}>
                <Icon name="check" size={11} className="text-blue-600" />
                <span className="text-xs2 font-bold text-brand-400">청구항 {indepNum}</span>
                <span className="text-xs2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">{catLabel}</span>
                {!done && (
                  <button
                    onClick={e => { e.stopPropagation(); onFocusContext?.({ text: claimText, label: `독립항 ${ci + 1} (${catLabel})`, apply: (newText) => setClaimText(selectedSetIndex, ci, newText) }); setTimeout(() => guidePanelInputRef?.current?.focus(), 50); }}
                    className="ml-auto flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
                    수정 요청
                  </button>
                )}
              </div>
              <p className="text-xs2 text-gray-700 leading-relaxed whitespace-pre-wrap px-1">{claimText}</p>
            </div>

            <div className="p-2.5 space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs2 font-semibold text-gray-500">
                  종속항 ({grp.items.filter(d => d.sel).length}개 선택)
                </span>
                {!done && grp.generated && (
                  <button
                    onClick={() => {
                      const isDevice = claim.category === 'MACHINE';
                      const suffix = isDevice ? '데이터 처리 시스템.' : '데이터 처리 방법.';
                      const ref = `제${indepNum}`;
                      const newItems: DepItemState[] = [
                        { id: 1, sel: true,  text: `${ref}항에 있어서, 상기 처리부는 딥러닝 알고리즘을 포함하는, ${suffix}`, editing: false, editVal: '' },
                        { id: 2, sel: true,  text: `${ref}항에 있어서, 상기 입력부는 복수의 센서를 포함하는, ${suffix}`, editing: false, editVal: '' },
                        { id: 3, sel: true,  text: `${ref}항에 있어서, 상기 출력부는 처리 결과를 시각화하여 표시하는, ${suffix}`, editing: false, editVal: '' },
                        { id: 4, sel: false, text: `${ref}항에 있어서, 상기 구성은 클라우드 환경에서 동작하는, ${suffix}`, editing: false, editVal: '' },
                      ];
                      const next = { ...setGroups, [ci]: { ...grp, items: newItems } };
                      const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
                      setDepGroupsMap(nextMap);
                      syncUpdate(selectedSetIndex, nextMap);
                    }}
                    className="text-xs2 text-blue-500 hover:underline"
                  >재생성</button>
                )}
              </div>

              {grp.items.map(dep => {
                const depNum = ++globalClaimNum;
                const displayText = dep.text.replace(new RegExp(`제${ci + 1}항에 있어서`, 'g'), `제${indepNum}항에 있어서`);
                return (
                  <div key={dep.id} className={clsx('rounded-lg border overflow-hidden', dep.sel ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50 opacity-60')}>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer"
                      onClick={() => !done && onFocusContext?.({ text: displayText, label: `종속항 ${depNum}`, apply: (newText) => {
                        const next = { ...setGroups, [ci]: { ...grp, items: grp.items.map(d => d.id === dep.id ? { ...d, text: newText } : d) } };
                        const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
                        setDepGroupsMap(nextMap);
                        syncUpdate(selectedSetIndex, nextMap);
                      } })}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleDep(ci, dep.id); }}
                        className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                          dep.sel ? 'bg-brand-400 border-blue-600 text-white' : 'border-gray-300 bg-white hover:border-blue-400')}
                      >
                        {dep.sel && <Icon name="check" size={8} />}
                      </button>
                      <span className="text-xs2 text-gray-500 font-medium shrink-0">종속항 {depNum}</span>
                      {!done && (
                        <button
                          onClick={e => { e.stopPropagation(); removeDep(ci, dep.id); }}
                          className="ml-auto text-xs2 text-gray-300 hover:text-red-400 transition-colors"
                        >✕</button>
                      )}
                    </div>
                    <div className="px-2.5 pb-2">
                      {!done && dep.sel ? (
                        <textarea
                          className="w-full text-xs2 text-gray-700 leading-relaxed bg-transparent outline-none resize-none overflow-hidden"
                          value={displayText}
                          rows={Math.max(2, Math.ceil(displayText.length / 46))}
                          onChange={e => {
                            const next = { ...setGroups, [ci]: { ...grp, items: grp.items.map(d => d.id === dep.id ? { ...d, text: e.target.value } : d) } };
                            const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
                            setDepGroupsMap(nextMap);
                            syncUpdate(selectedSetIndex, nextMap);
                          }}
                          onMouseUp={e => { const ta = e.currentTarget; if (ta.selectionStart !== ta.selectionEnd) { const rect = ta.getBoundingClientRect(); setClaimSelState({ start: ta.selectionStart, end: ta.selectionEnd, originalValue: ta.value, apply: (newText) => { const next = { ...setGroups, [ci]: { ...grp, items: grp.items.map(d => d.id === dep.id ? { ...d, text: newText } : d) } }; const nextMap = { ...depGroupsMap, [selectedSetIndex]: next }; setDepGroupsMap(nextMap); syncUpdate(selectedSetIndex, nextMap); }, top: rect.bottom + 4, left: rect.left }); } }}
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        />
                      ) : (
                        <p className="text-xs2 text-gray-700 leading-relaxed">{displayText}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {!done && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    value={grp.newText}
                    onChange={e => updateDepNewText(ci, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDep(ci)}
                    placeholder={`제${indepNum}항에 있어서, ...`}
                    className="flex-1 text-xs2 px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:border-blue-400 focus:bg-white"
                  />
                  <button
                    onClick={() => addDep(ci)}
                    disabled={!grp.newText.trim()}
                    className="px-2 py-1.5 text-xs2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-40"
                  >추가</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

// ── 중간명세서 패널 (#22) ─────────────────────────────────────────────────────
function MidspecPanel({ done, sections, onUpdate, onGoToEditor }: {
  done: boolean;
  sections: MidspecSection[];
  onUpdate: (next: MidspecSection[]) => void;
  onGoToEditor?: () => void;
}) {
  const [editing, setEditing] = useState<{ sectionKey: string; blockIdx: number } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [newTexts, setNewTexts] = useState<Record<string, string>>({});

  if (sections.length === 0) {
    return (
      <div className="flex-1 p-4 text-center text-gray-400">
        <p className="text-sm2">중간명세서를 생성 중입니다...</p>
      </div>
    );
  }

  const updateBlock = (sKey: string, bIdx: number, text: string) => {
    const next = sections.map(s => s.key !== sKey ? s : {
      ...s,
      blocks: s.blocks.map((b, i) => i === bIdx ? { text } : b),
    });
    onUpdate(next);
  };

  const addBlock = (sKey: string) => {
    const text = (newTexts[sKey] ?? '').trim();
    if (!text) return;
    const next = sections.map(s => s.key !== sKey ? s : { ...s, blocks: [...s.blocks, { text }] });
    onUpdate(next);
    setNewTexts(p => ({ ...p, [sKey]: '' }));
  };

  const removeBlock = (sKey: string, bIdx: number) => {
    const next = sections.map(s => s.key !== sKey ? s : { ...s, blocks: s.blocks.filter((_, i) => i !== bIdx) });
    onUpdate(next);
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-3 ml-1.5 space-y-3">
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
        <p className="text-xs2 text-brand-400 font-medium">AI가 중간명세서를 초안 작성했습니다.</p>
        <p className="text-xs2 text-gray-500 mt-0.5">각 항목을 직접 편집하거나 블록을 추가·삭제할 수 있습니다.</p>
      </div>

      {sections.map(section => (
        <div key={section.key} className="rounded-xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center px-3 py-2 bg-gray-50 border-b border-zinc-100">
            <span className="text-xs2 font-bold text-gray-700">{section.label}</span>
            <span className="text-xs2 text-gray-400 ml-2">({section.blocks.length}개 블록)</span>
          </div>

          <div className="p-2.5 space-y-2">
            {section.blocks.map((block, bIdx) => {
              const isEdit = editing?.sectionKey === section.key && editing.blockIdx === bIdx;
              return (
                <div key={bIdx} className="rounded-lg border border-zinc-100 bg-white overflow-hidden group">
                  {isEdit ? (
                    <div className="p-2">
                      <textarea
                        autoFocus
                        className="w-full text-xs2 text-gray-800 leading-relaxed bg-transparent outline-none resize-none"
                        value={editVal}
                        rows={Math.max(3, Math.ceil(editVal.length / 46))}
                        onChange={e => setEditVal(e.target.value)}
                        ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                      />
                      <div className="flex gap-1.5 mt-1.5 justify-end">
                        <button
                          onClick={() => setEditing(null)}
                          className="text-xs2 px-2 py-1 rounded text-gray-500 hover:bg-gray-100"
                        >취소</button>
                        <button
                          onClick={() => { updateBlock(section.key, bIdx, editVal); setEditing(null); }}
                          className="text-xs2 px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                        >저장</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 px-3 py-2">
                      <p className="flex-1 text-xs2 text-gray-700 leading-relaxed whitespace-pre-wrap">{block.text}</p>
                      {!done && (
                        <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditing({ sectionKey: section.key, blockIdx: bIdx }); setEditVal(block.text); }}
                            className="text-xs2 text-blue-500 hover:text-blue-700"
                          ><Icon name="edit" size={11} /></button>
                          <button
                            onClick={() => removeBlock(section.key, bIdx)}
                            className="text-xs2 text-gray-300 hover:text-red-400"
                          >✕</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!done && (
              <div className="flex gap-1.5">
                <input
                  value={newTexts[section.key] ?? ''}
                  onChange={e => setNewTexts(p => ({ ...p, [section.key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addBlock(section.key)}
                  placeholder="블록 추가..."
                  className="flex-1 text-xs2 px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:border-blue-400 focus:bg-white"
                />
                <button
                  onClick={() => addBlock(section.key)}
                  disabled={!(newTexts[section.key] ?? '').trim()}
                  className="px-2.5 py-1.5 text-xs2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-40"
                >추가</button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 실시예 생성 버튼 */}
      {!done && onGoToEditor && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs2 text-blue-700 font-semibold mb-1">실시예 설명 생성</p>
          <p className="text-xs2 text-gray-500 mb-2.5">AI가 구성요소 및 도면 정보를 기반으로 실시예 내용을 생성하고 에디터로 이동합니다.</p>
          <button
            onClick={onGoToEditor}
            className="w-full py-2 text-sm2 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
          >실시예 생성 → 에디터로 이동</button>
        </div>
      )}
    </div>
  );
}
