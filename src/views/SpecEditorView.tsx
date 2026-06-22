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
import type { InventionContext, MidspecSection, InventionSpecification } from '../features/spec/types';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import { PreviewModal } from '../components/PreviewModal';
import type { PreviewSection } from '../components/PreviewModal';
import { analyzePromptClarity, generateIntentOptions, generateMockModification } from '../features/ai/clarityAnalyzer';
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
    <table className="border-collapse text-sm w-full">
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
  // AI 컨텍스트용 다중 선택 — key: `${sid}-${idx}`
  const [selSet, setSelSet] = useState<Set<string>>(new Set());

  // 활성 섹션 탭
  const [activeSec, setActiveSec] = useState<SectionId>('technical_field');

  // 모바일 AI 패널 오픈 상태
  const [mobileAiOpen, setMobileAiOpen] = useState(false);

  // 채팅 UI
  type ChatMsg = {
    id: number;
    role: 'user' | 'ai';
    text: string;
    proposed?: string;                                       // 표시용 (단일/병합 미리보기)
    refs?: { sid: SectionId; idx: number }[];                // AI 대상 단락 전체 (배치)
    proposals?: { sid: SectionId; idx: number; text: string }[]; // 단락별 수정안 (적용 대상)
    intentOptions?: string[];       // 패턴 B: 방향 선택지
    selectedIntent?: string;        // 패턴 B: 선택된 방향
    sourceMsg?: string;             // 재생성용 원본 메시지
  };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
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
  const DRAWING_LABEL_MAP: Record<string, string> = {
    proposed_implementation: '제안기술',
    previous_implementation: '종래기술',
    background:              '종래기술',
    effect:                  '제안기술',
  };
  const DRAWING_LABEL_STYLES: Record<string, string> = {
    '제안기술': 'bg-blue-100 text-blue-700',
    '종래기술': 'bg-zinc-100 text-zinc-600',
    'AI생성':   'bg-violet-100 text-violet-700',
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

  // ── 배치 수정안 일괄 적용 (단일 undo 단위) ────────────────────────────
  const applyProposals = (proposals: { sid: SectionId; idx: number; text: string }[]) => {
    if (!proposals.length) return;
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const next = { ...p } as Record<SectionId, string[]>;
      proposals.forEach(pr => {
        next[pr.sid] = next[pr.sid].map((b, i) => i === pr.idx ? pr.text : b);
      });
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() =>
          saveSpecState(task.id, { editorBlocks: next as any }), 500
        );
      }
      return next;
    });
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

  // ── AI 수정 실행 (방향 확정 후) ────────────────────────────────────────
  const runModification = (
    instruction: string,
    refs: { sid: SectionId; idx: number }[],
    sourceMsg: string,
    selectedIntent?: string,
  ) => {
    // 선택된 단락마다 개별 수정안 생성 (배치)
    const proposals = refs.map(r => ({
      sid: r.sid,
      idx: r.idx,
      text: generateMockModification(blocks[r.sid]?.[r.idx] || '', instruction),
    }));
    const secLabel = refs.length === 1
      ? (EDITOR_SECTIONS.find(s => s.id === refs[0].sid)?.label ?? '') + ' 단락의'
      : `${refs.length}개 단락의`;
    const label = selectedIntent ? `[${selectedIntent}] 방향으로 수정했습니다.` : `${secLabel} 수정안입니다.`;
    setChatMessages(prev => [...prev, {
      id: ++msgIdRef.current, role: 'ai', text: label,
      proposed: proposals.map(p => p.text).join('\n\n'),
      proposals, refs, sourceMsg, selectedIntent,
    }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // ── 채팅 전송 ──────────────────────────────────────────────────────────
  const sendChat = (override?: string) => {
    const msg = (override ?? chatInput).trim();
    if (!msg) return;
    if (!override) setChatInput('');

    // selSet 기반 컨텍스트 결정 — 선택 단락 전체를 refs로 캡처, 미선택 시 전체 문서 Q&A
    const refs: { sid: SectionId; idx: number }[] = [];
    selSet.forEach(key => {
      const dashIdx = key.indexOf('-');
      const sid = key.slice(0, dashIdx) as SectionId;
      const idx = parseInt(key.slice(dashIdx + 1));
      if (blocks[sid]?.[idx] !== undefined) refs.push({ sid, idx });
    });

    setChatMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'user', text: msg }]);

    setTimeout(() => {
      if (refs.length === 0) {
        // 전체 문서 대상 Q&A 모드
        const aiText = generateWholeDocReply(msg);
        setChatMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'ai', text: aiText }]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
      }
      // 명확도 판단 (TODO: API 교체)
      const clarity = analyzePromptClarity(msg);
      if (clarity === 'direct') {
        runModification(msg, refs, msg);
      } else {
        const options = generateIntentOptions(msg);
        setChatMessages(prev => [...prev, {
          id: ++msgIdRef.current, role: 'ai',
          text: '어떤 방향으로 수정할까요?',
          intentOptions: options, refs, sourceMsg: msg,
        }]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    }, 600);
  };

  // ── 방향 선택 (패턴 B) ─────────────────────────────────────────────────
  const selectIntent = (msgId: number, intent: string) => {
    const msg = chatMessages.find(m => m.id === msgId);
    if (!msg?.refs?.length) return;
    // 선택지 메시지를 선택 완료 상태로 변경
    setChatMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, intentOptions: undefined, selectedIntent: intent, text: `[${intent}] 방향 선택됨` } : m
    ));
    setTimeout(() => runModification(intent, msg.refs!, msg.sourceMsg || intent, intent), 400);
  };

  // ── 다시 생성 ──────────────────────────────────────────────────────────
  const regenerate = (msg: ChatMsg) => {
    if (!msg.refs?.length) return;
    const instruction = msg.selectedIntent || msg.sourceMsg || '다시 생성';
    setChatMessages(prev => prev.filter(m => m.id !== msg.id));
    setTimeout(() => runModification(instruction, msg.refs!, instruction, msg.selectedIntent), 400);
  };

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


  // ── 렌더 ────────────────────────────────────────────────────────────────
  // 에디터 미리보기 섹션 (#80 fix)
  const editorPreviewSections: PreviewSection[] = EDITOR_SECTIONS.map(s => ({
    label: s.label,
    content: (blocks[s.id] ?? []).join('\n\n'),
  })).filter(s => s.content.trim());

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
          <p className="text-sm font-bold text-zinc-800 mb-1">구성요소 이름 변경</p>
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
            <span className="font-serif text-sm leading-none">∑</span><span>수식</span>
          </button>
          <div className="w-px h-5 bg-zinc-200 mx-1" />
          <button onClick={() => setEditorPreviewOpen(true)} title="미리보기"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 transition-colors text-zinc-500 text-xs2">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
            <span>미리보기</span>
          </button>
          <button onClick={() => exportDocx(task?.name ?? '명세서', editorPreviewSections)} title="DOCX 내보내기"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 transition-colors text-zinc-600 text-xs2 font-medium">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/><path d="M5 9h6M5 11h4"/></svg>
            <span>DOCX</span>
          </button>
          <button onClick={() => exportPdf(task?.name ?? '명세서', editorPreviewSections)} title="PDF 내보내기 (인쇄)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 transition-colors text-zinc-600 text-xs2 font-medium">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/><path d="M5.5 9.5h5M5.5 11.5h3"/></svg>
            <span>PDF</span>
          </button>
        </div>
      </div>

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
                <h2 className="text-sm font-bold text-zinc-800 mb-3 pb-1.5 border-b border-zinc-200">
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
                            {/* 참조 삽입 */}
                            <div className="border-t border-zinc-100 px-3 py-1.5">
                              <button
                                onClick={() => { if (sel) { const cur = blocks[sel.sid]?.[sel.idx] || ''; updateBlock(sel.sid, sel.idx, `${cur}${cur ? ' ' : ''}(${d.detail.symbol} 참조)`); } }}
                                disabled={!sel}
                                className="text-xs2 font-semibold text-blue-500 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >+ 참조 삽입</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                            'absolute left-2 top-3 w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer shrink-0',
                            isChecked
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-zinc-300 bg-white opacity-60 group-hover:opacity-100'
                          )}
                        >
                          {isChecked && (
                            <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="9" height="9">
                              <polyline points="1.5,5 4,7.5 8.5,2.5"/>
                            </svg>
                          )}
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
                            className="w-full text-sm text-zinc-800 bg-transparent outline-none border-0 resize-none leading-relaxed overflow-hidden py-1.5 px-3"
                            value={blockText}
                            autoFocus
                            rows={Math.max(2, Math.ceil(blockText.length / 55))}
                            onChange={e => {
                              updateBlock(sec.id, blockIdx, e.target.value);
                              // auto-height
                              const t = e.target;
                              t.style.height = 'auto';
                              t.style.height = t.scrollHeight + 'px';
                            }}
                            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : isMarkdownTable(blockText) ? (
                          <div className="py-1.5 px-3 overflow-x-auto"><MarkdownTable text={blockText} /></div>
                        ) : blockText.includes('$') ? (
                          <p className="text-sm leading-relaxed text-zinc-800 py-1.5 px-3"
                            dangerouslySetInnerHTML={{ __html: renderBlockWithTeX(blockText) }} />
                        ) : (
                          <p className={clsx(
                            'text-sm leading-relaxed whitespace-pre-wrap py-1.5 px-3',
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
        <aside className={clsx(
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
            <span className="text-sm font-bold text-gray-800">AI 어시스턴트</span>
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
                    className="flex-1 w-full px-4 py-2.5 text-sm text-zinc-800 bg-white outline-none resize-none leading-relaxed overflow-y-auto border-0"
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
                      <div className="rounded-xl text-xs2 leading-relaxed max-w-[85%] bg-zinc-100 text-zinc-800 overflow-hidden">
                        <p className="px-3 pt-2.5 pb-1.5">{m.text}</p>
                        {/* 패턴 B: 방향 선택지 */}
                        {m.intentOptions && (
                          <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
                            {m.intentOptions.map((opt, i) => (
                              <button key={i}
                                onClick={() => selectIntent(m.id, opt)}
                                className="px-2.5 py-1 text-xs2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors">
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* 패턴 A / 패턴 B 결과: 수정안 (단일/배치) */}
                        {m.proposals && m.proposals.length > 0 && (
                          <>
                            <div className="mx-2.5 mb-2 space-y-1.5">
                              {m.proposals.map((p, pi) => {
                                const secLabel = EDITOR_SECTIONS.find(s => s.id === p.sid)?.short ?? p.sid;
                                return (
                                  <div key={pi} className="rounded-lg bg-white border border-zinc-200 p-2.5">
                                    <p className="text-xs2 font-semibold text-zinc-400 mb-1">
                                      수정안{m.proposals!.length > 1 ? ` · ${secLabel} ${p.idx + 1}` : ''}
                                    </p>
                                    <p className="text-xs2 text-zinc-800 leading-relaxed whitespace-pre-wrap">{p.text}</p>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-1.5 px-2.5 pb-2.5">
                              <button
                                onClick={() => applyProposals(m.proposals!)}
                                className="flex-1 py-1.5 text-xs2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                ✓ {m.proposals.length > 1 ? `${m.proposals.length}개 일괄 적용` : '적용'}
                              </button>
                              <button
                                onClick={() => regenerate(m)}
                                className="px-3 py-1.5 text-xs2 font-semibold text-zinc-500 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
                                ↺ 다시 생성
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
          </div>

          {/* 하단 채팅 입력창 */}
          <div className="border-t border-zinc-200 px-3 py-2.5 shrink-0 bg-white">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={chatTextareaRef}
                className="flex-1 px-3 py-2"
                placeholder={selSet.size > 0 ? `선택한 ${selSet.size}개 단락에 대해 명령하세요...` : "명령을 입력하세요... (Enter 전송)"}
                value={chatInput}
                rows={2}
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
                disabled={!chatInput.trim()}
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
                    className="w-full input py-2 font-mono text-sm resize-none"
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
