// 상세페이지 표시 규칙 회귀 테스트 — 실데이터 QC에서 확정된 규칙이 되돌아가지 않게 고정한다.
// 근거: docs/QC-상세페이지-적재데이터-대조.md (1,804건 전수 관측)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docKindLabel, pubSeriesLabel, stripCountry, isDeletedClaim, familyCounts, rightChangeCell } from './patentDetailRules.ts';

test('문헌종류: 코드를 그대로 노출하지 않고 라벨로 치환한다', () => {
  assert.equal(docKindLabel('B1'), '등록특허공보');   // KR 10-2620137 B1
  assert.equal(docKindLabel('Y1'), '등록실용신안공보'); // KR 20-0497874 Y1
});

test('문헌종류: 미관측 코드는 추정하지 않고 원값을 둔다', () => {
  assert.equal(docKindLabel('A'), 'A');
  assert.equal(docKindLabel(undefined), undefined);
});

test('공개/공고번호: 번호 형식으로 계열 라벨을 정한다', () => {
  assert.equal(pubSeriesLabel('10-2023-0126008'), '공개번호');      // KR 10-2620137 B1
  assert.equal(pubSeriesLabel('WO 2011/146808'), '국제공개번호');   // KR 10-2635013 B1
  assert.equal(pubSeriesLabel('10-2620137'), '공고번호');
});

test('문헌번호: 국가 접두를 제거한다(국가는 배지로 표시)', () => {
  assert.equal(stripCountry('KR 10-2620137 B1'), '10-2620137 B1');
  assert.equal(stripCountry('10-2620137 B1'), '10-2620137 B1');
});

test('청구항: 본문이 삭제인 항을 판별한다', () => {
  assert.equal(isDeletedClaim('삭제'), true);
  assert.equal(isDeletedClaim(' 삭제. '), true);
  assert.equal(isDeletedClaim('삭제된 구성을 포함하는 장치.'), false);
});

test('청구항: 삭제항을 거르면 독립항 목록에 남지 않는다', () => {
  // KR 10-2620415 B1 축약 — 46항 중 45항이 삭제, 실질 독립항은 1개
  const claims = [
    { no: 1, text: '삭제' },
    { no: 2, text: '삭제' },
    { no: 20, text: '비휘발성 메모리 시스템으로서, …' },
  ];
  const alive = claims.filter(c => !isDeletedClaim(c.text));
  assert.equal(alive.length, 1);
  assert.equal(alive[0].no, 20);
});

test('패밀리: 국가별 건수를 실제 목록에서 집계한다(기계 배분 금지)', () => {
  // KR 10-2620084 B1 — 8건 중 EP 1쌍이 0 패딩 차이로 중복 → 7건
  const list = [
    { country: 'TW', docNumber: 'TW 201804875 A' },
    { country: 'US', docNumber: 'US 10483474 B2' },
    { country: 'EP', docNumber: 'EP 3276698 B1' },
    { country: 'EP', docNumber: 'EP 03276698 B1' },
    { country: 'CN', docNumber: 'CN 107665952 B' },
    { country: 'CN', docNumber: 'CN 107665952 A' },
    { country: 'JP', docNumber: 'JP 2018-019083 A' },
    { country: 'JP', docNumber: 'JP 06715805 B2' },
  ];
  const counts = familyCounts(list);
  const total = counts.reduce((s, [, n]) => s + n, 0);
  assert.equal(total, 7);
  assert.deepEqual(counts.find(([cc]) => cc === 'EP'), ['EP', 1]);
  assert.deepEqual(counts.find(([cc]) => cc === 'CN'), ['CN', 2]); // 종류코드가 다르면 다른 문헌
});

test('패밀리: 목록이 없으면 국가 탭을 만들지 않는다', () => {
  assert.deepEqual(familyCounts(undefined), []);
  assert.deepEqual(familyCounts([]), []);
});

test('권리변동: 0% 필드가 아니라 이력 유무로 판정한다', () => {
  assert.equal(rightChangeCell([{ date: '2023-12-29', name: '네스트필드(주)' }]), '있음');
  assert.equal(rightChangeCell([]), '');
  assert.equal(rightChangeCell(undefined), '');
});
