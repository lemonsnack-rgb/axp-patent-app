// src/features/spec/types.ts

export type SpecStepId =
  'upload' | 'title' | 'description' | 'components' | 'drawings' | 'claims';
export type SpecPhase = 'upload' | 'direct' | 'flow' | 'done';

// ── 청구항 타입 ──────────────────────────────────────────────────────────────
export type ClaimCategory = 'process' | 'machine' | 'manufacture' | 'composition';
export type AbstractionLevel = 'broad' | 'intermediate' | 'specific'; // 내부값 — UI 직접 노출 금지

export interface Claim {
  category: ClaimCategory;
  value: string;
}

export interface IndependentClaimSet {
  id: string;
  abstraction_level: AbstractionLevel;
  claims: Claim[]; // 2~3개, 기본: machine + process 쌍
}

// ── 기타 타입 ────────────────────────────────────────────────────────────────
export interface SpecComponentItem {
  id: number;
  text: string;
  sel: boolean;
  num: string;
  depth: number;
  englishName?: string;
  definition?: string;
  parent?: string;
}

export interface SpecDrawingItem {
  id: string;
  symbol: number;
  label: '제안기술' | '종래기술' | 'AI생성';
  name: string;
  description: string;
  applied: boolean;
  pageNumber: number;
  stage: 'extracted' | 'bbox-adjusted' | 'converting' | 'candidate-select' | 'editing' | 'done';
  bbox: { x: number; y: number; w: number; h: number };
  originalImageUrl: string;
  exportedImageUrl?: string;
  savedEditorJson?: string;
  drawingDescription?: string;
  isRepresentative?: boolean;
}

export interface SpecClaimsState {
  phase: 'indep' | 'dep';
  claimSets: IndependentClaimSet[];
  selectedSetId: string | null;
  depGroups: Record<string, {
    generated: boolean;
    newText: string;
    items: Array<{ id: number; text: string; sel: boolean }>;
  }>;
}

export interface SpecDescTexts {
  tech?: string;
  bg?: string;
  problem?: string;
  effect?: string;
}

export interface SpecAnalysisState {
  taskId: string;
  phase: SpecPhase;
  curStep: SpecStepId;
  confirmed: Partial<Record<SpecStepId, string>>;
  gSel: Partial<Record<SpecStepId, string>>;
  diTitle: string;
  diField: string;
  diContent: string;
  diProblem: string;
  diKeywords: string;
  uploadedFileName?: string;
  titleCandidates: string[];
  componentItems: SpecComponentItem[];
  drawings: SpecDrawingItem[];
  claimsState?: SpecClaimsState;
  descTexts?: SpecDescTexts;
  mainView: 'analysis' | 'editor';
  editorBlocks?: Record<string, string[]>;
}

export type SpecAnalysisPatch = Partial<SpecAnalysisState>;

export interface InventionInput {
  title: string;
  field: string;
  content: string;
  problem?: string;
  keywords?: string;
}

export interface SpecAnalysisResult {
  title: string;
  tech: string;
  bg: string;
  problem: string;
  effect: string;
  drawDesc: string;
  detail: string;
  claims: string;
  drawings: SpecDrawingItem[];
  componentItems: SpecComponentItem[];
}
