// detailTab.ts — 검색 결과 상세를 새 탭(독립 페이지)으로 여는 라우팅 헬퍼.
// 시드(PATENT_SEED/PAPER_SEED)가 결정적이라 키(특허 문헌번호 / 논문 id)만으로 재조회 가능.

export type DetailKind = 'patent' | 'paper';

const PREFIX = '#detail?';

/** 현재 탭이 상세 새 탭인지 */
export function isDetailTab(): boolean {
  return window.location.hash.startsWith(PREFIX);
}

/** 상세 새 탭의 파라미터 파싱 */
export function getDetailParams(): { kind: DetailKind; key: string } | null {
  if (!isDetailTab()) return null;
  const qs = new URLSearchParams(window.location.hash.slice(PREFIX.length));
  const kind = qs.get('kind');
  const key = qs.get('key');
  if ((kind !== 'patent' && kind !== 'paper') || !key) return null;
  return { kind, key };
}

/** 상세를 새 탭으로 연다 (팝업 차단 시 false) */
export function openDetailTab(kind: DetailKind, key: string): boolean {
  const base = window.location.href.split('#')[0];
  const win = window.open(`${base}${PREFIX}kind=${kind}&key=${encodeURIComponent(key)}`, '_blank');
  return win !== null;
}
