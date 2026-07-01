import type { BadgeColor } from '../components/ui/Badge';

export function getPatentStatusBadgeColor(status: string): BadgeColor {
  if (status === '등록') return 'green';
  if (status === '심사중' || status === '출원') return 'amber';
  return 'neutral';
}

// 권리상태별 의미 (뱃지 툴팁·범례용)
export const PATENT_STATUS_DESC: Record<string, string> = {
  '등록': '등록 — 특허권이 설정등록되어 현재 존속 중인 상태',
  '심사중': '심사중 — 출원 후 심사가 진행 중인 상태(권리 미발생)',
  '공개': '공개 — 출원이 공개된 상태(심사 전/중, 권리 미발생)',
  '거절': '거절 — 심사 결과 거절결정된 상태',
  '소멸': '소멸 — 존속기간 만료·포기·취소 등으로 권리가 소멸된 상태',
  '출원': '출원 — 출원이 접수된 상태',
};
export function getPatentStatusDesc(status: string): string {
  return PATENT_STATUS_DESC[status] || status;
}
