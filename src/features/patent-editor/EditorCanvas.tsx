import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as fabric from "fabric";
import { useEditorStore } from "./useEditorStore";
import {
  BRUSH_WIDTH,
  FIXED_FONT_FAMILY,
  LINE_DASH_PATTERNS,
  META,
  MIN_FONT_SIZE,
  REF_CIRCLE_MIN_RADIUS,
  REF_CIRCLE_PADDING,
} from "./canvas/constants";
import { buildEndDecoration, getSCurveTangentAtEnd } from "./canvas/lineEnds";
import {
  addOverlays,
  isOverlay,
  setOverlayVisibility,
  withOverlaysHidden,
} from "./canvas/overlay";
import { snap } from "./canvas/snap";
import { reapplyHatchAfterLoad, toggleHatch } from "./canvas/hatch";
import { buildSCurvePath } from "./canvas/leaderPath";
import { getMeta, hasMeta, setMeta } from "./canvas/meta";
import { RefPickerPopup } from "./RefPickerPopup";
import type { EditorReference, LeaderCurve, LineEnd, LineStyle, ToolMode } from "./types";

export interface EditorCanvasHandle {
  getCanvas: () => fabric.Canvas | null;
  toggleHatchOnSelection: () => void;
  exportBinaryReady: () => HTMLCanvasElement | null;
  removeAllUsesOfRef: (refNumber: string) => number;
  /** AI 추천 위치에 참조 부호를 자동 배치 */
  placeInitialRefs: (refs: EditorReference[]) => void;
}

interface Props {
  sourceImageUrl: string;
  savedEditorDataJson?: string;
  width: number;
  height: number;
  availableReferences: EditorReference[];
  onReferenceAdd?: (ref: EditorReference) => void;
}

type Pt = { x: number; y: number };

type PendingSpawn =
  | { kind: "leader"; anchor: Pt; textPos: Pt }
  | { kind: "ref-circle"; anchor: Pt; circlePos: Pt }
  | { kind: "edit-leader"; target: fabric.IText }
  | { kind: "edit-ref-circle"; target: fabric.Group }
  | { kind: "select-for-text" }
  | { kind: "select-for-ref-circle" };

