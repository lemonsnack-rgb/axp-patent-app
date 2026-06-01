import * as fabric from "fabric";
import { META } from "./constants";
import { hasMeta, setMeta } from "./meta";

let cached: fabric.Pattern | null = null;

export function getHatchPattern(): fabric.Pattern {
  if (cached) return cached;
  const tile = document.createElement("canvas");
  tile.width = 8;
  tile.height = 8;
  const ctx = tile.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-1, 9);
    ctx.lineTo(9, -1);
    ctx.moveTo(-1, 1);
    ctx.lineTo(1, -1);
    ctx.moveTo(7, 9);
    ctx.lineTo(9, 7);
    ctx.stroke();
  }
  cached = new fabric.Pattern({ source: tile, repeat: "repeat" });
  return cached;
}

export function toggleHatch(obj: fabric.Object): boolean {
  if (!(obj instanceof fabric.Rect) && !(obj instanceof fabric.Circle)) {
    return false;
  }
  const hadHatch = hasMeta(obj, META.hatchFilled);
  if (hadHatch) {
    obj.set({ fill: "transparent" });
    setMeta(obj, META.hatchFilled, false);
  } else {
    obj.set({ fill: getHatchPattern() });
    setMeta(obj, META.hatchFilled, true);
  }
  obj.dirty = true;
  return true;
}

export function reapplyHatchAfterLoad(canvas: fabric.Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (hasMeta(obj, META.hatchFilled)) {
      obj.set({ fill: getHatchPattern() });
      obj.dirty = true;
    }
  });
}
