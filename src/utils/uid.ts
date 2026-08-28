// 간단 UUID 생성 — API 객체 id (InventionElement/InventionDescriptionItem/SpecificationBlock) mock용
export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
