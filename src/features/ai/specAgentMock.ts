/**
 * 명세서 수정 에이전트 — 이용자 화면용 결정론적 목업.
 * 개발노트 [AXP] 명세서 수정 에이전트 (1)(2)/이거저거 의 UX를 재현한다.
 * 실제 LLM/백엔드(LangChain Router·intent 분류기)는 연동 시 이 모듈을 교체한다.
 */
import { generateMockModification } from './clarityAnalyzer';

// 라우팅되는 의도 — API SpecificationEditorChatMessage.intent 정합
// (answer / clarify / edit_body / edit_claims / edit_drawing_description / plan / replace_expression / terminate)
export type AgentIntent =
  | 'answer' | 'clarify' | 'plan' | 'terminate'
  | 'edit_body' | 'edit_claims' | 'edit_drawing_description'
  | 'replace_expression';

// routeIntent 단계에서는 수정 대상이 확정되지 않으므로 'edit'로 반환하고,
// 대상 섹션 확정 후 resolveEditIntent로 세분화한다.
export type RoutedIntent = AgentIntent | 'edit';

// 수정 대상 섹션 → edit 계열 intent 세분화 (API intent 정합)
export function resolveEditIntent(sids: string[]): AgentIntent {
  if (sids.length && sids.every(s => s === 'claims')) return 'edit_claims';
  if (sids.length && sids.every(s => s === 'drawing_descriptions')) return 'edit_drawing_description';
  return 'edit_body';
}

// 블록 수정 액션 (EditProposalMeta.action)
export type EditAction = 'REWRITE' | 'REPLACE' | 'INSERT' | 'DELETE';

export const EDIT_ACTION_LABEL: Record<EditAction, string> = {
  REWRITE: '재작성',
  REPLACE: '치환',
  INSERT: '삽입',
  DELETE: '삭제',
};

// 수정 제안 (EditProposalMeta 표현). status로 Accept/Decline/Pending 추적.
export interface EditProposal {
  sid: string;           // 대상 섹션 id
  idx: number;           // 대상 블록 순번
  action: EditAction;
  targetDesc: string;    // 위치 설명 (예: "'발명의 배경이 되는 기술' 2번째 블록")
  summary: string;       // 한줄 변경 의도
  source: string;        // 원문 (diff 좌)
  target: string;        // 수정본 (diff 우)
  status: 'pending' | 'accepted' | 'declined';
}

export interface PlanStepDef {
  title: string;         // 스텝 요약 (예: "배경기술 보완")
  instruction: string;   // 실제 지시
}

// 용어(표현) 교체 제안 — API ExpressionReplacement 정합
export interface ExpressionReplacement {
  source: string;                                   // 교체 전 표현
  target: string;                                   // 교체 후 표현
  status: 'pending' | 'accepted' | 'declined';
}

export interface RouteResult {
  intent: RoutedIntent;
  answer?: string;         // answer/terminate 시 표시 텍스트
  clarifyOptions?: string[];
  planSteps?: PlanStepDef[];
}

// ── 의도 판정 규칙 (결정론적 · 연동 시 분류기로 교체) ──────────────────────────
const RE_TERMINATE = /(인터넷|구글|검색해|웹\s*검색|특허\s*검색|논문\s*검색|시장\s*조사|도면\s*그려|그림\s*그려|이미지\s*생성|도면\s*생성|날씨|주가|번역기)/;
const RE_GUIDE = /(어떤\s*기능|무슨\s*기능|뭘\s*할\s*수|무엇을\s*할\s*수|기능\s*(안내|소개|설명)|사용법|어떻게\s*(써|사용))/;
const RE_QUESTION = /(어때|어떤가|검토|추천|어떻게|무엇|왜|이유|설명해|요약해|알려|가능한가|괜찮|평가)/;
const RE_EDIT = /(바꿔|수정|고쳐|보완|구체화|다듬|추가|삽입|넣어|삭제|지워|빼|줄여|늘려|압축|강조|명시|재작성|번역)/;
const RE_DELETE = /(삭제|지워|빼줘|빼고|제거)/;
const RE_INSERT = /(추가|삽입|넣어|덧붙|보태)/;
const RE_REWRITE = /(재작성|전면\s*수정|처음부터|새로\s*써|통째로)/;
// 플랜: "먼저 ~하고 그 다음/그에 맞춰 ~" 처럼 순차 다단계 지시
const RE_PLAN = /(먼저|우선).*(그\s*다음|그다음|그\s*후|이후|그에\s*맞[춰추]|맞춰서|반영해|다듬)/;
// 용어/표현 일괄 교체: "A를 B로 바꿔/통일/교체" 혹은 "용어를 일관되게"
const RE_REPLACE_EXPR = /((용어|표현|명칭)[^가-힣]*(일괄|일관|통일|교체))|((일관|통일)된?\s*(용어|표현))|문서\s*전체에서.*(바꿔|교체|통일)/;

