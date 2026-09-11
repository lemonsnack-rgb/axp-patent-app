// src/features/spec/specStore.ts
import { uid } from '../../utils/uid';
import type { SpecAnalysisState, SpecAnalysisPatch, InventionDescriptionItem, SpecificationBlock } from './types';

const KEY = (taskId: string) => `axp_spec_v3_${taskId}`;

// 구(text) 필드로 저장된 상태를 API 정합 형태(id/type/content)로 마이그레이션
type LegacyRecord = Record<string, unknown>;

function normalizeDescItem(raw: unknown): InventionDescriptionItem {
  const item = (raw ?? {}) as LegacyRecord;
  return {
    id: (item.id as string) ?? uid(),
    label: (item.label as InventionDescriptionItem['label']) ?? 'implementation',
    type: (item.type as InventionDescriptionItem['type']) ?? 'text',
    content: (item.content as string) ?? (item.text as string) ?? '',
    caption: (item.caption as string | null) ?? null,
    adopted: item.adopted as boolean | undefined,
  };
}
function normalizeBlock(raw: unknown): SpecificationBlock {
  const b = (raw ?? {}) as LegacyRecord;
  return {
    id: (b.id as string) ?? uid(),
    type: (b.type as SpecificationBlock['type']) ?? 'text',
    content: (b.content as string) ?? (b.text as string) ?? '',
  };
}
// 위저드에서 '중간명세서'(midspec) 단계를 없애기 전에 저장된 상태를 옮긴다 (2026-09-10 회의 결정).
//
// 구 흐름은 ⑦ 청구항을 확정하는 순간 중간명세서를 미리 만들어 ⑧ 단계에 띄웠고, 거기서 「명세서 생성」을
// 눌러야 실시예가 붙어 에디터로 넘어갔다. 새 흐름에서는 그 두 가지가 에디터의 「초안 생성」 하나로 합쳐졌고,
// **에디터 본문은 오직 초안 생성으로만 채워진다.** 따라서 초안 생성을 끝내지 않은 상태로 남아 있는
// 중간명세서는 "미리 만들어져 있던 것"일 뿐이므로 버린다 — 그대로 두면 초안 생성 버튼과 이미 채워진 본문이
// 동시에 보여 앞뒤가 맞지 않는다.
function migrateMidspecStep(s: SpecAnalysisState): SpecAnalysisState {
  const confirmed = (s.confirmed ?? {}) as Record<string, string>;
  const gSel = (s.gSel ?? {}) as Record<string, string>;
  const onMidspecStep = (s.curStep as string) === 'midspec';
  const midspecConfirmed = 'midspec' in confirmed;      // 구 「명세서 생성」까지 마침 = 초안 완성
  const staleMidspec = !midspecConfirmed && !s.draftGenerated && !!s.midspec?.length;
  if (!midspecConfirmed && !onMidspecStep && !('midspec' in gSel) && !staleMidspec) return s;

  delete confirmed.midspec;
  delete gSel.midspec;
  const wizardDone = midspecConfirmed || !!confirmed.claims;   // ⑦ 청구항까지 확정 = 위저드 종료
  return {
    ...s,
    confirmed, gSel,
    curStep: onMidspecStep ? 'claims' : s.curStep,
    // 초안 미완성 상태로 남은 중간명세서는 버린다 — 에디터에서 「초안 생성」으로 다시 만든다
    ...(staleMidspec ? { midspec: undefined } : {}),
    ...(midspecConfirmed ? { draftGenerated: true } : {}),
    ...(wizardDone ? { mainView: 'editor' as const, phase: 'done' as const } : {}),
  };
}

function normalizeState(raw: unknown): SpecAnalysisState {
  const s = migrateMidspecStep(raw as SpecAnalysisState) as SpecAnalysisState & { context?: LegacyRecord; midspec?: unknown[] };
  if (s?.context) {
    const ctx = s.context as LegacyRecord;
    ctx.previous = ((ctx.previous as unknown[]) ?? []).map(normalizeDescItem);
    ctx.proposed = ((ctx.proposed as unknown[]) ?? []).map(normalizeDescItem);
    ctx.elements = ((ctx.elements as unknown[]) ?? []).map(el => ({ ...(el as LegacyRecord), id: ((el as LegacyRecord).id as string) ?? uid() }));
  }
  if (Array.isArray(s?.midspec)) {
    s.midspec = (s.midspec as unknown[]).map(sec => {
      const sc = sec as LegacyRecord;
      return { ...sc, blocks: ((sc.blocks as unknown[]) ?? []).map(normalizeBlock) };
    }) as SpecAnalysisState['midspec'];
  }
  return s as SpecAnalysisState;
}

export function loadSpecState(taskId: string): SpecAnalysisState | null {
  try {
    const raw = localStorage.getItem(KEY(taskId));
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch { return null }
}

export function saveSpecState(taskId: string, patch: SpecAnalysisPatch): void {
  try {
    const existing = loadSpecState(taskId) ?? getDefaultSpecState(taskId);
    localStorage.setItem(KEY(taskId), JSON.stringify({ ...existing, ...patch }));
  } catch {}
}

export function clearSpecState(taskId: string): void {
  localStorage.removeItem(KEY(taskId));
}

export function getDefaultSpecState(taskId: string): SpecAnalysisState {
  return {
    taskId,
    phase: 'upload',
    curStep: 'upload',
    confirmed: {},
    gSel: {},
    diTitle: '', diField: '', diContent: '', diProblem: '', diKeywords: '',
    context: {
      title: '',
      summary: '',
      elements: [],
      previous: [],
      proposed: [],
      drawings: [],
    },
    titleCandidates: [],
    mainView: 'analysis',
  };
}
