import type { LineStyle } from "../types";

export const LINE_DASH_PATTERNS: Record<LineStyle, number[] | undefined> = {
  solid:              undefined,
  dashed:             [5, 5],
  "dash-dot":         [10, 3, 2, 3],
  "dash-double-dot":  [10, 3, 2, 3, 2, 3],
  dotted:             [1, 4],
};

export const SNAP_GRID = 10;
export const GRID_STEP = 20;
export const MIN_FONT_SIZE = 16;
export const FIXED_FONT_FAMILY = "Arial, 'Helvetica Neue', sans-serif";
export const BRUSH_WIDTH = 20;
export const MARGIN_PX = 70;
export const REF_CIRCLE_PADDING = 8;
export const REF_CIRCLE_MIN_RADIUS = 16;

export const META = {
  leaderId: "leaderId",
  isLeaderText: "isLeaderText",
  isLeaderLine: "isLeaderLine",
  leaderCurveType: "leaderCurveType",
  leaderAnchorX: "leaderAnchorX",
  leaderAnchorY: "leaderAnchorY",
  refNumber: "refNumber",
  refName: "refName",
  shapeName: "shapeName",
  isOverlay: "isOverlay",
  overlayKind: "overlayKind",
  isRefCircle: "isRefCircle",
  hatchFilled: "hatchFilled",
  // user line + endpoint handles
  isUserLine: "isUserLine",
  lineId: "lineId",
  isEndpointHandle: "isEndpointHandle",
  handleSide: "handleSide",
  isLineDecoration: "isLineDecoration",
  lineEndType: "lineEndType",
  linePathType: "linePathType",
  lineStartX: "lineStartX",
  lineStartY: "lineStartY",
  lineEndX: "lineEndX",
  lineEndY: "lineEndY",
  lastLeft: "lastLeft",
  lastTop: "lastTop",
  // AI 부호 위치 추천 마커
  isAiPendingMarker: "isAiPendingMarker",
  aiRecId: "aiRecId",
} as const;

export const OVERLAY_KIND = {
  grid: "grid",
  margin: "margin",
} as const;

export const OVERLAY_PROPS = {
  selectable: false,
  evented: false,
  hoverCursor: "default",
  excludeFromExport: true,
} as const;

export const CUSTOM_PROPS = [
  META.leaderId,
  META.isLeaderText,
  META.isLeaderLine,
  META.leaderCurveType,
  META.leaderAnchorX,
  META.leaderAnchorY,
  META.refNumber,
  META.refName,
  META.shapeName,
  META.isOverlay,
  META.overlayKind,
  META.isRefCircle,
  META.hatchFilled,
  META.isUserLine,
  META.lineId,
  META.isLineDecoration,
  META.lineEndType,
  META.linePathType,
  META.lineStartX,
  META.lineStartY,
  META.lineEndX,
  META.lineEndY,
];
