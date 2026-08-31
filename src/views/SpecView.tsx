// SpecView
import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../features/spec/mockAiService';
import { generateMockModification } from '../features/ai/clarityAnalyzer';
import { toast } from '../components/Toast';
import { uid } from '../utils/uid';
import { particle, withParticle } from '../utils/korean';
import { diffWords } from '../utils/diffWords';
import { replaceElementName, countElementMentions } from '../features/spec/elementRename';
import { ElementText, type ElementLike } from '../components/ElementText';
import { DiffText } from '../components/DiffText';
import type { DrawingItem as WorkflowDrawingItem } from '../features/drawing-workflow/types';
import { openEditorTab, onEditorResult, readEditorResult } from '../features/drawing-workflow/editorChannel';
import type { EditorResult } from '../features/drawing-workflow/editorChannel';
import type {
  SpecAnalysisState, SpecStepId, StepConfig,
  TitleCandidate, SpecComponentItem,
  InventionContext, MidspecSection, InventionDescriptionItem, Drawing,
} from '../features/spec/types';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import {
  routeIntent, INTENT_LABEL,
  type AgentIntent,
} from '../features/ai/specAgentMock';

type StepId = SpecStepId;

// 단계 패널이 하단 네비게이션 바에 등록하는 '현재 단계의 주 동작' (D3: 화면당 Primary 1개)
// 등록이 없으면 하단 바는 기본 '다음 →'(단계 확정)을 표시한다.
export type StepAction = { label: string; onClick: () => void; disabled?: boolean; hint?: string };
const STEPS: StepConfig[] = [
  { id: 'upload',      label: '업로드',      step: 1 },
  { id: 'description', label: '발명 설명',   step: 2 },
  { id: 'images',      label: '이미지 선별', step: 3 },
  { id: 'title',       label: '명칭·요약',   step: 4 },
  { id: 'components',  label: '구성요소',    step: 5 },
  { id: 'drawings',    label: '명세서 도면', step: 6 },
  { id: 'claims',      label: '청구항',      step: 7 },
  { id: 'midspec',     label: '중간명세서',  step: 8 },
];

const STEP_LABEL: Partial<Record<StepId, string>> = {
  title: '발명의 명칭', description: '발명의 설명', images: '이미지 선별', components: '구성요소',
  drawings: '명세서 도면', claims: '청구항', midspec: '중간명세서',
};

// 명세서 생성(중간명세서 → 에디터) mock 소요 시간. 실 API에서는 응답 도착 시 onDone 호출로 대체.
const SPEC_GEN_MOCK_MS = 6600;

// AI 어시스턴트 빈 대화 영역의 예시 질문 (심미성 A1) — 클릭하면 그대로 전송
const GUIDE_EXAMPLES: Record<string, string[]> = {
  description: ['제안기술과 종래기술은 어떻게 나누나요?', '채택하지 않은 항목은 어디에 영향이 있나요?', '표 항목은 왜 수정할 수 없나요?'],
  images:      ['대표 이미지는 무엇에 쓰이나요?', '선택하지 않은 이미지는 어떻게 되나요?', '이미지를 나중에 추가할 수 있나요?'],
  title:       ['발명의 명칭은 어떻게 정하나요?', '요약은 어디에 반영되나요?', '후보를 다시 생성하면 무엇이 바뀌나요?'],
  components:  ['부호 100, 200은 어떤 규칙인가요?', '구성요소 명칭을 바꾸면 어디까지 바뀌나요?', '하위 구성요소는 어떻게 만들나요?'],
  drawings:    ['참고만과 채택의 차이는?', '대표도면은 어디에 표시되나요?', 'CAD 변환은 무엇을 하나요?'],
  claims:      ['추상화 수준은 어떻게 고르나요?', '장치항과 방법항의 차이는?', '종속항 분량은 어떻게 정하나요?'],
  midspec:     ['중간명세서와 명세서의 차이는?', '명세서 생성은 얼마나 걸리나요?', '에디터에서 다시 돌아올 수 있나요?'],
  default:     ['이 단계에서 무엇을 확인해야 하나요?', '확정 후 되돌릴 수 있나요?', '청구항은 어떻게 구성되나요?'],
};

