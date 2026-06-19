// src/features/spec/specStore.ts
import type { SpecAnalysisState, SpecAnalysisPatch } from './types';

const KEY = (taskId: string) => `axp_spec_v3_${taskId}`;

export function loadSpecState(taskId: string): SpecAnalysisState | null {
  try {
    const raw = localStorage.getItem(KEY(taskId));
    return raw ? (JSON.parse(raw) as SpecAnalysisState) : null;
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
