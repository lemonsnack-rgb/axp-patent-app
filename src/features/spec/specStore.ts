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
function normalizeState(raw: unknown): SpecAnalysisState {
  const s = raw as SpecAnalysisState & { context?: LegacyRecord; midspec?: unknown[] };
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