interface PickerState {
  position: { x: number; y: number };
  pending: PendingSpawn;
  initialRef?: EditorReference;
  title: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function isLeaderText(o: fabric.Object): boolean {
  return hasMeta(o, META.isLeaderText);
}

function isRefCircleGroup(o: fabric.Object): boolean {
  return hasMeta(o, META.isRefCircle);
}

function findLeaderLine(
  canvas: fabric.Canvas,
  leaderId: string,
): fabric.Object | null {
  return (
    canvas
      .getObjects()
      .find(
        (o) =>
          hasMeta(o, META.isLeaderLine) &&
          getMeta<string>(o, META.leaderId) === leaderId,
      ) ?? null
  );
}

function copyLeaderMeta(src: fabric.Object, dst: fabric.Object): void {
  for (const key of [
    META.leaderId,
    META.isLeaderLine,
    META.leaderCurveType,
    META.leaderAnchorX,
    META.leaderAnchorY,
  ]) {
    const v = getMeta(src, key);
    if (v !== undefined) setMeta(dst, key, v);
  }
}

function makeLeaderObject(
  anchor: Pt,
  textPos: Pt,
  style: LineStyle,
  curve: LeaderCurve,
  leaderId: string,
): fabric.Object {
  const dash = LINE_DASH_PATTERNS[style];
  if (curve === "s-curve") {
    const path = new fabric.Path(buildSCurvePath(anchor, textPos), {
      stroke: "#000",
      strokeWidth: 1.2,
      strokeDashArray: dash,
      fill: undefined,
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    setMeta(path, META.leaderId, leaderId);
    setMeta(path, META.isLeaderLine, true);
    setMeta(path, META.leaderCurveType, "s-curve");
    setMeta(path, META.leaderAnchorX, anchor.x);
    setMeta(path, META.leaderAnchorY, anchor.y);
    return path;
  }
  const line = new fabric.Line(
    [anchor.x, anchor.y, textPos.x, textPos.y],
    {
      stroke: "#000",
      strokeWidth: 1.2,
      strokeDashArray: dash,
      selectable: false,
      evented: false,
      objectCaching: false,
    },
  );
  setMeta(line, META.leaderId, leaderId);
  setMeta(line, META.isLeaderLine, true);
  setMeta(line, META.leaderCurveType, "straight");
  return line;
}

function spawnLeaderPair(
  fc: fabric.Canvas,
  anchor: Pt,
  textPos: Pt,
  style: LineStyle,
  curve: LeaderCurve,
  ref: EditorReference,
): void {
  const id = uid();
  const text = new fabric.IText(ref.number, {
    left: textPos.x,
    top: textPos.y,
    fontSize: MIN_FONT_SIZE,
    fontFamily: FIXED_FONT_FAMILY,
    fill: "#000",
    originX: "center",
    originY: "center",
    editable: false,
    objectCaching: false,
  });
  setMeta(text, META.leaderId, id);
  setMeta(text, META.isLeaderText, true);
  setMeta(text, META.refNumber, ref.number);
  if (ref.name) setMeta(text, META.refName, ref.name);

  const leader = makeLeaderObject(anchor, textPos, style, curve, id);

  fc.add(leader);
  fc.add(text);
  fc.setActiveObject(text);
  fc.requestRenderAll();
}

function spawnRefCircleGroup(
  fc: fabric.Canvas,
  pos: Pt,
  ref: EditorReference,
): void {
  const text = new fabric.IText(ref.number, {
    fontSize: MIN_FONT_SIZE,
    fontFamily: FIXED_FONT_FAMILY,
    fill: "#000",
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
  });
  const measured = text.width ?? 20;
  const radius = Math.max(
    REF_CIRCLE_MIN_RADIUS,
    measured / 2 + REF_CIRCLE_PADDING,
  );
  const circle = new fabric.Circle({
    radius,
    fill: "transparent",
    stroke: "#000",
    strokeWidth: 1.5,
    originX: "center",
    originY: "center",
  });
  const group = new fabric.Group([circle, text], {
    left: pos.x,
    top: pos.y,
    originX: "center",
    originY: "center",
  });
  setMeta(group, META.isRefCircle, true);
  setMeta(group, META.refNumber, ref.number);
  if (ref.name) setMeta(group, META.refName, ref.name);
  fc.add(group);
  fc.setActiveObject(group);
  fc.requestRenderAll();
}

function updateLeaderTextRef(
  fc: fabric.Canvas,
  target: fabric.IText,
  ref: EditorReference,
): void {
  target.set({ text: ref.number });
  setMeta(target, META.refNumber, ref.number);
  if (ref.name) setMeta(target, META.refName, ref.name);
  else setMeta(target, META.refName, undefined);
  target.setCoords();
  fc.requestRenderAll();
}

function updateRefCircleRef(
  fc: fabric.Canvas,
  group: fabric.Group,
  ref: EditorReference,
): void {
  const children = group.getObjects();
  const itext = children.find((c) => c instanceof fabric.IText) as
    | fabric.IText
    | undefined;
  if (itext) itext.set({ text: ref.number });
  setMeta(group, META.refNumber, ref.number);
  if (ref.name) setMeta(group, META.refName, ref.name);
  else setMeta(group, META.refName, undefined);
  group.dirty = true;
  fc.requestRenderAll();
}

function getAbsoluteEndpoints(line: fabric.Line): { start: Pt; end: Pt } {
  const matrix = line.calcTransformMatrix();
  const local = line.calcLinePoints();
  const s = fabric.util.transformPoint(
    new fabric.Point(local.x1, local.y1),
    matrix,
  );
  const e = fabric.util.transformPoint(
    new fabric.Point(local.x2, local.y2),
    matrix,
  );
  return { start: { x: s.x, y: s.y }, end: { x: e.x, y: e.y } };
}

function removeAllEndpointHandles(fc: fabric.Canvas): void {
  const handles = fc
    .getObjects()
    .filter((o) => hasMeta(o, META.isEndpointHandle));
  for (const h of handles) fc.remove(h);
}

function createEndpointHandles(
  fc: fabric.Canvas,
  line: fabric.Object,
  lineId: string,
): void {
  // META 우선 사용, 없으면 fabric.Line은 transformMatrix로 fallback
  let start: Pt;
  let end: Pt;
  const sx = getMeta<number>(line, META.lineStartX);
  const sy = getMeta<number>(line, META.lineStartY);
  const ex = getMeta<number>(line, META.lineEndX);
  const ey = getMeta<number>(line, META.lineEndY);
  if (sx !== undefined && sy !== undefined && ex !== undefined && ey !== undefined) {
    start = { x: sx, y: sy };
    end = { x: ex, y: ey };
  } else if (line instanceof fabric.Line) {
    const eps = getAbsoluteEndpoints(line);
    start = eps.start;
    end = eps.end;
  } else {
    return;
  }
  const make = (pos: Pt, side: "start" | "end") => {
    const h = new fabric.Circle({
      left: pos.x,
      top: pos.y,
      radius: 7,
      fill: "#3b82f6",
      stroke: "#fff",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      hasBorders: false,
      hasControls: false,
      objectCaching: false,
      excludeFromExport: true,
      hoverCursor: "crosshair",
    });
    setMeta(h, META.isEndpointHandle, true);
    setMeta(h, META.lineId, lineId);
    setMeta(h, META.handleSide, side);
    return h;
  };
  fc.add(make(start, "start"));
  fc.add(make(end, "end"));
}

function findUserLineById(
  fc: fabric.Canvas,
  lineId: string,
): fabric.Group | null {
  return (
    (fc
      .getObjects()
      .find(
        (o) =>
          o instanceof fabric.Group &&
          hasMeta(o, META.isUserLine) &&
          getMeta<string>(o, META.lineId) === lineId,
      ) as fabric.Group | undefined) ?? null
  );
}

function findHandlesByLineId(
  fc: fabric.Canvas,
  lineId: string,
): fabric.Circle[] {
  return fc
    .getObjects()
    .filter(
      (o) =>
        hasMeta(o, META.isEndpointHandle) &&
        getMeta<string>(o, META.lineId) === lineId,
    ) as fabric.Circle[];
}

// 통합 user line + decoration을 fabric.Group으로 묶음 (분리 불가)
function createUserLineWithDecoration(
  fc: fabric.Canvas,
  start: Pt,
  end: Pt,
  style: LineStyle,
  pathType: LeaderCurve,
  endType: LineEnd,
): fabric.Group {
  const id = uid();
  const dash = LINE_DASH_PATTERNS[style];
  let mainShape: fabric.Object;
  if (pathType === "s-curve") {
    mainShape = new fabric.Path(buildSCurvePath(start, end), {
      stroke: "#000",
      strokeWidth: 1.5,
      strokeDashArray: dash,
      fill: undefined,
      objectCaching: false,
    });
  } else {
    mainShape = new fabric.Line([start.x, start.y, end.x, end.y], {
      stroke: "#000",
      strokeWidth: 1.5,
      strokeDashArray: dash,
      objectCaching: false,
    });
  }

  const children: fabric.Object[] = [mainShape];
  if (endType !== "plain") {
    const tangentFrom =
      pathType === "s-curve" ? getSCurveTangentAtEnd(start, end) : start;
    const decoration = buildEndDecoration(endType, tangentFrom, end);
    if (decoration) children.push(decoration);
  }

  const group = new fabric.Group(children, {
    selectable: true,
    evented: true,
    objectCaching: false,
  });
  setMeta(group, META.isUserLine, true);
  setMeta(group, META.lineId, id);
  setMeta(group, META.linePathType, pathType);
  setMeta(group, META.lineEndType, endType);
  setMeta(group, META.lineStartX, start.x);
  setMeta(group, META.lineStartY, start.y);
  setMeta(group, META.lineEndX, end.x);
  setMeta(group, META.lineEndY, end.y);
  setMeta(group, META.lastLeft, group.left ?? 0);
  setMeta(group, META.lastTop, group.top ?? 0);
  fc.add(group);
  fc.setActiveObject(group);
  fc.requestRenderAll();
  return group;
}

// user line의 끝점 1개를 새 좌표로 변경 → Group 통째 교체
function rebuildUserLineWithEndpoint(
  fc: fabric.Canvas,
  oldGroup: fabric.Object,
  side: "start" | "end",
  newPos: Pt,
): fabric.Group | null {
  const id = getMeta<string>(oldGroup, META.lineId);
  if (!id) return null;
  const pathType = (getMeta<string>(oldGroup, META.linePathType) ?? "straight") as LeaderCurve;
  const endType = (getMeta<string>(oldGroup, META.lineEndType) ?? "plain") as LineEnd;
  const sx = getMeta<number>(oldGroup, META.lineStartX) ?? 0;
  const sy = getMeta<number>(oldGroup, META.lineStartY) ?? 0;
  const ex = getMeta<number>(oldGroup, META.lineEndX) ?? 0;
  const ey = getMeta<number>(oldGroup, META.lineEndY) ?? 0;
  const newStart = side === "start" ? newPos : { x: sx, y: sy };
  const newEnd = side === "end" ? newPos : { x: ex, y: ey };

  const idx = fc.getObjects().indexOf(oldGroup);
  const dash = oldGroup instanceof fabric.Group
    ? (oldGroup.getObjects()[0] as fabric.Line).strokeDashArray
    : undefined;

  let mainShape: fabric.Object;
  if (pathType === "s-curve") {
    mainShape = new fabric.Path(buildSCurvePath(newStart, newEnd), {
      stroke: "#000",
      strokeWidth: 1.5,
      strokeDashArray: dash,
      fill: undefined,
      objectCaching: false,
    });
  } else {
    mainShape = new fabric.Line(
      [newStart.x, newStart.y, newEnd.x, newEnd.y],
      {
        stroke: "#000",
        strokeWidth: 1.5,
        strokeDashArray: dash,
        objectCaching: false,
      },
    );
  }

  const children: fabric.Object[] = [mainShape];
  if (endType !== "plain") {
    const tangentFrom =
      pathType === "s-curve" ? getSCurveTangentAtEnd(newStart, newEnd) : newStart;
    const decoration = buildEndDecoration(endType, tangentFrom, newEnd);
    if (decoration) children.push(decoration);
  }

  const newGroup = new fabric.Group(children, {
    selectable: true,
    evented: true,
    objectCaching: false,
  });
  setMeta(newGroup, META.isUserLine, true);
  setMeta(newGroup, META.lineId, id);
  setMeta(newGroup, META.linePathType, pathType);
  setMeta(newGroup, META.lineEndType, endType);
  setMeta(newGroup, META.lineStartX, newStart.x);
  setMeta(newGroup, META.lineStartY, newStart.y);
  setMeta(newGroup, META.lineEndX, newEnd.x);
  setMeta(newGroup, META.lineEndY, newEnd.y);
  setMeta(newGroup, META.lastLeft, newGroup.left ?? 0);
  setMeta(newGroup, META.lastTop, newGroup.top ?? 0);
  const shapeName = getMeta(oldGroup, META.shapeName);
  if (shapeName !== undefined) setMeta(newGroup, META.shapeName, shapeName);

  fc.remove(oldGroup);
  if (idx >= 0) fc.insertAt(idx, newGroup);
  else fc.add(newGroup);
  return newGroup;
}

function rebuildLeaderPath(
  fc: fabric.Canvas,
  oldLeader: fabric.Path,
  anchor: Pt,
  textPos: Pt,
  style: LineStyle,
): fabric.Path | null {
  const idx = fc.getObjects().indexOf(oldLeader);
  if (idx === -1) return null;
  const newPath = new fabric.Path(buildSCurvePath(anchor, textPos), {
    stroke: oldLeader.stroke ?? "#000",
    strokeWidth: oldLeader.strokeWidth ?? 1.2,
    strokeDashArray: LINE_DASH_PATTERNS[style],
    fill: undefined,
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  copyLeaderMeta(oldLeader, newPath);
  setMeta(newPath, META.leaderAnchorX, anchor.x);
  setMeta(newPath, META.leaderAnchorY, anchor.y);
  fc.remove(oldLeader);
  fc.insertAt(idx, newPath);
  return newPath;
}

function createDragPreview(
  tool: ToolMode,
  p: Pt,
  style: LineStyle,
): fabric.Object | null {
  const dash = LINE_DASH_PATTERNS[style];
  if (tool === "rect") {
    return new fabric.Rect({
      left: p.x,
      top: p.y,
      width: 1,
      height: 1,
      fill: "transparent",
      stroke: "#000",
      strokeWidth: 1.5,
      strokeDashArray: dash,
      originX: "left",
      originY: "top",
      selectable: false,
      evented: false,
      objectCaching: false,
    });
  }
  if (tool === "circle") {
    return new fabric.Circle({
      left: p.x,
      top: p.y,
      radius: 1,
      fill: "transparent",
      stroke: "#000",
      strokeWidth: 1.5,
      strokeDashArray: dash,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      objectCaching: false,
    });
  }
  if (tool === "triangle") {
    return new fabric.Triangle({
      left: p.x,
      top: p.y,
      width: 1,
      height: 1,
      fill: "transparent",
      stroke: "#000",
      strokeWidth: 1.5,
      strokeDashArray: dash,
      originX: "left",
      originY: "top",
      selectable: false,
      evented: false,
      objectCaching: false,
    });
  }
  if (tool === "diamond") {
    // 마름모: Polygon 4점 (초기 1×1, updateDragPreview에서 갱신)
    return new fabric.Polygon(
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
      {
        fill: "transparent",
        stroke: "#000",
        strokeWidth: 1.5,
        strokeDashArray: dash,
        selectable: false,
        evented: false,
        objectCaching: false,
      }
    );
  }
  if (tool === "marquee-eraser") {
    return new fabric.Rect({
      left: p.x,
      top: p.y,
      width: 1,
      height: 1,
      fill: "rgba(255,255,255,0.85)",
      stroke: "#9ca3af",
      strokeWidth: 1,
      strokeDashArray: [4, 3],
      originX: "left",
      originY: "top",
      selectable: false,
      evented: false,
      objectCaching: false,
    });
  }
  return null;
}

function createLinePreview(start: Pt, end: Pt, style: LineStyle): fabric.Line {
  return new fabric.Line([start.x, start.y, end.x, end.y], {
    stroke: "#000",
    strokeWidth: 1.5,
    strokeDashArray: LINE_DASH_PATTERNS[style],
    selectable: false,
    evented: false,
    objectCaching: false,
  });
}

function updateDragPreview(
  preview: fabric.Object,
  tool: ToolMode,
  start: Pt,
  end: Pt,
): void {
  if (tool === "rect" || tool === "marquee-eraser") {
    const rect = preview as fabric.Rect;
    rect.set({
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.max(1, Math.abs(end.x - start.x)),
      height: Math.max(1, Math.abs(end.y - start.y)),
    });
    rect.setCoords();
    return;
  }
  if (tool === "circle") {
    const circle = preview as fabric.Circle;
    const r = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y) / 2);
    circle.set({
      left: (start.x + end.x) / 2,
      top: (start.y + end.y) / 2,
      radius: r,
    });
    circle.setCoords();
    return;
  }
  if (tool === "triangle") {
    const tri = preview as fabric.Triangle;
    tri.set({
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.max(1, Math.abs(end.x - start.x)),
      height: Math.max(1, Math.abs(end.y - start.y)),
    });
    tri.setCoords();
    return;
  }
  if (tool === "diamond") {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const hw = Math.max(1, Math.abs(end.x - start.x) / 2);
    const hh = Math.max(1, Math.abs(end.y - start.y) / 2);
    const poly = preview as fabric.Polygon;
    poly.set({
      points: [
        { x: cx, y: cy - hh },
        { x: cx + hw, y: cy },
        { x: cx, y: cy + hh },
        { x: cx - hw, y: cy },
      ],
      left: cx - hw,
      top: cy - hh,
    });
    poly.setCoords();
    return;
  }
}

function commitShape(preview: fabric.Object, tool: ToolMode): void {
  preview.set({ selectable: true, evented: true });
  if (tool === "marquee-eraser") {
    preview.set({ fill: "#ffffff", stroke: undefined, strokeWidth: 0 });
  }
}

function clampPopupPosition(
  desired: Pt,
  containerWidth: number,
  containerHeight: number,
  popupW = 288,
  popupH = 320,
): Pt {
  return {
    x: Math.max(8, Math.min(desired.x, containerWidth - popupW - 8)),
    y: Math.max(8, Math.min(desired.y, containerHeight - popupH - 8)),
  };
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, Props>(
  function EditorCanvas(
    {
      sourceImageUrl,
      savedEditorDataJson,
      width,
      height,
      availableReferences,
      onReferenceAdd,
    },
    ref,
  ) {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const pendingAnchorRef = useRef<Pt | null>(null);
    const dragStartRef = useRef<Pt | null>(null);
    const previewObjectRef = useRef<fabric.Object | null>(null);
    // 참조번호/원형부호 도구 진입 시 picker에서 미리 고른 부호
    const selectedRefRef = useRef<EditorReference | null>(null);
    const [picker, setPicker] = useState<PickerState | null>(null);
    const [selectedObj, setSelectedObj] = useState<fabric.Object | null>(null);
    const [shapeNameInput, setShapeNameInput] = useState("");
    // Local mirror so we can call onReferenceAdd and update list immediately
    const [extraRefs, setExtraRefs] = useState<EditorReference[]>([]);

    const allRefs = useMemo(() => {
      const map = new Map<string, EditorReference>();
      for (const r of availableReferences) map.set(r.number, r);
      for (const r of extraRefs) map.set(r.number, r);
      return Array.from(map.values()).sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      );
    }, [availableReferences, extraRefs]);

    useImperativeHandle(ref, () => ({
      getCanvas: () => fabricRef.current,
      toggleHatchOnSelection: () => {
        const fc = fabricRef.current;
        if (!fc) return;
        const active = fc.getActiveObjects();
        let changed = false;
        active.forEach((o) => {
          if (toggleHatch(o)) changed = true;
        });
        if (changed) fc.requestRenderAll();
      },
      exportBinaryReady: () => {
        const fc = fabricRef.current;
        if (!fc) return null;
        fc.discardActiveObject();
        return withOverlaysHidden(fc, () => fc.toCanvasElement(1));
      },
      placeInitialRefs: (refs: EditorReference[]) => {
        const fc = fabricRef.current;
        if (!fc || refs.length === 0) return;
        // 캔버스 크기 기반으로 배치 위치 분산 (AI 추천 위치 모의)
        const W = fc.getWidth();
        const H = fc.getHeight();
        const positions = [
          { anchor: { x: W * 0.25, y: H * 0.35 }, text: { x: W * 0.08, y: H * 0.12 } },
          { anchor: { x: W * 0.55, y: H * 0.45 }, text: { x: W * 0.72, y: H * 0.20 } },
          { anchor: { x: W * 0.45, y: H * 0.65 }, text: { x: W * 0.25, y: H * 0.78 } },
          { anchor: { x: W * 0.75, y: H * 0.30 }, text: { x: W * 0.88, y: H * 0.48 } },
          { anchor: { x: W * 0.65, y: H * 0.70 }, text: { x: W * 0.82, y: H * 0.78 } },
        ];
        const state = useEditorStore.getState();
        refs.slice(0, positions.length).forEach((ref, i) => {
          const { anchor, text } = positions[i];
          spawnLeaderPair(fc, anchor, text, state.lineStyle, state.leaderCurve, ref);
        });
        fc.discardActiveObject();
        fc.requestRenderAll();
      },
      removeAllUsesOfRef: (refNumber: string) => {
        const fc = fabricRef.current;
        if (!fc) return 0;
        const removedLeaderIds = new Set<string>();
        const toRemove: fabric.Object[] = [];
        for (const obj of fc.getObjects()) {
          const num = getMeta<string>(obj, META.refNumber);
          if (num !== refNumber) continue;
          toRemove.push(obj);
          if (hasMeta(obj, META.isLeaderText)) {
            const lid = getMeta<string>(obj, META.leaderId);
            if (lid) removedLeaderIds.add(lid);
          }
        }
        // 짝지어진 leader line 함께 제거
        for (const obj of fc.getObjects()) {
          if (!hasMeta(obj, META.isLeaderLine)) continue;
          const lid = getMeta<string>(obj, META.leaderId);
          if (lid && removedLeaderIds.has(lid)) toRemove.push(obj);
        }
        if (toRemove.length === 0) return 0;
        fc.discardActiveObject();
        for (const o of toRemove) fc.remove(o);
        removeAllEndpointHandles(fc);
        fc.requestRenderAll();
        return toRemove.length;
      },
    }));

    useEffect(() => {
      if (!canvasElRef.current) return;
      const fc = new fabric.Canvas(canvasElRef.current, {
        width,
        height,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
      });
      fabricRef.current = fc;

      addOverlays(fc, width, height);

      const pencil = new fabric.PencilBrush(fc);
      pencil.color = "#FFFFFF";
      pencil.width = BRUSH_WIDTH;
      fc.freeDrawingBrush = pencil;

      const handleMouseDown = (
        opt: fabric.TPointerEventInfo<fabric.TPointerEvent>,
      ) => {
        if (picker) return;
        const state = useEditorStore.getState();
        const tool = state.tool;
        if (tool === "select" || tool === "brush-eraser") return;

        const p = fc.getScenePoint(opt.e);
        const cp = { x: p.x, y: p.y };

        if (tool === "text" || tool === "ref-circle") {
          // 부호 미선택 상태면 picker 다시 띄움 (방어)
          if (!selectedRefRef.current) {
            setPicker({
              position: { x: 12, y: 12 },
              pending:
                tool === "text"
                  ? { kind: "select-for-text" }
                  : { kind: "select-for-ref-circle" },
              title:
                tool === "text" ? "참조번호 선택" : "원형 부호 선택",
            });
            return;
          }
          // 1번째 클릭: 앵커 저장 + 라이브 프리뷰
          if (!pendingAnchorRef.current) {
            pendingAnchorRef.current = cp;
            const preview = createLinePreview(cp, cp, state.lineStyle);
            previewObjectRef.current = preview;
            fc.add(preview);
            fc.requestRenderAll();
            return;
          }
          // 2번째 클릭: 자동 spawn (미리 고른 부호 사용)
          const anchor = pendingAnchorRef.current;
          const ref = selectedRefRef.current;
          pendingAnchorRef.current = null;
          if (previewObjectRef.current) {
            fc.remove(previewObjectRef.current);
            previewObjectRef.current = null;
          }
          if (tool === "text") {
            spawnLeaderPair(
              fc,
              anchor,
              cp,
              state.lineStyle,
              state.leaderCurve,
              ref,
            );
          } else {
            const id = uid();
            const leader = makeLeaderObject(
              anchor,
              cp,
              state.lineStyle,
              state.leaderCurve,
              id,
            );
            fc.add(leader);
            spawnRefCircleGroup(fc, cp, ref);
          }
          selectedRefRef.current = null;
          useEditorStore.setState({ tool: "select" });
          return;
        }

        if (tool === "line") {
          // 클릭-클릭 패턴 (드래그 아님)
          if (!pendingAnchorRef.current) {
            pendingAnchorRef.current = cp;
            const preview = createLinePreview(cp, cp, state.lineStyle);
            previewObjectRef.current = preview;
            fc.add(preview);
            fc.requestRenderAll();
            return;
          }
          // 2번째 클릭 → 확정
          const anchor = pendingAnchorRef.current;
          pendingAnchorRef.current = null;
          if (previewObjectRef.current) {
            fc.remove(previewObjectRef.current);
            previewObjectRef.current = null;
          }
          const dx = Math.abs(cp.x - anchor.x);
          const dy = Math.abs(cp.y - anchor.y);
          if (dx < 2 && dy < 2) {
            fc.requestRenderAll();
            return;
          }
          // 선 그리기: main line/path + decoration을 Group으로 묶어 저장
          const newLine = createUserLineWithDecoration(
            fc,
            anchor,
            cp,
            state.lineStyle,
            state.leaderCurve,
            state.lineEnd,
          );
          // PPT 스타일: 삽입 후 자동 선택 모드 + 새 객체 선택
          fc.setActiveObject(newLine);
          useEditorStore.setState({ tool: "select" });
          fc.requestRenderAll();
          return;
        }

        // Drag tools: rect / circle / marquee-eraser
        dragStartRef.current = cp;
        const preview = createDragPreview(tool, cp, state.lineStyle);
        if (preview) {
          previewObjectRef.current = preview;
          fc.add(preview);
          fc.requestRenderAll();
        }
      };

      const handleMouseMove = (
        opt: fabric.TPointerEventInfo<fabric.TPointerEvent>,
      ) => {
        const state = useEditorStore.getState();
        const p = fc.getScenePoint(opt.e);
        const cp = { x: p.x, y: p.y };

        // 클릭-클릭 도구들: 첫 클릭 후 라이브 프리뷰 (선/참조번호/원형부호)
        if (
          (state.tool === "line" ||
            state.tool === "text" ||
            state.tool === "ref-circle") &&
          pendingAnchorRef.current
        ) {
          const preview = previewObjectRef.current as fabric.Line | null;
          if (preview) {
            preview.set({ x2: cp.x, y2: cp.y });
            preview.setCoords();
            fc.requestRenderAll();
          }
          return;
        }

        // 드래그 도구: 드래그 중 프리뷰 크기 갱신
        const start = dragStartRef.current;
        const preview = previewObjectRef.current;
        if (!start || !preview) return;
        updateDragPreview(preview, state.tool, start, cp);
        fc.requestRenderAll();
      };

      const handleMouseUp = (
        opt: fabric.TPointerEventInfo<fabric.TPointerEvent>,
      ) => {
        const state = useEditorStore.getState();
        // 클릭-클릭 도구는 mouse:up 무시
        if (
          state.tool === "line" ||
          state.tool === "text" ||
          state.tool === "ref-circle"
        )
          return;

        const start = dragStartRef.current;
        const preview = previewObjectRef.current;
        dragStartRef.current = null;
        previewObjectRef.current = null;
        if (!start || !preview) return;

        const p = fc.getScenePoint(opt.e);
        const dx = Math.abs(p.x - start.x);
        const dy = Math.abs(p.y - start.y);

        if (
          state.tool === "rect" ||
          state.tool === "circle" ||
          state.tool === "triangle" ||
          state.tool === "diamond" ||
          state.tool === "marquee-eraser"
        ) {
          if (dx < 4 && dy < 4) {
            fc.remove(preview);
          } else {
            commitShape(preview, state.tool);
            // PPT 스타일: 삽입 후 자동 선택 모드 + 새 도형 선택
            fc.setActiveObject(preview);
            useEditorStore.setState({ tool: "select" });
          }
        } else {
          fc.remove(preview);
        }
        fc.requestRenderAll();
      };

      const handleObjectMoving = (opt: { target?: fabric.Object }) => {
        const target = opt.target;
        if (!target) return;

        // Endpoint handle 드래그 → 선의 해당 끝점 갱신
        if (hasMeta(target, META.isEndpointHandle)) {
          const lineId = getMeta<string>(target, META.lineId);
          const side = getMeta<string>(target, META.handleSide) as
            | "start"
            | "end"
            | undefined;
          if (!lineId || !side) return;
          const line = findUserLineById(fc, lineId);
          if (!line) return;
          const newPos = { x: target.left ?? 0, y: target.top ?? 0 };
          rebuildUserLineWithEndpoint(fc, line, side, newPos);
          return;
        }

        // 일반 객체 스냅
        target.set({
          left: snap(target.left ?? 0),
          top: snap(target.top ?? 0),
        });

        // Leader text 추적
        if (isLeaderText(target)) {
          const leaderId = getMeta<string>(target, META.leaderId);
          if (!leaderId) return;
          const leader = findLeaderLine(fc, leaderId);
          if (!leader) return;
          const newTextPos = { x: target.left ?? 0, y: target.top ?? 0 };
          const curveType = getMeta<string>(leader, META.leaderCurveType);
          if (curveType === "s-curve" && leader instanceof fabric.Path) {
            const ax = getMeta<number>(leader, META.leaderAnchorX);
            const ay = getMeta<number>(leader, META.leaderAnchorY);
            if (ax !== undefined && ay !== undefined) {
              const style = useEditorStore.getState().lineStyle;
              rebuildLeaderPath(fc, leader, { x: ax, y: ay }, newTextPos, style);
            }
          } else if (leader instanceof fabric.Line) {
            leader.set({ x2: newTextPos.x, y2: newTextPos.y });
            leader.setCoords();
          }
          return;
        }

        // User line Group 전체 이동 → META 좌표 + handle 동기 (decoration은 Group children이라 자동)
        if (
          target instanceof fabric.Group &&
          hasMeta(target, META.isUserLine)
        ) {
          const lineId = getMeta<string>(target, META.lineId);
          if (!lineId) return;
          const lastL =
            getMeta<number>(target, META.lastLeft) ?? target.left ?? 0;
          const lastT =
            getMeta<number>(target, META.lastTop) ?? target.top ?? 0;
          const dx = (target.left ?? 0) - lastL;
          const dy = (target.top ?? 0) - lastT;
          const sx = getMeta<number>(target, META.lineStartX) ?? 0;
          const sy = getMeta<number>(target, META.lineStartY) ?? 0;
          const ex = getMeta<number>(target, META.lineEndX) ?? 0;
          const ey = getMeta<number>(target, META.lineEndY) ?? 0;
          const newStart = { x: sx + dx, y: sy + dy };
          const newEnd = { x: ex + dx, y: ey + dy };
          setMeta(target, META.lineStartX, newStart.x);
          setMeta(target, META.lineStartY, newStart.y);
          setMeta(target, META.lineEndX, newEnd.x);
          setMeta(target, META.lineEndY, newEnd.y);
          setMeta(target, META.lastLeft, target.left ?? 0);
          setMeta(target, META.lastTop, target.top ?? 0);
          const handles = findHandlesByLineId(fc, lineId);
          for (const h of handles) {
            const side = getMeta<string>(h, META.handleSide);
            const pos = side === "start" ? newStart : newEnd;
            h.set({ left: pos.x, top: pos.y });
            h.setCoords();
          }
        }
      };

      const handleObjectScaling = (opt: { target?: fabric.Object }) => {
        const t = opt.target;
        if (t instanceof fabric.IText && !t.isEditing) {
          const fs = t.fontSize ?? MIN_FONT_SIZE;
          const minScale = MIN_FONT_SIZE / fs;
          if ((t.scaleX ?? 1) < minScale) t.scaleX = minScale;
          if ((t.scaleY ?? 1) < minScale) t.scaleY = minScale;
        }
      };

      const handleObjectModified = (opt: { target?: fabric.Object }) => {
        const t = opt.target;
        if (t instanceof fabric.IText && !t.isEditing) {
          const sx = t.scaleX ?? 1;
          const sy = t.scaleY ?? 1;
          if (sx !== 1 || sy !== 1) {
            const base = t.fontSize ?? MIN_FONT_SIZE;
            const newSize = Math.max(MIN_FONT_SIZE, base * sx);
            t.set({ fontSize: newSize, scaleX: 1, scaleY: 1 });
            t.setCoords();
          }
        }
      };

      // 더블클릭: 기존 leader 또는 ref-circle 편집
      const handleDoubleClick = (opt: { target?: fabric.Object }) => {
        const target = opt.target;
        if (!target) return;
        if (useEditorStore.getState().tool !== "select") return;
        let pendingObj: PendingSpawn | null = null;
        let canvasPos: Pt | null = null;
        if (isLeaderText(target) && target instanceof fabric.IText) {
          pendingObj = { kind: "edit-leader", target };
          canvasPos = { x: target.left ?? 0, y: target.top ?? 0 };
        } else if (isRefCircleGroup(target) && target instanceof fabric.Group) {
          pendingObj = { kind: "edit-ref-circle", target };
          canvasPos = { x: target.left ?? 0, y: target.top ?? 0 };
        }
        if (!pendingObj || !canvasPos) return;
        const currentNumber = getMeta<string>(target, META.refNumber);
        const currentName = getMeta<string>(target, META.refName);
        setPicker({
          position: clampPopupPosition(
            { x: canvasPos.x + 16, y: canvasPos.y + 16 },
            width,
            height,
          ),
          pending: pendingObj,
          initialRef: currentNumber
            ? { number: currentNumber, name: currentName }
            : undefined,
          title: "도면부호 편집",
        });
      };

      const syncSelectionFromCanvas = () => {
        const active = fc.getActiveObject();
        removeAllEndpointHandles(fc);
        if (active && active.type !== "activeselection") {
          // Endpoint handle 자체가 선택된 경우엔 무시
          if (hasMeta(active, META.isEndpointHandle)) {
            // 핸들을 직접 선택하지는 않게 — 부모 라인을 재선택
            const lineId = getMeta<string>(active, META.lineId);
            const line = lineId ? findUserLineById(fc, lineId) : null;
            if (line) {
              fc.setActiveObject(line);
              createEndpointHandles(fc, line, lineId!);
            }
            return;
          }
          setSelectedObj(active);
          setShapeNameInput(
            (getMeta<string>(active, META.shapeName) as string | undefined) ??
              "",
          );
          // user line이면 handle 표시 (Group으로 묶여 있음)
          if (
            active instanceof fabric.Group &&
            hasMeta(active, META.isUserLine)
          ) {
            const lineId = getMeta<string>(active, META.lineId);
            if (lineId) createEndpointHandles(fc, active, lineId);
          }
        } else {
          setSelectedObj(null);
          setShapeNameInput("");
        }
        fc.requestRenderAll();
      };

      fc.on("mouse:down", handleMouseDown);
      fc.on("mouse:move", handleMouseMove);
      fc.on("mouse:up", handleMouseUp);
      fc.on("mouse:dblclick", handleDoubleClick);
      fc.on("object:moving", handleObjectMoving);
      fc.on("object:scaling", handleObjectScaling);
      fc.on("object:modified", handleObjectModified);
      fc.on("selection:created", syncSelectionFromCanvas);
      fc.on("selection:updated", syncSelectionFromCanvas);
      fc.on("selection:cleared", syncSelectionFromCanvas);

      const init = async () => {
        if (savedEditorDataJson) {
          try {
            await fc.loadFromJSON(JSON.parse(savedEditorDataJson));
            reapplyHatchAfterLoad(fc);
          } catch (err) {
            console.warn("[PatentEditor] loadFromJSON failed:", err);
          }
          addOverlays(fc, width, height);
          const st = useEditorStore.getState();
          setOverlayVisibility(fc, st.showGrid, st.showMarginGuide);
        }
        try {
          const img = await fabric.FabricImage.fromURL(sourceImageUrl, {
            crossOrigin: "anonymous",
          });
          const imgW = img.width ?? width;
          const imgH = img.height ?? height;
          const scale = Math.min(width / imgW, height / imgH, 1);
          const drawnW = imgW * scale;
          const drawnH = imgH * scale;
          img.set({
            originX: "left",
            originY: "top",
            scaleX: scale,
            scaleY: scale,
            left: (width - drawnW) / 2,
            top: (height - drawnH) / 2,
            selectable: false,
            evented: false,
            hoverCursor: "default",
          });
          fc.backgroundImage = img;
          fc.requestRenderAll();
        } catch (err) {
          console.warn("[PatentEditor] background image load failed:", err);
        }
      };
      void init();

      return () => {
        fc.off("mouse:down", handleMouseDown);
        fc.off("mouse:move", handleMouseMove);
        fc.off("mouse:up", handleMouseUp);
        fc.off("mouse:dblclick", handleDoubleClick);
        fc.off("object:moving", handleObjectMoving);
        fc.off("object:scaling", handleObjectScaling);
        fc.off("object:modified", handleObjectModified);
        fc.off("selection:created", syncSelectionFromCanvas);
        fc.off("selection:updated", syncSelectionFromCanvas);
        fc.off("selection:cleared", syncSelectionFromCanvas);
        fc.dispose();
        fabricRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceImageUrl, savedEditorDataJson, width, height]);

    const tool = useEditorStore((s) => s.tool);
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc) return;

      pendingAnchorRef.current = null;
      if (previewObjectRef.current) {
        fc.remove(previewObjectRef.current);
        previewObjectRef.current = null;
      }
      dragStartRef.current = null;
      // 도구 변경 시 미리 고른 부호 초기화 + picker 닫기
      selectedRefRef.current = null;

      // 선택 도구가 아닌 모드에서는 endpoint handle 정리
      if (tool !== "select") {
        removeAllEndpointHandles(fc);
      }

      // 참조번호/원형부호 진입 시 picker 자동 표시
      if (tool === "text") {
        setPicker({
          position: { x: 12, y: 12 },
          pending: { kind: "select-for-text" },
          title: "참조번호 선택 — 부호를 먼저 고르세요",
        });
      } else if (tool === "ref-circle") {
        setPicker({
          position: { x: 12, y: 12 },
          pending: { kind: "select-for-ref-circle" },
          title: "원형 부호 선택 — 부호를 먼저 고르세요",
        });
      } else {
        setPicker((p) =>
          p &&
          (p.pending.kind === "select-for-text" ||
            p.pending.kind === "select-for-ref-circle")
            ? null
            : p,
        );
      }

      fc.isDrawingMode = tool === "brush-eraser";

      if (tool === "select") {
        fc.selection = true;
        fc.defaultCursor = "default";
        fc.hoverCursor = "move";
        fc.forEachObject((o) => {
          if (isOverlay(o)) return;
          if (hasMeta(o, META.isLeaderLine)) return;
          o.selectable = true;
          o.evented = true;
        });
      } else {
        fc.selection = false;
        fc.discardActiveObject();
        fc.defaultCursor = "crosshair";
        fc.hoverCursor = "crosshair";
        fc.forEachObject((o) => {
          if (isOverlay(o)) return;
          o.selectable = false;
          o.evented = false;
        });
      }
      fc.requestRenderAll();
    }, [tool]);

    // 객체 삭제 (선택된 항목들 + 짝지어진 leader line / endpoint handle)
    const deleteSelectedObjects = useRef(() => {});
    deleteSelectedObjects.current = () => {
      const fc = fabricRef.current;
      if (!fc) return;
      const active = fc.getActiveObjects();
      if (active.length === 0) return;
      const toRemove = new Set<fabric.Object>();
      for (const obj of active) {
        if (isOverlay(obj)) continue;
        // endpoint handle / leader line은 사용자가 직접 못 지움 (페어링됨)
        if (hasMeta(obj, META.isEndpointHandle)) continue;
        if (hasMeta(obj, META.isLeaderLine)) continue;
        toRemove.add(obj);
        // Leader text → paired leader line도 제거
        if (hasMeta(obj, META.isLeaderText)) {
          const leaderId = getMeta<string>(obj, META.leaderId);
          if (leaderId) {
            const line = findLeaderLine(fc, leaderId);
            if (line) toRemove.add(line);
          }
        }
        // User line Group → paired handles 제거 (decoration은 Group 안이라 자동)
        if (obj instanceof fabric.Group && hasMeta(obj, META.isUserLine)) {
          const lineId = getMeta<string>(obj, META.lineId);
          if (lineId) {
            const handles = findHandlesByLineId(fc, lineId);
            handles.forEach((h) => toRemove.add(h));
          }
        }
      }
      if (toRemove.size === 0) return;
      fc.discardActiveObject();
      for (const obj of toRemove) fc.remove(obj);
      removeAllEndpointHandles(fc);
      fc.requestRenderAll();
      setSelectedObj(null);
      setShapeNameInput("");
    };

    // 키보드 단축키 (Delete · Esc · 도구 단일키 V/L/R/C/T)
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        const inField =
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable);
        // Delete / Backspace — 선택 객체 삭제
        if (e.key === "Delete" || e.key === "Backspace") {
          if (inField) return;
          if (picker) return;
          e.preventDefault();
          deleteSelectedObjects.current();
          return;
        }
        // Esc — picker 닫기 또는 선택 모드로 복귀
        if (e.key === "Escape") {
          e.preventDefault();
          if (picker) {
            // picker가 select-for-* 모드면 도구도 종료시키도록 cancel과 같은 효과
            if (
              picker.pending.kind === "select-for-text" ||
              picker.pending.kind === "select-for-ref-circle"
            ) {
              useEditorStore.setState({ tool: "select" });
            }
            setPicker(null);
            return;
          }
          const fc = fabricRef.current;
          if (fc) {
            fc.discardActiveObject();
            fc.requestRenderAll();
          }
          useEditorStore.setState({ tool: "select" });
          return;
        }
        // 도구 단일키 (modifier 없을 때만, 입력란 포커스 X)
        if (inField || picker) return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        const setTool = useEditorStore.getState().setTool;
        const k = e.key.toLowerCase();
        if (k === "v") {
          e.preventDefault();
          setTool("select");
        } else if (k === "l") {
          e.preventDefault();
          setTool("line");
        } else if (k === "r") {
          e.preventDefault();
          setTool("rect");
        } else if (k === "c") {
          e.preventDefault();
          setTool("circle");
        } else if (k === "t") {
          e.preventDefault();
          setTool("text");
        }
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [picker]);

