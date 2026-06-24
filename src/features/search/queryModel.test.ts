// Node 내장 테스트 러너(`node --test`)로 실행 — 신규 의존성 없음.
// TS는 Node v24 타입 스트리핑으로 직접 로드.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldClause, accumulateQuery, applyScope, hasSearchInput,
  type SFieldInput,
} from './queryModel.ts';

const text = (code: string, value: string): SFieldInput => ({ code, type: 'text', value });
const date = (code: string, dateFrom: string, dateTo: string): SFieldInput =>
  ({ code, type: 'date-range', value: '', dateFrom, dateTo });

test('fieldClause: 텍스트 필드를 CODE=(값) 절로 변환', () => {
  assert.equal(fieldClause(text('TI', '엔진')), 'TI=(엔진)');
});
test('fieldClause: 값이 공백뿐이면 null', () => {
  assert.equal(fieldClause(text('TI', '   ')), null);
});
test('fieldClause: 일자 범위를 CODE=[from ~ to] 절로 변환', () => {
  assert.equal(fieldClause(date('AD', '20080101', '20081231')), 'AD=[20080101 ~ 20081231]');
});
test('fieldClause: 일자 from/to 모두 비면 null', () => {
  assert.equal(fieldClause(date('AD', '', '')), null);
});

test('accumulateQuery: 기존 검색식에 필드 절을 AND로 누적', () => {
  assert.equal(accumulateQuery('하이브리드', [text('TI', '엔진')]), '하이브리드 AND TI=(엔진)');
});
test('accumulateQuery: 기존 검색식이 비면 필드 절만으로 구성', () => {
  assert.equal(accumulateQuery('', [text('TI', '엔진')]), 'TI=(엔진)');
});
test('accumulateQuery: 여러 필드를 모두 AND로 누적', () => {
  assert.equal(accumulateQuery('(A)', [text('TI', '엔진'), text('AB', '연료')]), '(A) AND TI=(엔진) AND AB=(연료)');
});
test('accumulateQuery: 빈 필드는 건너뛴다', () => {
  assert.equal(accumulateQuery('A', [text('TI', ''), text('AB', '연료')]), 'A AND AB=(연료)');
});
test('accumulateQuery: 기존 검색식 문자열을 보정하지 않는다(공백 보존)', () => {
  assert.equal(accumulateQuery('  하이브리드  ', []), '  하이브리드  ');
});

test('applyScope: 선두 자유검색어에 범위 인덱스를 적용', () => {
  assert.equal(applyScope('하이브리드 자동차', 'KEY_CLI'), 'KEY_CLI=(하이브리드 자동차)');
});
test('applyScope: 이미 필드 지정된 식은 건드리지 않는다', () => {
  assert.equal(applyScope('TI=(엔진)', 'KEY_CLI'), 'TI=(엔진)');
});
test('applyScope: 선두 자유검색어 뒤에 AND 절이 있으면 선두만 감싼다', () => {
  assert.equal(applyScope('하이브리드 AND TI=(엔진)', 'KEY_CLA'), 'KEY_CLA=(하이브리드) AND TI=(엔진)');
});
test('applyScope: 빈 검색식은 그대로', () => {
  assert.equal(applyScope('', 'DSC'), '');
});

test('hasSearchInput: 검색식이 있으면 true', () => {
  assert.equal(hasSearchInput('하이브리드', []), true);
});
test('hasSearchInput: 필드 입력이 있으면 true', () => {
  assert.equal(hasSearchInput('', [text('TI', '엔진')]), true);
});
test('hasSearchInput: 둘 다 비면 false', () => {
  assert.equal(hasSearchInput('   ', [text('TI', '  ')]), false);
});
