// SpecView
import { useEffect, useRef, useState } from 'react';
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

  const [mainView, setMainView] = useState<'analysis' | 'editor'>('analysis');
  const [guideOpen, setGuideOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
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

  const flowRef = useRef<HTMLDivElement>(null);
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
                  {isDone ? <Icon name="check" size={10} /> : s.num}
                </span>
                {/* step-label */}
                <span className={clsx(
                  'text-sm2',
                  active && 'text-blue-700 font-semibold',
                  isDone && !active && 'text-green-700',
                  locked && 'text-gray-400',
                  !active && !isDone && !locked && 'text-gray-500',
                )}>{s.short}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div ref={flowRef} className="flex-1 overflow-y-auto scroll-thin bg-ck-bg">
          <div className="max-w-3xl mx-auto py-8 px-4 space-y-3">

            {/* 업로드 존 — 원본 동일: flow/done 이후에도 계속 표시 (스크롤 방식) */}
            {phase !== 'flow' && phase !== 'done' && (
              <div className="text-center py-4">
                <Icon name="doc" size={48} className="text-blue-700 mx-auto mb-3" />
                <h2 className="text-lg2 font-bold text-gray-800 mb-2">새 특허 명세서 작성</h2>
                <p className="text-md2 text-gray-500 mb-6">발명 관련 파일을 업로드하거나, 기초 내용을 직접 입력하세요.</p>
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
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-gray-200" /><span className="text-sm2 text-gray-400">또는</span><div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <button onClick={() => setPhase('direct')} className="btn-outline"><Icon name="edit" size={14} /> 기초 내용 직접 입력</button>
                  </>
                )}
              </div>
            )}

            {/* 직접입력 폼 — 원본: AI 분석 시작 후에도 계속 표시 (필드 잠금) */}
            {(phase === 'direct' || ((phase === 'flow' || phase === 'done') && diTitle.trim())) && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50">
                  <Icon name="edit" size={20} className="text-blue-700" />
                  <div><h3 className="text-base2 font-semibold text-gray-800">발명 기초 내용 입력</h3><p className="text-sm2 text-gray-500">아래 항목을 입력하면 AI가 명세서 항목을 분석합니다.</p></div>
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
                    <button className="btn-outline btn-sm" onClick={() => setPhase('upload')}>취소</button>
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
                      {isDone && (
                        <>
                          <div className="flex items-start gap-3 flex-row-reverse">
                            <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs2 font-bold flex items-center justify-center shrink-0">나</div>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 max-w-2xl shadow-xs">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><Icon name="check" size={10} /></span>
                                <span className="text-sm2 font-semibold text-blue-700">{CONFIRM_LABEL[s.id]}</span>
                              </div>
                              <div className="bg-white rounded-lg border border-blue-100 p-3 mb-2">
                                {/* 발명의 설명: 섹션별 구조화 표시 */}
                                {s.id === 'description' ? (
                                  <div className="space-y-2">
                                    {(confirmed[s.id] || '').split('\n\n').filter(Boolean).map((block, bi) => {
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
                                ) : (
                                  <p className="text-sm2 text-gray-700 leading-relaxed">{confirmed[s.id]}</p>
                                )}
                              </div>
                              <button onClick={() => reselect(s.id)} className="text-xs2 text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                <Icon name="chevron-left" size={10} /> 다시 선택
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
                    <h3 className="text-lg2 font-bold text-gray-800 mb-2">모든 분석이 완료되었습니다</h3>
                    <p className="text-md2 text-gray-500 mb-4">확정된 내용을 바탕으로 특허 명세서를 AI가 생성합니다.</p>
                    <div className="inline-flex flex-col gap-1.5 text-left mb-5 bg-gray-50 rounded-lg p-3">
                      {(['title', 'description', 'components', 'drawings', 'claims'] as StepId[]).map(k => (
                        <div key={k} className="flex items-center gap-2 text-sm2">
                          <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center',
                            isConfirmed(k) ? 'bg-green-500 text-white' : 'bg-gray-300')}>
                            {isConfirmed(k) ? <Icon name="check" size={10} /> : null}
                          </span>
                          <span className={isConfirmed(k) ? 'text-gray-700' : 'text-gray-400'}>{STEP_LABEL[k]} 확정</span>
                        </div>
                      ))}
                    </div>
                    <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '15px' }}
                      onClick={() => setMainView('editor')} disabled={doneCount < 5}>
                      <Icon name="star" size={16} /> 명세서 AI 생성
                    </button>
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
              if (idx > 1) setGuideStep(STEPS[idx - 1].id);
            }}
            hasPrev={STEPS.findIndex(s => s.id === guideStep) > 1}
          />
        )}
      </div>
      {mainView === 'editor' && <EditorView task={task} onBack={() => setMainView('analysis')} />}
      {previewOpen && <PreviewModal taskName={task?.name} onClose={() => setPreviewOpen(false)} />}
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