export function routeIntent(msg: string, opts: { hasSelection: boolean }): RouteResult {
  const m = msg.trim();
  if (RE_REPLACE_EXPR.test(m)) {
    return { intent: 'replace_expression' };
  }
  if (RE_TERMINATE.test(m)) {
    return {
      intent: 'terminate',
      answer: '요청하신 작업은 이번 버전(M2)에서 지원하지 않습니다.\n\n외부 정보 검색(인터넷·특허·논문)과 도면 이미지 생성은 별도 기능에서 진행해 주세요. 본문·청구항·도면의 설명 수정, 명세서 내용 질의응답은 도와드릴 수 있습니다.',
    };
  }
  if (RE_GUIDE.test(m)) {
    return { intent: 'answer', answer: GUIDE_ANSWER };
  }
  if (RE_PLAN.test(m)) {
    const steps = splitPlanSteps(m);
    if (steps.length >= 2) return { intent: 'plan', planSteps: steps };
  }
  // 선택 단락이 있고 수정 지시면 edit, 모호하면 clarify
  if (opts.hasSelection) {
    if (RE_EDIT.test(m)) return { intent: 'edit' };
    // 지시가 모호 (짧고 수정 키워드 없음) → 방향 선택
    if (m.length < 8) return { intent: 'clarify', clarifyOptions: clarifyOptionsFor(m) };
    return { intent: 'edit' };
  }
  // 선택 없음 → 질의응답(answer)
  if (RE_QUESTION.test(m) || !RE_EDIT.test(m)) return { intent: 'answer' };
  // 수정 지시인데 선택이 없으면 대상을 물어봄(clarify)
  return { intent: 'clarify', clarifyOptions: ['본문에서 대상 단락을 먼저 선택할게요', '전체 문서를 기준으로 검토해줘'] };
}

export function clarifyOptionsFor(prompt: string): string[] {
  if (/길게|상세|늘려/.test(prompt)) return ['기술적 세부사항 추가', '실시예 보강', '발명의 효과 강조'];
  if (/문체|어투|톤/.test(prompt)) return ['특허 공식 문체', '간결한 기술 문체', '설명적 문체'];
  return ['더 간결하게', '특허 문체로', '구체적 수치 추가'];
}

// ── 수정 제안 생성 ────────────────────────────────────────────────────────────
function inferAction(instruction: string): EditAction {
  if (RE_REWRITE.test(instruction)) return 'REWRITE';
  if (RE_DELETE.test(instruction)) return 'DELETE';
  if (RE_INSERT.test(instruction)) return 'INSERT';
  return 'REPLACE';
}

export function buildProposal(
  sid: string, idx: number, sectionLabel: string, original: string, instruction: string,
): EditProposal {
  const action = inferAction(instruction);
  const targetDesc = `'${sectionLabel}' ${idx + 1}번째 블록`;
  const summary = `${instruction.slice(0, 30).trim() || '요청'} 반영`;
  let source = original, target = '';
  if (action === 'DELETE') { target = ''; }
  else if (action === 'INSERT') { source = ''; target = generateMockModification('', instruction); }
  else { target = generateMockModification(original, instruction); }
  return { sid, idx, action, targetDesc, summary, source, target, status: 'pending' };
}

// ── 플랜 분해 ────────────────────────────────────────────────────────────────
export function splitPlanSteps(msg: string): PlanStepDef[] {
  // "먼저 A하고, 그 다음/그에 맞춰 B" → [A, B]
  const parts = msg
    .split(/\s*(?:그\s*다음에?|그다음에?|그\s*후에?|이후에?|그에\s*맞[춰추]어?서?|,\s*그리고|,)\s*/)
    .map(s => s.replace(/^(먼저|우선)\s*/, '').trim())
    .filter(s => s.length > 1);
  const uniq = parts.filter((s, i) => parts.indexOf(s) === i).slice(0, 4);
  return uniq.map((s, i) => ({
    title: s.replace(/(해줘|해\s*주세요|해라|하고|을|를|좀)\s*$/,'').slice(0, 24).trim() || `단계 ${i + 1}`,
    instruction: s,
  }));
}

