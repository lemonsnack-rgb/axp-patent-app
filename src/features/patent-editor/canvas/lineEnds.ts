import * as fabric from "fabric";
import type { LineEnd, LineStyle } from "../types";
import { LINE_DASH_PATTERNS } from "./constants";

interface Pt {
  x: number;
  y: number;
}

/**
 * 끝단 데코 생성.
 * @param tangentFrom 끝점에 들어오는 tangent의 시작점.
 *                    직선이면 start. 곡선이면 마지막 CP(end의 직전 control point).
 * @param end          끝점 (데코가 놓이는 자리)
 */
export function buildEndDecoration(
  type: LineEnd,
  tangentFrom: Pt,
  end: Pt,
): fabric.Object | null {
  if (type === "plain") return null;

  if (type === "dot") {
    return new fabric.Circle({
      left: end.x,
      top: end.y,
      radius: 3,
      fill: "#000",
      originX: "center",
      originY: "center",
      strokeWidth: 0,
      objectCaching: false,
    });
  }

  // arrow — tangentFrom → end 방향으로 정렬
  const angle = Math.atan2(end.y - tangentFrom.y, end.x - tangentFrom.x);
  const size = 12;
  const spread = Math.PI / 7;
  const tipX = end.x;
  const tipY = end.y;
  const lx = tipX - size * Math.cos(angle - spread);
  const ly = tipY - size * Math.sin(angle - spread);
  const rx = tipX - size * Math.cos(angle + spread);
  const ry = tipY - size * Math.sin(angle + spread);
  return new fabric.Polygon(
    [
      { x: tipX, y: tipY },
      { x: lx, y: ly },
      { x: rx, y: ry },
    ],
    {
      fill: "#000",
      strokeWidth: 0,
      objectCaching: false,
    },
  );
}

/**
 * S-curve의 두 번째 컨트롤 포인트 (end 직전 tangent의 시작점).
 * buildSCurvePath와 동일 공식.
 */
export function getSCurveTangentAtEnd(anchor: Pt, textPos: Pt): Pt {
  const dx = textPos.x - anchor.x;
  const dy = textPos.y - anchor.y;
  const len = Math.hypot(dx, dy) || 1;
  const c2x = anchor.x + (2 * dx) / 3;
  const c2y = anchor.y + (2 * dy) / 3;
  const offset = Math.max(30, Math.min(120, len * 0.35));
  const perpX = (-dy / len) * offset;
  const perpY = (dx / len) * offset;
  return { x: c2x - perpX, y: c2y - perpY };
}

export function buildLineObject(
  start: Pt,
  end: Pt,
  style: LineStyle,
  endType: LineEnd,
): fabric.Object {
  const line = new fabric.Line([start.x, start.y, end.x, end.y], {
    stroke: "#000",
    strokeWidth: 1.5,
    strokeDashArray: LINE_DASH_PATTERNS[style],
    objectCaching: false,
  });

  const endShape = buildEndDecoration(endType, start, end);
  if (!endShape) return line;

  return new fabric.Group([line, endShape], {
    objectCaching: false,
  });
}