function GuidePanel({ step, gSel, setGSel, onConfirm, confirmed, onPrev, hasPrev }: {
  step: StepId;
  gSel: Partial<Record<StepId, string>>;
  setGSel: React.Dispatch<React.SetStateAction<Partial<Record<StepId, string>>>>;
  onConfirm: (id: StepId) => void;
  confirmed: Partial<Record<StepId, string>>;
  onPrev: () => void;
  hasPrev: boolean;
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
  const [descPromptTrigger, setDescPromptTrigger] = useState(0);
  // description 패널의 현재 섹션 상태 (GuidePanel 하단 버튼 제어용)
  const [descSubInfo, setDescSubInfo] = useState<{
    subStep: number; currentLabel: string; allDone: boolean; doConfirm: (() => void) | null;
  }>({ subStep: 0, currentLabel: '기술분야', allDone: false, doConfirm: null });

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
    // 특수 단계(description/components/drawings/claims/abstract)는 gSel 값과 무관하게 항상 확정
    if (isSpecial) {
      const specialVal = gSel[step] || '(확정)';
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
          <span className="text-base2 font-bold text-gray-800">{STEP_LABEL[step] || step}</span>
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
      {step === 'components' && <ComponentsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} />}
      {step === 'drawings' && <DrawingsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} />}
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

      {/* 하단 버튼 바 — description diff 모드에서는 다른 버튼 표시 */}
      <div className="flex gap-2 px-3 py-2.5 border-t border-ck-border bg-ck-bg shrink-0 ml-1.5">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-3 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          ← 이전
        </button>

        {/* description 패널 diff 모드: "다시 수정 요청" 표시, "선택 확인 →" 숨김 */}
        {step === 'description' && descMode === 'diff' ? (
          <button
            onClick={() => setDescPromptTrigger(t => t + 1)}
            className="flex-1 py-1.5 border border-violet-300 text-violet-600 rounded text-xs2 font-semibold hover:bg-violet-50 flex items-center justify-center gap-1"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
              <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
              <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
            </svg>
            다시 수정 요청
          </button>
        ) : (
          <button
            className="flex-1 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
              <path d="M2 8a6 6 0 0 1 10.3-4.1L14 2v4h-4"/>
              <path d="M14 8a6 6 0 0 1-10.3 4.1L2 14v-4h4"/>
            </svg>
            프롬프트 재생성
          </button>
        )}

        {/* description diff 모드에서 확인 버튼 숨김 */}
        {!(step === 'description' && descMode === 'diff') && (
          !isDone ? (
            step === 'description' ? (
              // description: 섹션별 단계 확정 (단일 CTA)
              descSubInfo.allDone ? (
                // 모든 섹션 완료 → 다음 단계(구성요소)로
                <button onClick={handleConfirm}
                  className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800">
                  발명의 설명 완료 →
                </button>
              ) : (
                // 현재 섹션 확정
                <button
                  onClick={() => descSubInfo.doConfirm?.()}
                  disabled={descMode === 'prompt' || descMode === 'diff'}
                  className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {descSubInfo.currentLabel} 확정 →
                </button>
              )
            ) : (
              <button
                onClick={handleConfirm}
                disabled={!isSpecial && !curSel.trim()}
                className="flex-1 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                선택 확인 →
              </button>
            )
          ) : (
            <button className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs2 font-semibold cursor-default">
              <Icon name="check" size={10} /> 확정 완료
            </button>
          )
        )}
      </div>
    </aside>
  );
}

