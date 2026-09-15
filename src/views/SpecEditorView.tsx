/**
 * SpecEditorView — 명세서 에디터
 * 블록 단위 편집 + 섹션 탭(앵커) + 우측 AI/도면/참고문헌 패널
 * absolute 없음 — 기존 사이드바/레이아웃 유지
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import katex from 'katex';
import { Icon } from '../components/Icon';
import { Input } from '../components/ui';
import { Button, Textarea, openAlertDialog } from '@muhayu/axp-ui';
import type { InventionContext, MidspecSection, InventionSpecification, Drawing } from '../features/spec/types';
import type { DrawingItem as WorkflowDrawingItem } from '../features/drawing-workflow/types';
import { openEditorTab } from '../features/drawing-workflow/editorChannel';
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import { MOCK_MIDSPEC, MOCK_EMBODIMENT, buildDrawingDescBlocks } from '../features/spec/mockAiService';
import { PreviewModal } from '../components/PreviewModal';
import type { PreviewSection } from '../components/PreviewModal';
import {
  routeIntent, buildProposal, EDIT_ACTION_LABEL, INTENT_LABEL,
  resolveEditIntent, progressStepsFor, buildExpressionReplacements,
  type EditProposal, type PlanStepDef, type AgentIntent, type RoutedIntent,
  type ExpressionReplacement, type ProgressStep,
} from '../features/ai/specAgentMock';
import { toast } from '../components/Toast';
import { diffWords } from '../utils/diffWords';
import { particle } from '../utils/korean';
import { DiffText } from '../components/DiffText';
import { ElementText, type ElementLike } from '../components/ElementText';
import { replaceElementName } from '../features/spec/elementRename';
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
// 이번 버전 범위: 표 삽입은 제외(사용자 결정 2026-08-28). API SpecificationBlock은 table 타입을 지원하므로 후속 버전에서 플래그만 켜면 된다.
const ENABLE_TABLE_INSERT = true;   // 2026-08-31 사용자 결정: 재포함 (API SpecificationBlock.type=table 지원)
// 도면 참조 '(도 N 참조)' 삽입도 이번 버전 제외(사용자 결정 2026-08-28) — API 없음, 실시예 생성이 표기를 포함하므로 보조 도구로만 유효
const ENABLE_DRAWING_REF = false;

const EDITOR_SECTIONS = [
  { id: 'title',                  label: '발명의 명칭',                       short: '명칭' },
  { id: 'technical_field',        label: '기술분야',                          short: '기술분야' },
  { id: 'background_art',         label: '발명의 배경기술',                    short: '배경기술' },
  { id: 'technical_problem',      label: '해결하고자 하는 과제',               short: '해결과제' },
  { id: 'technical_solution',     label: '해결수단',                          short: '해결수단' },
  { id: 'advantageous_effects',   label: '발명의 효과',                        short: '효과' },
  { id: 'drawing_descriptions',   label: '도면의 간단한 설명',                  short: '도면설명' },
  { id: 'reference_signs',        label: '부호의 설명',                        short: '부호' },       // A7: 구성요소 부호표
  { id: 'embodiment_description', label: '발명을 실시하기 위한 구체적인 내용',   short: '구체적 내용' },
  { id: 'claims',                 label: '청구범위',                           short: '청구범위' },
  { id: 'abstract',               label: '요약',                              short: '요약' },       // A7: 요약서 (확정 개요 + 대표도)
] as const;
type SectionId = typeof EDITOR_SECTIONS[number]['id'];

// 앞 단계 확정값에서 파생되는 섹션 — 직접 편집도, AI 어시스턴트 수정 대상 지정도 막는다 (2026-09-10 회의 결정).
// 뒤에서 정보가 들어가는 구조라 여기서 고치면 원천과 어긋난다.
const DERIVED_SECTIONS: SectionId[] = ['title', 'reference_signs', 'abstract'];
const DERIVED_SECTION_SOURCE: Partial<Record<SectionId, string>> = {
  title:           '④ 명칭·요약에서 확정한 발명의 명칭입니다. 고치려면 발명 정보 단계에서 수정하세요.',
  reference_signs: '⑤ 구성요소의 부호·명칭에서 자동으로 만들어집니다. 고치려면 발명 정보 단계에서 수정하세요.',
  abstract:        '④ 명칭·요약의 개요와 대표도에서 자동으로 만들어집니다. 고치려면 발명 정보 단계에서 수정하세요.',
};

// ── 초안 생성 그룹 ──────────────────────────────────────────────────────────
// API의 단계별 결과 조회 4종에 대응한다. 뒤 단계 호출에 앞 단계 결과를 함께 넘기는 구조라
// 실제로도 이 순서대로 완료되므로, 완료되는 그룹부터 위에서 아래로 채워 넣는다.
// 명칭·부호의 설명·청구범위·요약은 위저드에서 확정된 값이라 생성 대상이 아니다.
const DRAFT_GROUPS: { label: string; sections: SectionId[] }[] = [
  { label: '도면의 간단한 설명', sections: ['drawing_descriptions'] },
  { label: '기술분야 · 배경기술', sections: ['technical_field', 'background_art'] },
  { label: '발명의 내용', sections: ['technical_problem', 'technical_solution', 'advantageous_effects'] },
  { label: '실시예', sections: ['embodiment_description'] },
];
// 그룹당 mock 소요 시간. 실 API에서는 상태 조회가 완료를 알릴 때마다 해당 결과를 채운다.
const DRAFT_GROUP_MOCK_MS = 1800;

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
        <tr>{head.map((c, i) => <th key={i} className="border border-neutral-300 px-2 py-1 bg-neutral-50 font-semibold text-left text-neutral-700">{c}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((r, ri) => (
          <tr key={ri}>{head.map((_, ci) => <td key={ci} className="border border-neutral-300 px-2 py-1 text-neutral-700">{r[ci] ?? ''}</td>)}</tr>
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
    pageNumber: drawing.page ?? 1,
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
// "제N항" 인용 번호를 매핑에 따라 갱신 (A8) — 매핑에 없는 번호는 그대로 둔다
function remapClaimRefs(items: { value: string }[], map: Record<number, number>): { value: string }[] {
  return items.map(it => ({
    value: it.value.replace(/제\s*(\d+)\s*항/g, (m, n: string) => {
      const to = map[parseInt(n, 10)];
      return to ? `제${to}항` : m;
    }),
  }));
}
// 청구범위 블록은 '청구항 N.' 단락만 보관한다(요약 헤더 없음 — 미리보기·내보내기에 섞이지 않도록)
function serializeClaimItems(items: { value: string }[]): string[] {
  return items.map((it, i) => `청구항 ${i + 1}.\n${it.value}`);
}
const isClaimBlock = (b: string) => /^청구항\s*\d+\./.test(b.trim());

function ClaimsEditor({ blocks, onChange, elements = [], onClickElement, selSet, onToggleSel }: {
  blocks: string[];
  onChange: (next: string[]) => void;
  elements?: ElementLike[];
  onClickElement?: (name: string) => void;   // 하이라이트 클릭 → 구성요소 이름 전체 변경 (본문과 동일)
  selSet?: Set<string>;                                      // AI 수정 대상 선택 — 단락과 동일 규칙 (키: claims-{idx})
  onToggleSel?: (idx: number, e: React.MouseEvent) => void;
}) {
  const items = parseClaimItems(blocks);
  const commit = (next: { value: string }[]) => onChange(serializeClaimItems(next));
  const editVal = (idx: number, v: string) => commit(items.map((it, i) => i === idx ? { value: v } : it));
  // 클릭-편집 모델: 본문 단락과 동일하게 읽기 → 클릭 시 편집 (B12)
  const [editing, setEditing] = useState<number | null>(null);
  // 순서 변경 시 두 항의 번호가 바뀌므로 인용 "제N항"도 함께 갱신 (A8)
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[idx], a[j]] = [a[j], a[idx]];
    commit(remapClaimRefs(a, { [idx + 1]: j + 1, [j + 1]: idx + 1 }));
    setEditing(null);
  };
  // 삭제 시: 뒤 항 번호가 당겨지므로 인용 갱신, 삭제 항을 인용하는 종속항은 함께 삭제할지 확인 (A8)
  const remove = (idx: number) => {
    const no = idx + 1;
    const dependents = items.map((it, i) => ({ it, i })).filter(({ it, i }) => i !== idx && claimDependsOn(it.value) === no);
    const doRemove = (alsoDependents: boolean) => {
      const drop = new Set<number>([idx, ...(alsoDependents ? dependents.map(d => d.i) : [])]);
      const kept = items.filter((_, i) => !drop.has(i));
      // 남은 항의 (구 번호 → 새 번호) 매핑
      const map: Record<number, number> = {};
      let newNo = 0;
      items.forEach((_, i) => { if (!drop.has(i)) { newNo++; map[i + 1] = newNo; } });
      commit(remapClaimRefs(kept, map));
      setEditing(null);
    };
    if (dependents.length === 0) {
      openAlertDialog(
        { title: `청구항 ${no} 삭제`, description: `청구항 ${no}${particle(String(no), '을', '를')} 삭제할까요? 뒤 항의 번호와 인용이 자동으로 당겨집니다.`, confirm: '삭제', cancel: '취소' },
        { theme: 'danger', onConfirm: (ctrl) => { ctrl.close(); doRemove(false); } },
      );
      return;
    }
    openAlertDialog(
      {
        title: `청구항 ${no} 삭제`,
        description: `청구항 ${no}${particle(String(no), '을', '를')} 인용하는 종속항 ${dependents.length}개(${dependents.map(d => `청구항 ${d.i + 1}`).join(', ')})가 있습니다. 함께 삭제할까요? '이 항만 삭제'를 누르면 종속항은 남고 인용 번호가 ⚠로 표시됩니다.`,
        confirm: '함께 삭제', cancel: '이 항만 삭제',
      },
      { theme: 'danger', onConfirm: (ctrl) => { ctrl.close(); doRemove(true); }, onCancel: (ctrl) => { ctrl.close(); doRemove(false); } },
    );
  };
  const addIndep = () => commit([...items, { value: '새 독립 청구항 내용을 입력하세요.' }]);
  const addDep = () => commit([...items, { value: `제1항에 있어서, ...인, 장치.` }]);

  if (items.length === 0) {
    return (
      <div data-spec="SPC-EDT-090" className="space-y-2">
        <p className="text-xs2 text-neutral-400 py-3 text-center">청구항이 없습니다. 아래에서 추가하세요.</p>
        <div className="flex gap-2">
          <button data-spec="SPC-EDT-094" onClick={addIndep} className="flex-1 py-1.5 text-xs2 font-semibold text-brand-600 border border-dashed border-brand-300 rounded-lg hover:bg-brand-50 transition-colors">+ 독립항 추가</button>
          <button onClick={addDep} className="flex-1 py-1.5 text-xs2 font-semibold text-neutral-600 border border-dashed border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors">+ 종속항 추가</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs2 text-neutral-400 mb-1">
        번호는 위치에 따라 자동 부여되며, 순서 변경·삭제 시 본문의 "제N항" 인용도 함께 갱신됩니다. 항을 클릭하면 편집할 수 있습니다.
      </p>
      {items.map((it, idx) => {
        const no = idx + 1;
        const dep = claimDependsOn(it.value);
        const isIndep = dep === null;
        const mismatch = dep !== null && (dep < 1 || dep >= no);
        return (
          <div key={idx} className={clsx('rounded-lg border bg-white p-2 border-l-[3px]',
            selSet?.has(`claims-${idx}`) ? 'border-brand-300 bg-brand-50/30' : 'border-neutral-200',
            isIndep ? 'border-l-brand-400' : 'border-l-neutral-300 ml-4')}>
            <div className="flex items-center gap-1.5 mb-1">
              {onToggleSel && (() => { const checked = selSet?.has(`claims-${idx}`); return (
                <button type="button" data-spec="SPC-EDT-081" onClick={e => onToggleSel(idx, e)}
                  title="체크하면 이 항이 AI 수정 명령의 대상이 됩니다"
                  className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                    checked ? 'bg-brand-400 border-brand-400 text-white' : 'border-neutral-300 bg-white hover:border-brand-400')}>
                  {checked && <Icon name="check" size={10} />}
                </button>
              ); })()}
              <span className="text-xs2 font-bold text-neutral-700">청구항 {no}</span>
              {isIndep ? (
                <span className="text-xs2 px-1.5 py-px rounded-full bg-brand-50 text-brand-600 font-medium">독립항</span>
              ) : (
                <span className={clsx('text-xs2 px-1.5 py-px rounded-full font-medium', mismatch ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-600')}>
                  제{dep}항 종속{mismatch && ' ⚠ 번호 확인'}
                </span>
              )}
              <div className="ml-auto flex gap-0.5">
                <button data-spec="SPC-EDT-092" onClick={() => move(idx, -1)} disabled={idx === 0} className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-all" title="위로">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 7l3-4 3 4"/></svg>
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-all" title="아래로">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 3l3 4 3-4"/></svg>
                </button>
                <button data-spec="SPC-EDT-093" onClick={() => remove(idx)} className="w-5 h-5 rounded-md flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all" title="삭제">
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="11" height="11"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>
                </button>
              </div>
            </div>
            {editing === idx ? (
              <textarea
                autoFocus
                value={it.value}
                onChange={e => editVal(idx, e.target.value)}
                onBlur={() => setEditing(null)}
                rows={Math.max(2, Math.ceil(it.value.length / 50))}
                className="w-full text-base2 text-neutral-800 leading-relaxed bg-white outline-none resize-none border border-brand-300 rounded-md px-1.5 py-1 transition-colors"
                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
              />
            ) : (
              <p
                onClick={() => setEditing(idx)}
                data-spec="SPC-EDT-091" title="클릭하여 편집"
                className="text-base2 text-neutral-800 leading-relaxed whitespace-pre-wrap px-1.5 py-1 rounded-md cursor-text hover:bg-white hover:ring-1 hover:ring-neutral-200 transition-colors"
              ><ElementText text={it.value} elements={elements} onClickElement={onClickElement} /></p>
            )}
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <button data-spec="SPC-EDT-094" onClick={addIndep} className="flex-1 py-1.5 text-xs2 font-semibold text-brand-600 border border-dashed border-brand-300 rounded-lg hover:bg-brand-50 transition-colors">+ 독립항 추가</button>
        <button onClick={addDep} className="flex-1 py-1.5 text-xs2 font-semibold text-neutral-600 border border-dashed border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors">+ 종속항 추가</button>
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

// ── 수정 제안 카드 (데모 정합: 단어 diff · 확대 · ACCEPT/DECLINE · 보강 지시) ──
function ProposalCard({ p, onAccept, onDecline, onRefine, onZoom }: {
  p: EditProposal;
  onAccept: () => void;
  onDecline: () => void;
  onRefine: (instruction: string) => void;
  onZoom: () => void;
}) {
  const [refine, setRefine] = useState('');
  const diff = (p.action === 'REPLACE' || p.action === 'REWRITE')
    ? diffWords(p.source, p.target)
    : null;
  const sendRefine = () => {
    const v = refine.trim();
    if (!v) return;
    setRefine('');
    onRefine(v);
  };
  return (
    <div data-spec="SPC-EDT-031" className="rounded-lg bg-white border border-neutral-200 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={clsx('px-1.5 py-0.5 rounded-md text-xs2 font-bold',
          p.action === 'DELETE' ? 'bg-red-100 text-red-600'
          : p.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700'
          : p.action === 'REWRITE' ? 'bg-neutral-100 text-neutral-700'
          : 'bg-brand-100 text-brand-700')}>
          {EDIT_ACTION_LABEL[p.action]}
        </span>
        <span className="text-xs2 text-neutral-500 truncate">{p.targetDesc}</span>
        <button onClick={onZoom} className="ml-auto shrink-0 text-xs2 text-neutral-400 hover:text-brand-600 transition-colors" title="크게 보기">↗ 확대</button>
      </div>
      {p.summary && <p className="text-xs2 text-neutral-400 mb-1.5">{p.summary}</p>}
      {p.action !== 'INSERT' && p.source && (
        <div className="mb-1">
          <p className="text-xs2 text-neutral-400 mb-0.5">Before</p>
          <p className="text-xs2 leading-relaxed rounded-md px-2 py-1 bg-red-50/60 text-neutral-700 whitespace-pre-wrap max-h-32 overflow-y-auto scroll-thin">
            {diff ? <DiffText segs={diff.before} mode="before" /> : <span className="bg-red-100 text-red-700 line-through">{p.source}</span>}
          </p>
        </div>
      )}
      {p.action !== 'DELETE' && (
        <div>
          <p className="text-xs2 text-neutral-400 mb-0.5">After</p>
          <p className="text-xs2 leading-relaxed rounded-md px-2 py-1 bg-emerald-50/60 text-neutral-700 whitespace-pre-wrap max-h-32 overflow-y-auto scroll-thin">
            {diff ? <DiffText segs={diff.after} mode="after" /> : <span className="bg-emerald-100 text-emerald-800">{p.target}</span>}
          </p>
        </div>
      )}
      <div className="flex gap-1.5 mt-2" data-spec="SPC-EDT-032">
        {p.status === 'pending' ? (
          <>
            <button onClick={onAccept} className="flex-1 py-1 text-xs2 font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">✓ 적용</button>
            <button onClick={onDecline} className="flex-1 py-1 text-xs2 font-semibold text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">✕ 취소</button>
          </>
        ) : (
          <span className={clsx('text-xs2 font-semibold', p.status === 'accepted' ? 'text-emerald-600' : 'text-neutral-400')}>
            {p.status === 'accepted' ? '✓ 적용됨' : '✕ 취소됨'}
          </span>
        )}
      </div>
      {/* 보강 지시 — 데모 정합: "대신 이렇게 해줘" 재지시 */}
      {p.status === 'pending' && (
        <div className="flex gap-1 mt-1.5">
          <input
            className="flex-1 min-w-0 text-xs2 px-2 py-1 border border-neutral-200 rounded-lg bg-neutral-50 outline-none focus:border-brand-400 focus:bg-white transition-colors"
            placeholder="대신 이렇게 해줘 (보강 지시)..."
            value={refine}
            onChange={e => setRefine(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendRefine(); } }}
          />
          <button
            onClick={sendRefine}
            disabled={!refine.trim()}
            className="shrink-0 text-xs2 font-semibold px-2 py-1 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-40 transition-colors"
          >보내기</button>
        </div>
      )}
    </div>
  );
}

