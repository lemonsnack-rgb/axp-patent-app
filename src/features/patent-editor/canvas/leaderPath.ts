interface Pt {
  x: number;
  y: number;
}

/**
 * S자 큐빅 베지에 곡선 경로. anchor(부품 표면)에서 textPos(라벨)까지.
 * 컨트롤 포인트를 라인의 1/3, 2/3 지점에서 수직으로 살짝 어긋나게 두어 S자 형태를 만든다.
 * 기존 PoC `utils/leaderLine.ts`와 동일한 알고리즘.
 */
export function buildSCurvePath(anchor: Pt, textPos: Pt): string {
  const dx = textPos.x - anchor.x;
  const dy = textPos.y - anchor.y;
  const len = Math.hypot(dx, dy) || 1;
  const c1x = anchor.x + dx / 3;
  const c1y = anchor.y + dy / 3;
  const c2x = anchor.x + (2 * dx) / 3;
  const c2y = anchor.y + (2 * dy) / 3;
  // 누구나 알아볼 만큼 곡률 확보: 최소 30px, 길이의 35%, 최대 120px
  const offset = Math.max(30, Math.min(120, len * 0.35));
  const perpX = (-dy / len) * offset;
  const perpY = (dx / len) * offset;
  return `M ${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} C ${(c1x + perpX).toFixed(2)} ${(c1y + perpY).toFixed(2)} ${(c2x - perpX).toFixed(2)} ${(c2y - perpY).toFixed(2)} ${textPos.x.toFixed(2)} ${textPos.y.toFixed(2)}`;
}