// 구성요소 패널 (#20)
interface CompItem { id: number; text: string; sel: boolean }
const INIT_COMPS: CompItem[] = [
  { id: 1, text: '데이터 수집부: 라이다 센서로부터 3D 포인트 클라우드 데이터를 수집', sel: true },
  { id: 2, text: '전처리부: 노이즈 제거 및 다운샘플링을 통해 데이터 전처리 수행', sel: true },
  { id: 3, text: '특징 추출부: PointNet++ 아키텍처를 적용하여 포인트 특징 추출', sel: true },
  { id: 4, text: '인식부: 딥러닝 모델을 이용하여 객체 분류 및 위치 추정', sel: true },
  { id: 5, text: '출력부: 인식된 객체의 3D 위치, 크기, 종류를 출력', sel: true },
];

function ComponentsPanel({ done, onConfirm, onUpdate }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void }) {
  const [items, setItems] = useState<CompItem[]>(INIT_COMPS);
  const [newText, setNewText] = useState('');

  const upd = (next: CompItem[]) => {
    setItems(next);
    let n = 0; onUpdate(next.filter(it => it.sel).map(it => `(${++n * 10}) ${it.text}`).join('\n'));
  };
  const toggle = (id: number) => { if (!done) upd(items.map(it => it.id === id ? { ...it, sel: !it.sel } : it)); };
  const moveUp = (i: number) => { if (i > 0 && !done) { const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; upd(a); } };
  const moveDown = (i: number) => { if (i < items.length - 1 && !done) { const a = [...items]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; upd(a); } };
  const remove = (id: number) => { if (!done) upd(items.filter(it => it.id !== id)); };
  const add = () => { if (!newText.trim() || done) return; upd([...items, { id: Date.now(), text: newText.trim(), sel: true }]); setNewText(''); };

  const sel = items.filter(it => it.sel);
  let autoN = 0;

  return (
    <>
      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs2 font-semibold text-gray-600">AI 추출 구성요소</span>
          <span className="text-xs2 text-gray-400">번호 자동 부여</span>
        </div>
        {items.map((item, idx) => {
          const num = item.sel ? (autoN += 10) : null;
          return (
            <div key={item.id} className={clsx('flex items-start gap-1.5 rounded-lg border p-2 transition-all',
              item.sel && !done ? 'border-blue-300 bg-blue-50' : '',
              !item.sel ? 'border-gray-200 bg-gray-50 opacity-60' : '',
              done && item.sel ? 'border-green-200 bg-green-50' : '')}>
              <span className={clsx('w-9 text-xs2 font-bold rounded px-1 py-0.5 shrink-0 mt-0.5 text-center',
                item.sel ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-400')}>
                {num ? `(${num})` : '—'}
              </span>
              <span className="text-xs2 text-gray-700 flex-1 leading-relaxed break-words">{item.text}</span>
              {!done && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><Icon name="chevron-left" size={10} className="rotate-90" /></button>
                  <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><Icon name="chevron-right" size={10} className="rotate-90" /></button>
                  <button onClick={() => toggle(item.id)} className="text-gray-400 hover:text-amber-600 p-0.5"><Icon name="check" size={10} /></button>
                  <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-red-500 p-0.5"><Icon name="close" size={10} /></button>
                </div>
              )}
            </div>
          );
        })}
        {!done && (
          <div className="flex gap-1 mt-2">
            <input className="input text-xs2 py-1.5 flex-1" placeholder="새 구성요소 추가..." value={newText}
              onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
            <button onClick={add} className="btn-outline btn-xs px-2"><Icon name="plus" size={12} /></button>
          </div>
        )}
      </div>
      {!done ? (
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button onClick={onConfirm} className="btn-primary w-full btn-sm" disabled={sel.length === 0}>
            <Icon name="check" size={12} /> 구성요소 확정 ({sel.length}개)
          </button>
        </div>
      ) : (
        <div className="p-3 border-t border-gray-100 bg-green-50 shrink-0">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium"><Icon name="check" size={13} /> 구성요소 확정 완료</div>
        </div>
      )}
    </>
  );
}

// 도면 패널 (#21)
interface DrawItem { id: number; label: string; desc: string; sel: boolean }
const INIT_DRAWS: DrawItem[] = [
  { id: 1, label: 'FIG.1', desc: '전체 시스템 구성도', sel: true },
  { id: 2, label: 'FIG.2', desc: 'LiDAR 센서 배치 및 수집 방식', sel: true },
  { id: 3, label: 'FIG.3', desc: '전처리부 노이즈 제거 흐름도', sel: true },
  { id: 4, label: 'FIG.4', desc: 'PointNet++ 특징 추출 구조도', sel: true },
  { id: 5, label: 'FIG.5', desc: '객체 인식 결과 화면', sel: false },
];

function DrawingsPanel({ done, onConfirm, onUpdate }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void }) {
  const [draws, setDraws] = useState<DrawItem[]>(INIT_DRAWS);
  const [activeId, setActiveId] = useState(1);

  const upd = (next: DrawItem[]) => { setDraws(next); onUpdate(next.filter(d => d.sel).map(d => `${d.label}: ${d.desc}`).join('\n')); };
  const toggle = (id: number) => { if (!done) upd(draws.map(d => d.id === id ? { ...d, sel: !d.sel } : d)); };
  const activeD = draws.find(d => d.id === activeId);
  const selCount = draws.filter(d => d.sel).length;

  return (
    <>
      <div className="flex-1 overflow-y-auto scroll-thin p-3">
        <div className="mb-2"><span className="text-xs2 font-semibold text-gray-600">도면 후보 ({selCount}개 선택)</span></div>
        {/* 썸네일 스트립 */}
        <div className="flex gap-2 overflow-x-auto scroll-thin pb-2 mb-3">
          {draws.map(d => (
            <div key={d.id} onClick={() => setActiveId(d.id)}
              className={clsx('shrink-0 w-16 rounded-lg border-2 cursor-pointer transition-all',
                activeId === d.id ? 'border-blue-500' : 'border-gray-200 hover:border-gray-400',
                !d.sel && 'opacity-40')}>
              <div className="bg-gray-100 rounded-t aspect-square flex items-center justify-center">
                <span className="text-xs2 text-gray-400 font-medium">{d.label}</span>
              </div>
              <div className="px-1 py-0.5 text-center">
                <span className={clsx('text-xs2 font-medium', activeId === d.id ? 'text-blue-700' : 'text-gray-500')}>{d.label}</span>
              </div>
            </div>
          ))}
        </div>
        {activeD && (
          <div className="card p-3 mb-3">
            <div className="bg-gray-100 rounded-lg h-28 flex items-center justify-center mb-2 border border-gray-200">
              <div className="text-center">
                <div className="text-gray-300 text-lg2 font-bold mb-1">{activeD.label}</div>
                <Icon name="image" size={24} className="text-gray-300 mx-auto" />
              </div>
            </div>
            <p className="text-xs2 font-semibold text-gray-700 mb-1">{activeD.label}</p>
            <p className="text-xs2 text-gray-500 mb-2">{activeD.desc}</p>
            {!done && <button onClick={() => toggle(activeD.id)}
              className={clsx('btn-xs w-full', activeD.sel ? 'btn-outline text-red-500 hover:border-red-400' : 'btn-primary')}>
              {activeD.sel ? '제외' : '포함'}
            </button>}
          </div>
        )}
        <div className="space-y-1">
          {draws.map(d => (
            <div key={d.id} onClick={() => setActiveId(d.id)}
              className={clsx('flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer transition-all',
                d.sel && !done ? 'border-blue-200 bg-blue-50' : '',
                !d.sel ? 'border-gray-200 opacity-50' : '',
                done && d.sel ? 'border-green-200 bg-green-50' : '')}>
              <span className={clsx('w-4 h-4 rounded flex items-center justify-center shrink-0', d.sel ? 'bg-blue-600 text-white' : 'bg-gray-200')}>
                {d.sel && <Icon name="check" size={10} />}
              </span>
              <span className="text-xs2 font-medium text-gray-600 w-10 shrink-0">{d.label}</span>
              <span className="text-xs2 text-gray-500 flex-1 truncate">{d.desc}</span>
              {!done && <button onClick={e => { e.stopPropagation(); toggle(d.id); }} className="text-gray-300 hover:text-red-400 shrink-0"><Icon name="close" size={10} /></button>}
            </div>
          ))}
        </div>
      </div>
      {!done ? (
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button onClick={onConfirm} className="btn-primary w-full btn-sm" disabled={selCount === 0}>
            <Icon name="check" size={12} /> 도면 확정 ({selCount}개)
          </button>
        </div>
      ) : (
        <div className="p-3 border-t border-gray-100 bg-green-50 shrink-0">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium"><Icon name="check" size={13} /> 도면 확정 완료</div>
        </div>
      )}
    </>
  );
}