// ── 요청 분석 진행 트리 (데모 SSE 진행 이벤트 정합) ─────────────────────────
// 뎁스(작업 계층)는 표시하지 않는다 — 들여쓰기로 계층을 드러내고 완료 단계를 쌓아 보이면 AI 내부 구조가
// 그대로 노출되는 느낌이라, **한 줄에 현재 라벨만 바뀌며 프로그레스처럼** 보이게 한다 (2026-09-10 회의 4절).
// ProgressStep.depth는 SSE가 계속 내려주므로 타입·데이터는 그대로 두고 렌더에서만 쓰지 않는다.
function ThinkingProgress({ steps, done }: { steps: ProgressStep[]; done: number }) {
  const current = steps[Math.min(done, steps.length - 1)];
  return (
    <div data-spec="SPC-AST-034" className="rounded-xl px-3 py-2 bg-neutral-100 border border-neutral-200">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0 inline-block" />
        <span className="text-xs2 text-brand-700 font-semibold" role="status" aria-live="polite">
          {current?.label ?? '요청 분석 중'}
        </span>
      </div>
      {/* 진행 바 — 단계 목록을 펼치지 않고 진척만 보여 준다 */}
      <div className="mt-1.5 h-1 rounded-full bg-white border border-neutral-200 overflow-hidden">
        <div
          className="h-full bg-brand-400 transition-[width] duration-300"
          style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export function SpecEditorView({ task, onBack, confirmedTitle, midspec, context, confirmedClaimsText, onRenameElement, draftGenerated, onDraftGenerated }: {
  task: any
  onBack: () => void
  confirmedTitle?: string
  midspec?: MidspecSection[]
  context?: InventionContext
  confirmedClaimsText?: string
  onRenameElement?: (oldName: string, newName: string) => void   // 원천(context.elements)·위저드 텍스트 동기화
  draftGenerated?: boolean                                        // 초안 생성을 이미 실행했는지 (1회 제한)
  onDraftGenerated?: (sections: MidspecSection[]) => void         // 생성 완료 결과를 원천에 반영
}) {
  const taskName: string = task?.name || '새 명세서';
  const effectiveTitle = confirmedTitle || taskName;

  // ── 초기 콘텐츠 헬퍼 (MidspecSection 기반) ──
  // 본문은 「초안 생성」으로만 채워진다 — 초안을 만들기 전에는 중간명세서가 남아 있어도 쓰지 않고
  // 안내 문구를 보여 준다. 그래야 "초안 생성 버튼 + 이미 채워진 본문"이 동시에 뜨지 않는다.
  function getMidspecText(key: string): string {
    if (!draftGenerated) return ''
    const section = midspec?.find(s => s.key === key)
    return section?.blocks.map(b => b.content).join('\n\n') ?? ''
  }

  function getInitialContent(
    id: SectionId,
    name: string,
  ): string {
    if (id === 'title') return confirmedTitle || name
    if (id === 'claims') return confirmedClaimsText || `청구항 1.\n${name} 장치.`
    // A7: 요약 = 제목·요약 단계에서 확정한 개요 + 대표도 / 부호의 설명 = 구성요소 부호표 (InventionContext 단일 원천)
    if (id === 'abstract') {
      const summary = (context?.summary ?? '').trim()
      const repIdx = (context?.drawings ?? []).filter(d => d.included !== false && d.useForSpec).findIndex(d => d.isRepresentative)
      const rep = repIdx >= 0 ? `\n\n【대표도】 도 ${repIdx + 1}` : ''
      return (summary || `${name}에 관한 발명의 요약을 입력하세요.`) + rep
    }
    if (id === 'reference_signs') {
      const els = (context?.elements ?? []).filter(e => e.symbol)
      return els.length ? els.map(e => `${e.symbol}: ${e.value_ko}`).join('\n') : '부호와 명칭을 "100: 데이터 수집부" 형식으로 입력하세요.'
    }
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
      reference_signs:        '부호와 명칭을 "100: 데이터 수집부" 형식으로 입력하세요.',
      embodiment_description: '발명의 구체적인 내용을 기술하세요.',
      claims:                 `청구항 1.\n${name} 장치.`,
      abstract:               `${name}에 관한 발명의 요약을 입력하세요.`,
    }
    return fallback[id] || ''
  }

  // 섹션별 블록 배열 (localStorage 복원 우선)
  // 단, 초안 생성 전에는 저장된 편집본도 쓰지 않는다 — 본문은 「초안 생성」으로만 채워진다.
  // (초안 생성 전에는 편집 자체가 불가능하므로, 이 상태의 저장본은 구 흐름이 남긴 잔여물이다.)
  const [blocks, setBlocks] = useState<Record<SectionId, string[]>>(() => {
    if (task?.id && draftGenerated) {
      const saved = loadSpecState(task.id);
      if (saved?.editorBlocks && Object.keys(saved.editorBlocks).length > 0) {
        // 저장본에 없는 섹션(요약·부호의 설명 등 신규)은 초기 콘텐츠로 채운다 (A7 마이그레이션)
        const savedBlocks = saved.editorBlocks as Partial<Record<SectionId, string[]>>;
        return Object.fromEntries(
          EDITOR_SECTIONS.map(s => [s.id, savedBlocks[s.id] ?? toBlocks(getInitialContent(s.id, effectiveTitle))])
        ) as Record<SectionId, string[]>;
      }
    }
    return Object.fromEntries(
      EDITOR_SECTIONS.map(s => [s.id, toBlocks(getInitialContent(s.id, effectiveTitle))])
    ) as Record<SectionId, string[]>;
  });

  // ── 초안 생성 (2026-09-10 회의 결정) ──────────────────────────────────────
  // 위저드의 '중간명세서' 단계를 대신한다. 실행 중에는 본문 편집을 막고 진행 상태를 보여주며,
  // 완료되는 그룹부터 위에서 아래로 채운다. 토큰 비용 때문에 재생성은 없다 — 1회만 실행 가능.
  const [draftStage, setDraftStage] = useState<number | null>(null);   // null = 대기, n = DRAFT_GROUPS[n] 생성 중
  const draftTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const draftJustDone = useRef(false);
  useEffect(() => () => { draftTimers.current.forEach(clearTimeout); draftTimers.current = []; }, []);

  /** 초안 전체(MidspecSection[])를 미리 만들어 두고 그룹 순서대로 반영한다 (실 API: 단계별 결과 조회 4종) */
  const buildDraftSections = (): MidspecSection[] => {
    const specDrawings = (context?.drawings ?? []).filter(d => d.included !== false && d.useForSpec);
    const fallback = MOCK_MIDSPEC.find(s => s.key === 'drawing_descriptions')?.blocks ?? [];
    // 도 번호는 명세서 도면 채택 순서(1부터) · 같은 분류 연속은 묶음 설명 (API idxs 대응)
    const drawingBlocks = specDrawings.length ? buildDrawingDescBlocks(specDrawings) : fallback;
    return [
      ...MOCK_MIDSPEC
        .filter(s => s.key !== 'embodiment_description')
        .map(s => s.key === 'drawing_descriptions' ? { ...s, blocks: drawingBlocks } : s),
      { key: 'embodiment_description', label: '실시예 (구체적 내용)', blocks: MOCK_EMBODIMENT },
    ];
  };

  const startDraftGeneration = () => {
    if (draftGenerated || draftStage !== null) return;
    const sections = buildDraftSections();
    const textOf = (sid: SectionId) =>
      sections.find(s => s.key === sid)?.blocks.map(b => b.content).join('\n\n') ?? '';
    setDraftStage(0);
    DRAFT_GROUPS.forEach((group, i) => {
      draftTimers.current.push(setTimeout(() => {
        // 이 그룹의 섹션을 채우고, 다음 그룹으로 넘어간다
        setBlocks(prev => {
          const next = { ...prev };
          group.sections.forEach(sid => { const t = textOf(sid); if (t) next[sid] = toBlocks(t); });
          return next;
        });
        // 방금 채운 자리로 스크롤 — 순차로 작성되는 결과가 화면에 보이게 한다
        setTimeout(() => {
          centerRef.current
            ?.querySelector<HTMLElement>(`[data-section="${group.sections[0]}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
        const isLast = i === DRAFT_GROUPS.length - 1;
        setDraftStage(isLast ? null : i + 1);
        if (isLast) {
          draftTimers.current = [];
          draftJustDone.current = true;   // 다음 렌더에서 생성 결과를 저장한다
          onDraftGenerated?.(sections);
          toast('명세서 초안을 작성했습니다');
        }
      }, DRAFT_GROUP_MOCK_MS * (i + 1)));
    });
  };

  // 초안 생성으로 채운 본문 저장 — 편집 경로(updateBlock 등)를 거치지 않으므로 여기서 한 번 저장한다
  useEffect(() => {
    if (!draftJustDone.current || !task?.id) return;
    draftJustDone.current = false;
    saveSpecState(task.id, { editorBlocks: blocks as Record<string, string[]> });
  }, [blocks, task?.id]);

  // 편집 중인 블록 (textarea 활성화, 단일) — 진입 시에는 아무 단락도 편집 모드로 두지 않는다 (A1: 의도치 않은 덮어쓰기 방지)
  const [sel, setSel] = useState<{ sid: SectionId; idx: number } | null>(null);
  const [drawingRefMenuOpen, setDrawingRefMenuOpen] = useState(false); // 본문 툴바: 도면 참조 삽입 메뉴
  const blockTaRef = useRef<HTMLTextAreaElement | null>(null);          // 현재 편집 중인 본문 textarea
  const caretRef = useRef<{ sid: SectionId; idx: number; start: number; end: number } | null>(null); // 마지막 캐럿 위치
  // AI 컨텍스트용 다중 선택 — key: `${sid}-${idx}`
  const [selSet, setSelSet] = useState<Set<string>>(new Set());

  // 활성 섹션 탭
  const [activeSec, setActiveSec] = useState<SectionId>('technical_field');

  // ── 도면 선택 (어시스턴트 대상) ─────────────────────────────────────────
  // 도면을 골라 「도면의 간단한 설명」을 AI에 맡긴다. 바뀌는 건 설명 문장뿐이고 도면 이미지는 건드리지 않는다.
  // 한 번에 최대 20개 (2026-09-15 사용자 확정) — 초과하면 확인 모달로 알린다.
  const MAX_DRAWING_SEL = 20;
  const [selDrawings, setSelDrawings] = useState<Set<number>>(new Set());
  // 발명 정보 조회 패널 — 초안 생성 후에는 발명 정보 단계로 돌아갈 수 없으므로(2026-09-10 회의 1-5),
  // 화면 이동 없이 본문 왼쪽을 밀어내며 여는 조회 전용 패널로 확정 내용을 보여 준다.
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  // 패널 폭 — 기본은 에디터 영역의 1/3, 드래그로 조정하고 작업별로 기억한다
  const INFO_MIN_W = 240, INFO_MAX_W = 720;
  const infoRowRef = useRef<HTMLDivElement>(null);
  const [infoPanelW, setInfoPanelW] = useState<number | null>(() => {
    try { const v = localStorage.getItem('axp_infopanel_w'); return v ? Number(v) : null; } catch { return null }
  });
  const [infoResizing, setInfoResizing] = useState(false);
  const startInfoResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setInfoResizing(true);
    const left = infoRowRef.current?.getBoundingClientRect().left ?? 0;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(INFO_MAX_W, Math.max(INFO_MIN_W, ev.clientX - left));
      setInfoPanelW(w);
    };
    const onUp = () => {
      setInfoResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setInfoPanelW(w => { try { if (w != null) localStorage.setItem('axp_infopanel_w', String(w)); } catch { /* 저장 실패는 무시 */ } return w; });
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  // 패널에 띄우는 확정 내용 — 발명 정보 단계에서 확정한 값(InventionContext)을 그대로 읽는다
  const inventionInfoSections = useMemo(() => {
    const els = context?.elements ?? [];
    const specDrawings = (context?.drawings ?? []).filter(d => d.included !== false && d.useForSpec);
    const repIdx = specDrawings.findIndex(d => d.isRepresentative);
    const adopted = (arr?: { content: string; adopted?: boolean }[]) =>
      (arr ?? []).filter(i => i.adopted !== false).map(i => i.content);
    return [
      { label: '발명의 명칭', items: [confirmedTitle || ''].filter(Boolean) },
      { label: '요약', items: [(context?.summary ?? '').trim()].filter(Boolean) },
      { label: '구성요소', items: els.map(e => `${e.symbol ? `${e.symbol} · ` : ''}${e.value_ko}${e.description ? ` — ${e.description}` : ''}`) },
      { label: '명세서 도면', items: specDrawings.map((d, i) => `도 ${i + 1}${i === repIdx ? ' (대표도)' : ''}${d.detail.description ? ` — ${d.detail.description}` : ''}`) },
      { label: '청구범위', items: (confirmedClaimsText ?? '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean) },
      { label: '제안기술', items: adopted(context?.proposed) },
      { label: '종래기술', items: adopted(context?.previous) },
    ];
  }, [context, confirmedTitle, confirmedClaimsText]);

  // 모바일 AI 패널 오픈 상태
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);   // 데스크탑 패널 접기 (L3)

  // 채팅 UI — API SpecificationEditorChatMessage 정합(intent / edit_proposals / expression_replacements / plan)
  type ChatMsg = {
    id: number;
    role: 'user' | 'ai';
    text: string;
    intent?: AgentIntent;                                    // 라우팅된 의도 (answer/clarify/edit_body/edit_claims/edit_drawing_description/plan/replace_expression/terminate)
    refs?: { sid: SectionId; idx: number }[];                // 대상 단락
    proposals?: EditProposal[];                              // 블록 수정 제안 (action·diff·status)
    replacements?: ExpressionReplacement[];                  // 용어 교체 제안 (replace_expression)
    intentOptions?: string[];                                // clarify 선택지
    sourceMsg?: string;                                      // 재생성/플랜용 원본 지시
    plan?: { steps: PlanStepDef[]; current: number; status: 'running' | 'stopped' | 'done' };
  };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  // 요청 분석 진행 트리 (데모 SSE 진행 이벤트 정합) — null이면 대기 상태
  const [thinking, setThinking] = useState<{ steps: ProgressStep[]; done: number } | null>(null);
  const aiThinking = thinking !== null;
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 진행 트리를 단계별로 애니메이션한 뒤 결과를 push
  const runThinking = (steps: ProgressStep[], onDone: () => void) => {
    if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
    setThinking({ steps, done: 0 });
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    let d = 0;
    thinkingTimerRef.current = setInterval(() => {
      d++;
      if (d >= steps.length) {
        if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
        setThinking(null);
        onDone();
      } else {
        setThinking({ steps, done: d });
      }
    }, 450);
  };
  useEffect(() => () => { if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current); }, []);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);
  // 제안 확대 보기 모달
  const [zoomProposal, setZoomProposal] = useState<EditProposal | null>(null);

  useEffect(() => {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [chatInput]);

  // 도면 데이터 (drawing_descriptions 인라인 카드용)
  // 에디터가 다루는 도면 = **명세서 도면**(⑥에서 채택한 것)만. 설명 문장·도 번호·내보내기가 모두 이 기준이라
  // 카드 그리드·도면 참조 메뉴도 같은 목록을 써야 도 번호가 어긋나지 않는다. 참고용 이미지는 발명 정보 패널에서 본다.
  const drawings = (context?.drawings ?? []).filter(d => d.included !== false && d.useForSpec);
  // SpecView의 DRAWING_LABEL_MAP과 동일하게 유지 (같은 도면이 화면 이동 시 배지가 바뀌지 않도록)
  const DRAWING_LABEL_MAP: Record<string, string> = {
    proposed_implementation: '제안기술',
    previous_implementation: '종래기술',
    background:              '배경',
    effect:                  '효과',
    etc:                     '기타',
  };
  const DRAWING_LABEL_STYLES: Record<string, string> = {
    '제안기술': 'bg-brand-100 text-brand-400',
    '종래기술': 'bg-neutral-100 text-neutral-600',
    '배경':     'bg-neutral-100 text-neutral-600',
    '효과':     'bg-brand-50 text-brand-600',
    '기타':     'bg-neutral-100 text-neutral-500',
  };

  // 구성요소 이름 변경 모달
  const [renamingComp, setRenamingComp] = useState<{ name: string; draft: string } | null>(null);

  const renameComp = (oldName: string, newName: string) => {
    const next = newName.trim();
    if (!next || next === oldName) return;
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(prev => {
      // 위저드(renameElementEverywhere)와 같은 엔진 — 긴 이름 우선 매칭·부호 보존
      const allNames = (context?.elements ?? []).map(e => e.value_ko);
      const result = {} as Record<SectionId, string[]>;
      for (const sid of Object.keys(prev) as SectionId[]) {
        result[sid] = prev[sid].map(text => replaceElementName(text, oldName, next, allNames).text);
      }
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() =>
          saveSpecState(task.id, { editorBlocks: result as any }), 500
        );
      }
      return result;
    });
    onRenameElement?.(oldName, next);
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

  // 파생 섹션(명칭·부호의 설명·요약)은 원천이 바뀌면 따라 갱신한다.
  // 구성요소 부호를 고쳐도 「부호의 설명」이 진입 시점 값에 머물러 있던 문제 (2026-09-10 회의 액션 7).
  // 편집이 막힌 섹션이라 사용자 입력을 덮어쓸 여지가 없다.
  useEffect(() => {
    setBlocks(prev => {
      let changed = false;
      const next = { ...prev };
      for (const id of DERIVED_SECTIONS) {
        const want = toBlocks(getInitialContent(id, effectiveTitle));
        if ((prev[id] ?? []).join(' ') !== want.join(' ')) { next[id] = want; changed = true; }
      }
      if (!changed) return prev;
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: next as any }), 500);
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTitle, context]);

  // 도 N을 언급하는 설명 단락을 찾는다. 같은 분류가 연속된 도면은 한 단락으로 묶이므로
  // (buildDrawingDescBlocks) 도면 하나를 골라도 대상은 그 도면이 들어 있는 **단락 통째로**가 된다.
  // 블록 인덱스가 아니라 문장을 보고 찾기 때문에 사용자가 단락을 고치거나 추가해도 따라간다.
  const descBlockIdxsForFigure = (figNo: number): number[] => {
    const re = new RegExp(`도\\s*${figNo}(?!\\d)`);
    return (blocks['drawing_descriptions'] ?? [])
      .map((t, i) => (re.test(t) ? i : -1))
      .filter(i => i >= 0);
  };

  /** 도면 선택을 AI 대상(selSet)에 반영 — 선택된 도면들이 덮는 설명 단락으로 다시 계산한다 */
  const syncDrawingSelection = (nextDrawings: Set<number>) => {
    const covered = new Set<number>();
    nextDrawings.forEach(i => descBlockIdxsForFigure(i + 1).forEach(b => covered.add(b)));
    setSelSet(prev => new Set([
      ...[...prev].filter(k => !k.startsWith('drawing_descriptions-')),
      ...[...covered].map(b => `drawing_descriptions-${b}`),
    ]));
  };

  const toggleDrawingSel = (idx: number) => {
    const next = new Set(selDrawings);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      if (next.size >= MAX_DRAWING_SEL) {
        openAlertDialog(
          {
            title: '도면 선택 개수 초과',
            description: `도면은 한 번에 최대 ${MAX_DRAWING_SEL}개까지 선택할 수 있습니다.\n선택을 일부 해제한 뒤 다시 골라 주세요.`,
            confirm: '확인',
          },
          { theme: 'primary', onConfirm: (ctrl) => ctrl.close() },
        );
        return;
      }
      next.add(idx);
    }
    setSelDrawings(next);
    syncDrawingSelection(next);
  };

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
      else {   // REPLACE / REWRITE — 청구범위는 '청구항 N.' 헤더 유지(항 목록 파싱 규격)
        let t = p.target;
        if (sid === 'claims' && !isClaimBlock(t)) {
          const head = (arr[p.idx] ?? p.source ?? '').split('\n')[0];
          if (/^청구항\s*\d+\./.test(head)) t = `${head}\n${t.replace(/^청구항\s*\d+\.\s*/, '')}`;
        }
        arr[p.idx] = t;
      }
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
  // ── 선택 단락별 수정 제안 생성(edit_body / edit_claims / edit_drawing_description) ──
  const pushEditProposals = (instruction: string, refs: { sid: SectionId; idx: number }[]) => {
    const proposals = refs.map(r => buildProposal(
      r.sid, r.idx,
      EDITOR_SECTIONS.find(s => s.id === r.sid)?.label ?? r.sid,
      blocks[r.sid]?.[r.idx] || '', instruction,
    ));
    const intent = resolveEditIntent(refs.map(r => r.sid));
    pushAi({ text: `요청하신 내용을 반영하여 ${proposals.length}건의 수정을 제안합니다.`, intent, proposals, refs, sourceMsg: instruction });
  };

  // ── 제안별 보강 지시("대신 이렇게 해줘") — 해당 제안만 재생성 ────────────
  const refineProposal = (msgId: number, pi: number, refineInstr: string) => {
    setChatMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.proposals) return m;
      const proposals = m.proposals.map((p, i) => {
        if (i !== pi) return p;
        const original = blocks[p.sid as SectionId]?.[p.idx] ?? p.source;
        // 보강 지시를 우선 반영 (원 지시는 뒤에 유지) — mock 수정문구에 보강 내용이 드러나도록
        const combined = m.sourceMsg ? `${refineInstr} · ${m.sourceMsg}` : refineInstr;
        return { ...buildProposal(p.sid, p.idx, p.targetDesc.split(' ')[0].replace(/['"]/g, '') || p.sid, original, combined), targetDesc: p.targetDesc, status: 'pending' as const };
      });
      return { ...m, proposals };
    }));
    toast('보강 지시를 반영해 제안을 다시 생성했습니다');
  };

  // ── 용어 교체(replace_expression) 반영 — 문서 전체 치환 ──────────────────
  const applyReplacement = (msgId: number, ri: number) => {
    const m = chatMessages.find(x => x.id === msgId);
    const r = m?.replacements?.[ri];
    if (!r) return;
    setUndoStack(s => [...s.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(prev => {
      const updated = {} as Record<SectionId, string[]>;
      (Object.keys(prev) as SectionId[]).forEach(sid => {
        updated[sid] = prev[sid].map(b => b.split(r.source).join(r.target));
      });
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: updated as any }), 500);
      }
      return updated;
    });
    setChatMessages(prev => prev.map(x => x.id === msgId
      ? { ...x, replacements: x.replacements?.map((rr, i) => i === ri ? { ...rr, status: 'accepted' as const } : rr) }
      : x));
    toast('용어가 교체되었습니다');
  };
  const declineReplacement = (msgId: number, ri: number) => {
    setChatMessages(prev => prev.map(x => x.id === msgId
      ? { ...x, replacements: x.replacements?.map((rr, i) => i === ri ? { ...rr, status: 'declined' as const } : rr) }
      : x));
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
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      // Ctrl+F: 브라우저 찾기 대신 문서 찾기/바꾸기 바 (입력 중에도 동작)
      if (k === 'f' && !e.shiftKey && !e.altKey) { e.preventDefault(); setFindOpen(true); return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
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
    setSelDrawings(new Set());   // 단락을 직접 고르면 도면 선택은 해제 — 대상이 두 갈래로 갈리지 않게
  };

  // ── 단락 삭제 (확인 후) — 실행 취소 스택에 저장 ─────────────────────────
  const deleteBlock = (sid: SectionId, idx: number) => {
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const result = { ...p, [sid]: p[sid].filter((_, i) => i !== idx) };
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: result as any }), 500);
      }
      return result;
    });
    if (sel?.sid === sid && sel?.idx === idx) setSel(null);
    setSelSet(prev => { const n = new Set(prev); n.delete(`${sid}-${idx}`); return n; });
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
    // 체크 상태와 편집(포커스) 상태가 어긋나지 않게: 편집 중인 단락을 체크 해제하면 편집도 끝내고,
    // 다른 단락을 체크하면 이전 편집 상태를 닫는다 (해제 후에도 '선택된 것처럼' 남는 문제 방지)
    setSel(null);
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
      // 파생 섹션(명칭·부호의 설명·요약)은 어시스턴트 수정 대상에서 제외 (2026-09-10 회의 결정)
      if (DERIVED_SECTIONS.includes(sid)) return;
      if (blocks[sid]?.[idx] !== undefined) refs.push({ sid, idx });
    });

    setChatMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'user', text: msg }]);

    const route = routeIntent(msg, { hasSelection: refs.length > 0 });
    // 청구항 언급 시 — 청구항은 전용 에디터라 selSet 선택 없이도 '독립항→종속항' 파이프라인으로 처리(전체 세트 단위)
    const mentionsClaims = /청구항|독립항|종속항|claim/i.test(msg) || refs.some(r => r.sid === 'claims');
    // 진행 트리용 intent 확정 (edit → 대상 섹션으로 세분화)
    const progressIntent: RoutedIntent =
      route.intent === 'terminate' || route.intent === 'answer' ? route.intent
      : mentionsClaims && route.intent !== 'clarify' ? 'edit_claims'
      : route.intent === 'edit' ? resolveEditIntent(refs.map(r => r.sid))
      : route.intent;

    // 요청 분석 진행 트리 표출 후 결과 push (데모 SSE 정합)
    runThinking(progressStepsFor(progressIntent), () => {
      if (route.intent === 'terminate' || route.intent === 'answer') {
        pushAi({ text: route.answer ?? generateWholeDocReply(msg), intent: route.intent });
      } else if (route.intent === 'replace_expression') {
        const reps = buildExpressionReplacements(msg, Object.values(blocks).flat().join('\n'));
        if (reps.length) {
          pushAi({ text: `문서 전체에서 ${reps.length}건의 용어(표현) 교체를 제안합니다. 각 항목을 반영하거나 무시하세요.`, intent: 'replace_expression', replacements: reps, sourceMsg: msg });
        } else {
          pushAi({ text: '문서에서 교체가 필요한 용어를 찾지 못했습니다. "A를 B로 바꿔줘"처럼 구체적으로 지시하면 해당 표현을 일괄 교체합니다.', intent: 'answer' });
        }
      } else if (mentionsClaims && !refs.some(r => r.sid === 'claims')) {
        // 청구항 수정(항 미선택) — 개발노트: 독립항 → 종속항 순 고정 파이프라인 (전체 세트 단위)
        // 항을 체크한 경우는 아래 pushEditProposals로 떨어져 선택한 항에 직접 제안한다
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
    });
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

  // 단락 추가 행에서 부른 경우 — 그 섹션 맨 뒤에 넣는다 (툴바에서 부르면 선택 단락 뒤)
  const [addTargetSec, setAddTargetSec] = useState<SectionId | null>(null);

  /** 단락 추가 행의 3종 버튼 — 단락·표·수식을 그 섹션 맨 뒤에 추가한다 (데모 .para-add-row 정합) */
  const addBlockOfType = (sid: SectionId, type: 'text' | 'table' | 'equation') => {
    if (type === 'table') { setAddTargetSec(sid); setTableModal(true); return; }
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    const newIdx = blocks[sid].length;
    setBlocks(p => ({ ...p, [sid]: [...p[sid], ''] }));   // 빈 단락은 입력 시점에 저장
    // 수식은 빈 단락을 만든 뒤 그 자리에 넣는다 (insertFormula가 선택 단락에 쓰므로)
    setTimeout(() => { selectBlock(sid, newIdx); if (type === 'equation') setFormulaModal(true); }, 50);
  };

  // ── 표 삽입 ─────────────────────────────────────────────────────────────
  const insertTable = () => {
    const cols = 3;
    const header = Array(cols).fill('항목').map((_, i) => `항목 ${i + 1}`).join(' | ');
    const sep = Array(cols).fill('---').join(' | ');
    const row = Array(cols).fill('내용').join(' | ');
    const tbl = `${header}\n${sep}\n${Array(tableRows).fill(row).join('\n')}`;
    const sid = addTargetSec ?? sel?.sid ?? activeSec;
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const arr = [...p[sid]];
      const at = !addTargetSec && sel?.sid === sid ? sel.idx + 1 : arr.length;
      arr.splice(at, 0, tbl);
      const updated = { ...p, [sid]: arr };
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveSpecState(task.id, { editorBlocks: updated as any }), 500);
      }
      return updated;
    });
    setTableModal(false);
    setAddTargetSec(null);
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
    // 청구범위는 위저드 확정 텍스트의 요약 헤더('독립항 N개, …')를 제외하고 항만 출력
    content: (blocks[s.id] ?? []).filter(b => s.id !== 'claims' || isClaimBlock(b)).join('\n\n'),
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
        drawings={exportDrawings}
        onClose={() => setEditorPreviewOpen(false)}
      />
    )}

    {/* 수정 제안 확대 보기 — Before/After 전체 diff */}
    {zoomProposal && (
      <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-6" onClick={() => setZoomProposal(null)}>
        <div className="bg-white rounded-2xl shadow-card-deep max-w-3xl w-full max-h-[82vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 shrink-0">
            <span className={clsx('px-1.5 py-0.5 rounded-md text-xs2 font-bold',
              zoomProposal.action === 'DELETE' ? 'bg-red-100 text-red-600'
              : zoomProposal.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700'
              : zoomProposal.action === 'REWRITE' ? 'bg-neutral-100 text-neutral-700'
              : 'bg-brand-100 text-brand-700')}>
              {EDIT_ACTION_LABEL[zoomProposal.action]}
            </span>
            <span className="text-sm2 font-semibold text-neutral-700">{zoomProposal.targetDesc}</span>
            <button onClick={() => setZoomProposal(null)} className="ml-auto text-neutral-400 hover:text-neutral-600 text-sm px-1">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
            {zoomProposal.action !== 'INSERT' && zoomProposal.source && (
              <div>
                <p className="text-xs2 font-semibold text-neutral-400 mb-1">Before</p>
                <p className="text-sm2 leading-relaxed rounded-lg px-3 py-2 bg-red-50/60 text-neutral-700 whitespace-pre-wrap">
                  <DiffText segs={diffWords(zoomProposal.source, zoomProposal.target).before} mode="before" />
                </p>
              </div>
            )}
            {zoomProposal.action !== 'DELETE' && (
              <div>
                <p className="text-xs2 font-semibold text-neutral-400 mb-1">After</p>
                <p className="text-sm2 leading-relaxed rounded-lg px-3 py-2 bg-emerald-50/60 text-neutral-700 whitespace-pre-wrap">
                  <DiffText segs={diffWords(zoomProposal.source, zoomProposal.target).after} mode="after" />
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* 구성요소 이름 일괄 변경 모달 */}
    {renamingComp && (
      <div
        className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
        onClick={() => setRenamingComp(null)}
      >
        <div data-spec="SPC-EDT-086"
          className="bg-white rounded-2xl shadow-card-deep w-80 p-5"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-base2 font-bold text-neutral-800 mb-1">구성요소 이름 전체 변경</p>
          <p className="text-xs2 text-neutral-500 mb-3 leading-relaxed">
            <span className="font-semibold text-neutral-700">"{renamingComp.name}"</span>{' '}
            → 본문·청구범위·부호의 설명과 발명 정보(구성요소·청구항)의 모든 언급이 한 번에 바뀝니다. 부호는 유지됩니다.
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
      <div data-spec="SPC-EDT-060" className="flex items-center border-b border-neutral-200 bg-white shrink-0 h-10 pl-2">
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={undo} disabled={!undoStack.length} data-spec="SPC-EDT-061" title="실행 취소 (Ctrl+Z)"
            className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 disabled:opacity-30 transition-colors text-neutral-500 text-xs2">
            <UndoIcon /><span className="max-xl:hidden">실행 취소</span>
          </button>
          <button onClick={redo} disabled={!redoStack.length} title="다시 실행 (Ctrl+Y)"
            className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 disabled:opacity-30 transition-colors text-neutral-500 text-xs2">
            <RedoIcon /><span className="max-xl:hidden">다시 실행</span>
          </button>
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          {ENABLE_TABLE_INSERT && (
            <button onClick={() => setTableModal(true)} disabled={!sel} data-spec="SPC-EDT-066" title="표 삽입"
              className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 disabled:opacity-30 transition-colors text-neutral-500 text-xs2">
              <TableIcon /><span>표</span>
            </button>
          )}
          <button onClick={() => setFormulaModal(true)} disabled={!sel} data-spec="SPC-EDT-062" title="수식 입력 — 단락을 클릭(편집)한 뒤 삽입"
            className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 disabled:opacity-30 transition-colors text-neutral-500 text-xs2">
            <span className="font-serif text-base2 leading-none">∑</span><span>수식</span>
          </button>
          {/* 도면 참조 삽입 — 선택한 본문 블록의 커서 위치에 '(도 N 참조)' 삽입 (이번 버전 제외, ENABLE_DRAWING_REF) */}
          {ENABLE_DRAWING_REF && (
          <div className="relative">
            <button onClick={() => setDrawingRefMenuOpen(o => !o)} disabled={!sel || drawings.length === 0}
              title={drawings.length === 0 ? '채택된 도면이 없습니다' : "선택한 단락의 커서 위치에 '(도 N 참조)' 문구를 넣습니다 — 실시예 본문이 어느 도면을 설명하는지 표시"}
              className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 disabled:opacity-30 transition-colors text-neutral-500 text-xs2">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2.5 11l3.5-3 2.5 2 3-3.5 2 2"/></svg>
              <span>도면 참조</span><span className="text-xs2 leading-none">▾</span>
            </button>
            {drawingRefMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDrawingRefMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-60 max-h-64 overflow-y-auto scroll-thin rounded-lg border border-neutral-200 bg-white shadow-lg py-1">
                  {drawings.map((d, i) => {
                    const figNo = String(d.detail.symbol).replace(/\D/g, '') || String(i + 1);
                    return (
                      <button key={i} onClick={() => insertDrawingRef(figNo)}
                        className="w-full text-left px-3 py-1.5 text-xs2 hover:bg-brand-50 flex items-center gap-2 transition-colors">
                        <span className="font-bold text-neutral-700 shrink-0">도 {figNo}</span>
                        <span className="text-neutral-500 truncate">{d.detail.name || '제목 없음'}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          )}
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          <button onClick={() => setFindOpen(o => !o)} data-spec="SPC-EDT-063" title="찾기/바꾸기 (Ctrl+F)"
            className={clsx('flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md transition-colors text-xs2', findOpen ? 'bg-brand-50 text-brand-700' : 'hover:bg-neutral-100 text-neutral-500')}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
            <span className="max-xl:hidden">찾기</span>
          </button>
        </div>
        {/* 출력 그룹 — 편집 도구와 분리해 우측 정렬 (미리보기 · DOCX · PDF) */}
        <div className="ml-auto flex items-center gap-0.5 pr-2 shrink-0">
          <button onClick={() => setEditorPreviewOpen(true)} data-spec="SPC-EDT-064" title="미리보기"
            className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 transition-colors text-neutral-500 text-xs2">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
            <span className="max-xl:hidden">미리보기</span>
          </button>
          <button onClick={() => exportDocx(task?.name ?? '명세서', editorPreviewSections, exportDrawings)} data-spec="SPC-EDT-065" title="DOCX 내보내기 (도면 포함)"
            className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 transition-colors text-neutral-600 text-xs2 font-medium">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/><path d="M5 9h6M5 11h4"/></svg>
            <span className="max-xl:hidden">DOCX</span>
          </button>
          <button onClick={() => exportPdf(task?.name ?? '명세서', editorPreviewSections, exportDrawings)} data-spec="SPC-EDT-065" title="PDF 내보내기 (도면 포함, 인쇄)"
            className="flex items-center gap-1 px-2 h-7 whitespace-nowrap shrink-0 rounded-md hover:bg-neutral-100 transition-colors text-neutral-600 text-xs2 font-medium">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/><path d="M5.5 9.5h5M5.5 11.5h3"/></svg>
            <span className="max-xl:hidden">PDF</span>
          </button>
        </div>
      </div>

      {/* 찾기/바꾸기 바 (문서 통계 포함) */}
      {findOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <input
            value={findText}
            onChange={e => setFindText(e.target.value)}
            placeholder="찾기"
            className="w-40 text-xs2 px-2 py-1 border border-neutral-200 rounded-md bg-white outline-none focus:border-brand-400"
          />
          <span className="text-xs2 text-neutral-400 w-10 shrink-0">{findText ? `${matchCount}건` : ''}</span>
          <input
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            placeholder="바꿀 내용"
            className="w-40 text-xs2 px-2 py-1 border border-neutral-200 rounded-md bg-white outline-none focus:border-brand-400"
          />
          <button
            onClick={replaceAll}
            disabled={!findText || matchCount === 0}
            className="text-xs2 font-semibold px-2.5 py-1 rounded-lg bg-brand-400 text-white hover:bg-brand-500 disabled:opacity-40 transition-colors"
          >전체 바꾸기</button>
          <span className="ml-auto text-xs2 text-neutral-400">{totalBlocks}단락 · {totalChars.toLocaleString()}자</span>
          <button onClick={() => setFindOpen(false)} className="text-neutral-400 hover:text-neutral-600 text-xs2 px-1" title="닫기">✕</button>
        </div>
      )}

      {/* 서브헤더 Row 2: 내비게이션 — [← 발명 정보] + 섹션 탭 (툴바는 편집 도구만, 이동은 이 줄에) */}
      <div data-spec="SPC-EDT-070" className="flex items-stretch border-b border-neutral-200 bg-white shrink-0">
        <div className="flex items-center pl-3 pr-2 shrink-0 border-r border-neutral-200 my-1.5">
          {/* 초안 생성 전에는 단계로 돌아가 고칠 수 있고, 생성 후에는 조회 패널만 연다 (회의 1-5) */}
          {draftGenerated ? (
            <button
              onClick={() => setInfoPanelOpen(o => !o)}
              data-spec="SPC-EDT-077"
              aria-pressed={infoPanelOpen}
              title="확정한 발명 정보를 옆에 펼쳐 봅니다 (조회 전용) — 초안을 만든 뒤에는 단계로 돌아갈 수 없습니다"
              className={clsx(
                'inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-xs2 font-semibold whitespace-nowrap transition-colors',
                infoPanelOpen ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-brand-300 text-brand-600 hover:bg-brand-50',
              )}>
              {infoPanelOpen ? '◧ 발명 정보 닫기' : '◧ 발명 정보'}
            </button>
          ) : (
            <button onClick={onBack} data-spec="SPC-EDT-071" title="발명 정보 단계로 돌아갑니다 — 편집 내용은 저장됩니다"
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-brand-300 text-brand-600 text-xs2 font-semibold whitespace-nowrap hover:bg-brand-50 transition-colors">
              ← 발명 정보
            </button>
          )}
        </div>
      <div className="flex flex-1 min-w-0 overflow-x-auto scroll-thin [mask-image:linear-gradient(to_right,transparent_0,black_8px,black_calc(100%-32px),transparent_100%)]">
        {EDITOR_SECTIONS.map(s => (
          <button key={s.id} data-spec="SPC-EDT-072" onClick={() => goToSection(s.id)}
            className={clsx(
              'px-3 py-2 text-xs2 whitespace-nowrap border-b-2 transition-colors shrink-0',
              activeSec === s.id
                ? 'border-brand-400 text-brand-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            )}>
            {s.short}
          </button>
        ))}
      </div>
      </div>

      {/* 서브헤더 Row 3: 초안 생성 — 위저드의 중간명세서 단계를 대신한다. 1회만 실행 가능 */}
      {!draftGenerated && (
        <div data-spec="SPC-EDT-075" className="flex items-center gap-3 px-4 py-2.5 border-b border-brand-200 bg-brand-50 shrink-0">
          {draftStage === null ? (
            <>
              <div className="min-w-0">
                <p className="text-sm2 font-semibold text-neutral-800">명세서 초안이 아직 작성되지 않았습니다</p>
                <p className="text-xs2 text-neutral-500 mt-0.5">
                  확정한 구성요소·도면·청구항을 바탕으로 도면의 간단한 설명부터 실시예까지 작성합니다. <b className="text-neutral-700">작성은 한 번만 가능</b>하며, 이후 수정은 에디터에서 진행합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={startDraftGeneration}
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white bg-brand-400 hover:bg-brand-500 transition-colors"
              >초안 생성</button>
            </>
          ) : (
            /* 작성 순서대로 항목을 늘어놓고 완료 / 작성 중 / 대기를 함께 보여 준다 */
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="shrink-0 w-4 h-4 border-2 border-brand-300 border-t-brand-500 rounded-full animate-spin" aria-hidden="true" />
                <p className="text-sm2 font-semibold text-neutral-800" role="status" aria-live="polite">
                  명세서 초안을 작성하고 있습니다 — {DRAFT_GROUPS[draftStage].label}
                </p>
                <span className="ml-auto shrink-0 text-xs2 text-neutral-500 tabular-nums">{draftStage + 1} / {DRAFT_GROUPS.length}</span>
              </div>
              <ol className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {DRAFT_GROUPS.map((g, i) => {
                  const doneG = i < draftStage;
                  const active = i === draftStage;
                  return (
                    <li key={g.label} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-neutral-300" aria-hidden="true">›</span>}
                      <span className={clsx(
                        'inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs2 border transition-colors',
                        doneG && 'border-green-200 bg-green-50 text-green-700',
                        active && 'border-brand-300 bg-white text-brand-600 font-semibold',
                        !doneG && !active && 'border-neutral-200 bg-white/60 text-neutral-400',
                      )}>
                        {doneG && <Icon name="check" size={9} />}
                        {g.label}
                        {active && <span className="text-neutral-400 font-normal">작성 중…</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {/* 진행 바 — 완료된 그룹까지 채운다 */}
              <div className="mt-1.5 h-1.5 rounded-full bg-white overflow-hidden border border-brand-200">
                <div
                  className="h-full bg-brand-400 transition-[width] duration-500"
                  style={{ width: `${(draftStage / DRAFT_GROUPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 본문 행 — 발명 정보 패널이 열리면 본문을 오른쪽으로 밀어낸다. 기본 1/3, 경계 드래그로 조정 */}
      <div ref={infoRowRef} className="flex-1 flex overflow-hidden min-h-0">
      {infoPanelOpen && (
        <aside data-spec="SPC-EDT-078"
          style={infoPanelW != null ? { width: infoPanelW } : undefined}
          className={clsx(
            'shrink-0 border-r border-neutral-200 bg-white flex flex-col overflow-hidden',
            infoPanelW == null && 'w-1/3 min-w-[260px]',
          )}>
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-neutral-200 bg-neutral-50 shrink-0">
            <span className="text-sm2 font-semibold text-neutral-800">발명 정보</span>
            <span className="text-xs2 text-neutral-400">조회 전용</span>
            <button onClick={() => setInfoPanelOpen(false)} title="닫기"
              className="ml-auto w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-3.5 space-y-3.5">
            {inventionInfoSections.map(sec => (
              <div key={sec.label}>
                <p className="text-xs2 font-semibold text-neutral-400 mb-1">{sec.label}</p>
                {sec.items.length ? (
                  <ul className="space-y-1">
                    {sec.items.map((it, i) => (
                      <li key={i} className="text-sm2 text-neutral-700 leading-relaxed rounded-md border border-neutral-200 bg-neutral-50/60 px-2.5 py-1.5 whitespace-pre-wrap">{it}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs2 text-neutral-300 px-2.5 py-1.5">—</p>
                )}
              </div>
            ))}
            <p className="text-xs2 text-neutral-400 pt-1 border-t border-neutral-100">
              초안을 만든 뒤에는 발명 정보를 고칠 수 없습니다. 본문 수정은 에디터에서 진행하세요.
            </p>
          </div>
        </aside>
      )}
      {/* 폭 조절 손잡이 — 드래그로 패널과 본문의 경계를 옮긴다 (더블클릭하면 기본 1/3로) */}
      {infoPanelOpen && (
        <div
          data-spec="SPC-EDT-0781"
          role="separator"
          aria-orientation="vertical"
          aria-label="발명 정보 패널 폭 조절"
          title="드래그해 폭을 조절합니다 (더블클릭: 기본 폭)"
          onMouseDown={startInfoResize}
          onDoubleClick={() => { setInfoPanelW(null); try { localStorage.removeItem('axp_infopanel_w'); } catch { /* 무시 */ } }}
          className={clsx(
            'w-1.5 shrink-0 cursor-col-resize border-r border-neutral-200 transition-colors',
            infoResizing ? 'bg-brand-400' : 'bg-neutral-100 hover:bg-brand-300',
          )}
        />
      )}

      {/* 본문 — 전체 명세서 스크롤. 초안 생성 중에는 편집을 막는다 */}
      <div
          ref={centerRef}
          aria-busy={draftStage !== null}
          className={clsx(
            'flex-1 overflow-y-auto scroll-thin bg-neutral-50',
            draftStage !== null && 'opacity-50 pointer-events-none select-none',
          )}
          onClick={e => { if (e.target === e.currentTarget) setSel(null); }}
          onScroll={() => {
            if (!centerRef.current) return;
            const st = centerRef.current.scrollTop;
            for (const sec of [...EDITOR_SECTIONS].reverse()) {
              const el = centerRef.current.querySelector<HTMLElement>(`[data-section="${sec.id}"]`);
              if (el && el.offsetTop <= st + 100) { setActiveSec(sec.id); break; }
            }
          }}
        >
          {/* 문서 틀 — 회색 배경 위에 종이 한 장(노션 스타일, 데모 #ed-doc 정합).
              블록이 배경에 흩어져 보이지 않게 흰 카드 안쪽에 넣고 행간을 넓게 준다. */}
          <div data-spec="SPC-EDT-105" className="max-w-[820px] mx-auto my-6 bg-white border border-neutral-200 rounded-xl px-11 py-9 leading-[1.8]">
            {/* 문서 제목 — 확정한 발명의 명칭 */}
            <div className="text-[17px] font-extrabold text-neutral-900 border-b-2 border-brand-400 pb-2.5 mb-4 leading-snug">
              {effectiveTitle || '특허 명세서'}
            </div>
            {/* 섹션별 단락 */}
            {EDITOR_SECTIONS.map(sec => (
              <div key={sec.id} data-section={sec.id} data-spec="SPC-EDT-080" className="mb-6">
                {/* 섹션 제목 — 특허 명세서 표기대로 【 】로 감싼다 (데모·미리보기·DOCX 내보내기와 같은 형식) */}
                <h2 className="text-sm2 font-bold text-neutral-800 mt-6 mb-2.5 flex items-center gap-2 leading-normal">
                  【{sec.label}】
                  {DERIVED_SECTIONS.includes(sec.id) && (
                    <span data-spec="SPC-EDT-079" className="text-xs2 font-medium text-neutral-400 border border-neutral-200 rounded-md px-1.5 py-0.5"
                      title={DERIVED_SECTION_SOURCE[sec.id]}>
                      앞 단계 확정값 · 편집 불가
                    </span>
                  )}
                  {/* 도면 선택 카운터 — 상한이 있다는 걸 미리 알 수 있게 항상 띄운다 */}
                  {sec.id === 'drawing_descriptions' && drawings.length > 0 && (
                    <span data-spec="SPC-EDT-104"
                      title={`한 번에 최대 ${MAX_DRAWING_SEL}개까지 선택할 수 있습니다`}
                      className={clsx(
                        'ml-auto text-xs2 font-medium rounded-md px-1.5 py-0.5 border tabular-nums',
                        selDrawings.size >= MAX_DRAWING_SEL
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : selDrawings.size > 0
                            ? 'border-brand-200 bg-brand-50 text-brand-600'
                            : 'border-neutral-200 text-neutral-400',
                      )}>
                      선택된 도면 {selDrawings.size}개 / {MAX_DRAWING_SEL}개
                    </span>
                  )}
                </h2>

                {/* 도면의 간단한 설명 섹션 — 도면 인라인 카드 */}
                {sec.id === 'drawing_descriptions' && drawings.length > 0 && (
                  <div className="mb-6">
                    {/* 선택 시 안내 — 바뀌는 건 설명 문장뿐이라는 것을 분명히 한다 */}
                    {selDrawings.size > 0 && (
                      <div data-spec="SPC-EDT-103" className="mb-3 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                        <span className="text-brand-500 shrink-0 mt-px" aria-hidden="true">ⓘ</span>
                        <p className="text-xs2 text-neutral-700 leading-relaxed">
                          선택한 도면의 <b className="text-neutral-900">간단한 설명(문장)만</b> 바뀝니다. <b className="text-neutral-900">도면 이미지는 수정되지 않습니다</b> —
                          도면 자체를 고치려면 카드의 <b className="text-neutral-900">도면 편집기 ↗</b>를 여세요.
                          <br />
                          같은 분류가 연속된 도면은 설명이 한 문장으로 묶여 있어, 함께 묶인 도면의 설명도 같이 바뀔 수 있습니다.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {drawings.map((d, idx) => {
                        const labelKo = DRAWING_LABEL_MAP[d.detail.label] ?? 'AI생성';
                        const picked = selDrawings.has(idx);
                        return (
                          <div key={idx}
                            data-spec="SPC-EDT-102"
                            onClick={() => toggleDrawingSel(idx)}
                            title={picked ? '선택 해제' : '이 도면의 간단한 설명을 AI 수정 대상으로 선택'}
                            className={clsx(
                              'relative rounded-xl border overflow-hidden bg-white shadow-sm cursor-pointer transition-all',
                              picked ? 'border-brand-500 ring-2 ring-brand-200' : 'border-neutral-200 hover:border-brand-300',
                            )}>
                            {/* 선택 체크박스 */}
                            <div
                              onClick={e => { e.stopPropagation(); toggleDrawingSel(idx); }}
                              className={clsx(
                                'absolute left-2 top-2 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                                picked ? 'bg-brand-400 border-brand-400 text-white' : 'border-neutral-400 bg-white/90 hover:border-brand-400',
                              )}
                              role="checkbox" aria-checked={picked} aria-label={`도 ${idx + 1} 선택`}
                            >
                              {picked && <Icon name="check" size={10} />}
                            </div>
                            {/* 이미지 영역 */}
                            <div className="relative aspect-[4/3] bg-neutral-100 border-b border-neutral-200 flex flex-col items-center justify-center gap-1 overflow-hidden">
                              {d.image.file.data ? (
                                <img src={`data:${d.image.file.media_type};base64,${d.image.file.data}`} className="w-full h-full object-contain" alt={d.detail.name} />
                              ) : (
                                <>
                                  <svg viewBox="0 0 120 90" width="80" height="60" className="text-neutral-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="4" y="4" width="112" height="82" rx="4" strokeDasharray="6 3"/>
                                    <rect x="16" y="14" width="36" height="28" rx="3" fill="currentColor" fillOpacity=".08"/>
                                    <rect x="68" y="14" width="36" height="28" rx="3" fill="currentColor" fillOpacity=".08"/>
                                    <rect x="42" y="52" width="36" height="24" rx="3" fill="currentColor" fillOpacity=".12"/>
                                    <line x1="34" y1="28" x2="68" y2="28" strokeDasharray="3 2"/>
                                    <line x1="60" y1="42" x2="60" y2="52" strokeDasharray="3 2"/>
                                    <polyline points="100,28 110,28 110,64 78,64" strokeDasharray="3 2"/>
                                  </svg>
                                  <span className="text-xs2 font-semibold text-neutral-400">{d.detail.symbol}</span>
                                </>
                              )}
                            </div>
                            {/* 캡션 */}
                            <div className="px-3 pt-2 pb-1.5">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs2 font-bold text-neutral-700" title={`원본 기호: ${d.detail.symbol}`}>도 {idx + 1}</span>
                                <span className={clsx('text-xs2 px-1.5 py-px rounded-sm font-medium', DRAWING_LABEL_STYLES[labelKo] ?? 'bg-neutral-100 text-neutral-500')}>{labelKo}</span>
                              </div>
                              <p className="text-xs2 text-neutral-600 leading-snug">{d.detail.name}</p>
                              {d.cadConverted && (
                                <span className="mt-1 inline-flex items-center gap-1 text-xs2 px-1.5 py-px rounded-full bg-green-50 text-green-700 font-medium" title="도면 편집기에서 CAD 변환 결과를 반영했습니다">
                                  <Icon name="check" size={9} /> CAD 변환 완료
                                </span>
                              )}
                            </div>
                            {/* 도면 수정모드(새 탭) — 참조 삽입은 본문 툴바의 '도면 참조'로 이동 */}
                            <div className="border-t border-neutral-100 px-3 py-1.5 flex items-center justify-end">
                              <button
                                onClick={e => { e.stopPropagation(); openEditorTab({ taskId: task?.id, drawingId: String(idx), drawings: drawings.map(toWorkflowDrawingItem), components: [], references: [], drawingName: d.detail.name, timestamp: Date.now() }); }}
                                data-spec="SPC-EDT-100" title="도면 편집기를 새 탭에서 엽니다 (범위 조정·CAD 변환)"
                                className="inline-flex items-center gap-0.5 h-7 px-2 rounded-md text-xs2 font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors shrink-0"
                              >도면 편집기 <span className="text-xs2">↗</span></button>
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
                    elements={context?.elements ?? []}
                    selSet={selSet}
                    onToggleSel={(idx, e) => toggleSelSet('claims', idx, e)}
                    onClickElement={(name) => setRenamingComp({ name, draft: name })}
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
                    const locked = DERIVED_SECTIONS.includes(sec.id);
                    const isEditing = !locked && sel?.sid === sec.id && sel?.idx === blockIdx;
                    const isChecked = selSet.has(`${sec.id}-${blockIdx}`);
                    return (
                      <div
                        key={blockIdx}
                        data-spec="SPC-EDT-082" onClick={() => { if (!locked && !isEditing) selectBlock(sec.id, blockIdx); }}
                        title={locked ? DERIVED_SECTION_SOURCE[sec.id] : undefined}
                        className={clsx(
                          'group relative pr-9 py-2 my-1 transition-colors rounded-lg border text-[13.5px]',
                          locked ? 'pl-3 border-neutral-200 bg-neutral-50 cursor-default' : 'pl-7',
                          !locked && (isEditing
                            ? 'border-brand-400 bg-brand-50/40 cursor-text'
                            : isChecked
                              ? 'border-brand-500 bg-brand-50 cursor-pointer'
                              : blockText.trim()
                                ? 'border-neutral-200 bg-white hover:bg-neutral-50 cursor-pointer'
                                : 'border-dashed border-neutral-200 bg-white hover:bg-neutral-50 cursor-pointer'),
                        )}
                      >
                        {/* 체크박스 — 상시 표시 (다중 선택용), 선택 시 강조. 파생 섹션은 AI 수정 대상에서 제외 */}
                        {!locked && (
                        <div
                          onClick={e => toggleSelSet(sec.id, blockIdx, e)}
                          data-spec="SPC-EDT-081" title="여러 단락을 한번에 AI 수정하려면 체크하세요"
                          className={clsx(
                            'absolute left-2 top-2.5 w-3.5 h-3.5 rounded border-[1.5px] flex items-center justify-center transition-all cursor-pointer shrink-0',
                            isChecked
                              ? 'bg-brand-400 border-brand-400 text-white'
                              : 'border-neutral-300 bg-white group-hover:border-brand-400'
                          )}
                        >
                          {isChecked && <Icon name="check" size={8} />}
                        </div>
                        )}
                        {/* 단락 이동 (위/아래) */}
                        {!locked && blocks[sec.id].length > 1 && (
                          <div className="absolute top-1.5 right-7 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={e => { e.stopPropagation(); moveBlock(sec.id, blockIdx, -1); }}
                              disabled={blockIdx === 0}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-all"
                              data-spec="SPC-EDT-083" title="위로 이동"
                            ><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 7l3-4 3 4"/></svg></button>
                            <button
                              onClick={e => { e.stopPropagation(); moveBlock(sec.id, blockIdx, 1); }}
                              disabled={blockIdx === blocks[sec.id].length - 1}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-brand-500 hover:bg-brand-50 disabled:opacity-20 transition-all"
                              title="아래로 이동"
                            ><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="11" height="11"><path d="M2 3l3 4 3-4"/></svg></button>
                          </div>
                        )}
                        {/* 단락 삭제 버튼 */}
                        {!locked && blocks[sec.id].length > 1 && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const preview = blockText.trim().slice(0, 40);
                              openAlertDialog(
                                { title: '단락 삭제', description: preview ? `"${preview}${blockText.trim().length > 40 ? '…' : ''}" 단락을 삭제할까요? (실행 취소로 되돌릴 수 있습니다)` : '빈 단락을 삭제할까요?', confirm: '삭제', cancel: '취소' },
                                { theme: 'danger', onConfirm: (ctrl) => { ctrl.close(); deleteBlock(sec.id, blockIdx); } },
                              );
                            }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            data-spec="SPC-EDT-084" title="단락 삭제"
                          >
                            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="10" height="10">
                              <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                            </svg>
                          </button>
                        )}
                        {isEditing ? (
                          <>
                          <textarea
                            className="w-full text-[13.5px] text-neutral-800 bg-transparent outline-none border-0 resize-none leading-[1.8] overflow-hidden py-0 px-0"
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
                          {/* 편집 모드 안내 — 구성요소 이름이 들어 있는 단락에서만: 여기서 고치면 이 자리만 바뀜을 알린다 */}
                          {(context?.elements ?? []).some(el => el.value_ko && blockText.includes(el.value_ko)) && (
                            <p className="mx-3 mb-1.5 text-xs2 text-neutral-400">
                              구성요소 이름은 여기서 고쳐도 이 단락에만 반영됩니다. 명세서 전체에서 바꾸려면 편집을 끝낸 뒤 <span className="text-brand-600 font-medium border-b border-dashed border-brand-400">점선 밑줄 이름</span>을 클릭하세요.
                            </p>
                          )}
                          </>
                        ) : isMarkdownTable(blockText) ? (
                          <div className="overflow-x-auto"><MarkdownTable text={blockText} /></div>
                        ) : blockText.includes('$') ? (
                          <p className="text-[13.5px] leading-[1.8] text-neutral-800"
                            dangerouslySetInnerHTML={{ __html: renderBlockWithTeX(blockText) }} />
                        ) : (
                          <p className={clsx(
                            'text-[13.5px] leading-[1.8] whitespace-pre-wrap',
                            blockText.trim() ? 'text-neutral-800' : 'text-neutral-400 italic'
                          )}>
                            {blockText.trim()
                              ? <ElementText text={blockText} elements={context?.elements ?? []} onClickElement={(name) => setRenamingComp({ name, draft: name })} />
                              : '단락 내용을 입력하세요...'}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* 단락 추가 행 — 가운데 정렬 점선 (데모 .para-add-row 정합).
                      파생 섹션은 구성이 원천에서 정해지므로 제외. 표·수식은 본문 툴바에서 넣는다 */}
                  {!DERIVED_SECTIONS.includes(sec.id) && (
                  <div data-spec="SPC-EDT-085" className="flex justify-center gap-6 border border-dashed border-neutral-200 rounded-lg py-1.5 mt-1.5 mb-0.5">
                    <button onClick={() => addBlockOfType(sec.id, 'text')}
                      className="text-xs2 text-neutral-400 hover:text-brand-500 px-1.5 py-0.5 transition-colors">
                      T&nbsp; 단락 추가
                    </button>
                    {ENABLE_TABLE_INSERT && (
                      <button onClick={() => addBlockOfType(sec.id, 'table')}
                        className="text-xs2 text-neutral-400 hover:text-brand-500 px-1.5 py-0.5 transition-colors">
                        ⊞&nbsp; 표 추가
                      </button>
                    )}
                    <button onClick={() => addBlockOfType(sec.id, 'equation')}
                      className="text-xs2 text-neutral-400 hover:text-brand-500 px-1.5 py-0.5 transition-colors">
                      ∑&nbsp; 수식 추가
                    </button>
                  </div>
                  )}
                </div>
                )}
              </div>
            ))}

            {/* 본문 마지막의 초안 생성 — 상단 띠와 같은 동작. 안내 문구를 다 읽고 내려온 자리에서도 바로 누를 수 있게 한다 (2026-09-11 사용자 결정) */}
            {!draftGenerated && draftStage === null && (
              <div data-spec="SPC-EDT-076" className="mt-2 mb-6 rounded-xl border border-brand-200 bg-brand-50 px-5 py-5 text-center">
                <p className="text-sm2 font-semibold text-neutral-800">명세서 초안이 아직 작성되지 않았습니다</p>
                <p className="text-xs2 text-neutral-500 mt-1">
                  확정한 구성요소·도면·청구항을 바탕으로 도면의 간단한 설명부터 실시예까지 작성합니다. <b className="text-neutral-700">작성은 한 번만 가능</b>합니다.
                </p>
                <button
                  type="button"
                  onClick={startDraftGeneration}
                  className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white bg-brand-400 hover:bg-brand-500 transition-colors"
                >초안 생성</button>
              </div>
            )}
          </div>
        </div>
      </div>{/* 본문 행 끝 (발명 정보 패널 + 본문) */}

      </div>{/* 좌측 에디터 컬럼 끝 */}

      {/* 우측 AI 어시스턴트 패널 */}
      {mobileAiOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileAiOpen(false)}
          />
        )}
        {/* 접힌 상태 레일 (데스크탑) — 클릭하면 패널 복원 (L3) */}
        {!aiPanelOpen && (
          <button
            type="button"
            onClick={() => setAiPanelOpen(true)}
            title="AI 어시스턴트 열기"
            className="hidden md:flex w-9 shrink-0 border-l border-neutral-200 bg-neutral-50 hover:bg-brand-50 flex-col items-center gap-1.5 pt-3 text-neutral-400 hover:text-brand-500 transition-colors"
          >
            <span className="w-5 h-5 rounded-md bg-brand-400 text-white flex items-center justify-center"><svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9" aria-hidden="true"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg></span>
            <span className="text-xs2 font-semibold [writing-mode:vertical-rl]">AI 어시스턴트</span>
          </button>
        )}
        <aside data-spec="SPC-EDT-010" className={clsx(
          'bg-white flex-col overflow-hidden',
          aiPanelOpen ? 'md:flex' : 'md:hidden',
          'md:relative md:shrink-0 md:border-l md:border-neutral-200',
          'md:w-[clamp(280px,28vw,360px)] md:min-w-[280px]',
          'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50',
          'max-md:h-[72vh] max-md:rounded-t-2xl max-md:shadow-2xl',
          'max-md:border-t max-md:border-neutral-200',
          'max-md:transition-transform max-md:duration-300 max-md:ease-out',
          mobileAiOpen ? 'max-md:flex max-md:translate-y-0' : 'max-md:hidden',
        )}>
          {/* 모바일 핸들 */}
          <div className="md:hidden shrink-0 pt-2 pb-1 px-4 flex items-center justify-between relative">
            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 bg-neutral-300 rounded-full" />
            <button
              onClick={() => setMobileAiOpen(false)}
              className="ml-auto w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          {/* 헤더 (48px) */}
          <div className="max-md:hidden md:flex shrink-0 items-center gap-2 px-4 border-b border-neutral-200 bg-neutral-50" style={{ height: 48 }}>
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 bg-brand-400"><svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10" aria-hidden="true"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg></div>
            <span className="text-base2 font-bold text-neutral-800">AI 어시스턴트</span>
            <span className="text-xs2 text-neutral-400 font-medium">본문 수정</span>
            <button type="button" onClick={() => setAiPanelOpen(false)} title="패널 접기"
              className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="11" height="11"><path d="M4 2l4 4-4 4"/></svg>
            </button>
          </div>

          {/* ── 상단: 정보 영역(선택 단락) — 하단 대화 영역과 영역 제목 바로 구분 ── */}
          <div data-spec="SPC-EDT-011" className="shrink-0 flex items-center gap-1.5 px-4 py-1 bg-neutral-50 border-b border-neutral-200">
            <Icon name="check" size={11} className="text-neutral-400" />
            <span className="text-xs2 font-semibold text-neutral-500 tracking-wide">선택 단락</span>
            <span className="ml-auto text-xs2 text-neutral-400">{selSet.size > 0 ? `${selSet.size}개 선택` : '미선택 · 전체 문서 대상'}</span>
          </div>
          {/* 선택된 블록 컨텍스트 */}
          <div className="shrink-0 flex flex-col bg-white">
            {selSet.size === 1 ? (() => {
              const key = [...selSet][0];
              const dashIdx = key.indexOf('-');
              const sid = key.slice(0, dashIdx) as SectionId;
              const idx = parseInt(key.slice(dashIdx + 1));
              const secLabel = EDITOR_SECTIONS.find(s => s.id === sid)?.short ?? sid;
              return (
                <>
                  <div className="flex items-center justify-between px-3 pt-2 pb-1.5 shrink-0 border-b border-neutral-100">
                    <span className="text-xs2 font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">
                      선택 중 · {secLabel} {idx + 1}
                    </span>
                    <button onClick={() => { setSelSet(new Set()); setSelDrawings(new Set()); }} className="text-xs2 text-neutral-400 hover:text-neutral-600 transition-colors">
                      선택 해제
                    </button>
                  </div>
                  {/* 선택 단락 미리보기(읽기 전용) — 패널에서는 본문을 편집하지 않는다. 본문 편집은 중앙 단락을 클릭해서. (A1) */}
                  <div className="max-h-[40vh] overflow-y-auto scroll-thin px-4 py-2.5">
                    <p className="text-sm2 text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {(blocks[sid]?.[idx] || '').trim() || <span className="text-neutral-400 italic">(빈 단락)</span>}
                    </p>
                    <p className="mt-2 text-xs2 text-neutral-400">아래 입력창에 이 단락에 대한 <b className="text-neutral-500">수정 명령</b>을 입력하세요. 본문을 직접 고치려면 중앙의 단락을 클릭합니다.</p>
                  </div>
                </>
              );
            })() : selSet.size > 1 ? (
              <>
                <div className="flex items-center justify-between px-3 pt-2 pb-1.5 shrink-0">
                  <span className="text-xs2 font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">
                    편집 명령 대상 · {selSet.size}개
                  </span>
                  <button onClick={() => { setSelSet(new Set()); setSelDrawings(new Set()); }} className="text-xs2 text-neutral-400 hover:text-neutral-600 transition-colors">
                    선택 해제
                  </button>
                </div>
                <div className="max-h-[40vh] overflow-y-auto scroll-thin px-3 pb-2 space-y-1.5">
                  {Array.from(selSet).map(key => {
                    const dashIdx = key.indexOf('-');
                    const sid = key.slice(0, dashIdx) as SectionId;
                    const idx = parseInt(key.slice(dashIdx + 1));
                    const text = blocks[sid]?.[idx] || '';
                    const secLabel = EDITOR_SECTIONS.find(s => s.id === sid)?.short ?? sid;
                    return (
                      <div key={key} className="bg-white rounded-md border border-brand-100 px-2.5 py-1.5">
                        <span className="text-xs2 font-semibold text-brand-500 mr-1.5">{secLabel} · {idx + 1}</span>
                        <p className="text-xs2 text-neutral-700 leading-relaxed mt-0.5 whitespace-pre-wrap">
                          {text || <span className="text-neutral-400 italic">빈 단락</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs2 text-neutral-400 text-center py-2.5 px-3 leading-relaxed">
                중앙에서 단락을 선택하면 여기에 표시됩니다.<br /><span className="text-neutral-500 font-medium">선택 없이 명령하면 전체 문서를 대상으로 합니다.</span>
              </p>
            )}
          </div>

          {/* ── 하단: 대화 영역 — 영역 제목 바 ── */}
          <div className="shrink-0 flex items-center gap-1.5 px-4 py-1 bg-neutral-50 border-y border-neutral-200">
            <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11" className="text-neutral-400" aria-hidden="true"><path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/></svg>
            <span className="text-xs2 font-semibold text-neutral-500 tracking-wide">대화 · 본문 수정</span>
            <span className="ml-auto text-xs2 text-neutral-400">수정 명령 입력</span>
          </div>
          {/* 대화 메시지 (스크롤 영역) */}
          <div className="flex-1 overflow-y-auto scroll-thin">

            {/* ── AI 채팅 메시지 ── */}
            <div className="px-3 py-2 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="py-1">
                    <p className="text-xs2 text-neutral-400 mb-2">{selSet.size > 0 ? '선택한 단락에 이렇게 명령할 수 있습니다' : '단락을 선택하거나 전체 문서에 명령하세요'}</p>
                    <div className="flex flex-col gap-1.5">
                      {(selSet.size > 0
                        ? ['더 간결하게 다듬어줘', '특허 문체로 바꿔줘', '구성요소의 결합 관계를 더 구체적으로 써줘']
                        : ['전체 문서를 검토해줘', '"본원 발명"을 "본 발명"으로 통일해줘', '청구항 1을 더 넓게 써줘']
                      ).map(q => (
                        <button key={q} type="button" onClick={() => sendChat(q)} disabled={planRunning || aiThinking}
                          className="text-left text-sm2 text-neutral-600 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors disabled:opacity-40">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((m) => (
                  <div key={m.id} className={clsx('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {m.role === 'ai' && (
                      <div className="w-6 h-6 rounded-full bg-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs2 font-bold text-white">AI</span>
                      </div>
                    )}
                    {m.role === 'user' ? (
                      <div className="rounded-xl px-3 py-2 text-xs2 leading-relaxed max-w-[85%] bg-brand-400 text-white">
                        {m.text}
                      </div>
                    ) : (
                      <div data-spec="SPC-EDT-030" className="rounded-xl text-xs2 leading-relaxed max-w-[88%] bg-neutral-100 text-neutral-800 overflow-hidden">
                        {/* 의도 배지 */}
                        {m.intent && (
                          <div className="px-3 pt-2">
                            <span className={clsx('inline-block px-1.5 py-0.5 rounded-md text-xs2 font-semibold',
                              m.intent.startsWith('edit') ? 'bg-brand-100 text-brand-700'
                              : m.intent === 'plan' ? 'bg-brand-50 text-brand-600'
                              : m.intent === 'clarify' ? 'bg-amber-100 text-amber-700'
                              : m.intent === 'replace_expression' ? 'bg-brand-50 text-brand-600'
                              : m.intent === 'terminate' ? 'bg-neutral-200 text-neutral-500'
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
                                className="px-2.5 py-1 text-xs2 border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50 hover:border-brand-400 transition-colors">
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* 플랜 진행 (PlanProgress: Step X of Y · Continue/Stop) */}
                        {m.plan && (
                          <div data-spec="SPC-EDT-040" className="mx-2.5 mb-2.5 rounded-lg bg-white border border-brand-200 p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs2 font-semibold text-brand-600">
                                플랜 · {Math.min(m.plan.current + (m.plan.status === 'done' ? 0 : 1), m.plan.steps.length)} / {m.plan.steps.length} 단계
                              </span>
                              <span className="text-xs2 text-neutral-400">{m.plan.status === 'running' ? '진행 중' : m.plan.status === 'stopped' ? '중단됨' : '완료'}</span>
                            </div>
                            <ol className="space-y-0.5 mb-2">
                              {m.plan.steps.map((st, si) => (
                                <li key={si} className={clsx('flex items-start gap-1.5 text-xs2',
                                  si < m.plan!.current ? 'text-neutral-400 line-through'
                                  : si === m.plan!.current && m.plan!.status === 'running' ? 'text-neutral-800 font-semibold'
                                  : 'text-neutral-500')}>
                                  <span className="shrink-0">{si < m.plan!.current ? '✓' : `${si + 1}.`}</span>
                                  <span>{st.title}</span>
                                </li>
                              ))}
                            </ol>
                            {m.plan.status === 'running' && (
                              <div className="flex gap-1.5">
                                <button onClick={() => advancePlan(m.id)} className="flex-1 py-1.5 text-xs2 font-semibold bg-brand-400 text-white rounded-lg hover:bg-brand-500">▶ {m.plan.current + 1}단계 진행</button>
                                <button onClick={() => stopPlan(m.id)} className="px-3 py-1.5 text-xs2 font-semibold text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">■ 중단</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 수정 제안 카드 (블록 단위 · 단어 diff · 확대 · Accept/Decline · 보강 지시) */}
                        {m.proposals && m.proposals.length > 0 && (
                          <>
                            <div className="mx-2.5 mb-2 space-y-1.5">
                              {m.proposals.map((p, pi) => (
                                <ProposalCard
                                  key={pi}
                                  p={p}
                                  onAccept={() => acceptProposal(m.id, pi)}
                                  onDecline={() => declineProposal(m.id, pi)}
                                  onRefine={instr => refineProposal(m.id, pi, instr)}
                                  onZoom={() => setZoomProposal(p)}
                                />
                              ))}
                            </div>
                            <div className="px-2.5 pb-2.5">
                              <button onClick={() => regenerate(m)} className="text-xs2 font-semibold text-neutral-500 hover:text-brand-600">↻ 다시 생성</button>
                            </div>
                          </>
                        )}

                        {/* 용어(표현) 교체 제안 — API ExpressionReplacement 정합 */}
                        {m.replacements && m.replacements.length > 0 && (
                          <div className="mx-2.5 mb-2.5 space-y-1.5">
                            {m.replacements.map((r, ri) => (
                              <div key={ri} className="rounded-lg bg-white border border-neutral-200 px-2.5 py-2 flex items-center gap-2">
                                <span className="text-xs2 bg-red-50 text-red-600 line-through rounded-md px-1.5 py-0.5 shrink-0 max-w-[38%] truncate" title={r.source}>{r.source}</span>
                                <span className="text-neutral-400 text-xs2 shrink-0">→</span>
                                <span className="text-xs2 bg-emerald-50 text-emerald-700 rounded-md px-1.5 py-0.5 shrink-0 max-w-[38%] truncate" title={r.target}>{r.target}</span>
                                <div className="ml-auto flex gap-1 shrink-0">
                                  {r.status === 'pending' ? (
                                    <>
                                      <button onClick={() => applyReplacement(m.id, ri)} className="px-2 py-0.5 text-xs2 font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700">반영</button>
                                      <button onClick={() => declineReplacement(m.id, ri)} className="px-2 py-0.5 text-xs2 font-semibold text-neutral-500 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50">무시</button>
                                    </>
                                  ) : (
                                    <span className={clsx('text-xs2 font-semibold', r.status === 'accepted' ? 'text-emerald-600' : 'text-neutral-400')}>
                                      {r.status === 'accepted' ? '✓ 적용됨' : '✕ 취소됨'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {thinking && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-6 h-6 rounded-full bg-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs2 font-bold text-white">AI</span>
                    </div>
                    <div className="max-w-[88%] flex-1">
                      <ThinkingProgress steps={thinking.steps} done={thinking.done} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
          </div>

          {/* 하단 채팅 입력창 */}
          <div data-spec="SPC-EDT-050" className="border-t border-neutral-200 px-3 py-2.5 shrink-0 bg-white">
            {planRunning && (
              <div className="mb-2 text-xs2 text-brand-600 bg-brand-50 border border-brand-200 rounded-md px-2 py-1">
                플랜 진행 중입니다 — 단계를 진행하거나 중단한 뒤 입력할 수 있습니다.
              </div>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                ref={chatTextareaRef}
                className="flex-1 px-3 py-2"
                placeholder={planRunning ? '플랜 진행 중 — 입력 잠금' : aiThinking ? '요청 분석 중...' : selSet.size > 0 ? `선택한 ${selSet.size}개 단락에 대해 명령하세요...` : "명령을 입력하세요... (Enter 전송)"}
                value={chatInput}
                rows={2}
                disabled={planRunning || aiThinking}
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
                disabled={!chatInput.trim() || planRunning || aiThinking}
                className="shrink-0 w-8 h-8 rounded-xl bg-brand-400 hover:bg-brand-500 text-white disabled:bg-transparent disabled:text-neutral-300 flex items-center justify-center transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                  <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z" fill="currentColor" stroke="none"/>
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
          'w-12 h-12 rounded-full bg-brand-400 hover:bg-brand-500 active:scale-95',
          'shadow-lg flex items-center justify-center transition-all',
          mobileAiOpen && 'hidden',
        )}
        data-spec="SPC-EDT-110" title="AI 어시스턴트 열기"
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
            <h3 className="text-base2 font-bold text-neutral-800 mb-4">표 삽입</h3>
            <div>
              <label className="text-xs2 font-semibold text-neutral-600 mb-1 block">행 수</label>
              <Input type="number" min={1} max={10} value={tableRows}
                onChange={e => setTableRows(Number(e.target.value))}
                className="py-1.5" />
            </div>
            <p className="text-xs2 text-neutral-400 mt-2">열 수: 3 (고정)</p>
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
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
                <h3 className="text-base2 font-bold text-neutral-800">수식 입력 (TeX / LaTeX)</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs2 text-neutral-400">모드:</span>
                  <button onClick={() => setFormulaMode('inline')}
                    className={clsx('px-2 py-1 rounded-md text-xs2',
                      formulaMode === 'inline' ? 'bg-brand-100 text-brand-700 font-semibold' : 'bg-neutral-100 text-neutral-500')}>
                    인라인 ($...$)
                  </button>
                  <button onClick={() => setFormulaMode('block')}
                    className={clsx('px-2 py-1 rounded-md text-xs2',
                      formulaMode === 'block' ? 'bg-brand-100 text-brand-700 font-semibold' : 'bg-neutral-100 text-neutral-500')}>
                    블록 ($$...$$)
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* TeX 입력란 */}
                <div>
                  <label className="block text-xs2 font-semibold text-neutral-600 mb-1">TeX 수식</label>
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
                  <label className="block text-xs2 font-semibold text-neutral-600 mb-1">미리보기</label>
                  <div className={clsx(
                    'min-h-[60px] rounded-lg border px-4 py-3 flex items-center',
                    formulaMode === 'block' ? 'justify-center' : 'justify-start',
                    preview?.error ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-neutral-50'
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
                      <span className="text-neutral-400 text-xs2">수식을 입력하면 여기에 표시됩니다</span>
                    )}
                  </div>
                </div>

                {/* 자주 쓰는 TeX 템플릿 */}
                <div>
                  <label className="block text-xs2 font-semibold text-neutral-600 mb-1.5">자주 쓰는 TeX</label>
                  <div className="flex flex-wrap gap-1">
                    {FORMULA_TEMPLATES.map(t => (
                      <button key={t.label}
                        onClick={() => setFormulaVal(v => v ? v + ' ' + t.tex : t.tex)}
                        title={t.title}
                        className="px-2 py-1 border border-neutral-200 rounded-md text-xs2 font-mono hover:bg-neutral-100 hover:border-neutral-400 transition-colors">
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
