interface Pt {
  x: number;
  y: number;
}

/** 기본 offset: 거리 기반 자동 계산 */
export function getDefaultOffset(anchor: Pt, textPos: Pt): number {
  const len = Math.hypot(textPos.x - anchor.x, textPos.y - anchor.y) || 1;
  return Math.max(30, Math.min(120, len * 0.35));
}

/**
 * S자 큐빅 베지에 곡선 경로.
 * offset이 없으면 거리 기반 자동 계산, 있으면 사용자 지정값 사용.
 */
export function buildSCurvePath(anchor: Pt, textPos: Pt, offset?: number): string {
  const dx = textPos.x - anchor.x;
  const dy = textPos.y - anchor.y;
  const len = Math.hypot(dx, dy) || 1;
  const c1x = anchor.x + dx / 3;
  const c1y = anchor.y + dy / 3;
  const c2x = anchor.x + (2 * dx) / 3;
  const c2y = anchor.y + (2 * dy) / 3;
  const off = offset ?? getDefaultOffset(anchor, textPos);
  const perpX = (-dy / len) * off;
  const perpY = (dx / len) * off;
  return `M ${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} C ${(c1x + perpX).toFixed(2)} ${(c1y + perpY).toFixed(2)} ${(c2x - perpX).toFixed(2)} ${(c2y - perpY).toFixed(2)} ${textPos.x.toFixed(2)} ${textPos.y.toFixed(2)}`;
}

/**
 * 곡선 중간 핸들 위치 (C1 제어점): 드래그하면 곡률 변경
 */
export function getMidHandlePos(anchor: Pt, textPos: Pt, offset: number): Pt {
  const dx = textPos.x - anchor.x;
  const dy = textPos.y - anchor.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: anchor.x + dx / 3 + (-dy / len) * offset,
    y: anchor.y + dy / 3 + (dx / len) * offset,
  };
}

/**
 * 중간 핸들 드래그 위치로부터 새 offset 계산
 * (C1 기준점에서 수직 방향 투영)
 */
export function calcOffsetFromMidHandle(anchor: Pt, textPos: Pt, handlePos: Pt): number {
  const dx = textPos.x - anchor.x;
  const dy = textPos.y - anchor.y;
  const len = Math.hypot(dx, dy) || 1;
  // C1 기준점 (offset 0일 때)
  const baseX = anchor.x + dx / 3;
  const baseY = anchor.y + dy / 3;
  // 수직 단위벡터
  const perpUx = -dy / len;
  const perpUy = dx / len;
  // 핸들 → 기준점 벡터를 수직 방향으로 투영
  const signedOff = (handlePos.x - baseX) * perpUx + (handlePos.y - baseY) * perpUy;
  return Math.max(5, Math.min(300, Math.abs(signedOff)));
}
