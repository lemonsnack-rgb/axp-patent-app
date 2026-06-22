// src/features/spec/mockAiService.ts
import type {
  InventionInput,
  InventionContext,
  InventionElement,
  InventionDescriptionItem,
  SpecComponentItem,
  Drawing,
  TitleCandidate,
  IndependentClaimSet,
  DepClaimItem,
  MidspecSection,
} from './types';

// ── 제목 후보 mock ────────────────────────────────────────────────────────────

export const MOCK_ABSTRACTS = [
  {
    title: '병렬 분산 처리 기반의 고속 데이터 처리 시스템 및 방법',
    summary: '복수의 처리 모듈을 이용한 병렬 처리 방식으로 데이터 처리 속도를 향상시키는 시스템에 관한 것이다.',
    reason: '기술적 특징(병렬 처리)과 효과(고속)를 명확히 드러내어 청구항과 연결성이 높음',
  },
  {
    title: '데이터 처리 효율화를 위한 분산 처리 장치',
    summary: '처리 모듈의 병렬 동작으로 오류율을 줄이고 처리 속도를 개선한 장치에 관한 발명이다.',
    reason: '장치 청구항에 적합한 간결한 표현. 효과(오류율 감소)를 포함',
  },
  {
    title: '멀티 프로세싱 아키텍처를 활용한 실시간 데이터 처리 시스템, 방법 및 컴퓨터 프로그램',
    summary: '실시간 데이터를 복수의 처리 모듈이 분산 처리하며 결과를 통합하는 시스템으로, 처리 속도 300% 향상 효과를 제공한다.',
    reason: '시스템·방법·프로그램 3종 청구항 대응. 구체적 수치(300%)로 심사 유리',
  },
]

export function generateTitleCandidates(_input: InventionInput): TitleCandidate[] {
  return MOCK_ABSTRACTS.map((a, i) => ({
    id: `t${i + 1}`,
    title: a.title,
    summary: a.summary,
    reason: a.reason,
    sel: false,
  }))
}

// ── 발명 설명 mock ────────────────────────────────────────────────────────────

export const MOCK_PREVIOUS: InventionDescriptionItem[] = [
  { label: 'background',     text: '기존 시스템은 단일 프로세서 기반의 직렬 처리 방식으로 처리 속도가 느리고 오류율이 높은 문제가 있었다.' },
  { label: 'implementation', text: '종래 기술은 하나의 중앙 처리 장치가 모든 데이터를 순차적으로 처리하는 구조를 사용하였다.' },
]

export const MOCK_PROPOSED: InventionDescriptionItem[] = [
  { label: 'objective',      text: '본 발명은 병렬 처리 방식을 도입하여 처리 속도를 획기적으로 향상시키는 것을 목적으로 한다.' },
  { label: 'implementation', text: '복수의 처리 모듈이 데이터를 분산 처리하고, 결과를 통합하는 구조를 채택한다.' },
  { label: 'effect',         text: '처리 속도 300% 향상 및 오류율 90% 감소 효과를 달성한다.' },
]

// ── 구성요소 mock ─────────────────────────────────────────────────────────────

export const MOCK_ELEMENTS: InventionElement[] = [
  { symbol: '100', value_ko: '데이터 수집부',  value_en: 'Data Collector',    description: '외부 장치로부터 원시 데이터를 수집하는 모듈', hypernym_ko: '수집 장치', hypernym_en: 'Collecting Device' },
  { symbol: '200', value_ko: '전처리부',       value_en: 'Preprocessor',       description: '수집된 데이터를 정규화·필터링하는 모듈',         hypernym_ko: '처리 장치', hypernym_en: 'Processing Device' },
  { symbol: '300', value_ko: '병렬 처리부',    value_en: 'Parallel Processor', description: '복수의 스레드로 데이터를 동시에 처리하는 모듈',   hypernym_ko: '처리 장치', hypernym_en: 'Processing Device' },
  { symbol: '400', value_ko: '결과 통합부',    value_en: 'Result Integrator',  description: '처리 결과를 통합하여 최종 출력을 생성하는 모듈',  hypernym_ko: '통합 장치', hypernym_en: 'Integration Device' },
]

