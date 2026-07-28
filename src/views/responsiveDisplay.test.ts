// 반응형 표시 클래스 규약 검사 — Node 내장 테스트 러너(`node --test`)로 실행.
//
// 금지 패턴: 기본 `hidden` + 브레이크포인트 변형(`md:block` 등)의 조합.
//   <div className="hidden md:block">   ← 금지
//   <div className="max-md:hidden md:block">  ← 권장
//
// 이유: 앞의 형태는 `.hidden{display:none}`(기본 유틸리티)을 뒤의 변형 규칙이
// 소스 순서로 덮어쓰는 데 의존한다. 같은 우선순위의 `.hidden{display:none}` 이
// 문서 스타일시트보다 나중에 적용되는 환경(브라우저 확장 프로그램이 모든 페이지에
// 주입하는 경우 등)에서는 변형이 지고 요소가 계속 숨겨진다.
// 실제로 검색 결과 표(`PAT-LST-020`)가 이 패턴 때문에 목록 건수만 보이고
// 행이 전혀 렌더되지 않는 장애가 있었다. `max-*:hidden` 은 기본 `hidden` 을
// 쓰지 않으므로 외부 주입에 영향받지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

// 기본 hidden 뒤에 브레이크포인트 표시 변형이 붙는 조합 (같은 className 문자열 안).
// 앞에 `:`/`-` 가 붙은 경우(`max-md:hidden`)는 변형이므로 제외한다.
const BAD = /(?<![-:\w])hidden\s+(sm|md|lg|xl|2xl):(block|flex|grid|inline|inline-block|inline-flex|table|contents)\b/;

test('기본 hidden + 브레이크포인트 표시 변형 조합을 쓰지 않는다 (max-*:hidden 사용)', () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      const m = BAD.exec(line);
      if (m) offenders.push(`${relative(SRC, file).replace(/\\/g, '/')}:${i + 1}  "${m[0]}"`);
    });
  }
  assert.deepEqual(
    offenders, [],
    `기본 hidden + 변형 조합 발견 — max-<bp>:hidden 으로 바꿀 것:\n  ${offenders.join('\n  ')}`,
  );
});
