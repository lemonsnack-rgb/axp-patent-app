// src/features/spec/types.ts

export type SpecStepId =
  'upload' | 'title' | 'description' | 'components' | 'drawings' | 'claims' | 'abstract';
export type SpecPhase = 'upload' | 'direct' | 'flow' | 'done';

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
  indepCands: Array<{
    id: number; label: string; text: string; selected: boolean;
  }>;
  depGroups: Record<number, {
    generated: boolean;
    newText: string;
    items: Array<{ id: number; text: string; sel: boolean }>;
  }>;
}

export interface SpecDescTexts {
  tech?: string;
  bg?: string;
  problem?: string;
  solution?: string;
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
  abstractCandidates: string[];
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
  solution: string;
  effect: string;
  drawDesc: string;
  detail: string;
  claims: string;
  abstract: string;
  drawings: SpecDrawingItem[];
  componentItems: SpecComponentItem[];
}
