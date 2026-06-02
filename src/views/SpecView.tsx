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

  // mainView를 sessionStorage에 persist — 사이드바 재클릭 시 에디터 상태 유지
  const [mainView, setMainView] = useState<'analysis' | 'editor'>(() => {
    if (task?.id) {
      const saved = sessionStorage.getItem(`axp_mainview_${task.id}`);
      if (saved === 'editor') return 'editor';
    }
    return 'analysis';
  });
  const handleSetMainView = (v: 'analysis' | 'editor') => {
    setMainView(v);
    if (task?.id) sessionStorage.setItem(`axp_mainview_${task.id}`, v);
  };
  const [guideOpen, setGuideOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<StepId>>(new Set()); // U5: 확정 카드 접힘
  const [phase, setPhase] = useState<'upload' | 'direct' | 'flow' | 'done'>('upload');
  const [curStep, setCurStep] = useState<StepId>('upload');
  const [confirmed, setConfirmed] = useState<Partial<Record<StepId, string>>>({});
  const [guideStep, setGuideStep] = useState<StepId>('title');
  const [gSel, setGSel] = useState<Partial<Record<StepId, string>>>({});

  const [diTitle, setDiTitle] = useState('');
  const [diField, setDiField] = useState('');
  const [diContent, setDiContent] = useState('');
  const [diProblem, setDiProblem] = useState('');
  const [diKeywords, setDiKeywords] = useState('');
  // 기초자료 보기 패널
  const [sourceDataOpen, setSourceDataOpen] = useState(false);

  const flowRef = useRef<HTMLDivElement>(null);

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
  const isVisible = (id: StepId) => {
    if (id === 'upload') return true;
    if (phase === 'upload' || phase === 'direct') return false;
    return si(id) <= si(curStep);
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
  const startFlow = () => {
    setPhase('flow'); setCurStep('title'); setGuideStep('title');
    setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
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
      { label: '과제의 해결 수단', content: extractDesc('과제해결수단') },
      { label: '발명의 효과', content: extractDesc('발명의 효과') },
      { label: '청구범위', content: claims },
      { label: '요약서', content: abstract },
    ].filter(s => s.content.trim());
  };

  if (mainView === 'editor') {
    return (
      <>
        <SpecEditorView task={task} onBack={() => handleSetMainView('analysis')} confirmedTitle={gSel['title'] || confirmed['title']} />
        {previewOpen && <PreviewModal taskName={task?.name} sections={makePreviewSections()} onClose={() => setPreviewOpen(false)} />}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 text-md2 font-semibold text-gray-700">
          <Icon name="doc" size={14} className="text-blue-700" />
          <span>{task?.name || '새 명세서'}</span>
          <span className="text-xs2 text-gray-400 font-normal ml-1">· 자동 저장됨 (방금)</span>
        </div>
        <div className="flex items-center gap-2">
          {(diTitle || phase === 'flow' || phase === 'done') && (
            <button onClick={() => setSourceDataOpen(o => !o)}
              className={clsx('btn-outline btn-xs', sourceDataOpen && 'bg-zinc-100 border-zinc-400 text-zinc-700')}>
              <Icon name="doc" size={11} /> 기초자료
            </button>
          )}
          <button onClick={() => setGuideOpen(o => !o)}
            className={clsx('btn-outline btn-xs', guideOpen && 'bg-violet-50 border-violet-400 text-violet-700')}>
            <Icon name="star" size={11} /> AI 가이드
          </button>
          <button className="btn-outline btn-xs" onClick={() => setPreviewOpen(true)}><Icon name="search" size={11} /> 미리보기</button>
          <button className="btn-primary btn-sm"><Icon name="doc" size={11} /> 저장</button>
        </div>
      </div>

      {/* Stepper — 원본 stepper-bar / step-pill / step-connector 구조 */}
      <div className="flex items-center px-4 border-b border-ck-border overflow-x-auto scroll-thin shrink-0" style={{ height: 48 }}>
        {STEPS.map((s, i) => {
          const isDone = isConfirmed(s.id);
          const active = s.id === curStep && (phase === 'flow' || phase === 'done');
          const locked = phase !== 'flow' && phase !== 'done' && s.id !== 'upload';
          const prevDone = i > 0 && isConfirmed(STEPS[i - 1].id);
          return (
            <div key={s.id} className="flex items-center shrink-0">
              {/* step-connector: 이전 단계 완료면 green, 아니면 gray */}
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
                )}>{s.short}</span>
              </button>
            </div>
          );
        })}
      </div>

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
        <div ref={flowRef} className="flex-1 overflow-y-auto scroll-thin bg-ck-bg">
          <div className="max-w-3xl mx-auto py-8 px-4 space-y-3">

            {/* 업로드 존 — 원본 동일: flow/done 이후에도 계속 표시 (스크롤 방식) */}
            {phase !== 'flow' && phase !== 'done' && (
              <div className="text-center py-4">
                <Icon name="doc" size={48} className="text-blue-700 mx-auto mb-3" />
                <h2 className="text-lg2 font-bold text-gray-800 mb-2">새 특허 명세서 작성</h2>
                <p className="text-md2 text-gray-500 mb-6">아래 두 가지 방법 중 하나로 기초자료를 제공하세요.</p>
                <div onClick={phase === 'upload' ? startFlow : undefined}
                  className={`border-2 border-dashed rounded-xl p-10 mb-5 transition-all ${phase === 'upload' ? 'border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30' : 'border-gray-200 opacity-50'}`}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-gray-400">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-md2 text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-sm2 text-gray-400 mt-1">PDF, DOCX, HWP, 이미지 파일 지원</p>
                </div>
                {phase === 'upload' && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-sm2 text-gray-400 font-medium px-2">또는</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <button onClick={() => setPhase('direct')}
                      className="btn-outline flex items-center gap-2 mx-auto">
                      <Icon name="edit" size={14} /> 기초 내용 직접 입력하기
                    </button>
                    <p className="text-xs2 text-gray-400 mt-2">파일 없이 발명 내용을 텍스트로 직접 입력할 수 있습니다.</p>
                  </>
                )}
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
                    <button className="btn-primary btn-sm" onClick={startFlow} disabled={!diTitle.trim() || !diField.trim() || !diContent.trim()}>
                      <Icon name="star" size={13} /> AI 분석 시작
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
                  const isDone = isConfirmed(s.id);
                  return (
                    <div key={s.id} className="space-y-3">
                      {/* 원본: AI chat bubble만 표시 — 후보 카드/선택확인 버튼은 우측 패널에만 */}
                      <AiMsg text={
                        <><strong>{STEP_LABEL[s.id]}</strong><br />
                        업로드 내용을 기반으로 {STEP_LABEL[s.id]} 후보를 생성했습니다.{' '}
                        <span className="text-blue-700 font-semibold">오른쪽 분석결과</span>에서 적합한 항목을 선택하거나 직접 입력하세요.</>
                      } />
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
                              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 max-w-2xl shadow-xs w-full">
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
                                  <span className="text-sm2 font-semibold text-blue-700 flex-1">{CONFIRM_LABEL[s.id]}</span>
                                  {!isExpanded && <span className="text-xs2 text-gray-400 truncate max-w-[160px]">{summary}</span>}
                                  <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={11} className="text-gray-400 shrink-0" />
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
            onGenerateSpec={() => handleSetMainView('editor')}
          />
        )}
      </div>
      {previewOpen && <PreviewModal taskName={task?.name} sections={makePreviewSections()} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function AiMsg({ text }: { text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs2 font-bold flex items-center justify-center shrink-0">AI</div>
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-md2 text-gray-700 shadow-xs max-w-2xl">
        {text}<span className="text-xs2 text-gray-400 ml-2">방금</span>
      </div>
    </div>
  );
}

function GuidePanel({ step, gSel, setGSel, onConfirm, confirmed, onPrev, hasPrev, allDone, onGenerateSpec }: {
  step: StepId;
  gSel: Partial<Record<StepId, string>>;
  setGSel: React.Dispatch<React.SetStateAction<Partial<Record<StepId, string>>>>;
  onConfirm: (id: StepId) => void;
  confirmed: Partial<Record<StepId, string>>;
  onPrev: () => void;
  hasPrev: boolean;
  allDone?: boolean;
  onGenerateSpec?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDone = step in confirmed;
  const isSpecial = step === 'description' || step === 'components' || step === 'drawings' || step === 'claims' || step === 'abstract';
  const cands = GUIDE_CANDS[step] || [];
  const curSel = gSel[step] || cands[0] || '';
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<Record<number, string>>({});
  // description 패널 내부 모드 추적 (view/edit/prompt/diff)
  const [descMode, setDescMode] = useState<string>('view');
  // description 패널의 prompt 재입력 요청 콜백
  const [descPromptTrigger] = useState(0);
  // description 패널의 현재 섹션 상태 (GuidePanel 하단 버튼 제어용)
  const [descSubInfo, setDescSubInfo] = useState<{
    subStep: number; currentLabel: string; allDone: boolean; doConfirm: (() => void) | null;
  }>({ subStep: 0, currentLabel: '기술분야', allDone: false, doConfirm: null });

  // 구성요소 → 도면 부호 공유 (ComponentsPanel → DrawingsPanel)
  const [confirmedComponents, setConfirmedComponents] = useState<InventionComponent[]>([
    { number: '100', name: '데이터 수집부' },
    { number: '200', name: '전처리부' },
    { number: '300', name: '특징 추출부' },
    { number: '400', name: '인식부' },
    { number: '500', name: '출력부' },
  ]);

  const getCardVal = (i: number) => editVals[i] ?? cands[i] ?? '';

  const STEP_DESCS: Partial<Record<StepId, string>> = {
    title: '업로드한 문서를 분석하여 3개의 명칭 후보를 생성했습니다. 선택하거나 직접 수정하세요.',
    description: '기술분야→배경기술→해결과제→과제해결수단 순서로 각 항목을 확인하고 확정하세요.',
    abstract: '요약서를 자동 생성했습니다. 내용을 확인하고 수정하세요.',
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

  const handleConfirm = () => {
    // 특수 단계: gSel에 이미 onUpdate로 세팅된 실제 내용이 있으면 그것을 사용
    if (isSpecial) {
      // gSel[step]이 있으면 그 값을 사용, 없으면 단계별 기본 요약 문자열 사용
      const fallbacks: Partial<Record<StepId, string>> = {
        components: '구성요소 확정',
        drawings: '도면 확정',
        claims: '청구항 확정',
        abstract: '요약서 확정',
      };
      const specialVal = gSel[step] || fallbacks[step] || '확정';
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

      {/* 리사이즈 핸들 — 원본 artifact-resize-handle */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 z-10 transition-colors"
        style={{ background: 'transparent' }}
        title="패널 너비 조정"
      />

      {/* 헤더 */}
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
              <Icon name="check" size={10} /> 확정됨
            </span>
          )}
        </div>
        <p className="text-sm2 text-gray-500 leading-snug">
          {STEP_DESCS[step] || `${STEP_LABEL[step]} 후보를 생성했습니다. 선택하거나 직접 수정하세요.`}
        </p>
      </div>

      {/* 단계별 특수 패널 */}
      {step === 'description' && <DescriptionPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} onModeChange={setDescMode} promptTrigger={descPromptTrigger} onSubInfoChange={setDescSubInfo} />}
      {step === 'components' && <ComponentsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} onComponentsChange={setConfirmedComponents} />}
      {step === 'drawings' && <DrawingsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} inventionComponents={confirmedComponents} />}
      {step === 'claims' && <ClaimsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} />}
      {step === 'abstract' && <AbstractPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} />}

      {/* 일반 단계 A/B/C/D 카드 */}
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
                  {/* AI배지 제거 요청으로 미표시 */}
                  <div className="ml-auto flex gap-1">
                    {!isDone && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); }}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                          title="이 후보 재생성"
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
                          title="직접 수정"
                        >
                          <Icon name="edit" size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* 카드 텍스트 — 편집 모드 시 contenteditable textarea */}
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

          {/* 직접 입력 카드 (D) */}
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
                <span className="text-xs2 text-gray-500 font-semibold">직접 입력</span>
                <div className="ml-auto">
                  <button onClick={e => e.stopPropagation()} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700" title="직접 수정">
                    <Icon name="edit" size={11} />
                  </button>
                </div>
              </div>
              <textarea
                className="w-full text-sm2 font-semibold bg-transparent outline-none resize-none"
                style={{ color: !cands.includes(curSel) && curSel ? '#1f2937' : '#9ca3af', fontStyle: !cands.includes(curSel) && curSel ? 'normal' : 'italic' }}
                placeholder={`${STEP_LABEL[step]}을 직접 입력하세요`}
                value={cands.includes(curSel) ? '' : curSel}
                onChange={e => setGSel(p => ({ ...p, [step]: e.target.value }))}
                onClick={e => e.stopPropagation()}
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {/* 하단 버튼 바 */}
      <div className="flex gap-2 px-3 py-2.5 border-t border-ck-border bg-ck-bg shrink-0 ml-1.5">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-3 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          ← 이전
        </button>
        {/* 5단계 도면: 도면 없이 진행 버튼 */}
        {step === 'drawings' && !isDone && (
          <button onClick={handleConfirm}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50 whitespace-nowrap"
            title="도면 없이 다음 단계로 진행">
            건너뛰기
          </button>
        )}

        {/* description diff 모드에서 확인 버튼 숨김 */}
        {!(step === 'description' && descMode === 'diff') && (
          !isDone ? (
            step === 'description' ? (
              descSubInfo.allDone ? (
                <button onClick={handleConfirm}
                  className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800">
                  다음 →
                </button>
              ) : (
                <button
                  onClick={() => descSubInfo.doConfirm?.()}
                  disabled={descMode === 'prompt' || descMode === 'diff'}
                  className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  다음 →
                </button>
              )
            ) : (
              <button
                onClick={handleConfirm}
                disabled={!isSpecial && !curSel.trim()}
                className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음 →
              </button>
            )
          ) : (
            allDone && onGenerateSpec ? (
              <button onClick={onGenerateSpec}
                className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs2 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1">
                <Icon name="star" size={10} /> 명세서 AI 생성
              </button>
            ) : step === 'description' && !descSubInfo.allDone ? (
              // description 재방문: 서브스텝이 완료 안 됐으면 서브스텝 플로우로
              <button
                onClick={() => descSubInfo.doConfirm?.()}
                disabled={descMode === 'prompt' || descMode === 'diff'}
                className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음 →
              </button>
            ) : (
              // 이미 확정된 단계 재방문 시 — 다음 단계로 이동
              <button onClick={handleConfirm}
                className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800">
                다음 →
              </button>
            )
          )
        )}
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

