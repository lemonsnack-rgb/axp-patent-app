// 문서 보존 정책 — 마지막 수정일로부터 1년 (2026-09-10 회의 5절, 2026-09-11 사용자 확정)
//
// 보존 기간이 지난 작업은 목록에서 지우지 않고 **보이되 열 수 없게** 한다. 구독 체계가 생기면
// 구독 상태에 따라 재정의할 자리라, 판정은 이 파일 한 곳에 둔다.
// 고지 문구는 두지 않기로 함(사용자 결정) — 잠금 배지와 툴팁으로만 알린다.

import type { Task } from '../types';

/** 보존 기간(일). 1년 = 365일 */
export const RETENTION_DAYS = 365;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** 마지막 수정일 기준으로 보존 기간이 지났는지 — 계속 작업 중인 문서는 살아 있다 */
export function isRetentionExpired(t: Pick<Task, 'updatedAt'>, now: number = Date.now()): boolean {
  if (!t?.updatedAt) return false;
  return now - t.updatedAt > RETENTION_MS;
}

/** 잠긴 이유 안내 — 배지 툴팁·토스트 공용 */
export function retentionLockReason(t: Pick<Task, 'updatedAt'>): string {
  const d = new Date(t.updatedAt);
  const ymd = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  return `보관 기간(${RETENTION_DAYS}일)이 지나 열 수 없습니다. 마지막 수정 ${ymd} · 삭제는 가능합니다.`;
}
