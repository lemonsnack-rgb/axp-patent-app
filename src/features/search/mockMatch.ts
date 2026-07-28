// 목업 검색 매칭 — 검색식에서 키워드를 뽑아 시드 문헌과 대조한다.
// 실데이터 연동 시에는 필드별 인덱스 검색(검색 API)으로 대체된다.
// JSX가 없는 순수 모듈로 두어 `node --test`에서 직접 검증할 수 있게 한다.
import type { PatentResult } from '../../types';

/** 검색식에서 하이라이트·매칭용 키워드를 추출한다(필드코드·불리언 연산자·와일드카드 제거). */
export function parseKeywords(query: string): string[] {
  if (!query) return [];
  const cleaned = query
    .replace(/[A-Z_]+\s*[:=]\s*\(/g, ' ')   // CODE:( 또는 CODE=( 제거
    .replace(/[A-Z_]+\s*[:=]/g, ' ')        // CODE: 또는 CODE= 제거
    .replace(/\b(AND|OR|NOT|ADJ|NEAR|KEY|TAC|DSC)\b/gi, ' ')
    .replace(/[()[\]~:*?"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set(
    cleaned.split(' ').map(w => w.trim()).filter(w => w.length > 1)
  )].slice(0, 10);
}

// 매칭 대상 텍스트 — 검색 UI가 제공하는 필드별 검색 예시(명칭·요약·청구항·상세설명·
// 번호·인명·주소·분류)가 실제로 결과를 내도록 해당 필드를 모두 포함한다.
const hayCache = new WeakMap<PatentResult, string>();

/** 문헌 1건의 검색 대상 텍스트(소문자). */
export function searchHay(p: PatentResult): string {
  const cached = hayCache.get(p);
  if (cached !== undefined) return cached;
  const hay = [
    p.title, p.abstract, p.repClaim, p.description,
    p.applicant, p.repApplicant, p.inventors, p.agent, p.examiner,
    p.applicantAddress, p.inventorAddress, p.agentAddress,
    p.number, p.applicationNo, p.publicationNo, p.registerNo,
    p.ipc, p.cpc, ...(p.ipcList ?? []), ...(p.cpcList ?? []),
    ...(p.claims ?? []).map(c => c.text),
  ].filter(Boolean).join(' ').toLowerCase();
  hayCache.set(p, hay);
  return hay;
}

/** 키워드 전부 포함(AND). 검색식의 AND/OR 구분은 목업 범위 밖이다. */
export function matchesKeywords(p: PatentResult, keywords: string[]): boolean {
  const hay = searchHay(p);
  return keywords.every(k => hay.includes(k.toLowerCase()));
}

// ── 일자 범위 절 ──
// 항목별 상세검색의 일자 필드는 `CODE:([from ~ to])` 절로 누적된다(queryModel.fieldClause).
// 일자는 키워드 포함 검사로는 걸러지지 않으므로 범위 비교로 따로 처리한다.
const DATE_FIELD_BY_CODE: Record<string, 'applicationDate' | 'publicationDate' | 'registerDate' | 'priorityDate'> = {
  AD: 'applicationDate',   // 출원일
  PD: 'publicationDate',   // 공개일/특허일
  RD: 'registerDate',      // 등록일
  FD: 'publicationDate',   // 공고일
  PRD: 'priorityDate',     // 우선권 주장일
  IAD: 'applicationDate',  // 국제출원일
  IPD: 'publicationDate',  // 국제공개일
};

export interface DateRange { field: 'applicationDate' | 'publicationDate' | 'registerDate' | 'priorityDate'; from: string; to: string }

const RANGE_RE = /\b([A-Z_]+)\s*[:=]\s*\(\s*\[([^\]]*)~([^\]]*)\]\s*\)/g;
const digits = (s: string) => (s || '').replace(/\D/g, '');

/** 검색식에서 일자 범위 절을 뽑아내고, 나머지(키워드 검사 대상) 문자열을 함께 돌려준다. */
export function extractDateRanges(query: string): { ranges: DateRange[]; rest: string } {
  const ranges: DateRange[] = [];
  const rest = (query || '').replace(RANGE_RE, (whole, code: string, from: string, to: string) => {
    const field = DATE_FIELD_BY_CODE[code];
    if (!field) return whole;                       // 일자 필드가 아니면 그대로 둔다
    ranges.push({ field, from: digits(from), to: digits(to) });
    return ' ';
  });
  return { ranges, rest };
}

/** 일자 범위 절을 모두 만족하는지(값이 없으면 제외). */
export function matchesDateRanges(p: PatentResult, ranges: DateRange[]): boolean {
  return ranges.every(r => {
    const v = digits(p[r.field] ?? '');
    if (!v) return false;
    if (r.from && v < r.from) return false;
    if (r.to && v > r.to) return false;
    return true;
  });
}
