export function getPatentStatusBadgeClass(status: string): string {
  if (status === '등록') return 'badge-green';
  if (status === '심사중' || status === '출원') return 'badge-amber';
  return 'badge-gray';
}