export function generateComponentCandidates(_input: InventionInput): SpecComponentItem[] {
  return MOCK_ELEMENTS.map((el, i) => ({
    ...el,
    id: i + 1,
    depth: 0,
    sel: true,
  }))
}

// ── 도면 mock ─────────────────────────────────────────────────────────────────

// 임의의 특허 도면 형태 SVG (ASCII만 — base64 인코딩용)
const _FIG1 = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400' viewBox='0 0 640 400'><rect width='640' height='400' fill='#ffffff'/><text x='320' y='36' font-family='sans-serif' font-size='20' text-anchor='middle' fill='#333'>FIG. 1</text><rect x='40' y='150' width='110' height='64' rx='4' fill='none' stroke='#333' stroke-width='2'/><text x='95' y='188' font-family='sans-serif' font-size='15' text-anchor='middle' fill='#333'>100</text><rect x='205' y='150' width='110' height='64' rx='4' fill='none' stroke='#333' stroke-width='2'/><text x='260' y='188' font-family='sans-serif' font-size='15' text-anchor='middle' fill='#333'>200</text><rect x='370' y='150' width='110' height='64' rx='4' fill='none' stroke='#333' stroke-width='2'/><text x='425' y='188' font-family='sans-serif' font-size='15' text-anchor='middle' fill='#333'>300</text><rect x='300' y='280' width='110' height='60' rx='4' fill='none' stroke='#333' stroke-width='2'/><text x='355' y='316' font-family='sans-serif' font-size='15' text-anchor='middle' fill='#333'>400</text><line x1='150' y1='182' x2='205' y2='182' stroke='#333' stroke-width='2'/><polygon points='205,182 196,177 196,187' fill='#333'/><line x1='315' y1='182' x2='370' y2='182' stroke='#333' stroke-width='2'/><polygon points='370,182 361,177 361,187' fill='#333'/><line x1='425' y1='214' x2='380' y2='280' stroke='#333' stroke-width='2'/></svg>`;
const _FIG2 = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400' viewBox='0 0 640 400'><rect width='640' height='400' fill='#ffffff'/><text x='320' y='36' font-family='sans-serif' font-size='20' text-anchor='middle' fill='#333'>FIG. 2 (Prior Art)</text><rect x='110' y='160' width='160' height='80' rx='4' fill='none' stroke='#555' stroke-width='2'/><text x='190' y='205' font-family='sans-serif' font-size='15' text-anchor='middle' fill='#555'>10</text><rect x='370' y='160' width='160' height='80' rx='4' fill='none' stroke='#555' stroke-width='2'/><text x='450' y='205' font-family='sans-serif' font-size='15' text-anchor='middle' fill='#555'>20</text><line x1='270' y1='200' x2='370' y2='200' stroke='#555' stroke-width='2'/><polygon points='370,200 361,195 361,205' fill='#555'/></svg>`;
const _b64 = (s: string): string => { try { return typeof btoa !== 'undefined' ? btoa(s) : ''; } catch { return ''; } };

export const MOCK_DRAWINGS: Drawing[] = [
  {
    image: {
      file: { data: _b64(_FIG1), media_type: 'image/svg+xml' },
      bbox: { x1: 0, y1: 0, x2: 640, y2: 400 },
    },
    detail: { symbol: '도면1', name: '시스템 전체 구성도', description: '발명의 전체 구성을 나타내는 블록도', label: 'proposed_implementation' },
    included: true, useForSpec: false, isRepresentative: false,
  },
  {
    image: {
      file: { data: _b64(_FIG2), media_type: 'image/svg+xml' },
      bbox: { x1: 0, y1: 0, x2: 640, y2: 400 },
    },
    detail: { symbol: '도면2', name: '종래 기술 구성도', description: '기존 기술 구조를 나타낸 도면', label: 'previous_implementation' },
    included: true, useForSpec: false, isRepresentative: false,
  },
]

