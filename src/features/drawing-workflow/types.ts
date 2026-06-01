// 도면 워크플로우 타입 — CK.Patent 추출 포맷 기반

export type DrawingLabel = 'AI생성' | '종래기술' | '제안기술';

export type DrawingStage =
  | 'extracted'         // 추출 완료 (B박스 조정 전)
  | 'bbox-adjusted'     // B박스 조정 완료 (변환 대기)
  | 'converting'        // CAD 변환 중
  | 'candidate-select'  // 3개 후보 선택 대기
  | 'editing'           // 편집 중
  | 'done';             // 편집 완료

export interface DrawingBBox {
  x: number; y: number; w: number; h: number;
}

export interface CadCandidate {
  id: string;
  svgDataUrl: string; // SVG 또는 이미지 URL
}

export interface DrawingItem {
  id: string;
  symbol: number;          // 기호 번호 (1, 2, 3, 4...)
  label: DrawingLabel;     // 종래기술 / 제안기술 / AI생성
  name: string;            // 명칭
  description: string;     // 설명 (구성요소 링크 포함)
  applied: boolean;        // 적용 여부 (명세서 반영)
  pageNumber: number;
  imageSize?: { w: number; h: number };
  // 워크플로우
  stage: DrawingStage;
  originalImageUrl: string;  // 추출된 원본 이미지
  bbox: DrawingBBox;
  cadCandidates?: CadCandidate[];  // 변환 후 3개 후보
  selectedCandidateId?: string;
  // 편집 결과
  savedEditorJson?: string;
  exportedImageUrl?: string;  // 편집 완료 후 썸네일
  isRepresentative?: boolean; // 대표도면 여부
  drawingDescription?: string; // 명세서에 들어갈 도면의 설명
}

// CK.Patent 포맷 mock 데이터
export const MOCK_DRAWINGS: DrawingItem[] = [
  {
    id: 'd1', symbol: 1, label: '종래기술',
    name: '드럼 브레이크',
    description: '드럼 브레이크의 구성을 보여주는 도면으로, 드럼, 슈 어셈블리, 라이닝 등의 부품이 표시되어 있습니다.',
    applied: false,
    pageNumber: 1, imageSize: { w: 376, h: 273 },
    stage: 'extracted',
    originalImageUrl: '', bbox: { x: 0, y: 0, w: 376, h: 273 },
  },
  {
    id: 'd2', symbol: 2, label: '종래기술',
    name: '디스크 브레이크',
    description: '디스크 브레이크의 주요 구성 요소인 캘리퍼, 디스크 로터, 브레이크 패드를 보여주는 도면입니다.',
    applied: false,
    pageNumber: 1, imageSize: { w: 336, h: 259 },
    stage: 'extracted',
    originalImageUrl: '', bbox: { x: 0, y: 0, w: 336, h: 259 },
  },
  {
    id: 'd3', symbol: 3, label: '제안기술',
    name: '마스터 실린더 & 부스터 어셈블리',
    description: '마스터 실린더와 부스터 어셈블리의 작동 원리를 설명하는 순서도 및 구성도입니다.',
    applied: true,
    pageNumber: 1, imageSize: { w: 406, h: 315 },
    stage: 'done',
    originalImageUrl: '', bbox: { x: 0, y: 0, w: 406, h: 315 },
    cadCandidates: [
      { id: 'c1', svgDataUrl: '' }, { id: 'c2', svgDataUrl: '' }, { id: 'c3', svgDataUrl: '' },
    ],
    selectedCandidateId: 'c1',
  },
  {
    id: 'd4', symbol: 4, label: '제안기술',
    name: '캘리퍼 어셈블리',
    description: '캘리퍼 어셈블리가 장착된 디스크 브레이크의 전체적인 구조를 보여주는 측면도입니다.',
    applied: true,
    pageNumber: 1, imageSize: { w: 237, h: 271 },
    stage: 'bbox-adjusted',
    originalImageUrl: '', bbox: { x: 0, y: 0, w: 237, h: 271 },
  },
];
