// 검색 UI의 "검색 예시"가 실제로 결과를 내는지 검사 — Node 내장 테스트 러너.
//
// 검색어 입력 화면은 검색식 입력창 placeholder와 항목별 상세검색 필드 hint로
// 예시를 제시한다. 이 예시대로 검색했는데 0건이면 데모가 동작하지 않는 것처럼 보인다.
// (실제로 예시 13종 전부가 시드에 없는 값이라 0건이던 이력이 있다.)
// 예시 문자열은 소스에서 직접 읽어 검사하므로, 예시를 바꾸면 이 테스트가 함께 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PATENT_SEED } from '../../data/patentSeed.ts';
import { parseKeywords, matchesKeywords, extractDateRanges, matchesDateRanges } from './mockMatch.ts';
import { fieldClause, applyScope, type SFieldInput } from './queryModel.ts';

const root = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (rel: string) => readFileSync(root + rel, 'utf8');

/** 예시 문자열에서 안내 접두(`예: `)를 떼어낸다. */
const strip = (s: string) => s.replace(/^예\s*:\s*/, '').trim();

// PatentResults 의 결과 산출과 같은 경로: 일자 범위 절 분리 → 나머지로 키워드 매칭.
function hits(query: string): number {
  const { ranges, rest } = extractDateRanges(query);
  const kws = parseKeywords(rest);
  if (kws.length === 0 && ranges.length === 0) return PATENT_SEED.length;   // 빈 검색 = 전체
  return PATENT_SEED.filter(p => matchesKeywords(p, kws) && matchesDateRanges(p, ranges)).length;
}

// ── 예시 수집 ──
const inputSrc = read('views/PatentInput.tsx');
const fieldsSrc = read('data/patentFields.ts');

// 1) 검색식 입력창 placeholder (자유검색 → 범위코드 적용 후 실행)
const freeExamples = [...inputSrc.matchAll(/placeholder="(예:[^"]+)"/g)].map(m => strip(m[1]));

// 2) 항목별 상세검색 필드 hint — code와 함께 수집
const fieldExamples = [...inputSrc.matchAll(/\{\s*code:\s*'([A-Z_]+)'[^}]*?hint:\s*'([^']+)'/g)]
  .map(m => ({ code: m[1], value: strip(m[2]) }));

// 3) 검색어 입력 화면의 기본 검색필드 placeholder(patentFields.ts의 PATENT_FIELDS_BASE)
//    확장 필드(PATENT_FIELDS_EXT)의 ph는 '있음 / 없음', 'KR | US | JP'처럼
//    선택지·허용값 안내라서 검색어 예시가 아니므로 대상에서 제외한다.
const baseBlock = fieldsSrc.slice(
  fieldsSrc.indexOf('PATENT_FIELDS_BASE'),
  fieldsSrc.indexOf('PATENT_FIELDS_EXT'),
);
const phExamples = [...baseBlock.matchAll(/code:\s*'([A-Z_]+)'[^}]*?ph:\s*'([^']*)'/g)]
  .map(m => ({ code: m[1], value: strip(m[2]) }))
  .filter(e => e.value && !/^최근 N년$/.test(e.value));

// 일자 범위 예시(`2025-01-01 ~ 2025-12-31`)는 일자 필드로 넘겨 범위 절로 검사한다.
const isDateExample = (v: string) => /~/.test(v) && /\d{4}/.test(v);
function dateClause(code: string, v: string): string {
  const [from, to] = v.split('~').map(s => s.trim());
  return fieldClause({ code, type: 'date-range', value: '', dateFrom: from, dateTo: to } as SFieldInput) ?? '';
}

test('예시를 수집했다 (수집 자체가 깨지면 이 테스트가 무력화되므로 함께 확인)', () => {
  assert.ok(freeExamples.length >= 1, `검색식 placeholder 예시 미수집`);
  assert.ok(fieldExamples.length >= 10, `필드 hint 예시 미수집: ${fieldExamples.length}건`);
  assert.ok(phExamples.length >= 3, `기본 필드 placeholder 예시 미수집: ${phExamples.length}건`);
});

test('검색식 입력창 placeholder 예시로 검색하면 1건 이상 나온다', () => {
  const zero = freeExamples
    .map(v => ({ v, n: hits(applyScope(v, 'KEY')) }))
    .filter(r => r.n === 0);
  assert.deepEqual(zero, [], `0건 예시:\n  ${zero.map(r => `"${r.v}"`).join('\n  ')}`);
});

test('항목별 상세검색 필드 예시로 검색하면 1건 이상 나온다', () => {
  const zero = fieldExamples
    .map(e => {
      const clause = isDateExample(e.value)
        ? dateClause(e.code, e.value)
        : fieldClause({ code: e.code, type: 'text', value: e.value } as SFieldInput) ?? '';
      return { ...e, n: hits(clause) };
    })
    .filter(r => r.n === 0);
  assert.deepEqual(zero, [], `0건 예시:\n  ${zero.map(r => `${r.code} "${r.value}"`).join('\n  ')}`);
});

test('검색어 입력 기본 필드 placeholder 예시로 검색하면 1건 이상 나온다', () => {
  const zero = phExamples
    .map(e => {
      const clause = isDateExample(e.value)
        ? dateClause(e.code, e.value)
        : fieldClause({ code: e.code, type: 'text', value: e.value } as SFieldInput) ?? '';
      return { ...e, n: hits(clause) };
    })
    .filter(r => r.n === 0);
  assert.deepEqual(zero, [], `0건 예시:\n  ${zero.map(r => `${r.code} "${r.value}"`).join('\n  ')}`);
});
