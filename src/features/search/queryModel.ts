// 검색식 조립/누적/범위적용 순수 로직 — 「특허검색 동작방식」 §2~§3 구현.
// 검색식 입력창 문자열은 보정하지 않는다 [검색-13]. 필드 입력값만 절 변환 시 trim.

// 범위코드 — 데모(10.77.0.244) 표기 통일: KEY(명칭+요약+독립항) / TAC(명칭+요약+전체청구항) / DSC(상세설명)
export type ScopeTab = 'KEY' | 'TAC' | 'DSC';

export interface SFieldInput {
  code: string;
  type: 'text' | 'date-range' | 'ipc' | 'bool';
  value: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MetaFilter {
  countries: string[];
  docKinds: string[];
  statusAll: boolean;
  statusActive: string[];
  statusInactive: string[];
  periodChip: string;
  periodFrom: string;
  periodTo: string;
}

// 필드 하나를 검색식 절로 변환. 비어 있으면 null.
export function fieldClause(f: SFieldInput): string | null {
  if (f.type === 'date-range') {
    const from = (f.dateFrom || '').trim();
    const to = (f.dateTo || '').trim();
    if (!from && !to) return null;
    return `${f.code}:([${from} ~ ${to}])`;
  }
  // 유무(Y/N) 필드 — 있음/없음 각각 선택. 한쪽만 선택 시 그 조건, 둘 다/둘 다 아님=전체(조건 없음)
  if (f.type === 'bool') {
    const y = f.value.includes('Y');
    const n = f.value.includes('N');
    if (y && !n) return `${f.code}:(Y)`;
    if (n && !y) return `${f.code}:(N)`;
    return null;
  }
  const v = f.value.trim();
  if (!v) return null;
  return `${f.code}:(${v})`;
}

// 기존 검색식(current)에 필드 절들을 AND로 누적 [검색-60·61].
// current 문자열은 보정하지 않는다 [검색-13].
export function accumulateQuery(current: string, fields: SFieldInput[]): string {
  const clauses = fields.map(fieldClause).filter((c): c is string => c !== null);
  if (clauses.length === 0) return current;
  if (current === '') return clauses.join(' AND ');
  return [current, ...clauses].join(' AND ');
}

// 선두 토큰이 필드 지정 식인지 검사 (CODE=(...) 또는 CODE:...).
function startsWithFieldOperator(query: string): boolean {
  return /^\s*[A-Za-z_][A-Za-z0-9_]*\s*[:=]/.test(query);
}

// 검색 범위(모드)를 선두 자유검색어에만 적용 [검색-20~22].
// 사용자가 필드 지정 전문가 검색식을 쓴 경우 건드리지 않는다 [검색-22].
// scope는 특허(ScopeTab) 또는 논문(예: 'TI_AB') 범위코드 문자열.
export function applyScope(query: string, scope: ScopeTab | string): string {
  if (query.trim() === '') return query;
  if (startsWithFieldOperator(query)) return query;

  // 선두 자유검색어 = 첫 boolean 연산자( AND/OR/NOT ) 또는 필드절 이전까지.
  const m = query.match(/^(.*?)(\s+(?:AND|OR|NOT)\s+.*)$/i);
  if (m) {
    return `${scope}:(${m[1].trim()})${m[2]}`;
  }
  return `${scope}:(${query.trim()})`;
}

// 검색식 또는 필드 입력 중 하나라도 값이 있으면 true [검색-51].
export function hasSearchInput(formula: string, fields: SFieldInput[]): boolean {
  if (formula.trim() !== '') return true;
  return fields.some(f => fieldClause(f) !== null);
}
