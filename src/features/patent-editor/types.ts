export type ToolMode =
  // 선택/편집
  | "select"
  // 선/지시선 도구
  | "line"
  // 부호 도구
  | "text"           // 참조번호 (지시선 + 텍스트)
  | "ref-circle"     // 원형 부호 (지시선 + 원)
  // 기본 도형
  | "rect"
  | "circle"
  | "triangle"
  | "diamond"
  // 확장 도형 (개발 예정 — 현재 시각적 버튼만 제공)
  | "polygon"        // 자유 다각형
  | "arrow-shape"    // 화살표 도형
  // 지우기
  | "marquee-eraser"
  | "brush-eraser";

// 선 스타일 (KS/ISO 특허 도면 규격)
export type LineStyle =
  | "solid"           // 실선 (굵은 외형선)
  | "dashed"          // 파선 (숨은선)
  | "dash-dot"        // 1점 쇄선 (중심선)
  | "dash-double-dot" // 2점 쇄선 (가상선)
  | "dotted";         // 점선

// 선 굵기
export type LineWeight = "thin" | "normal" | "thick";

export type LineEnd = "plain" | "dot" | "arrow" | "open-arrow";
export type LeaderCurve = "straight" | "s-curve";

// 채우기 스타일
export type FillStyle = "none" | "hatch" | "cross-hatch";

export interface EditorReference {
  number: string;
  name?: string;
  /** 상위 부호의 번호 (계층구조). 미지정이면 root */
  parentNumber?: string;
}

/**
 * 명세서 내 도면 1장. CAD 변환된 이미지·캡션·본문 설명·저장된 편집 데이터를 포함.
 * 외부(직무발명서 분석→CAD 변환) 단계에서 만들어져 props로 주입됨.
 */
export interface PatentDrawing {
  id: string;
  caption: string;
  description?: string;
  sourceImageUrl: string;
  thumbnailUrl?: string;
  savedEditorDataJson?: string;
}

/** 발명 구성요소 (ComponentsPanel → 도면 부호 연결용) */
export interface InventionComponent {
  number: string;  // e.g. "10", "20"
  name: string;    // e.g. "데이터 수집부"
}

/** AI가 추천한 부호 위치 */
export interface AiRefRecommendation {
  id: string;
  refNumber: string;       // "100", "200" ...
  componentName: string;   // 매핑된 구성요소명
  posXPct: number;         // 캔버스 기준 x 위치 (0~100%)
  posYPct: number;         // 캔버스 기준 y 위치 (0~100%)
  status: 'pending' | 'accepted' | 'rejected';
}

export interface PatentEditorProps {
  drawings: PatentDrawing[];
  activeDrawingId: string;
  /** 대표도면 ID. 미지정이면 첫 번째 도면 기본 */
  representativeDrawingId?: string;
  onActiveDrawingChange: (drawingId: string) => void;
  onRepresentativeChange?: (drawingId: string) => void;
  onCaptionChange?: (drawingId: string, caption: string) => void;
  onDescriptionChange?: (drawingId: string, description: string) => void;
  availableReferences?: EditorReference[];
  /** 발명 구성요소 목록 (AI 추천 + 부호 연결용) */
  inventionComponents?: InventionComponent[];
  /** 부호 확정 후 구성요소명 일괄 갱신 콜백 */
  onComponentsSync?: (refs: EditorReference[]) => void;
  /** true: 단일 도면 편집 모드 — 좌측 도면 목록 패널 숨김 */
  singleDrawingMode?: boolean;
  /** 도면의 설명 (명세서 반영) 변경 콜백 */
  onDrawingDescriptionChange?: (drawingId: string, description: string) => void;
  onReferenceAdd?: (ref: EditorReference) => void;
  /** 부호 이름·parent 변경 시 호출. 이 모듈 밖에서는 다른 명세서와도 동기화 가능 */
  onReferenceUpdate?: (ref: EditorReference) => void;
  onReferenceDelete?: (refNumber: string) => void;
  onSaveProject: (drawingId: string, editorDataJson: string) => void;
  onExportComplete: (drawingId: string, finalBlob: Blob) => void;
  onClose: () => void;
}
