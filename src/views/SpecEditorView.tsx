/**
 * SpecEditorView — 명세서 에디터
 * 블록 단위 편집 + 섹션 탭(앵커) + 우측 AI/도면/참고문헌 패널
 * absolute 없음 — 기존 사이드바/레이아웃 유지
 */
import { useRef, useState } from 'react';
import clsx from 'clsx';
import katex from 'katex';
import { useStore } from '../store';
import { MOCK_DRAWINGS } from '../features/drawing-workflow/types';
import { openEditorTab } from '../features/drawing-workflow/editorChannel';
import type { SpecAnalysisResult } from '../features/spec/types';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import { PreviewModal } from '../components/PreviewModal';
import type { PreviewSection } from '../components/PreviewModal';

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
  { id: 'title',     label: '발명의 명칭',                       short: '명칭' },
  { id: 'tech',      label: '기술분야',                          short: '기술분야' },
  { id: 'bg',        label: '발명의 배경기술',                    short: '배경기술' },
  { id: 'problem',   label: '해결하고자 하는 과제',               short: '해결과제' },
  { id: 'solution',  label: '과제의 해결 수단',                   short: '해결수단' },
  { id: 'effect',    label: '발명의 효과',                        short: '효과' },
  { id: 'draw_desc', label: '도면의 간단한 설명',                  short: '도면설명' },
  { id: 'detail',    label: '발명을 실시하기 위한 구체적인 내용',   short: '구체적 내용' },
  { id: 'claims',    label: '청구범위',                           short: '청구범위' },
  { id: 'abstract',  label: '요약서',                             short: '요약서' },
] as const;
type SectionId = typeof EDITOR_SECTIONS[number]['id'];

// ── 초기 텍스트 ────────────────────────────────────────────────────────────

