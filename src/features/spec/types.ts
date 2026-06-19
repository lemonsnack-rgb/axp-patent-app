// src/features/spec/types.ts

export type SpecStepId =
  'upload' | 'description' | 'title' | 'components' | 'drawings' | 'claims' | 'midspec';
export type SpecPhase = 'upload' | 'direct' | 'flow' | 'done';

// ── 핵심 데이터 구조 (API InventionContext V2) ────────────────────────────────

export interface InventionContext {
  title: string
  summary: string
  elements: InventionElement[]
  previous: InventionDescriptionItem[]
  proposed: InventionDescriptionItem[]
  drawings: Drawing[]
}

export interface InventionElement {
  symbol: string        // 도면 기호 번호 (예: "100")
  value_ko: string      // 한국어 명칭
  value_en: string      // 영어 명칭
  description: string
  hypernym_ko: string   // 상위 개념어 (한국어)
  hypernym_en: string   // 상위 개념어 (영어)
}

export interface InventionDescriptionItem {
  label: 'background' | 'implementation' | 'objective' | 'effect'
  text: string
  adopted?: boolean
}

// ── 청구항 타입 (API v0.2.0) ────────────────────────────────────────────────

export type ClaimCategory = 'MACHINE' | 'PROCESS' | 'MANUFACTURE' | 'COMPOSITION'
export type AbstractionLevel = 'BROAD' | 'INTERMEDIATE' | 'NARROW'

export interface IndependentClaimSet {
  abstraction_level: AbstractionLevel
  claims: Array<{
    value: string
    category: ClaimCategory
    element_idxs: number[]
  }>
}

export interface DepClaimItem {
  id: number
  no: number
  value: string
  depends_on: number
  element_idxs: number[]
  sel: boolean
}

export interface SpecClaimsState {
  phase: 'indep' | 'dep'
  claimSets: IndependentClaimSet[]
  selectedSetIndex: number | null
  depGroups: Record<number, {
    generated: boolean
    newText: string
    items: DepClaimItem[]
  }>
}

// ── 제목 후보 ────────────────────────────────────────────────────────────────

export interface TitleCandidate {
  id: string
  title: string
  summary: string
  reason: string
  sel: boolean
}

// ── 구성요소 (InventionElement 확장) ────────────────────────────────────────

export interface SpecComponentItem extends InventionElement {
  id: number
  depth: number
  sel: boolean
}

// ── 도면 타입 (API Drawing 구조) ────────────────────────────────────────────

export interface BBox {
  x1: number; y1: number; x2: number; y2: number
}

export interface ImageFile {
  data: string
  media_type: string
}

export interface Drawing {
  image: {
    file: ImageFile
    bbox?: BBox
  }
  detail: {
    symbol: string
    name: string
    description: string
    label: 'background' | 'previous_implementation' | 'proposed_implementation' | 'effect'
  }
  included?: boolean
  useForSpec?: boolean
  isRepresentative?: boolean
}

// ── 명세서 타입 ──────────────────────────────────────────────────────────────

export interface SpecificationBlock {
  text: string
}

export interface DrawingDescription {
  symbols: string[]
  description: SpecificationBlock
}

export interface ClaimItem {
  no: number
  value: string
}

export interface DependentClaimItem extends ClaimItem {
  depends_on: number
  element_idxs: number[]
}

export interface ClaimSet {
  independent_claim: ClaimItem
  dependent_claims: DependentClaimItem[]
}

export interface InventionSpecification {
  technical_field: SpecificationBlock[]
  background_art: SpecificationBlock[]
  technical_problem: SpecificationBlock[]
  technical_solution: SpecificationBlock[]
  advantageous_effects: SpecificationBlock[]
  embodiment_description: SpecificationBlock[]
  claims: ClaimSet[]
  drawing_descriptions: DrawingDescription[]
}

// ── 중간명세서 ───────────────────────────────────────────────────────────────

export interface MidspecSection {
  key: keyof InventionSpecification
  label: string
  blocks: SpecificationBlock[]
}

// ── 단계 설정 ────────────────────────────────────────────────────────────────

export interface StepConfig {
  id: SpecStepId
  label: string
  step: number
}

// ── 전체 분석 상태 ───────────────────────────────────────────────────────────

export interface SpecAnalysisState {
  taskId: string
  phase: SpecPhase
  curStep: SpecStepId
  confirmed: Partial<Record<SpecStepId, string>>
  gSel: Partial<Record<SpecStepId, string>>
  diTitle: string
  diField: string
  diContent: string
  diProblem: string
  diKeywords: string
  context: InventionContext
  uploadedFileName?: string
  titleCandidates: TitleCandidate[]
  claimsState?: SpecClaimsState
  midspec?: MidspecSection[]
  mainView: 'analysis' | 'editor'
  editorBlocks?: Record<string, string[]>
}

export type SpecAnalysisPatch = Partial<SpecAnalysisState>

export interface InventionInput {
  title: string
  field: string
  content: string
  problem?: string
  keywords?: string
}