// 청구항 패널 (#22)
interface ClaimItem { id: number; type: 'independent' | 'dependent'; refId?: number; text: string; sel: boolean }
const INIT_CLAIMS: ClaimItem[] = [
  { id: 1, type: 'independent', text: '라이다 센서로부터 3차원 포인트 클라우드 데이터를 획득하는 데이터 수집부; 딥러닝 모델을 적용하여 객체를 분류하는 인식부를 포함하는, 라이다 기반 객체 감지 장치.', sel: true },
  { id: 2, type: 'dependent', refId: 1, text: '제1항에 있어서, 상기 인식부는 PointNet++ 아키텍처를 포함하는, 라이다 기반 객체 감지 장치.', sel: true },
  { id: 3, type: 'dependent', refId: 1, text: '제1항에 있어서, 상기 데이터 수집부는 복수의 라이다 센서를 포함하는, 라이다 기반 객체 감지 장치.', sel: false },
  { id: 4, type: 'independent', text: '라이다 센서로부터 포인트 클라우드 데이터를 획득하는 단계; 딥러닝 모델을 이용하여 객체를 분류하는 단계를 포함하는, 라이다 기반 객체 감지 방법.', sel: true },
];

function ClaimsPanel({ done, onConfirm, onUpdate }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void }) {
  const [claims, setClaims] = useState<ClaimItem[]>(INIT_CLAIMS);
  const [expId, setExpId] = useState<number | null>(1);

  const upd = (next: ClaimItem[]) => {
    setClaims(next);
    let n = 0; onUpdate(next.filter(c => c.sel).map(c => `청구항 ${++n}.\n${c.text}`).join('\n\n'));
  };
  const toggle = (id: number) => { if (!done) upd(claims.map(c => c.id === id ? { ...c, sel: !c.sel } : c)); };
  let autoN = 0;
  const numbered = claims.map(c => ({ ...c, num: c.sel ? ++autoN : null }));
  const selCount = claims.filter(c => c.sel).length;

  return (
    <>
      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs2 font-semibold text-gray-600">청구항 ({selCount}개 선택)</span>
          <span className="text-xs2 text-gray-400">독립항 {claims.filter(c => c.type === 'independent' && c.sel).length}개</span>
        </div>
        {numbered.map(claim => (
          <div key={claim.id} className={clsx('rounded-lg border transition-all',
            claim.sel && !done ? 'border-blue-300' : '',
            !claim.sel ? 'border-gray-200 opacity-50' : '',
            done && claim.sel ? 'border-green-200' : '')}>
            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpId(expId === claim.id ? null : claim.id)}>
              <span className={clsx('w-5 h-5 rounded flex items-center justify-center shrink-0',
                claim.sel ? 'bg-blue-600 text-white' : 'bg-gray-200')}>
                {claim.sel && <Icon name="check" size={9} />}
              </span>
              <span className={clsx('text-xs2 font-bold shrink-0', claim.num ? 'text-blue-700' : 'text-gray-400')}>청구항 {claim.num ?? '—'}</span>
              <span className={clsx('text-xs2 px-1.5 py-0.5 rounded-full shrink-0',
                claim.type === 'independent' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700')}>
                {claim.type === 'independent' ? '독립항' : `종속(→${claim.refId})`}
              </span>
              {!done && <button onClick={e => { e.stopPropagation(); toggle(claim.id); }} className="ml-auto text-gray-300 hover:text-red-400"><Icon name="close" size={10} /></button>}
            </div>
            {expId === claim.id && (
              <div className="px-3 pb-2"><p className="text-xs2 text-gray-600 leading-relaxed border-t border-gray-100 pt-2">{claim.text}</p></div>
            )}
          </div>
        ))}
        {!done && (
          <button className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-xs2 text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors">
            + 청구항 추가
          </button>
        )}
      </div>
      {!done ? (
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button onClick={onConfirm} className="btn-primary w-full btn-sm" disabled={selCount === 0}>
            <Icon name="check" size={12} /> 청구항 확정 ({selCount}개)
          </button>
        </div>
      ) : (
        <div className="p-3 border-t border-gray-100 bg-green-50 shrink-0">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium"><Icon name="check" size={13} /> 청구항 확정 완료</div>
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
      {/* 진행 표시 */}
      <div className="mx-3 mt-3 mb-2 shrink-0">
        <div className="flex items-center gap-1 mb-2">
          {DESC_SECTIONS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <button
                onClick={() => i <= subStep && setSubStep(i)}
                className={clsx('w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center border-2 transition-all',
                  confirmed[s.key] ? 'bg-green-500 border-green-500 text-white' :
                  i === subStep ? 'bg-blue-700 border-blue-700 text-white' :
                  'bg-white border-gray-300 text-gray-400')}
              >
                {confirmed[s.key] ? <Icon name="check" size={9} /> : i + 1}
              </button>
              {i < DESC_SECTIONS.length - 1 && (
                <div className={clsx('h-0.5 w-3', confirmed[s.key] ? 'bg-green-400' : 'bg-gray-200')} />
              )}
            </div>
          ))}
          <span className="text-xs2 text-gray-400 ml-1">{subStep + 1}/{DESC_SECTIONS.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm2 font-bold text-gray-800">{sec.label}</span>
          {sec.badge2 && <span className="text-xs2 text-gray-400">{sec.badge2}</span>}
          {isDone && <span className="ml-auto text-xs2 text-green-600 font-medium flex items-center gap-1"><Icon name="check" size={10} /> 확정됨</span>}
        </div>
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
              <p className="text-xs2 text-green-800 leading-relaxed px-3 py-3">{curText}</p>
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

            {/* 변경 버전 — 크고 파란색, 기본 선택, NEW 배지 */}
            <div
              onClick={() => setDiffSel('proposed')}
              className={clsx(
                'rounded-lg border-2 p-3 cursor-pointer transition-all',
                diffSel === 'proposed'
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-blue-200 bg-white hover:border-blue-400',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={clsx(
                  'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                  diffSel === 'proposed' ? 'border-blue-600 bg-blue-600' : 'border-blue-300 bg-white',
                )}>
                  {diffSel === 'proposed' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-xs2 font-bold text-blue-700">변경 버전 채택</span>
                <span className="ml-auto text-xs2 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">수정됨</span>
              </div>
              <p className={clsx(
                'text-xs2 leading-relaxed',
                diffSel === 'proposed' ? 'text-gray-800 font-medium' : 'text-gray-600',
              )}>{proposed}</p>
            </div>

            {/* 단일 CTA: 선택 완료 */}
            <button
              onClick={() => {
                if (diffSel === 'proposed') setTexts(p => ({ ...p, [sec.key]: proposed }));
                setMode('view'); setProposed(''); setDiffSel('proposed');
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
                    <button onClick={e => e.stopPropagation()} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
                      </svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); setSelectedIdx(i); }} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400">
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

// 명세서 편집기 뷰 (#23)
function EditorView({ task, onBack }: { task: any; onBack: () => void }) {
  const sections = [
    { id: 'tech', label: '기술분야' }, { id: 'bg', label: '배경기술' },
    { id: 'problem', label: '해결과제' }, { id: 'solution', label: '해결수단' },
    { id: 'effect', label: '효과' }, { id: 'claims', label: '청구범위' },
    { id: 'abstract', label: '요약서' },
  ];
  const [activeSection, setActiveSection] = useState('tech');
  const [assistTab, setAssistTab] = useState<'ai-suggest' | 'drawings' | 'refs'>('ai-suggest');
  const [selectedDrawing, setSelectedDrawing] = useState(0);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);

  const drawings = [
    { label: '도 1', desc: '전체 블록도', sub: '시스템 구성 개요' },
    { label: '도 2', desc: '전처리 흐름도', sub: '데이터 처리 과정' },
    { label: '도 3', desc: '네트워크 구조도', sub: 'PointNet++ 아키텍처' },
    { label: '도 4', desc: '인식 결과 화면', sub: '바운딩박스 시각화' },
  ];

  const suggestions: { title: string; body: string }[] = [
    { title: '해결수단 강화 제안', body: '현재 섹션의 "딥러닝 모델을 이용하여" 표현을 "PointNet++ 기반의 다층 신경망을 이용하여"로 구체화하면 특허 청구범위의 명확성이 향상됩니다.' },
    { title: '청구항 독립성 검토', body: '제1항의 독립항에서 구성요소(데이터 수집부, 전처리부, 인식부)가 기능적으로 연결되어 있는지 확인하세요. 상위 개념으로 기재하면 권리범위가 넓어집니다.' },
    { title: '유사 특허 3건 확인', body: 'KR10-2024-0123456, US11987654, JP2024-012345 특허가 유사 기술을 포함합니다. 차별점을 명시하여 거절 가능성을 줄이세요.' },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-white z-10">
      {/* 앵커 바 */}
      <div className="flex items-center gap-0 px-4 border-b border-gray-200 bg-white shrink-0 overflow-x-auto scroll-thin">
        <button onClick={onBack} className="flex items-center gap-1 text-sm2 text-blue-700 font-semibold mr-3 py-2.5 shrink-0">
          <Icon name="chevron-left" size={14} /> 분석 결과
        </button>
        <div className="w-px h-4 bg-gray-300 mr-3" />
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={clsx('px-3 py-2.5 text-md2 border-b-2 whitespace-nowrap',
              activeSection === s.id ? 'border-blue-700 text-blue-700 font-semibold' : 'border-transparent text-gray-500')}>
            {s.label}
          </button>
        ))}
        <button className="ml-auto flex items-center gap-1 text-md2 text-violet-600 font-medium py-2.5 whitespace-nowrap">
          <Icon name="grid" size={13} /> 청구항-도면 병행
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 좌측 레일 */}
        <div className="w-44 border-r border-gray-200 overflow-y-auto scroll-thin bg-gray-50 shrink-0 p-2 space-y-0.5">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={clsx('w-full text-left px-3 py-2 rounded-lg text-sm2 transition-colors',
                activeSection === s.id ? 'bg-blue-700 text-white font-semibold' : 'text-gray-600 hover:bg-gray-200')}>
              {s.label}
            </button>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-2 space-y-0.5">
            <button className="w-full text-left px-3 py-2 rounded-lg text-sm2 text-gray-600 hover:bg-gray-200">라이브러리</button>
            <button className="w-full text-left px-3 py-2 rounded-lg text-sm2 text-gray-600 hover:bg-gray-200">선행기술</button>
          </div>
        </div>

        {/* 중앙 에디터 */}
        <div className="flex-1 overflow-y-auto scroll-thin p-6 min-w-0">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-lg2 font-bold text-gray-800 mb-4">{sections.find(s => s.id === activeSection)?.label}</h3>
            <textarea className="input min-h-[400px] font-mono text-sm2 resize-y w-full"
              defaultValue={getDefault(activeSection, task)} />
          </div>
        </div>

        {/* 우측 AI 어시스트 패널 — 원본 artifact-editor-tabs 구조 */}
        <div className="w-72 border-l border-ck-border bg-white flex flex-col overflow-hidden shrink-0">
          {/* 헤더 */}
          <div className="px-3 py-2 border-b border-ck-border bg-gray-50 shrink-0">
            <p className="text-xs2 text-gray-500">에디터에서 텍스트를 선택하면 AI가 수정안을 제안합니다.</p>
          </div>
          {/* 탭 */}
          <div className="flex border-b border-ck-border shrink-0">
            {([['ai-suggest', 'AI 제안'], ['drawings', '도면 조회'], ['refs', '참고문헌']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setAssistTab(id)}
                className={clsx('flex-1 py-2 text-xs2 font-semibold border-b-2 transition-colors',
                  assistTab === id ? 'border-violet-600 text-violet-700 bg-violet-50' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                {label}
              </button>
            ))}
          </div>

          {/* 탭 본문 */}
          <div className="flex-1 overflow-y-auto scroll-thin">
            {/* AI 제안 탭 */}
            {assistTab === 'ai-suggest' && (
              <div className="p-3 space-y-2">
                {activeSuggestion === null ? (
                  <>
                    <div className="text-center py-4 text-gray-400">
                      <Icon name="logo" size={28} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-xs2">에디터에서 섹션을 선택하면<br />AI 수정 제안이 여기에 표시됩니다</p>
                    </div>
                    <div className="border-t border-gray-100 pt-2 space-y-1.5">
                      {suggestions.map((s, i) => (
                        <div key={i} onClick={() => setActiveSuggestion(s.body)}
                          className="rounded-lg border border-gray-200 p-2.5 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon name="star" size={10} className="text-violet-600 shrink-0" />
                            <span className="text-xs2 font-semibold text-gray-700">{s.title}</span>
                          </div>
                          <p className="text-xs2 text-gray-400 line-clamp-2">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-violet-300 bg-violet-50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon name="logo" size={12} className="text-violet-600" />
                      <span className="text-xs2 font-bold text-violet-700">AI 수정 제안</span>
                    </div>
                    <p className="text-xs2 text-gray-700 leading-relaxed mb-3">{activeSuggestion}</p>
                    <div className="flex gap-1.5">
                      <button className="btn-primary btn-xs flex-1 text-xs2">적용</button>
                      <button onClick={() => setActiveSuggestion(null)} className="btn-outline btn-xs text-xs2">무시</button>
                      <button onClick={() => setActiveSuggestion(suggestions[0].body)} className="btn-outline btn-xs text-xs2">재생성</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 도면 조회 탭 */}
            {assistTab === 'drawings' && (
              <div className="p-3">
                <p className="text-xs2 font-semibold text-gray-600 mb-2">도면 목록</p>
                <div className="space-y-1.5">
                  {drawings.map((d, i) => (
                    <div key={i} onClick={() => setSelectedDrawing(i)}
                      className={clsx('flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-all',
                        selectedDrawing === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                      <div className="w-12 h-9 bg-gray-100 rounded flex items-center justify-center shrink-0 border border-gray-200">
                        <Icon name="image" size={16} className="text-gray-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs2 font-semibold text-gray-800">{d.label} — {d.desc}</p>
                        <p className="text-xs2 text-gray-400">{d.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-primary w-full btn-xs mt-3 text-xs2">
                  <Icon name="image" size={11} /> 선택 도면 에디터에 삽입
                </button>
              </div>
            )}

            {/* 참고문헌 탭 */}
            {assistTab === 'refs' && (
              <div className="p-3 text-center py-6 text-gray-400">
                <Icon name="library" size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-xs2 mb-3">관련 선행기술/참고문헌을<br />검색하고 인용할 수 있습니다</p>
                <button className="btn-outline btn-xs">선행기술 검색</button>
              </div>
            )}
          </div>

          {/* 하단 액션 바 */}
          <div className="flex gap-2 p-2 border-t border-ck-border bg-ck-bg shrink-0">
            <button className="px-3 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50 whitespace-nowrap">
              ← 이전
            </button>
            <button className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs2 text-gray-500 hover:bg-gray-50">
              프롬프트 재생성
            </button>
            <button className="flex-1 px-2 py-1.5 bg-blue-700 text-white rounded text-xs2 font-semibold hover:bg-blue-800">
              선택 확인 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDefault(section: string, task: any): string {
  const name = task?.name || '새 명세서';
  const d: Record<string, string> = {
    tech: `본 발명은 ${name}에 관한 것으로, 특히 자율주행 차량에서 라이다 센서를 이용한 객체 감지 기술에 관한 것이다.`,
    bg: '종래 기술에서는 카메라만을 이용한 2D 객체 감지 방식이 주로 사용되었으나, 이는 야간이나 악천후 상황에서 성능이 저하되는 문제점이 있었다.',
    problem: '본 발명이 해결하고자 하는 과제는 라이다 센서와 딥러닝을 결합하여 다양한 환경 조건에서도 안정적으로 객체를 감지할 수 있는 장치 및 방법을 제공하는 것이다.',
    solution: '상기 과제를 해결하기 위한 본 발명의 일 실시예에 따른 라이다 기반 객체 감지 장치는, 라이다 센서로부터 포인트 클라우드 데이터를 수집하는 데이터 수집부; 딥러닝 모델을 이용하여 객체를 분류하는 인식부를 포함한다.',
    effect: '본 발명에 의하면, 딥러닝 기반의 포인트 클라우드 처리를 통해 기존 방식 대비 처리 속도가 40% 향상되고, 객체 인식 정확도가 95% 이상 달성된다.',
    claims: '청구항 1.\n라이다 센서로부터 3차원 포인트 클라우드 데이터를 획득하는 데이터 수집부;\n상기 포인트 클라우드 데이터를 전처리하는 전처리부;\n딥러닝 모델을 적용하여 객체를 분류하는 인식부를 포함하는, 라이다 기반 객체 감지 장치.',
    abstract: '본 발명은 자율주행 차량에서 라이다 센서를 이용하여 주변 객체를 실시간으로 감지하고 분류하는 장치 및 방법에 관한 것이다.',
  };
  return d[section] || '';
}