// ── 독립항 세트 mock (API v0.2.0) ─────────────────────────────────────────────

export const MOCK_INDEPENDENT_CLAIM_SETS: IndependentClaimSet[] = [
  {
    abstraction_level: 'BROAD',
    claims: [
      { value: '데이터를 수집하는 수집부; 수집된 데이터를 병렬로 처리하는 처리부; 처리 결과를 통합하는 통합부를 포함하는 데이터 처리 시스템.', category: 'MACHINE', element_idxs: [0, 2, 3] },
      { value: '데이터를 수집하는 단계; 수집된 데이터를 병렬로 처리하는 단계; 처리 결과를 통합하는 단계를 포함하는 데이터 처리 방법.', category: 'PROCESS', element_idxs: [0, 2, 3] },
    ],
  },
  {
    abstraction_level: 'BROAD',
    claims: [
      { value: '입력 데이터를 복수의 처리 경로로 분산하는 분산부; 각 처리 경로에서 데이터를 처리하는 처리부; 처리된 결과를 병합하는 병합부를 포함하는 데이터 처리 장치.', category: 'MACHINE', element_idxs: [0, 2, 3] },
    ],
  },
  {
    abstraction_level: 'INTERMEDIATE',
    claims: [
      { value: '원시 데이터를 수집하는 데이터 수집부(100); 수집된 데이터를 정규화하는 전처리부(200); 복수의 스레드로 데이터를 동시 처리하는 병렬 처리부(300); 처리 결과를 통합하는 결과 통합부(400)를 포함하는 데이터 처리 시스템.', category: 'MACHINE', element_idxs: [0, 1, 2, 3] },
      { value: '원시 데이터를 수집하는 단계; 수집된 데이터를 정규화하는 단계; 복수의 스레드로 데이터를 동시 처리하는 단계; 처리 결과를 통합하는 단계를 포함하는 데이터 처리 방법.', category: 'PROCESS', element_idxs: [0, 1, 2, 3] },
    ],
  },
  {
    abstraction_level: 'INTERMEDIATE',
    claims: [
      { value: '외부 장치로부터 원시 데이터를 수집하는 수집부(100); 수집 데이터의 오류를 검출하고 보정하는 전처리부(200); 병렬 알고리즘으로 데이터를 처리하는 처리부(300); 처리 결과를 가중 합산하는 통합부(400)를 포함하는 데이터 처리 시스템.', category: 'MACHINE', element_idxs: [0, 1, 2, 3] },
    ],
  },
  {
    abstraction_level: 'NARROW',
    claims: [
      { value: 'IoT 센서 신호를 수신하는 데이터 수집부(100); 신호에서 노이즈를 제거하고 표준 포맷으로 변환하는 전처리부(200); 4개 이상의 독립 스레드로 분산 처리하는 병렬 처리부(300); 가중 평균 방식으로 결과를 통합하는 결과 통합부(400)를 포함하는 실시간 데이터 처리 시스템.', category: 'MACHINE', element_idxs: [0, 1, 2, 3] },
    ],
  },
]

// ── 종속항 mock ───────────────────────────────────────────────────────────────

export const MOCK_DEPENDENT_CLAIMS: Omit<DepClaimItem, 'id' | 'sel'>[] = [
  { no: 2, value: '제1항에 있어서, 상기 병렬 처리부(300)는 처리 결과의 신뢰도를 수치화하는 신뢰도 산출 모듈을 더 포함하는 데이터 처리 시스템.', depends_on: 1, element_idxs: [2] },
  { no: 3, value: '제1항에 있어서, 상기 전처리부(200)는 이상치 검출 알고리즘을 포함하는 데이터 처리 시스템.', depends_on: 1, element_idxs: [1] },
  { no: 4, value: '제2항에 있어서, 신뢰도가 기준값 미만인 경우 재처리를 요청하는 피드백 모듈을 더 포함하는 데이터 처리 시스템.', depends_on: 2, element_idxs: [2] },
]

