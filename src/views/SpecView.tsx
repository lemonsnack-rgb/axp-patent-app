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
import clsx from 'clsx';

type StepId = 'upload' | 'title' | 'description' | 'components' | 'drawings' | 'claims' | 'abstract';
const STEPS: { id: StepId; num: number; short: string }[] = [
  { id: 'upload', num: 1, short: '?쒖옉' },
  { id: 'title', num: 2, short: '紐낆묶' },
  { id: 'description', num: 3, short: '?ㅻ챸' },
  { id: 'components', num: 4, short: '援ъ꽦?붿냼' },
  { id: 'drawings', num: 5, short: '?꾨㈃' },
  { id: 'claims', num: 6, short: '泥?뎄?? },
  { id: 'abstract', num: 7, short: '?붿빟?? },
];

const STEP_LABEL: Partial<Record<StepId, string>> = {
  title: '諛쒕챸??紐낆묶', description: '諛쒕챸???ㅻ챸', components: '援ъ꽦?붿냼',
  drawings: '?꾨㈃', claims: '泥?뎄??, abstract: '?붿빟??,
};
const CONFIRM_LABEL: Partial<Record<StepId, string>> = {
  title: '諛쒕챸??紐낆묶 ?좏깮 ?꾨즺', description: '諛쒕챸???ㅻ챸 ?좏깮 ?꾨즺',
  components: '援ъ꽦?붿냼 ?좏깮 ?꾨즺', drawings: '?꾨㈃ ?좏깮 ?꾨즺',
  claims: '泥?뎄???좏깮 ?꾨즺', abstract: '?붿빟???좏깮 ?꾨즺',
};
const AI_NEXT: Record<StepId, string> = {
  upload: '?낅줈?쒗븯??臾몄꽌瑜?遺꾩꽍?덉뒿?덈떎. 諛쒕챸??紐낆묶 ?꾨낫瑜??앹꽦?⑸땲??',
  title: '諛쒕챸 紐낆묶???뺤젙?덉뒿?덈떎. 諛쒕챸???ㅻ챸 ??ぉ??遺꾩꽍?⑸땲??',
  description: '?ㅻ챸 ??ぉ???뺤젙?덉뒿?덈떎. 諛쒕챸??援ъ꽦?붿냼瑜?異붿텧?⑸땲??',
  components: '援ъ꽦?붿냼瑜??뺤젙?덉뒿?덈떎. ?낅줈?쒕맂 ?꾨㈃??遺꾩꽍?⑸땲??',
  drawings: '?꾨㈃???뺤젙?덉뒿?덈떎. 泥?뎄??쓣 ?앹꽦?⑸땲??',
  claims: '泥?뎄??쓣 ?뺤젙?덉뒿?덈떎. ?붿빟?쒕? ?앹꽦?⑸땲??',
  abstract: '紐⑤뱺 遺꾩꽍 ??ぉ???뺤젙?섏뿀?듬땲?? 紐낆꽭?쒕? ?앹꽦??以鍮꾧? ?꾨즺?섏뿀?듬땲??',
};
const GUIDE_CANDS: Record<string, string[]> = {
  title: [
    '?멸났吏??湲곕컲 ?먯쑉二쇳뻾 李⑤웾???쇱씠??媛앹껜 媛먯? ?μ튂 諛?諛⑸쾿',
    '?λ윭?앹쓣 ?댁슜??3D ?ъ씤???대씪?곕뱶 ?ㅼ떆媛?媛앹껜 ?몄떇 ?쒖뒪??,
    '?먯쑉二쇳뻾 ?섍꼍?먯꽌???ㅼ쨷 ?쇱꽌 ?듯빀 湲곕컲 媛앹껜 寃異?諛⑸쾿',
  ],
  description: [
    '湲곗닠遺꾩빞: 蹂?諛쒕챸? ?먯쑉二쇳뻾 李⑤웾?먯꽌 ?쇱씠???쇱꽌瑜??댁슜??媛앹껜 媛먯? 遺꾩빞??愿??寃껋씠??',
    '諛곌꼍湲곗닠: ?먯쑉二쇳뻾 湲곗닠??諛쒖쟾?쇰줈 LiDAR 湲곕컲 3D 媛앹껜 媛먯?媛 ?듭떖 湲곗닠濡?遺媛곷릺怨??덈떎.',
    '?닿껐怨쇱젣: 湲곗〈 諛⑹떇???ㅼ떆媛?泥섎━ ?띾룄 ?쒓퀎 諛?遺덉셿?꾪븳 ?ъ씤???대씪?곕뱶 泥섎━ 臾몄젣瑜??닿껐?쒕떎.',
    '?닿껐?섎떒: ?λ윭??湲곕컲 PointNet++ ?꾪궎?띿쿂瑜??곸슜?섏뿬 ?ъ씤???대씪?곕뱶瑜?吏곸젒 泥섎━?쒕떎.',
    '?④낵: 泥섎━ ?띾룄 40% ?μ긽 諛?媛앹껜 ?몄떇 ?뺥솗??95% ?댁긽 ?ъ꽦.',
  ],
  abstract: [
    '蹂?諛쒕챸? ?먯쑉二쇳뻾 李⑤웾?먯꽌 ?쇱씠???쇱꽌瑜??댁슜?섏뿬 二쇰? 媛앹껜瑜??ㅼ떆媛꾩쑝濡?媛먯??섍퀬 遺꾨쪟?섎뒗 ?μ튂 諛?諛⑸쾿??愿??寃껋씠??',
  ],
};

export function SpecView() {
  const { tasks, activeTaskId } = useStore();
  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  // mainView瑜?sessionStorage??persist ???ъ씠?쒕컮 ?ы겢由????먮뵒???곹깭 ?좎?
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
  // 湲곗큹?먮즺 蹂닿린 ?⑤꼸
  const [sourceDataOpen, setSourceDataOpen] = useState(false);

  const flowRef = useRef<HTMLDivElement>(null);
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
    setPhase('flow'); setCurStep('title'); setGuideStep('title');
    setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
  };
  const doneCount = Object.keys(confirmed).length;

  if (mainView === 'editor') {
    return (
      <>
        <SpecEditorView task={task} onBack={() => handleSetMainView('analysis')} confirmedTitle={gSel['title'] || confirmed['title']} />
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
                )}>{s.short}</span>
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
                <div onClick={phase === 'upload' ? startFlow : undefined}
                  className={`border-2 border-dashed rounded-xl p-10 mb-5 transition-all ${phase === 'upload' ? 'border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30' : 'border-gray-200 opacity-50'}`}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-gray-400">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-md2 text-gray-600">?뚯씪???쒕옒洹명븯嫄곕굹 ?대┃?섏뿬 ?낅줈??/p>
                  <p className="text-sm2 text-gray-400 mt-1">PDF, DOCX, HWP, ?대?吏 ?뚯씪 吏??/p>
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
            {(phase === 'direct' || ((phase === 'flow' || phase === 'done') && diTitle.trim())) && (
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
                    <button className="btn-primary btn-sm" onClick={startFlow} disabled={!diTitle.trim() || !diField.trim() || !diContent.trim()}>
                      <Icon name="star" size={13} /> AI 遺꾩꽍 ?쒖옉
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
                    {task?.id && sessionStorage.getItem(`axp_mainview_${task.id}`) === 'editor' ? (
                      <>
                        <p className="text-md2 text-gray-500 mb-4">?대? ?앹꽦??紐낆꽭???먮뵒?곕줈 ?뚯븘媛????덉뒿?덈떎.</p>
                        <button
                          onClick={() => handleSetMainView('editor')}
                          className="btn-primary btn-sm mx-auto flex items-center gap-1.5">
                          <Icon name="doc" size={13} /> 紐낆꽭???먮뵒???닿린 ??
                        </button>
                      </>
                    ) : (
                      <p className="text-md2 text-gray-500">
                        ?뺤젙???댁슜??諛뷀깢?쇰줈 ?뱁뿀 紐낆꽭?쒕? AI媛 ?앹꽦?⑸땲??<br/>
                        <span className="text-blue-700 font-medium">?ㅻⅨ履??⑤꼸</span>??' '}
                        <strong>紐낆꽭??AI ?앹꽦</strong> 踰꾪듉???뚮윭 ?쒖옉?섏꽭??
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
      {step === 'description' && <DescriptionPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} onModeChange={setDescMode} promptTrigger={descPromptTrigger} onSubInfoChange={setDescSubInfo} />}
      {step === 'components' && <ComponentsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} onComponentsChange={setConfirmedComponents} />}
      {step === 'drawings' && <DrawingsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} inventionComponents={confirmedComponents} />}
      {step === 'claims' && <ClaimsPanel done={isDone} onConfirm={handleConfirm} onUpdate={v => setGSel(p => ({ ...p, [step]: v }))} />}
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
    onUpdate(selected.map(it => `${it.num || '??} ${it.text}`).join('\n'));
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
function DrawingsPanel({ done, onUpdate, inventionComponents }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  inventionComponents?: InventionComponent[];
}) {
  const [drawings, setDrawings] = useState(() => MOCK_DRAWINGS.map(d => ({ ...d })));
  // 紐⑤컮???꾩슜 紐⑤떖 ?곹깭
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStartId, setModalStartId] = useState('');

  const handleSave = (drawingId: string, updates: Partial<typeof drawings[0]>) => {
    setDrawings(prev => {
      const next = prev.map(d => d.id === drawingId ? { ...d, ...updates } : d);
      onUpdate(next.filter(d => d.stage === 'done').map(d => `湲고샇${d.symbol} ${d.name}: ${d.description}`).join('\n\n'));
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


function ClaimsPanel({ done, onUpdate }: { done: boolean; onConfirm: () => void; onUpdate: (v: string) => void }) {
  const [claimsPhase, setClaimsPhase] = useState<'indep' | 'dep'>('indep');

  // ?낅┰???꾨낫 ?곹깭 (n媛??ㅼ쨷 ?좏깮)
  const [cands, setCands] = useState<IndepCandState[]>(
    INDEP_CANDS_INIT.map(c => ({ ...c, selected: c.id === 1, editing: false, editVal: c.text, aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const }))
  );

  // ?낅┰??퀎 醫낆냽??洹몃９
  const [depGroups, setDepGroups] = useState<Record<number, DepGroupState>>({});

  // ?좏깮???낅┰??紐⑸줉
  const selectedCands = cands.filter(c => c.selected);

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
  };

  // ?낅┰??Phase B濡??대룞
  const confirmIndep = () => {
    if (selectedCands.length === 0) return;
    setClaimsPhase('dep');
    syncUpdate(cands, depGroups);
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
  };

  // 醫낆냽???좉?
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
            ?좏깮???낅┰??{selectedCands.length > 0 ? `${selectedCands.length}媛? : ''} ?쇰줈 醫낆냽??援ъ꽦 ??
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
  {
    key: 'tech', label: '湲곗닠遺꾩빞',
    text: '蹂?諛쒕챸? ?먯쑉二쇳뻾 湲곗닠??愿??寃껋쑝濡? 蹂대떎 援ъ껜?곸쑝濡쒕뒗 ?쇱씠??LiDAR) ?쇱꽌 ?곗씠?곕? ?쒖슜???ㅼ떆媛?3D 媛앹껜 ?몄떇 ?μ튂 諛?諛⑸쾿??愿??寃껋씠?? ?뱁엳, ?ъ씤???대씪?곕뱶 ?곗씠?곗쓽 ?⑥쑉?곸씤 ?꾩쿂由ъ? ?λ윭??湲곕컲 媛앹껜 ?먯?瑜?寃고빀?섏뿬 ?먯쑉二쇳뻾 ?섍꼍?먯꽌???덉쟾?깆쓣 ?μ긽?쒗궎??湲곗닠??愿??寃껋씠??',
  },
  {
    key: 'bg', label: '諛곌꼍湲곗닠', badge2: '?좏뻾湲곗닠 3嫄?湲곕컲',
    text: '?먯쑉二쇳뻾 李⑤웾?먯꽌 二쇰? ?섍꼍 ?몄떇? ?덉쟾??二쇳뻾???꾪븳 ?듭떖 湲곗닠?대떎. 湲곗〈??移대찓??湲곕컲 ?몄떇 諛⑸쾿? 議곕챸 議곌굔??誘쇨컧?섍퀬 嫄곕━ ?뺣낫媛 遺?뺥솗???쒓퀎媛 ?덈떎. ?댁뿉 ?쇱씠???쇱꽌瑜??쒖슜??3D ?몄떇 湲곗닠??二쇰ぉ諛쏄퀬 ?덉쑝?? 湲곗〈 蹂듭?(Voxel) 湲곕컲 泥섎━ 諛⑹떇? ?곗궛?됱씠 留롮븘 ?ㅼ떆媛?泥섎━???대젮????덉쑝硫? ?ъ씤???⑥쐞 泥섎━ 諛⑹떇? 洹쇨굅由?룹썝嫄곕━ 媛앹껜 媛?諛??李⑥씠濡??명빐 ?먯? ?뺥솗?꾧? 遺덇퇏?쇳븳 臾몄젣媛 ?덈떎.',
  },
  {
    key: 'problem', label: '?닿껐?섎젮??怨쇱젣',
    text: '蹂?諛쒕챸? ?곴린? 媛숈? 臾몄젣?먯쓣 ?닿껐?섍린 ?꾪빐 ?덉텧??寃껋쑝濡? ?쇱씠???ъ씤???대씪?곕뱶 ?곗씠?곕? ?⑥쑉?곸쑝濡??꾩쿂由ы븯???ㅼ떆媛?泥섎━ ?띾룄瑜??뺣낫?섎㈃?쒕룄, 洹쇨굅由?룹썝嫄곕━ 媛앹껜 紐⑤몢??????믪? ?먯? ?뺥솗?꾨? ?ъ꽦?????덈뒗 3D 媛앹껜 ?몄떇 ?μ튂 諛?諛⑸쾿???쒓났?섎뒗 寃껋쓣 紐⑹쟻?쇰줈 ?쒕떎.',
  },
  {
    key: 'solution', label: '怨쇱젣?닿껐?섎떒',
    text: '?곴린 怨쇱젣瑜??닿껐?섍린 ?꾪빐, 蹂?諛쒕챸? ?쇱씠???쇱꽌濡쒕???3李⑥썝 ?ъ씤???대씪?곕뱶 ?곗씠?곕? ?섏떊?섎뒗 ?곗씠???섏떊遺; ?곴린 ?ъ씤???대씪?곕뱶 ?곗씠?곗뿉??RANSAC ?뚭퀬由ъ쬁???댁슜?섏뿬 吏硫??ъ씤?몃? 遺꾨━?섍퀬 ?몄씠利덈? ?쒓굅?섎뒗 ?꾩쿂由щ?; ?꾩쿂由щ맂 ?ъ씤???대씪?곕뱶瑜?湲곕뫁(pillar) ?⑥쐞濡?援ъ꽦?섏뿬 2D ?섏궗 ?대?吏瑜??앹꽦?섍퀬, PointNet++ 湲곕컲 ?λ윭??紐⑤뜽???댁슜?섏뿬 媛앹껜瑜??몄떇?섎뒗 ?몄떇遺瑜??ы븿?섎뒗 ?쇱씠??湲곕컲 媛앹껜 ?몄떇 ?μ튂瑜??쒓났?쒕떎.',
  },
];

// 諛쒕챸???ㅻ챸 ?⑤꼸 ??1媛??앹꽦 + view/edit/prompt/diff 紐⑤뱶
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
                    setTexts(p => ({ ...p, [sec.key]: e.target.value }));
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
            <Icon name="check" size={11} /> 4媛??뱀뀡 紐⑤몢 ?뺤젙?????섎떒 踰꾪듉?쇰줈 ?ㅼ쓬 ?④퀎 吏꾪뻾
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
