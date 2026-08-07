// 특허 상세페이지 표시 규칙 — 실데이터 QC(1,804건 전수)에서 확정된 것만 모은다.
// 화면 컴포넌트와 테스트가 같은 함수를 쓰도록 순수 함수로 분리한다.
// 근거: docs/QC-상세페이지-적재데이터-대조.md

// 문헌종류 코드 → 라벨. 관측된 코드만 매핑하고 나머지는 원값을 그대로 둔다(추정 금지).
//   실데이터 관측: B1 1,801건 · Y1 3건. 공개계(A·U)는 미적재라 도메인 미확정.
export const DOC_KIND_LABEL: Record<string, string> = {
  B1: '등록특허공보',
  Y1: '등록실용신안공보',
};

export function docKindLabel(code?: string): string | undefined {
  if (!code) return undefined;
  return DOC_KIND_LABEL[code] ?? code;
}

// 공개/공고번호 계열 판정 — 번호 형식으로 라벨을 정하고 짝이 되는 일자를 맞춘다.
//   10-YYYY-NNNNNNN → 공개번호(짝: open_date)   · 985건
//   WO YYYY/NNNNNN  → 국제공개번호(짝: open_date) · 113건
//   10-NNNNNNN      → 공고번호(짝: publication_date · 등록번호와 값 동일) · 314건
//   없음            → 행 숨김 · 392건
export function pubSeriesLabel(no?: string): string {
  const s = (no || '').trim();
  if (/^\d{2}-\d{4}-\d{7}$/.test(s)) return '공개번호';
  if (/^WO \d{4}\/\d{6}$/.test(s)) return '국제공개번호';
  if (/^\d{2}-\d{7}$/.test(s)) return '공고번호';
  return '공개번호';
}

// 문헌번호에서 국가 접두 제거 — 국가는 배지로 따로 표시하므로 번호에 중복 노출하지 않는다.
//   'KR 10-2620137 B1' → '10-2620137 B1'
export const stripCountry = (s: string): string => (s || '').replace(/^[A-Z]{2}\s+/, '');

// 삭제된 청구항 — 본문이 '삭제' 한 단어인 항.
//   실데이터 4,323항 / 1,237문헌(68%). 전건 dependsOn 이 없어 걸러내지 않으면 독립항으로 분류된다.
export const isDeletedClaim = (text: string): boolean => /^\s*삭제\s*\.?\s*$/.test(text || '');

// 패밀리 정규화 키 — 같은 문헌이 선행 0 패딩 차이로 중복 적재된 경우(195문헌·10%)를 합친다.
//   'EP 3276698 B1' 과 'EP 03276698 B1' 은 같은 문헌.  종류코드가 다르면(A1/A4) 다른 문헌이다.
export function familyKey(country: string, docNumber: string): string {
  const m = (docNumber || '').trim().match(/^([A-Z]{2}\s*)?([A-Z]*)\s*0*([0-9][0-9-]*)\s*(.*)$/);
  return m ? `${country}|${m[2]}|${m[3].replace(/-/g, '')}|${m[4]}` : `${country}|${docNumber}`;
}

// 패밀리 국가별 건수 — 총건수를 기계적으로 배분하던 파생을 폐기하고 실제 목록에서 집계한다.
export function familyCounts(list?: { country: string; docNumber: string }[]): [string, number][] {
  if (!list?.length) return [];
  const seen = new Set<string>();
  const m = new Map<string, number>();
  for (const f of list) {
    const key = familyKey(f.country, f.docNumber);
    if (seen.has(key)) continue;
    seen.add(key);
    m.set(f.country, (m.get(f.country) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// 권리변동(서지 셀) — has_ownership_change 는 채움률 0%이므로 이력 배열 유무로 판정한다.
export const rightChangeCell = (list?: unknown[]): string => ((list?.length ?? 0) > 0 ? '있음' : '');