function ComponentsPanel({ done, onUpdate, onComponentsChange }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  onComponentsChange?: (comps: InventionComponent[]) => void;
}) {
  const [items, setItems] = useState<CompItem[]>(INIT_COMPS);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    const selected = INIT_COMPS.filter(it => it.sel);
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

  const handleSave = (drawingId: string, updates: Partial<typeof drawings[0]>) => {
    setDrawings(prev => {
      const next = prev.map(d => d.id === drawingId ? { ...d, ...updates } : d);
      onUpdate(next.filter(d => d.stage === 'done').map(d => `기호${d.symbol} ${d.name}: ${d.description}`).join('\n\n'));
      return next;
    });
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
      // 모바일: 모달로
      setModalStartId(id);
      setModalOpen(true);
    } else {
      // 데스크탑: 새 탭으로 전체 워크플로 오픈
      const draw = drawings.find(d => d.id === id);
      openEditorTab({
        drawingId: id,
        drawings,
        components: inventionComponents ?? [],
        // 구성요소 목록을 도면 부호 초기값으로 변환하여 전달
        references: (inventionComponents ?? []).map(c => ({ number: c.number, name: c.name })),
        drawingName: draw?.name ?? id,
        timestamp: Date.now(),
      });
    }
  };

  const LABEL_STYLES: Record<string, string> = {
    '제안기술': 'bg-blue-100 text-blue-700',
    '종래기술': 'bg-gray-100 text-gray-600',
    'AI생성':   'bg-violet-100 text-violet-700',
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
        {/* 헤더 — 전체 "편집기 열기" 버튼 제거 (개별 카드에서 편집 진입) */}
        <p className="text-xs2 font-semibold text-gray-500 mb-2">
          추출된 도면 <span className="font-normal text-gray-400">({drawings.length}개 · 완료 {doneCount}개)</span>
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
              {/* 썸네일 + 메타 */}
              <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-1.5">
                <div className="w-10 shrink-0 aspect-[4/3] bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                  {d.exportedImageUrl
                    ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                    : <Icon name="image" size={12} className="text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-xs2 font-bold text-gray-700">기호 {d.symbol}</span>
                    <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', LABEL_STYLES[d.label])}>
                      {d.label}
                    </span>
                  </div>
                  <p className="text-xs2 text-gray-700 font-semibold truncate">{d.name}</p>
                </div>
                {/* 완료 상태 */}
                <div className="shrink-0">
                  {isDone
                    ? <Icon name="check" size={11} className="text-green-500" />
                    : <span className={clsx('w-2 h-2 rounded-full block', stageDot)} />}
                </div>
              </div>

              {/* 편집 버튼 — 항상 표시, 클릭 가능함을 명확히 인지 */}
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
                  {isDone ? '편집 내용 보기 →' : '도면 편집 →'}
                </button>
              )}
            </div>
          );
        })}
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


