/**
 * SpecEditorView — 명세서 에디터
 * 블록 단위 편집 + 섹션 탭(앵커) + 우측 AI/도면/참고문헌 패널
 * absolute 없음 — 기존 사이드바/레이아웃 유지
 */
import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import katex from 'katex';
import { Icon } from '../components/Icon';
import { Input } from '../components/ui';
import { Button, Textarea } from '@muhayu/axp-ui';
import type { InventionContext, MidspecSection, InventionSpecification, Drawing } from '../features/spec/types';
import type { DrawingItem as WorkflowDrawingItem } from '../features/drawing-workflow/types';
import { openEditorTab } from '../features/drawing-workflow/editorChannel';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import { PreviewModal } from '../components/PreviewModal';
import type { PreviewSection } from '../components/PreviewModal';
import {
  routeIntent, buildProposal, EDIT_ACTION_LABEL, INTENT_LABEL,
  type EditProposal, type PlanStepDef, type AgentIntent,
} from '../features/ai/specAgentMock';
import { exportDocx } from '../utils/exportDocx';
import { exportPdf } from '../utils/exportPdf';

// ── KaTeX 유틸리티 ─────────────────────────────────────────────────────────
function renderTeX(tex: string, displayMode = false): { html: string; error?: string } {
  try {
    const html = katex.renderToString(tex, { throwOnError: true, displayMode, output: 'html' });
    return { html };
  } catch (e: unknown) {
    return { html: '', error: (e as Error).message?.split('\n')[0] ?? '수식 오류' };
  }
}

function renderBlockWithTeX(text: string): string {
  // $$...$$ 블록 수식 먼저
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const { html, error } = renderTeX(tex.trim(), true);
    return error
      ? `<span class="text-red-400 text-xs">[수식 오류: ${tex.trim().slice(0, 20)}]</span>`
      : `<span class="katex-block">${html}</span>`;
  });
  // $...$ 인라인 수식
  result = result.replace(/\$([^$\n]+)\$/g, (_, tex) => {
    const { html, error } = renderTeX(tex.trim(), false);
    return error
      ? `<span class="text-red-400 text-xs">[수식 오류]</span>`
      : html;
  });
  return result;
}