// 단계별 실질 안내 — 8단계 동일 템플릿 대신 이 단계에서 실제로 할 일 1~2문장 (D7)
const STEP_HINT: Partial<Record<StepId, string>> = {
  description: '채택할 항목만 체크해 두세요. 카드를 끌어 순서를 바꾸거나 제안/종래 기술 사이로 보낼 수 있고, 표 항목은 원문 그대로 반영됩니다.',
  images:      '명세서 맥락에 쓸 이미지를 고르고 대표 이미지 1개를 지정하세요. 선택하지 않은 이미지는 이후 단계에서 제외됩니다.',
  title:       '후보 중 하나를 고르거나 직접 입력하세요. 각 후보의 명칭·요약은 AI 수정으로 다듬을 수 있습니다.',
  components:  '구성요소의 명칭·정의를 확인하고 순서를 정한 뒤 부호(100, 200…)를 부여하세요. 채택한 구성요소가 청구항의 기준이 됩니다.',
  drawings:    '이미지 선별에서 고른 이미지가 도면으로 기본 채택되어 있습니다. 명세서에 넣지 않을 이미지는 참고만으로 바꾸세요.',
  claims:      '권리범위와 청구항 구성을 정해 독립항 세트를 생성하고, 하나를 선택해 종속항을 구성하세요.',
  midspec:     '섹션별 단락을 확인·편집하세요. 마치면 하단 명세서 생성으로 실시예를 포함한 초안을 만들고 에디터로 이동합니다.',
};
const AI_NEXT: Record<StepId, string> = {
  upload:      '업로드하신 문서를 분석했습니다. 발명의 설명 항목을 분석합니다.',
  description: '설명 항목을 확정했습니다. 추출된 이미지를 선별합니다.',
  images:      '관련 이미지를 선별했습니다. 발명의 명칭 후보를 생성합니다.',
  title:       '발명 명칭을 확정했습니다. 발명의 구성요소를 추출합니다.',
  components:  '구성요소를 확정했습니다. 명세서에 넣을 도면을 처리합니다.',
  drawings:    '명세서 도면을 확정했습니다. 청구항을 생성합니다.',
  claims:      '청구항을 확정했습니다. 중간명세서를 확인하고 편집하세요.',
  midspec:     '중간명세서를 확정했습니다. 에디터로 이동합니다.',
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
  const { tasks, activeTaskId, taskUpdate } = useStore();
  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
  const savedSpec = task?.id ? loadSpecState(task.id) : null;

  const [mainView, setMainView] = useState<'analysis' | 'editor'>(savedSpec?.mainView ?? 'analysis');
  const handleSetMainView = (v: 'analysis' | 'editor') => setMainView(v);
  // ── 구성요소 명칭 전역 치환 (원천 = context.elements) ─────────────────────
  // 정의 지점(구성요소 단계)·인용 지점(에디터 하이라이트 클릭)이 같은 엔진을 쓴다. 텍스트 치환은 elementRename.ts.
  const elementNames = () => context.elements.map(e => e.value_ko).filter(Boolean);
  const collectRenameTargets = () => ({
    desc: [...context.proposed, ...context.previous].map(i => i.content),
    claims: [gSel['claims'] ?? '', confirmed['claims'] ?? ''],
    midspec: (midspec ?? []).flatMap(sec => sec.blocks.map(b => b.content)),
    editor: (Object.values((task?.id && loadSpecState(task.id)?.editorBlocks) ?? {}) as string[][]).flat(),
  });
  const countElementMentionsAll = (oldName: string) => {
    const t = collectRenameTargets(); const names = elementNames();
    const c = {
      desc: countElementMentions(t.desc, oldName, names),
      claims: countElementMentions(t.claims, oldName, names),
      midspec: countElementMentions(t.midspec, oldName, names),
      editor: countElementMentions(t.editor, oldName, names),
    };
    return { ...c, total: c.desc + c.claims + c.midspec + c.editor };
  };
  const renameElementEverywhere = (oldName: string, newName: string, opts?: { skipEditorBlocks?: boolean }) => {
    const names = elementNames();
    const R = (v: string) => replaceElementName(v, oldName, newName, names).text;
    setContext(p => ({
      ...p,
      title: R(p.title), summary: R(p.summary),
      elements: p.elements.map(e => e.value_ko === oldName ? { ...e, value_ko: newName } : e),
      proposed: p.proposed.map(i => ({ ...i, content: R(i.content) })),
      previous: p.previous.map(i => ({ ...i, content: R(i.content) })),
    }));
    setMidspec(m => m ? m.map(sec => ({ ...sec, blocks: sec.blocks.map(b => ({ ...b, content: R(b.content) })) })) : m);
    setGSel(g => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, typeof v === 'string' ? R(v) : v])) as typeof g);
    setConfirmed(c => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'string' ? R(v) : v])) as typeof c);
    setAiComponents(list => list.map(c => c.value_ko === oldName ? { ...c, value_ko: newName } : c));
    if (!opts?.skipEditorBlocks && task?.id) {
      const saved = loadSpecState(task.id);
      if (saved?.editorBlocks) {
        const eb = Object.fromEntries(Object.entries(saved.editorBlocks).map(([k, arr]) => [k, (arr as string[]).map(R)]));
        saveSpecState(task.id, { editorBlocks: eb });
      }
    }
    const c = countElementMentionsAll(oldName);
    toast(c.total ? `'${oldName}' → '${newName}' — 본문 ${c.total}곳도 함께 바꿨습니다` : `'${oldName}' → '${newName}'로 바꿨습니다`);
  };

  // ── 명세서 생성 진행 (중간명세서 → 에디터) ─────────────────────────────
  // 실시예를 포함한 명세서 생성은 실제 API에서 1분 이상 걸린다. 단계 체크리스트 + 진행 바 + 경과 시간을 보여주고
  // 완료 시 에디터로 전환한다. mock은 SPEC_GEN_MOCK_MS 후 완료 처리. (실 API: 응답 도착 시 onDone)
  // 경과 시간은 표시하지 않는다(사용자 결정: 오래 걸림을 강조할 필요 없음) — 진행 중 표시와 단계만.
  const [specGen, setSpecGen] = useState<{ stage: number } | null>(null);
  const specGenTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearSpecGenTimers = () => { specGenTimers.current.forEach(clearTimeout); specGenTimers.current = []; };
  const startSpecGeneration = (onDone: () => void) => {
    clearSpecGenTimers();
    setSpecGen({ stage: 0 });
    specGenTimers.current.push(setTimeout(() => { clearSpecGenTimers(); setSpecGen(null); onDone(); }, SPEC_GEN_MOCK_MS));
  };
  const cancelSpecGeneration = () => { clearSpecGenTimers(); setSpecGen(null); toast('명세서 생성을 취소했습니다'); };
  useEffect(() => () => clearSpecGenTimers(), []);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  // AI 수정은 본문 내 삽입형(인라인)으로 통일 — 사이드패널로 포커스를 넘기지 않는다 (데모 정합)
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

  // ── 도면 편집기(새 탭) 결과 수신 — 톱레벨: 위저드/에디터 어느 화면이든 반영, 재진입 시 잔류 결과도 적용 ──
  const applyEditorResult = useCallback((result: EditorResult | null) => {
    if (!result) return;
    if (result.taskId && result.taskId !== task?.id) return;   // 다른 작업의 결과는 무시
    const idx = parseInt(result.drawingId, 10);
    if (isNaN(idx)) return;
    const LABEL_TO_API: Record<string, Drawing['detail']['label']> = {
      '제안기술': 'proposed_implementation', '종래기술': 'previous_implementation', 'AI생성': 'proposed_implementation',
    };
    setContext(p => {
      const ds = [...(p.drawings ?? [])];
      const d = ds[idx];
      if (!d) return p;
      let next = d;
      if (result.adjustedBbox) {
        const ab = result.adjustedBbox;
        next = { ...next, image: { ...next.image, bbox: { x1: ab.x, y1: ab.y, x2: ab.x + ab.w, y2: ab.y + ab.h } } };
      }
      if (result.detail) {
        const dt = result.detail;
        next = { ...next, detail: {
          ...next.detail,
          ...(dt.name !== undefined ? { name: dt.name } : {}),
          ...(dt.description !== undefined ? { description: dt.description } : {}),
          ...(dt.label !== undefined ? { label: LABEL_TO_API[dt.label] ?? next.detail.label } : {}),
        } };
      }
      // CAD 변환 완료: 썸네일을 변환본으로 교체 + 완료 배지 (B13)
      if (result.stage === 'done' && result.exportedImageUrl?.startsWith('data:')) {
        const mm = result.exportedImageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (mm) next = { ...next, cadConverted: true, image: { ...next.image, file: { ...next.image.file, media_type: mm[1] as Drawing['image']['file']['media_type'], data: mm[2] } } };
      }
      ds[idx] = next;
      return { ...p, drawings: ds };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);
  useEffect(() => {
    // 리스너 미등록 상태에서 도착해 잔류한 결과를 재진입 시 적용 (taskId가 일치할 때만)
    const pending = readEditorResult();
    if (pending && pending.taskId && pending.taskId === task?.id) applyEditorResult(pending);
    return onEditorResult(applyEditorResult);
  }, [applyEditorResult]);

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
      ? savedSpec.context.elements.map(el => ({ ...el, depth: 0, sel: true }))
      : []
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  // 단계 전환(다음 단계 분석) 로딩 — 분석에 시간이 걸릴 수 있어 로딩 바 표시
  const [stepLoading, setStepLoading] = useState<StepId | null>(null);
  // 하단 바 주 동작 — 현재 단계 패널(청구항·중간명세서)이 등록 (U1/D3)
  const [stepAction, setStepAction] = useState<StepAction | null>(null);
  // 완료 단계 접기/펼치기 — 기본 접힘(1줄 요약) (U3)
  const [expandedDone, setExpandedDone] = useState<Partial<Record<StepId, boolean>>>({});

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
    }, 400);
    return () => { if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current); };
  }, [phase, curStep, confirmed, gSel, diTitle, diField, diContent,
      diProblem, diKeywords, titleCandidates, context, midspec, mainView, task?.id]);

  // (제거) 분석 중 beforeunload 이탈 확인 — 진행 상태가 자동저장(400ms 디바운스)으로 보존되므로
  // 경고 대화상자가 오히려 페이지 이동/자동화(CDP)를 블로킹시켜 제거함.

  const si = (id: StepId) => STEPS.findIndex(s => s.id === id);
  const isSpecialStep = (id: StepId) =>
    id === 'description' || id === 'images' || id === 'components' || id === 'drawings' || id === 'claims' || id === 'midspec';
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
    // 청구항 확정 시 중간명세서 자동 로드 — 도면설명은 명세서 도면에서 생성 (도면은 직전 단계에서 확정됨)
    if (id === 'claims' && !midspec) {
      import('../features/spec/mockAiService').then(({ MOCK_MIDSPEC }) => {
        const specDrawings = context.drawings.filter(d => d.included !== false && d.useForSpec);
        const fallback = MOCK_MIDSPEC.find(s => s.key === 'drawing_descriptions')?.blocks ?? [];
        // 도 번호는 명세서 도면 채택 순서(1부터), 조사는 받침에 따라 자동 선택 (U9)
        const drawingBlocks = specDrawings.length
          ? specDrawings.map((d, i) => {
              const fig = `도 ${i + 1}`;
              const name = d.detail.name || '발명의 구성';
              return {
                id: uid(), type: 'text' as const,
                content: `${fig}${particle(fig, '은', '는')} ${name}${particle(name, '을', '를')} 나타낸 도면이다.${d.isRepresentative ? ' (대표도면)' : ''}`,
              };
            })
          : fallback;
        const next = MOCK_MIDSPEC.map(s => s.key === 'drawing_descriptions' ? { ...s, blocks: drawingBlocks } : s);
        setMidspec(next);
      });
    }
    // 이미지 선별 확정 시 대표 이미지가 없으면 첫 선택 이미지를 대표로 (A5)
    if (id === 'images') {
      setContext(p => {
        if (p.drawings.some(d => d.included !== false && d.isRepresentative)) return p;
        let set = false;
        return { ...p, drawings: p.drawings.map(d => (!set && d.included !== false) ? (set = true, { ...d, isRepresentative: true }) : d) };
      });
    }
    // 명세서 도면 단계 진입 시 — 이미지 선별(3단계) 결과를 도면 채택 기본값으로 프리셋 (U2)
    // (이미 채택된 도면이 있으면 사용자 선택을 존중)
    if (id === 'components') {
      setContext(p => {
        if (p.drawings.some(d => d.useForSpec)) return p;
        let repSet = p.drawings.some(d => d.included !== false && d.isRepresentative);
        return {
          ...p,
          drawings: p.drawings.map(d => {
            const inc = d.included !== false;
            const rep = inc && (d.isRepresentative || !repSet);
            if (rep) repSet = true;
            return { ...d, useForSpec: inc, isRepresentative: rep };
          }),
        };
      });
    }
    const next = STEPS[si(id) + 1];
    if (next) {
      // 다음 단계 분석 로딩 표시 후 전환 (실제 AI 분석 지연 대응)
      setStepLoading(next.id);
      setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
      setTimeout(() => {
        setCurStep(next.id);
        setGuideStep(next.id);
        setStepLoading(null);
        // 새 단계의 헤더로 스크롤 — 하단이 아니라 상단 도구부터 보이게 (U3)
        setTimeout(() => scrollToStep(next.id), 60);
      }, 900);
    } else {
      setPhase('done');
      setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    }
  };
  const reselect = (id: StepId) => {
    const doIt = () => {
      const p = { ...confirmed }; delete p[id];
      setConfirmed(p); setCurStep(id); setGuideStep(id);
      setStepAction(null);
      setTimeout(() => scrollToStep(id), 60);
    };
    // 이후 단계가 이미 확정되어 있으면 재확정이 필요함을 먼저 알린다 (U4)
    const later = STEPS.filter(st => si(st.id) > si(id) && confirmed[st.id] && STEP_LABEL[st.id]).map(st => STEP_LABEL[st.id]);
    if (later.length) showConfirm(`${withParticle(`"${STEP_LABEL[id]}"`.replace(/"$/, ''), '을', '를').replace(/^"([^"]+)/, '"$1"')} 다시 선택하면 이후 단계(${later.join(' · ')})를 다시 확정해야 합니다. 계속할까요?`, doIt);
    else doIt();
  };
  const scrollToStep = (id: StepId) => {
    flowRef.current?.querySelector<HTMLElement>(`[data-flowstep="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // 완료 단계 1줄 요약 (U3)
  const doneSummary = (id: StepId): string => {
    switch (id) {
      case 'description': {
        const a = (arr: { adopted?: boolean }[]) => arr.filter(x => x.adopted !== false).length;
        return `제안기술 ${a(context.proposed)}/${context.proposed.length} · 종래기술 ${a(context.previous)}/${context.previous.length} 항목 채택`;
      }
      case 'images': {
        const inc = context.drawings.filter(d => d.included !== false).length;
        return `관련 이미지 ${inc}/${context.drawings.length}개 선택`;
      }
      case 'title': return confirmed['title'] || gSel['title'] || '명칭 확정';
      case 'components': return `구성요소 ${context.elements.length}개 확정`;
      case 'drawings': {
        const n = context.drawings.filter(d => d.included !== false && d.useForSpec).length;
        return n ? `명세서 도면 ${n}개 (${n === 1 ? '도 1' : `도 1~${n}`})` : '명세서 도면 없음 (참고 이미지만 사용)';
      }
      case 'claims': return '독립항 세트 · 종속항 확정';
      case 'midspec': return `${(midspec ?? []).length}개 섹션`;
      default: return '확정';
    }
  };
  // 진행표시(Stepper) 클릭 이동 — 방문한 단계로 스크롤(확정 내용은 보존)
  const gotoFlowStep = (id: StepId) => {
    if (!(phase === 'flow' || phase === 'done') || si(id) > si(curStep)) return;
    setGuideStep(id);
    if (id === 'upload') { flowRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    requestAnimationFrame(() => {
      flowRef.current?.querySelector<HTMLElement>(`[data-flowstep="${id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
      setTimeout(() => scrollToStep('description'), 80);
    }, 1500);
  };

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
          onRenameElement={(o, n) => renameElementEverywhere(o, n, { skipEditorBlocks: true })}
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
          <div className="fixed top-0 right-0 z-30 h-full w-80 bg-white border-l border-neutral-200 shadow-xl flex flex-col" style={{ maxHeight: '100vh' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 shrink-0">
            <span className="text-sm2 font-semibold text-neutral-800">기초자료</span>
            <button onClick={() => setSourceDataOpen(false)} className="text-neutral-400 hover:text-neutral-600">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 text-xs2">
            {diTitle ? (
              <>
                <div><p className="font-semibold text-neutral-500 mb-1">발명의 명칭 (가제)</p><p className="text-neutral-800 bg-neutral-50 rounded-md px-2 py-1.5">{diTitle}</p></div>
                {diField && <div><p className="font-semibold text-neutral-500 mb-1">기술 분야</p><p className="text-neutral-800 bg-neutral-50 rounded-md px-2 py-1.5">{diField}</p></div>}
                {diContent && <div><p className="font-semibold text-neutral-500 mb-1">발명의 핵심 내용</p><p className="text-neutral-800 bg-neutral-50 rounded-md px-2 py-1.5 whitespace-pre-wrap">{diContent}</p></div>}
                {diProblem && <div><p className="font-semibold text-neutral-500 mb-1">해결하려는 과제</p><p className="text-neutral-800 bg-neutral-50 rounded-md px-2 py-1.5 whitespace-pre-wrap">{diProblem}</p></div>}
                {diKeywords && <div><p className="font-semibold text-neutral-500 mb-1">참고 키워드 / 선행기술</p><p className="text-neutral-800 bg-neutral-50 rounded-md px-2 py-1.5">{diKeywords}</p></div>}
              </>
            ) : (
              <div className="text-center py-8 text-neutral-400">
                <Icon name="doc" size={32} className="mx-auto mb-2 text-neutral-200" />
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


          {/* Stepper — 3분할(다시시작 / 단계 / 진행표시)로 겹침 방지 */}
          <div data-spec="SPC-WIZ-020" className="flex items-center border-b border-ck-border shrink-0 px-2 gap-1" style={{ height: 48 }}>
            {/* 좌: 다시 시작 (아이콘, 폭 최소화) */}
            <div className="shrink-0">
              {(phase === 'flow' || phase === 'done') && (
                <button
                  onClick={resetAnalysis}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-base text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  data-spec="SPC-WIZ-022" title="처음부터 다시 시작"
                  aria-label="처음부터 다시 시작"
                >
                  ↺
                </button>
              )}
            </div>
            {/* 중앙: 단계 (스크롤) */}
            <div className="flex-1 min-w-0 flex items-center justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {STEPS.map((s, i) => {
                const isDone = si(s.id) < si(curStep) && (phase === 'flow' || phase === 'done');
                const active = s.id === curStep && (phase === 'flow' || phase === 'done');
                const locked = phase !== 'flow' && phase !== 'done' && s.id !== 'upload';
                const prevDone = i > 0 && si(STEPS[i - 1].id) < si(curStep) && (phase === 'flow' || phase === 'done');
                const navigable = (phase === 'flow' || phase === 'done') && si(s.id) <= si(curStep);
                return (
                  <div key={s.id} className="flex items-center shrink-0">
                    {i > 0 && (
                      <div className={clsx('h-0.5 shrink-0 mx-0.5', prevDone ? 'bg-green-500' : 'bg-neutral-200')}
                        style={{ width: 10 }} />
                    )}
                    <button
                      type="button"
                      data-spec="SPC-WIZ-021" onClick={() => gotoFlowStep(s.id)}
                      disabled={!navigable}
                      title={navigable ? `${s.label}(으)로 이동` : locked ? '이전 단계를 먼저 완료하세요' : s.label}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-1 rounded-full border select-none transition-colors',
                        active && 'border-brand-200 bg-brand-50',
                        !active && 'border-transparent',
                        navigable ? 'cursor-pointer hover:bg-neutral-100' : 'cursor-default',
                        locked && 'opacity-60',
                      )}>
                      <span className={clsx(
                        'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 border-2 tabular-nums',
                        active && 'border-brand-600 bg-brand-400 text-white',
                        isDone && !active && 'border-green-500 bg-green-500 text-white',
                        locked && 'border-neutral-300 bg-white text-neutral-400',
                        !active && !isDone && !locked && 'border-neutral-400 bg-white text-neutral-500',
                      )}>
                        {isDone && !active ? <Icon name="check" size={10} /> : s.step}
                      </span>
                      <span className={clsx(
                        'text-sm2 max-md:hidden',
                        active && 'max-md:inline text-brand-400 font-semibold',
                        !active && 'max-xl:hidden',                                        // 좁은 폭: 현재 단계만 라벨, 나머지는 번호 원만 (L1)
                        isDone && !active && 'text-green-700 font-medium',
                        locked && 'text-neutral-400',
                        !active && !isDone && !locked && 'text-neutral-500',
                      )}>{s.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        <div ref={flowRef} className="flex-1 overflow-y-auto scroll-thin bg-ck-bg">
          <div className="max-w-5xl mx-auto py-8 px-4 space-y-3">

            {/* 업로드 존 — PDF 파일 업로드 */}
            {phase !== 'flow' && phase !== 'done' && !analyzing && (
              <div className="text-center py-4">
                <Icon name="doc" size={48} className="text-brand-400 mx-auto mb-3" />
                <p className="text-base2 text-neutral-600 mb-6">직무발명서(PDF)를 업로드하면 AI가 발명 설명·이미지·명칭 후보를 자동으로 분석합니다.</p>
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
                    // 작업 생성 시 입력한 이름이 있으면 유지하고, 없을 때만 파일명을 가제로 사용 (U14)
                    const title = diTitle.trim() || nameWithoutExt;
                    setDiTitle(title);
                    setDiContent(content);
                    startFlow({ title, field: diField, content });
                    e.target.value = '';
                  }}
                />
                <div data-spec="SPC-UPL-010"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-300 rounded-xl p-10 mb-5 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-neutral-400">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-base2 text-neutral-700">직무발명서 PDF를 여기에 끌어 놓으세요</p>
                  <p className="text-xs2 text-neutral-400 mt-1 mb-3">.pdf 지원</p>
                  <button data-spec="SPC-UPL-011"
                    type="button"
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm2 font-semibold bg-brand-400 text-white hover:bg-brand-500 transition-colors"
                  ><Icon name="plus" size={12} /> 파일 선택</button>
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
                      loadingStage === s.stage && 'bg-brand-50',
                    )}>
                      <div className={clsx(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300',
                        loadingStage > s.stage ? 'bg-green-100' :
                        loadingStage === s.stage ? 'bg-brand-100' : 'bg-neutral-100',
                      )}>
                        {loadingStage > s.stage ? (
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-green-600"><polyline points="3,8 7,12 13,4" /></svg>
                        ) : loadingStage === s.stage ? (
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand-500 animate-spin" style={{ transformOrigin: 'center' }}><circle cx="8" cy="8" r="5" strokeDasharray="20 12" /></svg>
                        ) : (
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-300"><circle cx="8" cy="8" r="5" /></svg>
                        )}
                      </div>
                      <span className={clsx(
                        'text-sm2 transition-colors duration-300',
                        loadingStage > s.stage ? 'text-green-700' :
                        loadingStage === s.stage ? 'text-brand-400 font-semibold' : 'text-neutral-400',
                      )}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="w-56 h-1 bg-neutral-100 rounded-full overflow-hidden">
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
                <div className="flex items-center gap-3 p-4 border-b border-neutral-100 bg-neutral-50">
                  <Icon name="edit" size={20} className="text-brand-400" />
                  <div>
                    <h3 className="text-base2 font-semibold text-neutral-800">발명 기초 내용 입력</h3>
                    <p className="text-sm2 text-neutral-500">아래 항목을 입력하면 AI가 명세서 항목을 분석합니다. <span className="text-red-500">*</span> 표시는 필수 항목입니다.</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { label: '발명의 명칭 (가제)', ph: '예: 인공지능 기반 특허 명세서 자동 생성 시스템', val: diTitle, set: setDiTitle, req: true },
                    { label: '기술 분야', ph: '예: 인공지능, 자연어 처리, 특허 자동화', val: diField, set: setDiField, req: true },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-sm2 font-semibold text-neutral-700 mb-1">{f.label}{f.req && <span className="text-red-500 ml-0.5">*</span>}</label>
                      <Input className="py-2" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm2 font-semibold text-neutral-700 mb-1">발명의 핵심 내용<span className="text-red-500 ml-0.5">*</span></label>
                    <textarea className="input py-2" rows={4} placeholder="발명의 핵심 기술과 구성, 작동 원리 등을 자유롭게 기술하세요..." value={diContent} onChange={e => setDiContent(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm2 font-semibold text-neutral-700 mb-1">해결하려는 과제</label>
                    <textarea className="input py-2" rows={2} placeholder="기존 기술의 문제점 또는 본 발명이 해결하려는 과제를 입력하세요..." value={diProblem} onChange={e => setDiProblem(e.target.value)} />
                  </div>
                  <div>
                    <label data-spec="SPC-IMG-020" className="block text-sm2 font-semibold text-neutral-700 mb-1">참고 키워드 / 선행기술</label>
                    <Input className="py-2" placeholder="예: 트랜스포머, GPT, KR10-2023-0012345" value={diKeywords} onChange={e => setDiKeywords(e.target.value)} />
                  </div>
                </div>
                {/* flow/done 상태에서는 버튼 숨김 (폼은 읽기전용으로 계속 표시) */}
                {phase === 'direct' && (
                  <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-100 bg-neutral-50">
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
                  const collapsed = isDone && !expandedDone[s.id];
                  return (
                    <div key={s.id} data-flowstep={s.id} className="space-y-3 scroll-mt-3">
                      {collapsed ? (
                        /* 완료 단계 — 1줄 요약 (펼치기 / 다시 선택) */
                        <div data-spec="SPC-WIZ-040" className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5">
                          <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><Icon name="check" size={10} /></span>
                          <span className="text-sm2 font-semibold text-neutral-800 shrink-0">{STEP_LABEL[s.id]}</span>
                          <span className="text-xs2 text-neutral-500 truncate flex-1 min-w-0">{doneSummary(s.id)}</span>
                          <button data-spec="SPC-WIZ-041"
                            onClick={() => setExpandedDone(p => ({ ...p, [s.id]: true }))}
                            className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-lg text-xs2 font-medium text-neutral-500 border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
                          >펼치기</button>
                          <button data-spec="SPC-WIZ-042"
                            onClick={() => reselect(s.id)}
                            className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs2 font-medium text-brand-500 border border-brand-200 bg-white hover:bg-brand-50 transition-colors"
                          ><Icon name="edit" size={10} /> 다시 선택</button>
                        </div>
                      ) : (<>
                      <AiMsg text={
                        <><strong className="text-lg2 font-bold text-neutral-800">{STEP_LABEL[s.id]}</strong><br />
                        {STEP_HINT[s.id] ?? `${STEP_LABEL[s.id]} 항목을 확인하고 채우세요.`}</>
                      } />
                      {/* 단계 콘텐츠 — isDone 시 전체 딤 처리 */}
                      <div className={isDone ? 'opacity-60 pointer-events-none select-none' : ''}>
                        {s.id === 'title' && (
                          <TitleCandidateCards
                            candidates={titleCandidates}
                            gSel={gSel}
                            setGSel={setGSel}
                            onSummaryChange={summary => setContext(p => p.summary === summary ? p : { ...p, summary })}
                            onRegenerate={() => {
                              setTitleCandidates(generateTitleCandidates({ title: diTitle, field: diField, content: diContent }));
                              toast('명칭 후보를 다시 생성했습니다');
                            }}
                          />
                        )}
                        {s.id === 'description' && (
                          <DescriptionItemCards
                            previous={context.previous}
                            proposed={context.proposed}
                            onRegenerate={() => {
                              // API /v2/generate/context/description/refined — 현재 목업(getMockExtractResult)
                              import('../features/spec/mockAiService').then(({ getMockExtractResult }) => {
                                const r = getMockExtractResult();
                                setContext(p => ({ ...p, previous: r.previous, proposed: r.proposed }));
                                toast('발명 설명을 다시 정제했습니다');
                              });
                            }}
                            onToggle={(type, idx) => setContext(p => ({
                              ...p,
                              [type]: p[type].map((item, i) => i === idx ? { ...item, adopted: !item.adopted } : item),
                            }))}
                            onChange={(type, idx, text) => setContext(p => ({
                              ...p,
                              [type]: p[type].map((item, i) => i === idx ? { ...item, content: text } : item),
                            }))}
                            onAdd={(type, text, label) => setContext(p => ({
                              ...p,
                              [type]: [...p[type], { id: uid(), type: 'text' as const, label, content: text }],
                            }))}
                            onRemove={(type, idx) => setContext(p => ({
                              ...p,
                              [type]: p[type].filter((_, i) => i !== idx),
                            }))}
                            onReorder={(type, from, to) => setContext(p => {
                              const arr = [...p[type]];
                              if (to < 0 || to >= arr.length) return p;
                              const [m] = arr.splice(from, 1);
                              arr.splice(to, 0, m);
                              return { ...p, [type]: arr };
                            })}
                            onMoveAcross={(fromType, fromIdx, toIdx) => setContext(p => {
                              const toType = fromType === 'previous' ? 'proposed' : 'previous';
                              const src = [...p[fromType]];
                              const [m] = src.splice(fromIdx, 1);
                              if (!m) return p;
                              const dst = [...p[toType]];
                              dst.splice(toIdx ?? dst.length, 0, m);
                              return { ...p, [fromType]: src, [toType]: dst };
                            })}
                          />
                        )}
                        {(s.id === 'images' || s.id === 'components' || s.id === 'drawings' || s.id === 'claims' || s.id === 'midspec') && (
                          <div className="mt-3">
                            {s.id === 'images' && (
                              <DrawingsPanel taskId={task?.id}
                                mode="select"
                                done={isDone}
                                onConfirm={() => confirm('images')}
                                onUpdate={v => setGSel(p => ({ ...p, images: v }))}
                                drawings={context.drawings}
                                onUpdateDrawings={next => setContext(p => ({ ...p, drawings: next }))}
                              />
                            )}
                            {s.id === 'components' && (
                              <ComponentsPanel
                                done={isDone}
                                onConfirm={() => confirm('components')}
                                onUpdate={v => setGSel(p => ({ ...p, components: v }))}
                                onRenameEverywhere={(o, n) => renameElementEverywhere(o, n)}
                                onComponentsChange={(comps) => {
                                  setAiComponents(comps);
                                  // 채택된 구성요소를 InventionContext.elements 단일 원천에 동기화 (InventionElement로 정제)
                                  setContext(p => ({
                                    ...p,
                                    elements: comps.filter(c => c.sel).map(c => ({
                                      id: c.id, symbol: c.symbol, value_ko: c.value_ko, value_en: c.value_en,
                                      description: c.description, hypernym_ko: c.hypernym_ko, hypernym_en: c.hypernym_en,
                                    })),
                                  }));
                                }}
                                initialItems={aiComponents}
                              />
                            )}
                            {s.id === 'drawings' && (
                              <DrawingsPanel taskId={task?.id}
                                mode="spec"
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
                                elements={context.elements}
                                onConfirm={() => confirm('claims')}
                                onUpdate={v => setGSel(p => ({ ...p, claims: v }))}
                                onActionChange={setStepAction}
                              />
                            )}
                            {s.id === 'midspec' && (
                              <MidspecPanel
                                done={isDone}
                                elements={context.elements}
                                onActionChange={setStepAction}
                                sections={midspec ?? []}
                                onUpdate={(next) => {
                                  setMidspec(next);
                                  setGSel(p => ({ ...p, midspec: next.map(s => `【${s.label}】\n${s.blocks.map(b => b.content).join('\n')}`).join('\n\n') }));
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
                                  // 생성 진행 화면을 띄우고 완료 시 에디터로 전환 (실 API: 1분 이상)
                                  startSpecGeneration(() => {
                                    setMidspec(nextMidspec);
                                    confirm('midspec');
                                    handleSetMainView('editor');
                                  });
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      {/* 완료 단계(펼침) — 접기 / 다시 선택 */}
                      {isDone && (
                        <div className="flex justify-end gap-1.5 mt-1">
                          <button
                            onClick={() => setExpandedDone(p => ({ ...p, [s.id]: false }))}
                            className="inline-flex items-center h-7 px-2.5 rounded-lg text-xs2 text-neutral-500 hover:bg-neutral-100 transition-colors"
                          >접기</button>
                          <button data-spec="SPC-WIZ-042"
                            onClick={() => reselect(s.id)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs2 font-medium text-brand-500 border border-brand-200 bg-white hover:bg-brand-50 transition-colors"
                          ><Icon name="edit" size={10} /> 다시 선택</button>
                        </div>
                      )}
                      </>)}
                    </div>
                  );
                })}

                {/* 다음 단계 분석 로딩 바 */}
                {stepLoading && (
                  <div className="rounded-xl border border-brand-100 bg-white px-4 py-4 shadow-card">
                    <div data-spec="SPC-WIZ-060" className="flex items-center gap-2 mb-2.5">
                      <span className="inline-block animate-spin text-brand-400 leading-none">↻</span>
                      <span className="text-sm2 font-semibold text-neutral-700">
                        {STEP_LABEL[stepLoading] ?? '다음 단계'} 분석 중…
                      </span>
                    </div>
                    <div className="relative h-1.5 bg-brand-100 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 h-full w-2/5 bg-brand-400 rounded-full"
                        style={{ animation: 'loading-indeterminate 1.1s ease-in-out infinite' }}
                      />
                    </div>
                    <p className="text-xs2 text-neutral-400 mt-2">AI가 항목을 분석하고 있습니다. 잠시만 기다려 주세요.</p>
                  </div>
                )}

                {phase === 'done' && (
                  <div data-spec="SPC-WIZ-070" className="text-center py-8">
                    <Icon name="logo" size={40} className="text-brand-400 mx-auto mb-3" />
                    <h3 className="text-lg2 font-bold text-neutral-800 mb-2">모든 분석 항목이 확정되었습니다</h3>
                    <p className="text-md2 text-neutral-500 mb-5">확정된 내용을 바탕으로 명세서 초안을 편집하세요.</p>
                    <Button
                      variant="filled" color="primary" size="sm"
                      onClick={() => handleSetMainView('editor')}
                      className="mx-auto flex items-center gap-1.5">
                      <Icon name="doc" size={13} /> 에디터로 이동 →
                    </Button>
                    {task?.id && sessionStorage.getItem(`axp_mainview_${task.id}`) === 'editor' && (
                      <p className="text-xs2 text-neutral-400 mt-3">이미 진행 중인 편집 내용이 있습니다 — 이어서 편집할 수 있습니다.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {/* 네비게이션 바 — 본문 하단 */}
        {(phase === 'flow' || phase === 'done') && (
          <div data-spec="SPC-WIZ-050" className="shrink-0 border-t border-ck-border bg-neutral-50/90 backdrop-blur w-full shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-end gap-2">
              <div>
                {si(curStep) > 1 && (
                  <button data-spec="SPC-WIZ-051"
                    onClick={() => {
                      // 보기 이동만 — 확정 상태는 바꾸지 않는다 (재확정은 '다시 선택'으로) (U4)
                      const prev = STEPS[si(curStep) - 1].id;
                      setExpandedDone(p => ({ ...p, [prev]: true }));
                      gotoFlowStep(prev);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-neutral-600 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors"
                    title="이전 단계 내용 보기"
                  >← 이전</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* 하단 바의 Primary는 화면당 1개 — 단계 패널이 등록한 주 동작(stepAction)이 있으면 그것을, 없으면 단계 확정(다음)을 표시 (U1/D3) */}
                {phase === 'flow' && (() => {
                  if (stepLoading) {
                    return <button disabled className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl opacity-40">분석 중…</button>;
                  }
                  if (stepAction) {
                    return (<>
                      {stepAction.disabled && stepAction.hint && <span className="text-xs2 text-neutral-400">{stepAction.hint}</span>}
                      <button
                        data-spec="SPC-WIZ-052" onClick={stepAction.onClick}
                        disabled={stepAction.disabled}
                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-brand-500 disabled:opacity-40 transition-colors"
                      >{stepAction.label}</button>
                    </>);
                  }
                  if (curStep === 'midspec') return null; // 중간명세서는 패널이 '명세서 생성' 동작을 등록
                  if (curStep === 'drawings') {
                    // 도면 0개면 확인 후 진행 — 별도 '건너뛰기' 버튼 없이 한 경로로 (U2)
                    const specCount = context.drawings.filter(d => d.included !== false && d.useForSpec).length;
                    return (
                      <button
                        onClick={() => specCount === 0
                          ? showConfirm('명세서에 넣을 도면이 없습니다. 도면 없이(참고 이미지만 사용) 청구항 단계로 진행할까요?', () => confirm('drawings'))
                          : confirm('drawings')}
                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-brand-500 transition-colors"
                      >{specCount === 0 ? '도면 없이 다음 →' : '다음 →'}</button>
                    );
                  }
                  if (curStep === 'components') {
                    // 채택 구성요소에 빈 필드(영문명·상위어·정의)가 있으면 확인 후 진행 (A4)
                    const incomplete = aiComponents.filter(c => c.sel && (!c.value_en.trim() || !c.hypernym_ko.trim() || !c.description.trim()));
                    return (
                      <button
                        onClick={() => incomplete.length
                          ? showConfirm(`보완이 필요한 구성요소 ${incomplete.length}개(${incomplete.map(c => c.value_ko || '(이름 없음)').slice(0, 3).join(', ')}${incomplete.length > 3 ? ' 외' : ''})가 있습니다. 영문명·상위어·정의가 비어 있으면 청구항·명세서에 그대로 반영됩니다. 그대로 진행할까요?`, () => confirm('components'))
                          : confirm('components')}
                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-brand-500 transition-colors"
                      >다음 →</button>
                    );
                  }
                  if (curStep === 'images') {
                    // 선택 이미지 0개면 확인 후 진행 — 이후 도면·도면 설명이 비게 됨을 알린다 (A5)
                    const inc = context.drawings.filter(d => d.included !== false).length;
                    return (
                      <button
                        onClick={() => inc === 0
                          ? showConfirm('선택한 이미지가 없습니다. 이미지 없이 진행하면 명세서 도면과 도면 설명이 비게 됩니다. 계속할까요?', () => confirm('images'))
                          : confirm('images')}
                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-brand-500 transition-colors"
                      >{inc === 0 ? '이미지 없이 다음 →' : '다음 →'}</button>
                    );
                  }
                  const canGo = isSpecialStep(curStep) || !!gSel[curStep]?.trim();
                  return (
                    <button
                      onClick={() => { if (canGo) confirm(curStep); }}
                      disabled={!canGo}
                      className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand-400 rounded-xl hover:bg-brand-500 disabled:opacity-40 transition-colors"
                    >다음 →</button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        </div>

        {/* 명세서 생성 진행 오버레이 — 중간명세서 → 에디터 (세부 단계·진행 바 없이 '작성 중' 표시만) */}
        {specGen && (
          <div className="fixed inset-0 z-[60] bg-white/92 backdrop-blur-sm flex items-center justify-center px-4" data-spec="SPC-WIZ-080" role="dialog" aria-modal="true" aria-labelledby="specgen-title">
            <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white shadow-xl px-6 py-7 text-center">
              <span className="mx-auto mb-4 block w-10 h-10 border-[3px] border-brand-200 border-t-brand-400 rounded-full animate-spin" aria-hidden="true" />
              <h3 id="specgen-title" className="text-base2 font-bold text-neutral-800">명세서를 작성하고 있습니다</h3>
              <p className="mt-1.5 text-xs2 text-neutral-500">완료되면 에디터로 자동 이동합니다.</p>
              <button
                type="button"
                data-spec="SPC-WIZ-080" onClick={cancelSpecGeneration}
                className="mt-5 inline-flex items-center h-8 px-3 rounded-lg text-xs2 text-neutral-500 border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
              >취소</button>
            </div>
          </div>
        )}

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
            summary={STEPS.filter(st => confirmed[st.id] && STEP_LABEL[st.id]).map(st => ({ label: STEP_LABEL[st.id]!, value: doneSummary(st.id) }))}
            mobileOpen={mobileGuideOpen}
            onMobileClose={() => setMobileGuideOpen(false)}
            chatInputRef={guidePanelInputRef}
          />
        )}

        {/* 모바일 전용: AI 어시스턴트 FAB */}
        {(phase === 'flow' || phase === 'done') && (
          <button
            className="md:hidden fixed bottom-20 right-4 z-30 bg-brand-400 text-white rounded-full px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform"
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
    <div data-spec="SPC-WIZ-030" className="flex items-start gap-2.5 border-l-2 border-brand-200 pl-3">
      <div className="text-md2 text-neutral-500 leading-relaxed py-0.5">
        {text}
      </div>
    </div>
  );
}

// ── GuidePanel 공유 타입 ────────────────────────────────────────
// AI 수정은 본문 내 삽입형(인라인)으로 통일 — GuidePanel은 단계 안내 Q&A 전용
type GuideChatMsg = {
  id: number;
  role: 'user' | 'ai';
  text: string;
  intent?: AgentIntent;                 // 라우팅된 의도
  intentOptions?: string[];             // clarify 선택지
  sourceMsg?: string;
};

// ── 덮어쓰기 확인 — 재생성·재분석처럼 편집 내용을 대체하는 동작 (중간명세서 '다시 생성'과 같은 규칙) ──
function confirmOverwrite(title: string, description: string, confirmLabel: string, onConfirm: () => void) {
  openAlertDialog(
    { title, description, confirm: confirmLabel, cancel: '취소' },
    { theme: 'primary', onConfirm: (ctrl) => { ctrl.close(); onConfirm(); } },
  );
}

// ── 삭제 확인 (정책: 모든 삭제는 확인 다이얼로그) ─────────────────────────
function confirmDelete(what: string, onOk: () => void, detail?: string) {
  openAlertDialog(
    { title: `${what} 삭제`, description: detail ?? `${withParticle(what, '을', '를')} 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.`, confirm: '삭제', cancel: '취소' },
    { theme: 'danger', onConfirm: (ctrl) => { ctrl.close(); onOk(); } },
  );
}

// ── AI 수정 공통 UI (일관성: 동일 역할 버튼은 동일 형태·위치) ────────────────
// - AiEditButton: 항목 단위 'AI 수정' 토글 — 항목 헤더 행의 우측 끝(ml-auto)에 배치
// - AiGlobalBar : 단계 전체 대상 지시 입력 + '전체 AI 수정' — 목록 상단에 배치
// 색상은 brand(#3B8EF5) 계열로 통일 (index.css btn-primary 규약)
const AiIcon = ({ size = 9, className }: { size?: number; className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" width={size} height={size} aria-hidden="true"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
);

function AiEditButton({ active, onClick, title = 'AI 수정', className }: {
  active?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
}) {
  return (
    <button data-spec="SPC-WIZ-091"
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={!!active}
      className={clsx(
        'shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs2 font-medium border transition-colors',
        active
          ? 'bg-brand-400 border-brand-400 text-white'
          : 'text-brand-500 border-brand-200 bg-white hover:bg-brand-50 hover:border-brand-300',
        className,
      )}
    >
      <AiIcon />
      AI 수정
    </button>
  );
}

// ── AI 수정 제안 확인 (사람이 확인 → 적용) ───────────────────────────────────
// 데모(10.77.0.133:8002) renderPendingInto 정합: 제목 · N건 · 지시사항 · 항목별 Before/After · 설명(✦) · [취소][적용]
// AI_EDIT_CONFIRM=false 로 바꾸면 확인 없이 즉시 반영(데모의 항목별 AI 수정 동작)으로 전환된다 — 호출부 수정 불필요.
const AI_EDIT_CONFIRM = true;
const AI_MOCK_DELAY_MS = 800;

export type PendingChange = {
  tag: '수정' | '추가' | '삭제';
  label?: string;
  before?: string;
  after?: string;
  explanation?: string;
  apply?: () => void;   // 적용 시 실행 (호출부 내부용, 렌더되지 않음)
};

// mock 제안 생성 — 단일 텍스트 항목
function proposeMock(original: string, instruction: string, label?: string, apply?: (next: string) => void): PendingChange {
  const after = generateMockModification(original, instruction);
  return {
    tag: '수정', label, before: original, after,
    explanation: `"${instruction.slice(0, 30)}${instruction.length > 30 ? '…' : ''}" 지시를 반영해 표현을 보완했습니다.`,
    apply: apply ? () => apply(after) : undefined,
  };
}

function AiPendingCard({ title, instruction, changes, onApply, onCancel, className }: {
  title: string;
  instruction: string;
  changes: PendingChange[];
  onApply: () => void;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <div data-spec="SPC-WIZ-093" className={clsx('rounded-lg border border-brand-200 bg-white overflow-hidden', className)} onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50/60 border-b border-brand-100">
        <AiIcon />
        <span className="text-xs2 font-semibold text-brand-600 shrink-0 whitespace-nowrap">{title}</span>
        <span className="text-xs2 text-neutral-500 truncate">{changes.length}건 · 지시사항: {instruction}</span>
      </div>
      <div className="divide-y divide-neutral-100 max-h-[320px] overflow-y-auto scroll-thin">
        {changes.map((c, i) => (
          <div key={i} className="px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={clsx(
                'text-xs2 font-bold px-1.5 py-0.5 rounded-md',
                c.tag === '추가' ? 'bg-green-50 text-green-700' : c.tag === '삭제' ? 'bg-red-50 text-red-600' : 'bg-neutral-50 text-neutral-700',
              )}>{c.tag}</span>
              {c.label && <span className="text-xs2 font-semibold text-neutral-700">{c.label}</span>}
            </div>
            {c.before && c.after ? (
              /* 한 문장 안에서 변경부만 강조 — 삭제(취소선)·추가(강조) (U16) */
              <p className="text-sm2 leading-relaxed text-neutral-800 whitespace-pre-wrap"><DiffText segs={diffWords(c.before, c.after).merged} mode="merged" /></p>
            ) : (<>
              {c.before && (
                <p className="text-sm2 leading-relaxed text-neutral-400 line-through decoration-neutral-300 whitespace-pre-wrap">{c.before}</p>
              )}
              {c.after && (
                <p className="text-sm2 leading-relaxed text-neutral-800 bg-green-50/60 rounded-md px-2 py-1 whitespace-pre-wrap">{c.after}</p>
              )}
            </>)}
            {c.explanation && <p className="text-xs2 text-brand-500">✦ {c.explanation}</p>}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-neutral-100 bg-neutral-50/60">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center h-7 px-2.5 rounded-lg text-xs2 text-neutral-500 border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
        >취소</button>
        <button
          type="button"
          onClick={onApply}
          disabled={!changes.length}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs2 font-semibold bg-brand-400 text-white hover:bg-brand-500 disabled:opacity-40 transition-colors"
        >적용</button>
      </div>
    </div>
  );
}

// 전체(단계 범위) AI 수정 바 — 입력 → 제안 생성(mock 지연) → AiPendingCard 확인 → 적용
function AiGlobalBar({ placeholder, value, onChange, propose, onApply, title, doneMsg, disabled, className }: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  propose: (instruction: string) => PendingChange[];   // 지시사항 → 변경 제안 목록 (mock)
  onApply?: (changes: PendingChange[]) => void;        // 기본: 각 change.apply 실행
  title: string;                                       // 제안 카드 제목 (예: 발명 설명 수정 제안)
  doneMsg?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ instruction: string; changes: PendingChange[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const applyChanges = (changes: PendingChange[]) => {
    if (onApply) onApply(changes); else changes.forEach(c => c.apply?.());
    toast(doneMsg ?? '적용했습니다');
    setPending(null);
    setStatus(null);
    onChange('');
  };
  const submit = () => {
    const instruction = value.trim();
    if (!instruction || busy || disabled) return;
    setBusy(true);
    setStatus(null);
    setPending(null);
    setTimeout(() => {
      const changes = propose(instruction);
      setBusy(false);
      if (!changes.length) { setStatus('변경이 필요 없다고 판단했습니다'); return; }
      if (!AI_EDIT_CONFIRM) { applyChanges(changes); return; }
      setPending({ instruction, changes });
    }, AI_MOCK_DELAY_MS);
  };
  return (
    <div data-spec="SPC-WIZ-092" className={clsx('space-y-2', className)}>
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 min-w-0 text-xs2 h-8 px-3 border border-neutral-200 rounded-lg bg-white outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus:border-brand-400 focus:ring-[3px] focus:ring-brand-400/15 transition-all disabled:bg-neutral-50"
          placeholder={placeholder}
          value={value}
          disabled={busy || disabled}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || busy || disabled}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs2 font-semibold bg-brand-400 text-white hover:bg-brand-500 disabled:opacity-40 transition-colors"
        >
          {busy ? (
            <><span className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin inline-block" /> 수정안 생성 중...</>
          ) : (
            <><AiIcon /> 전체 AI 수정</>
          )}
        </button>
      </div>
      {status && <p className="text-xs2 text-neutral-500 px-1">{status}</p>}
      {pending && (
        <AiPendingCard
          title={title}
          instruction={pending.instruction}
          changes={pending.changes}
          onApply={() => applyChanges(pending.changes)}
          onCancel={() => { setPending(null); setStatus('수정을 적용하지 않았습니다'); }}
        />
      )}
    </div>
  );
}

// ── 본문 내 삽입형(인라인) AI 수정 입력 ─────────────────────────────────────
// 데모 정합: 카드/블록의 'AI 수정' 클릭 → 그 자리에서 지시 입력 + 수정 요청/취소.
// 사이드패널을 사용하지 않고, 요청 후 해당 항목만 교체된다.
type InlineAiTarget = { original: string; label: string; onApply: (next: string) => void };
function InlineAiEdit({ placeholder, original, label, onApply, targets, onClose, doneMsg }: {
  placeholder: string;
  original?: string;                     // 수정 대상 원문 (단일 대상)
  label?: string;                        // 제안 카드 항목명 (예: 발명의 명칭)
  onApply?: (next: string) => void;      // 적용 시 호출 (단일 대상)
  targets?: InlineAiTarget[];            // 다중 대상 (예: 명칭 + 개요를 한 번에) — 지정 시 original/onApply 대신 사용 (B1)
  onClose: () => void;
  doneMsg?: string;
}) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ instruction: string; changes: PendingChange[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const list: InlineAiTarget[] = targets ?? [{ original: original ?? '', label: label ?? '항목', onApply: onApply ?? (() => {}) }];
  const apply = (changes: PendingChange[]) => {
    changes.forEach(c => c.apply?.());
    toast(doneMsg ?? '항목을 수정했습니다');
    onClose();
  };
  const submit = () => {
    const instr = instruction.trim();
    if (!instr || busy) return;
    setBusy(true);
    setStatus(null);
    setTimeout(() => {
      const changes = list.map(t => proposeMock(t.original, instr, t.label, t.onApply));
      setBusy(false);
      if (!AI_EDIT_CONFIRM) { apply(changes); return; }
      setPending({ instruction: instr, changes });
    }, AI_MOCK_DELAY_MS);
  };
  if (pending) {
    return (
      <AiPendingCard
        className="mt-1.5"
        title={`${targets ? targets.map(t => t.label).join('·') : (label ?? '항목')} 수정 제안`}
        instruction={pending.instruction}
        changes={pending.changes}
        onApply={() => apply(pending.changes)}
        onCancel={() => { setPending(null); setStatus('수정을 적용하지 않았습니다 — 지시를 고쳐 다시 요청할 수 있습니다'); }}
      />
    );
  }
  return (
    <div data-spec="SPC-WIZ-091" className="mt-1.5 rounded-lg border border-brand-200 bg-brand-50/50 p-2" onClick={e => e.stopPropagation()}>
      <textarea
        autoFocus
        className="w-full text-xs2 bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-400 focus:ring-[3px] focus:ring-brand-400/15 transition-all resize-none min-h-[40px]"
        placeholder={placeholder}
        rows={2}
        value={instruction}
        disabled={busy}
        onChange={e => setInstruction(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
      />
      <div className="flex items-center gap-1.5 mt-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={!instruction.trim() || busy}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs2 font-semibold bg-brand-400 text-white hover:bg-brand-500 disabled:opacity-40 transition-colors"
        ><AiIcon /> 수정 요청</button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="inline-flex items-center h-7 px-2.5 rounded-lg text-xs2 text-neutral-500 border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-40 transition-colors"
        >취소</button>
        {busy && (
          <span className="flex items-center gap-1 text-xs2 text-brand-500 ml-1">
            <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin inline-block" />
            수정안을 만들고 있습니다...
          </span>
        )}
        {!busy && status && <span className="text-xs2 text-neutral-500 ml-1">{status}</span>}
      </div>
    </div>
  );
}


// ── 발명의 명칭 후보 카드 (title + abstract) ──────────────────────
function TitleCandidateCards({
  candidates, gSel, setGSel, onRegenerate, onSummaryChange,
}: {
  candidates: TitleCandidate[];
  gSel: Partial<Record<StepId, string>>;
  setGSel: React.Dispatch<React.SetStateAction<Partial<Record<StepId, string>>>>;
  onRegenerate?: () => void;
  onSummaryChange?: (summary: string) => void;   // 선택된 후보/직접 입력의 개요를 InventionContext.summary로 전파 (A9)
}) {
  const curSel = gSel['title'] || '';
  const [titleEdits, setTitleEdits] = useState<Record<string, string>>({});
  const [abstractEdits, setAbstractEdits] = useState<Record<string, string>>({});
  const [directAbstract, setDirectAbstract] = useState('');
  // 인라인 AI 수정 — 열린 카드 키 (`${후보id}`; 명칭+개요를 한 번에 수정) (B1)
  const [aiKey, setAiKey] = useState<string | null>(null);

  useEffect(() => {
    if (!gSel['title'] && candidates[0]) {
      setGSel(p => ({ ...p, title: candidates[0].title }));
    }
  }, [candidates.length]);

  const isFromCandidates = (val: string) =>
    candidates.some(c => (titleEdits[c.id] ?? c.title) === val || c.title === val);

  // 선택 변화·개요 편집 시 요약(개요) 전파 — 직접 입력이면 직접 입력 개요, 후보면 그 후보의 개요
  const summaryRef = useRef(onSummaryChange);
  useEffect(() => { summaryRef.current = onSummaryChange; });
  useEffect(() => {
    const sel = candidates.find(c => (titleEdits[c.id] ?? c.title) === curSel || c.title === curSel);
    summaryRef.current?.(sel ? (abstractEdits[sel.id] ?? sel.summary) : directAbstract);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curSel, abstractEdits, titleEdits, directAbstract, candidates]);

  return (
    <div className="space-y-2 mt-3">
      {candidates.map(c => {
        const titleVal = titleEdits[c.id] ?? c.title;
        const abstractVal = abstractEdits[c.id] ?? c.summary;
        const isSelected = curSel === titleVal || curSel === c.title;
        return (
          <div
            key={c.id}
            onClick={() => setGSel(p => ({ ...p, title: titleVal }))}
            className={clsx(
              'rounded-xl border-2 p-3 cursor-pointer transition-all bg-white',
              isSelected && 'border-brand-400 bg-brand-50/60 shadow-sm',
              !isSelected && 'border-neutral-200 hover:border-brand-300 hover:bg-brand-50/30',
            )}
          >
            {/* 카드 헤더 — 라디오 + 명칭(선택 라벨) + AI 수정 (기호 라벨 없음: 명칭 자체가 선택 항목) */}
            <div className="flex items-center gap-2">
              <span className={clsx(
                'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0',
                isSelected ? 'border-brand-400 bg-brand-400' : 'border-neutral-300 bg-white',
              )}>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              <p className="flex-1 min-w-0 text-sm2 font-semibold text-neutral-800 leading-snug">{titleVal}</p>
              {/* 카드당 AI 수정 1개 — 명칭·개요를 한 번에 지시 (데모 "명칭·개요를 어떻게 수정할지" 정합) (B1) */}
              <AiEditButton
                active={aiKey === c.id}
                title="명칭과 요약을 AI로 수정"
                onClick={e => {
                  e.stopPropagation();
                  setGSel(p => ({ ...p, title: titleVal }));
                  setAiKey(k => k === c.id ? null : c.id);
                }}
              />
            </div>
            {/* 개요 행 */}
            <div className="pt-1.5 mt-1.5 border-t border-neutral-100">
              <span className="text-xs2 text-neutral-400 font-medium block mb-0.5">요약</span>
              <p className="text-sm2 text-neutral-600 leading-relaxed">{abstractVal}</p>
            </div>
            {aiKey === c.id && (
              <InlineAiEdit
                placeholder="명칭·요약을 어떻게 수정할지 지시해주세요 (예: 방법(method) 청구 관점으로 바꿔줘)"
                onClose={() => setAiKey(null)}
                targets={[
                  { original: titleVal, label: '발명의 명칭', onApply: newText => { setTitleEdits(prev => ({ ...prev, [c.id]: newText })); setGSel(p => ({ ...p, title: newText })); } },
                  { original: abstractVal, label: '요약', onApply: newText => setAbstractEdits(prev => ({ ...prev, [c.id]: newText })) },
                ]}
                doneMsg="명칭·요약을 수정했습니다"
              />
            )}
            {/* 추천 이유 행 */}
            {c.reason && (
              <div data-spec="SPC-TTL-013" className="pt-1.5 border-t border-neutral-100 mt-1">
                <span className="text-xs2 text-neutral-300 font-medium block mb-0.5">추천 이유</span>
                <p className="text-xs2 text-neutral-400 leading-relaxed italic">{c.reason}</p>
              </div>
            )}
          </div>
        );
      })}
      <div className={clsx(
        'rounded-xl border-2 p-3 bg-white transition-all',
        !isFromCandidates(curSel) && curSel.trim() ? 'border-brand-400 bg-brand-50/60' : 'border-neutral-200',
      )}>
        <div data-spec="SPC-TTL-020" className="flex items-center gap-2 mb-1.5">
          <span className={clsx(
            'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0',
            !isFromCandidates(curSel) && curSel.trim() ? 'border-brand-400 bg-brand-400' : 'border-neutral-300 bg-white',
          )}>
            {!isFromCandidates(curSel) && curSel.trim() && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
          </span>
          <span className="text-xs2 text-neutral-500 font-semibold">직접 입력</span>
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
        {/* 직접 입력 개요 — 요약서의 원천. 후보 카드와 동일하게 명칭+개요 쌍으로 입력 (A9) */}
        <div className="pt-1.5 mt-1 border-t border-neutral-100">
          <span className="text-xs2 text-neutral-400 font-medium block mb-0.5">요약 <span className="text-neutral-300">(선택 — 요약서에 반영)</span></span>
          <textarea
            className="w-full text-sm2 text-neutral-700 bg-transparent outline-none resize-none leading-relaxed"
            placeholder="발명의 요약을 1~2문장으로 입력하세요"
            value={directAbstract}
            onChange={e => setDirectAbstract(e.target.value)}
            onClick={e => e.stopPropagation()}
            rows={2}
          />
        </div>
      </div>
      {onRegenerate && (
        <div className="flex justify-end">
          <button data-spec="SPC-TTL-030"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs2 font-medium text-brand-500 border border-brand-200 bg-white hover:bg-brand-50 transition-colors"
          >↻ 후보 다시 생성</button>
        </div>
      )}
    </div>
  );
}

// ── 발명의 설명 항목 카드 (제안기술 / 종래기술 그룹) ──────────────────
const DESC_LABEL_MAP: Record<string, string> = {
  background: '배경기술', implementation: '구성', objective: '목적', effect: '효과', etc: '기타',
};

function DescriptionItemCards({
  previous, proposed, onToggle, onChange, onAdd, onRemove, onReorder, onMoveAcross, onRegenerate,
}: {
  previous: InventionDescriptionItem[];
  proposed: InventionDescriptionItem[];
  onToggle: (type: 'previous' | 'proposed', idx: number) => void;
  onChange: (type: 'previous' | 'proposed', idx: number, text: string) => void;
  onAdd: (type: 'previous' | 'proposed', text: string, label: InventionDescriptionItem['label']) => void;
  onRemove: (type: 'previous' | 'proposed', idx: number) => void;
  onReorder: (type: 'previous' | 'proposed', from: number, to: number) => void;
  onMoveAcross: (fromType: 'previous' | 'proposed', fromIdx: number, toIdx?: number) => void;
  onRegenerate?: () => void;   // 다시 정제 — API /v2/generate/context/description/refined
}) {
  const [tab, setTab] = useState<'previous' | 'proposed'>('proposed');
  // 인라인 AI 수정 — 열린 카드 키 (`${type}-${idx}`)
  const [aiKey, setAiKey] = useState<string | null>(null);
  // 전체 AI 수정 바 (데모: "발명 설명 전반에 대한 AI 지시사항" + 전체 AI 수정)
  const [globalInstr, setGlobalInstr] = useState('');
  // 전체 AI 수정 제안 — 채택된 텍스트 항목 전부에 지시 반영 (표 항목 제외). 확인 후 적용은 AiGlobalBar가 담당.
  const proposeGlobal = (instr: string): PendingChange[] =>
    (['proposed', 'previous'] as const).flatMap(type => {
      const items = type === 'proposed' ? proposed : previous;
      return items.flatMap((item, idx) => {
        if (item.adopted === false || item.type === 'table') return [];
        const secKo = type === 'proposed' ? '제안기술' : '종래기술';
        return [proposeMock(item.content, instr, `${secKo} · ${DESC_LABEL_MAP[item.label] ?? item.label}`, next => onChange(type, idx, next))];
      });
    });
  const [dragSrc, setDragSrc] = useState<{ type: 'previous' | 'proposed'; idx: number } | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const handleDrop = (toType: 'previous' | 'proposed', toIdx: number) => {
    if (!dragSrc) return;
    if (dragSrc.type === toType) { if (dragSrc.idx !== toIdx) onReorder(toType, dragSrc.idx, toIdx); }
    else onMoveAcross(dragSrc.type, dragSrc.idx, toIdx);
    setDragSrc(null); setDropHint(null);
  };
  const [addLabel, setAddLabel] = useState<{ previous: InventionDescriptionItem['label']; proposed: InventionDescriptionItem['label'] }>({
    previous: 'background',
    proposed: 'objective',
  });
  const [addTexts, setAddTexts] = useState({ previous: '', proposed: '' });

  if (previous.length === 0 && proposed.length === 0) {
    return (
      <div className="mt-3 text-center py-6 text-neutral-400">
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
          accent === 'blue' ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-700',
        )}>
          <span>{type === 'proposed' ? '제안기술' : '종래기술'}</span>
          <span className="opacity-60 font-normal">채택 {items.filter(i => i.adopted !== false).length}/{items.length}</span>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => {
            const isAdopted = item.adopted !== false;
            const isAiItem = item.adopted !== undefined;
            // 표시 라벨 — 특허 문법 용어로 (제안: 목적·구성(해결수단)·효과 / 종래: 배경기술·종래 구성·문제점) (B4). API 라벨은 유지
            const sublabel = item.label === 'implementation'
              ? (type === 'previous' ? '종래 구성' : '구성(해결수단)')
              : (DESC_LABEL_MAP[item.label] ?? item.label);
            return (
              <div
                key={idx}
                onDragOver={e => { if (dragSrc) { e.preventDefault(); setDropHint(`${type}-${idx}`); } }}
                onDrop={() => handleDrop(type, idx)}
                className={clsx(
                  'group rounded-xl border p-3.5 bg-white transition-all',
                  // 기본 상태는 중립 테두리 — 색 테두리는 편집/선택 상태 전용 (심미성 C2)
                  isAdopted ? 'border-neutral-200 hover:border-neutral-300' : 'border-neutral-200 opacity-50',
                  dragSrc && dropHint === `${type}-${idx}` && !(dragSrc.type === type && dragSrc.idx === idx) && 'ring-2 ring-brand-400 ring-offset-1',
                  dragSrc && dragSrc.type === type && dragSrc.idx === idx && 'opacity-30',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {/* 채택 체크박스 — 카드 선두(항목 단위 선택), 구성요소 패널과 동일 */}
                  {isAiItem ? (
                    <button
                      onClick={() => onToggle(type, idx)}
                      className={clsx(
                        'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                        isAdopted
                          ? 'bg-brand-400 border-brand-400 text-white'
                          : 'border-neutral-400 bg-white hover:border-brand-400',
                      )}
                      data-spec="SPC-DSC-011" title={isAdopted ? '채택 해제' : '채택'}
                      aria-label={isAdopted ? '채택됨' : '채택'}
                    >
                      {isAdopted && <Icon name="check" size={10} />}
                    </button>
                  ) : (
                    <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-neutral-300" aria-hidden="true">—</span>
                  )}
                  <span
                    draggable
                    onDragStart={() => setDragSrc({ type, idx })}
                    onDragEnd={() => { setDragSrc(null); setDropHint(null); }}
                    className="flex items-center gap-0.5 text-neutral-400 hover:text-brand-500 hover:bg-brand-50 cursor-grab active:cursor-grabbing shrink-0 select-none text-xs2 leading-none px-1 py-0.5 rounded-md border border-neutral-200 hover:border-brand-300 transition-colors"
                    data-spec="SPC-DSC-012" title="끌어서 순서 변경 (반대편 기술로도 끌어 놓을 수 있음)"
                    aria-label="끌어서 순서 변경"
                  >
                    <svg viewBox="0 0 10 10" width="11" height="11" fill="currentColor"><circle cx="3" cy="2" r="1"/><circle cx="7" cy="2" r="1"/><circle cx="3" cy="5" r="1"/><circle cx="7" cy="5" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="7" cy="8" r="1"/></svg>
                  </span>
                  <span className="text-xs2 text-neutral-400 font-medium">{sublabel}</span>
                  <div className={clsx('ml-auto flex items-center gap-0.5 shrink-0 transition-opacity',
                    aiKey === `${type}-${idx}` ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}>
                    <button onClick={() => onReorder(type, idx, idx - 1)} disabled={idx === 0}
                      className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-colors" title="위로">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 7l3-4 3 4"/></svg>
                    </button>
                    <button onClick={() => onReorder(type, idx, idx + 1)} disabled={idx === items.length - 1}
                      className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-colors" title="아래로">
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 3l3 4 3-4"/></svg>
                    </button>
                    {isAdopted && item.type !== 'table' ? (
                      <AiEditButton
                        active={aiKey === `${type}-${idx}`}
                        onClick={() => setAiKey(k => k === `${type}-${idx}` ? null : `${type}-${idx}`)}
                      />
                    ) : (
                      /* 표 항목·미채택: AI 수정 자리(폭)를 비워 두어 우측 버튼 열이 카드마다 흔들리지 않게 (B11) */
                      <span className="inline-block w-[64px] h-6 shrink-0" aria-hidden="true" />
                    )}
                    {/* 반대편 기술로 보내기 — 헤더에 배치해 카드 높이 절감 (B3) */}
                    <button data-spec="SPC-DSC-012"
                      onClick={() => onMoveAcross(type, idx)}
                      className={clsx(
                        'inline-flex items-center h-6 px-2 rounded-lg text-xs2 font-medium border transition-colors',
                        'text-neutral-500 border-transparent hover:bg-neutral-100 hover:text-neutral-700',
                      )}
                      title={type === 'previous' ? '이 항목을 제안기술 목록으로 보냅니다' : '이 항목을 종래기술 목록으로 보냅니다'}
                    >{type === 'previous' ? '← 제안기술로' : '종래기술로 →'}</button>
                    {!isAiItem && <button
                        data-spec="SPC-DSC-015" onClick={() => confirmDelete('항목', () => onRemove(type, idx), item.content.trim() ? `"${item.content.trim().slice(0, 40)}${item.content.trim().length > 40 ? '…' : ''}" 항목을 삭제할까요?` : undefined)}
                        className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="삭제"
                    >✕</button>}
                  </div>
                </div>
                {item.type === 'table' ? (
                  // API InventionDescriptionItem type='table' — 표 항목 (데모 정합: 표 캡션 + 표 렌더)
                  <div className={clsx(!isAdopted && 'opacity-60')}>
                    {item.caption && (
                      <p className="text-xs2 text-neutral-500 mb-1">
                        <span className="px-1 py-0.5 rounded-md bg-neutral-100 text-neutral-500 font-semibold mr-1">표 캡션</span>
                        {item.caption}
                      </p>
                    )}
                    <div
                      className="desc-table overflow-x-auto text-xs2 text-neutral-700 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1"
                      dangerouslySetInnerHTML={{ __html: item.content }}
                    />
                  </div>
                ) : (
                <textarea
                  className="w-full text-base2 text-neutral-700 leading-relaxed bg-transparent outline-none resize-none overflow-hidden"
                  value={item.content}
                  disabled={!isAdopted}
                  rows={1}
                  onChange={e => onChange(type, idx, e.target.value)}
                  data-spec="SPC-DSC-013" placeholder="항목 내용..."
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                />
                )}
                {aiKey === `${type}-${idx}` && (
                  <InlineAiEdit
                    placeholder="어떻게 수정할지 지시해주세요 (예: 구성요소의 결합 관계를 더 구체적으로 써줘)"
                    onClose={() => setAiKey(null)}
                    original={item.content}
                    label="발명 설명 항목"
                    onApply={newText => onChange(type, idx, newText)}
                  />
                )}
              </div>
            );
          })}
          {/* 항목 추가 행 */}
          <div className={clsx(
            'rounded-xl border-2 border-dashed p-2.5 transition-colors',
            accent === 'blue' ? 'border-brand-200 focus-within:border-brand-400' : 'border-neutral-200 focus-within:border-neutral-400',
          )}>
            <div className="flex items-center gap-2 mb-1.5">
              <select
                data-spec="SPC-DSC-016" value={addLabel[type]}
                onChange={e => setAddLabel(p => ({ ...p, [type]: e.target.value as InventionDescriptionItem['label'] }))}
                className="text-xs2 border border-neutral-200 rounded-md px-1.5 py-0.5 bg-white text-neutral-600 outline-none"
              >
                <option value="background">배경기술</option>
                <option value="implementation">구성(해결수단)</option>
                <option value="etc">기타</option>
                <option value="objective">목적</option>
                <option value="effect">효과</option>
              </select>
            </div>
            <div className="flex gap-1.5 items-end">
              <textarea
                className="flex-1 text-sm2 bg-transparent outline-none resize-none text-neutral-700 placeholder-neutral-400 min-h-[40px]"
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
                  accent === 'blue' ? 'bg-brand-100 text-brand-700 hover:bg-brand-200' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
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
    <div className="mt-3">
      {/* 전체 AI 수정 바 — 데모 정합: 발명 설명 전반에 대한 지시 */}
      <AiGlobalBar
        className="mb-3"
        title="발명 설명 수정 제안"
        placeholder="발명 설명 전반에 대한 AI 지시사항 (예: 종래 기술의 문제점을 배경/한계로 나눠서 정리해줘)"
        value={globalInstr}
        onChange={setGlobalInstr}
        propose={proposeGlobal}
        doneMsg="발명 설명에 적용했습니다"
      />
      {onRegenerate && (
        <div className="flex justify-end">
          <button data-spec="SPC-DSC-030"
            onClick={() => confirmOverwrite('발명 설명 다시 정제', '채택·편집한 항목이 정제된 새 항목으로 대체됩니다. 계속할까요?', '다시 정제', onRegenerate)}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs2 font-medium text-brand-500 border border-brand-200 bg-white hover:bg-brand-50 transition-colors"
            title="추출 원천 정보를 AI가 다시 정제합니다 (API description/refined)"
          >↻ 다시 정제</button>
        </div>
      )}
      {/* lg+: 2컬럼 */}
      <div className="max-lg:hidden lg:grid lg:grid-cols-2 lg:gap-4">
        {renderColumn('proposed', proposed)}
        {renderColumn('previous', previous)}
      </div>
      {/* lg 미만: 탭 */}
      <div className="lg:hidden">
        <div className="flex border-b border-neutral-200 mb-3">
          {(['proposed', 'previous'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700',
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

function GuidePanel({ step, confirmed, summary, mobileOpen, onMobileClose, chatInputRef }: {
  step: StepId;
  confirmed: Partial<Record<StepId, string>>;
  summary?: { label: string; value: string }[];   // 지금까지 확정된 내용 (데모 InventionContext 패널 정합) (U12)
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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

  useEffect(() => {
    const el = (chatInputRef?.current ?? localTextareaRef.current);
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [guideChatInput, chatInputRef]);

  const QA_REPLIES: Record<string, string> = {
    '청구항': '청구항은 특허 보호 범위를 정의합니다. 독립항과 종속항으로 구성됩니다.',
    '명칭': '발명의 명칭은 발명의 핵심 기술을 간결하게 표현해야 합니다.',
    '구성요소': '구성요소는 발명의 각 기술 요소를 분리하여 도면 부호와 함께 기재합니다.',
    '도면': '도면은 발명의 구성요소를 시각화하며, 각 부호(100, 200...)로 연결됩니다.',
  };

  const pushGuideAi = (partial: Omit<GuideChatMsg, 'id' | 'role'>) => {
    setGuideChatMsgs(prev => [...prev, { id: ++guideChatIdRef.current, role: 'ai', ...partial }]);
    setTimeout(() => guideChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const sendGuideChat = (override?: string) => {
    const msg = (override ?? guideChatInput).trim();
    if (!msg) return;
    if (!override) setGuideChatInput('');
    setGuideChatMsgs(prev => [...prev, { id: ++guideChatIdRef.current, role: 'user', text: msg }]);

    setTimeout(() => {
      const route = routeIntent(msg, { hasSelection: false });
      if (route.intent === 'terminate') { pushGuideAi({ text: route.answer ?? '요청하신 작업은 지원하지 않습니다.', intent: 'terminate' }); return; }
      if (route.intent === 'plan') {
        // 어시스턴트 모드는 단계 안내 전용 — 다단계 플랜은 명세서 에디터에서 진행
        pushGuideAi({ text: '여러 단계 작업(플랜)은 명세서 에디터의 AI 어시스턴트에서 진행해 주세요.', intent: 'answer' });
        return;
      }
      if (route.intent === 'answer' || route.intent === 'replace_expression') {
        const matchKey = Object.keys(QA_REPLIES).find(k => msg.includes(k));
        const aiText = route.answer
          ?? (matchKey ? QA_REPLIES[matchKey]
            : `"${msg.slice(0, 20)}"에 대해 답변드립니다. 항목 내용 수정은 각 항목의 'AI 수정' 버튼으로 바로 요청할 수 있습니다.`);
        pushGuideAi({ text: aiText, intent: 'answer' });
        return;
      }
      // 수정 지시 — 인라인 AI 수정으로 안내 (사이드패널에서 직접 수정하지 않음)
      pushGuideAi({ text: '항목 수정은 본문 각 항목의 "AI 수정" 버튼을 눌러 그 자리에서 지시해 주세요. 여기서는 단계 진행과 작성 방법에 대해 답변드립니다.', intent: 'answer' });
    }, 500);
  };

  const selectGuideIntent = (msgId: number, opt: string) => {
    const msg = guideChatMsgs.find(m => m.id === msgId);
    setGuideChatMsgs(prev => prev.map(m => m.id === msgId ? { ...m, intentOptions: undefined, text: `[${opt}] 선택됨` } : m));
    setTimeout(() => {
      pushGuideAi({ text: `"${msg?.sourceMsg ?? opt}" 기준으로 안내드립니다. 항목 내용 수정은 각 항목의 'AI 수정' 버튼을 이용해 주세요.`, intent: 'answer' });
    }, 300);
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
        <div className="w-8 h-1 bg-neutral-300 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
        <span className="font-semibold text-sm">AI 어시스턴트</span>
        <Button variant="text" size="icon-sm" onClick={onMobileClose} aria-label="가이드 닫기">
          <Icon name="close" size={16} />
        </Button>
      </div>

      {/* 리사이즈 핸들 — 원본 artifact-resize-handle (데스크탑에서만) */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400 z-10 transition-colors"
        style={{ background: 'transparent' }}
        title="패널 너비 조정"
      />

      {/* 헤더 — 스텝바(48px)와 수직 정렬, 데스크탑 단일 행 */}
      <div className="max-md:hidden md:flex shrink-0 items-center gap-2 px-4 border-b border-ck-border bg-neutral-50 ml-1.5" style={{ height: 48 }}>
        <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 bg-brand-400"><AiIcon size={10} /></div>
        <span className="text-sm font-bold text-neutral-800">AI 어시스턴트</span>
        {isDone && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            <Icon name="check" size={10} /> 확정됨
          </span>
        )}
      </div>
      {/* 모바일 헤더 — 기존 스타일 유지 */}
      <div className="md:hidden px-4 py-3 border-b border-ck-border bg-neutral-50 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs2 font-bold shrink-0 bg-brand-400"><AiIcon size={10} /></div>
          <span className="text-base2 font-bold text-neutral-800">AI 어시스턴트</span>
          <span className="text-xs2 text-neutral-400 font-medium">작성 안내</span>
          {isDone && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <Icon name="check" size={10} /> 확정됨
            </span>
          )}
        </div>
      </div>

      {/* ── 상단: 정보 영역(확정 내용) — 하단 대화 영역과 영역 제목 바로 구분 ── */}
      <div data-spec="SPC-AST-011" className="shrink-0 flex items-center gap-1.5 px-4 py-1 ml-1.5 bg-neutral-50 border-b border-ck-border">
        <Icon name="check" size={11} className="text-neutral-400" />
        <span className="text-xs2 font-semibold text-neutral-500 tracking-wide">확정 내용</span>
        {!!summary?.length && <span className="ml-auto text-xs2 text-neutral-400">{summary.length + 1}/{STEPS.length} 단계</span>}
      </div>
      {/* 지금까지 확정된 내용 — 데모 InventionContext 패널 정합 (U12) */}
      <div className="shrink-0 mx-3 mt-1 mb-1 ml-[18px] overflow-hidden">
        {summary && summary.length > 0 ? (
          <dl className="px-3 py-2 space-y-1.5">
            {summary.map(row => (
              <div key={row.label} className="grid grid-cols-[64px_1fr] gap-2 items-start">
                <dt className="text-xs2 text-neutral-400 leading-relaxed">{row.label}</dt>
                <dd className="text-xs2 text-neutral-700 leading-relaxed m-0 break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-3 py-2 text-xs2 text-neutral-400">단계를 확정하면 여기에 요약이 쌓입니다.</p>
        )}
      </div>
      <p className="shrink-0 mx-3 mb-2 ml-[18px] px-1 text-xs2 text-neutral-400">
        항목 수정은 각 항목의 <span className="text-brand-500 font-semibold">AI 수정</span> 버튼으로 그 자리에서 요청하세요.
      </p>

      {/* ── 하단: 대화 영역 — 영역 제목 바 ── */}
      <div data-spec="SPC-AST-012" className="shrink-0 flex items-center gap-1.5 px-4 py-1 ml-1.5 bg-neutral-50 border-y border-ck-border">
        <AiIcon size={11} className="text-neutral-400" />
        <span className="text-xs2 font-semibold text-neutral-500 tracking-wide">대화 · 작성 안내</span>
        <span className="ml-auto text-xs2 text-neutral-400">단계 진행·작성 방법 질문</span>
      </div>
      {/* 채팅 영역 — flex-1로 남은 공간 차지 */}
      <div data-spec="SPC-AST-010" className="flex-1 ml-1.5 bg-white flex flex-col overflow-hidden">
        {/* 메시지 이력 */}
        {guideChatMsgs.length > 0 && (
          <div className="flex-1 overflow-y-auto scroll-thin px-3 py-2 space-y-2 bg-neutral-50">
            {guideChatMsgs.map(m => (
              <div key={m.id} className={clsx('flex gap-1.5', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'ai' && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold text-white shrink-0 bg-brand-400"><AiIcon size={10} /></div>
                )}
                {m.role === 'user' ? (
                  <div className="rounded-xl px-2.5 py-1.5 text-xs2 leading-relaxed max-w-[85%] bg-brand-400 text-white">
                    {m.text}
                  </div>
                ) : (
                  <div data-spec="SPC-AST-030" className="rounded-xl text-xs2 leading-relaxed max-w-[85%] bg-neutral-200 text-neutral-800 overflow-hidden">
                    {m.intent && (
                      <div className="px-2.5 pt-1.5">
                        <span className={clsx('inline-block px-1.5 py-0.5 rounded-md text-xs2 font-semibold',
                          m.intent.startsWith('edit') ? 'bg-brand-100 text-brand-700'
                          : m.intent === 'clarify' ? 'bg-amber-100 text-amber-700'
                          : m.intent === 'terminate' ? 'bg-neutral-200 text-neutral-500'
                          : 'bg-green-100 text-green-700')}>
                          {INTENT_LABEL[m.intent]}
                        </span>
                      </div>
                    )}
                    <p className="px-2.5 pt-1 pb-1 whitespace-pre-wrap">{m.text}</p>
                    {/* clarify 방향 선택지 */}
                    {m.intentOptions && (
                      <div data-spec="SPC-AST-033" className="flex flex-wrap gap-1 px-2.5 pb-2">
                        {m.intentOptions.map((opt, i) => (
                          <button key={i}
                            onClick={() => selectGuideIntent(m.id, opt)}
                            className="px-2 py-0.5 text-xs2 border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors">
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={guideChatEndRef} />
          </div>
        )}
        {guideChatMsgs.length === 0 && (
          <div className="flex-1 px-3 py-3">
            <p className="text-xs2 text-neutral-400 mb-2">이런 것을 물어볼 수 있습니다</p>
            <div className="flex flex-col gap-1.5">
              {(GUIDE_EXAMPLES[step] ?? GUIDE_EXAMPLES.default).map(q => (
                <button key={q} type="button" onClick={() => sendGuideChat(q)}
                  className="text-left text-sm2 text-neutral-600 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 입력창 — 항상 표시 */}
        <div className="shrink-0 flex gap-2 items-end px-3 py-2">
          <Textarea
            ref={chatInputRef ?? localTextareaRef}
            rows={2}
            className="flex-1 px-3 py-2"
            data-spec="SPC-AST-050" placeholder="단계 진행·작성 방법을 질문하세요..."
            value={guideChatInput}
            onChange={e => setGuideChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGuideChat(); } }}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => sendGuideChat()}
            disabled={!guideChatInput.trim()}
            className="shrink-0 w-7 h-7 rounded-xl bg-brand-400 hover:bg-brand-500 text-white disabled:bg-transparent disabled:text-neutral-300 flex items-center justify-center transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" width="12" height="12">
              <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z" fill="currentColor" stroke="none"/>
            </svg>
          </button>
        </div>
      </div>

    </aside>
  );
}

// 구성요소 패널 (#20)
interface CompItem {
  id: string; num: string; depth: number; sel: boolean;  // id: InventionElement.id(UUID) 정합
  value_ko: string; value_en: string;          // 명칭 / 명칭 영문명
  hypernym_ko: string; hypernym_en: string;     // 상위어 / 상위어 영문명
  description: string;                          // 정의
}
const INIT_COMPS: CompItem[] = [
  { id: uid(), num: '', depth: 0, sel: true, value_ko: '데이터 수집부', value_en: 'Data Collector', hypernym_ko: '수집 장치', hypernym_en: 'Collecting Device', description: '라이다 센서로부터 3D 포인트 클라우드 데이터를 수집' },
  { id: uid(), num: '', depth: 0, sel: true, value_ko: '전처리부', value_en: 'Preprocessor', hypernym_ko: '처리 장치', hypernym_en: 'Processing Device', description: '노이즈 제거 및 다운샘플링을 통해 데이터 전처리 수행' },
  { id: uid(), num: '', depth: 0, sel: true, value_ko: '특징 추출부', value_en: 'Feature Extractor', hypernym_ko: '처리 장치', hypernym_en: 'Processing Device', description: 'PointNet++ 아키텍처를 적용하여 포인트 특징 추출' },
  { id: uid(), num: '', depth: 0, sel: true, value_ko: '인식부', value_en: 'Recognizer', hypernym_ko: '처리 장치', hypernym_en: 'Processing Device', description: '딥러닝 모델을 이용하여 객체 분류 및 위치 추정' },
  { id: uid(), num: '', depth: 0, sel: true, value_ko: '출력부', value_en: 'Output Unit', hypernym_ko: '출력 장치', hypernym_en: 'Output Device', description: '인식된 객체의 3D 위치, 크기, 종류를 출력' },
];

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
    id: el.id, num: el.symbol, depth: el.depth, sel: el.sel,
    value_ko: el.value_ko, value_en: el.value_en,
    hypernym_ko: el.hypernym_ko, hypernym_en: el.hypernym_en,
    description: el.description,
  };
}

function compItemToSpecItem(item: CompItem): SpecComponentItem {
  return {
    symbol: item.num,
    value_ko: item.value_ko,
    value_en: item.value_en,
    description: item.description,
    hypernym_ko: item.hypernym_ko,
    hypernym_en: item.hypernym_en,
    id: item.id,
    depth: item.depth,
    sel: item.sel,
  };
}

function ComponentsPanel({ done, onUpdate, onComponentsChange, initialItems, onRenameEverywhere }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  onComponentsChange?: (comps: SpecComponentItem[]) => void;
  initialItems?: SpecComponentItem[];
  onRenameEverywhere?: (oldName: string, newName: string) => void;
}) {
  // 명칭 입력란 포커스 시점의 이름 — blur 시 변경 감지용 (정의 지점 이름 변경 → 인용 텍스트 전파 확인)
  const focusNameRef = useRef<Record<string, string>>({});
  const initData: CompItem[] = (initialItems && initialItems.length > 0)
    ? initialItems.map(specItemToCompItem)
    : INIT_COMPS;
  const [items, setItems] = useState<CompItem[]>(initData);
  const [focusId, setFocusId] = useState<string | null>(null);
  // 인라인 AI 수정 — 열린 카드 id
  const [aiEditId, setAiEditId] = useState<string | null>(null);
  // 전체 AI 지시 바 (데모: "구성요소 전반에 대한 AI 지시사항" + AI 수정)
  const [globalInstr, setGlobalInstr] = useState('');
  const [globalBusy, setGlobalBusy] = useState(false);

  const serializeLine = (it: CompItem) => `${it.num || '—'} ${it.value_ko}${it.value_en ? ` (${it.value_en})` : ''}`;

  useEffect(() => {
    const selected = initData.filter(it => it.sel);
    onUpdate(selected.map(serializeLine).join('\n'));
    onComponentsChange?.(selected.map(compItemToSpecItem));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upd = (next: CompItem[]) => {
    setItems(next);
    const selected = next.filter(it => it.sel);
    onUpdate(selected.map(serializeLine).join('\n'));
    onComponentsChange?.(next.map(compItemToSpecItem));
  };

  const hasNums = (arr: CompItem[]) => arr.some(it => it.num);

  const applyUpd = (next: CompItem[]) => upd(hasNums(next) ? calcAutoNums(next) : next);

  const moveUp   = (idx: number) => { if (idx===0||done) return; const a=[...items]; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; applyUpd(a); };
  const moveDown = (idx: number) => { if (idx===items.length-1||done) return; const a=[...items]; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; applyUpd(a); };
  const indent   = (id: string)  => { if (!done) applyUpd(items.map(it => it.id===id ? {...it, depth: Math.min(it.depth+1,2)} : it)); };
  const outdent  = (id: string)  => { if (!done) applyUpd(items.map(it => it.id===id ? {...it, depth: Math.max(it.depth-1,0)} : it)); };
  const autoAssign = () => { if (!done) upd(calcAutoNums(items)); };
  const EMPTY_COMP = { num: '', depth: 0, sel: true, value_ko: '', value_en: '', hypernym_ko: '', hypernym_en: '', description: '' };
  const add = () => {
    if (done) return;
    const id = uid();
    upd([...items, { id, ...EMPTY_COMP }]);
    setFocusId(id);
  };
  // AI 추가 — 자연어 지시로 새 구성요소를 추가 (mock). 기존 항목은 절대 건드리지 않아 손실 없음.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const submitAiComponent = () => {
    const instr = aiInput.trim();
    if (!instr || done) return;
    const id = uid();
    upd([...items, {
      id, ...EMPTY_COMP,
      value_ko: instr.length > 24 ? instr.slice(0, 24) : instr,
      // 안내문을 값으로 넣지 않는다 — 빈 필드는 '보완 필요' 배지 + 진행 시 확인으로 안내 (A4)
      description: '',
    }]);
    setAiInput('');
    setAiOpen(false);
    setFocusId(id);
  };

  // 전체 AI 수정 제안 — 선택된 구성요소 정의에 지시 반영 (mock). 확인 후 적용은 AiGlobalBar가 담당.
  const proposeGlobal = (instr: string): PendingChange[] =>
    items.filter(it => it.sel).map(it => proposeMock(it.description, instr, `${it.num ? it.num + ' ' : ''}${it.value_ko}`));
  const applyGlobal = (changes: PendingChange[]) => {
    const byBefore = new Map(changes.map(c => [c.before, c.after ?? c.before]));
    upd(items.map(it => it.sel && byBefore.has(it.description) ? { ...it, description: byBefore.get(it.description)! } : it));
  };
  // 다시 분석 — AI 추출 결과로 재생성 (mock)
  const reanalyze = () => {
    if (done) return;
    confirmOverwrite('구성요소 다시 분석', '현재 구성요소 목록(명칭·정의·순서·부호)이 AI 추출 결과로 대체됩니다. 계속할까요?', '다시 분석', () => {
      setGlobalBusy(true);
      setTimeout(() => {
        const regen = generateComponentCandidates({ title: '', field: '', content: '' }).map(specItemToCompItem);
        upd(regen);
        setGlobalBusy(false);
        toast('구성요소를 다시 분석했습니다');
      }, 900);
    });
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
      <div className="flex-1 overflow-y-auto scroll-thin p-3 ml-1.5">
        {/* 전체 AI 지시 바 — 데모 정합: 구성요소 전반에 대한 AI 지시사항 */}
        {!done && (
          <AiGlobalBar
            className="mb-2.5"
            title="구성요소 수정 제안"
            placeholder="구성요소 전반에 대한 AI 지시사항 (예: 가이드 레일 설명에 설치 간격 내용을 보강해줘)"
            value={globalInstr}
            onChange={setGlobalInstr}
            propose={proposeGlobal}
            onApply={applyGlobal}
            doneMsg="구성요소에 적용했습니다"
            disabled={done}
          />
        )}
        {/* 헤더 + 부호 자동 부여 */}
        <div data-spec="SPC-CMP-020" className="flex items-center justify-between mb-1">
          <span className="text-xs2 font-semibold text-neutral-600">구성요소 목록</span>
          {!done && (
            <div className="flex items-center gap-1">
              <button onClick={reanalyze}
                disabled={globalBusy}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs2 font-medium text-brand-500 border border-brand-200 bg-white hover:bg-brand-50 hover:border-brand-300 disabled:opacity-40 transition-colors"
                data-spec="SPC-CMP-021" title="AI 추출을 다시 실행">
                ↻ 다시 분석
              </button>
              <button onClick={() => setAiOpen(o => !o)}
                className={clsx(
                  'inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs2 font-medium border transition-colors',
                  aiOpen ? 'bg-brand-400 border-brand-400 text-white' : 'text-brand-500 border-brand-200 bg-white hover:bg-brand-50 hover:border-brand-300',
                )}
                data-spec="SPC-CMP-022" title="자연어 지시로 AI가 구성요소를 추가">
                <AiIcon />
                AI 추가
              </button>
              <button data-spec="SPC-CMP-023" onClick={autoAssign}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs2 font-semibold bg-brand-400 border border-brand-400 text-white hover:bg-brand-500 transition-colors">
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
          <div className="mb-2 rounded-lg border-2 border-brand-200 bg-brand-50/40 p-2">
            <div className="flex gap-1.5 items-end">
              <textarea
                autoFocus
                className="flex-1 text-xs2 bg-white border border-brand-200 rounded-md px-2 py-1 outline-none focus:border-brand-400 resize-none min-h-[36px]"
                placeholder="추가할 구성요소를 설명하세요. 예: 사용자 인증을 처리하는 보안 모듈 (Enter로 추가)"
                rows={2}
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAiComponent(); } }}
              />
              <button
                onClick={submitAiComponent}
                disabled={!aiInput.trim()}
                className="shrink-0 text-xs2 font-semibold px-2.5 py-1 rounded-lg bg-brand-400 text-white hover:bg-brand-500 disabled:opacity-40 transition-colors"
              >추가</button>
            </div>
          </div>
        )}
        {!done && (
          <p className="text-xs2 text-neutral-400 mb-2">
            순서 조정 후 <strong className="text-brand-600">부호 자동 부여</strong>를 클릭하면 100, 200... 번호가 할당됩니다.
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
                dropIdx === idx && dragIdx !== idx && 'ring-2 ring-brand-400 ring-offset-1 rounded-lg'
              )}>
              <div className={clsx(
                'rounded-lg border p-2 space-y-1.5 transition-all group',
                item.sel && !done ? 'bg-white border-neutral-200 hover:border-brand-300' : '',
                !item.sel ? 'bg-neutral-50 border-dashed border-neutral-200' : '',
                done && item.sel ? 'bg-green-50 border-green-200' : ''
              )}>
                {/* 컨트롤 행: 채택 + 드래그 + 부호 + 순서 조정 */}
                <div className="flex items-center gap-1">
                  {!done && (
                    <button
                      onClick={() => upd(items.map(it => it.id===item.id ? {...it, sel: !it.sel} : it).filter(it => it.sel || it.value_ko.trim()))}
                      className={clsx(
                        'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                        item.sel
                          ? 'bg-brand-400 border-brand-400 text-white'
                          : 'border-neutral-400 bg-white hover:border-brand-400',
                      )}
                      data-spec="SPC-CMP-011" title={item.sel ? '채택 해제' : '채택'}
                      aria-label={item.sel ? '채택됨' : '채택'}
                    >
                      {item.sel && <Icon name="check" size={10} />}
                    </button>
                  )}
                  <span className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100 cursor-grab active:cursor-grabbing shrink-0 select-none" data-spec="SPC-CMP-012" title="끌어서 순서 변경" aria-label="끌어서 순서 변경">
                    <svg viewBox="0 0 10 10" width="11" height="11" fill="currentColor"><circle cx="3" cy="2" r="1"/><circle cx="7" cy="2" r="1"/><circle cx="3" cy="5" r="1"/><circle cx="7" cy="5" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="7" cy="8" r="1"/></svg>
                  </span>
                  <span className={clsx(
                    'w-8 text-xs2 font-bold rounded-md px-1 py-0.5 shrink-0 text-center',
                    item.num ? 'bg-brand-100 text-brand-400' : 'bg-neutral-100 text-neutral-400'
                  )}>
                    {item.num || '—'}
                  </span>
                  {item.sel && (!item.value_en.trim() || !item.hypernym_ko.trim() || !item.description.trim()) && (
                    <span className="text-xs2 px-1.5 py-px rounded-md bg-amber-50 text-amber-700 font-medium shrink-0" data-spec="SPC-CMP-015" title="영문명·상위어·정의 중 빈 항목이 있습니다. 채워 넣거나 채택을 해제하세요.">보완 필요</span>
                  )}
                  {!done && (
                    <div className="flex items-center gap-px shrink-0 ml-auto">
                      {item.sel && (
                        <AiEditButton
                          className="mr-1"
                          active={aiEditId === item.id}
                          title="이 구성요소를 AI로 수정"
                          onClick={() => setAiEditId(k => k === item.id ? null : item.id)}
                        />
                      )}
                      <button onClick={() => moveUp(idx)} disabled={idx===0}
                        className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-colors" title="위로">
                        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 7l3-4 3 4"/></svg>
                      </button>
                      <button onClick={() => moveDown(idx)} disabled={idx===items.length-1}
                        className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-colors" title="아래로">
                        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 3l3 4 3-4"/></svg>
                      </button>
                      <span className="w-px h-3 bg-neutral-200 mx-0.5" />
                      <button onClick={() => indent(item.id)} disabled={!canIndent(idx, item)}
                        className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-colors" title="하위로 (→)">
                        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 5h6M6 3l2 2-2 2"/></svg>
                      </button>
                      <button onClick={() => outdent(item.id)} disabled={item.depth<=0}
                        className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-colors" title="상위로 (←)">
                        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M8 5H2M4 3L2 5l2 2"/></svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* 필드 행 — 명칭/영문명 2단, 상위어/상위어영문명 2단, 정의 전체폭 */}
                <div className="space-y-1.5">
                  {/* 명칭 / 명칭 영문명 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs2 text-neutral-400 block mb-0.5">명칭</span>
                      {!done ? (
                        <input
                          ref={el => { if (el && item.id === focusId) { el.focus(); setFocusId(null); } }}
                          className="w-full text-xs2 text-neutral-800 font-medium bg-neutral-50 border border-neutral-200 rounded-md px-2 py-0.5 outline-none focus:border-brand-300 focus:bg-white transition-colors min-w-0"
                          value={item.value_ko}
                          data-spec="SPC-CMP-013" placeholder="구성요소 명칭"
                          onChange={e => upd(items.map(it => it.id===item.id ? {...it, value_ko: e.target.value} : it))}
                          onFocus={() => { focusNameRef.current[item.id] = item.value_ko; }}
                          onBlur={() => {
                            // 정의 지점에서 이름이 바뀌면 인용 텍스트 전체에 즉시 적용 (단일 규칙: 구성요소를 고치면 한 번에 바뀐다)
                            const old = (focusNameRef.current[item.id] ?? '').trim();
                            const nw = item.value_ko.trim();
                            delete focusNameRef.current[item.id];
                            if (!old || !nw || old === nw || !onRenameEverywhere) return;
                            onRenameEverywhere(old, nw);
                          }}
                        />
                      ) : (
                        <span className="text-xs2 text-neutral-800 font-medium truncate block">{item.value_ko || <span className="text-neutral-300">—</span>}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs2 text-neutral-400 block mb-0.5">명칭 영문명</span>
                      {!done ? (
                        <input
                          className="w-full text-xs2 text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-0.5 outline-none focus:border-brand-300 focus:bg-white transition-colors min-w-0"
                          value={item.value_en}
                          placeholder="English name"
                          onChange={e => upd(items.map(it => it.id===item.id ? {...it, value_en: e.target.value} : it))}
                        />
                      ) : (
                        <span className="text-xs2 text-neutral-500 truncate block">{item.value_en || <span className="text-neutral-300">—</span>}</span>
                      )}
                    </div>
                  </div>
                  {/* 상위어 / 상위어 영문명 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs2 text-neutral-400 block mb-0.5">상위어</span>
                      {!done ? (
                        <input
                          className="w-full text-xs2 text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-0.5 outline-none focus:border-brand-300 focus:bg-white transition-colors min-w-0"
                          value={item.hypernym_ko}
                          placeholder="상위 개념"
                          onChange={e => upd(items.map(it => it.id===item.id ? {...it, hypernym_ko: e.target.value} : it))}
                        />
                      ) : (
                        <span className="text-xs2 text-neutral-500 truncate block">{item.hypernym_ko || <span className="text-neutral-300">—</span>}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs2 text-neutral-400 block mb-0.5">상위어 영문명</span>
                      {!done ? (
                        <input
                          className="w-full text-xs2 text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-0.5 outline-none focus:border-brand-300 focus:bg-white transition-colors min-w-0"
                          value={item.hypernym_en}
                          placeholder="hypernym (English)"
                          onChange={e => upd(items.map(it => it.id===item.id ? {...it, hypernym_en: e.target.value} : it))}
                        />
                      ) : (
                        <span className="text-xs2 text-neutral-500 truncate block">{item.hypernym_en || <span className="text-neutral-300">—</span>}</span>
                      )}
                    </div>
                  </div>
                  {/* 정의 (전체폭) */}
                  <div>
                    <span className="text-xs2 text-neutral-400 block mb-0.5">정의</span>
                    {!done ? (
                      <Textarea
                        className="w-full text-xs2 text-neutral-600 bg-neutral-50 px-2 py-0.5"
                        value={item.description}
                        placeholder="구성요소의 기능·역할 설명"
                        rows={2}
                        onChange={e => upd(items.map(it => it.id===item.id ? {...it, description: e.target.value} : it))}
                      />
                    ) : (
                      <span className="text-xs2 text-neutral-500 leading-relaxed block">{item.description || <span className="text-neutral-300">—</span>}</span>
                    )}
                  </div>
                  {aiEditId === item.id && !done && (
                    <InlineAiEdit
                      placeholder="이 구성요소를 어떻게 수정할지 지시해주세요 (예: 정의에 센서 융합 기능을 보강해줘)"
                      onClose={() => setAiEditId(null)}
                      original={item.description}
                      label="구성요소 정의"
                      onApply={newText => {
                          upd(items.map(it => it.id === item.id ? { ...it, description: newText } : it));
                        }}
                      doneMsg="구성요소를 수정했습니다"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 하단 드롭 존 — 마지막 위치로 드래그 허용 */}
          {!done && (
            <div
              onDragOver={e => { e.preventDefault(); setDropIdx(items.length); }}
              className={clsx(
                'h-3 rounded-md transition-all',
                dropIdx === items.length && dragIdx !== null ? 'ring-2 ring-brand-400 ring-offset-1 bg-brand-50' : ''
              )}
            />
          )}
        </div>

        {/* 새 구성요소 추가 — 빈 카드 생성 후 인라인 편집 */}
        {!done && (
          <button data-spec="SPC-CMP-024"
            onClick={add}
            className="w-full mt-3 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 border-dashed border-neutral-200 text-xs2 font-semibold text-neutral-500 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/30 transition-colors"
          >
            <Icon name="plus" size={12} /> 구성요소 추가
          </button>
        )}
      </div>
      {done && (
        <div className="p-3 border-t border-neutral-100 bg-green-50 shrink-0">
          <div className="flex items-center gap-1.5 text-sm2 text-green-700 font-medium"><Icon name="check" size={13} /> 구성요소 확정</div>
        </div>
      )}
    </>
  );
}

// 도면 패널 (#21)

const DRAWING_LABEL_MAP: Record<string, { text: string; cls: string }> = {
  proposed_implementation: { text: '제안기술', cls: 'bg-brand-100 text-brand-400' },
  previous_implementation: { text: '종래기술', cls: 'bg-neutral-100 text-neutral-600' },
  background:              { text: '배경',     cls: 'bg-neutral-100 text-neutral-600' },
  effect:                  { text: '효과',     cls: 'bg-neutral-100 text-neutral-700' },
  etc:                     { text: '기타',     cls: 'bg-neutral-100 text-neutral-500' },
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

function DrawingsPanel({ mode, done, onUpdate, drawings: propDrawings, onUpdateDrawings, taskId }: {
  mode: 'select' | 'spec';
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  drawings?: Drawing[];
  onUpdateDrawings?: (next: Drawing[]) => void;
  taskId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawings = propDrawings ?? MOCK_DRAWINGS;

  const updateDrawings = (next: Drawing[]) => {
    onUpdateDrawings?.(next);
    onUpdate(next.filter(d => d.useForSpec).map(d => `${d.detail.symbol} ${d.detail.name}: ${d.detail.description}`).join('\n\n'));
  };

  // (도면 편집기 결과 수신은 SpecView 톱레벨로 이관 — 위저드/에디터 어느 화면에서도 유실 없이 반영)

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
    const next = drawings.map((d, i) => {
      if (i !== idx) return d;
      const nowIncluded = !(d.included ?? true);
      // 미사용 처리 시 대표 지정 자동 해제 (대표는 사용 이미지여야 함)
      return nowIncluded ? { ...d, included: true } : { ...d, included: false, isRepresentative: false };
    });
    updateDrawings(next);
  };

  const toggleUseForSpec = (idx: number) => {
    if (done) return;
    const next = drawings.map((d, i) => {
      if (i !== idx) return d;
      const nowSpec = !(d.useForSpec ?? false);
      // 명세서 미채택 시 대표도면 지정 자동 해제 (대표도면은 명세서 도면이어야 함)
      return nowSpec ? { ...d, useForSpec: true } : { ...d, useForSpec: false, isRepresentative: false };
    });
    updateDrawings(next);
  };

  const setRepresentative = (idx: number) => {
    if (done) return;
    const cur = drawings[idx]?.isRepresentative ?? false;
    // 라디오 동작: 클릭한 것만 대표, 이미 대표면 해제
    const next = drawings.map((d, i) => ({ ...d, isRepresentative: i === idx ? !cur : false }));
    updateDrawings(next);
  };

  const setDrawingLabel = (idx: number, label: Drawing['detail']['label']) => {
    if (done) return;
    const next = drawings.map((d, i) => i === idx ? { ...d, detail: { ...d.detail, label } } : d);
    updateDrawings(next);
  };


  const removeDrawing = (idx: number) => {
    if (done) return;
    const name = drawings[idx]?.detail.name || drawings[idx]?.detail.symbol || '이 이미지';
    openAlertDialog(
      { title: '이미지 삭제', description: `"${name}"${particle(name, '을', '를')} 목록에서 삭제하시겠습니까?`, confirm: '삭제', cancel: '취소' },
      { theme: 'danger', onConfirm: (ctrl) => { updateDrawings(drawings.filter((_, i) => i !== idx)); ctrl.close(); } }
    );
  };

  const includedDrawings = drawings.filter(d => d.included !== false);
  const specDrawings = includedDrawings.filter(d => d.useForSpec);

  const renderThumbnail = (d: Drawing, extra?: React.ReactNode) => {
    const hasData = !!d.image.file.data;
    const bbox = d.image.bbox;
    return (
      <div className="w-full aspect-[4/3] max-h-[240px] bg-neutral-100 flex items-center justify-center overflow-hidden relative group">
        {hasData
          ? (bbox
            ? <CroppedCanvas data={d.image.file.data} mediaType={d.image.file.media_type} bbox={bbox} />
            : <img src={`data:${d.image.file.media_type};base64,${d.image.file.data}`} className="w-full h-full object-contain" alt="" />)
          : <Icon name="image" size={28} className="text-neutral-200" />}
        {hasData && (
          <button
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-7 h-7 inline-flex items-center justify-center bg-white/95 border border-neutral-200 shadow-sm rounded-lg text-neutral-500 hover:text-brand-500 transition-opacity text-xs2 leading-none"
            onClick={e => { e.stopPropagation(); openDrawingInNewTab(d.image.file.data, d.image.file.media_type, bbox); }}
            data-spec="SPC-IMG-015" title="새 탭에서 열기"
          >↗</button>
        )}
        {extra}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3 ml-1.5">
      {/* 이미지 선별 (관련 선별 + 대표) */}
      {mode === 'select' && (
        <>
          <p className="text-xs2 text-neutral-500 mb-1">
            추출된 이미지 <span className="font-semibold">{drawings.length}개</span> · 선택 <span className="font-semibold">{includedDrawings.length}개</span>
          </p>
          <p className="text-xs2 text-neutral-400 mb-2">관련 있는 이미지를 선택하세요. 미선택(흐림)은 맥락에서 제외됩니다. 대표 이미지 1개를 지정하면 이후 생성의 기준이 됩니다.</p>
          {drawings.length === 0 && (
            <div className="text-center py-8 text-neutral-400 text-sm2">추출된 이미지가 없습니다.</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {drawings.map((d, idx) => {
              const included = d.included !== false;
              const isRep = d.isRepresentative ?? false;
              const labelInfo = DRAWING_LABEL_MAP[d.detail.label] ?? { text: d.detail.label, cls: 'bg-neutral-100 text-neutral-600' };
              return (
                <div key={idx} className={clsx(
                  'rounded-xl border-2 overflow-hidden flex flex-col bg-white transition-all',
                  isRep && included ? 'border-brand-500 ring-2 ring-brand-200' : included ? 'border-brand-300' : 'border-neutral-200 opacity-60',
                  done && 'pointer-events-none',
                )}>
                  {renderThumbnail(d, (
                    <>
                      {!done && (
                        <button
                          onClick={() => toggleIncluded(idx)}
                          className="absolute top-1.5 left-1.5 flex items-center gap-1 h-7 px-2 rounded-lg shadow-sm bg-white/95 border border-neutral-200 transition-all"
                          data-spec="SPC-IMG-011" title={included ? '선택 해제 (맥락에서 제외)' : '선택 (맥락에 사용)'}
                        >
                          <span className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all', included ? 'bg-brand-400 border-brand-400 text-white' : 'border-neutral-400 bg-white')}>
                            {included && <Icon name="check" size={10} />}
                          </span>
                          <span className={clsx('text-xs2 font-semibold', included ? 'text-brand-700' : 'text-neutral-500')}>선택</span>
                        </button>
                      )}
                      {!done && included && (
                        <button
                          onClick={() => setRepresentative(idx)}
                          className="absolute top-1.5 right-1.5 flex items-center gap-1 h-7 px-2 rounded-lg shadow-sm bg-white/95 border border-neutral-200 transition-all"
                          data-spec="SPC-IMG-012" title="대표 이미지 (1개만)"
                        >
                          <span className={clsx('w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center', isRep ? 'border-brand-400 bg-brand-400' : 'border-neutral-300 bg-white')}>
                            {isRep && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={clsx('text-xs2 font-semibold', isRep ? 'text-brand-700' : 'text-neutral-500')}>대표</span>
                        </button>
                      )}
                      {done && isRep && <span className="absolute top-1.5 right-1.5 text-xs2 px-2 py-0.5 rounded-full font-semibold bg-brand-400 text-white">대표</span>}
                    </>
                  ))}
                  <div className="px-2.5 pt-1.5 pb-1">
                    <div className="flex items-center gap-1 flex-wrap mb-0.5">
                      <span className="text-xs2 font-bold text-neutral-700" title={`원본 기호: ${d.detail.symbol}`}>이미지 {idx + 1}</span>
                      {done ? (
                        <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', labelInfo.cls)}>{labelInfo.text}</span>
                      ) : (
                        <select
                          value={d.detail.label}
                          onChange={e => setDrawingLabel(idx, e.target.value as Drawing['detail']['label'])}
                          className={clsx('text-xs2 px-1 py-px rounded-full font-medium border-0 outline-none cursor-pointer', labelInfo.cls)}
                          data-spec="SPC-IMG-013" title="분류 변경"
                        >
                          <option value="proposed_implementation">제안기술</option>
                          <option value="previous_implementation">종래기술</option>
                          <option value="background">배경</option>
                          <option value="effect">효과</option>
                          <option value="etc">기타</option>
                        </select>
                      )}
                    </div>
                    <p className="text-xs2 text-neutral-700 font-semibold leading-snug line-clamp-1">{d.detail.name}</p>
                  </div>
                  {!done && (
                    <div className="flex border-t border-neutral-100">
                      <button
                        onClick={() => removeDrawing(idx)}
                        className="ml-auto inline-flex items-center justify-center w-7 h-7 mr-1 my-0.5 rounded-md text-neutral-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="삭제"
                        data-spec="SPC-IMG-014" aria-label="이미지 삭제"
                      >✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!done && (
            <div className="mt-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs2 font-semibold text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <Icon name="plus" size={11} />
                이미지 추가 (로컬 업로드)
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileAdd} />
            </div>
          )}
        </>
      )}

      {/* 명세서 도면 처리 (명세서 채택 + 도면번호 + CAD) */}
      {mode === 'spec' && (
        <>
          <p className="text-xs2 text-neutral-500 mb-1">
            관련 이미지 <span className="font-semibold">{includedDrawings.length}개</span> · 명세서 도면 <span className="font-semibold">{specDrawings.length}개</span>
          </p>
          <p className="text-xs2 text-neutral-400 mb-2">이미지 선별에서 고른 이미지는 기본으로 채택되어 있습니다. 명세서에 넣지 않을 이미지는 <b className="text-neutral-500">참고만</b>으로 바꾸세요 — 채택 도면은 "도 N" 번호가 붙고 CAD 변환 대상이 됩니다.</p>
          {includedDrawings.length === 0 && (
            <div className="text-center py-8 text-neutral-400 text-sm2">이미지 선별 단계에서 관련 이미지를 먼저 선별하세요.</div>
          )}
          {(() => { let figNo = 0; return (
          <div className="grid grid-cols-2 gap-2">
            {drawings.map((d, idx) => {
              if (d.included === false) return null;
              const isForSpec = d.useForSpec ?? false;
              const isRep = d.isRepresentative ?? false;
              if (isForSpec) figNo++;
              const myFig = figNo;
              const labelInfo = DRAWING_LABEL_MAP[d.detail.label] ?? { text: d.detail.label, cls: 'bg-neutral-100 text-neutral-600' };
              return (
                <div key={idx} className={clsx(
                  'rounded-xl border-2 overflow-hidden flex flex-col bg-white transition-all',
                  isForSpec ? (isRep ? 'border-brand-500 ring-2 ring-brand-200' : 'border-brand-300') : 'border-neutral-200 opacity-60',
                  done && 'pointer-events-none',
                )}>
                  {renderThumbnail(d, (
                    <>
                      {!done && isForSpec && (
                        <button
                          onClick={() => setRepresentative(idx)}
                          className="absolute top-1.5 right-1.5 flex items-center gap-1 h-7 px-2 rounded-lg shadow-sm bg-white/95 border border-neutral-200 transition-all"
                          data-spec="SPC-DRW-012" title="대표도면 (1개만)"
                        >
                          <span className={clsx('w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center', isRep ? 'border-brand-400 bg-brand-400' : 'border-neutral-300 bg-white')}>
                            {isRep && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={clsx('text-xs2 font-semibold', isRep ? 'text-brand-700' : 'text-neutral-500')}>대표</span>
                        </button>
                      )}
                      {done && isForSpec && isRep && <span className="absolute top-1.5 right-1.5 text-xs2 px-2 py-0.5 rounded-full font-semibold bg-brand-400 text-white">대표</span>}
                    </>
                  ))}
                  <div className="px-2.5 pt-1.5 pb-1">
                    <div className="flex items-center gap-1 flex-wrap mb-0.5">
                      {/* 채택 상태 토글 하나로 통일: [도면 채택 | 참고만] (U2) */}
                      {done ? (
                        isForSpec
                          ? <span className="text-xs2 px-1.5 py-px rounded-full font-bold bg-brand-400 text-white">도 {myFig}</span>
                          : <span className="text-xs2 px-1.5 py-px rounded-full font-medium bg-neutral-200 text-neutral-500">참고만</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-neutral-200 overflow-hidden text-xs2 font-semibold" data-spec="SPC-DRW-011" role="group" aria-label="도면 채택 여부">
                          <button
                            type="button"
                            onClick={() => { if (!isForSpec) toggleUseForSpec(idx); }}
                            aria-pressed={isForSpec}
                            title="명세서 도면으로 채택 (도 N 번호 부여 · CAD 변환 대상)"
                            className={clsx('px-2 py-px transition-colors', isForSpec ? 'bg-brand-400 text-white' : 'bg-white text-neutral-500 hover:bg-brand-50')}
                          >{isForSpec ? `도 ${myFig}` : '도면 채택'}</button>
                          {isForSpec && d.cadConverted && (
                            <span className="ml-1 text-xs2 px-1.5 py-px rounded-full bg-green-50 text-green-700 font-medium" data-spec="SPC-DRW-015" title="도면 편집기에서 CAD 변환 결과를 반영했습니다">CAD 변환 완료</span>
                          )}
                          <button
                            type="button"
                            onClick={() => { if (isForSpec) toggleUseForSpec(idx); }}
                            aria-pressed={!isForSpec}
                            title="명세서에 넣지 않고 AI 참고용(맥락)으로만 사용"
                            className={clsx('px-2 py-px border-l border-neutral-200 transition-colors', !isForSpec ? 'bg-neutral-200 text-neutral-700' : 'bg-white text-neutral-400 hover:bg-neutral-50')}
                          >참고만</button>
                        </span>
                      )}
                      {done ? (
                        <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', labelInfo.cls)}>{labelInfo.text}</span>
                      ) : (
                        <select
                          value={d.detail.label}
                          onChange={e => setDrawingLabel(idx, e.target.value as Drawing['detail']['label'])}
                          className={clsx('text-xs2 px-1 py-px rounded-full font-medium border-0 outline-none cursor-pointer', labelInfo.cls)}
                          data-spec="SPC-DRW-013" title="분류 변경"
                        >
                          <option value="proposed_implementation">제안기술</option>
                          <option value="previous_implementation">종래기술</option>
                          <option value="background">배경</option>
                          <option value="effect">효과</option>
                          <option value="etc">기타</option>
                        </select>
                      )}
                    </div>
                    <p className="text-xs2 text-neutral-700 font-semibold leading-snug line-clamp-1">{d.detail.name}</p>
                  </div>
                  {!done && isForSpec && (
                    <div className="flex border-t border-neutral-100">
                      <button data-spec="SPC-DRW-014"
                        onClick={() => openEditorTab({ taskId, drawingId: String(idx), drawings: drawings.map(toWorkflowDrawingItem), components: [], references: [], drawingName: d.detail.name, timestamp: Date.now() })}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs2 font-semibold text-brand-500 hover:bg-brand-50 transition-colors"
                        title="범위 조정·CAD 변환"
                      >도면 편집기에서 조정·변환 ↗</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          ); })()}
        </>
      )}

    </div>
  );
}

// ── 독립항 세트 권리범위 레이블 매핑 ──────────────────────────────────────────
// 이번 버전 범위 제외(사용자 결정 2026-08-28): 선행 근거 검증은 API 응답에 없는 클라이언트 판단이라 숨김. 연동 시 element_ids 기반으로 재검토.
const ENABLE_ANTECEDENT_CHECK = false;

// ── 종속항 선행 근거(antecedent basis) 검증 (A2) ────────────
// "상기 X"의 X가 인용 독립항 본문에 없으면 선행 근거 없음으로 본다. 텍스트 로직이라 mock·실데이터 무관.
const ANTECEDENT_RE = /상기\s+([가-힣A-Za-z0-9·]+?)(?=(?:은|는|이|가|을|를|의|에|로|와|과|도|만|들)?(?:[\s,.;()]|$))/g;
function findMissingAntecedents(depText: string, indepText: string): string[] {
  const missing = new Set<string>();
  const indep = indepText.replace(/\s+/g, '');
  for (const m of depText.matchAll(ANTECEDENT_RE)) {
    const term = m[1];
    if (term.length < 2) continue;
    // 명사 자체 또는 접미(부/단계/장치/모듈/수단) 제거형이 독립항에 있으면 통과
    const variants = [term, term.replace(/(부|단계|장치|모듈|수단)$/, '')].filter(v => v.length >= 2);
    if (!variants.some(v => indep.includes(v))) missing.add(term);
  }
  return [...missing];
}

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
  element_idxs?: number[];   // 연관 구성요소 인덱스 — API GeneratedDependentClaimItem.element_idxs
}
interface DepGroupState { generated: boolean; items: DepItemState[]; newText: string }

// 선택된 세트의 각 claim별 종속항 그룹 (key: claimIndex 숫자)
type DepGroupsForSet = Record<number, DepGroupState>;

function ClaimsPanel({ done, onConfirm, onUpdate, onActionChange, elements = [] }: {
  done: boolean;
  onConfirm: () => void;
  onUpdate: (v: string) => void;
  onActionChange?: (a: StepAction | null) => void;   // 하단 바 주 동작 등록 (U1/D3)
  elements?: ElementLike[];                          // 구성요소 하이라이트용 원천
}) {
  const [claimsPhase, setClaimsPhase] = useState<'indep' | 'dep'>('indep');
  const [depInstr, setDepInstr] = useState('');   // 종속항 생성 지시사항 — API dependent-claim instruction (목업 미반영)
  const [claimSets] = useState(MOCK_INDEPENDENT_CLAIM_SETS);
  // 생성 전에는 세트를 미리 선택하지 않는다 (C1: preference 설정 → 생성 순서 강제)
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(done ? 2 : null);
  const [generated, setGenerated] = useState(done); // 독립항 세트 생성 여부 — 생성 후에만 후보 표시
  // 인라인 AI 수정 — 열린 항 키 (`indep-${setIdx}-${ci}` | `dep-${ci}-${depId}`)
  const [aiKey, setAiKey] = useState<string | null>(null);
  // 독립항 세트 생성 추가 지시사항 (데모: preference와 함께 전달)
  const [genInstruction, setGenInstruction] = useState('');
  // 종속항 전체 수정 지시 (데모: dependent-claim/modification)
  const [depGlobalInstr, setDepGlobalInstr] = useState('');
  // preference.slots = API independent-claim/set 의 preference.claims[] (각 슬롯 = category + description, 2~3개) (C2)
  const [preference, setPreference] = useState<{ abstraction: string; slots: { category: string; description: string }[] }>({
    abstraction: 'INTERMEDIATE',
    slots: [{ category: 'MACHINE', description: '' }, { category: 'PROCESS', description: '' }],
  });
  // preference 변경 시 생성 결과·선택 초기화 — 설정이 바뀌면 다시 생성하도록 (C1)
  const resetGen = () => { setGenerated(false); setSelectedSetIndex(null); };
  const CLAIM_CATEGORIES = ['MACHINE', 'PROCESS', 'MANUFACTURE', 'COMPOSITION'] as const;
  const addSlot = () => { if (done || preference.slots.length >= 3) return; setPreference(p => ({ ...p, slots: [...p.slots, { category: 'MACHINE', description: '' }] })); resetGen(); };
  const removeSlot = (i: number) => { if (done || preference.slots.length <= 2) return; setPreference(p => ({ ...p, slots: p.slots.filter((_, idx) => idx !== i) })); resetGen(); };
  const updateSlotCategory = (i: number, category: string) => { if (done) return; setPreference(p => ({ ...p, slots: p.slots.map((s, idx) => idx === i ? { ...s, category } : s) })); resetGen(); };
  const updateSlotDescription = (i: number, description: string) => { if (done) return; setPreference(p => ({ ...p, slots: p.slots.map((s, idx) => idx === i ? { ...s, description } : s) })); };
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
      element_idxs: [i % 3],   // 목업: API element_idxs 대응 (구성요소 인덱스)
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

  // 독립항 세트 생성 (mock) — 생성 후 세트 목록 첫 항목으로 스크롤
  const generateSets = () => {
    setGenerated(true);
    setSelectedSetIndex(null);
    setTimeout(() => document.querySelector<HTMLElement>('[data-claimsets]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // 하단 바 주 동작 등록 — 단계 내부 상태에 따라 라벨·동작이 바뀐다 (U1: 종속항 건너뜀 방지, D3: Primary 1개)
  const latest = useRef({ generateSets, confirmIndep, onConfirm });
  useEffect(() => { latest.current = { generateSets, confirmIndep, onConfirm }; });
  useEffect(() => {
    if (!onActionChange) return;
    if (done) { onActionChange(null); return; }
    if (!generated) {
      onActionChange({ label: '독립항 세트 생성 →', onClick: () => latest.current.generateSets() });
    } else if (claimsPhase === 'indep') {
      onActionChange({
        label: '종속항 구성 →',
        onClick: () => latest.current.confirmIndep(),
        disabled: selectedSetIndex === null,
        hint: '독립항 세트를 하나 선택하세요',
      });
    } else {
      onActionChange({ label: '청구항 확정 →', onClick: () => latest.current.onConfirm() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, generated, claimsPhase, selectedSetIndex]);
  useEffect(() => () => onActionChange?.(null), [onActionChange]);

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
        const slotCats = preference.slots.map(s => s.category);
        const categoryMatch = slotCats.length === 0 || set.claims.some(c => slotCats.includes(c.category));
        return abstractMatch && categoryMatch;
      });

    return (
      <>
      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2.5 ml-1.5">
        <div className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2.5">
          {generated ? (
            <>
              <p className="text-xs2 text-brand-400 font-medium">설정한 권리범위·구성으로 독립항 세트를 생성했습니다.</p>
              <p className="text-xs2 text-neutral-500 mt-0.5"><strong className="text-neutral-700">1개를 선택</strong>하면 종속항을 구성합니다. 설정을 바꾸면 다시 생성됩니다.</p>
            </>
          ) : (
            <>
              <p className="text-xs2 text-brand-400 font-medium">권리범위와 청구항 구성을 설정한 뒤 독립항 세트를 생성하세요.</p>
              <p className="text-xs2 text-neutral-500 mt-0.5">추상화 수준과 청구항 슬롯(장치/방법 등)을 정하면 그에 맞춰 세트 후보가 생성됩니다.</p>
            </>
          )}
        </div>

        {/* Preference UI — API independent-claim/set 의 preference (abstraction_level + claims[]) */}
        <div data-spec="SPC-CLM-010" className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 space-y-2.5">
          <p className="text-xs2 font-semibold text-neutral-600">권리범위 설정</p>
          {/* 용어 도움말 — 처음 쓰는 사용자(대학원생)용 1줄 설명 (B11) */}
          <p className="text-xs2 text-neutral-400 leading-relaxed">
            <b className="text-neutral-500">추상화 수준</b>은 청구항을 얼마나 넓게 쓸지(넓을수록 보호 범위↑·등록 난이도↑),
            <b className="text-neutral-500"> 청구항 구성</b>은 어떤 종류의 항으로 청구할지입니다 —
            장치항(구성요소의 결합) · 방법항(단계·동작, 소프트웨어 발명에 유리) · 제조항(제조 방법으로 얻은 물건) · 조성물항(성분·배합).
          </p>
          <div>
            <p className="text-xs2 text-neutral-400 mb-1">추상화 수준</p>
            <div className="flex gap-1.5">
              {(['BROAD', 'INTERMEDIATE', 'NARROW'] as const).map(level => (
                <button
                  key={level}
                  data-spec="SPC-CLM-011" onClick={() => { if (!done) { setPreference(p => ({ ...p, abstraction: level })); resetGen(); } }}
                  title={SCOPE_LABELS[level]?.sub}
                  className={clsx(
                    'flex-1 py-1 text-xs2 font-semibold rounded-lg border transition-colors',
                    preference.abstraction === level
                      ? 'bg-brand-400 text-white border-brand-400'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-brand-300',
                  )}
                >
                  {SCOPE_LABELS[level]?.label.replace(' 권리범위', '') ?? level}
                </button>
              ))}
            </div>
          </div>
          {/* 청구항 구성(슬롯) — 사용자가 장치/방법 등 카테고리 슬롯을 직접 추가·설정 (2~3개) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs2 text-neutral-400">청구항 구성 <span className="text-neutral-300">({preference.slots.length}/3)</span></p>
              <button
                onClick={addSlot}
                disabled={done || preference.slots.length >= 3}
                className="text-xs2 font-semibold text-brand-500 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >+ 청구항 추가</button>
            </div>
            <div className="space-y-1.5">
              {preference.slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs2 text-neutral-300 w-4 shrink-0 text-right">{i + 1}</span>
                  <select
                    className="text-xs2 font-semibold text-neutral-700 bg-neutral-100 border border-neutral-200 rounded-lg px-1.5 py-1 outline-none focus:border-brand-400 transition-colors shrink-0 disabled:opacity-60"
                    value={slot.category}
                    disabled={done}
                    data-spec="SPC-CLM-012" onChange={e => updateSlotCategory(i, e.target.value)}
                    title="장치항: 구성요소의 결합으로 청구 · 방법항: 단계·동작으로 청구(소프트웨어 유리) · 제조항: 제조 방법으로 얻은 물건 · 조성물항: 성분·배합"
                  >
                    {CLAIM_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_LABEL[cat] ?? cat}</option>
                    ))}
                  </select>
                  <input
                    className="flex-1 min-w-0 text-xs2 bg-white border border-neutral-200 rounded-md px-2 py-1 outline-none focus:border-brand-400 transition-colors disabled:bg-neutral-50"
                    placeholder="이 청구항의 방향·강조점 (선택)"
                    value={slot.description}
                    disabled={done}
                    onChange={e => updateSlotDescription(i, e.target.value)}
                  />
                  <button
                    onClick={() => slot.description.trim() ? confirmDelete(`청구항 구성 ${i + 1}`, () => removeSlot(i), `입력한 방향·강조점("${slot.description.trim().slice(0, 30)}")이 함께 삭제됩니다. 계속할까요?`) : removeSlot(i)}
                    disabled={done || preference.slots.length <= 2}
                    title={preference.slots.length <= 2 ? '최소 2개' : '삭제'}
                    className="text-neutral-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-neutral-300 shrink-0 px-1"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {!generated && !done && (
          <>
            {/* 추가 지시사항 (선택) — 데모 정합: 생성 preference와 함께 전달 */}
            <input
              className="w-full text-xs2 px-2.5 py-1.5 border border-neutral-200 rounded-lg bg-white outline-none focus:border-brand-400 transition-colors"
              placeholder="추가 지시사항 (선택) — 예: 방법 청구항 위주로 작성해줘"
              value={genInstruction}
              onChange={e => setGenInstruction(e.target.value)}
            />
            <p className="text-xs2 text-neutral-400">기본 설정(균형 · 장치항+방법항) 그대로 생성해도 됩니다. 준비되면 하단의 <b className="text-neutral-600">독립항 세트 생성 →</b>을 누르세요.</p>
          </>
        )}

        {generated && (<>
        {filteredSetIndices.length === 0 && (
          <div className="text-center py-6 text-neutral-400 text-xs2">선택한 조건에 맞는 세트가 없습니다.</div>
        )}

        <div data-claimsets data-spec="SPC-CLM-020" />
        {filteredSetIndices.map(setIdx => {
          const set = claimSets[setIdx];
          const isSelected = selectedSetIndex === setIdx;
          const scopeInfo = SCOPE_LABELS[set.abstraction_level] ?? { label: set.abstraction_level, sub: '' };
          return (
            <div
              key={setIdx}
              data-spec="SPC-CLM-021" onClick={() => { if (!done) { setSelectedSetIndex(setIdx); syncUpdate(setIdx, depGroupsMap); } }}
              className={clsx(
                'rounded-xl border-2 transition-all cursor-pointer',
                isSelected
                  ? 'border-brand-600 bg-brand-50 shadow-sm'
                  : 'border-neutral-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'
              )}
            >
              <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                <button
                  onClick={e => { e.stopPropagation(); if (!done) { setSelectedSetIndex(setIdx); syncUpdate(setIdx, depGroupsMap); } }}
                  className={clsx(
                    'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    isSelected ? 'border-brand-400 bg-brand-400' : 'border-neutral-300 bg-white hover:border-brand-300'
                  )}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={clsx('text-sm2 font-semibold', isSelected ? 'text-brand-600' : 'text-neutral-700')}>
                    세트 {filteredSetIndices.indexOf(setIdx) + 1} · {scopeInfo.label}
                  </span>
                  {/* 세트 식별 정보 — 청구 카테고리 조합 · 참조 구성요소 수 (U5) */}
                  <span className="text-xs2 text-neutral-400 ml-2">
                    {set.claims.map(c => CATEGORY_LABEL[c.category] ?? c.category).join(' + ')} · 구성요소 {new Set(set.claims.flatMap(c => c.element_ids ?? [])).size}개 · {scopeInfo.sub}
                  </span>
                </div>
                {isSelected && !done && (
                  <span className="text-xs2 text-brand-600 font-semibold shrink-0">선택됨</span>
                )}
              </div>

              <div className="px-3 pb-3 space-y-1.5">
                {set.claims.map((claim, ci) => {
                  const text = getClaimText(setIdx, ci);
                  const catLabel = CATEGORY_LABEL[claim.category] ?? claim.category;
                  return (
                    <div key={ci} className={clsx(
                      'rounded-lg border px-3 py-2',
                      isSelected ? 'border-brand-200 bg-white' : 'border-neutral-100 bg-neutral-50'
                    )}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs2 px-1.5 py-0.5 rounded-md font-medium bg-neutral-100 text-neutral-700">{catLabel}</span>
                        {!done && isSelected && (
                          <AiEditButton
                            className="ml-auto"
                            active={aiKey === `indep-${setIdx}-${ci}`}
                            onClick={e => { e.stopPropagation(); setAiKey(k => k === `indep-${setIdx}-${ci}` ? null : `indep-${setIdx}-${ci}`); }}
                          />
                        )}
                      </div>
                      {isSelected && !done ? (
                        <textarea
                          className="w-full text-sm2 text-neutral-800 bg-transparent outline-none resize-none leading-relaxed overflow-hidden"
                          value={text}
                          rows={Math.max(3, Math.ceil(text.length / 44))}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { setClaimText(setIdx, ci, e.target.value); syncUpdate(setIdx, depGroupsMap); }}
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        />
                      ) : (
                        <p className="text-sm2 text-neutral-600 leading-relaxed line-clamp-3"><ElementText text={text} elements={elements} /></p>
                      )}
                      {aiKey === `indep-${setIdx}-${ci}` && isSelected && !done && (
                        <InlineAiEdit
                          placeholder="이 독립항을 어떻게 수정할지 지시해주세요 (예: 권리범위를 조금 더 넓혀줘)"
                          onClose={() => setAiKey(null)}
                          original={text}
                          label="독립항"
                          onApply={newText => { setClaimText(setIdx, ci, newText); syncUpdate(setIdx, depGroupsMap); }}
                          doneMsg="독립항을 수정했습니다"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        </>)}
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

  // 종속항 전체 수정 제안 — 선택된 종속항 전체에 지시 반영 (mock, API dependent-claim/modification). 확인 후 적용은 AiGlobalBar가 담당.
  const proposeDepGlobal = (instr: string): PendingChange[] => {
    if (selectedSetIndex === null) return [];
    const groups = depGroupsMap[selectedSetIndex] ?? {};
    return Object.values(groups).flatMap(grp =>
      (grp as DepGroupState).items.filter(d => d.sel).map((d, i) => proposeMock(d.text, instr, `종속항 ${i + 1}`)));
  };
  const applyDepGlobal = (changes: PendingChange[]) => {
    if (selectedSetIndex === null) return;
    const byBefore = new Map(changes.map(c => [c.before, c.after ?? c.before]));
    const groups = depGroupsMap[selectedSetIndex] ?? {};
    const nextGroups: DepGroupsForSet = {};
    Object.entries(groups).forEach(([k, grp]) => {
      nextGroups[Number(k)] = {
        ...(grp as DepGroupState),
        items: (grp as DepGroupState).items.map(d => d.sel && byBefore.has(d.text) ? { ...d, text: byBefore.get(d.text)! } : d),
      };
    });
    const nextMap = { ...depGroupsMap, [selectedSetIndex]: nextGroups };
    setDepGroupsMap(nextMap);
    syncUpdate(selectedSetIndex, nextMap);
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto scroll-thin p-3 ml-1.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs2 font-semibold text-neutral-600">
          <span className="text-brand-700">{scopeInfo.label}</span>
          {' '}— 독립항 {selectedSet.claims.length}개, 종속항 {totalDep}개
        </span>
        {!done && (
          <button data-spec="SPC-CLM-031" onClick={() => setClaimsPhase('indep')} className="text-xs2 text-brand-600 hover:underline">
            ← 세트 다시 선택
          </button>
        )}
      </div>

      {/* 종속항 개수 레벨 (API claim_count_level) */}
      {!done && (
        <div data-spec="SPC-CLM-032" className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2">
          <span className="text-xs2 font-semibold text-neutral-500 shrink-0">종속항 분량</span>
          <div className="flex gap-1">
            {([['LOW', '적게'], ['MEDIUM', '보통'], ['HIGH', '많이']] as const).map(([lv, label]) => (
              <button
                key={lv}
                onClick={() => applyDepLevel(lv)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs2 font-semibold border transition-colors',
                  depLevel === lv
                    ? 'bg-brand-400 border-brand-600 text-white'
                    : 'bg-white border-neutral-200 text-neutral-500 hover:border-brand-300',
                )}
              >{label}</button>
            ))}
          </div>
          <span className="text-xs2 text-neutral-400 ml-auto">분량을 바꾸면 종속항이 다시 생성됩니다</span>
          <input
            value={depInstr}
            onChange={e => setDepInstr(e.target.value)}
            placeholder="생성 지시사항 (선택) — 예: 센서 구성 위주로 한정해줘"
            title="종속항 생성·다시 생성에 전달되는 추가 지시 (API dependent-claim instruction)"
            className="flex-1 min-w-0 text-xs2 bg-white border border-neutral-200 rounded-md px-2 py-1 outline-none focus:border-brand-300 transition-colors"
          />
        </div>
      )}

      {selectedSet.claims.map((claim, ci) => {
        const indepNum = ++globalClaimNum;
        const grp = setGroups[ci] ?? { generated: false, items: [], newText: '' };
        const catLabel = CATEGORY_LABEL[claim.category] ?? claim.category;
        const claimText = getClaimText(selectedSetIndex, ci);

        return (
          <div key={ci} className="rounded-xl border border-neutral-200 overflow-hidden">
            <div className="border-b px-3 py-2.5 bg-brand-50 border-brand-200">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon name="check" size={11} className="text-brand-600" />
                <span className="text-xs2 font-bold text-brand-400">청구항 {indepNum}</span>
                <span className="text-xs2 px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-medium">{catLabel}</span>
                {!done && (
                  <AiEditButton
                    className="ml-auto"
                    active={aiKey === `indepB-${ci}`}
                    onClick={e => { e.stopPropagation(); setAiKey(k => k === `indepB-${ci}` ? null : `indepB-${ci}`); }}
                  />
                )}
              </div>
              <p className="text-base2 text-neutral-700 leading-relaxed whitespace-pre-wrap px-1"><ElementText text={claimText} elements={elements} /></p>
              {aiKey === `indepB-${ci}` && !done && (
                <InlineAiEdit
                  placeholder="이 독립항을 어떻게 수정할지 지시해주세요"
                  onClose={() => setAiKey(null)}
                  original={claimText}
                  label="독립항"
                  onApply={newText => setClaimText(selectedSetIndex, ci, newText)}
                  doneMsg="독립항을 수정했습니다"
                />
              )}
            </div>

            <div className="p-2.5 space-y-1.5">
              <div data-spec="SPC-CLM-030" className="flex items-center gap-2 mb-1">
                <span className="text-xs2 font-semibold text-neutral-500">
                  종속항 · 채택 {grp.items.filter(d => d.sel).length}
                </span>
                {!done && grp.generated && (
                  <button
                    onClick={() => confirmOverwrite('종속항 다시 생성', `청구항 ${indepNum}의 종속항이 새 초안으로 대체됩니다(편집·채택 내용 소실). 계속할까요?`, '다시 생성', () => {
                      const isDevice = claim.category === 'MACHINE';
                      const suffix = isDevice ? '데이터 처리 시스템.' : '데이터 처리 방법.';
                      const ref = `제${indepNum}`;
                      const newItems: DepItemState[] = [
                        { id: 1, sel: true,  text: `${ref}항에 있어서, 상기 처리부는 딥러닝 알고리즘을 포함하는, ${suffix}`, editing: false, editVal: '', element_idxs: [0] },
                        { id: 2, sel: true,  text: `${ref}항에 있어서, 상기 입력부는 복수의 센서를 포함하는, ${suffix}`, editing: false, editVal: '', element_idxs: [1] },
                        { id: 3, sel: true,  text: `${ref}항에 있어서, 상기 출력부는 처리 결과를 시각화하여 표시하는, ${suffix}`, editing: false, editVal: '', element_idxs: [2] },
                        { id: 4, sel: false, text: `${ref}항에 있어서, 상기 구성은 클라우드 환경에서 동작하는, ${suffix}`, editing: false, editVal: '', element_idxs: [0, 1] },
                      ];
                      const next = { ...setGroups, [ci]: { ...grp, items: newItems } };
                      const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
                      setDepGroupsMap(nextMap);
                      syncUpdate(selectedSetIndex, nextMap);
                    })}
                    className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs2 font-medium text-brand-500 border border-brand-200 bg-white hover:bg-brand-50 transition-colors"
                    data-spec="SPC-CLM-036" title="이 독립항의 종속항을 다시 생성"
                  >↻ 다시 생성</button>
                )}
              </div>

              {grp.items.map(dep => {
                const depNum = ++globalClaimNum;
                const displayText = dep.text.replace(new RegExp(`제${ci + 1}항에 있어서`, 'g'), `제${indepNum}항에 있어서`);
                return (
                  <div key={dep.id} className={clsx('group rounded-lg border overflow-hidden', dep.sel ? 'border-neutral-200 bg-white' : 'border-neutral-100 bg-neutral-50 opacity-60')}>
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); toggleDep(ci, dep.id); }}
                        className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                          dep.sel ? 'bg-brand-400 border-brand-400 text-white' : 'border-neutral-400 bg-white hover:border-brand-400')}
                        data-spec="SPC-CLM-033" title={dep.sel ? '채택 해제' : '채택'}
                      >
                        {dep.sel && <Icon name="check" size={10} />}
                      </button>
                      <span className="text-xs2 text-neutral-500 font-medium shrink-0">종속항 {depNum}</span>
                      {/* 행 액션은 hover/포커스/열림 상태에서만 노출 — 8행 반복 버튼 기둥 제거 (B2) */}
                      {!done && (
                        <div className={clsx(
                          'ml-auto flex items-center gap-1 transition-opacity',
                          aiKey === `dep-${ci}-${dep.id}` ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                        )}>
                          {dep.sel && (
                            <AiEditButton
                              active={aiKey === `dep-${ci}-${dep.id}`}
                              onClick={e => { e.stopPropagation(); setAiKey(k => k === `dep-${ci}-${dep.id}` ? null : `dep-${ci}-${dep.id}`); }}
                            />
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); confirmDelete(`종속항 ${depNum}`, () => removeDep(ci, dep.id), `종속항 ${depNum}을(를) 삭제할까요? 명세서에서 빼기만 하려면 체크를 해제하세요.`.replace('을(를)', particle(String(depNum), '을', '를'))); }}
                            className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            data-spec="SPC-CLM-035" title="종속항 삭제"
                          >✕</button>
                        </div>
                      )}
                    </div>
                    <div className="px-2.5 pb-2">
                      {!done && dep.sel ? (
                        <textarea
                          className="w-full text-base2 text-neutral-700 leading-relaxed bg-transparent outline-none resize-none overflow-hidden"
                          value={displayText}
                          rows={1}
                          onChange={e => {
                            const next = { ...setGroups, [ci]: { ...grp, items: grp.items.map(d => d.id === dep.id ? { ...d, text: e.target.value } : d) } };
                            const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
                            setDepGroupsMap(nextMap);
                            syncUpdate(selectedSetIndex, nextMap);
                          }}
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        />
                      ) : (
                        <p className="text-base2 text-neutral-700 leading-relaxed"><ElementText text={displayText} elements={elements} /></p>
                      )}
                      {/* 연관 구성요소 칩 — API GeneratedDependentClaimItem.element_idxs (생성 단계 표시용) */}
                      {!!dep.element_idxs?.length && elements.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5" title="이 종속항과 연관된 구성요소 (API element_idxs)">
                          <span className="text-xs2 text-neutral-400">연관 구성요소</span>
                          {dep.element_idxs.filter(ei => elements[ei]).map(ei => (
                            <span key={ei} className="text-xs2 px-1.5 py-px rounded-full bg-neutral-100 text-neutral-600">
                              {elements[ei].symbol ? `${elements[ei].symbol} ` : ''}{elements[ei].value_ko}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* 선행 근거 경고 — "상기 X"가 인용 독립항에 없으면 표시 (A2) */}
                      {ENABLE_ANTECEDENT_CHECK && dep.sel && (() => {
                        const missing = findMissingAntecedents(displayText, claimText);
                        if (!missing.length) return null;
                        const list = missing.map(t => `'${t}'`).join(', ');
                        return (
                          <p className="mt-1.5 inline-flex items-start gap-1.5 text-xs2 text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1" title="종속항이 인용하는 구성요소가 독립항에 정의되어 있지 않습니다 (선행 근거 결함)">
                            <span aria-hidden="true">⚠</span>
                            <span>선행 근거 확인: {list}{missing.length > 1 ? '이(가)' : particle(missing[0], '이', '가')} 제{indepNum}항에 없습니다.</span>
                          </p>
                        );
                      })()}
                      {aiKey === `dep-${ci}-${dep.id}` && !done && dep.sel && (
                        <InlineAiEdit
                          placeholder="이 종속항을 어떻게 수정할지 지시해주세요 (예: 한정 요소를 더 구체화해줘)"
                          onClose={() => setAiKey(null)}
                          original={displayText}
                          label="종속항"
                          onApply={newText => {
                              const next = { ...setGroups, [ci]: { ...grp, items: grp.items.map(d => d.id === dep.id ? { ...d, text: newText } : d) } };
                              const nextMap = { ...depGroupsMap, [selectedSetIndex]: next };
                              setDepGroupsMap(nextMap);
                              syncUpdate(selectedSetIndex, nextMap);
                            }}
                          doneMsg="종속항을 수정했습니다"
                        />
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
                    data-spec="SPC-CLM-037" placeholder={`제${indepNum}항에 있어서, ...`}
                    className="flex-1 text-xs2 px-2.5 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 focus:outline-none focus:border-brand-400 focus:bg-white"
                  />
                  <button
                    onClick={() => addDep(ci)}
                    disabled={!grp.newText.trim()}
                    className="px-2 py-1.5 text-xs2 text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 disabled:opacity-40"
                  >추가</button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 종속항 전체 수정 지시 — 데모 정합: dependent-claim/modification */}
      {!done && (
        <AiGlobalBar
          className="pt-1"
          title="종속항 수정 제안"
          placeholder="종속항 전반에 대한 AI 지시사항 (예: 각 독립항당 한정 요소를 다양하게 / 3항을 더 넓게)"
          value={depGlobalInstr}
          onChange={setDepGlobalInstr}
          propose={proposeDepGlobal}
          onApply={applyDepGlobal}
          doneMsg="종속항에 적용했습니다"
          disabled={done || selectedSetIndex === null}
        />
      )}
    </div>
    </>
  );
}

// ── 중간명세서 패널 (#22) ─────────────────────────────────────────────────────
function MidspecPanel({ done, sections, onUpdate, onGoToEditor, onActionChange, elements = [] }: {
  done: boolean;
  elements?: ElementLike[];
  sections: MidspecSection[];
  onUpdate: (next: MidspecSection[]) => void;
  onGoToEditor?: () => void;
  onActionChange?: (a: StepAction | null) => void;   // 하단 바 주 동작 등록 (D3)
}) {
  // 하단 바 주 동작: '명세서 생성 →' (패널 내부 풀폭 CTA 대신) — D3
  const goRef = useRef(onGoToEditor);
  useEffect(() => { goRef.current = onGoToEditor; });
  useEffect(() => {
    if (!onActionChange) return;
    onActionChange(!done && onGoToEditor ? { label: '명세서 생성 →', onClick: () => goRef.current?.() } : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, !!onGoToEditor]);
  useEffect(() => () => onActionChange?.(null), [onActionChange]);
  const [editing, setEditing] = useState<{ sectionKey: string; blockIdx: number } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [newTexts, setNewTexts] = useState<Record<string, string>>({});
  // 인라인 AI 수정 — 열린 블록 키 (`${sectionKey}-${blockIdx}`)
  const [aiKey, setAiKey] = useState<string | null>(null);
  // 생성 지시·선호 사항 + 다시 생성 (데모 정합)
  const [genInstr, setGenInstr] = useState('');
  const [genBusy, setGenBusy] = useState(false);

  if (sections.length === 0) {
    return (
      <div className="flex-1 p-4 text-center text-neutral-400">
        <p className="text-sm2">중간명세서를 생성 중입니다...</p>
      </div>
    );
  }

  const updateBlock = (sKey: string, bIdx: number, text: string) => {
    const next = sections.map(s => s.key !== sKey ? s : {
      ...s,
      blocks: s.blocks.map((b, i) => i === bIdx ? { ...b, content: text } : b),
    });
    onUpdate(next);
  };

  const addBlock = (sKey: string) => {
    const text = (newTexts[sKey] ?? '').trim();
    if (!text) return;
    const next = sections.map(s => s.key !== sKey ? s : { ...s, blocks: [...s.blocks, { id: uid(), type: 'text' as const, content: text }] });
    onUpdate(next);
    setNewTexts(p => ({ ...p, [sKey]: '' }));
  };

  const removeBlock = (sKey: string, bIdx: number) => {
    const next = sections.map(s => s.key !== sKey ? s : { ...s, blocks: s.blocks.filter((_, i) => i !== bIdx) });
    onUpdate(next);
  };

  // 중간명세서 다시 생성 — 생성 지시·선호 사항 반영 (mock: 전체 블록에 지시 반영)
  const regenerate = () => {
    if (genBusy || done) return;
    // 편집 내용이 대체되므로 확인 후 실행 (A3, 데모 confirm 정합)
    openAlertDialog(
      { title: '중간명세서 다시 생성', description: '현재 편집한 단락 내용이 새 초안으로 대체됩니다. 계속할까요?', confirm: '다시 생성', cancel: '취소' },
      { theme: 'primary', onConfirm: (ctrl) => { ctrl.close(); runRegenerate(); } },
    );
  };
  const runRegenerate = () => {
    setGenBusy(true);
    setTimeout(() => {
      const instr = genInstr.trim() || '초안 재생성';
      onUpdate(sections.map(s => ({
        ...s,
        blocks: s.blocks.map(b => ({ ...b, content: generateMockModification(b.content, instr) })),
      })));
      setGenBusy(false);
      toast('중간명세서를 다시 생성했습니다');
    }, 1100);
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-3 ml-1.5 space-y-3">

      {/* 생성 지시·선호 사항 + 다시 생성 — 데모 정합 */}
      {!done && (
        <div className="space-y-1.5">
          <textarea
            className="w-full text-xs2 px-2.5 py-1.5 border border-neutral-200 rounded-lg bg-white outline-none focus:border-brand-400 resize-none transition-colors disabled:bg-neutral-50"
            placeholder="생성 지시·선호 사항 (선택) — 예: 배경기술은 규제 동향부터 서술해줘 / 효과는 정량 수치를 강조해줘"
            rows={2}
            value={genInstr}
            disabled={genBusy}
            onChange={e => setGenInstr(e.target.value)}
          />
          <button data-spec="SPC-MID-020"
            onClick={regenerate}
            disabled={genBusy}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs2 font-medium text-brand-500 border border-brand-200 bg-white hover:bg-brand-50 disabled:opacity-50 transition-colors"
          >
            {genBusy ? <><span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin inline-block" /> 생성 중...</> : '↻ 중간명세서 다시 생성'}
          </button>
        </div>
      )}

      {sections.map(section => (
        <div key={section.key} className="rounded-xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center px-3 py-2 bg-neutral-50 border-b border-neutral-100">
            <span className="text-xs2 font-bold text-neutral-700">{section.label}</span>
            <span className="text-xs2 text-neutral-400 ml-2">({section.blocks.length}개 단락)</span>
          </div>

          <div className="p-2.5 space-y-2">
            {section.blocks.map((block, bIdx) => {
              const isEdit = editing?.sectionKey === section.key && editing.blockIdx === bIdx;
              return (
                <div key={bIdx} className="rounded-lg border border-neutral-100 bg-white overflow-hidden group">
                  {isEdit ? (
                    <div className="p-2">
                      <textarea
                        autoFocus
                        className="w-full text-sm2 text-neutral-800 leading-relaxed bg-transparent outline-none resize-none"
                        value={editVal}
                        rows={Math.max(3, Math.ceil(editVal.length / 46))}
                        onChange={e => setEditVal(e.target.value)}
                        ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                      />
                      <div className="flex gap-1.5 mt-1.5 justify-end">
                        <button
                          onClick={() => setEditing(null)}
                          className="text-xs2 px-2 py-1 rounded-md text-neutral-500 hover:bg-neutral-100"
                        >취소</button>
                        <button
                          onClick={() => { updateBlock(section.key, bIdx, editVal); setEditing(null); }}
                          className="text-xs2 px-2 py-1 rounded-lg bg-brand-400 text-white hover:bg-brand-500"
                        >저장</button>
                      </div>
                    </div>
                  ) : (
                    <>
                    <div className="flex gap-2 px-3 py-2">
                      <p className="flex-1 text-base2 text-neutral-700 leading-relaxed whitespace-pre-wrap"><ElementText text={block.content} elements={elements} /></p>
                      {!done && (
                        <div className={clsx(
                          'flex items-center gap-1 shrink-0 self-start transition-opacity',
                          aiKey === `${section.key}-${bIdx}` ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                        )}>
                          <AiEditButton
                            active={aiKey === `${section.key}-${bIdx}`}
                            onClick={() => setAiKey(k => k === `${section.key}-${bIdx}` ? null : `${section.key}-${bIdx}`)}
                          />
                          <button
                            onClick={() => { setEditing({ sectionKey: section.key, blockIdx: bIdx }); setEditVal(block.content); }}
                            data-spec="SPC-MID-011" title="직접 편집"
                            className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                          ><Icon name="edit" size={11} /></button>
                          <button
                            data-spec="SPC-MID-013" onClick={() => confirmDelete(`'${section.label}' 단락`, () => removeBlock(section.key, bIdx))}
                            title="삭제"
                            className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >✕</button>
                        </div>
                      )}
                    </div>
                    {aiKey === `${section.key}-${bIdx}` && !done && (
                      <div className="px-3 pb-2">
                        <InlineAiEdit
                          placeholder={`'${section.label}' 단락을 어떻게 수정할지 지시해주세요`}
                          onClose={() => setAiKey(null)}
                          original={block.content}
                          label="중간명세서 단락"
                          onApply={newText => updateBlock(section.key, bIdx, newText)}
                          doneMsg="단락을 수정했습니다"
                        />
                      </div>
                    )}
                    </>
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
                  data-spec="SPC-MID-014" placeholder="단락 추가..."
                  className="flex-1 text-xs2 px-2.5 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 focus:outline-none focus:border-brand-400 focus:bg-white"
                />
                <button
                  onClick={() => addBlock(section.key)}
                  disabled={!(newTexts[section.key] ?? '').trim()}
                  className="px-2.5 py-1.5 text-xs2 text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 disabled:opacity-40"
                >추가</button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 다음 동작 안내 — 실행 버튼은 하단 바 '명세서 생성 →' 하나로 (D3) */}
      {!done && onGoToEditor && (
        <p data-spec="SPC-MID-030" className="text-xs2 text-neutral-500 px-1">
          편집을 마쳤으면 하단의 <b className="text-neutral-700">명세서 생성 →</b>을 누르세요. AI가 구성요소·도면·청구항을 기반으로 실시예를 포함한 명세서 초안을 만들고 에디터로 이동합니다.
        </p>
      )}
    </div>
  );
}