// ── 중간명세서 mock ───────────────────────────────────────────────────────────

export const MOCK_MIDSPEC: MidspecSection[] = [
  {
    key: 'technical_field',
    label: '기술분야',
    blocks: [{ text: '본 발명은 병렬 분산 처리 기반의 데이터 처리 시스템 및 방법에 관한 것이다.' }],
  },
  {
    key: 'background_art',
    label: '배경기술',
    blocks: [
      { text: '종래의 데이터 처리 시스템은 단일 프로세서 기반의 직렬 처리 방식을 사용하였다.' },
      { text: '이러한 방식은 처리 속도가 느리고 오류율이 높은 문제점이 있었다.' },
    ],
  },
  {
    key: 'technical_problem',
    label: '해결과제',
    blocks: [{ text: '본 발명이 해결하려는 과제는 병렬 처리를 통해 데이터 처리 속도를 향상시키고 오류율을 낮추는 것이다.' }],
  },
  {
    key: 'technical_solution',
    label: '해결수단',
    blocks: [{ text: '상기 과제를 해결하기 위하여, 본 발명은 복수의 처리 모듈이 데이터를 병렬로 분산 처리하고 결과를 통합하는 구조를 채택한다.' }],
  },
  {
    key: 'advantageous_effects',
    label: '발명의 효과',
    blocks: [{ text: '본 발명에 따르면 데이터 처리 속도를 300% 향상시키고 오류율을 90% 감소시키는 효과가 있다.' }],
  },
  {
    key: 'drawing_descriptions',
    label: '도면의 간단한 설명',
    blocks: [
      { text: '도 1은 본 발명의 일 실시예에 따른 데이터 처리 시스템의 전체 구성을 나타낸 블록도이다.' },
      { text: '도 2는 종래 기술에 따른 데이터 처리 구조를 나타낸 도면이다.' },
    ],
  },
]

// ── upload 완료 시 context 초기화 ─────────────────────────────────────────────

export function getMockExtractResult(): InventionContext {
  return {
    title:    MOCK_ABSTRACTS[0].title,
    summary:  MOCK_ABSTRACTS[0].summary,
    elements: MOCK_ELEMENTS,
    previous: MOCK_PREVIOUS.map(item => ({ ...item, adopted: true })),
    proposed: MOCK_PROPOSED.map(item => ({ ...item, adopted: true })),
    drawings: MOCK_DRAWINGS,
  }
}

// ── 실시예 mock (B2) ─────────────────────────────────────────────────────────

export const MOCK_EMBODIMENT: import('./types').SpecificationBlock[] = [
  { text: '이하, 첨부된 도면을 참조하여 본 발명의 바람직한 실시예를 상세히 설명한다.' },
  { text: '도 1을 참조하면, 본 발명의 일 실시예에 따른 데이터 처리 시스템(10)은 데이터 수집부(100), 전처리부(200), 병렬 처리부(300) 및 결과 통합부(400)를 포함한다.' },
  { text: '데이터 수집부(100)는 외부 장치로부터 원시 데이터를 수집하며, 수집된 데이터를 전처리부(200)로 전달한다.' },
  { text: '전처리부(200)는 수집된 데이터에서 노이즈를 제거하고 표준 포맷으로 변환한 후, 병렬 처리부(300)로 전달한다.' },
  { text: '병렬 처리부(300)는 복수의 독립 스레드를 이용하여 데이터를 동시에 분산 처리하고, 처리 결과를 결과 통합부(400)로 전달한다.' },
  { text: '결과 통합부(400)는 각 스레드의 처리 결과를 가중 평균 방식으로 통합하여 최종 출력을 생성한다.' },
]

// ── AI 부분 수정 mock ─────────────────────────────────────────────────────────

export function mockPartialModify(selectedText: string, _instruction: string): string {
  return `[AI 수정] ${selectedText.slice(0, 30)}... → 수정된 내용이 여기에 표시됩니다.`
}
