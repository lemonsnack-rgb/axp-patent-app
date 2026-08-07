// 특허 상세페이지 표시 규칙 — 실데이터 QC(1,804건 전수)에서 확정된 것만 모은다.
// 화면 컴포넌트와 테스트가 같은 함수를 쓰도록 순수 함수로 분리한다.
// 근거: docs/QC-상세페이지-적재데이터-대조.md

// 문헌종류 코드 → 라벨. 관측된 코드만 매핑하고 나머지는 원값을 그대로 둔다(추정 금지).
//   실데이터 관측: B1 1,801건 · Y1 3건. 공개계(A·U)는 미적재라 도메인 미확정.
export const DOC_KIND_LABEL: Record<string, string> = {
  B1: '등록특허공보',
  Y1: '등록실용신안공보',
  // 공개계 — 현재 적재분(등록계 1,804건)에서는 관측되지 않았다.
  // 코드 자체는 표준이라 목업에는 반영하되, 구현 시에는 공개 문헌 적재 후 실제 코드값을 확인하고 넣는다.
  A: '공개특허공보',
  U: '공개실용신안공보',
};

export function docKindLabel(code?: string): string | undefined {
  if (!code) return undefined;
  return DOC_KIND_LABEL[code] ?? code;
}

// 공개/공고번호 계열 판정 — 번호 형식으로 라벨을 정한다.
//   10-YYYY-NNNNNNN → 공개번호   · 985건
//   WO YYYY/NNNNNN  → 국제공개번호 · 113건
//   10-NNNNNNN      → 공고번호   · 314건 (등록번호와 값 동일)
//   없음            → 행 숨김   · 392건
export function pubSeriesLabel(no?: string): string {
  const s = (no || '').trim();
  if (/^\d{2}-\d{4}-\d{7}$/.test(s)) return '공개번호';
  if (/^WO \d{4}\/\d{6}$/.test(s)) return '국제공개번호';
  if (/^\d{2}-\d{7}$/.test(s)) return '공고번호';
  return '공개번호';
}

const isYmd = (s?: string): boolean => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// 공고는 등록 이후에 나온다 → 이 조건을 통과해야만 publication_date 를 '공고일'로 쓸 수 있다.
//   실데이터에서 조건을 깨는 값이 115건 있다: WO 국제공개 113건(값은 국제공개일) + 실용신안 2건(값은 공개일).
//   등록일이 없거나 '-'·'—' 같은 자리표시자면 비교하지 않는다(문자열 비교가 잘못 통과한다).
export const isBulletinDate = (pubDate?: string, regDate?: string): boolean =>
  isYmd(pubDate) && isYmd(regDate) && (pubDate as string) >= (regDate as string);

// 공개/국제공개/공고 — 계열마다 행을 따로 둔다. 라벨이 고정되므로 한 칸이 여러 의미를 갖지 않는다.
//   값이 없는 행은 렌더하지 않는다(BibRow hideEmpty 와 같은 규칙).
//   판정은 '어느 행에 넣을지' 뿐이다:
//     WO 번호            → 국제공개일 = publication_date
//     공고일 조건 충족    → 공고일     = publication_date   (publication_date >= register_date)
//     그 외              → 공개일     = publication_date   (open_date 가 없을 때만 · 실용신안 2건)
export type BibRowTuple = [string, string, string, string];

export function pubRows(pubNo?: string, pubDate?: string, openDate?: string, regDate?: string): BibRowTuple[] {
  const no = (pubNo || '').trim();
  const pd = (pubDate || '').trim();
  const od = (openDate || '').trim();
  const bulletin = isBulletinDate(pd, regDate);
  const isWo = /^WO \d{4}\/\d{6}$/.test(no);
  const isOpenNo = /^\d{2}-\d{4}-\d{7}$/.test(no);
  const isRegNo = /^\d{2}-\d{7}$/.test(no);

  // publication_date 가 공고일도 국제공개일도 아니면 공개일이다(원본 open_date 결손 보완)
  const openDateVal = od || (!bulletin && !isWo && pd ? pd : '');

  // 계열별로 '있는 값'만 모아 왼쪽부터 채운다 — 빈 칸이 앞에 오면 오류처럼 보인다.
  const series: [string, string][][] = [
    [['공개번호', isOpenNo ? no : ''], ['공개일', openDateVal]],
    [['국제공개번호', isWo ? no : ''], ['국제공개일', isWo ? pd : '']],
    [['공고번호', isRegNo ? no : ''], ['공고일', bulletin ? pd : '']],
  ];

  const rows: BibRowTuple[] = [];
  for (const pairs of series) {
    const filled = pairs.filter(([, v]) => v);
    if (!filled.length) continue;                                  // 계열 자체가 없으면 행도 없다
    const [l1, v1] = filled[0];
    const [l2, v2] = filled[1] ?? ['', ''];
    rows.push([l1, v1, l2, v2]);
  }
  return rows;
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

// 패밀리 목록 중복 제거 — 표시 목록과 집계가 같은 기준을 쓰도록 한 함수로 둔다.
export function dedupeFamily<T extends { country: string; docNumber: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter(f => {
    const key = familyKey(f.country, f.docNumber);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
