import type { BadgeColor } from '../components/ui/Badge';

export function getPatentStatusBadgeColor(status: string): BadgeColor {
  if (status === '등록') return 'green';
  if (status === '심사중' || status === '출원') return 'amber';
  return 'neutral';
}
