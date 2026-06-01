import * as fabric from "fabric";
import {
  GRID_STEP,
  MARGIN_PX,
  META,
  OVERLAY_KIND,
  OVERLAY_PROPS,
} from "./constants";
import { getMeta, hasMeta, setMeta } from "./meta";

function tag(
  obj: fabric.Object,
  kind: (typeof OVERLAY_KIND)[keyof typeof OVERLAY_KIND],
): void {
  setMeta(obj, META.isOverlay, true);
  setMeta(obj, META.overlayKind, kind);
}

export function isOverlay(obj: fabric.Object): boolean {
  return hasMeta(obj, META.isOverlay);
}

export function addOverlays(canvas: fabric.Canvas, w: number, h: number): void {
  for (let x = 0; x <= w; x += GRID_STEP) {
    const line = new fabric.Line([x, 0, x, h], {
      stroke: "#e2e8f0",
      strokeWidth: 0.5,
      ...OVERLAY_PROPS,
    });
    tag(line, OVERLAY_KIND.grid);
    canvas.add(line);
  }
  for (let y = 0; y <= h; y += GRID_STEP) {
    const line = new fabric.Line([0, y, w, y], {
      stroke: "#e2e8f0",
      strokeWidth: 0.5,
      ...OVERLAY_PROPS,
    });
    tag(line, OVERLAY_KIND.grid);
    canvas.add(line);
  }

  const margin = new fabric.Rect({
    left: MARGIN_PX,
    top: MARGIN_PX,
    width: w - MARGIN_PX * 2,
    height: h - MARGIN_PX * 2,
    fill: "transparent",
    stroke: "#dc2626",
    strokeWidth: 1,
    strokeDashArray: [6, 4],
    ...OVERLAY_PROPS,
  });
  tag(margin, OVERLAY_KIND.margin);
  canvas.add(margin);
}

export function setOverlayVisibility(
  canvas: fabric.Canvas,
  showGrid: boolean,
  showMargin: boolean,
): void {
  canvas.getObjects().forEach((o) => {
    if (!isOverlay(o)) return;
    const kind = getMeta<string>(o, META.overlayKind);
    if (kind === OVERLAY_KIND.grid) o.set("visible", showGrid);
    if (kind === OVERLAY_KIND.margin) o.set("visible", showMargin);
  });
  canvas.requestRenderAll();
}

export function withOverlaysHidden<T>(
  canvas: fabric.Canvas,
  fn: () => T,
): T {
  const overlays = canvas.getObjects().filter(isOverlay);
  const prev = overlays.map((o) => o.visible !== false);
  overlays.forEach((o) => o.set("visible", false));
  canvas.requestRenderAll();
  try {
    return fn();
  } finally {
    overlays.forEach((o, i) => o.set("visible", prev[i]));
    canvas.requestRenderAll();
  }
}