function ClaimsPanel({ done, onUpdate }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void }) {
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

  // 독립항 선택 토글
  const toggleIndep = (id: number) => {
    const next = cands.map(c => c.id === id ? { ...c, selected: !c.selected } : c);
    setCands(next);
    syncUpdate(next, depGroups);
  };

  // 독립항 Phase B로 이동
  const confirmIndep = () => {
    if (selectedCands.length === 0) return;
    setClaimsPhase('dep');
    syncUpdate(cands, depGroups);
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
              cand.selected && !cand.aiOpen && !cand.aiDiffOpen ? 'border-blue-600 bg-blue-50 shadow-sm' : '',
              cand.aiOpen ? 'border-violet-300' : '',
              cand.aiDiffOpen && !cand.aiOpen ? 'border-blue-300 bg-white' : '',
              !cand.selected && !cand.aiOpen && !cand.aiDiffOpen ? 'border-ck-border bg-ck-bg opacity-70' : ''
            )}>

            {/* 헤더 — 체크박스 + 뱃지만 (버튼 없음, DescriptionPanel 일관성) */}
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
              <span className="text-xs2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">독립항</span>
            </div>

            {/* 본문 — 3가지 모드 전환 (DescriptionPanel과 동일 패턴) */}
            <div className="px-3 pb-3">

              {/* 일반 모드: textarea (항상 편집 가능) + AI로 수정하기 버튼 */}
              {!cand.aiOpen && !cand.aiDiffOpen && (
                <div className={clsx('rounded-lg border-2 transition-all',
                  !done ? 'border-ck-border focus-within:border-blue-400' : 'border-green-300 bg-green-50')}>
                  {!done ? (
                    <>
                      <textarea
                        className="w-full text-xs2 text-gray-800 bg-transparent px-3 py-3 outline-none resize-none leading-relaxed rounded-t-lg overflow-hidden"
                        value={cand.text}
                        rows={Math.max(4, Math.ceil(cand.text.length / 40))}
                        placeholder="독립항 내용을 입력하거나 수정하세요..."
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
                          AI로 수정하기
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs2 text-gray-700 leading-relaxed px-3 py-3">{cand.text}</p>
                  )}
                </div>
              )}

              {/* 프롬프트 모드: 현재 내용 + 수정 지시 입력 (DescriptionPanel 동일 구조) */}
              {cand.aiOpen && !cand.aiDiffOpen && (
                <>
                  <div className={clsx('rounded-lg border p-3 mb-2',
                    'border-gray-200 bg-gray-50')}>
                    <p className="text-xs2 font-medium mb-1 text-gray-400">현재 내용</p>
                    <p className="text-xs2 leading-relaxed text-gray-600">{cand.text}</p>
                  </div>
                  <div className="rounded-lg border border-violet-300 bg-violet-50 p-3">
                    <p className="text-xs2 text-violet-700 font-semibold mb-2 flex items-center gap-1.5">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                      어떻게 수정할까요?
                    </p>
                    <textarea autoFocus
                      className="w-full text-xs2 bg-white border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                      placeholder="예: 더 구체적으로 / 청구범위 넓게 / 구성요소 명칭 포함"
                      value={cand.aiPromptVal} rows={3}
                      onChange={e => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiPromptVal: e.target.value } : c))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); regenIndep(cand.id); } }}
                    />
                    <div className="flex gap-1.5 mt-2 justify-end">
                      <button onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiOpen: false } : c))}
                        className="btn-outline btn-xs text-xs2">취소</button>
                      <button onClick={() => regenIndep(cand.id)} disabled={!cand.aiPromptVal.trim()}
                        className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                        수정 생성
                      </button>
                    </div>
                  </div>
                </>
              )}

            {/* diff 모드 — 원본 vs. 변경 버전 선택 */}
            {cand.aiDiffOpen && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs2 text-gray-500 font-semibold">버전을 선택하세요</p>
                {/* 현재 버전 */}
                <div onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiDiffSel: 'current' } : c))}
                  className={clsx('rounded-lg border-2 p-2.5 cursor-pointer transition-all',
                    cand.aiDiffSel === 'current' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-gray-50/50 opacity-60 hover:opacity-80')}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={clsx('w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                      cand.aiDiffSel === 'current' ? 'border-gray-500 bg-gray-500' : 'border-gray-300')}>
                      {cand.aiDiffSel === 'current' && <span className="w-1 h-1 rounded-full bg-white" />}
                    </span>
                    <span className="text-xs2 font-medium text-gray-500">현재 버전 유지</span>
                  </div>
                  <p className="text-xs2 text-gray-400 leading-relaxed line-clamp-2">{cand.editing ? cand.editVal : cand.text}</p>
                </div>
                {/* 변경 버전 */}
                <div
                  className={clsx('rounded-lg border-2 transition-all',
                    cand.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-blue-200 bg-white hover:border-blue-400')}
                  onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiDiffSel: 'proposed' } : c))}>
                  <div className="flex items-center gap-1.5 px-2.5 pt-2 mb-1">
                    <span className={clsx('w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                      cand.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-600' : 'border-blue-300')}>
                      {cand.aiDiffSel === 'proposed' && <span className="w-1 h-1 rounded-full bg-white" />}
                    </span>
                    <span className="text-xs2 font-bold text-blue-700">변경 버전 채택</span>
                    <span className="ml-auto text-xs2 px-1 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold">수정됨</span>
                  </div>
                  <textarea
                    className={clsx('w-full text-xs2 leading-relaxed bg-transparent px-2.5 pb-1.5 outline-none resize-none',
                      cand.aiDiffSel === 'proposed' ? 'text-gray-800' : 'text-gray-600')}
                    rows={Math.max(3, Math.ceil(cand.aiProposed.length / 45))}
                    value={cand.aiProposed}
                    onClick={e => { e.stopPropagation(); setCands(p => p.map(c => c.id === cand.id ? { ...c, aiDiffSel: 'proposed' } : c)); }}
                    onChange={e => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiProposed: e.target.value } : c))}
                    placeholder="AI 생성 내용을 직접 수정..."
                  />
                  <div className="px-2.5 pb-1.5 pt-1 border-t border-blue-100" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setCands(p => p.map(c => c.id === cand.id ? { ...c, aiOpen: true, aiPromptVal: '' } : c))}
                      className="flex items-center gap-1 text-xs2 text-violet-600 hover:text-violet-800">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                      AI로 추가 수정
                    </button>
                  </div>
                </div>
                <button onClick={() => applyIndepDiff(cand.id)}
                  className="w-full py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1">
                  선택 완료 →
                </button>
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
              {/* 독립항 헤더 — 3모드 전환 (DescriptionPanel 일관성) */}
              <div className={clsx('border-b px-3 py-2.5',
                indep.aiOpen ? 'bg-violet-50 border-violet-200' : 'bg-blue-50 border-blue-200')}>
                {/* 타이틀 (항상 표시) */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="check" size={11} className="text-blue-600" />
                  <span className="text-xs2 font-bold text-blue-700">청구항 {indepClaimNum} · 독립항 {indep.label}</span>
                </div>

                {/* 일반 모드: textarea + AI로 수정하기 */}
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
                          AI로 수정하기
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 프롬프트 모드 */}
                {indep.aiOpen && !indep.aiDiffOpen && (
                  <>
                    <div className="rounded border p-2.5 bg-white mb-2">
                      <p className="text-xs2 font-medium text-gray-400 mb-0.5">현재 내용</p>
                      <p className="text-xs2 text-gray-700 leading-relaxed">{indep.text}</p>
                    </div>
                    <div className="rounded border border-violet-300 bg-white p-2.5">
                      <p className="text-xs2 text-violet-700 font-semibold mb-1.5 flex items-center gap-1">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                          <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                          <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                        </svg>
                        어떻게 수정할까요?
                      </p>
                      <textarea autoFocus
                        className="w-full text-xs2 bg-gray-50 border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                        placeholder="예: 더 구체적으로 / 청구범위 넓게"
                        value={indep.aiPromptVal} rows={2}
                        onChange={e => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiPromptVal: e.target.value } : c))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); regenIndep(indep.id); } }}
                      />
                      <div className="flex gap-1.5 mt-1.5 justify-end">
                        <button onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiOpen: false } : c))}
                          className="btn-outline btn-xs text-xs2">취소</button>
                        <button onClick={() => regenIndep(indep.id)} disabled={!indep.aiPromptVal.trim()}
                          className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                          수정 생성
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {/* diff 모드 */}
                {indep.aiDiffOpen && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs2 text-gray-500 font-semibold">버전을 선택하세요</p>
                    <div onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiDiffSel: 'current' } : c))}
                      className={clsx('rounded border-2 p-2 cursor-pointer transition-all', indep.aiDiffSel === 'current' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 opacity-60 hover:opacity-80')}>
                      <p className="text-xs2 text-gray-400 mb-0.5 font-medium">현재 버전</p>
                      <p className="text-xs2 text-gray-600 line-clamp-2">{indep.text}</p>
                    </div>
                    <div
                      className={clsx('rounded border-2 transition-all', indep.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-50' : 'border-blue-200 hover:border-blue-400')}
                      onClick={() => setCands(p => p.map(c => c.id === indep.id ? { ...c, aiDiffSel: 'proposed' } : c))}>
                      <div className="flex items-center gap-1.5 px-2 pt-1.5 mb-0.5">
                        <p className="text-xs2 font-bold text-blue-700">변경 버전</p>
                        <span className="text-xs2 px-1 rounded bg-blue-100 text-blue-600 font-semibold">수정됨</span>
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
                          AI로 추가 수정
                        </button>
                      </div>
                    </div>
                    <button onClick={() => applyIndepDiff(indep.id)}
                      className="w-full py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1">선택 완료 →</button>
                  </div>
                )}
              </div>

              {/* 종속항 섹션 */}
              <div className="p-2.5 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs2 font-semibold text-gray-500">
                    종속항 {grp.generated ? `(${grp.items.filter(d => d.sel).length}개 선택)` : ''}
                  </span>
                  {!done && !grp.generated && (
                    <button onClick={() => generateDeps(indep.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 text-white rounded-md text-xs2 font-semibold hover:bg-violet-700 active:scale-[0.98] transition-all">
                      <span className="font-bold text-xs2">AI</span> 종속항 생성
                    </button>
                  )}
                </div>

                {!grp.generated ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-3 text-center">
                    <p className="text-xs2 text-gray-400 mb-2">독립항을 기반으로 종속항을 자동 생성합니다</p>
                    <button onClick={() => generateDeps(indep.id)}
                      className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-xs2 font-semibold hover:bg-violet-700">
                      AI 종속항 생성
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
                              청구항 {depNum ?? '—'}
                            </span>
                            <span className="text-xs2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0 text-[10px]">
                              종속(→{indepClaimNum})
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
                              {/* 종속항도 DescriptionPanel 동일 3모드 패턴 */}
                              <>
                                  {/* 일반 모드: textarea + AI로 수정하기 */}
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
                                            AI로 수정하기
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {/* 프롬프트 모드 */}
                                  {dep.aiOpen && !dep.aiDiffOpen && (
                                    <>
                                      <div className="rounded border p-2.5 bg-gray-50 mb-2">
                                        <p className="text-xs2 font-medium text-gray-400 mb-0.5">현재 내용</p>
                                        <p className="text-xs2 text-gray-700 leading-relaxed">{dep.text}</p>
                                      </div>
                                      <div className="rounded border border-violet-300 bg-violet-50 p-2.5">
                                        <p className="text-xs2 text-violet-700 font-semibold mb-1.5 flex items-center gap-1">
                                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                            <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                                            <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                                          </svg>
                                          어떻게 수정할까요?
                                        </p>
                                        <textarea autoFocus
                                          className="w-full text-xs2 bg-white border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                                          placeholder="예: 더 구체적으로 / 청구범위 넓게"
                                          value={dep.aiPromptVal} rows={2}
                                          onChange={e => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiPromptVal: e.target.value } : d) })}
                                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); regenDep(indep.id, dep.id); } }}
                                        />
                                        <div className="flex gap-1.5 mt-1.5 justify-end">
                                          <button onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiOpen: false } : d) })}
                                            className="btn-outline btn-xs text-xs2">취소</button>
                                          <button onClick={() => regenDep(indep.id, dep.id)} disabled={!dep.aiPromptVal.trim()}
                                            className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                                            수정 생성
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  {/* 종속항 diff 모드 */}
                                  {dep.aiDiffOpen && (
                                    <div className="mt-2 space-y-1.5">
                                      <p className="text-xs2 text-gray-500 font-semibold">버전을 선택하세요</p>
                                      <div onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiDiffSel: 'current' } : d) })}
                                        className={clsx('rounded border-2 p-2 cursor-pointer', dep.aiDiffSel === 'current' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 opacity-60 hover:opacity-80')}>
                                        <p className="text-xs2 text-gray-400 mb-0.5 font-medium">현재 버전</p>
                                        <p className="text-xs2 text-gray-600 line-clamp-2">{dep.text}</p>
                                      </div>
                                      <div
                                        className={clsx('rounded border-2 transition-all', dep.aiDiffSel === 'proposed' ? 'border-blue-600 bg-blue-50' : 'border-blue-200 hover:border-blue-400')}
                                        onClick={() => updateDepGroup(indep.id, { items: grp.items.map(d => d.id === dep.id ? { ...d, aiDiffSel: 'proposed' } : d) })}>
                                        <div className="flex items-center gap-1.5 px-2 pt-1.5 mb-0.5">
                                          <p className="text-xs2 font-bold text-blue-700">변경 버전</p>
                                          <span className="text-xs2 px-1 rounded bg-blue-100 text-blue-600 font-semibold">수정됨</span>
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
                                            AI로 추가 수정
                                          </button>
                                        </div>
                                      </div>
                                      <button onClick={() => applyDepDiff(indep.id, dep.id)}
                                        className="w-full py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1">선택 완료 →</button>
                                    </div>
                                  )}
                              </>
                            </div>
                          )}
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
    key: 'solution', label: '과제해결수단',
    text: '상기 과제를 해결하기 위해, 본 발명은 라이다 센서로부터 3차원 포인트 클라우드 데이터를 수신하는 데이터 수신부; 상기 포인트 클라우드 데이터에서 RANSAC 알고리즘을 이용하여 지면 포인트를 분리하고 노이즈를 제거하는 전처리부; 전처리된 포인트 클라우드를 기둥(pillar) 단위로 구성하여 2D 의사 이미지를 생성하고, PointNet++ 기반 딥러닝 모델을 이용하여 객체를 인식하는 인식부를 포함하는 라이다 기반 객체 인식 장치를 제공한다.',
  },
];