    const showGrid = useEditorStore((s) => s.showGrid);
    const showMarginGuide = useEditorStore((s) => s.showMarginGuide);
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc) return;
      setOverlayVisibility(fc, showGrid, showMarginGuide);
    }, [showGrid, showMarginGuide]);

    const handlePickerConfirm = (ref: EditorReference, isNew: boolean) => {
      const fc = fabricRef.current;
      if (!fc || !picker) {
        setPicker(null);
        return;
      }
      if (isNew) {
        setExtraRefs((prev) =>
          prev.some((r) => r.number === ref.number) ? prev : [...prev, ref],
        );
        onReferenceAdd?.(ref);
      }
      const p = picker.pending;
      const st = useEditorStore.getState();
      if (p.kind === "select-for-text" || p.kind === "select-for-ref-circle") {
        // 부호만 예약하고 닫음. 도구는 그대로 유지 → 캔버스 클릭으로 위치 지정
        selectedRefRef.current = ref;
        setPicker(null);
        return;
      }
      if (p.kind === "leader") {
        spawnLeaderPair(fc, p.anchor, p.textPos, st.lineStyle, st.leaderCurve, ref);
        useEditorStore.setState({ tool: "select" });
      } else if (p.kind === "ref-circle") {
        // 1) 지시선 (앵커 → 원형 위치)
        const id = uid();
        const leader = makeLeaderObject(
          p.anchor,
          p.circlePos,
          st.lineStyle,
          st.leaderCurve,
          id,
        );
        fc.add(leader);
        // 2) 원형 부호 그룹
        spawnRefCircleGroup(fc, p.circlePos, ref);
        useEditorStore.setState({ tool: "select" });
      } else if (p.kind === "edit-leader") {
        updateLeaderTextRef(fc, p.target, ref);
      } else if (p.kind === "edit-ref-circle") {
        updateRefCircleRef(fc, p.target, ref);
      }
      setPicker(null);
    };

    const handlePickerCancel = () => {
      // select-for-* 모드에서 취소 → 도구도 종료
      if (
        picker &&
        (picker.pending.kind === "select-for-text" ||
          picker.pending.kind === "select-for-ref-circle")
      ) {
        useEditorStore.setState({ tool: "select" });
      }
      setPicker(null);
    };

    const handleShapeNameChange = (val: string) => {
      setShapeNameInput(val);
      const fc = fabricRef.current;
      if (!fc || !selectedObj) return;
      setMeta(selectedObj, META.shapeName, val.trim() || undefined);
    };

    return (
      <div
        className="border border-gray-300 bg-white shadow-inner"
        style={{ width }}
      >
        <div className="relative" style={{ width, height }}>
          <canvas ref={canvasElRef} />
          <ToolHint tool={tool} pickerOpen={picker !== null} />
          {picker && (
            <RefPickerPopup
              availableReferences={allRefs}
              position={picker.position}
              initialRef={picker.initialRef}
              title={picker.title}
              onConfirm={handlePickerConfirm}
              onCancel={handlePickerCancel}
            />
          )}
        </div>
        <PropertyBar
          selected={selectedObj}
          shapeName={shapeNameInput}
          onShapeNameChange={handleShapeNameChange}
          onDelete={() => deleteSelectedObjects.current()}
        />
      </div>
    );
  },
);