// 텍스트 → 단락 배열
function toBlocks(text: string): string[] {
  const b = text.split('\n\n').filter(s => s.trim());
  return b.length ? b : [''];
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
const AiIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
    <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 2.5v3.5H10"/>
    <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 13.5V10H6"/>
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
const ImageIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <rect x="1" y="2" width="14" height="12" rx="1.5"/>
    <circle cx="5.5" cy="6" r="1.5"/>
    <path d="M1 11l3.5-3.5L8 11l2.5-2.5L15 13"/>
  </svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <path d="M13 13H3a1 1 0 0 1-1-1V2h9l2 2v9a1 1 0 0 1-1 1z"/>
    <rect x="5" y="9" width="6" height="4" rx="0.5"/>
    <rect x="5" y="2" width="5" height="3" rx="0.5"/>
  </svg>
);

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export function SpecEditorView({ task, onBack, confirmedTitle, analysisResult }: {
  task: any; onBack: () => void; confirmedTitle?: string; analysisResult?: SpecAnalysisResult;
}) {
  const { library } = useStore();
  const taskName: string = task?.name || '새 명세서';
  // 위저드에서 확정된 발명 명칭이 있으면 title 섹션에 사용
  const effectiveTitle = confirmedTitle || taskName;

  // ── 초기 콘텐츠 헬퍼 (analysisResult 우선, 없으면 중립 플레이스홀더) ──
  function getInitialContent(id: SectionId, name: string, ar?: SpecAnalysisResult): string {
    if (ar) {
      const map: Partial<Record<SectionId, string>> = {
        title:     ar.title || name,
        tech:      ar.tech,
        bg:        ar.bg,
        problem:   ar.problem,
        solution:  ar.solution,
        effect:    ar.effect,
        draw_desc: ar.drawDesc,
        detail:    ar.detail,
        claims:    ar.claims,
        abstract:  ar.abstract,
      };
      if (map[id]) return map[id]!;
    }
    // fallback — 중립 플레이스홀더
    const fallback: Partial<Record<SectionId, string>> = {
      title:     name,
      tech:      `본 발명은 ${name}에 관한 것이다.`,
      bg:        '관련 배경기술을 기술하세요.',
      problem:   '해결하려는 과제를 기술하세요.',
      solution:  '과제의 해결 수단을 기술하세요.',
      effect:    '발명의 효과를 기술하세요.',
      draw_desc: '도면에 대한 설명을 기술하세요.',
      detail:    '발명의 구체적인 내용을 기술하세요.',
      claims:    `청구항 1.\n${name} 장치.`,
      abstract:  `${name}에 관한 발명입니다.`,
    };
    return fallback[id] || '';
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
      EDITOR_SECTIONS.map(s => [s.id, toBlocks(getInitialContent(s.id, effectiveTitle, analysisResult))])
    ) as Record<SectionId, string[]>;
  });

  // 선택된 블록 (sectionId + blockIdx)
  // 에디터 진입 시 첫 번째 단락 자동 선택 (기술분야 첫 블록)
  const [sel, setSel] = useState<{ sid: SectionId; idx: number } | null>({ sid: 'tech', idx: 0 });

  // 활성 섹션 탭
  const [activeSec, setActiveSec] = useState<SectionId>('tech');

  // 우측 패널 탭
  const [panelTab, setPanelTab] = useState<'ai' | 'drawings' | 'refs'>('ai');

  // 채팅 UI
  type ChatMsg = { id: number; role: 'user' | 'ai'; text: string; proposed?: string; blockRef?: { sid: SectionId; idx: number } };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  // 도구 모달
  const [tableModal, setTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [formulaModal, setFormulaModal] = useState(false);
  const [formulaVal, setFormulaVal] = useState('');
  const [formulaMode, setFormulaMode] = useState<'inline' | 'block'>('inline');

  // 저장 상태
  const [saved, setSaved] = useState(true);
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
    setSaved(false);
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

  // ── 섹션 앵커 이동 ─────────────────────────────────────────────────────
  const goToSection = (id: SectionId) => {
    const el = centerRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSec(id);
  };

  // ── 블록 선택 ──────────────────────────────────────────────────────────
  const selectBlock = (sid: SectionId, idx: number) => {
    setSel({ sid, idx });
    setPanelTab('ai');
    setActiveSec(sid);
  };

  // ── 채팅 전송 ──────────────────────────────────────────────────────────
  const CHAT_REPLIES: Record<string, string> = {
    '청구항': '청구항은 특허 보호 범위를 정의합니다. 독립항은 핵심 구성요소를 포함하고, 종속항은 추가 특징을 기재합니다.',
    '명세서': '특허 명세서는 발명의 기술분야, 배경기술, 해결과제, 발명의 효과, 도면 설명, 청구범위, 요약서로 구성됩니다.',
    '효과': '발명의 효과는 기존 기술 대비 개선점을 구체적인 수치나 표현으로 기재하는 것이 좋습니다.',
    '도면': '도면은 발명의 구성요소를 시각적으로 표현하며, 각 구성요소에 도면 부호(100, 200...)를 부여합니다.',
  };

  const runAI = (msg: string, curText: string, blockRef: { sid: SectionId; idx: number } | undefined) => {
    setTimeout(() => {
      let aiText: string;
      let proposed: string | undefined;
      if (curText) {
        proposed = curText.replace(/이다\.$/, `이다. ${msg.slice(0, 20)} 관점에서 보완했습니다.`);
        const secLabel = blockRef ? (EDITOR_SECTIONS.find(s => s.id === blockRef.sid)?.label ?? '') : '';
        aiText = `${secLabel} 단락의 수정안을 생성했습니다.`;
      } else {
        const matchKey = Object.keys(CHAT_REPLIES).find(k => msg.includes(k));
        aiText = matchKey
          ? CHAT_REPLIES[matchKey]
          : `"${msg.slice(0, 30)}"에 대해 답변드립니다. 특정 단락을 선택하면 해당 내용을 직접 수정해드릴 수 있습니다.`;
      }
      setChatMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'ai', text: aiText, proposed, blockRef }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, 600);
  };

  const sendChat = (override?: string) => {
    const msg = (override ?? chatInput).trim();
    if (!msg) return;
    if (!override) setChatInput('');
    const cur = sel ? (blocks[sel.sid]?.[sel.idx] || '') : '';
    const blockRef = sel ? { sid: sel.sid, idx: sel.idx } : undefined;
    setChatMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'user', text: msg }]);
    runAI(msg, cur, blockRef);
  };

  // ── 다시 생성 ──────────────────────────────────────────────────────────
  const regenerate = (msg: ChatMsg) => {
    const idx = chatMessages.findIndex(m => m.id === msg.id);
    let userQuery = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'user') { userQuery = chatMessages[i].text; break; }
    }
    setChatMessages(prev => prev.filter(m => m.id !== msg.id));
    const cur = msg.blockRef ? (blocks[msg.blockRef.sid]?.[msg.blockRef.idx] || '') : '';
    runAI(userQuery || '다시 생성', cur, msg.blockRef);
  };

  // ── 표 삽입 ─────────────────────────────────────────────────────────────
  const insertTable = () => {
    if (!sel) return;
    const cols = 3;
    const header = Array(cols).fill('항목').map((_, i) => `항목 ${i + 1}`).join(' | ');
    const sep = Array(cols).fill('---').join(' | ');
    const row = Array(cols).fill('내용').join(' | ');
    const tbl = `\n${header}\n${sep}\n${Array(tableRows).fill(row).join('\n')}\n`;
    const cur = blocks[sel.sid][sel.idx] || '';
    updateBlock(sel.sid, sel.idx, cur + tbl);
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

  const selText = sel ? (blocks[sel.sid]?.[sel.idx] || '') : '';

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
    <div className="flex-1 flex flex-col overflow-hidden bg-white">

      {/* ① 편집 툴바 */}
      <div className="flex items-center gap-0.5 px-3 h-10 border-b border-zinc-200 bg-white shrink-0">
        {/* 뒤로 */}
        <button onClick={onBack}
          className="flex items-center gap-1 text-xs2 text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded hover:bg-zinc-100 transition-colors mr-1">
          ← 분석결과
        </button>
        <div className="w-px h-5 bg-zinc-200 mx-1" />

        {/* Undo / Redo */}
        <button onClick={undo} disabled={!undoStack.length} title="실행 취소 (Ctrl+Z)"
          className="p-1.5 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-600">
          <UndoIcon />
        </button>
        <button onClick={redo} disabled={!redoStack.length} title="다시 실행 (Ctrl+Y)"
          className="p-1.5 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-600">
          <RedoIcon />
        </button>
        <div className="w-px h-5 bg-zinc-200 mx-1" />

        {/* 저장 */}
        <button onClick={() => setSaved(true)} title="저장"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-zinc-100 transition-colors text-xs2">
          <SaveIcon />
          <span className={saved ? 'text-green-600' : 'text-amber-600'}>{saved ? '저장됨' : '저장'}</span>
        </button>
        <div className="w-px h-5 bg-zinc-200 mx-1" />

        {/* 표 삽입 */}
        <button onClick={() => setTableModal(true)} disabled={!sel} title="표 삽입"
          className="p-1.5 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-600">
          <TableIcon />
        </button>

        {/* 이미지/도면 */}
        <button onClick={() => setPanelTab('drawings')} disabled={!sel} title="도면 삽입"
          className="p-1.5 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-600">
          <ImageIcon />
        </button>

        {/* 수식 */}
        <button onClick={() => setFormulaModal(true)} disabled={!sel} title="수식 입력"
          className="px-2 py-1.5 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-600 text-base font-serif">
          ∑
        </button>

        {/* 선택 블록 표시 */}
        {sel && (
          <span className="mr-auto ml-1 text-xs2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
            {EDITOR_SECTIONS.find(s => s.id === sel.sid)?.short} · 블록 {sel.idx + 1}
          </span>
        )}

        {/* 미리보기 버튼 (#80 fix) */}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setEditorPreviewOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs2 text-zinc-600 hover:bg-zinc-100 transition-colors"
            title="명세서 미리보기">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="12" height="12">
              <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
            </svg>
            미리보기
          </button>
        </div>
      </div>

      {/* ② 섹션 탭 (앵커 이동만) — 우측에 페이드 힌트로 스크롤 가능성 표시 */}
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

      {/* ③ 본문 + 우측 패널 */}
      <div className="flex-1 flex overflow-hidden min-h-0">

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
                <div className="space-y-1.5">
                  {blocks[sec.id].map((blockText, blockIdx) => {
                    const isSelected = sel?.sid === sec.id && sel?.idx === blockIdx;
                    return (
                      <div
                        key={blockIdx}
                        onClick={() => { if (!isSelected) selectBlock(sec.id, blockIdx); }}
                        className={clsx(
                          'group relative rounded-lg border-2 px-4 py-3 transition-all',
                          isSelected
                            ? 'border-blue-400 bg-white shadow-sm cursor-text'
                            : 'border-transparent hover:border-zinc-300 bg-white cursor-pointer',
                          !blockText.trim() && !isSelected && 'bg-zinc-100'
                        )}
                      >
                        {/* 선택 표시 */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-l-lg" />
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
                              setSaved(false);
                              if (sel?.sid === sec.id && sel?.idx === blockIdx) setSel(null);
                            }}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="단락 삭제"
                          >
                            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="10" height="10">
                              <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                            </svg>
                          </button>
                        )}
                        {isSelected ? (
                          <textarea
                            className="w-full text-sm text-zinc-800 bg-transparent outline-none resize-none leading-relaxed overflow-hidden"
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
                        ) : blockText.includes('$') ? (
                          <p className="text-sm leading-relaxed text-zinc-800"
                            dangerouslySetInnerHTML={{ __html: renderBlockWithTeX(blockText) }} />
                        ) : (
                          <p className={clsx(
                            'text-sm leading-relaxed whitespace-pre-wrap',
                            blockText.trim() ? 'text-zinc-800' : 'text-zinc-400 italic'
                          )}>
                            {blockText.trim() || '단락 내용을 입력하세요...'}
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

        {/* 우측 AI 어시스턴트 패널 */}
        <aside className="w-[380px] shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden">
          {/* 탭 헤더 */}
          <div className="flex border-b border-zinc-200 shrink-0">
            {([['ai', 'AI 어시스턴트'], ['drawings', '도면'], ['refs', '참고문헌']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setPanelTab(id)}
                className={clsx(
                  'flex-1 py-2.5 text-xs2 font-semibold border-b-2 transition-colors',
                  panelTab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-zinc-500 hover:text-zinc-700'
                )}>
                {label}
              </button>
            ))}
          </div>

          {/* ── AI 어시스턴트 탭 — 채팅 레이아웃 (탭 본문과 분리) ── */}
          {panelTab === 'ai' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 선택된 블록 컨텍스트 (읽기 전용) */}
              <div className="px-3 pt-2 pb-2 border-b border-zinc-100 shrink-0 bg-zinc-50">
                {sel ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs2 font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {EDITOR_SECTIONS.find(s => s.id === sel.sid)?.short}
                      </span>
                      <span className="text-xs2 text-zinc-400">블록 {sel.idx + 1}</span>
                    </div>
                    <p className="text-xs2 text-zinc-600 leading-relaxed line-clamp-3 bg-white rounded border border-zinc-200 px-2.5 py-1.5">
                      {selText || <span className="text-zinc-400 italic">빈 단락</span>}
                    </p>
                  </>
                ) : (
                  <p className="text-xs2 text-zinc-400 text-center py-0.5">
                    본문에서 단락을 선택하면 AI가 수정을 도와드립니다
                  </p>
                )}
              </div>

              {/* 채팅 메시지 영역 */}
              <div className="flex-1 overflow-y-auto scroll-thin px-3 py-2 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="py-6 px-1">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                      <AiIcon />
                    </div>
                    <p className="text-xs2 text-zinc-500 font-medium mb-2 text-center">AI 어시스턴트</p>
                    {/* 빠른 질문 예시 */}
                    <div className="space-y-1.5">
                      {[
                        sel ? '이 단락을 더 간결하게 수정해줘' : '청구항 작성 팁을 알려줘',
                        sel ? '특허 문체로 바꿔줘' : '발명의 효과를 어떻게 써야 하나요?',
                        sel ? '구체적인 수치를 추가해줘' : '독립항과 종속항 차이는?',
                      ].map((q, i) => (
                        <button key={i} onClick={() => sendChat(q)}
                          className="w-full text-left text-xs2 text-zinc-500 px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                        {m.proposed && (
                          <>
                            <div className="mx-2.5 mb-2 rounded-lg bg-white border border-zinc-200 p-2.5">
                              <p className="text-xs2 font-semibold text-zinc-400 mb-1">수정안</p>
                              <p className="text-xs2 text-zinc-800 leading-relaxed whitespace-pre-wrap">{m.proposed}</p>
                            </div>
                            <div className="flex gap-1.5 px-2.5 pb-2.5">
                              <button
                                onClick={() => {
                                  const ref = m.blockRef;
                                  if (ref) updateBlock(ref.sid, ref.idx, m.proposed!);
                                  else if (sel) updateBlock(sel.sid, sel.idx, m.proposed!);
                                }}
                                className="flex-1 py-1.5 text-xs2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                ✓ 적용
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

              {/* 하단 채팅 입력창 — 항상 표시 */}
              <div className="border-t border-zinc-200 px-3 py-2.5 shrink-0 bg-white">
                <div className="flex gap-2 items-end">
                  <textarea
                    className="flex-1 text-xs2 border border-zinc-300 rounded-xl px-3 py-2 outline-none resize-none focus:border-blue-400 transition-colors leading-relaxed"
                    placeholder={sel ? "수정 지시를 입력하세요... (Enter 전송)" : "질문을 입력하세요... (Enter 전송)"}
                    value={chatInput}
                    rows={1}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    style={{ maxHeight: '96px', overflowY: 'auto' }}
                  />
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim()}
                    className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition-colors">
                    <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                      <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z" fill="white" stroke="none"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 탭 본문 (도면/참고문헌) */}
          <div className={clsx('flex-1 overflow-y-auto scroll-thin', panelTab === 'ai' && 'hidden')}>

            {/* ── 도면 탭 ── */}
            {panelTab === 'drawings' && (
              <div className="px-3 py-3 space-y-1.5">
                {(() => {
                  const drawings = analysisResult?.drawings ?? MOCK_DRAWINGS;
                  return (
                  <>
                <p className="text-xs2 font-semibold text-zinc-500 mb-2">
                  추출된 도면 <span className="font-normal text-zinc-400">
                    ({drawings.length}개 · 완료 {drawings.filter(d => d.stage === 'done').length}개)
                  </span>
                </p>
                {drawings.map(d => {
                  const isDone = d.stage === 'done';
                  const LABEL_STYLES: Record<string, string> = {
                    '제안기술': 'bg-blue-100 text-blue-700',
                    '종래기술': 'bg-zinc-100 text-zinc-600',
                    'AI생성':   'bg-violet-100 text-violet-700',
                  };
                  return (
                  <div key={d.id}
                    className={clsx(
                      'rounded-lg border overflow-hidden transition-all',
                      isDone ? 'border-green-200 bg-green-50/30' : 'border-zinc-200 bg-white'
                    )}>
                    {/* 썸네일 + 메타 (DrawingsPanel과 동일한 compact row) */}
                    <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-1.5">
                      <div className="w-10 shrink-0 aspect-[4/3] bg-zinc-100 rounded border border-zinc-200 flex items-center justify-center overflow-hidden">
                        {d.exportedImageUrl
                          ? <img src={d.exportedImageUrl} className="w-full h-full object-contain" alt="" />
                          : <ImageIcon />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-xs2 font-bold text-zinc-700">기호 {d.symbol}</span>
                          <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', LABEL_STYLES[d.label] ?? 'bg-zinc-100 text-zinc-500')}>
                            {d.label}
                          </span>
                        </div>
                        <p className="text-xs2 text-zinc-700 font-semibold truncate">{d.name}</p>
                      </div>
                      <div className="shrink-0">
                        {isDone
                          ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" className="text-green-500"><polyline points="2,6 5,9 10,3"/></svg>
                          : <span className="w-2 h-2 rounded-full block bg-zinc-300" />}
                      </div>
                    </div>
                    {/* 액션 버튼 */}
                    <div className={clsx('flex border-t', isDone ? 'border-green-100' : 'border-zinc-100')}>
                      <button
                          onClick={() => {
                            if (sel) {
                              const cur = blocks[sel.sid][sel.idx] || '';
                              updateBlock(sel.sid, sel.idx, `${cur} (도면 기호 ${d.symbol} 참조)`);
                            }
                          }}
                          disabled={!sel}
                          className="flex-1 py-1.5 text-xs2 font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-zinc-100"
                        >
                          참조 삽입
                        </button>
                        <button
                          onClick={() => openEditorTab({
                            drawingId: d.id,
                            drawings: drawings as any,
                            components: [],
                            references: [],
                            drawingName: d.name,
                            timestamp: Date.now(),
                          })}
                          className={clsx(
                            'px-4 py-1.5 text-xs2 font-semibold transition-colors',
                            isDone ? 'text-green-600 hover:bg-green-50' : 'text-zinc-600 hover:bg-zinc-50'
                          )}
                        >
                          편집
                        </button>
                    </div>
                  </div>
                  );
                })}
                  </>
                  );
                })()}
              </div>
            )}

            {/* ── 참고문헌 탭 ── */}
            {panelTab === 'refs' && (
              <div className="p-3">
                {library.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" className="text-zinc-400">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      </svg>
                    </div>
                    <p className="text-sm2 text-zinc-600 font-medium mb-1">저장된 참고문헌 없음</p>
                    <p className="text-xs2 text-zinc-400 leading-relaxed">
                      특허·논문 검색에서 문헌을 저장하면<br />여기서 인용구로 삽입할 수 있습니다.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs2 font-semibold text-zinc-600 mb-2">내 라이브러리 ({library.length}건)</p>
                    <div className="space-y-2">
                      {library.slice(0, 15).map(item => (
                        <div key={item.id} className="rounded-xl border border-zinc-200 p-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={clsx(
                              'text-xs2 px-1.5 py-0.5 rounded font-semibold',
                              item.type === 'patent' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            )}>
                              {item.type === 'patent' ? '특허' : '논문'}
                            </span>
                            <span className="text-xs2 text-zinc-400 font-mono truncate">{item.refNumber}</span>
                          </div>
                          <p className="text-xs2 text-zinc-800 font-semibold line-clamp-2 leading-snug mb-1">{item.title}</p>
                          {item.applicant && <p className="text-xs2 text-zinc-400 truncate">{item.applicant}</p>}
                          <button
                            onClick={() => {
                              if (sel) {
                                const cur = blocks[sel.sid][sel.idx] || '';
                                updateBlock(sel.sid, sel.idx, `${cur} [${item.refNumber}]`);
                              }
                            }}
                            disabled={!sel}
                            className="mt-2 w-full py-1.5 bg-zinc-800 text-white rounded text-xs2 font-semibold hover:bg-zinc-700 disabled:opacity-40"
                          >
                            인용 삽입
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── 표 삽입 모달 ── */}
      {tableModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTableModal(false)}>
          <div className="bg-white rounded-xl shadow-card-deep w-72 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base2 font-bold text-zinc-800 mb-4">표 삽입</h3>
            <div>
              <label className="text-xs2 font-semibold text-zinc-600 mb-1 block">행 수</label>
              <input type="number" min={1} max={10} value={tableRows}
                onChange={e => setTableRows(Number(e.target.value))}
                className="input py-1.5 w-full" />
            </div>
            <p className="text-xs2 text-zinc-400 mt-2">열 수: 3 (고정)</p>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setTableModal(false)} className="btn-outline btn-sm">취소</button>
              <button onClick={insertTable} className="btn-primary btn-sm">삽입</button>
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
                <button onClick={() => { setFormulaModal(false); setFormulaVal(''); }} className="btn-outline btn-sm">취소</button>
                <button onClick={insertFormula}
                  disabled={!formulaVal.trim() || !!preview?.error}
                  className="btn-primary btn-sm disabled:opacity-40">
                  삽입
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </>
  );
}