// 발명의 설명 패널 — 1개 생성 + view/edit/prompt/diff 모드
function DescriptionPanel({ onUpdate, onModeChange, promptTrigger, onSubInfoChange }: {
  done: boolean; onConfirm: () => void; onUpdate: (v: string) => void;
  onModeChange?: (mode: string) => void;
  promptTrigger?: number;
  onSubInfoChange?: (info: { subStep: number; currentLabel: string; allDone: boolean; doConfirm: (() => void) | null }) => void;
}) {
  const [subStep, setSubStep] = useState(0);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(DESC_SECTIONS.map(s => [s.key, s.text]))
  );
  const [mode, _setMode] = useState<'view' | 'edit' | 'prompt' | 'diff'>('view');
  const setMode = (m: 'view' | 'edit' | 'prompt' | 'diff') => { _setMode(m); onModeChange?.(m); };
  const [promptVal, setPromptVal] = useState('');
  const [proposed, setProposed] = useState('');
  const [diffSel, setDiffSel] = useState<'current' | 'proposed'>('proposed');
  // 프롬프트 수정의 기준 텍스트: 'current'(원본) | 'proposed'(변경 버전)
  const [promptBase, setPromptBase] = useState<'current' | 'proposed'>('current');

  // 하단 바의 "다시 수정 요청" → 변경 버전 기반으로 프롬프트 모드 진입
  const prevTrigger = useRef(0);
  useEffect(() => {
    if (promptTrigger && promptTrigger !== prevTrigger.current) {
      prevTrigger.current = promptTrigger;
      // 이미 proposed가 있으면(diff 모드에서 온 경우) 변경 버전 기반으로 수정
      setPromptBase(proposed ? 'proposed' : 'current');
      setMode('prompt');
    }
  }, [promptTrigger]);

  // subStep이 범위를 벗어나지 않도록 클램핑
  const safeSubStep = Math.min(subStep, DESC_SECTIONS.length - 1);
  const sec = DESC_SECTIONS[safeSubStep];
  const curText = texts[sec?.key] || sec?.text || '';
  const isDone = !!confirmed[sec?.key];
  const allDone = DESC_SECTIONS.every(s => confirmed[s.key]);

  // 부모(GuidePanel)에 현재 상태 전달
  useEffect(() => {
    onSubInfoChange?.({
      subStep: safeSubStep,
      currentLabel: sec?.label || '',
      allDone,
      doConfirm: isDone ? null : () => {
        const next = { ...confirmed, [sec.key]: curText };
        setConfirmed(next);
        onUpdate(DESC_SECTIONS.map(s => `【${s.label}】\n${next[s.key] || s.text}`).join('\n\n'));
        setMode('view');
        if (safeSubStep < DESC_SECTIONS.length - 1) setSubStep(p => Math.min(p + 1, DESC_SECTIONS.length - 1));
      },
    });
  }, [safeSubStep, allDone, isDone, curText]);

  const submitPrompt = () => {
    if (!promptVal.trim()) return;
    // 수정 기준: 'proposed'면 변경 버전 기반, 'current'면 현재 텍스트 기반
    const baseText = promptBase === 'proposed' && proposed ? proposed : curText;
    const mock = baseText.replace(/이다\.$/, `이다 (${promptVal.slice(0, 20)} 반영).`);
    setProposed(mock);
    setDiffSel('proposed'); // 기본으로 변경 버전 선택
    setMode('diff');
    setPromptVal('');
  };

  if (!sec) return null;

  return (
    <>
      {/* 현재 섹션 표시 (스텝바 없이 섹션명만) */}
      {/* 섹션 탭 네비게이션 — 확정 섹션 클릭으로 재방문 가능 */}
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
        {isDone && <p className="text-xs2 text-green-600 mt-1 flex items-center gap-1"><Icon name="check" size={9} /> 확정됨</p>}
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-2 ml-1.5 space-y-2">

        {/* 이전 섹션 히스토리 — 확정된 섹션들을 현재 섹션 위에 표시 */}
        {DESC_SECTIONS.slice(0, safeSubStep).filter(s => confirmed[s.key]).map(s => (
          <div key={s.key} className="rounded-lg border border-green-200 bg-green-50/60 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="check" size={10} className="text-green-600 shrink-0" />
              <span className="text-xs2 font-bold text-green-700">{s.label}</span>
            </div>
            <p className="text-xs2 text-gray-600 leading-relaxed line-clamp-2">{texts[s.key] || s.text}</p>
          </div>
        ))}

        {/* VIEW 모드 — 텍스트 바로 편집 가능 (편집 버튼 불필요) */}
        {(mode === 'view' || mode === 'edit') && (
          <div className={clsx('rounded-lg border-2 transition-all',
            isDone ? 'border-green-300 bg-green-50' : 'border-ck-border bg-ck-bg focus-within:border-blue-400')}>

            {/* 텍스트 직접 편집 영역 */}
            {!isDone ? (
              <>
                <textarea
                  className="w-full text-xs2 text-gray-800 bg-transparent px-3 py-3 outline-none resize-none leading-relaxed rounded-t-lg overflow-hidden"
                  value={curText}
                  rows={Math.max(4, Math.ceil(curText.length / 40))}
                  placeholder="텍스트를 직접 입력하거나 수정하세요..."
                  onChange={e => {
                    setTexts(p => ({ ...p, [sec.key]: e.target.value }));
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                />
                {/* 수정 요청 버튼 (텍스트 아래) */}
                <div className="flex justify-end px-3 pb-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => { setPromptBase('current'); setMode('prompt'); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs2 text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                    </svg>
                    AI로 수정하기
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

        {/* PROMPT 모드 */}
        {mode === 'prompt' && (
          <>
            {/* 수정 기준 텍스트 표시 */}
            <div className={clsx('rounded-lg border p-3',
              promptBase === 'proposed' && proposed
                ? 'border-blue-200 bg-blue-50'
                : 'border-gray-200 bg-gray-50')}>
              <p className="text-xs2 font-medium mb-1 flex items-center gap-1.5"
                style={{ color: promptBase === 'proposed' && proposed ? '#1d4ed8' : '#9ca3af' }}>
                {promptBase === 'proposed' && proposed ? (
                  <><span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs2 font-semibold">변경 버전 기반</span> 이 내용을 수정합니다</>
                ) : '현재 내용'}
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
                어떻게 수정할까요?
              </p>
              <textarea autoFocus
                className="w-full text-xs2 bg-white border border-violet-200 rounded px-2 py-1.5 outline-none resize-none"
                placeholder="예: 더 간결하게 / 특허 문체로 / 청구범위와 연결되도록 / 더 구체적으로"
                value={promptVal} rows={3}
                onChange={e => setPromptVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPrompt(); } }}
              />
              <div className="flex gap-1.5 mt-2 justify-end">
                <button onClick={() => setMode('view')} className="btn-outline btn-xs text-xs2">취소</button>
                <button onClick={submitPrompt} disabled={!promptVal.trim()}
                  className="px-3 py-1 bg-violet-600 text-white rounded text-xs2 font-semibold hover:bg-violet-700 disabled:opacity-40">
                  수정 생성
                </button>
              </div>
            </div>
          </>
        )}

        {/* 버전 선택 모드 */}
        {mode === 'diff' && (
          <>
            <p className="text-xs2 text-gray-600 font-semibold mb-2">버전을 선택하세요</p>

            {/* 현재 버전 — 작고 회색, 비활성 느낌 */}
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
                <span className="text-xs2 font-medium text-gray-500">현재 버전 유지</span>
              </div>
              <p className="text-xs2 text-gray-400 leading-relaxed line-clamp-3">{curText}</p>
            </div>

            {/* 변경 버전 — 편집 가능 + AI 추가 수정 지원 */}
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
                <span className="text-xs2 font-bold text-blue-700">변경 버전 채택</span>
                <span className="ml-auto text-xs2 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">수정됨</span>
              </div>
              {/* 직접 편집 가능 textarea */}
              <textarea
                className={clsx(
                  'w-full text-xs2 leading-relaxed bg-transparent px-3 pb-2 outline-none resize-none',
                  diffSel === 'proposed' ? 'text-gray-800 font-medium' : 'text-gray-600',
                )}
                value={proposed}
                rows={Math.max(3, Math.ceil(proposed.length / 45))}
                onClick={e => { e.stopPropagation(); setDiffSel('proposed'); }}
                onChange={e => setProposed(e.target.value)}
                placeholder="AI 생성 내용을 직접 수정할 수 있습니다..."
              />
              {/* AI 추가 수정 버튼 */}
              <div className="px-3 pb-2 pt-1 border-t border-blue-100" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { setPromptBase('proposed'); setMode('prompt'); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs2 text-violet-600 hover:bg-violet-50 transition-colors"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                    <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                    <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                  </svg>
                  AI로 추가 수정하기
                </button>
              </div>
            </div>

            {/* 단일 CTA: 선택 완료 */}
            <button
              onClick={() => {
                const newText = diffSel === 'proposed' ? proposed : curText;
                if (diffSel === 'proposed') setTexts(p => ({ ...p, [sec.key]: newText }));
                setMode('view'); setProposed(''); setDiffSel('proposed');
                // 이미 확정된 섹션이면 새 텍스트로 재확정 → doConfirm이 null이 되는 문제 방지
                if (isDone) {
                  const next = { ...confirmed, [sec.key]: newText };
                  setConfirmed(next);
                  onUpdate(DESC_SECTIONS.map(s => `【${s.label}】\n${next[s.key] || s.text}`).join('\n\n'));
                }
              }}
              className="w-full py-2 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 mt-1"
            >
              선택 완료 →
            </button>
          </>
        )}
      </div>

      {/* 내부 확정 버튼 제거 — 하단 바(GuidePanel)에서 통합 처리 */}
      {allDone && (
        <div className="px-3 py-2 border-t border-ck-border bg-green-50 shrink-0 ml-1.5">
          <div className="flex items-center gap-1.5 text-xs2 text-green-700 font-medium">
            <Icon name="check" size={11} /> 4개 섹션 모두 확정됨 — 하단 버튼으로 다음 단계 진행
          </div>
        </div>
      )}
    </>
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

function AbstractPanel({ done, onUpdate }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editVals, setEditVals] = useState<Record<number, string>>({});

  const getVal = (i: number) => editVals[i] ?? ABSTRACT_CANDS[i].text;

  return (
    <>
      {/* 안내 배너 */}
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
                <span className="text-xs2 text-gray-400">{cand.charCount}자</span>
                {!done && (
                  <div className="ml-auto flex gap-1">
                    <button onClick={e => e.stopPropagation()} title="AI로 다시 생성" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); setSelectedIdx(i); }} title="직접 수정" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400">
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