export const GUIDE_ANSWER =
  '명세서 수정 어시스턴트가 도와드릴 수 있는 작업입니다.\n\n' +
  '• 본문 수정: 기술분야·배경기술·해결과제·해결수단·효과·실시예 (단락 선택 후 지시)\n' +
  '• 청구항 수정: 독립항→종속항 순으로 검토·수정\n' +
  '• 도면의 설명 수정\n' +
  '• 용어/표현 일괄 교체: "문서 전체에서 용어를 일관된 표현으로 통일해줘"\n' +
  '• 명세서 내용 질의응답 / 작성 방향 추천\n' +
  '• 여러 단계 작업(플랜): "배경기술 먼저 보완하고 그에 맞춰 해결과제도 다듬어줘"\n\n' +
  '외부 검색·도면 이미지 생성·기타 요청은 지원하지 않습니다.';

export const INTENT_LABEL: Record<AgentIntent, string> = {
  answer: '답변',
  clarify: '방향 확인',
  plan: '플랜',
  terminate: '미지원',
  edit_body: '본문 수정',
  edit_claims: '청구항 수정',
  edit_drawing_description: '도면 설명 수정',
  replace_expression: '용어 교체',
};

// ── 용어(표현) 교체 mock ─────────────────────────────────────────────────────
// 데모/API: intent=replace_expression 시 ExpressionReplacement[] 제안.
// 1) 지시에 "A를 B로" 패턴이 있으면 그대로 사용
// 2) 없으면 문서에서 자주 쓰이는 표기 변형 후보를 탐색 (결정론적)
const COMMON_VARIANTS: Array<[string, string]> = [
  ['본원 발명', '본 발명'],
  ['상기한', '상기'],
  ['브레이크액', '브레이크 액'],
  ['디스크브레이크', '디스크 브레이크'],
  ['제동 기구', '제동기구'],
  ['씨스템', '시스템'],
  ['데이타', '데이터'],
];

export function buildExpressionReplacements(instruction: string, docText: string): ExpressionReplacement[] {
  const out: ExpressionReplacement[] = [];
  // "A를 B로 바꿔/교체/통일" 명시 패턴 — 따옴표 구문은 공백 포함 허용, 일반 구문은 단일 어절만
  const m = instruction.match(/['"“”]([^'"“”]{1,30})['"“”]\s*[을를]\s*['"“”]?([^'"“”\s]{1,30}?)['"“”]?(?:으로|로)\s*(바꿔|교체|통일)/)
    || instruction.match(/([\w가-힣]{1,20})[을를]\s*([\w가-힣]{1,20}?)(?:으로|로)\s*(바꿔|교체|통일)/);
  if (m) out.push({ source: m[1].trim(), target: m[2].trim(), status: 'pending' });
  // 문서 내 표기 변형 탐색
  for (const [src, tgt] of COMMON_VARIANTS) {
    if (out.length >= 3) break;
    if (docText.includes(src) && !out.some(r => r.source === src)) {
      out.push({ source: src, target: tgt, status: 'pending' });
    }
  }
  return out;
}

// ── 요청 분석 진행 트리 (데모 SSE 이벤트 {label, depth} 정합) ────────────────
export interface ProgressStep { label: string; depth: number }

export function progressStepsFor(intent: RoutedIntent): ProgressStep[] {
  const head: ProgressStep = { label: '요청 의도 파악', depth: 0 };
  switch (intent) {
    case 'edit':
    case 'edit_body':
      return [head,
        { label: '본문 편집', depth: 0 },
        { label: '참고 문단 수집', depth: 1 },
        { label: '도면 확인', depth: 1 },
        { label: '본문 수정안 작성', depth: 1 }];
    case 'edit_claims':
      return [head,
        { label: '청구항 편집', depth: 0 },
        { label: '관련 청구항 수집', depth: 1 },
        { label: '구성요소 대응 확인', depth: 1 },
        { label: '청구항 수정안 작성', depth: 1 }];
    case 'edit_drawing_description':
      return [head,
        { label: '도면 설명 편집', depth: 0 },
        { label: '도면 확인', depth: 1 },
        { label: '설명 수정안 작성', depth: 1 }];
    case 'replace_expression':
      return [head,
        { label: '용어 교체', depth: 0 },
        { label: '문서 내 용례 수집', depth: 1 },
        { label: '교체안 작성', depth: 1 }];
    case 'plan':
      return [head, { label: '작업 계획 수립', depth: 0 }];
    case 'clarify':
      return [head, { label: '선택지 구성', depth: 0 }];
    case 'terminate':
      return [head];
    case 'answer':
    default:
      return [head, { label: '문서 검토·답변 작성', depth: 0 }];
  }
}