function renderWithCompHighlights(
  text: string,
  compNames: string[],
  onClickComp?: (name: string) => void,
): React.ReactNode {
  if (!compNames.length || !text.trim()) return text;
  const escaped = [...compNames]
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        compNames.includes(part) ? (
          <mark
            key={i}
            className={clsx(
              'bg-blue-50 text-blue-700 rounded-sm px-0.5 font-medium not-italic',
              onClickComp && 'cursor-pointer hover:bg-blue-100 transition-colors'
            )}
            style={{ textDecoration: 'none' }}
            onClick={onClickComp ? (e) => { e.stopPropagation(); onClickComp(part); } : undefined}
            title={onClickComp ? '클릭하여 전체 이름 변경' : undefined}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── 수식 템플릿 (모듈 레벨 — 매 렌더 재생성 방지) ─────────────────────────
const FORMULA_TEMPLATES = [
  { label: '분수',    tex: '\\frac{a}{b}',                              title: '분수' },
  { label: '제곱근',  tex: '\\sqrt{x}',                                 title: '제곱근' },
  { label: 'n제곱근', tex: '\\sqrt[n]{x}',                              title: 'n제곱근' },
  { label: '합산∑',  tex: '\\sum_{i=1}^{n} x_i',                       title: '합산 (시그마)' },
  { label: '적분∫',  tex: '\\int_{a}^{b} f(x)\\,dx',                   title: '정적분' },
  { label: '극한',    tex: '\\lim_{x \\to \\infty} f(x)',               title: '극한' },
  { label: '편미분',  tex: '\\frac{\\partial f}{\\partial x}',          title: '편미분' },
  { label: '벡터',    tex: '\\vec{v}',                                   title: '벡터' },
  { label: '행렬',    tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', title: '2×2 행렬' },
  { label: '≤',      tex: '\\leq',                                      title: '이하 (≤)' },
  { label: '≥',      tex: '\\geq',                                      title: '이상 (≥)' },
  { label: '≠',      tex: '\\neq',                                      title: '같지 않음 (≠)' },
  { label: '∈',      tex: '\\in',                                       title: '원소 (∈)' },
  { label: 'αβγ',   tex: '\\alpha + \\beta + \\gamma',                 title: '그리스 문자' },
  { label: 'E=mc²',  tex: 'E = mc^{2}',                                title: 'Einstein 공식' },
];

// ── 섹션 정의 ──────────────────────────────────────────────────────────────
const EDITOR_SECTIONS = [
  { id: 'title',                  label: '발명의 명칭',                       short: '명칭' },
  { id: 'technical_field',        label: '기술분야',                          short: '기술분야' },
  { id: 'background_art',         label: '발명의 배경기술',                    short: '배경기술' },
  { id: 'technical_problem',      label: '해결하고자 하는 과제',               short: '해결과제' },
  { id: 'technical_solution',     label: '해결수단',                          short: '해결수단' },
  { id: 'advantageous_effects',   label: '발명의 효과',                        short: '효과' },
  { id: 'drawing_descriptions',   label: '도면의 간단한 설명',                  short: '도면설명' },
  { id: 'embodiment_description', label: '발명을 실시하기 위한 구체적인 내용',   short: '구체적 내용' },
  { id: 'claims',                 label: '청구범위',                           short: '청구범위' },
] as const;
type SectionId = typeof EDITOR_SECTIONS[number]['id'];

// ── 초기 텍스트 ────────────────────────────────────────────────────────────

// 텍스트 → 단락 배열
function toBlocks(text: string): string[] {
  const b = text.split('\n\n').filter(s => s.trim());
  return b.length ? b : [''];
}

// 마크다운 표 감지 / 렌더 (구분선 행 + 파이프 구분)
function isMarkdownTable(text: string): boolean {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const hasSep = lines.some(l => /-{3,}/.test(l) && /^[\s|:-]+$/.test(l));
  const hasPipe = lines.filter(l => l.includes('|')).length >= 2;
  return hasSep && hasPipe;
}
function parseRow(l: string): string[] {
  let parts = l.split('|').map(c => c.trim());
  if (parts[0] === '') parts = parts.slice(1);
  if (parts.length && parts[parts.length - 1] === '') parts = parts.slice(0, -1);
  return parts;
}
function MarkdownTable({ text }: { text: string }) {
  const rows = text.trim().split('\n').map(l => l.trim())
    .filter(l => l && !/^[\s|:-]+$/.test(l)) // 구분선 행 제거
    .map(parseRow);
  if (!rows.length) return null;
  const [head, ...body] = rows;
  return (
    <table className="border-collapse text-base2 w-full">
      <thead>
        <tr>{head.map((c, i) => <th key={i} className="border border-zinc-300 px-2 py-1 bg-zinc-50 font-semibold text-left text-zinc-700">{c}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((r, ri) => (
          <tr key={ri}>{head.map((_, ci) => <td key={ci} className="border border-zinc-300 px-2 py-1 text-zinc-700">{r[ci] ?? ''}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

// ── 청구항 구조 편집 (API ClaimSet 형태: {no, value, depends_on}) ──────────
// 도면 → 편집기(새 탭) 세션 아이템 매핑 (SpecView의 toWorkflowDrawingItem과 동일 — 순환 import 회피 위해 복제)
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

// 직렬화는 텍스트(blocks['claims'])로 유지 — 미리보기/DOCX/PDF 호환. 구조 출력은 실 API 연동 시.
function parseClaimItems(blocks: string[]): { value: string }[] {
  return blocks
    .filter(b => /^청구항\s*\d+\./.test(b.trim()))
    .map(b => ({ value: b.trim().replace(/^청구항\s*\d+\.\s*\n?/, '') }));
}
function claimDependsOn(value: string): number | null {
  const m = value.match(/제\s*(\d+)\s*항/);
  return m ? parseInt(m[1], 10) : null;
}
function serializeClaimItems(items: { value: string }[]): string[] {
  const indep = items.filter(it => claimDependsOn(it.value) === null).length;
  const header = `독립항 ${indep}개, 종속항 ${items.length - indep}개`;
  return [header, ...items.map((it, i) => `청구항 ${i + 1}.\n${it.value}`)];
}

function ClaimsEditor({ blocks, onChange }: {
  blocks: string[];
  onChange: (next: string[]) => void;
}) {
  const items = parseClaimItems(blocks);
  const commit = (next: { value: string }[]) => onChange(serializeClaimItems(next));
  const editVal = (idx: number, v: string) => commit(items.map((it, i) => i === idx ? { value: v } : it));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[idx], a[j]] = [a[j], a[idx]];
    commit(a);
  };
  const remove = (idx: number) => commit(items.filter((_, i) => i !== idx));
  const addIndep = () => commit([...items, { value: '새 독립 청구항 내용을 입력하세요.' }]);
  const addDep = () => commit([...items, { value: `제1항에 있어서, ...인, 장치.` }]);

  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs2 text-zinc-400 py-3 text-center">청구항이 없습니다. 아래에서 추가하세요.</p>
        <div className="flex gap-2">
          <button onClick={addIndep} className="flex-1 py-1.5 text-xs2 font-semibold text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">+ 독립항 추가</button>
          <button onClick={addDep} className="flex-1 py-1.5 text-xs2 font-semibold text-amber-600 border border-dashed border-amber-300 rounded-lg hover:bg-amber-50 transition-colors">+ 종속항 추가</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs2 text-zinc-400 mb-1">
        번호는 위치에 따라 자동 부여됩니다. <span className="text-amber-600 font-medium">본문의 "제N항" 참조는 자동 변경되지 않으니 직접 수정하세요.</span>
      </p>
      {items.map((it, idx) => {
        const no = idx + 1;
        const dep = claimDependsOn(it.value);
        const isIndep = dep === null;
        const mismatch = dep !== null && (dep < 1 || dep >= no);
        return (
          <div key={idx} className={clsx('rounded-lg border p-2', isIndep ? 'border-blue-300 bg-blue-50/30' : 'border-amber-200 bg-white ml-4')}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs2 font-bold text-zinc-700">청구항 {no}</span>
              {isIndep ? (
                <span className="text-xs2 px-1.5 py-px rounded-full bg-blue-100 text-blue-700 font-medium">독립항</span>
              ) : (
                <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', mismatch ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700')}>
                  제{dep}항 종속{mismatch && ' ⚠ 번호 확인'}
                </span>
              )}
              <div className="ml-auto flex gap-0.5">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 transition-all" title="위로">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 7l3-4 3 4"/></svg>
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 transition-all" title="아래로">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 3l3 4 3-4"/></svg>
                </button>
                <button onClick={() => remove(idx)} className="w-5 h-5 rounded flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all" title="삭제">
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="9" height="9"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>
                </button>
              </div>
            </div>
            <textarea
              value={it.value}
              onChange={e => editVal(idx, e.target.value)}
              rows={Math.max(2, Math.ceil(it.value.length / 50))}
              className="w-full text-base2 text-zinc-800 leading-relaxed bg-transparent outline-none resize-none border border-transparent focus:border-blue-300 focus:bg-white rounded px-1.5 py-1 transition-colors"
              ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            />
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <button onClick={addIndep} className="flex-1 py-1.5 text-xs2 font-semibold text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">+ 독립항 추가</button>
        <button onClick={addDep} className="flex-1 py-1.5 text-xs2 font-semibold text-amber-600 border border-dashed border-amber-300 rounded-lg hover:bg-amber-50 transition-colors">+ 종속항 추가</button>
      </div>
    </div>
  );
}

// ── SVG 아이콘 헬퍼 ──────────────────────────────────────────────────────
const UndoIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M3 7H10a4 4 0 0 1 0 8H6"/><path d="M3 7L6 4M3 7L6 10"/>
  </svg>
);
const RedoIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M13 7H6a4 4 0 0 0 0 8H10"/><path d="M13 7L10 4M13 7L10 10"/>
  </svg>
);

const TableIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <rect x="1" y="1" width="14" height="14" rx="1"/>
    <line x1="1" y1="5.5" x2="15" y2="5.5"/>
    <line x1="1" y1="10.5" x2="15" y2="10.5"/>
    <line x1="5.5" y1="1" x2="5.5" y2="15"/>
    <line x1="10.5" y1="1" x2="10.5" y2="15"/>
  </svg>
);

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export function SpecEditorView({ task, onBack, confirmedTitle, midspec, context, confirmedClaimsText }: {
  task: any
  onBack: () => void
  confirmedTitle?: string
  midspec?: MidspecSection[]
  context?: InventionContext
  confirmedClaimsText?: string
}) {
  const taskName: string = task?.name || '새 명세서';
  const effectiveTitle = confirmedTitle || taskName;

  // ── 초기 콘텐츠 헬퍼 (MidspecSection 기반) ──
  function getMidspecText(key: string): string {
    const section = midspec?.find(s => s.key === key)
    return section?.blocks.map(b => b.text).join('\n\n') ?? ''
  }

  function getInitialContent(
    id: SectionId,
    name: string,
  ): string {
    if (id === 'title') return confirmedTitle || name
    if (id === 'claims') return confirmedClaimsText || `청구항 1.\n${name} 장치.`
    const text = getMidspecText(id as keyof InventionSpecification)
    if (text) return text
    const fallback: Partial<Record<SectionId, string>> = {
      title:                  name,
      technical_field:        `본 발명은 ${name}에 관한 것이다.`,
      background_art:         '관련 배경기술을 기술하세요.',
      technical_problem:      '해결하려는 과제를 기술하세요.',
      technical_solution:     '해결수단을 기술하세요.',
      advantageous_effects:   '발명의 효과를 기술하세요.',
      drawing_descriptions:   '도면에 대한 설명을 기술하세요.',
      embodiment_description: '발명의 구체적인 내용을 기술하세요.',
      claims:                 `청구항 1.\n${name} 장치.`,
    }
    return fallback[id] || ''
  }

  // 섹션별 블록 배열 (localStorage 복원 우선)
  const [blocks, setBlocks] = useState<Record<SectionId, string[]>>(() => {
    if (task?.id) {
      const saved = loadSpecState(task.id);
      if (saved?.editorBlocks && Object.keys(saved.editorBlocks).length > 0) {
        return saved.editorBlocks as Record<SectionId, string[]>;
      }
    }
    return Object.fromEntries(
      EDITOR_SECTIONS.map(s => [s.id, toBlocks(getInitialContent(s.id, effectiveTitle))])
    ) as Record<SectionId, string[]>;
  });

  // 편집 중인 블록 (textarea 활성화, 단일)
  const [sel, setSel] = useState<{ sid: SectionId; idx: number } | null>({ sid: 'technical_field', idx: 0 });
  const [drawingRefMenuOpen, setDrawingRefMenuOpen] = useState(false); // 본문 툴바: 도면 참조 삽입 메뉴
  const blockTaRef = useRef<HTMLTextAreaElement | null>(null);          // 현재 편집 중인 본문 textarea
  const caretRef = useRef<{ sid: SectionId; idx: number; start: number; end: number } | null>(null); // 마지막 캐럿 위치
  // AI 컨텍스트용 다중 선택 — key: `${sid}-${idx}`
  const [selSet, setSelSet] = useState<Set<string>>(new Set());

  // 활성 섹션 탭
  const [activeSec, setActiveSec] = useState<SectionId>('technical_field');

  // 모바일 AI 패널 오픈 상태
  const [mobileAiOpen, setMobileAiOpen] = useState(false);

  // 채팅 UI — 개발노트 ChatMessage 정합(intent / edit_proposals / plan)
  type ChatMsg = {
    id: number;
    role: 'user' | 'ai';
    text: string;
    intent?: AgentIntent;                                    // 라우팅된 의도 (edit/clarify/answer/plan/terminate)
    refs?: { sid: SectionId; idx: number }[];                // 대상 단락
    proposals?: EditProposal[];                              // 블록 수정 제안 (action·diff·status)
    intentOptions?: string[];                                // clarify 선택지
    sourceMsg?: string;                                      // 재생성/플랜용 원본 지시
    plan?: { steps: PlanStepDef[]; current: number; status: 'running' | 'stopped' | 'done' };
  };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  useEffect(() => {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [chatInput]);

  // 도면 데이터 (drawing_descriptions 인라인 카드용)
  const drawings = context?.drawings ?? [];
  // SpecView의 DRAWING_LABEL_MAP과 동일하게 유지 (같은 도면이 화면 이동 시 배지가 바뀌지 않도록)
  const DRAWING_LABEL_MAP: Record<string, string> = {
    proposed_implementation: '제안기술',
    previous_implementation: '종래기술',
    background:              '배경',
    effect:                  '효과',
  };
  const DRAWING_LABEL_STYLES: Record<string, string> = {
    '제안기술': 'bg-blue-100 text-brand-400',
    '종래기술': 'bg-gray-100 text-gray-600',
    '배경':     'bg-zinc-100 text-zinc-600',
    '효과':     'bg-violet-100 text-violet-700',
  };

  const compNames = (context?.elements ?? [])
    .map(el => el.value_ko)
    .filter(Boolean);

  // 구성요소 이름 변경 모달
  const [renamingComp, setRenamingComp] = useState<{ name: string; draft: string } | null>(null);

  const renameComp = (oldName: string, newName: string) => {
    const next = newName.trim();
    if (!next || next === oldName) return;
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(prev => {
      const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      const result = {} as Record<SectionId, string[]>;
      for (const sid of Object.keys(prev) as SectionId[]) {
        result[sid] = prev[sid].map(text => text.replace(re, next));
      }
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() =>
          saveSpecState(task.id, { editorBlocks: result as any }), 500
        );
      }
      return result;
    });
  };

  // 도구 모달
  const [tableModal, setTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [formulaModal, setFormulaModal] = useState(false);
  const [formulaVal, setFormulaVal] = useState('');
  const [formulaMode, setFormulaMode] = useState<'inline' | 'block'>('inline');

  const [editorPreviewOpen, setEditorPreviewOpen] = useState(false);

  // 찾기/바꾸기
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // undo/redo
  const [undoStack, setUndoStack] = useState<Record<SectionId, string[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<SectionId, string[]>[]>([]);

  const centerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 블록 업데이트 (500ms debounce 자동저장) ──────────────────────────
  const updateBlock = (sid: SectionId, idx: number, text: string) => {
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const next = { ...p, [sid]: p[sid].map((b, i) => i === idx ? text : b) };
      // 500ms debounce 자동저장
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() =>
          saveSpecState(task.id, { editorBlocks: next as any }), 500
        );
      }
      return next;
    });
  };

  // ── 찾기/바꾸기 + 문서 통계 ────────────────────────────────────────────
  const allText = Object.values(blocks).flat().join('\n');
  const matchCount = findText ? allText.split(findText).length - 1 : 0;
  const totalChars = Object.values(blocks).flat().join('').replace(/\s/g, '').length;
  const totalBlocks = Object.values(blocks).flat().filter(b => b.trim()).length;
  const replaceAll = () => {
    if (!findText) return;
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const updated = {} as Record<SectionId, string[]>;
      (Object.keys(p) as SectionId[]).forEach(sid => {
        updated[sid] = p[sid].map(b => b.split(findText).join(replaceText));
      });
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: updated as any }), 500);
      }
      return updated;
    });
  };

  // ── 단락 이동 (위/아래) ────────────────────────────────────────────────
  const moveBlock = (sid: SectionId, idx: number, dir: -1 | 1) => {
    const arr = blocks[sid];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const next = [...p[sid]];
      [next[idx], next[j]] = [next[j], next[idx]];
      const updated = { ...p, [sid]: next };
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: updated as any }), 500);
      }
      return updated;
    });
    if (sel?.sid === sid && sel?.idx === idx) setSel({ sid, idx: j });
  };

  // ── 제안 상태 변경 (Accept/Decline/Pending) ───────────────────────────
  const setProposalStatus = (msgId: number, pi: number, status: EditProposal['status']) => {
    setChatMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, proposals: m.proposals?.map((p, i) => i === pi ? { ...p, status } : p) } : m,
    ));
  };

  // ── 단일 제안 Accept → 블록 반영 (action별: 치환/재작성/삽입/삭제) ──────
  const acceptProposal = (msgId: number, pi: number) => {
    const m = chatMessages.find(x => x.id === msgId);
    const p = m?.proposals?.[pi];
    if (!p) return;
    setUndoStack(s => [...s.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(prev => {
      const sid = p.sid as SectionId;
      const arr = [...(prev[sid] || [])];
      if (p.action === 'DELETE') arr.splice(p.idx, 1);
      else if (p.action === 'INSERT') arr.splice(p.idx + 1, 0, p.target);
      else arr[p.idx] = p.target;   // REPLACE / REWRITE
      const next = { ...prev, [sid]: arr } as Record<SectionId, string[]>;
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: next as any }), 500);
      }
      return next;
    });
    setProposalStatus(msgId, pi, 'accepted');
  };
  const declineProposal = (msgId: number, pi: number) => setProposalStatus(msgId, pi, 'declined');

  // ── AI 메시지 push 헬퍼 ────────────────────────────────────────────────
  const pushAi = (partial: Omit<ChatMsg, 'id' | 'role'>) => {
    setChatMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'ai', ...partial }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };
  // ── 선택 단락별 수정 제안 생성(edit) ───────────────────────────────────
  const pushEditProposals = (instruction: string, refs: { sid: SectionId; idx: number }[]) => {
    const proposals = refs.map(r => buildProposal(
      r.sid, r.idx,
      EDITOR_SECTIONS.find(s => s.id === r.sid)?.label ?? r.sid,
      blocks[r.sid]?.[r.idx] || '', instruction,
    ));
    pushAi({ text: `요청하신 내용을 반영하여 ${proposals.length}건의 수정을 제안합니다.`, intent: 'edit', proposals, refs, sourceMsg: instruction });
  };

  const undo = () => {
    if (!undoStack.length) return;
    setRedoStack(p => [blocks, ...p]);
    setBlocks(undoStack[undoStack.length - 1]);
    setUndoStack(p => p.slice(0, -1));
  };
  const redo = () => {
    if (!redoStack.length) return;
    setUndoStack(p => [...p, blocks]);
    setBlocks(redoStack[0]);
    setRedoStack(p => p.slice(1));
  };

  // ── undo/redo 키보드 단축키 (입력 필드 포커스 시엔 네이티브 undo 우선) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ── 섹션 앵커 이동 ─────────────────────────────────────────────────────
  const goToSection = (id: SectionId) => {
    const el = centerRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSec(id);
  };

  // ── 블록 선택 (편집 포커스) ────────────────────────────────────────────
  const selectBlock = (sid: SectionId, idx: number) => {
    setSel({ sid, idx });
    setActiveSec(sid);
    // 클릭한 단락을 AI 대상(selSet)으로도 단일 설정 → 직접 편집 + AI 요청이 같은 선택 공유
    setSelSet(new Set([`${sid}-${idx}`]));
  };

  // ── AI 컨텍스트 다중 선택 toggle ───────────────────────────────────────
  const toggleSelSet = (sid: SectionId, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${sid}-${idx}`;
    setSelSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── 전체 문서 대상 mock Q&A ────────────────────────────────────────────
  const generateWholeDocReply = (question: string): string => {
    const docTitle = blocks['title']?.[0]?.trim() || '발명';
    const q = question;
    if (/청구항|claim|권리범위|독립항|종속항/.test(q)) {
      return `"${docTitle}" 명세서의 청구항 구조를 검토했습니다.\n\n독립항은 핵심 구성요소를 포함하고 있으나, 권리범위 확보를 위해 기능적 표현보다 구조적·수단적 표현을 강화하는 것이 좋습니다. 종속항은 독립항의 특징을 구체화하여 심사 과정에서의 방어 범위를 넓히세요.`;
    }
    if (/배경|종래|선행|기존 기술/.test(q)) {
      return `발명의 배경기술 섹션을 분석했습니다.\n\n종래 기술의 한계점을 보다 구체적으로 기술하면 본 발명의 필요성이 강조됩니다. 관련 선행특허 문헌을 인용하면 심사 과정에서 유리하게 작용합니다.`;
    }
    if (/효과|개선|향상|장점/.test(q)) {
      return `"${docTitle}"의 발명 효과 섹션을 검토했습니다.\n\n정량적 수치(예: 처리 속도 30% 향상, 오차율 0.5% 이내)를 포함하면 실질적 개선을 입증하는 데 효과적입니다. 기존 기술과의 대비 표현을 추가하는 것을 권장합니다.`;
    }
    if (/도면|구성도|흐름도|블록도/.test(q)) {
      return `도면 구성을 검토했습니다.\n\n도면 부호는 일관성 있게 사용하고, 구성요소 간 연결 관계가 명확히 드러나도록 하세요. 종래 기술 도면과 제안 기술 도면을 대비하면 발명의 효과를 시각적으로 강조할 수 있습니다.`;
    }
    if (/수정|보완|개선|문제|오류|오타/.test(q)) {
      return `"${docTitle}" 전체 명세서를 검토했습니다.\n\n전반적인 구성은 양호하나, 배경기술의 문제점과 해결수단 간의 연계성을 강화하는 것을 권장합니다. 청구항의 구성요소와 발명 실시 내용 간 대응 관계를 명확히 하면 심사 거절이유를 줄일 수 있습니다.`;
    }
    if (/요약|전체|구조|완성도/.test(q)) {
      return `"${docTitle}" 명세서 전체를 검토했습니다.\n\n기본 구조는 갖추어져 있습니다. 미작성 섹션(배경기술, 해결과제, 효과 등)을 보완하고, 각 섹션의 내용이 서로 유기적으로 연결되도록 검토해 보세요. 특정 섹션을 수정하려면 해당 단락을 선택한 후 명령을 입력하시면 됩니다.`;
    }
    return `"${docTitle}" 명세서를 기준으로 답변드립니다.\n\n${question.slice(0, 40)}에 관해서는, 발명의 핵심 기술 특징이 각 섹션에 일관되게 반영되어 있는지 확인하는 것이 중요합니다. 구체적인 단락 수정이 필요하면 해당 단락을 선택 후 명령을 입력해 주세요.`;
  };

  // ── 채팅 전송 — 의도 라우팅 후 의도별 처리 ─────────────────────────────
  const sendChat = (override?: string) => {
    const msg = (override ?? chatInput).trim();
    if (!msg) return;
    if (!override) setChatInput('');

    const refs: { sid: SectionId; idx: number }[] = [];
    selSet.forEach(key => {
      const dashIdx = key.indexOf('-');
      const sid = key.slice(0, dashIdx) as SectionId;
      const idx = parseInt(key.slice(dashIdx + 1));
      if (blocks[sid]?.[idx] !== undefined) refs.push({ sid, idx });
    });

    setChatMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'user', text: msg }]);
    setAiThinking(true);

    setTimeout(() => {
      setAiThinking(false);
      const route = routeIntent(msg, { hasSelection: refs.length > 0 });
      // 청구항 언급 시 — 청구항은 전용 에디터라 selSet 선택 없이도 '독립항→종속항' 파이프라인으로 처리(전체 세트 단위)
      const mentionsClaims = /청구항|독립항|종속항|claim/i.test(msg) || refs.some(r => r.sid === 'claims');
      if (route.intent === 'terminate' || route.intent === 'answer') {
        pushAi({ text: route.answer ?? generateWholeDocReply(msg), intent: route.intent });
      } else if (mentionsClaims) {
        // 청구항 수정 — 개발노트: 독립항 → 종속항 순으로 고정 파이프라인 (전체 세트 단위)
        const claimRefs = (blocks['claims'] && blocks['claims'].length) ? [{ sid: 'claims' as SectionId, idx: 0 }] : [];
        pushAi({
          text: '청구항 수정은 독립항 → 종속항 순으로 검토합니다.', intent: 'plan',
          refs: claimRefs, sourceMsg: msg,
          plan: {
            steps: [
              { title: '독립항 검토·수정', instruction: `${msg} (독립항 기준)` },
              { title: '종속항 검토·수정', instruction: `${msg} (종속항 반영)` },
            ], current: 0, status: 'running',
          },
        });
      } else if (route.intent === 'clarify') {
        pushAi({ text: '어떤 방향으로 진행할까요?', intent: 'clarify', intentOptions: route.clarifyOptions, refs, sourceMsg: msg });
      } else if (route.intent === 'plan') {
        pushAi({ text: `요청을 ${route.planSteps!.length}단계 플랜으로 나눴습니다. 순서대로 진행하세요.`, intent: 'plan', refs, sourceMsg: msg, plan: { steps: route.planSteps!, current: 0, status: 'running' } });
      } else {
        pushEditProposals(msg, refs);
      }
    }, 500);
  };

  // ── clarify 선택지 선택 → 해당 방향으로 진행 ───────────────────────────
  const selectIntent = (msgId: number, opt: string) => {
    const m = chatMessages.find(x => x.id === msgId);
    setChatMessages(prev => prev.map(x => x.id === msgId ? { ...x, intentOptions: undefined, text: `[${opt}] 선택됨` } : x));
    setTimeout(() => {
      if (m?.refs?.length) pushEditProposals(m.sourceMsg ? `${m.sourceMsg} · ${opt}` : opt, m.refs);
      else pushAi({ text: generateWholeDocReply(m?.sourceMsg || opt), intent: 'answer' });
    }, 300);
  };

  // ── 플랜: 다음 스텝 실행 / 중단 ────────────────────────────────────────
  const advancePlan = (msgId: number) => {
    const m = chatMessages.find(x => x.id === msgId);
    const plan = m?.plan;
    if (!plan || plan.status !== 'running') return;
    const step = plan.steps[plan.current];
    const refs = m?.refs ?? [];
    if (refs.length) pushEditProposals(step.instruction, refs);
    else pushAi({ text: `(플랜 ${plan.current + 1}/${plan.steps.length}) "${step.title}" — 본문에서 대상 단락을 선택하면 수정 제안을 생성합니다.`, intent: 'answer' });
    const nextIdx = plan.current + 1;
    setChatMessages(prev => prev.map(x => x.id === msgId ? { ...x, plan: { ...plan, current: nextIdx, status: nextIdx >= plan.steps.length ? 'done' : 'running' } } : x));
  };
  const stopPlan = (msgId: number) => {
    setChatMessages(prev => prev.map(x => x.id === msgId && x.plan ? { ...x, plan: { ...x.plan, status: 'stopped' } } : x));
  };

  // ── 다시 생성 ──────────────────────────────────────────────────────────
  const regenerate = (msg: ChatMsg) => {
    if (!msg.refs?.length || !msg.sourceMsg) return;
    setChatMessages(prev => prev.filter(m => m.id !== msg.id));
    setTimeout(() => pushEditProposals(msg.sourceMsg!, msg.refs!), 300);
  };

  // 플랜 진행 중이면 새 입력 차단 (개발노트: 진행 중 입력 막기)
  const planRunning = chatMessages.some(m => m.plan?.status === 'running');

  // ── 표 삽입 ─────────────────────────────────────────────────────────────
  const insertTable = () => {
    const cols = 3;
    const header = Array(cols).fill('항목').map((_, i) => `항목 ${i + 1}`).join(' | ');
    const sep = Array(cols).fill('---').join(' | ');
    const row = Array(cols).fill('내용').join(' | ');
    const tbl = `${header}\n${sep}\n${Array(tableRows).fill(row).join('\n')}`;
    const sid = sel?.sid ?? activeSec;
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const arr = [...p[sid]];
      const at = sel?.sid === sid ? sel.idx + 1 : arr.length;
      arr.splice(at, 0, tbl);
      const updated = { ...p, [sid]: arr };
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: updated as any }), 500);
      }
      return updated;
    });
    setTableModal(false);
  };

  // ── 수식 삽입 ($...$ 또는 $$...$$) ────────────────────────────────────
  const insertFormula = () => {
    if (!sel || !formulaVal.trim()) return;
    const { error } = renderTeX(formulaVal.trim(), formulaMode === 'block');
    if (error) return;
    const cur = blocks[sel.sid][sel.idx] || '';
    const marker = formulaMode === 'inline'
      ? `$${formulaVal.trim()}$`
      : `\n$$\n${formulaVal.trim()}\n$$\n`;
    updateBlock(sel.sid, sel.idx, cur + marker);
    setFormulaModal(false);
    setFormulaVal('');
    setFormulaMode('inline');
  };

  // ── 도면 참조 삽입: 선택한 본문 블록의 커서 위치에 "(도 N 참조)" 삽입 ──────────
  const insertDrawingRef = (symbol: string | number) => {
    if (!sel) return;
    const token = `(도 ${symbol} 참조)`;
    const cur = blocks[sel.sid]?.[sel.idx] ?? '';
    const c = caretRef.current;
    let next: string;
    let caret: number;
    if (c && c.sid === sel.sid && c.idx === sel.idx && c.start <= cur.length) {
      next = cur.slice(0, c.start) + token + cur.slice(c.end);
      caret = c.start + token.length;
    } else {
      next = cur + (cur && !/\s$/.test(cur) ? ' ' : '') + token;
      caret = next.length;
    }
    updateBlock(sel.sid, sel.idx, next);
    setDrawingRefMenuOpen(false);
    requestAnimationFrame(() => {
      const ta = blockTaRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(caret, caret); caretRef.current = { sid: sel.sid, idx: sel.idx, start: caret, end: caret }; }
    });
  };


  // ── 렌더 ────────────────────────────────────────────────────────────────
  // 에디터 미리보기 섹션 (#80 fix)
  const editorPreviewSections: PreviewSection[] = EDITOR_SECTIONS.map(s => ({
    label: s.label,
    content: (blocks[s.id] ?? []).join('\n\n'),
  })).filter(s => s.content.trim());

  // 내보내기용 도면 — 명세서에 포함(useForSpec)된 도면을 data URI로
  const exportDrawings = drawings
    .filter(d => d.included !== false && d.useForSpec && d.image?.file?.data)
    .map((d, i) => ({
      symbol: String(d.detail.symbol).replace(/\D/g, '') || String(i + 1),
      name: d.detail.name,
      dataUrl: `data:${d.image.file.media_type};base64,${d.image.file.data}`,
    }));

  return (
    <>
    {editorPreviewOpen && (
      <PreviewModal
        taskName={task?.name}
        sections={editorPreviewSections}
        onClose={() => setEditorPreviewOpen(false)}
      />
    )}

    {/* 구성요소 이름 일괄 변경 모달 */}
    {renamingComp && (
      <div
        className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
        onClick={() => setRenamingComp(null)}
      >
        <div
          className="bg-white rounded-2xl shadow-card-deep w-80 p-5"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-base2 font-bold text-zinc-800 mb-1">구성요소 이름 변경</p>
          <p className="text-xs2 text-zinc-500 mb-3 leading-relaxed">
            명세서 전체에서{' '}
            <span className="font-semibold text-zinc-700">"{renamingComp.name}"</span>이
            일괄 변경됩니다.
          </p>
          <Input
            autoFocus
            className="mb-3"
            value={renamingComp.draft}
            onChange={e => setRenamingComp(p => p ? { ...p, draft: e.target.value } : null)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                renameComp(renamingComp.name, renamingComp.draft);
                setRenamingComp(null);
              }
              if (e.key === 'Escape') setRenamingComp(null);
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outlined" color="primary" size="sm" onClick={() => setRenamingComp(null)}>취소</Button>
            <Button
              variant="filled" color="primary" size="sm"
              disabled={!renamingComp.draft.trim() || renamingComp.draft.trim() === renamingComp.name}
              onClick={() => { renameComp(renamingComp.name, renamingComp.draft); setRenamingComp(null); }}
            >
              전체 변경
            </Button>
          </div>
        </div>
      </div>
    )}

    <div className="flex-1 flex overflow-hidden min-h-0 bg-white">

      {/* 좌측 에디터 컬럼 */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* 서브헤더 Row 1: 편집 툴바 */}
      <div className="flex items-center border-b border-zinc-200 bg-white shrink-0 h-10">
        <button onClick={onBack}
          className="flex items-center gap-1 text-xs2 text-blue-600 hover:text-blue-800 px-3 h-full hover:bg-zinc-50 transition-colors shrink-0">
          ← 분석 후보 보기
        </button>
        <div className="w-px h-5 bg-zinc-200 mx-1 self-center shrink-0" />
        <div className="flex items-center gap-0.5">
          <button onClick={undo} disabled={!undoStack.length} title="실행 취소 (Ctrl+Z)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-500 text-xs2">
            <UndoIcon /><span>취소</span>
          </button>
          <button onClick={redo} disabled={!redoStack.length} title="다시 실행 (Ctrl+Y)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-500 text-xs2">
            <RedoIcon /><span>재실행</span>
          </button>
          <div className="w-px h-5 bg-zinc-200 mx-1" />
          <button onClick={() => setTableModal(true)} disabled={!sel} title="표 삽입"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-500 text-xs2">
            <TableIcon /><span>표</span>
          </button>
          <button onClick={() => setFormulaModal(true)} disabled={!sel} title="수식 입력"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-500 text-xs2">
            <span className="font-serif text-base2 leading-none">∑</span><span>수식</span>
          </button>
          {/* 도면 참조 삽입 — 선택한 본문 블록의 커서 위치에 '(도 N 참조)' 삽입 */}
          <div className="relative">
            <button onClick={() => setDrawingRefMenuOpen(o => !o)} disabled={!sel || drawings.length === 0}
              title={drawings.length === 0 ? '도면이 없습니다' : '본문에 도면 참조 (도 N 참조) 삽입'}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-500 text-xs2">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2.5 11l3.5-3 2.5 2 3-3.5 2 2"/></svg>
              <span>도면 참조</span><span className="text-[9px] leading-none">▾</span>
            </button>
            {drawingRefMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDrawingRefMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-60 max-h-64 overflow-y-auto scroll-thin rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
                  {drawings.map((d, i) => {
                    const figNo = String(d.detail.symbol).replace(/\D/g, '') || String(i + 1);
                    return (
                      <button key={i} onClick={() => insertDrawingRef(figNo)}
                        className="w-full text-left px-3 py-1.5 text-xs2 hover:bg-blue-50 flex items-center gap-2 transition-colors">
                        <span className="font-bold text-zinc-700 shrink-0">도 {figNo}</span>
                        <span className="text-zinc-500 truncate">{d.detail.name || '제목 없음'}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="w-px h-5 bg-zinc-200 mx-1" />
          <button onClick={() => setFindOpen(o => !o)} title="찾기/바꾸기"
            className={clsx('flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs2', findOpen ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-100 text-zinc-500')}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
            <span>찾기</span>
          </button>
          <button onClick={() => setEditorPreviewOpen(true)} title="미리보기"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 transition-colors text-zinc-500 text-xs2">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
            <span>미리보기</span>
          </button>
          <button onClick={() => exportDocx(task?.name ?? '명세서', editorPreviewSections, exportDrawings)} title="DOCX 내보내기 (도면 포함)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 transition-colors text-zinc-600 text-xs2 font-medium">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/><path d="M5 9h6M5 11h4"/></svg>
            <span>DOCX</span>
          </button>
          <button onClick={() => exportPdf(task?.name ?? '명세서', editorPreviewSections, exportDrawings)} title="PDF 내보내기 (도면 포함, 인쇄)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 transition-colors text-zinc-600 text-xs2 font-medium">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/><path d="M5.5 9.5h5M5.5 11.5h3"/></svg>
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 찾기/바꾸기 바 (문서 통계 포함) */}
      {findOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50 shrink-0">
          <input
            value={findText}
            onChange={e => setFindText(e.target.value)}
            placeholder="찾기"
            className="w-40 text-xs2 px-2 py-1 border border-zinc-200 rounded bg-white outline-none focus:border-blue-400"
          />
          <span className="text-xs2 text-zinc-400 w-10 shrink-0">{findText ? `${matchCount}건` : ''}</span>
          <input
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            placeholder="바꿀 내용"
            className="w-40 text-xs2 px-2 py-1 border border-zinc-200 rounded bg-white outline-none focus:border-blue-400"
          />
          <button
            onClick={replaceAll}
            disabled={!findText || matchCount === 0}
            className="text-xs2 font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >전체 바꾸기</button>
          <span className="ml-auto text-xs2 text-zinc-400">{totalBlocks}단락 · {totalChars.toLocaleString()}자</span>
          <button onClick={() => setFindOpen(false)} className="text-zinc-400 hover:text-zinc-600 text-xs2 px-1" title="닫기">✕</button>
        </div>
      )}

      {/* 서브헤더 Row 2: 섹션 탭 */}
      <div className="flex border-b border-zinc-200 bg-white shrink-0 overflow-x-auto scroll-thin [mask-image:linear-gradient(to_right,transparent_0,black_8px,black_calc(100%-32px),transparent_100%)]">
        {EDITOR_SECTIONS.map(s => (
          <button key={s.id} onClick={() => goToSection(s.id)}
            className={clsx(
              'px-3 py-2 text-xs2 whitespace-nowrap border-b-2 transition-colors shrink-0',
              activeSec === s.id
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            )}>
            {s.short}
          </button>
        ))}
      </div>



      {/* 본문 — 전체 명세서 스크롤 */}
      <div
          ref={centerRef}
          className="flex-1 overflow-y-auto scroll-thin bg-zinc-50"
          onScroll={() => {
            if (!centerRef.current) return;
            const st = centerRef.current.scrollTop;
            for (const sec of [...EDITOR_SECTIONS].reverse()) {
              const el = centerRef.current.querySelector<HTMLElement>(`[data-section="${sec.id}"]`);
              if (el && el.offsetTop <= st + 100) { setActiveSec(sec.id); break; }
            }
          }}
        >
          <div className="max-w-3xl mx-auto py-6 px-8">
            {/* 섹션별 단락 */}
            {EDITOR_SECTIONS.map(sec => (
              <div key={sec.id} data-section={sec.id} className="mb-10">
                <h2 className="text-base2 font-bold text-zinc-800 mb-3 pb-1.5 border-b border-zinc-200">
                  {sec.label}
                </h2>

                {/* 도면의 간단한 설명 섹션 — 도면 인라인 카드 */}
                {sec.id === 'drawing_descriptions' && drawings.length > 0 && (
                  <div className="mb-6">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {drawings.map((d, idx) => {
                        const labelKo = DRAWING_LABEL_MAP[d.detail.label] ?? 'AI생성';
                        return (
                          <div key={idx} className="rounded-xl border overflow-hidden bg-white shadow-sm border-zinc-200">
                            {/* 이미지 영역 */}
                            <div className="relative aspect-[4/3] bg-zinc-100 border-b border-zinc-200 flex flex-col items-center justify-center gap-1 overflow-hidden">
                              {d.image.file.data ? (
                                <img src={`data:${d.image.file.media_type};base64,${d.image.file.data}`} className="w-full h-full object-contain" alt={d.detail.name} />
                              ) : (
                                <>
                                  <svg viewBox="0 0 120 90" width="80" height="60" className="text-zinc-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="4" y="4" width="112" height="82" rx="4" strokeDasharray="6 3"/>
                                    <rect x="16" y="14" width="36" height="28" rx="3" fill="currentColor" fillOpacity=".08"/>
                                    <rect x="68" y="14" width="36" height="28" rx="3" fill="currentColor" fillOpacity=".08"/>
                                    <rect x="42" y="52" width="36" height="24" rx="3" fill="currentColor" fillOpacity=".12"/>
                                    <line x1="34" y1="28" x2="68" y2="28" strokeDasharray="3 2"/>
                                    <line x1="60" y1="42" x2="60" y2="52" strokeDasharray="3 2"/>
                                    <polyline points="100,28 110,28 110,64 78,64" strokeDasharray="3 2"/>
                                  </svg>
                                  <span className="text-[11px] font-semibold text-zinc-400">{d.detail.symbol}</span>
                                </>
                              )}
                            </div>
                            {/* 캡션 */}
                            <div className="px-3 pt-2 pb-1.5">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs2 font-bold text-zinc-700">{d.detail.symbol}</span>
                                <span className={clsx('text-[10px] px-1.5 py-px rounded-full font-medium', DRAWING_LABEL_STYLES[labelKo] ?? 'bg-zinc-100 text-zinc-500')}>{labelKo}</span>
                              </div>
                              <p className="text-xs2 text-zinc-600 leading-snug">{d.detail.name}</p>
                            </div>
                            {/* 도면 수정모드(새 탭) — 참조 삽입은 본문 툴바의 '도면 참조'로 이동 */}
                            <div className="border-t border-zinc-100 px-3 py-1.5 flex items-center justify-end">
                              <button
                                onClick={() => openEditorTab({ drawingId: String(idx), drawings: drawings.map(toWorkflowDrawingItem), components: [], references: [], drawingName: d.detail.name, timestamp: Date.now() })}
                                title="도면 수정모드를 새 탭에서 엽니다 (범위 조정·CAD 변환)"
                                className="inline-flex items-center gap-0.5 text-xs2 font-semibold text-zinc-500 hover:text-zinc-800 transition-colors shrink-0"
                              >수정모드 <span className="text-[10px]">↗</span></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 청구범위 — 구조 인식 편집기 */}
                {sec.id === 'claims' && (
                  <ClaimsEditor
                    blocks={blocks['claims']}
                    onChange={(next) => {
                      setUndoStack(p => [...p.slice(-20), blocks]);
                      setRedoStack([]);
                      setBlocks(p => {
                        const updated = { ...p, claims: next };
                        if (task?.id) {
                          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                          saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: updated as any }), 500);
                        }
                        return updated;
                      });
                    }}
                  />
                )}

                {sec.id !== 'claims' && (
                <div className="space-y-2">
                  {blocks[sec.id].map((blockText, blockIdx) => {
                    const isEditing = sel?.sid === sec.id && sel?.idx === blockIdx;
                    const isChecked = selSet.has(`${sec.id}-${blockIdx}`);
                    return (
                      <div
                        key={blockIdx}
                        onClick={() => { if (!isEditing) selectBlock(sec.id, blockIdx); }}
                        className={clsx(
                          'group relative pl-7 pr-4 py-2.5 transition-all rounded-lg border',
                          isEditing
                            ? 'border-blue-400 bg-white shadow-sm cursor-text'
                            : isChecked
                              ? 'border-blue-500 bg-blue-50 shadow-sm cursor-pointer'
                              : blockText.trim()
                                ? 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm cursor-pointer'
                                : 'border-dashed border-zinc-200 bg-white hover:border-zinc-300 cursor-pointer'
                        )}
                      >
                        {/* 체크박스 — 상시 표시 (다중 선택용), 선택 시 강조 */}
                        <div
                          onClick={e => toggleSelSet(sec.id, blockIdx, e)}
                          title="여러 단락을 한번에 AI 수정하려면 체크하세요"
                          className={clsx(
                            'absolute left-2 top-3 w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer shrink-0',
                            isChecked
                              ? 'bg-brand-400 border-blue-600 text-white'
                              : 'border-gray-300 bg-white opacity-60 group-hover:opacity-100'
                          )}
                        >
                          {isChecked && <Icon name="check" size={8} />}
                        </div>
                        {/* 단락 이동 (위/아래) */}
                        {blocks[sec.id].length > 1 && (
                          <div className="absolute top-1.5 right-7 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={e => { e.stopPropagation(); moveBlock(sec.id, blockIdx, -1); }}
                              disabled={blockIdx === 0}
                              className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 transition-all"
                              title="위로 이동"
                            ><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 7l3-4 3 4"/></svg></button>
                            <button
                              onClick={e => { e.stopPropagation(); moveBlock(sec.id, blockIdx, 1); }}
                              disabled={blockIdx === blocks[sec.id].length - 1}
                              className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 transition-all"
                              title="아래로 이동"
                            ><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9"><path d="M2 3l3 4 3-4"/></svg></button>
                          </div>
                        )}
                        {/* 단락 삭제 버튼 */}
                        {blocks[sec.id].length > 1 && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setUndoStack(p => [...p.slice(-20), blocks]);
                              setBlocks(p => {
                                const next = p[sec.id].filter((_, i) => i !== blockIdx);
                                return { ...p, [sec.id]: next };
                              });
                                                        if (sel?.sid === sec.id && sel?.idx === blockIdx) { setSel(null); }
                            setSelSet(prev => { const n = new Set(prev); n.delete(`${sec.id}-${blockIdx}`); return n; });
                            }}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="단락 삭제"
                          >
                            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="10" height="10">
                              <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                            </svg>
                          </button>
                        )}
                        {isEditing ? (
                          <textarea
                            className="w-full text-base2 text-zinc-800 bg-transparent outline-none border-0 resize-none leading-relaxed overflow-hidden py-1.5 px-3"
                            value={blockText}
                            autoFocus
                            rows={Math.max(2, Math.ceil(blockText.length / 55))}
                            onChange={e => {
                              updateBlock(sec.id, blockIdx, e.target.value);
                              caretRef.current = { sid: sec.id, idx: blockIdx, start: e.target.selectionStart, end: e.target.selectionEnd };
                              // auto-height
                              const t = e.target;
                              t.style.height = 'auto';
                              t.style.height = t.scrollHeight + 'px';
                            }}
                            onSelect={e => { caretRef.current = { sid: sec.id, idx: blockIdx, start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
                            ref={el => { blockTaRef.current = el; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : isMarkdownTable(blockText) ? (
                          <div className="py-1.5 px-3 overflow-x-auto"><MarkdownTable text={blockText} /></div>
                        ) : blockText.includes('$') ? (
                          <p className="text-base2 leading-relaxed text-zinc-800 py-1.5 px-3"
                            dangerouslySetInnerHTML={{ __html: renderBlockWithTeX(blockText) }} />
                        ) : (
                          <p className={clsx(
                            'text-base2 leading-relaxed whitespace-pre-wrap py-1.5 px-3',
                            blockText.trim() ? 'text-zinc-800' : 'text-zinc-400 italic'
                          )}>
                            {blockText.trim()
                              ? renderWithCompHighlights(blockText, compNames, compNames.length ? (name) => setRenamingComp({ name, draft: name }) : undefined)
                              : '단락 내용을 입력하세요...'}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* 단락 추가 */}
                  <button
                    onClick={() => {
                      setUndoStack(p => [...p.slice(-20), blocks]);
                      const newIdx = blocks[sec.id].length;
                      setBlocks(p => ({ ...p, [sec.id]: [...p[sec.id], ''] }));
                      setTimeout(() => selectBlock(sec.id, newIdx), 50);
                    }}
                    className="w-full py-1.5 text-xs2 text-zinc-400 hover:text-zinc-600 border border-dashed border-zinc-200 rounded-lg hover:border-zinc-400 transition-colors"
                  >
                    + 단락 추가
                  </button>
                </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>{/* 좌측 에디터 컬럼 끝 */}

      {/* 우측 AI 어시스턴트 패널 */}
      {mobileAiOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileAiOpen(false)}
          />
        )}
        <aside data-spec="SPC-EDT-010" className={clsx(
          'bg-white flex-col overflow-hidden',
          'md:flex md:relative md:shrink-0 md:border-l md:border-zinc-200',
          'md:w-[360px] md:min-w-[320px]',
          'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50',
          'max-md:h-[72vh] max-md:rounded-t-2xl max-md:shadow-2xl',
          'max-md:border-t max-md:border-zinc-200',
          'max-md:transition-transform max-md:duration-300 max-md:ease-out',
          mobileAiOpen ? 'max-md:flex max-md:translate-y-0' : 'max-md:hidden',
          'md:flex',
        )}>
          {/* 모바일 핸들 */}
          <div className="md:hidden shrink-0 pt-2 pb-1 px-4 flex items-center justify-between relative">
            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 bg-zinc-300 rounded-full" />
            <button
              onClick={() => setMobileAiOpen(false)}
              className="ml-auto w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-600"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          {/* 헤더 (48px) */}
          <div className="hidden md:flex shrink-0 items-center gap-2 px-4 border-b border-zinc-200 bg-gray-50" style={{ height: 48 }}>
            <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)' }}>AI</div>
            <span className="text-base2 font-bold text-gray-800">AI 어시스턴트</span>
          </div>

          {/* 선택된 블록 컨텍스트 */}
          <div className={clsx('border-b border-zinc-100', selSet.size > 0 ? 'flex-1 flex flex-col min-h-0 bg-white' : 'shrink-0 bg-zinc-50')}>
            {selSet.size === 1 ? (() => {
              const key = [...selSet][0];
              const dashIdx = key.indexOf('-');
              const sid = key.slice(0, dashIdx) as SectionId;
              const idx = parseInt(key.slice(dashIdx + 1));
              const secLabel = EDITOR_SECTIONS.find(s => s.id === sid)?.short ?? sid;
              return (
                <>
                  <div className="flex items-center justify-between px-3 pt-2 pb-1.5 shrink-0 border-b border-zinc-100">
                    <span className="text-xs2 font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {secLabel} · {idx + 1} 편집 중
                    </span>
                    <button onClick={() => setSelSet(new Set())} className="text-xs2 text-zinc-400 hover:text-zinc-600 transition-colors">
                      선택 해제
                    </button>
                  </div>
                  <textarea
                    className="flex-1 w-full px-4 py-2.5 text-base2 text-zinc-800 bg-white outline-none resize-none leading-relaxed overflow-y-auto border-0"
                    value={blocks[sid]?.[idx] || ''}
                    onChange={e => updateBlock(sid, idx, e.target.value)}
                    placeholder="단락 내용을 입력하세요..."
                  />
                </>
              );
            })() : selSet.size > 1 ? (
              <>
                <div className="flex items-center justify-between px-3 pt-2 pb-1.5 shrink-0">
                  <span className="text-xs2 font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    편집 명령 대상 · {selSet.size}개
                  </span>
                  <button onClick={() => setSelSet(new Set())} className="text-xs2 text-zinc-400 hover:text-zinc-600 transition-colors">
                    선택 해제
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-2 space-y-1.5">
                  {Array.from(selSet).map(key => {
                    const dashIdx = key.indexOf('-');
                    const sid = key.slice(0, dashIdx) as SectionId;
                    const idx = parseInt(key.slice(dashIdx + 1));
                    const text = blocks[sid]?.[idx] || '';
                    const secLabel = EDITOR_SECTIONS.find(s => s.id === sid)?.short ?? sid;
                    return (
                      <div key={key} className="bg-white rounded border border-blue-100 px-2.5 py-1.5">
                        <span className="text-xs2 font-semibold text-blue-500 mr-1.5">{secLabel} · {idx + 1}</span>
                        <p className="text-xs2 text-zinc-700 leading-relaxed mt-0.5 whitespace-pre-wrap">
                          {text || <span className="text-zinc-400 italic">빈 단락</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs2 text-zinc-400 text-center py-2 px-3 leading-relaxed">
                <>중앙에서 단락을 선택하고<br /><span className="text-zinc-500 font-medium">수정 명령을 입력하세요</span><br /><span className="text-xs2 text-zinc-300">미선택 시 전체 문서 대상</span></>
              </p>
            )}
          </div>

          {/* 탭 본문 (스크롤 영역) */}
          <div className={clsx('overflow-y-auto scroll-thin', selSet.size > 0 ? 'shrink-0 max-h-[30vh]' : 'flex-1')}>

            {/* ── AI 채팅 메시지 ── */}
            <div className="px-3 py-2 space-y-3">
                {chatMessages.map((m) => (
                  <div key={m.id} className={clsx('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {m.role === 'ai' && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold text-white">AI</span>
                      </div>
                    )}
                    {m.role === 'user' ? (
                      <div className="rounded-xl px-3 py-2 text-xs2 leading-relaxed max-w-[85%] bg-blue-600 text-white">
                        {m.text}
                      </div>
                    ) : (
                      <div data-spec="SPC-EDT-030" className="rounded-xl text-xs2 leading-relaxed max-w-[88%] bg-zinc-100 text-zinc-800 overflow-hidden">
                        {/* 의도 배지 */}
                        {m.intent && (
                          <div className="px-3 pt-2">
                            <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold',
                              m.intent === 'edit' ? 'bg-blue-100 text-blue-700'
                              : m.intent === 'plan' ? 'bg-violet-100 text-violet-700'
                              : m.intent === 'clarify' ? 'bg-amber-100 text-amber-700'
                              : m.intent === 'terminate' ? 'bg-gray-200 text-gray-500'
                              : 'bg-emerald-100 text-emerald-700')}>
                              {INTENT_LABEL[m.intent]}
                            </span>
                          </div>
                        )}
                        <p className="px-3 pt-1.5 pb-1.5 whitespace-pre-wrap">{m.text}</p>

                        {/* clarify 방향 선택지 */}
                        {m.intentOptions && (
                          <div data-spec="SPC-EDT-033" className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
                            {m.intentOptions.map((opt, i) => (
                              <button key={i}
                                onClick={() => selectIntent(m.id, opt)}
                                className="px-2.5 py-1 text-xs2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors">
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* 플랜 진행 (PlanProgress: Step X of Y · Continue/Stop) */}
                        {m.plan && (
                          <div data-spec="SPC-EDT-040" className="mx-2.5 mb-2.5 rounded-lg bg-white border border-violet-200 p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs2 font-semibold text-violet-700">
                                플랜 · Step {Math.min(m.plan.current + (m.plan.status === 'done' ? 0 : 1), m.plan.steps.length)} of {m.plan.steps.length}
                              </span>
                              <span className="text-[10px] text-zinc-400">{m.plan.status === 'running' ? '진행 중' : m.plan.status === 'stopped' ? '중단됨' : '완료'}</span>
                            </div>
                            <ol className="space-y-0.5 mb-2">
                              {m.plan.steps.map((st, si) => (
                                <li key={si} className={clsx('flex items-start gap-1.5 text-xs2',
                                  si < m.plan!.current ? 'text-zinc-400 line-through'
                                  : si === m.plan!.current && m.plan!.status === 'running' ? 'text-zinc-800 font-semibold'
                                  : 'text-zinc-500')}>
                                  <span className="shrink-0">{si < m.plan!.current ? '✓' : `${si + 1}.`}</span>
                                  <span>{st.title}</span>
                                </li>
                              ))}
                            </ol>
                            {m.plan.status === 'running' && (
                              <div className="flex gap-1.5">
                                <button onClick={() => advancePlan(m.id)} className="flex-1 py-1.5 text-xs2 font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700">▶ {m.plan.current + 1}단계 실행 (Continue)</button>
                                <button onClick={() => stopPlan(m.id)} className="px-3 py-1.5 text-xs2 font-semibold text-zinc-500 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50">■ Stop</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 수정 제안 카드 (블록 단위 · action·diff·Accept/Decline) */}
                        {m.proposals && m.proposals.length > 0 && (
                          <>
                            <div className="mx-2.5 mb-2 space-y-1.5">
                              {m.proposals.map((p, pi) => (
                                <div key={pi} data-spec="SPC-EDT-031" className="rounded-lg bg-white border border-zinc-200 p-2.5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold',
                                      p.action === 'DELETE' ? 'bg-red-100 text-red-600'
                                      : p.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700'
                                      : p.action === 'REWRITE' ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700')}>
                                      {EDIT_ACTION_LABEL[p.action]}
                                    </span>
                                    <span className="text-[11px] text-zinc-500 truncate">{p.targetDesc}</span>
                                  </div>
                                  <p className="text-[11px] text-zinc-400 mb-1.5">{p.summary}</p>
                                  {p.action !== 'INSERT' && p.source && (
                                    <p className="text-xs2 leading-relaxed rounded px-2 py-1 mb-1 bg-red-50 text-red-700 line-through whitespace-pre-wrap">{p.source}</p>
                                  )}
                                  {p.action !== 'DELETE' && (
                                    <p className="text-xs2 leading-relaxed rounded px-2 py-1 bg-emerald-50 text-emerald-800 whitespace-pre-wrap">{p.target}</p>
                                  )}
                                  <div className="flex gap-1.5 mt-2" data-spec="SPC-EDT-032">
                                    {p.status === 'pending' ? (
                                      <>
                                        <button onClick={() => acceptProposal(m.id, pi)} className="flex-1 py-1 text-xs2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">✓ Accept</button>
                                        <button onClick={() => declineProposal(m.id, pi)} className="flex-1 py-1 text-xs2 font-semibold text-zinc-500 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50">✕ Decline</button>
                                      </>
                                    ) : (
                                      <span className={clsx('text-xs2 font-semibold', p.status === 'accepted' ? 'text-blue-600' : 'text-zinc-400')}>
                                        {p.status === 'accepted' ? '✓ 반영됨 (Accepted)' : '✕ 거절됨 (Declined)'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="px-2.5 pb-2.5">
                              <button onClick={() => regenerate(m)} className="text-xs2 font-semibold text-zinc-500 hover:text-blue-600">↺ 다시 생성</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {aiThinking && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-white">AI</span>
                    </div>
                    <div className="rounded-xl px-3 py-2 bg-zinc-100">
                      <span className="inline-flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
          </div>

          {/* 하단 채팅 입력창 */}
          <div data-spec="SPC-EDT-050" className="border-t border-zinc-200 px-3 py-2.5 shrink-0 bg-white">
            {planRunning && (
              <div className="mb-2 text-[11px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-2 py-1">
                플랜 진행 중입니다 — 스텝을 실행(Continue)하거나 중단(Stop)한 뒤 입력할 수 있습니다.
              </div>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                ref={chatTextareaRef}
                className="flex-1 px-3 py-2"
                placeholder={planRunning ? '플랜 진행 중 — 입력 잠금' : selSet.size > 0 ? `선택한 ${selSet.size}개 단락에 대해 명령하세요...` : "명령을 입력하세요... (Enter 전송)"}
                value={chatInput}
                rows={2}
                disabled={planRunning}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                style={{ maxHeight: '120px' }}
              />
              <button
                onClick={() => sendChat()}
                disabled={!chatInput.trim() || planRunning}
                className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                  <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z" fill="white" stroke="none"/>
                </svg>
              </button>
            </div>
          </div>
        </aside>


      {/* 모바일 AI 패널 FAB */}
      <button
        onClick={() => setMobileAiOpen(true)}
        className={clsx(
          'md:hidden fixed bottom-5 right-4 z-30',
          'w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95',
          'shadow-lg flex items-center justify-center transition-all',
          mobileAiOpen && 'hidden',
        )}
        title="AI 어시스턴트 열기"
        aria-label="AI 어시스턴트 열기"
      >
        <svg viewBox="0 0 20 20" fill="white" width="22" height="22">
          <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z"/>
        </svg>
      </button>

      {/* ── 표 삽입 모달 ── */}
      {tableModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTableModal(false)}>
          <div className="bg-white rounded-xl shadow-card-deep w-72 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base2 font-bold text-zinc-800 mb-4">표 삽입</h3>
            <div>
              <label className="text-xs2 font-semibold text-zinc-600 mb-1 block">행 수</label>
              <Input type="number" min={1} max={10} value={tableRows}
                onChange={e => setTableRows(Number(e.target.value))}
                className="py-1.5" />
            </div>
            <p className="text-xs2 text-zinc-400 mt-2">열 수: 3 (고정)</p>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outlined" color="primary" size="sm" onClick={() => setTableModal(false)}>취소</Button>
              <Button variant="filled" color="primary" size="sm" onClick={insertTable}>삽입</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수식 입력 모달 (KaTeX) ── */}
      {formulaModal && (() => {
        // formulaError를 상태 없이 인라인 파생 (보고서 #2 fix)
        const preview = formulaVal.trim() ? renderTeX(formulaVal.trim(), formulaMode === 'block') : null;
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setFormulaModal(false)}>
            <div className="bg-white rounded-xl shadow-card-deep w-[560px]" onClick={e => e.stopPropagation()}>

              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
                <h3 className="text-base2 font-bold text-zinc-800">수식 입력 (TeX / LaTeX)</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs2 text-zinc-400">모드:</span>
                  <button onClick={() => setFormulaMode('inline')}
                    className={clsx('px-2 py-1 rounded text-xs2',
                      formulaMode === 'inline' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-zinc-100 text-zinc-500')}>
                    인라인 ($...$)
                  </button>
                  <button onClick={() => setFormulaMode('block')}
                    className={clsx('px-2 py-1 rounded text-xs2',
                      formulaMode === 'block' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-zinc-100 text-zinc-500')}>
                    블록 ($$...$$)
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* TeX 입력란 */}
                <div>
                  <label className="block text-xs2 font-semibold text-zinc-600 mb-1">TeX 수식</label>
                  <textarea autoFocus
                    className="w-full input py-2 font-mono text-base2 resize-none"
                    rows={3}
                    placeholder="예: E = mc^{2}  또는  \frac{a}{b} = \sqrt{c^2 + d^2}"
                    value={formulaVal}
                    onChange={e => setFormulaVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) insertFormula(); }}
                  />
                </div>

                {/* 실시간 렌더링 미리보기 */}
                <div>
                  <label className="block text-xs2 font-semibold text-zinc-600 mb-1">미리보기</label>
                  <div className={clsx(
                    'min-h-[60px] rounded-lg border px-4 py-3 flex items-center',
                    formulaMode === 'block' ? 'justify-center' : 'justify-start',
                    preview?.error ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-zinc-50'
                  )}>
                    {preview ? (
                      preview.error ? (
                        <span className="text-xs2 text-red-500">⚠️ {preview.error}</span>
                      ) : (
                        <span
                          dangerouslySetInnerHTML={{ __html: preview.html }}
                          className={formulaMode === 'block' ? 'text-xl' : 'text-base'}
                        />
                      )
                    ) : (
                      <span className="text-zinc-400 text-xs2">수식을 입력하면 여기에 표시됩니다</span>
                    )}
                  </div>
                </div>

                {/* 자주 쓰는 TeX 템플릿 */}
                <div>
                  <label className="block text-xs2 font-semibold text-zinc-600 mb-1.5">자주 쓰는 TeX</label>
                  <div className="flex flex-wrap gap-1">
                    {FORMULA_TEMPLATES.map(t => (
                      <button key={t.label}
                        onClick={() => setFormulaVal(v => v ? v + ' ' + t.tex : t.tex)}
                        title={t.title}
                        className="px-2 py-1 border border-zinc-200 rounded text-xs2 font-mono hover:bg-zinc-100 hover:border-zinc-400 transition-colors">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 px-5 pb-5 justify-end">
                <Button variant="outlined" color="primary" size="sm" onClick={() => { setFormulaModal(false); setFormulaVal(''); }}>취소</Button>
                <Button variant="filled" color="primary" size="sm"
                  disabled={!formulaVal.trim() || !!preview?.error}
                  className="disabled:opacity-40"
                  onClick={insertFormula}>
                  삽입
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </>
  );
}