function PropertyBar({
  selected,
  shapeName,
  onShapeNameChange,
  onDelete,
}: {
  selected: fabric.Object | null;
  shapeName: string;
  onShapeNameChange: (val: string) => void;
  onDelete: () => void;
}) {
  const isShape =
    selected !== null &&
    !hasMeta(selected, META.isLeaderText) &&
    !hasMeta(selected, META.isLeaderLine) &&
    !hasMeta(selected, META.isRefCircle) &&
    !hasMeta(selected, META.isOverlay) &&
    (selected instanceof fabric.Rect ||
      selected instanceof fabric.Circle ||
      selected instanceof fabric.Line ||
      selected instanceof fabric.Group ||
      selected instanceof fabric.Path);

  // 도면부호 객체는 부호 정보 표시 (편집은 더블클릭 popup으로)
  const refNumber = selected ? getMeta<string>(selected, META.refNumber) : null;
  const refName = selected ? getMeta<string>(selected, META.refName) : null;

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2 text-xs">
      {!selected && (
        <span className="text-gray-400 italic">
          선택된 객체 없음 — 객체를 클릭하여 선택하세요
        </span>
      )}
      {selected && refNumber && (
        <>
          <span className="text-gray-500">도면부호:</span>
          <span className="font-mono font-semibold text-gray-900">
            {refNumber}
          </span>
          {refName && <span className="text-gray-600">— {refName}</span>}
          <span className="text-[10px] text-gray-400 ml-2">
            (더블클릭으로 편집)
          </span>
        </>
      )}
      {selected && !refNumber && isShape && (
        <>
          <label
            htmlFor="patent-shape-name"
            className="text-gray-500 shrink-0"
          >
            도형 이름:
          </label>
          <input
            id="patent-shape-name"
            type="text"
            value={shapeName}
            onChange={(e) => onShapeNameChange(e.target.value)}
            placeholder="(없음)"
            className="flex-1 max-w-xs rounded border border-gray-300 px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
          />
          <span className="text-[10px] text-gray-400 ml-2">
            메타데이터로 저장됨 (캔버스에는 표시되지 않음)
          </span>
        </>
      )}
      {selected && !refNumber && !isShape && (
        <span className="text-gray-400 italic">
          이 객체는 이름을 부여할 수 없습니다
        </span>
      )}
      {selected && (
        <button
          type="button"
          onClick={onDelete}
          title="선택 객체 삭제 (Delete 키)"
          className="ml-auto inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
        >
          삭제
        </button>
      )}
    </div>
  );
}

