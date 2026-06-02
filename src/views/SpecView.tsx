// SpecView
import { useEffect, useRef, useState } from 'react';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import type { SpecAnalysisState } from '../features/spec/types';
import {
  generateTitleCandidates, generateAbstractCandidates,
  generateComponentCandidates, generateMockDrawings,
  generateDescriptionSection,
} from '../features/spec/mockAiService';
import type { InventionInput, SpecAnalysisResult } from '../features/spec/types';
import { SpecEditorView } from './SpecEditorView';
import { DrawingEditorModal } from '../features/drawing-workflow/DrawingEditorModal';
import { MOCK_DRAWINGS } from '../features/drawing-workflow/types';
import type { DrawingItem } from '../features/drawing-workflow/types';
import {
  openEditorTab, onEditorResult, isMobile,
} from '../features/drawing-workflow/editorChannel';
import type { InventionComponent } from '../features/patent-editor';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { PreviewModal } from '../components/PreviewModal';
import clsx from 'clsx';

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
  const { tasks, activeTaskId } = useStore();
  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
  const taskId = task?.id ?? '';

  // localStorage에서 저장된 상태 로드 (없으면 기본값)
  const savedState = loadSpecState(taskId);

  const [mainView, setMainView] = useState<'analysis' | 'editor'>(() => {
    return savedState?.mainView ?? 'analysis';
  });
  const handleSetMainView = (v: 'analysis' | 'editor') => {
    setMainView(v);
    saveSpecState(taskId, { mainView: v });
  };
  const [guideOpen, setGuideOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [phase, setPhase] = useState<'upload' | 'direct' | 'flow' | 'done'>(() =>
    savedState?.phase ?? 'upload'
  );
  const [curStep, setCurStep] = useState<StepId>(() =>
    (savedState?.curStep as StepId | undefined) ?? 'upload'
  );
  const [confirmed, setConfirmed] = useState<Partial<Record<StepId, string>>>(() =>
    (savedState?.confirmed as Partial<Record<StepId, string>> | undefined) ?? {}
  );
  const [guideStep, setGuideStep] = useState<StepId>(() =>
    (savedState?.curStep !== 'upload' ? (savedState?.curStep as StepId | undefined) : undefined) ?? 'title'
  );
  const [gSel, setGSel] = useState<Partial<Record<StepId, string>>>(() =>
    (savedState?.gSel as Partial<Record<StepId, string>> | undefined) ?? {}
  );

  const [diTitle, setDiTitle] = useState(() => savedState?.diTitle ?? '');
  const [diField, setDiField] = useState(() => savedState?.diField ?? '');
  const [diContent, setDiContent] = useState(() => savedState?.diContent ?? '');
  const [diProblem, setDiProblem] = useState(() => savedState?.diProblem ?? '');
  const [diKeywords, setDiKeywords] = useState(() => savedState?.diKeywords ?? '');
  // 湲곗큹?먮즺 蹂닿린 ?⑤꼸
  const [sourceDataOpen, setSourceDataOpen] = useState(false);

  // 상태 변경 시 localStorage에 동기화
  useEffect(() => {
    if (!taskId) return;
    saveSpecState(taskId, {
      mainView, phase, curStep,
      confirmed: confirmed as Partial<Record<string, string>>,
      gSel: gSel as Partial<Record<string, string>>,
      diTitle, diField, diContent, diProblem, diKeywords,
    } as Partial<SpecAnalysisState>);
  }, [taskId, mainView, phase, curStep, confirmed, gSel, diTitle, diField, diContent, diProblem, diKeywords]);

  // taskId 변경 시 해당 task의 저장 상태로 리로드
  useEffect(() => {
    if (!taskId) return;
    const saved = loadSpecState(taskId);
    if (saved) {
      setMainView(saved.mainView ?? 'analysis');
      setPhase(saved.phase ?? 'upload');
      setCurStep((saved.curStep as StepId | undefined) ?? 'upload');
      setConfirmed((saved.confirmed as Partial<Record<StepId, string>> | undefined) ?? {});
      setGSel((saved.gSel as Partial<Record<StepId, string>> | undefined) ?? {});
      setDiTitle(saved.diTitle ?? '');
      setDiField(saved.diField ?? '');
      setDiContent(saved.diContent ?? '');
      setDiProblem(saved.diProblem ?? '');
      setDiKeywords(saved.diKeywords ?? '');
      if (saved.curStep && saved.curStep !== 'upload') {
        setGuideStep(saved.curStep as StepId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const flowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'loading' | 'done'>('idle');
  const [titleCandidates, setTitleCandidates] = useState<string[]>(() => loadSpecState(taskId)?.titleCandidates ?? []);
  const [abstractCandidates, setAbstractCandidates] = useState<string[]>(() => loadSpecState(taskId)?.abstractCandidates ?? []);
  const [analyzing, setAnalyzing] = useState(false);
  const si = (id: StepId) => STEPS.findIndex(s => s.id === id);
  const isConfirmed = (id: StepId) => id in confirmed;
  const isVisible = (id: StepId) => {
    if (id === 'upload') return true;
    if (phase === 'upload' || phase === 'direct') return false;
    return si(id) <= si(curStep);
  };

  const confirm = (id: StepId) => {
    const val = gSel[id] || GUIDE_CANDS[id]?.[0] || '(?뺤젙)';
    setConfirmed(p => ({ ...p, [id]: val }));
    const next = STEPS[si(id) + 1];
    if (next) { setCurStep(next.id); setGuideStep(next.id); }
    else setPhase('done');
    setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
  };
  const reselect = (id: StepId) => {
    const p = { ...confirmed }; delete p[id];
    setConfirmed(p); setCurStep(id); setGuideStep(id);
  };
  const startFlow = () => {
    if (!diTitle.trim() || !diField.trim() || !diContent.trim()) return;
    setAnalyzing(true);
    const input: InventionInput = { title: diTitle, field: diField, content: diContent, problem: diProblem, keywords: diKeywords };
    setTimeout(() => {
      const tCandidates = generateTitleCandidates(input);
      const aCandidates = generateAbstractCandidates(input);
      setTitleCandidates(tCandidates);
      setAbstractCandidates(aCandidates);
      setPhase('flow');
      setCurStep('title');
      setGuideStep('title');
      saveSpecState(taskId, {
        phase: 'flow',
        curStep: 'title',
        titleCandidates: tCandidates,
        abstractCandidates: aCandidates,
        componentItems: generateComponentCandidates(input),
        drawings: generateMockDrawings(input),
      });
      setAnalyzing(false);
      setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    }, 1500);
  };

  const handleFileSelect = (file: File) => {
    const baseName = file.name.replace(/\.[^.]+$/, '');
    setDiTitle(baseName);
    saveSpecState(taskId, { uploadedFileName: file.name, diTitle: baseName });
    setUploadProgress('loading');
    setTimeout(() => {
      const input: InventionInput = { title: baseName, field: '기술', content: `${file.name} 파일에서 추출된 내용입니다.` };
      setPhase('flow');
      setCurStep('title');
      setGuideStep('title');
      const tCandidates = generateTitleCandidates(input);
      const aCandidates = generateAbstractCandidates(input);
      setTitleCandidates(tCandidates);
      setAbstractCandidates(aCandidates);
      saveSpecState(taskId, {
        phase: 'flow',
        curStep: 'title',
        titleCandidates: tCandidates,
        abstractCandidates: aCandidates,
        componentItems: generateComponentCandidates(input),
        drawings: generateMockDrawings(input),
        uploadedFileName: file.name,
      });
      setUploadProgress('done');
      setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    }, 1500);
  };
  const doneCount = Object.keys(confirmed).length;

  // ── U6: 에디터 진입 로딩 ──────────────────────────────────────────────
  const [generatingSpec, setGeneratingSpec] = useState(false);

  const openEditor = () => {
    setGeneratingSpec(true);
    setTimeout(() => {
      setGeneratingSpec(false);
      handleSetMainView('editor');
    }, 800);
  };

  // ── makeAnalysisResult: analysisResult 빌드 ──────────────────────────
  const makeAnalysisResult = (): SpecAnalysisResult => {
    const saved = loadSpecState(taskId);
    const comps = (saved?.componentItems ?? []).filter(c => c.sel);
    const doneDrawings = (saved?.drawings ?? []).filter(d => d.applied || d.stage === 'done');
    const drawDesc = doneDrawings.map((d, i) => `도 ${i + 1}은 ${d.name}.`).join('\n\n');
    const detail = comps.map(c => {
      const name = c.text.split(':')[0];
      const desc = (c.text.split(':')[1] || '').trim();
      const numStr = c.num ? `(${c.num})` : '';
      return `상기 ${name}${numStr}은 ${desc || '관련 기능을 수행한다.'}`;
    }).join('\n\n');

    const extractDescSection = (key: string): string => {
      const raw = gSel['description'] || confirmed['description'] || '';
      const labelMap: Record<string, string> = {
        tech: '기술분야', bg: '배경기술', problem: '해결하려는 과제',
        solution: '과제해결수단', effect: '발명의 효과',
      };
      const label = labelMap[key] || key;
      const match = raw.match(new RegExp(`【${label}】\\n([^【]*)`));
      return match?.[1]?.trim() || saved?.descTexts?.[key as keyof typeof saved.descTexts] || '';
    };

    return {
      title:    gSel['title'] || confirmed['title'] || diTitle,
      tech:     extractDescSection('tech'),
      bg:       extractDescSection('bg'),
      problem:  extractDescSection('problem'),
      solution: extractDescSection('solution'),
      effect:   extractDescSection('effect'),
      drawDesc,
      detail,
      claims:   gSel['claims'] || confirmed['claims'] || '',
      abstract: gSel['abstract'] || confirmed['abstract'] || '',
      drawings: (saved?.drawings ?? []) as any,
      componentItems: comps as any,
    };
  };

  if (generatingSpec) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
        <p className="text-sm2 text-zinc-500 font-medium">명세서 에디터 준비 중...</p>
      </div>
    );
  }

  if (mainView === 'editor') {
    return (
      <>
        <SpecEditorView
          task={task}
          onBack={() => handleSetMainView('analysis')}
          confirmedTitle={gSel['title'] || confirmed['title']}
          analysisResult={makeAnalysisResult()}
        />
        {previewOpen && <PreviewModal taskName={task?.name} onClose={() => setPreviewOpen(false)} />}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 text-md2 font-semibold text-gray-700">
          <Icon name="doc" size={14} className="text-blue-700" />
          <span>{task?.name || '??紐낆꽭??}</span>
          <span className="text-xs2 text-gray-400 font-normal ml-1">쨌 ?먮룞 ??λ맖 (諛⑷툑)</span>
        </div>
        <div className="flex items-center gap-2">
          {(diTitle || phase === 'flow' || phase === 'done') && (
            <button onClick={() => setSourceDataOpen(o => !o)}
              className={clsx('btn-outline btn-xs', sourceDataOpen && 'bg-zinc-100 border-zinc-400 text-zinc-700')}>
              <Icon name="doc" size={11} /> 湲곗큹?먮즺
            </button>
          )}
          <button onClick={() => setGuideOpen(o => !o)}
            className={clsx('btn-outline btn-xs', guideOpen && 'bg-violet-50 border-violet-400 text-violet-700')}>
            <Icon name="star" size={11} /> AI 媛?대뱶
          </button>
          <button className="btn-outline btn-xs" onClick={() => setPreviewOpen(true)}><Icon name="search" size={11} /> 誘몃━蹂닿린</button>
          <button className="btn-primary btn-sm"><Icon name="doc" size={11} /> ???/button>
        </div>
      </div>

      {/* Stepper ???먮낯 stepper-bar / step-pill / step-connector 援ъ“ */}
      <div className="flex items-center px-4 border-b border-ck-border overflow-x-auto scroll-thin shrink-0" style={{ height: 48 }}>
        {STEPS.map((s, i) => {
          const isDone = isConfirmed(s.id);
          const active = s.id === curStep && (phase === 'flow' || phase === 'done');
          const locked = phase !== 'flow' && phase !== 'done' && s.id !== 'upload';
          const prevDone = i > 0 && isConfirmed(STEPS[i - 1].id);
          return (
            <div key={s.id} className="flex items-center shrink-0">
              {/* step-connector: ?댁쟾 ?④퀎 ?꾨즺硫?green, ?꾨땲硫?gray */}
              {i > 0 && (
                <div className={clsx('h-0.5 shrink-0 mx-1', prevDone ? 'bg-green-500' : 'bg-gray-200')}
                  style={{ width: 20 }} />
              )}
              {/* step-pill */}
              <button
                disabled={locked}
                onClick={() => { if (!locked && (phase === 'flow' || phase === 'done')) { setCurStep(s.id); if (s.id !== 'upload') setGuideStep(s.id); } }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors',
                  active && 'border-blue-200 bg-blue-50',
                  !active && 'border-transparent',
                  locked && 'cursor-default opacity-60',
                )}>
                {/* step-dot */}
                <span className={clsx(
                  'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 border-2',
                  active && 'border-blue-600 bg-blue-600 text-white',
                  isDone && !active && 'border-green-500 bg-green-500 text-white',
                  locked && 'border-gray-300 bg-white text-gray-400',
                  !active && !isDone && !locked && 'border-gray-400 bg-white text-gray-500',
                )}>
                  {isDone && !active ? <Icon name="check" size={10} /> : s.num}
                </span>
                {/* step-label */}
                <span className={clsx(
                  'text-sm2',
                  active && 'text-blue-700 font-semibold',
                  isDone && !active && 'text-green-700 font-medium',
                  locked && 'text-gray-400',
                  !active && !isDone && !locked && 'text-gray-500',
                )}>{isDone && !active ? `✓ ${s.short}` : s.short}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 湲곗큹?먮즺 蹂닿린 ?щ씪?대뱶 ?⑤꼸 */}
      {sourceDataOpen && (
        <div className="absolute inset-y-0 right-0 z-30 w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col" style={{ top: 0 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-sm2 font-semibold text-gray-800">湲곗큹?먮즺</span>
            <button onClick={() => setSourceDataOpen(false)} className="text-gray-400 hover:text-gray-600">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 text-xs2">
            {diTitle ? (
              <>
                <div><p className="font-semibold text-gray-500 mb-1">諛쒕챸??紐낆묶 (媛??</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5">{diTitle}</p></div>
                {diField && <div><p className="font-semibold text-gray-500 mb-1">湲곗닠 遺꾩빞</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5">{diField}</p></div>}
                {diContent && <div><p className="font-semibold text-gray-500 mb-1">諛쒕챸???듭떖 ?댁슜</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">{diContent}</p></div>}
                {diProblem && <div><p className="font-semibold text-gray-500 mb-1">?닿껐?섎젮??怨쇱젣</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">{diProblem}</p></div>}
                {diKeywords && <div><p className="font-semibold text-gray-500 mb-1">李멸퀬 ?ㅼ썙??/ ?좏뻾湲곗닠</p><p className="text-gray-800 bg-gray-50 rounded px-2 py-1.5">{diKeywords}</p></div>}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Icon name="doc" size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm2">吏곸젒 ?낅젰??湲곗큹?먮즺媛 ?놁뒿?덈떎.</p>
                <p className="text-xs2 mt-1">?뚯씪 ?낅줈???먮뒗 吏곸젒 ?낅젰?쇰줈<br/>湲곗큹?먮즺瑜?異붽??댁＜?몄슂.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div ref={flowRef} className="flex-1 overflow-y-auto scroll-thin bg-ck-bg">
          <div className="max-w-3xl mx-auto py-8 px-4 space-y-3">

            {/* ?낅줈??議????먮낯 ?숈씪: flow/done ?댄썑?먮룄 怨꾩냽 ?쒖떆 (?ㅽ겕濡?諛⑹떇) */}
            {phase !== 'flow' && phase !== 'done' && (
              <div className="text-center py-4">
                <Icon name="doc" size={48} className="text-blue-700 mx-auto mb-3" />
                <h2 className="text-lg2 font-bold text-gray-800 mb-2">???뱁뿀 紐낆꽭???묒꽦</h2>
                <p className="text-md2 text-gray-500 mb-6">?꾨옒 ??媛吏 諛⑸쾿 以??섎굹濡?湲곗큹?먮즺瑜??쒓났?섏꽭??</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.hwp,.doc,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                />
                <div onClick={phase === 'upload' ? () => fileInputRef.current?.click() : undefined}
                  className={`border-2 border-dashed rounded-xl p-10 mb-5 transition-all ${phase === 'upload' ? 'border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30' : 'border-gray-200 opacity-50'}`}>
                  {uploadProgress === 'loading' ? (
                    <div className="text-center">
                      <span className="inline-block animate-spin text-3xl mb-3">&#8635;</span>
                      <p className="text-md2 text-blue-600 font-semibold">직무발명서 분석 중...</p>
                    </div>
                  ) : (
                    <>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-gray-400">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <p className="text-md2 text-gray-600">?뚯씪???쒕옒洹명븯嫄곕굹 ?대┃?섏뿬 ?낅줈??</p>
                      <p className="text-sm2 text-gray-400 mt-1">PDF, DOCX, HWP, ?대?吏 ?뚯씪 吏??</p>
                    </>
                  )}
                </div>
                {phase === 'upload' && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-sm2 text-gray-400 font-medium px-2">?먮뒗</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <button onClick={() => setPhase('direct')}
                      className="btn-outline flex items-center gap-2 mx-auto">
                      <Icon name="edit" size={14} /> 湲곗큹 ?댁슜 吏곸젒 ?낅젰?섍린
                    </button>
                    <p className="text-xs2 text-gray-400 mt-2">?뚯씪 ?놁씠 諛쒕챸 ?댁슜???띿뒪?몃줈 吏곸젒 ?낅젰?????덉뒿?덈떎.</p>
                  </>
                )}
              </div>
            )}

            {/* 吏곸젒?낅젰 ?????먮낯: AI 遺꾩꽍 ?쒖옉 ?꾩뿉??怨꾩냽 ?쒖떆 (?꾨뱶 ?좉툑) */}
            {/* 직접입력 폼 — direct 단계에서만 전체 표시 */}
            {phase === 'direct' && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50">
                  <Icon name="edit" size={20} className="text-blue-700" />
                  <div>
                    <h3 className="text-base2 font-semibold text-gray-800">諛쒕챸 湲곗큹 ?댁슜 ?낅젰</h3>
                    <p className="text-sm2 text-gray-500">?꾨옒 ??ぉ???낅젰?섎㈃ AI媛 紐낆꽭????ぉ??遺꾩꽍?⑸땲?? <span className="text-red-500">*</span> ?쒖떆???꾩닔 ??ぉ?낅땲??</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { label: '諛쒕챸??紐낆묶 (媛??', ph: '?? ?멸났吏??湲곕컲 ?뱁뿀 紐낆꽭???먮룞 ?앹꽦 ?쒖뒪??, val: diTitle, set: setDiTitle, req: true },
                    { label: '湲곗닠 遺꾩빞', ph: '?? ?멸났吏?? ?먯뿰??泥섎━, ?뱁뿀 ?먮룞??, val: diField, set: setDiField, req: true },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-sm2 font-semibold text-gray-700 mb-1">{f.label}{f.req && <span className="text-red-500 ml-0.5">*</span>}</label>
                      <input className="input py-2" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm2 font-semibold text-gray-700 mb-1">諛쒕챸???듭떖 ?댁슜<span className="text-red-500 ml-0.5">*</span></label>
                    <textarea className="input py-2" rows={4} placeholder="諛쒕챸???듭떖 湲곗닠怨?援ъ꽦, ?묐룞 ?먮━ ?깆쓣 ?먯쑀濡?쾶 湲곗닠?섏꽭??.." value={diContent} onChange={e => setDiContent(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm2 font-semibold text-gray-700 mb-1">?닿껐?섎젮??怨쇱젣</label>
                    <textarea className="input py-2" rows={2} placeholder="湲곗〈 湲곗닠??臾몄젣???먮뒗 蹂?諛쒕챸???닿껐?섎젮??怨쇱젣瑜??낅젰?섏꽭??.." value={diProblem} onChange={e => setDiProblem(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm2 font-semibold text-gray-700 mb-1">李멸퀬 ?ㅼ썙??/ ?좏뻾湲곗닠</label>
                    <input className="input py-2" placeholder="?? ?몃옖?ㅽ룷癒? GPT, KR10-2023-0012345" value={diKeywords} onChange={e => setDiKeywords(e.target.value)} />
                  </div>
                </div>
                {/* flow/done ?곹깭?먯꽌??踰꾪듉 ?④? (?쇱? ?쎄린?꾩슜?쇰줈 怨꾩냽 ?쒖떆) */}
                {phase === 'direct' && (
                  <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <button className="btn-outline btn-sm" onClick={() => {
                      if ((diTitle || diContent) && !window.confirm('?낅젰???댁슜????젣?⑸땲?? 怨꾩냽?좉퉴??')) return;
                      setPhase('upload');
                    }}>痍⑥냼</button>
                    <button className="btn-primary btn-sm" onClick={startFlow} disabled={!diTitle.trim() || !diField.trim() || !diContent.trim() || analyzing}>
                      {analyzing
                        ? <><span className="inline-block animate-spin mr-1">&#8635;</span>AI 분석 중...</>
                        : <><Icon name="star" size={13} /> AI 遺꾩꽍 ?쒖옉</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* flow/done 단계에서 기초자료 접힘 헤더 */}
            {(phase === 'flow' || phase === 'done') && diTitle.trim() && (
              <div className="card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setSourceDataOpen(o => !o)}
                >
                  <Icon name="edit" size={16} className="text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm2 font-semibold text-gray-700">기초자료</p>
                    <p className="text-xs2 text-gray-400 truncate">{diTitle} · {diField}</p>
                  </div>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="12" height="12" className={sourceDataOpen ? 'rotate-180' : ''}>
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                </button>
                {sourceDataOpen && (
                  <div className="p-4 space-y-2 border-t border-gray-100 bg-gray-50/50">
                    {[
                      { label: '발명의 명칭', val: diTitle },
                      { label: '기술 분야', val: diField },
                      diContent && { label: '발명의 핵심 내용', val: diContent },
                      diProblem && { label: '해결하려는 과제', val: diProblem },
                      diKeywords && { label: '키워드', val: diKeywords },
                    ].filter(Boolean).map((f: any) => (
                      <div key={f.label}>
                        <p className="text-xs2 font-semibold text-gray-500 mb-0.5">{f.label}</p>
                        <p className="text-xs2 text-gray-700 bg-white rounded px-2.5 py-2 border border-gray-200 whitespace-pre-wrap">{f.val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(phase === 'flow' || phase === 'done') && (
              <>
                <AiMsg text={AI_NEXT.upload} />
                {STEPS.slice(1).map(s => {
                  if (!isVisible(s.id)) return null;
                  const isDone = isConfirmed(s.id);
                  return (
                    <div key={s.id} className="space-y-3">
                      {/* ?먮낯: AI chat bubble留??쒖떆 ???꾨낫 移대뱶/?좏깮?뺤씤 踰꾪듉? ?곗륫 ?⑤꼸?먮쭔 */}
                      <AiMsg text={
                        <><strong>{STEP_LABEL[s.id]}</strong><br />
                        ?낅줈???댁슜??湲곕컲?쇰줈 {STEP_LABEL[s.id]} ?꾨낫瑜??앹꽦?덉뒿?덈떎.{' '}
                        <span className="text-blue-700 font-semibold">?ㅻⅨ履?遺꾩꽍寃곌낵</span>?먯꽌 ?곹빀????ぉ???좏깮?섍굅??吏곸젒 ?낅젰?섏꽭??</>
                      } />
                      {isDone && (
                        <>
                          <div className="flex items-start gap-3 flex-row-reverse">
                            <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs2 font-bold flex items-center justify-center shrink-0">??/div>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 max-w-2xl shadow-xs">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><Icon name="check" size={10} /></span>
                                <span className="text-sm2 font-semibold text-blue-700">{CONFIRM_LABEL[s.id]}</span>
                              </div>
                              <div className="bg-white rounded-lg border border-blue-100 p-3 mb-2">
                                {/* 諛쒕챸???ㅻ챸: ?뱀뀡蹂?援ъ“???쒖떆 */}
                                {s.id === 'description' ? (
                                  <div className="space-y-2">
                                    {(confirmed[s.id] || '').split('\n\n').filter(Boolean).map((block, bi) => {
                                      const lines = block.split('\n');
                                      const label = lines[0]?.replace(/[?먦?/g, '').trim();
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
                                  // 泥?뎄?? ?낅┰??醫낆냽??援ъ“???쒖떆
                                  <div className="space-y-2">
                                    {(confirmed[s.id] || '').split('\n\n').filter(Boolean).map((block, bi) => {
                                      if (bi === 0) {
                                        return <p key={bi} className="text-xs2 font-bold text-green-700">{block}</p>;
                                      }
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
                                  <p className="text-sm2 text-gray-700 leading-relaxed">{confirmed[s.id]}</p>
                                )}
                              </div>
                              <button onClick={() => reselect(s.id)} className="text-xs2 text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                <Icon name="chevron-left" size={10} /> ?ㅼ떆 ?좏깮
                              </button>
                            </div>
                          </div>
                          <AiMsg text={AI_NEXT[s.id]} />
                        </>
                      )}
                    </div>
                  );
                })}
                {phase === 'done' && (
                  <div className="text-center py-8">
                    <Icon name="logo" size={40} className="text-blue-700 mx-auto mb-3" />
                    <h3 className="text-lg2 font-bold text-gray-800 mb-2">紐⑤뱺 遺꾩꽍???꾨즺?섏뿀?듬땲??/h3>
                    {task?.id && loadSpecState(task?.id ?? '')?.mainView === 'editor' ? (
                      <>
                        <p className="text-md2 text-gray-500 mb-4">?대? ?앹꽦??紐낆꽭???먮뵒?곕줈 ?뚯븘媛????덉뒿?덈떎.</p>
                        <button
                          onClick={() => openEditor?.()}
                          className="btn-primary btn-sm mx-auto flex items-center gap-1.5">
                          <Icon name="doc" size={13} /> 紐낆꽭???먮뵒???닿린 ??
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-md2 text-gray-500 mb-6">
                          확정된 내용을 바탕으로 특허 명세서를 생성합니다.
                        </p>
                        <button
                          onClick={() => openEditor?.()}
                          disabled={generatingSpec}
                          className="btn-primary px-8 py-3 text-base2 font-bold mx-auto flex items-center gap-2 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                        >
                          {generatingSpec
                            ? <><span className="inline-block animate-spin mr-2">↻</span>명세서 생성 중...</>
                            : <><Icon name="doc" size={16} /> 명세서 AI 생성 →</>
                          }
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {guideOpen && (phase === 'flow' || phase === 'done') && (
          <GuidePanel
            step={guideStep}
            gSel={gSel}
            setGSel={setGSel}
            onConfirm={confirm}
            confirmed={confirmed}
            onPrev={() => {
              const idx = STEPS.findIndex(s => s.id === guideStep);
              if (idx > 1) {
                setGuideStep(STEPS[idx - 1].id);
                if (phase === 'done') setPhase('flow');
              }
            }}
            hasPrev={STEPS.findIndex(s => s.id === guideStep) > 1}
            allDone={doneCount >= 5}
            onGenerateSpec={() => openEditor()}
            customCandidates={{
              title:    titleCandidates.length > 0 ? titleCandidates : undefined,
              abstract: abstractCandidates.length > 0 ? abstractCandidates : undefined,
            }}
            taskId={taskId}
            diTitle={diTitle}
            diField={diField}
            diContent={diContent}
            diProblem={diProblem}
          />
        )}
      </div>
      {previewOpen && <PreviewModal taskName={task?.name} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function AiMsg({ text }: { text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs2 font-bold flex items-center justify-center shrink-0">AI</div>
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-md2 text-gray-700 shadow-xs max-w-2xl">
        {text}<span className="text-xs2 text-gray-400 ml-2">諛⑷툑</span>
      </div>
    </div>
  );
}

function GuidePanel({ step, gSel, setGSel, onConfirm, confirmed, onPrev, hasPrev, allDone, onGenerateSpec, customCandidates, taskId, diTitle, diField, diContent, diProblem }: {
  step: StepId;
  gSel: Partial<Record<StepId, string>>;
  setGSel: React.Dispatch<React.SetStateAction<Partial<Record<StepId, string>>>>;
  onConfirm: (id: StepId) => void;
  confirmed: Partial<Record<StepId, string>>;
  onPrev: () => void;
  hasPrev: boolean;
  allDone?: boolean;
  onGenerateSpec?: () => void;
  customCandidates?: Partial<Record<StepId, string[]>>;
  taskId?: string;
  diTitle?: string;
  diField?: string;
  diContent?: string;
  diProblem?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDone = step in confirmed;
  const isSpecial = step === 'description' || step === 'components' || step === 'drawings' || step === 'claims' || step === 'abstract';
  const cands = customCandidates?.[step] ?? GUIDE_CANDS[step] ?? [];
  const curSel = gSel[step] || cands[0] || '';
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<Record<number, string>>({});
  // description ?⑤꼸 ?대? 紐⑤뱶 異붿쟻 (view/edit/prompt/diff)
  const [descMode, setDescMode] = useState<string>('view');
  // description ?⑤꼸??prompt ?ъ엯???붿껌 肄쒕갚
  const [descPromptTrigger] = useState(0);
  // description ?⑤꼸???꾩옱 ?뱀뀡 ?곹깭 (GuidePanel ?섎떒 踰꾪듉 ?쒖뼱??
  const [descSubInfo, setDescSubInfo] = useState<{
    subStep: number; currentLabel: string; allDone: boolean; doConfirm: (() => void) | null;
  }>({ subStep: 0, currentLabel: '湲곗닠遺꾩빞', allDone: false, doConfirm: null });

  // 援ъ꽦?붿냼 ???꾨㈃ 遺??怨듭쑀 (ComponentsPanel ??DrawingsPanel)
  const [confirmedComponents, setConfirmedComponents] = useState<InventionComponent[]>([
    { number: '100', name: '?곗씠???섏쭛遺' },
    { number: '200', name: '?꾩쿂由щ?' },
    { number: '300', name: '?뱀쭠 異붿텧遺' },
    { number: '400', name: '?몄떇遺' },
    { number: '500', name: '異쒕젰遺' },
  ]);

  const getCardVal = (i: number) => editVals[i] ?? cands[i] ?? '';

  const STEP_DESCS: Partial<Record<StepId, string>> = {
    title: '?낅줈?쒗븳 臾몄꽌瑜?遺꾩꽍?섏뿬 3媛쒖쓽 紐낆묶 ?꾨낫瑜??앹꽦?덉뒿?덈떎. ?좏깮?섍굅??吏곸젒 ?섏젙?섏꽭??',
    description: '湲곗닠遺꾩빞?믩같寃쎄린?졻넂?닿껐怨쇱젣?믨낵?쒗빐寃곗닔???쒖꽌濡?媛???ぉ???뺤씤?섍퀬 ?뺤젙?섏꽭??',
    abstract: '?붿빟?쒕? ?먮룞 ?앹꽦?덉뒿?덈떎. ?댁슜???뺤씤?섍퀬 ?섏젙?섏꽭??',
  };

  // 由ъ궗?댁쫰 ?몃뱾 ???먮낯 artifact-resize-handle ?숈씪
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

  const handleConfirm = () => {
    // ?뱀닔 ?④퀎: gSel???대? onUpdate濡??명똿???ㅼ젣 ?댁슜???덉쑝硫?洹멸쾬???ъ슜
    if (isSpecial) {
      // gSel[step]???덉쑝硫?洹?媛믪쓣 ?ъ슜, ?놁쑝硫??④퀎蹂?湲곕낯 ?붿빟 臾몄옄???ъ슜
      const fallbacks: Partial<Record<StepId, string>> = {
        components: '援ъ꽦?붿냼 ?뺤젙',
        drawings: '?꾨㈃ ?뺤젙',
        claims: '泥?뎄???뺤젙',
        abstract: '?붿빟???뺤젙',
      };
      const specialVal = gSel[step] || fallbacks[step] || '?뺤젙';
      setGSel(p => ({ ...p, [step]: specialVal }));
      onConfirm(step);
      return;
    }
    const val = editingIdx !== null ? (editVals[editingIdx] || cands[editingIdx] || '') : curSel;
    if (val.trim()) {
      setGSel(p => ({ ...p, [step]: val }));
      onConfirm(step);
    }
  };

  return (
    <aside ref={panelRef} className="border-l border-ck-border bg-white flex flex-col overflow-hidden shrink-0"
      style={{ width: '380px', minWidth: '320px', maxWidth: '700px', position: 'relative' }}>

      {/* 由ъ궗?댁쫰 ?몃뱾 ???먮낯 artifact-resize-handle */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 z-10 transition-colors"
        style={{ background: 'transparent' }}
        title="?⑤꼸 ?덈퉬 議곗젙"
      />

      {/* ?ㅻ뜑 */}
      <div className="px-4 py-3 border-b border-ck-border bg-gray-50 shrink-0 ml-1.5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs2 font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)' }}>AI</div>
          <span className="text-base2 font-bold text-gray-800">
            {step === 'description' && descSubInfo?.currentLabel
              ? descSubInfo.currentLabel
              : STEP_LABEL[step] || step}
          </span>
          {isDone && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <Icon name="check" size={10} /> ?뺤젙??
            </span>
          )}
        </div>
        <p className="text-sm2 text-gray-500 leading-snug">
          {STEP_DESCS[step] || `${STEP_LABEL[step]} ?꾨낫瑜??앹꽦?덉뒿?덈떎. ?좏깮?섍굅??吏곸젒 ?섏젙?섏꽭??`}
        </p>
      </div>

      {/* ?④퀎蹂??뱀닔 ?⑤꼸 */}
      {step === 'description' && (() => {
        const saved = taskId ? loadSpecState(taskId) : null;
        const inputObj = { title: diTitle || 'X', field: diField || 'Y', content: diContent || '', problem: diProblem || '' };
        const initTexts: Record<string, string> = {
          tech:     saved?.descTexts?.tech     ?? (diTitle ? generateDescriptionSection('tech', inputObj)     : ''),
          bg:       saved?.descTexts?.bg       ?? (diTitle ? generateDescriptionSection('bg', inputObj)       : ''),
          problem:  saved?.descTexts?.problem  ?? (diTitle ? generateDescriptionSection('problem', inputObj)  : ''),
          solution: saved?.descTexts?.solution ?? (diTitle ? generateDescriptionSection('solution', inputObj) : ''),
          effect:   saved?.descTexts?.effect   ?? (diTitle ? generateDescriptionSection('effect', inputObj)   : ''),
        };
        return (
          <DescriptionPanel
            done={isDone}
            onConfirm={handleConfirm}
            onUpdate={v => setGSel(p => ({ ...p, [step]: v }))}
            onModeChange={setDescMode}
            promptTrigger={descPromptTrigger}
            onSubInfoChange={setDescSubInfo}
            initialTexts={initTexts}
            onTextsChange={texts => taskId && saveSpecState(taskId, { descTexts: texts })}
          />
        );
      })()}
      {step === 'components' && (
        <ComponentsPanel
          done={isDone}
          onConfirm={handleConfirm}
          onUpdate={v => setGSel(p => ({ ...p, [step]: v }))}
          onComponentsChange={comps => {
            setConfirmedComponents(comps);
            if (taskId) {
              const specItems = comps.map((c, i) => ({
                id: i + 1, text: c.name, sel: true, num: c.number, depth: 0,
              }));
              saveSpecState(taskId, { componentItems: specItems });
            }
          }}
          initialItems={(() => {
            if (!taskId) return undefined;
            const saved = loadSpecState(taskId);
            if (saved?.componentItems && saved.componentItems.length > 0) {
              return saved.componentItems.map(c => ({
                id: c.id, text: c.text, sel: c.sel, num: c.num, depth: c.depth,
              })) as CompItem[];
            }
            return undefined;
          })()}
        />
      )}
      {step === 'drawings' && (
        <DrawingsPanel
          done={isDone}
          onConfirm={handleConfirm}
          onUpdate={v => setGSel(p => ({ ...p, [step]: v }))}
          inventionComponents={confirmedComponents}
          initialDrawings={(() => {
            if (!taskId) return undefined;
            const saved = loadSpecState(taskId);
            return (saved?.drawings && saved.drawings.length > 0) ? saved.drawings as DrawingItem[] : undefined;
          })()}
          onDrawingsChange={(drws) => taskId && saveSpecState(taskId, { drawings: drws as any })}
        />
      )}
      {step === 'claims' && (
        <ClaimsPanel
          done={isDone}
          onConfirm={handleConfirm}
          onUpdate={v => setGSel(p => ({ ...p, [step]: v }))}
          initialClaimsState={taskId ? loadSpecState(taskId)?.claimsState : undefined}
          onClaimsStateChange={(s) => taskId && saveSpecState(taskId, { claimsState: s })}
        />
      )}
      {step === 'abstract' && <AbstractPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} />}

      {/* ?쇰컲 ?④퀎 A/B/C/D 移대뱶 */}
      {!isSpecial && (
        <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2 ml-1.5">
          {cands.map((c, i) => {
            const letter = letters[i] || String(i + 1);
            const cardVal = getCardVal(i);
            const isSelected = (curSel === c || curSel === cardVal) && !isDone;
            const isConfirmedCard = isDone && (confirmed[step] === c || confirmed[step] === cardVal);
            const isEditing = editingIdx === i;
            return (
              <div
                key={i}
                onClick={() => { if (!isDone && !isEditing) { setGSel(p => ({ ...p, [step]: cardVal })); setEditingIdx(null); } }}
                className={clsx(
                  'rounded-lg border-2 p-3 cursor-pointer transition-all',
                  isSelected && !isEditing && 'border-blue-700 bg-blue-50',
                  isEditing && 'border-blue-500 bg-blue-50',
                  isConfirmedCard && 'border-green-500 bg-green-50',
                  !isSelected && !isConfirmedCard && !isDone && !isEditing && 'border-ck-border bg-ck-bg hover:border-blue-300',
                  isDone && !isConfirmedCard && 'border-gray-200 bg-white opacity-60',
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx(
                    'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0',
                    isSelected || isConfirmedCard || isEditing ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-600',
                  )}>{letter}</span>
                  {/* AI諛곗? ?쒓굅 ?붿껌?쇰줈 誘명몴??*/}
                  <div className="ml-auto flex gap-1">
                    {!isDone && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); }}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                          title="???꾨낫 ?ъ깮??
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                            <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                            <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                          </svg>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingIdx(isEditing ? null : i); setGSel(p => ({ ...p, [step]: cardVal })); }}
                          className={clsx('w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700',
                            isEditing ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200')}
                          title="吏곸젒 ?섏젙"
                        >
                          <Icon name="edit" size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* 移대뱶 ?띿뒪?????몄쭛 紐⑤뱶 ??contenteditable textarea */}
                {isEditing ? (
                  <textarea
                    autoFocus
                    className="w-full text-sm2 font-semibold text-gray-800 bg-white border border-blue-300 rounded px-2 py-1 outline-none resize-none"
                    value={editVals[i] ?? c}
                    rows={2}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      setEditVals(prev => ({ ...prev, [i]: e.target.value }));
                      setGSel(p => ({ ...p, [step]: e.target.value }));
                    }}
                  />
                ) : (
                  <p className="text-sm2 font-semibold text-gray-800 leading-snug">{cardVal}</p>
                )}
              </div>
            );
          })}

          {/* 吏곸젒 ?낅젰 移대뱶 (D) */}
          {!isDone && (
            <div
              className={clsx(
                'rounded-lg border-2 p-3 cursor-pointer transition-all',
                !cands.includes(curSel) && curSel.trim() && 'border-blue-700 bg-blue-50',
                (cands.includes(curSel) || !curSel.trim()) && 'border-ck-border bg-ck-bg hover:border-blue-300',
              )}
              onClick={() => { setEditingIdx(null); setGSel(p => ({ ...p, [step]: '' })); }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 bg-gray-200 text-gray-600">
                  {letters[cands.length] || 'D'}
                </span>
                <span className="text-xs2 text-gray-500 font-semibold">吏곸젒 ?낅젰</span>
                <div className="ml-auto">
                  <button onClick={e => e.stopPropagation()} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700" title="吏곸젒 ?섏젙">
                    <Icon name="edit" size={11} />
                  </button>
                </div>
              </div>
              <textarea
                className="w-full text-sm2 font-semibold bg-transparent outline-none resize-none"
                style={{ color: !cands.includes(curSel) && curSel ? '#1f2937' : '#9ca3af', fontStyle: !cands.includes(curSel) && curSel ? 'normal' : 'italic' }}
                placeholder={`${STEP_LABEL[step]}??吏곸젒 ?낅젰?섏꽭??}
                value={cands.includes(curSel) ? '' : curSel}
                onChange={e => setGSel(p => ({ ...p, [step]: e.target.value }))}
                onClick={e => e.stopPropagation()}
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {/* ?섎떒 踰꾪듉 諛?*/}
      <div className="flex gap-2 px-3 py-2.5 border-t border-ck-border bg-ck-bg shrink-0 ml-1.5">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-3 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          ???댁쟾
        </button>
        {/* 5?④퀎 ?꾨㈃: ?꾨㈃ ?놁씠 吏꾪뻾 踰꾪듉 */}
        {step === 'drawings' && !isDone && (
          <button onClick={handleConfirm}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50 whitespace-nowrap"
            title="?꾨㈃ ?놁씠 ?ㅼ쓬 ?④퀎濡?吏꾪뻾">
            嫄대꼫?곌린
          </button>
        )}

        {/* description diff 紐⑤뱶?먯꽌 ?뺤씤 踰꾪듉 ?④? */}
        {!(step === 'description' && descMode === 'diff') && (
          !isDone ? (
            step === 'description' ? (
              descSubInfo.allDone ? (
                <button onClick={handleConfirm}
                  className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800">
                  ?ㅼ쓬 ??
                </button>
              ) : (
                <button
                  onClick={() => descSubInfo.doConfirm?.()}
                  disabled={descMode === 'prompt' || descMode === 'diff'}
                  className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ?ㅼ쓬 ??
                </button>
              )
            ) : (
              <button
                onClick={handleConfirm}
                disabled={!isSpecial && !curSel.trim()}
                className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ?ㅼ쓬 ??
              </button>
            )
          ) : (
            allDone && onGenerateSpec ? (
              <button onClick={onGenerateSpec}
                className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs2 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1">
                <Icon name="star" size={10} /> 紐낆꽭??AI ?앹꽦
              </button>
            ) : step === 'description' && !descSubInfo.allDone ? (
              // description ?щ갑臾? ?쒕툕?ㅽ뀦???꾨즺 ???먯쑝硫??쒕툕?ㅽ뀦 ?뚮줈?곕줈
              <button
                onClick={() => descSubInfo.doConfirm?.()}
                disabled={descMode === 'prompt' || descMode === 'diff'}
                className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ?ㅼ쓬 ??
              </button>
            ) : (
              // ?대? ?뺤젙???④퀎 ?щ갑臾??????ㅼ쓬 ?④퀎濡??대룞
              <button onClick={handleConfirm}
                className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800">
                ?ㅼ쓬 ??
              </button>
            )
          )
        )}
      </div>
    </aside>
  );
}

// 援ъ꽦?붿냼 ?⑤꼸 (#20)
interface CompItem { id: number; text: string; sel: boolean; num: string; depth: number }
const INIT_COMPS: CompItem[] = [
  { id: 1, text: '?곗씠???섏쭛遺: ?쇱씠???쇱꽌濡쒕???3D ?ъ씤???대씪?곕뱶 ?곗씠?곕? ?섏쭛', sel: true, num: '', depth: 0 },
  { id: 2, text: '?꾩쿂由щ?: ?몄씠利??쒓굅 諛??ㅼ슫?섑뵆留곸쓣 ?듯빐 ?곗씠???꾩쿂由??섑뻾', sel: true, num: '', depth: 0 },
  { id: 3, text: '?뱀쭠 異붿텧遺: PointNet++ ?꾪궎?띿쿂瑜??곸슜?섏뿬 ?ъ씤???뱀쭠 異붿텧', sel: true, num: '', depth: 0 },
  { id: 4, text: '?몄떇遺: ?λ윭??紐⑤뜽???댁슜?섏뿬 媛앹껜 遺꾨쪟 諛??꾩튂 異붿젙', sel: true, num: '', depth: 0 },
  { id: 5, text: '異쒕젰遺: ?몄떇??媛앹껜??3D ?꾩튂, ?ш린, 醫낅쪟瑜?異쒕젰', sel: true, num: '', depth: 0 },
];

function extractCompName(text: string): string {
  const colonIdx = text.indexOf(':');
  return colonIdx > 0 ? text.slice(0, colonIdx).trim() : text.trim();
}

// depth+?쒖꽌 湲곕컲 遺???먮룞 怨꾩궛
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
  initialItems?: CompItem[];
}) {
  const [items, setItems] = useState<CompItem[]>(
    () => (initialItems && initialItems.length > 0) ? initialItems : INIT_COMPS
  );
  const [newText, setNewText] = useState('');

  useEffect(() => {
    const initSource = (initialItems && initialItems.length > 0) ? initialItems : INIT_COMPS;
    const selected = initSource.filter(it => it.sel);
    onUpdate(selected.map(it => `${it.num || '??'} ${it.text}`).join('\n'));
    onComponentsChange?.(selected.map(it => ({ number: it.num || '', name: extractCompName(it.text) })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upd = (next: CompItem[]) => {
    setItems(next);
    const selected = next.filter(it => it.sel);
    onUpdate(selected.map(it => `${it.num || '??} ${it.text}`).join('\n'));
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
      if (!window.confirm(`"${item?.text ? item.text.slice(0, 30) : '??援ъ꽦?붿냼'}"瑜???젣?섏떆寃좎뒿?덇퉴?`)) return;
      upd(items.filter(it => it.id !== id));
    }
  };
  const autoAssign = () => { if (!done) upd(calcAutoNums(items)); };
  const add = () => {
    if (!newText.trim()||done) return;
    upd([...items, { id: Date.now(), text: newText.trim(), sel: true, num: '', depth: 0 }]);
    setNewText('');
  };

  // ???쒖꽦 議곌굔: idx>0?닿퀬 諛붾줈 ????ぉ???좏슚??遺紐?depth <= ?꾩옱 depth)
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
        {/* ?ㅻ뜑 + 遺???먮룞 遺??*/}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs2 font-semibold text-gray-600">AI 異붿텧 援ъ꽦?붿냼</span>
          {!done && (
            <button onClick={autoAssign}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs2 font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="10" height="10">
                <path d="M2 6h8M8 4l2 2-2 2"/>
              </svg>
              遺???먮룞 遺??
            </button>
          )}
        </div>
        {!done && (
          <p className="text-xs2 text-gray-400 mb-2">
            ?쒖꽌 議곗젙 ??<strong className="text-blue-600">遺???먮룞 遺??/strong>瑜??대┃?섎㈃ 100, 200... 踰덊샇媛 ?좊떦?⑸땲??
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
                {/* ?쒕옒洹??몃뱾 */}
                <span className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0 select-none text-xs leading-none px-0.5">??/span>

                {/* 遺??諛곗? */}
                <span className={clsx(
                  'w-8 text-xs2 font-bold rounded px-1 py-0.5 shrink-0 text-center',
                  item.num ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                )}>
                  {item.num || '??}
                </span>

                {/* ?띿뒪??*/}
                {!done ? (
                  <input
                    className="text-xs2 text-gray-700 flex-1 bg-transparent outline-none min-w-0 py-0.5"
                    value={item.text}
                    placeholder="援ъ꽦?붿냼 ?대쫫..."
                    onChange={e => upd(items.map(it => it.id===item.id ? {...it, text: e.target.value} : it))}
                  />
                ) : (
                  <span className="text-xs2 text-gray-700 flex-1 min-w-0 truncate">{item.text}</span>
                )}

                {/* ?≪뀡 踰꾪듉 ??hover ???쒖떆 */}
                {!done && (
                  <div className="flex items-center gap-px shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveUp(idx)} disabled={idx===0}
                      className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="?꾨줈">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 7l3-4 3 4"/></svg>
                    </button>
                    <button onClick={() => moveDown(idx)} disabled={idx===items.length-1}
                      className="p-0.5 text-gray-400 hover:text-blue-500 disabled:opacity-20" title="?꾨옒濡?>
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 3l3 4 3-4"/></svg>
                    </button>
                    <span className="w-px h-3 bg-gray-200 mx-0.5" />
                    <button onClick={() => indent(item.id)} disabled={!canIndent(idx, item)}
                      className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="?섏쐞濡?(??">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 5h6M6 3l2 2-2 2"/></svg>
                    </button>
                    <button onClick={() => outdent(item.id)} disabled={item.depth<=0}
                      className="p-0.5 text-gray-400 hover:text-violet-500 disabled:opacity-20" title="?곸쐞濡?(??">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M8 5H2M4 3L2 5l2 2"/></svg>
                    </button>
                    <span className="w-px h-3 bg-gray-200 mx-0.5" />
                    <button onClick={() => remove(item.id)}
                      className="p-0.5 text-gray-400 hover:text-red-500" title="??젣">
                      <Icon name="close" size={9} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ?섎떒 ?쒕∼ 議???留덉?留??꾩튂濡??쒕옒洹??덉슜 */}
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

        {/* ??援ъ꽦?붿냼 異붽? */}
        {!done && (
          <div className="flex gap-1 mt-3">
            <input className="input text-xs2 py-1.5 flex-1" placeholder="??援ъ꽦?붿냼 異붽?..." value={newText}
              onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key==='Enter' && add()} />
            <button onClick={add} className="btn-outline btn-xs px-2"><Icon name="plus" size={12} /></button>
          </div>
        )}
      </div>
      {done && (
        <div className="p-3 border-t border-gray-100 bg-green-50 shrink-0">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium"><Icon name="check" size={13} /> 援ъ꽦?붿냼 ?뺤젙 ?꾨즺</div>
        </div>
      )}
    </>
  );
}

// ?꾨㈃ ?⑤꼸 (#21)

// DrawingsPanel ???몃꽕??湲고샇/?쇰꺼/?꾨㈃紐??쒖떆, ?⑥씪 ?몄쭛 踰꾪듉
function DrawingsPanel({ done, onUpdate, inventionComponents, initialDrawings, onDrawingsChange }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  inventionComponents?: InventionComponent[];
  initialDrawings?: DrawingItem[];
  onDrawingsChange?: (drawings: DrawingItem[]) => void;
}) {
  const [drawings, setDrawings] = useState<DrawingItem[]>(() =>
    (initialDrawings && initialDrawings.length > 0)
      ? initialDrawings.map(d => ({ ...d }))
      : MOCK_DRAWINGS.map(d => ({ ...d }))
  );
  // 紐⑤컮???꾩슜 紐⑤떖 ?곹깭
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStartId, setModalStartId] = useState('');

  const handleSave = (drawingId: string, updates: Partial<DrawingItem>) => {
    setDrawings(prev => {
      const next = prev.map(d => d.id === drawingId ? { ...d, ...updates } : d);
      onUpdate(next.filter(d => d.stage === 'done').map(d => `湲고샇${d.symbol} ${d.name}: ${d.description}`).join('\n\n'));
      onDrawingsChange?.(next);
      return next;
    });
  };

  // ?몄쭛湲???寃곌낵 ?섏떊 (?곗뒪?ы깙 ?????몄쭛 ??諛섏쁺)
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
      // 紐⑤컮?? 紐⑤떖濡?
      setModalStartId(id);
      setModalOpen(true);
    } else {
      // ?곗뒪?ы깙: ????쑝濡??꾩껜 ?뚰겕?뚮줈 ?ㅽ뵂
      const draw = drawings.find(d => d.id === id);
      openEditorTab({
        drawingId: id,
        drawings,
        components: inventionComponents ?? [],
        // 援ъ꽦?붿냼 紐⑸줉???꾨㈃ 遺??珥덇린媛믪쑝濡?蹂?섑븯???꾨떖
        references: (inventionComponents ?? []).map(c => ({ number: c.number, name: c.name })),
        drawingName: draw?.name ?? id,
        timestamp: Date.now(),
      });
    }
  };

  const LABEL_STYLES: Record<string, string> = {
    '?쒖븞湲곗닠': 'bg-blue-100 text-blue-700',
    '醫낅옒湲곗닠': 'bg-gray-100 text-gray-600',
    'AI?앹꽦':   'bg-violet-100 text-violet-700',
  };

  const STAGE_BADGE: Record<string, { label: string; cls: string }> = {
    'extracted':        { label: '영역 확인 필요', cls: 'bg-amber-100 text-amber-700' },
    'bbox-adjusted':    { label: '변환 대기',       cls: 'bg-blue-100 text-blue-700' },
    'converting':       { label: '변환 중',          cls: 'bg-violet-100 text-violet-700' },
    'candidate-select': { label: '후보 선택 필요',   cls: 'bg-orange-100 text-orange-700' },
    'editing':          { label: '편집 중',           cls: 'bg-sky-100 text-sky-700' },
    'done':             { label: '편집 완료',         cls: 'bg-green-100 text-green-700' },
  };

  const STAGE_DOT: Record<string, string> = {
    'extracted': 'bg-gray-300', 'bbox-adjusted': 'bg-amber-400',
    'converting': 'bg-amber-400', 'candidate-select': 'bg-violet-400',
    'editing': 'bg-blue-400', 'done': 'bg-green-500',
  };

  const doneCount = drawings.filter(d => d.stage === 'done').length;

  return (
    <>
      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3 ml-1.5 space-y-1.5">
        {/* ?ㅻ뜑 ???꾩껜 "?몄쭛湲??닿린" 踰꾪듉 ?쒓굅 (媛쒕퀎 移대뱶?먯꽌 ?몄쭛 吏꾩엯) */}
        <p className="text-xs2 font-semibold text-gray-500 mb-2">
          異붿텧???꾨㈃ <span className="font-normal text-gray-400">({drawings.length}媛?쨌 ?꾨즺 {doneCount}媛?</span>
        </p>

        {drawings.map(d => {
          const isEditable = !done;
          const stageDot = STAGE_DOT[d.stage] || 'bg-gray-300';
          const isDone = d.stage === 'done';
          return (
            <div key={d.id}
              className={clsx(
                'rounded-lg border transition-all overflow-hidden',
                isDone ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white',
                done && 'opacity-60',
              )}>
              {/* ?몃꽕??+ 硫뷀? */}
              <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-1.5">
                <div className="w-10 shrink-0 aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                  {d.exportedImageUrl
                    ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                    : <Icon name="image" size={12} className="text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-xs2 font-bold text-gray-700">湲고샇 {d.symbol}</span>
                    <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', LABEL_STYLES[d.label])}>
                      {d.label}
                    </span>
                    {STAGE_BADGE[d.stage] && (
                      <span className={`text-xs2 px-1.5 py-0.5 rounded font-semibold ${STAGE_BADGE[d.stage].cls}`}>
                        {STAGE_BADGE[d.stage].label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs2 text-gray-700 font-semibold truncate">{d.name}</p>
                </div>
                {/* ?꾨즺 ?곹깭 */}
                <div className="shrink-0">
                  {isDone
                    ? <Icon name="check" size={11} className="text-green-500" />
                    : <span className={clsx('w-2 h-2 rounded-full block', stageDot)} />}
                </div>
              </div>

              {/* ?몄쭛 踰꾪듉 ????긽 ?쒖떆, ?대┃ 媛?ν븿??紐낇솗???몄? */}
              {isEditable && (
                <button
                  onClick={() => openEditor(d.id)}
                  className={clsx(
                    'w-full flex items-center justify-center gap-1 py-1 text-xs2 font-semibold transition-colors border-t',
                    isDone
                      ? 'border-green-100 text-green-600 hover:bg-green-50'
                      : 'border-gray-100 text-blue-600 hover:bg-blue-50',
                  )}>
                  <Icon name="edit" size={10} />
                  {isDone ? '?몄쭛 ?댁슜 蹂닿린 ?? : '?꾨㈃ ?몄쭛 ??}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {done && (
        <div className="p-3 border-t border-ck-border bg-green-50 shrink-0 ml-1.5">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium">
            <Icon name="check" size={13} /> ?꾨㈃ ?뺤젙 ?꾨즺 ({doneCount}媛??몄쭛 ?꾨즺)
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

// ?? 泥?뎄???⑤꼸 (#22) ??n媛??낅┰???ㅼ쨷 ?좏깮 + ?낅┰??퀎 醫낆냽??+ AI ?ъ깮????
// Phase 'indep' : ?낅┰???꾨낫 以?n媛?泥댄겕諛뺤뒪 ?좏깮
// Phase 'dep'   : ?좏깮???낅┰??퀎 醫낆냽???뱀뀡 + AI ?ъ깮???몃씪??UI

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
    text: '?쇱씠???쇱꽌濡쒕???3李⑥썝 ?ъ씤???대씪?곕뱶 ?곗씠?곕? ?띾뱷?섎뒗 ?곗씠???섏쭛遺;\n?곴린 ?ъ씤???대씪?곕뱶 ?곗씠?곗뿉??吏硫??ъ씤?몃? 遺꾨━?섍퀬 ?몄씠利덈? ?쒓굅?섎뒗 ?꾩쿂由щ?;\n?λ윭??紐⑤뜽???곸슜?섏뿬 媛앹껜瑜?遺꾨쪟?섎뒗 ?몄떇遺瑜??ы븿?섎ŉ,\n?ㅼ떆媛?3D 媛앹껜 ?몄떇??媛?ν븳 ?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.',
  },
  {
    id: 2, label: 'B',
    text: '?쇱씠???쇱꽌濡쒕????ъ씤???대씪?곕뱶 ?곗씠?곕? ?띾뱷?섎뒗 ?④퀎;\n?곴린 ?ъ씤???대씪?곕뱶 ?곗씠?곕? 湲곕뫁(Pillar) ?⑥쐞濡?援ъ꽦?섏뿬 2D ?섏궗 ?대?吏瑜??앹꽦?섎뒗 ?꾩쿂由??④퀎;\nPointNet++ 湲곕컲 ?λ윭??紐⑤뜽???댁슜?섏뿬 媛앹껜瑜??몄떇?섎뒗 ?몄떇 ?④퀎瑜??ы븿?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? 諛⑸쾿.',
  },
];

interface DepItemState {
  id: number; text: string; sel: boolean; expanded: boolean;
  editing: boolean; editVal: string;
  aiOpen: boolean; aiPromptVal: string;
  aiProposed: string; aiDiffOpen: boolean; aiDiffSel: 'current' | 'proposed';
}

// ?낅┰??퀎 ?붾? 醫낆냽?????ㅼ젣?먯꽌??AI媛 ?낅┰???띿뒪??湲곕컲?쇰줈 ?앹꽦
const MOCK_DEPS_BY_INDEP: Record<number, Pick<DepItemState,'text'|'sel'>[]> = {
  1: [
    { sel: true,  text: '????뿉 ?덉뼱?? ?곴린 ?꾩쿂由щ???RANSAC ?뚭퀬由ъ쬁???댁슜?섏뿬 吏硫??ъ씤?몃? 遺꾨━?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.' },
    { sel: true,  text: '????뿉 ?덉뼱?? ?곴린 ?몄떇遺??PointNet++ 湲곕컲???ㅼ링 ?좉꼍留앹쓣 ?ы븿?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.' },
    { sel: true,  text: '????뿉 ?덉뼱?? ?곴린 ?ㅼ링 ?좉꼍留앹? ?ъ씤???대씪?곕뱶瑜?湲곕뫁(pillar) ?⑥쐞濡?泥섎━?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.' },
    { sel: false, text: '????뿉 ?덉뼱?? ?곴린 ?곗씠???섏쭛遺??蹂듭닔???쇱씠???쇱꽌瑜??ы븿?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.' },
    { sel: true,  text: '????뿉 ?덉뼱?? ?곴린 異쒕젰遺??3D 諛붿슫??諛뺤뒪瑜??댁슜?섏뿬 媛먯???媛앹껜???꾩튂 諛??ш린瑜??쒖떆?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.' },
  ],
  2: [
    { sel: true,  text: '????뿉 ?덉뼱?? ?곴린 ?꾩쿂由??④퀎??RANSAC ?뚭퀬由ъ쬁?쇰줈 吏硫??ъ씤?몃? 遺꾨━?섎뒗 ?④퀎瑜??ы븿?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? 諛⑸쾿.' },
    { sel: true,  text: '????뿉 ?덉뼱?? ?곴린 ?몄떇 ?④퀎???몄떇??媛앹껜??3D 諛붿슫??諛뺤뒪瑜??좊떦?섎뒗 ?④퀎瑜????ы븿?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? 諛⑸쾿.' },
    { sel: false, text: '????뿉 ?덉뼱?? ?곴린 3D 諛붿슫??諛뺤뒪??媛앹껜??諛⑹쐞媛곸쓣 ?ы븿?섎뒗, ?쇱씠??湲곕컲 媛앹껜 媛먯? 諛⑸쾿.' },
  ],
};

interface DepGroupState { generated: boolean; items: DepItemState[]; newText: string }


function ClaimsPanel({ done, onUpdate, initialClaimsState, onClaimsStateChange }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  initialClaimsState?: { phase: 'indep' | 'dep'; indepCands: any[]; depGroups: Record<number, any> };
  onClaimsStateChange?: (s: any) => void;
}) {
  const [claimsPhase, setClaimsPhase] = useState<'indep' | 'dep'>(
    () => initialClaimsState?.phase ?? 'indep'
  );

  // 독립항 후보 상태 (n개 중 선택)
  const [cands, setCands] = useState<IndepCandState[]>(
    () => {
      if (initialClaimsState?.indepCands && initialClaimsState.indepCands.length > 0) {
        return initialClaimsState.indepCands.map((c: any) => ({
          id: c.id, label: c.label, text: c.text, selected: c.selected,
          editing: false, editVal: c.text, aiOpen: false, aiPromptVal: '',
          aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const,
        }));
      }
      return INDEP_CANDS_INIT.map(c => ({
        ...c, selected: c.id === 1, editing: false, editVal: c.text,
        aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const,
      }));
    }
  );

  // 독립항 별 종속항 그룹
  const [depGroups, setDepGroups] = useState<Record<number, DepGroupState>>(() => {
    if (initialClaimsState?.depGroups) {
      const restored: Record<number, DepGroupState> = {};
      for (const [k, v] of Object.entries(initialClaimsState.depGroups)) {
        const vv = v as any;
        restored[Number(k)] = {
          generated: vv.generated ?? false,
          newText: vv.newText ?? '',
          items: (vv.items ?? []).map((d: any, i: number) => ({
            id: d.id ?? i + 1, text: d.text, sel: d.sel ?? true,
            expanded: false, editing: false, editVal: d.text,
            aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const,
          })),
        };
      }
      return restored;
    }
    return {};
  });

  // ?좏깮???낅┰??紐⑸줉
  const selectedCands = cands.filter(c => c.selected);

  // 상태 변경 알림 함수
  const notifyChange = (updCands: IndepCandState[], updGroups: Record<number, DepGroupState>, phase: 'indep' | 'dep') => {
    onClaimsStateChange?.({
      phase,
      indepCands: updCands.map(c => ({ id: c.id, label: c.label, text: c.text, selected: c.selected })),
      depGroups: Object.fromEntries(
        Object.entries(updGroups).map(([k, v]) => [k, {
          generated: (v as any).generated,
          newText: (v as any).newText ?? '',
          items: (v as any).items?.map((d: any) => ({ id: d.id, text: d.text, sel: d.sel })) ?? [],
        }])
      ),
    });
  };


  // 留덉슫????珥덇린 ?붿빟???곸쐞濡??꾨떖 ???뺤젙 移대뱶???ㅼ젣 ?댁슜 ?쒖떆
  useEffect(() => {
    const sel = INDEP_CANDS_INIT.filter((_, i) => i === 0);
    onUpdate(`?낅┰??1媛? 醫낆냽??0媛?n\n泥?뎄??1.\n${sel[0].text}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?꾩껜 ?붿빟???곸쐞濡??꾨떖 (泥?뎄??踰덊샇 ?먮룞 遺??
  const syncUpdate = (updCands: IndepCandState[], updGroups: Record<number, DepGroupState>) => {
    const selCands = updCands.filter(c => c.selected);
    let num = 0;
    const lines: string[] = [];
    selCands.forEach(c => {
      const text = c.editing ? c.editVal : c.text;
      lines.push(`泥?뎄??${++num}.\n${text}`);
      const grp = updGroups[c.id];
      if (grp?.generated) {
        grp.items.filter(d => d.sel).forEach(d => {
          lines.push(`泥?뎄??${++num}.\n${d.text}`);
        });
      }
    });
    const indepCount = selCands.length;
    const depCount = selCands.reduce((acc, c) => {
      const grp = updGroups[c.id];
      return acc + (grp?.items.filter(d => d.sel).length ?? 0);
    }, 0);
    onUpdate(`?낅┰??${indepCount}媛? 醫낆냽??${depCount}媛?n\n${lines.join('\n\n')}`);
  };

  // ?낅┰???좏깮 ?좉?
  const toggleIndep = (id: number) => {
    const next = cands.map(c => c.id === id ? { ...c, selected: !c.selected } : c);
    setCands(next);
    syncUpdate(next, depGroups);
    notifyChange(next, depGroups, claimsPhase);
  };

  // ?낅┰??Phase B濡??대룞
  const confirmIndep = () => {
    if (selectedCands.length === 0) return;
    setClaimsPhase('dep');
    syncUpdate(cands, depGroups);
    notifyChange(cands, depGroups, 'dep');
  };

  // ?낅┰??AI ?ъ깮????prompt ??diff 紐⑤뱶濡??꾪솚 (mock ?앹꽦)
  const regenIndep = (id: number) => {
    const c = cands.find(x => x.id === id);
    if (!c) return;
    const baseText = c.aiDiffOpen && c.aiProposed ? c.aiProposed : (c.editing ? c.editVal : c.text);
    const proposed = `${c.aiPromptVal.trim() ? `[${c.aiPromptVal.trim()} 諛섏쁺] ` : ''}${baseText.split(';')[0]}; ?곴린 援ъ꽦???좉린??寃고빀???듯빐 ?믪? ?뺥솗?꾩? ?ㅼ떆媛?泥섎━瑜??ъ꽦?섎뒗, ${baseText.includes('?μ튂') ? '?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.' : '?쇱씠??湲곕컲 媛앹껜 媛먯? 諛⑸쾿.'}`;
    const next = cands.map(x => x.id === id ? { ...x, aiOpen: false, aiPromptVal: '', aiProposed: proposed, aiDiffOpen: true, aiDiffSel: 'proposed' as const } : x);
    setCands(next);
  };

  // ?낅┰??diff ?좏깮 ?꾨즺
  const applyIndepDiff = (id: number) => {
    const c = cands.find(x => x.id === id);
    if (!c) return;
    const finalText = c.aiDiffSel === 'proposed' ? c.aiProposed : (c.editing ? c.editVal : c.text);
    const next = cands.map(x => x.id === id ? { ...x, text: finalText, editVal: finalText, aiDiffOpen: false, aiProposed: '', aiDiffSel: 'proposed' as const } : x);
    setCands(next);
    syncUpdate(next, depGroups);
  };

  // 醫낆냽??AI ?앹꽦 (mock)
  const generateDeps = (indepId: number) => {
    const mockItems = (MOCK_DEPS_BY_INDEP[indepId] ?? MOCK_DEPS_BY_INDEP[1]).map((d, i) => ({
      id: i + 1, ...d, expanded: false, editing: false, editVal: d.text, aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const,
    }));
    const next: Record<number, DepGroupState> = { ...depGroups, [indepId]: { generated: true, items: mockItems, newText: '' } };
    setDepGroups(next);
    syncUpdate(cands, next);
    notifyChange(cands, next, claimsPhase);
  };

  // 醫낆냽???좉?
  const toggleDep = (indepId: number, depId: number) => {
    if (done) return;
    const grp = depGroups[indepId];
    if (!grp) return;
    const next = { ...depGroups, [indepId]: { ...grp, items: grp.items.map(d => d.id === depId ? { ...d, sel: !d.sel } : d) } };
    setDepGroups(next);
    syncUpdate(cands, next);
    notifyChange(cands, next, claimsPhase);
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
    const suffix = baseText.includes('?μ튂') ? ', ?쇱씠??湲곕컲 媛앹껜 媛먯? ?μ튂.' : ', ?쇱씠??湲곕컲 媛앹껜 媛먯? 諛⑸쾿.';
    const proposed = `${baseText.split('?덉뼱??)[0]}?덉뼱?? ${dep.aiPromptVal.trim() || '?곴린 援ъ꽦????援ъ껜?곸쑝濡??ы븿?섎뒗'}${suffix}`;
    const next = { ...depGroups, [indepId]: { ...grp, items: grp.items.map(d => d.id === depId ? { ...d, aiOpen: false, aiPromptVal: '', aiProposed: proposed, aiDiffOpen: true, aiDiffSel: 'proposed' as const } : d) } };
    setDepGroups(next);
  };

  // 醫낆냽??diff ?좏깮 ?꾨즺
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

  const updateDepGroup = (indepId: number, patch: Partial<DepGroupState>) => {
    setDepGroups(p => ({ ...p, [indepId]: { ...p[indepId], ...patch } }));
  };

  // 泥?뎄???꾩껜 移댁슫??
  const totalIndep = selectedCands.length;
  const totalDep = selectedCands.reduce((acc, c) => acc + (depGroups[c.id]?.items.filter(d => d.sel).length ?? 0), 0);

  // ?? Phase A: ?낅┰???ㅼ쨷 ?좏깮 (泥댄겕諛뺤뒪) ?????????????????????????????
  if (claimsPhase === 'indep') {
    return (
      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2.5 ml-1.5">
        <p className="text-xs2 text-gray-500 leading-relaxed">
          湲곗큹?먮즺瑜?遺꾩꽍?섏뿬 ?낅┰???꾨낫瑜??앹꽦?덉뒿?덈떎.<br />
          <span className="text-blue-700 font-medium">?щ윭 媛쒕? ?좏깮</span>?????덉뒿?덈떎.
        </p>

        {cands.map(cand => (
          <div key={cand.id}
            className={clsx('rounded-lg border-2 transition-all',
              cand.selected && !cand.aiOpen && !cand.aiDiffOpen ? 'border-blue-600 bg-blue-50 shadow-sm' : '',
              cand.aiOpen ? 'border-violet-300' : '',
              cand.aiDiffOpen && !cand.aiOpen ? 'border-blue-300 bg-white' : '',
              !cand.selected && !cand.aiOpen && !cand.aiDiffOpen ? 'border-ck-border bg-ck-bg opacity-70' : ''
            )}>

            {/* ?ㅻ뜑 ??泥댄겕諛뺤뒪 + 諭껋?留?(踰꾪듉 ?놁쓬, DescriptionPanel ?쇨??? */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2 cursor-pointer"
              onClick={() => { if (!cand.aiOpen && !cand.aiDiffOpen && !done) toggleIndep(cand.id); }}>
              <button
                onClick={e => { e.stopPropagation(); if (!done && !cand.aiOpen && !cand.aiDiffOpen) toggleIndep(cand.id); }}
                className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                  cand.selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white hover:border-blue-400')}>
                {cand.selected && <Icon name="check" size={9} />}
              </button>
              <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs2 font-bold shrink-0',
                cand.selected ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-600')}>
                {cand.label}
              </span>
              <span className="text-xs2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">?낅┰??/span>
            </div>

            {/* 蹂몃Ц ??3媛吏 紐⑤뱶 ?꾪솚 (DescriptionPanel怨??숈씪 ?⑦꽩) */}
            <div className="px-3 pb-3">

              {/* ?쇰컲 紐⑤뱶: textarea (??긽 ?몄쭛 媛?? + AI濡??섏젙?섍린 踰꾪듉 */}
              {!cand.aiOpen && !cand.aiDiffOpen && (
                <div className={clsx('rounded-lg border-2 transition-all',
                  !done ? 'border-ck-border focus-within:border-blue-400' : 'border-green-300 bg-green-50')}>
                  {!done ? (
                    <>
                      <textarea
                        className="w-full text-xs2 text-gray-800 bg-transparent px-3 py-3 outline-none resize-none leading-relaxed rounded-t-lg overflow-hidden"
                        value={cand.text}
                        rows={Math.max(4, Math.ceil(cand.text.length / 40))}
                        placeholder="?낅┰???댁슜???낅젰?섍굅???섏젙?섏꽭??.."
                        onClick={e => e.stopPropagation()}
                        onChange={e => setCands(p => p.map(c => c.id === cand.id ? { ...c, text: e.target.value } : c))}
                        ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                      />
                      <div className="flex justify-end px-3 pb-2 pt-1 border-t border-gray-100">
                        <button
                          onClick={e => { e.stopPropagation(); setCands(p => p.map(c => c.id === cand.id ? { ...c, aiOpen: true, aiPromptVal: '' } : c)); }}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs2 text-violet-600 hover:bg-violet-50 transition-colors">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                            <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                            <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                          </svg>
                          AI濡??섏젙?섍린
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs2 text-gray-700 leading-relaxed px-3 py-3">{cand.text}</p>
                  )}
                </div>
              )}

              {/* ?꾨＼?꾪듃 紐⑤뱶: ?꾩옱 ?댁슜 + ?섏젙 吏???낅젰 (DescriptionPanel ?숈씪 援ъ“) */}
              {cand.aiOpen && !cand.aiDiffOpen && (
                <>
                  <div className={clsx('rounded-lg border p-3 mb-2',
                    'border-gray-200 bg-gray-50')}>
                    <p className="text-xs2 font-medium mb-1 text-gray-400">?꾩옱 ?댁슜</p>
                    <p className="text-xs2 leading-relaxed text-gray-600">{cand.text}</p>
                  </div>
                  <div className="rounded-lg border border-violet-300 bg-violet-50 p-3">
                    <p className="text-xs2 text-violet-700 font-semibold mb-2 flex items-center gap-1.5">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                      ?대뼸寃??섏젙?좉퉴??
                    </p>
                    <textarea autoFocus
                      className="w-full text-xs2 bg-white border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                      placeholder="?? ??援ъ껜?곸쑝濡?/ 泥?뎄踰붿쐞 ?볤쾶 / 援ъ꽦?붿냼 紐낆묶 ?ы븿"
                      value={cand.aiPromptVal} rows={3}
                      onChange={e => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiPromptVal: e.target.value } : c))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); regenIndep(cand.id); } }}
                    />
                    <div className="flex gap-1.5 mt-2 justify-end">
                      <button onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiOpen: false } : c))}
                        className="btn-outline btn-xs text-xs2">痍⑥냼</button>
                      <button onClick={() => regenIndep(cand.id)} disabled={!cand.aiPromptVal.trim()}
                        className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                        ?섏젙 ?앹꽦
                      </button>
                    </div>
                  </div>
                </>
              )}

            {/* diff 紐⑤뱶 ???먮낯 vs. 蹂寃?踰꾩쟾 ?좏깮 */}
            {cand.aiDiffOpen && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs2 text-gray-500 font-semibold">踰꾩쟾???좏깮?섏꽭??/p>
                {/* ?꾩옱 踰꾩쟾 */}
                <div onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiDiffSel: 'current' } : c))}
                  className={clsx('rounded-lg border-2 p-2.5 cursor-pointer transition-all',
                    cand.aiDiffSel === 'current' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-gray-50/50 opacity-60 hover:opacity-80')}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={clsx('w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                      cand.aiDiffSel === 'current' ? 'border-gray-500 bg-gray-500' : 'border-gray-300')}>
                      {cand.aiDiffSel === 'current' && <span className="w-1 h-1 rounded-full bg-white" />}
                    </span>
                    <span className="text-xs2 font-medium text-gray-500">?꾩옱 踰꾩쟾 ?좎?</span>
                  </div>
                  <p className="text-xs2 text-gray-400 leading-relaxed line-clamp-2">{cand.editing ? cand.editVal : cand.text}</p>
                </div>
                {/* 蹂寃?踰꾩쟾 */}
                <div
                  className={clsx('rounded-lg border-2 transition-all',
                    cand.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-blue-200 bg-white hover:border-blue-400')}
                  onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiDiffSel: 'proposed' } : c))}>
                  <div className="flex items-center gap-1.5 px-2.5 pt-2 mb-1">
                    <span className={clsx('w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                      cand.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-600' : 'border-blue-300')}>
                      {cand.aiDiffSel === 'proposed' && <span className="w-1 h-1 rounded-full bg-white" />}
                    </span>
                    <span className="text-xs2 font-bold text-blue-700">蹂寃?踰꾩쟾 梨꾪깮</span>
                    <span className="ml-auto text-xs2 px-1 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold">?섏젙??/span>
                  </div>
                  <textarea
                    className={clsx('w-full text-xs2 leading-relaxed bg-transparent px-2.5 pb-1.5 outline-none resize-none',
                      cand.aiDiffSel === 'proposed' ? 'text-gray-800' : 'text-gray-600')}
                    rows={Math.max(3, Math.ceil(cand.aiProposed.length / 45))}
                    value={cand.aiProposed}
                    onClick={e => { e.stopPropagation(); setCands(p => p.map(c => c.id === cand.id ? { ...c, aiDiffSel: 'proposed' } : c)); }}
                    onChange={e => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiProposed: e.target.value } : c))}
                    placeholder="AI ?앹꽦 ?댁슜??吏곸젒 ?섏젙..."
                  />
                  <div className="px-2.5 pb-1.5 pt-1 border-t border-blue-100" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiOpen: true, aiPromptVal: '' } : c))}
                      className="flex items-center gap-1 text-xs2 text-violet-600 hover:text-violet-800">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                      AI濡?異붽? ?섏젙
                    </button>
                  </div>
                </div>
                <button onClick={() => applyIndepDiff(cand.id)}
                  className="w-full py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1">
                  ?좏깮 ?꾨즺 ??
                </button>
              </div>
            )}
            </div>{/* /蹂몃Ц px-3 pb-3 */}
          </div>
        ))}

        {!done && (
          <button
            onClick={confirmIndep}
            disabled={selectedCands.length === 0}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm2 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-1">
            ?좏깮???낅┰??{selectedCands.length > 0 ? `${selectedCands.length}媛? : ''}?쇰줈 醫낆냽??援ъ꽦 ??
          </button>
        )}
      </div>
    );
  }

  // ?? Phase B: ?낅┰??퀎 醫낆냽???뱀뀡 ???????????????????????????????????
  // 泥?뎄??踰덊샇 怨꾩궛
  let claimNum = 0;
  const indepNums: Record<number, number> = {};
  selectedCands.forEach(c => { indepNums[c.id] = ++claimNum; depGroups[c.id]?.items.filter(d => d.sel).forEach(() => { ++claimNum; }); });
  claimNum = 0; // reset to recompute inline

  return (
    <>
      <div className="flex-1 overflow-y-auto scroll-thin p-3 ml-1.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs2 font-semibold text-gray-600">
            泥?뎄??援ъ꽦 ???낅┰??{totalIndep}媛? 醫낆냽??{totalDep}媛?
          </span>
          {!done && (
            <button onClick={() => setClaimsPhase('indep')}
              className="text-xs2 text-blue-600 hover:underline">
              ???낅┰???ъ꽑??
            </button>
          )}
        </div>

        {selectedCands.map(indep => {
          const indepClaimNum = ++claimNum;
          const grp = depGroups[indep.id] ?? { generated: false, items: [], newText: '' };

          return (
            <div key={indep.id} className="rounded-xl border border-zinc-200 overflow-hidden">
              {/* ?낅┰???ㅻ뜑 ??3紐⑤뱶 ?꾪솚 (DescriptionPanel ?쇨??? */}
              <div className={clsx('border-b px-3 py-2.5',
                indep.aiOpen ? 'bg-violet-50 border-violet-200' : 'bg-blue-50 border-blue-200')}>
                {/* ??댄? (??긽 ?쒖떆) */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="check" size={11} className="text-blue-600" />
                  <span className="text-xs2 font-bold text-blue-700">泥?뎄??{indepClaimNum} 쨌 ?낅┰??{indep.label}</span>
                </div>

                {/* ?쇰컲 紐⑤뱶: textarea + AI濡??섏젙?섍린 */}
                {!indep.aiOpen && !indep.aiDiffOpen && (
                  <div className="rounded border border-blue-200 focus-within:border-blue-400 transition-all">
                    <textarea
                      className="w-full text-xs2 text-blue-900 bg-transparent px-2.5 py-2 outline-none resize-none leading-relaxed overflow-hidden"
                      value={indep.text}
                      rows={Math.max(3, Math.ceil(indep.text.length / 45))}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setCands(p => p.map(c => c.id === indep.id ? { ...c, text: e.target.value } : c))}
                      ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    />
                    {!done && (
                      <div className="flex justify-end px-2 pb-1.5 pt-1 border-t border-blue-100">
                        <button
                          onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiOpen: true, aiPromptVal: '' } : c))}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs2 text-violet-600 hover:bg-violet-50 transition-colors">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                            <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                            <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                          </svg>
                          AI濡??섏젙?섍린
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ?꾨＼?꾪듃 紐⑤뱶 */}
                {indep.aiOpen && !indep.aiDiffOpen && (
                  <>
                    <div className="rounded border p-2.5 bg-white mb-2">
                      <p className="text-xs2 font-medium text-gray-400 mb-0.5">?꾩옱 ?댁슜</p>
                      <p className="text-xs2 text-gray-700 leading-relaxed">{indep.text}</p>
                    </div>
                    <div className="rounded border border-violet-300 bg-white p-2.5">
                      <p className="text-xs2 text-violet-700 font-semibold mb-1.5 flex items-center gap-1">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                          <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                          <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                        </svg>
                        ?대뼸寃??섏젙?좉퉴??
                      </p>
                      <textarea autoFocus
                        className="w-full text-xs2 bg-gray-50 border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                        placeholder="?? ??援ъ껜?곸쑝濡?/ 泥?뎄踰붿쐞 ?볤쾶"
                        value={indep.aiPromptVal} rows={2}
                        onChange={e => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiPromptVal: e.target.value } : c))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); regenIndep(indep.id); } }}
                      />
                      <div className="flex gap-1.5 mt-1.5 justify-end">
                        <button onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiOpen: false } : c))}
                          className="btn-outline btn-xs text-xs2">痍⑥냼</button>
                        <button onClick={() => regenIndep(indep.id)} disabled={!indep.aiPromptVal.trim()}
                          className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                          ?섏젙 ?앹꽦
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {/* diff 紐⑤뱶 */}
                {indep.aiDiffOpen && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs2 text-gray-500 font-semibold">踰꾩쟾???좏깮?섏꽭??/p>
                    <div onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiDiffSel: 'current' } : c))}
                      className={clsx('rounded border-2 p-2 cursor-pointer transition-all', indep.aiDiffSel === 'current' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 opacity-60 hover:opacity-80')}>
                      <p className="text-xs2 text-gray-400 mb-0.5 font-medium">?꾩옱 踰꾩쟾</p>
                      <p className="text-xs2 text-gray-600 line-clamp-2">{indep.text}</p>
                    </div>
                    <div
                      className={clsx('rounded border-2 transition-all', indep.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-50' : 'border-blue-200 hover:border-blue-400')}
                      onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiDiffSel: 'proposed' } : c))}>
                      <div className="flex items-center gap-1.5 px-2 pt-1.5 mb-0.5">
                        <p className="text-xs2 font-bold text-blue-700">蹂寃?踰꾩쟾</p>
                        <span className="text-xs2 px-1 rounded bg-blue-100 text-blue-600 font-semibold">?섏젙??/span>
                      </div>
                      <textarea
                        className={clsx('w-full text-xs2 bg-transparent px-2 pb-1 outline-none resize-none leading-relaxed',
                          indep.aiDiffSel === 'proposed' ? 'text-gray-800' : 'text-gray-600')}
                        rows={Math.max(2, Math.ceil(indep.aiProposed.length / 45))}
                        value={indep.aiProposed}
                        onClick={e => { e.stopPropagation(); setCands(p => p.map(c => c.id === indep.id ? { ...c, aiDiffSel: 'proposed' } : c)); }}
                        onChange={e => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiProposed: e.target.value } : c))}
                      />
                      <div className="px-2 pb-1.5 pt-0.5 border-t border-blue-100" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiOpen: true, aiPromptVal: '' } : c))}
                          className="flex items-center gap-1 text-xs2 text-violet-600 hover:text-violet-800">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9">
                            <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                            <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                          </svg>
                          AI濡?異붽? ?섏젙
                        </button>
                      </div>
                    </div>
                    <button onClick={() => applyIndepDiff(indep.id)}
                      className="w-full py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1">?좏깮 ?꾨즺 ??/button>
                  </div>
                )}
              </div>

              {/* 醫낆냽???뱀뀡 */}
              <div className="p-2.5 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs2 font-semibold text-gray-500">
                    醫낆냽??{grp.generated ? `(${grp.items.filter(d => d.sel).length}媛??좏깮)` : ''}
                  </span>
                  {!done && !grp.generated && (
                    <button onClick={() => generateDeps(indep.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 text-white rounded-md text-xs2 font-semibold hover:bg-violet-700 active:scale-[0.98] transition-all">
                      <span className="font-bold text-xs2">AI</span> 醫낆냽???앹꽦
                    </button>
                  )}
                </div>

                {!grp.generated ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-3 text-center">
                    <p className="text-xs2 text-gray-400 mb-2">?낅┰??쓣 湲곕컲?쇰줈 醫낆냽??쓣 ?먮룞 ?앹꽦?⑸땲??/p>
                    <button onClick={() => generateDeps(indep.id)}
                      className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-xs2 font-semibold hover:bg-violet-700">
                      AI 醫낆냽???앹꽦
                    </button>
                  </div>
                ) : (
                  <>
                    {grp.items.map((dep) => {
                      const depNum = dep.sel ? ++claimNum : null;
                      return (
                        <div key={dep.id}
                          className={clsx('rounded-lg border transition-all',
                            dep.sel && !done ? 'border-blue-200 bg-white' : '',
                            !dep.sel ? 'border-gray-200 bg-gray-50 opacity-60' : '',
                            done && dep.sel ? 'border-green-200 bg-green-50/30' : ''
                          )}>
                          <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer"
                            onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, expanded: !d.expanded } : d) })}>
                            <button
                              onClick={e => { e.stopPropagation(); toggleDep(indep.id, dep.id); }}
                              className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                                dep.sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white hover:border-blue-400')}>
                              {dep.sel && <Icon name="check" size={8} />}
                            </button>
                            <span className={clsx('text-xs2 font-bold shrink-0', dep.sel ? 'text-blue-700' : 'text-gray-400')}>
                              泥?뎄??{depNum ?? '??}
                            </span>
                            <span className="text-xs2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0 text-[10px]">
                              醫낆냽(??indepClaimNum})
                            </span>
                            <span className="text-xs2 text-gray-500 flex-1 truncate text-[10px]">{dep.text.slice(0, 28)}...</span>
                            {!done && (
                              <button onClick={e => { e.stopPropagation(); removeDep(indep.id, dep.id); }}
                                className="shrink-0 text-gray-300 hover:text-red-400">
                                <Icon name="close" size={9} />
                              </button>
                            )}
                          </div>

                          {dep.expanded && (
                            <div className="px-2.5 pb-2.5 border-t border-gray-100 pt-2">
                              {/* 醫낆냽??룄 DescriptionPanel ?숈씪 3紐⑤뱶 ?⑦꽩 */}
                              <>
                                  {/* ?쇰컲 紐⑤뱶: textarea + AI濡??섏젙?섍린 */}
                                  {!dep.aiOpen && !dep.aiDiffOpen && (
                                    <div className="rounded border border-gray-200 focus-within:border-blue-400 transition-all">
                                      <textarea
                                        className="w-full text-xs2 text-gray-800 bg-transparent px-2.5 py-2 outline-none resize-none leading-relaxed overflow-hidden"
                                        value={dep.text}
                                        rows={Math.max(3, Math.ceil(dep.text.length / 45))}
                                        onChange={e => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, text: e.target.value } : d) })}
                                        ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                      />
                                      {!done && (
                                        <div className="flex justify-end px-2 pb-1.5 pt-1 border-t border-gray-100">
                                          <button onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiOpen: true, aiPromptVal: '' } : d) })}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs2 text-violet-600 hover:bg-violet-50 transition-colors">
                                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                                              <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                                              <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                                            </svg>
                                            AI濡??섏젙?섍린
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {/* ?꾨＼?꾪듃 紐⑤뱶 */}
                                  {dep.aiOpen && !dep.aiDiffOpen && (
                                    <>
                                      <div className="rounded border p-2.5 bg-gray-50 mb-2">
                                        <p className="text-xs2 font-medium text-gray-400 mb-0.5">?꾩옱 ?댁슜</p>
                                        <p className="text-xs2 text-gray-700 leading-relaxed">{dep.text}</p>
                                      </div>
                                      <div className="rounded border border-violet-300 bg-violet-50 p-2.5">
                                        <p className="text-xs2 text-violet-700 font-semibold mb-1.5 flex items-center gap-1">
                                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                            <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                                            <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                                          </svg>
                                          ?대뼸寃??섏젙?좉퉴??
                                        </p>
                                        <textarea autoFocus
                                          className="w-full text-xs2 bg-white border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                                          placeholder="?? ??援ъ껜?곸쑝濡?/ 泥?뎄踰붿쐞 ?볤쾶"
                                          value={dep.aiPromptVal} rows={2}
                                          onChange={e => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiPromptVal: e.target.value } : d) })}
                                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); regenDep(indep.id, dep.id); } }}
                                        />
                                        <div className="flex gap-1.5 mt-1.5 justify-end">
                                          <button onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiOpen: false } : d) })}
                                            className="btn-outline btn-xs text-xs2">痍⑥냼</button>
                                          <button onClick={() => regenDep(indep.id, dep.id)} disabled={!dep.aiPromptVal.trim()}
                                            className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                                            ?섏젙 ?앹꽦
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  {/* 醫낆냽??diff 紐⑤뱶 */}
                                  {dep.aiDiffOpen && (
                                    <div className="mt-2 space-y-1.5">
                                      <p className="text-xs2 text-gray-500 font-semibold">踰꾩쟾???좏깮?섏꽭??/p>
                                      <div onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiDiffSel: 'current' } : d) })}
                                        className={clsx('rounded border-2 p-2 cursor-pointer', dep.aiDiffSel === 'current' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 opacity-60 hover:opacity-80')}>
                                        <p className="text-xs2 text-gray-400 mb-0.5 font-medium">?꾩옱 踰꾩쟾</p>
                                        <p className="text-xs2 text-gray-600 line-clamp-2">{dep.text}</p>
                                      </div>
                                      <div
                                        className={clsx('rounded border-2 transition-all', dep.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-50' : 'border-blue-200 hover:border-blue-400')}
                                        onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiDiffSel: 'proposed' } : d) })}>
                                        <div className="flex items-center gap-1.5 px-2 pt-1.5 mb-0.5">
                                          <p className="text-xs2 font-bold text-blue-700">蹂寃?踰꾩쟾</p>
                                          <span className="text-xs2 px-1 rounded bg-blue-100 text-blue-600 font-semibold">?섏젙??/span>
                                        </div>
                                        <textarea
                                          className={clsx('w-full text-xs2 bg-transparent px-2 pb-1 outline-none resize-none leading-relaxed',
                                            dep.aiDiffSel === 'proposed' ? 'text-gray-800' : 'text-gray-600')}
                                          rows={Math.max(2, Math.ceil(dep.aiProposed.length / 40))}
                                          value={dep.aiProposed}
                                          onClick={e => { e.stopPropagation(); updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiDiffSel: 'proposed' } : d) }); }}
                                          onChange={e => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiProposed: e.target.value } : d) })}
                                        />
                                        <div className="px-2 pb-1.5 pt-0.5 border-t border-blue-100" onClick={e => e.stopPropagation()}>
                                          <button onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiOpen: true, aiPromptVal: '' } : d) })}
                                            className="flex items-center gap-1 text-xs2 text-violet-600 hover:text-violet-800">
                                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9">
                                              <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                                              <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                                            </svg>
                                            AI濡?異붽? ?섏젙
                                          </button>
                                        </div>
                                      </div>
                                      <button onClick={() => applyDepDiff(indep.id, dep.id)}
                                        className="w-full py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1">?좏깮 ?꾨즺 ??/button>
                                    </div>
                                  )}
                              </>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 吏곸젒 異붽? */}
                    {!done && (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          className="input text-xs2 py-1 flex-1"
                          placeholder={`??{indepClaimNum}??뿉 ?덉뼱?? ...`}
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
            <Icon name="check" size={13} /> 泥?뎄???뺤젙 ?꾨즺 (?낅┰??{totalIndep}媛? 醫낆냽??{totalDep}媛?
          </div>
        </div>
      )}
    </>
  );
}

// ?? 諛쒕챸???ㅻ챸 ?⑤꼸 ???뱀뀡蹂?1媛??앹꽦, ?몄쭛/?꾨＼?꾪듃 ?섏젙/Diff 梨꾪깮 ??
const DESC_SECTIONS: { key: string; label: string; badge2?: string; text: string }[] = [
  { key: 'tech',     label: '기술분야',         text: '' },
  { key: 'bg',       label: '배경기술',         badge2: '선행기술 3건 기준', text: '' },
  { key: 'problem',  label: '해결하려는 과제', text: '' },
  { key: 'solution', label: '과제해결수단',   text: '' },
  { key: 'effect',   label: '발명의 효과',    text: '' },
];

// 諛쒕챸???ㅻ챸 ?⑤꼸 ??1媛??앹꽦 + view/edit/prompt/diff 紐⑤뱶
function DescriptionPanel({ onUpdate, onModeChange, promptTrigger, onSubInfoChange, initialTexts, onTextsChange }: {
  done: boolean; onConfirm: () => void; onUpdate: (v: string) => void;
  onModeChange?: (mode: string) => void;
  promptTrigger?: number;
  onSubInfoChange?: (info: { subStep: number; currentLabel: string; allDone: boolean; doConfirm: (() => void) | null }) => void;
  initialTexts?: Record<string, string>;
  onTextsChange?: (texts: Record<string, string>) => void;
}) {
  const [subStep, setSubStep] = useState(0);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [texts, setTexts] = useState<Record<string, string>>(
    () => Object.fromEntries(DESC_SECTIONS.map(s => [s.key, initialTexts?.[s.key] ?? s.text ?? '']))
  );
  const [mode, _setMode] = useState<'view' | 'edit' | 'prompt' | 'diff'>('view');
  const setMode = (m: 'view' | 'edit' | 'prompt' | 'diff') => { _setMode(m); onModeChange?.(m); };
  const [promptVal, setPromptVal] = useState('');
  const [proposed, setProposed] = useState('');
  const [diffSel, setDiffSel] = useState<'current' | 'proposed'>('proposed');
  // ?꾨＼?꾪듃 ?섏젙??湲곗? ?띿뒪?? 'current'(?먮낯) | 'proposed'(蹂寃?踰꾩쟾)
  const [promptBase, setPromptBase] = useState<'current' | 'proposed'>('current');

  // ?섎떒 諛붿쓽 "?ㅼ떆 ?섏젙 ?붿껌" ??蹂寃?踰꾩쟾 湲곕컲?쇰줈 ?꾨＼?꾪듃 紐⑤뱶 吏꾩엯
  const prevTrigger = useRef(0);
  useEffect(() => {
    if (promptTrigger && promptTrigger !== prevTrigger.current) {
      prevTrigger.current = promptTrigger;
      // ?대? proposed媛 ?덉쑝硫?diff 紐⑤뱶?먯꽌 ??寃쎌슦) 蹂寃?踰꾩쟾 湲곕컲?쇰줈 ?섏젙
      setPromptBase(proposed ? 'proposed' : 'current');
      setMode('prompt');
    }
  }, [promptTrigger]);

  // subStep??踰붿쐞瑜?踰쀬뼱?섏? ?딅룄濡??대옩??
  const safeSubStep = Math.min(subStep, DESC_SECTIONS.length - 1);
  const sec = DESC_SECTIONS[safeSubStep];
  const curText = texts[sec?.key] || sec?.text || '';
  const isDone = !!confirmed[sec?.key];
  const allDone = DESC_SECTIONS.every(s => confirmed[s.key]);

  // 遺紐?GuidePanel)???꾩옱 ?곹깭 ?꾨떖
  useEffect(() => {
    onSubInfoChange?.({
      subStep: safeSubStep,
      currentLabel: sec?.label || '',
      allDone,
      doConfirm: isDone ? null : () => {
        const next = { ...confirmed, [sec.key]: curText };
        setConfirmed(next);
        onUpdate(DESC_SECTIONS.map(s => `??{s.label}??n${next[s.key] || s.text}`).join('\n\n'));
        setMode('view');
        if (safeSubStep < DESC_SECTIONS.length - 1) setSubStep(p => Math.min(p + 1, DESC_SECTIONS.length - 1));
      },
    });
  }, [safeSubStep, allDone, isDone, curText]);

  const submitPrompt = () => {
    if (!promptVal.trim()) return;
    // ?섏젙 湲곗?: 'proposed'硫?蹂寃?踰꾩쟾 湲곕컲, 'current'硫??꾩옱 ?띿뒪??湲곕컲
    const baseText = promptBase === 'proposed' && proposed ? proposed : curText;
    const mock = baseText.replace(/?대떎\.$/, `?대떎 (${promptVal.slice(0, 20)} 諛섏쁺).`);
    setProposed(mock);
    setDiffSel('proposed'); // 湲곕낯?쇰줈 蹂寃?踰꾩쟾 ?좏깮
    setMode('diff');
    setPromptVal('');
  };

  if (!sec) return null;

  return (
    <>
      {/* ?꾩옱 ?뱀뀡 ?쒖떆 (?ㅽ뀦諛??놁씠 ?뱀뀡紐낅쭔) */}
      {/* ?뱀뀡 ???ㅻ퉬寃뚯씠?????뺤젙 ?뱀뀡 ?대┃?쇰줈 ?щ갑臾?媛??*/}
      <div className="mx-3 mt-2 mb-1 shrink-0">
        <div className="flex gap-1 overflow-x-auto scroll-thin pb-1">
          {DESC_SECTIONS.map((s, i) => {
            const isConfirmed = !!confirmed[s.key];
            const isActive = i === safeSubStep;
            return (
              <button
                key={s.key}
                onClick={() => setSubStep(i)}
                className={clsx(
                  'shrink-0 px-2 py-1 rounded text-xs2 transition-colors border',
                  isActive ? 'bg-blue-700 text-white border-blue-700' :
                  isConfirmed ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100' :
                  'bg-white text-gray-400 border-gray-200',
                )}
              >
                {isConfirmed && !isActive && <Icon name="check" size={8} className="inline mr-0.5" />}
                {s.label}
              </button>
            );
          })}
        </div>
        {isDone && <p className="text-xs2 text-green-600 mt-1 flex items-center gap-1"><Icon name="check" size={9} /> ?뺤젙??/p>}
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-2 ml-1.5 space-y-2">

        {/* ?댁쟾 ?뱀뀡 ?덉뒪?좊━ ???뺤젙???뱀뀡?ㅼ쓣 ?꾩옱 ?뱀뀡 ?꾩뿉 ?쒖떆 */}
        {DESC_SECTIONS.slice(0, safeSubStep).filter(s => confirmed[s.key]).map(s => (
          <div key={s.key} className="rounded-lg border border-green-200 bg-green-50/60 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="check" size={10} className="text-green-600 shrink-0" />
              <span className="text-xs2 font-bold text-green-700">{s.label}</span>
            </div>
            <p className="text-xs2 text-gray-600 leading-relaxed line-clamp-2">{texts[s.key] || s.text}</p>
          </div>
        ))}

        {/* VIEW 紐⑤뱶 ???띿뒪??諛붾줈 ?몄쭛 媛??(?몄쭛 踰꾪듉 遺덊븘?? */}
        {(mode === 'view' || mode === 'edit') && (
          <div className={clsx('rounded-lg border-2 transition-all',
            isDone ? 'border-green-300 bg-green-50' : 'border-ck-border bg-ck-bg focus-within:border-blue-400')}>

            {/* ?띿뒪??吏곸젒 ?몄쭛 ?곸뿭 */}
            {!isDone ? (
              <>
                <textarea
                  className="w-full text-xs2 text-gray-800 bg-transparent px-3 py-3 outline-none resize-none leading-relaxed rounded-t-lg overflow-hidden"
                  value={curText}
                  rows={Math.max(4, Math.ceil(curText.length / 40))}
                  placeholder="?띿뒪?몃? 吏곸젒 ?낅젰?섍굅???섏젙?섏꽭??.."
                  onChange={e => {
                    const next = { ...texts, [sec.key]: e.target.value };
                    setTexts(next);
                    onTextsChange?.(next);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                />
                {/* ?섏젙 ?붿껌 踰꾪듉 (?띿뒪???꾨옒) */}
                <div className="flex justify-end px-3 pb-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => { setPromptBase('current'); setMode('prompt'); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs2 text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                    </svg>
                    AI濡??섏젙?섍린
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                  <Icon name="check" size={10} className="text-green-600 shrink-0" />
                  <span className="text-xs2 font-bold text-green-700">{sec.label}</span>
                </div>
                <p className="text-xs2 text-green-800 leading-relaxed px-3 pb-3">{curText}</p>
              </>
            )}
          </div>
        )}

        {/* PROMPT 紐⑤뱶 */}
        {mode === 'prompt' && (
          <>
            {/* ?섏젙 湲곗? ?띿뒪???쒖떆 */}
            <div className={clsx('rounded-lg border p-3',
              promptBase === 'proposed' && proposed
                ? 'border-blue-200 bg-blue-50'
                : 'border-gray-200 bg-gray-50')}>
              <p className="text-xs2 font-medium mb-1 flex items-center gap-1.5"
                style={{ color: promptBase === 'proposed' && proposed ? '#1d4ed8' : '#9ca3af' }}>
                {promptBase === 'proposed' && proposed ? (
                  <><span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs2 font-semibold">蹂寃?踰꾩쟾 湲곕컲</span> ???댁슜???섏젙?⑸땲??/>
                ) : '?꾩옱 ?댁슜'}
              </p>
              <p className="text-xs2 leading-relaxed"
                style={{ color: promptBase === 'proposed' && proposed ? '#1e40af' : '#4b5563' }}>
                {promptBase === 'proposed' && proposed ? proposed : curText}
              </p>
            </div>
            <div className="rounded-lg border border-violet-300 bg-violet-50 p-3">
              <p className="text-xs2 text-violet-700 font-semibold mb-2 flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                  <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                  <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                </svg>
                ?대뼸寃??섏젙?좉퉴??
              </p>
              <textarea autoFocus
                className="w-full text-xs2 bg-white border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                placeholder="?? ??媛꾧껐?섍쾶 / ?뱁뿀 臾몄껜濡?/ 泥?뎄踰붿쐞? ?곌껐?섎룄濡?/ ??援ъ껜?곸쑝濡?
                value={promptVal} rows={3}
                onChange={e => setPromptVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPrompt(); } }}
              />
              <div className="flex gap-1.5 mt-2 justify-end">
                <button onClick={() => setMode('view')} className="btn-outline btn-xs text-xs2">痍⑥냼</button>
                <button onClick={submitPrompt} disabled={!promptVal.trim()}
                  className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                  ?섏젙 ?앹꽦
                </button>
              </div>
            </div>
          </>
        )}

        {/* 踰꾩쟾 ?좏깮 紐⑤뱶 */}
        {mode === 'diff' && (
          <>
            <p className="text-xs2 text-gray-600 font-semibold mb-2">踰꾩쟾???좏깮?섏꽭??/p>

            {/* ?꾩옱 踰꾩쟾 ???묎퀬 ?뚯깋, 鍮꾪솢???먮굦 */}
            <div
              onClick={() => setDiffSel('current')}
              className={clsx(
                'rounded-lg border-2 p-3 cursor-pointer transition-all',
                diffSel === 'current'
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 bg-gray-50/50 opacity-60 hover:opacity-80 hover:border-gray-300',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={clsx(
                  'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                  diffSel === 'current' ? 'border-gray-500 bg-gray-500' : 'border-gray-300 bg-white',
                )}>
                  {diffSel === 'current' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-xs2 font-medium text-gray-500">?꾩옱 踰꾩쟾 ?좎?</span>
              </div>
              <p className="text-xs2 text-gray-400 leading-relaxed line-clamp-3">{curText}</p>
            </div>

            {/* 蹂寃?踰꾩쟾 ???몄쭛 媛??+ AI 異붽? ?섏젙 吏??*/}
            <div
              className={clsx(
                'rounded-lg border-2 transition-all',
                diffSel === 'proposed'
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-blue-200 bg-white hover:border-blue-400',
              )}
              onClick={() => setDiffSel('proposed')}
            >
              <div className="flex items-center gap-2 px-3 pt-2.5 mb-1">
                <span className={clsx(
                  'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                  diffSel === 'proposed' ? 'border-blue-600 bg-blue-600' : 'border-blue-300 bg-white',
                )}>
                  {diffSel === 'proposed' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-xs2 font-bold text-blue-700">蹂寃?踰꾩쟾 梨꾪깮</span>
                <span className="ml-auto text-xs2 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">?섏젙??/span>
              </div>
              {/* 吏곸젒 ?몄쭛 媛??textarea */}
              <textarea
                className={clsx(
                  'w-full text-xs2 leading-relaxed bg-transparent px-3 pb-2 outline-none resize-none',
                  diffSel === 'proposed' ? 'text-gray-800 font-medium' : 'text-gray-600',
                )}
                value={proposed}
                rows={Math.max(3, Math.ceil(proposed.length / 45))}
                onClick={e => { e.stopPropagation(); setDiffSel('proposed'); }}
                onChange={e => setProposed(e.target.value)}
                placeholder="AI ?앹꽦 ?댁슜??吏곸젒 ?섏젙?????덉뒿?덈떎..."
              />
              {/* AI 異붽? ?섏젙 踰꾪듉 */}
              <div className="px-3 pb-2 pt-1 border-t border-blue-100" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { setPromptBase('proposed'); setMode('prompt'); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs2 text-violet-600 hover:bg-violet-50 transition-colors"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                    <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                    <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                  </svg>
                  AI濡?異붽? ?섏젙?섍린
                </button>
              </div>
            </div>

            {/* ?⑥씪 CTA: ?좏깮 ?꾨즺 */}
            <button
              onClick={() => {
                const newText = diffSel === 'proposed' ? proposed : curText;
                if (diffSel === 'proposed') setTexts(p => ({ ...p, [sec.key]: newText }));
                setMode('view'); setProposed(''); setDiffSel('proposed');
                // ?대? ?뺤젙???뱀뀡?대㈃ ???띿뒪?몃줈 ?ы솗????doConfirm??null???섎뒗 臾몄젣 諛⑹?
                if (isDone) {
                  const next = { ...confirmed, [sec.key]: newText };
                  setConfirmed(next);
                  onUpdate(DESC_SECTIONS.map(s => `??{s.label}??n${next[s.key] || s.text}`).join('\n\n'));
                }
              }}
              className="w-full py-2 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1"
            >
              ?좏깮 ?꾨즺 ??
            </button>
          </>
        )}
      </div>

      {/* ?대? ?뺤젙 踰꾪듉 ?쒓굅 ???섎떒 諛?GuidePanel)?먯꽌 ?듯빀 泥섎━ */}
      {allDone && (
        <div className="px-3 py-2 border-t border-ck-border bg-green-50 shrink-0 ml-1.5">
          <div className="flex items-center gap-1.5 text-xs2 text-green-700 font-medium">
            <Icon name="check" size={11} /> 5媛??뱀뀡 紐⑤몢 ?뺤젙?????섎떒 踰꾪듉?쇰줈 ?ㅼ쓬 ?④퀎 吏꾪뻾
          </div>
        </div>
      )}
    </>
  );
}


// ?? ?붿빟???⑤꼸 ??A(?곸꽭) + B(媛꾧껐) 2媛??꾨낫 ??
const ABSTRACT_CANDS = [
  {
    letter: 'A', charCount: 187, badge2: null,
    text: '蹂?諛쒕챸? ?먯쑉二쇳뻾 李⑤웾???μ갑???쇱씠???쇱꽌?먯꽌 ?섏떊???ъ씤???대씪?곕뱶 ?곗씠?곕? 湲곕컲?쇰줈 ?ㅼ떆媛?媛앹껜 ?몄떇 諛?遺꾨쪟瑜??섑뻾?섎뒗 ?μ튂 諛?諛⑸쾿??愿??寃껋쑝濡? RANSAC 湲곕컲 ?꾩쿂由ъ? PointNet++ ?λ윭??紐⑤뜽??寃고빀?섏뿬 蹂댄뻾?? 李⑤웾, ?먯쟾嫄????ㅼ뼇??媛앹껜瑜??믪? ?뺥솗?꾨줈 ?몄떇?섍퀬 異붿쟻?쒕떎.',
  },
  {
    letter: 'B', charCount: 132, badge2: '媛꾧껐 踰꾩쟾',
    text: '?쇱씠???ъ씤???대씪?곕뱶???꾩쿂由ъ? ?λ윭??湲곕컲 3D 媛앹껜 ?먯?瑜?寃고빀???ㅼ떆媛?媛앹껜 ?몄떇 ?μ튂濡? ?먯쑉二쇳뻾 ?섍꼍?먯꽌 ?ㅼ뼇??媛앹껜瑜??뺥솗?섍쾶 ?몄떇쨌異붿쟻?섎뒗 湲곗닠??愿??寃껋씠??',
  },
];

function AbstractPanel({ done, onUpdate }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editVals, setEditVals] = useState<Record<number, string>>({});

  const getVal = (i: number) => editVals[i] ?? ABSTRACT_CANDS[i].text;

  return (
    <>
      {/* ?덈궡 諛곕꼫 */}
      <div className="mx-3 mt-3 mb-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 shrink-0">
        <p className="text-xs2 text-blue-700">紐낆꽭???꾩껜 ?댁슜??湲곕컲?쇰줈 <strong>?붿빟??2媛??꾨낫</strong>瑜??앹꽦?덉뒿?덈떎. ?좏깮?섍굅???섏젙?섏꽭??</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2 ml-1.5">
        {ABSTRACT_CANDS.map((cand, i) => {
          const isSelected = selectedIdx === i && !done;
          const isConfirmed = done && selectedIdx === i;
          return (
            <div
              key={cand.letter}
              onClick={() => !done && setSelectedIdx(i)}
              className={clsx(
                'rounded-lg border-2 p-3 cursor-pointer transition-all',
                isSelected && 'border-blue-700 bg-blue-50',
                isConfirmed && 'border-green-500 bg-green-50',
                !isSelected && !isConfirmed && !done && 'border-ck-border bg-ck-bg hover:border-blue-300',
                done && !isConfirmed && 'border-gray-200 opacity-60',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={clsx('w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 border-2',
                  isSelected || isConfirmed ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 text-gray-500')}>
                  {cand.letter}
                </span>
                {cand.badge2 && (
                  <span className="text-xs2 text-gray-500 font-medium">{cand.badge2}</span>
                )}
                <span className="text-xs2 text-gray-400">{cand.charCount}??/span>
                {!done && (
                  <div className="ml-auto flex gap-1">
                    <button onClick={e => e.stopPropagation()} title="AI濡??ㅼ떆 ?앹꽦" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); setSelectedIdx(i); }} title="吏곸젒 ?섏젙" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400">
                      <Icon name="edit" size={11} />
                    </button>
                  </div>
                )}
              </div>
              {isSelected ? (
                <textarea
                  className="w-full text-xs2 text-gray-700 bg-white border border-blue-200 rounded px-2 py-1.5 outline-none resize-none leading-relaxed"
                  value={getVal(i)}
                  rows={4}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    setEditVals(prev => ({ ...prev, [i]: e.target.value }));
                    onUpdate(e.target.value);
                  }}
                />
              ) : (
                <p className="text-xs2 text-gray-700 leading-relaxed line-clamp-4">{getVal(i)}</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
