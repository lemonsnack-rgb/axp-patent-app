export type ToolMode =
  | "select"
  | "line"
  | "text"
  | "ref-circle"
  | "rect"
  | "circle"
  | "marquee-eraser"
  | "brush-eraser";

export type LineStyle = "solid" | "dashed" | "dash-dot" | "dash-double-dot";
export type LineEnd = "plain" | "dot" | "arrow";
export type LeaderCurve = "straight" | "s-curve";

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
  onReferenceAdd?: (ref: EditorReference) => void;
  /** 부호 이름·parent 변경 시 호출. 이 모듈 밖에서는 다른 명세서와도 동기화 가능 */
  onReferenceUpdate?: (ref: EditorReference) => void;
  onReferenceDelete?: (refNumber: string) => void;
  onSaveProject: (drawingId: string, editorDataJson: string) => void;
  onExportComplete: (drawingId: string, finalBlob: Blob) => void;
  onClose: () => void;
}