function ToolHint({
  tool,
  pickerOpen,
}: {
  tool: ToolMode;
  pickerOpen: boolean;
}) {
  if (pickerOpen || tool === "select") return null;
  const HINTS: Record<Exclude<ToolMode, "select">, string> = {
    line:             "선/지시선: 시작점 클릭 → 끝점 클릭",
    text:             "참조번호: 부호 선택 → 지시 대상 클릭 → 텍스트 위치 클릭",
    "ref-circle":     "원형 부호: 부호 선택 → 지시 대상 클릭 → 원형 위치 클릭",
    rect:             "사각형: 드래그",
    circle:           "원/타원: 드래그",
    triangle:         "삼각형: 드래그",
    diamond:          "마름모: 드래그",
    polygon:          "다각형: 클릭으로 꼭짓점 추가, 더블클릭으로 완성 (개발 예정)",
    "arrow-shape":    "화살표 도형: 드래그 (개발 예정)",
    "marquee-eraser": "영역 지움: 드래그로 흰색 마스크",
    "brush-eraser":   "브러시 지움: 자유 드로잉 (흰색)",
  };
  return (
    <div className="pointer-events-none absolute top-2 left-2 text-xs bg-blue-600 text-white px-2 py-1 rounded shadow">
      {HINTS[tool]}
    </div>
  );
}
