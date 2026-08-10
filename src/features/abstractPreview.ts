// ── 초록 미리보기 규격 ──────────────────────────────────────────────
// 저작권 보호를 위해 논문 초록은 "전문 노출 금지, 앞부분 일부만 표시"한다.
//
// "N줄"은 화면 폭·폰트·언어에 따라 표시량이 달라져 구현 기준이 될 수 없으므로,
// 표시량을 문자수로 정의한다. 계산식이 아니라 구간표로 기술하므로
// 기획·개발·검수가 같은 숫자를 본다.
//
// 설계 목표
//   G1. 저작권 — 어떤 입력에서도 노출비율이 원문의 50%를 넘지 않는다.
//   G2. 실용   — 검색결과에서 관련성을 판단할 수 있는 분량은 준다.
//                국문 기준 150~200자 ≒ 3~4문장(주제·기존 한계·제안 접근까지 파악 가능).
//   G3. 단순   — 언어별 3구간, 라운드 넘버.
//
// 설계 제약
//   C1. 원문이 길어질수록 표시량이 줄어드는 역전이 없다(구간 경계 단조성).
//   C2. 최소 구간은 고정값을 쓰면 전문에 근접하므로 비율로 처리한다.
//       (예: 상한 30자 규칙에서 원문 31자면 97% 노출 = 사실상 전문)
//   C3. 긴 초록이라고 표시량을 비례해 늘리지 않는다. 관련성 판단에 필요한 분량은
//       원문 길이와 무관하게 일정하고, 노출은 적을수록 저작권 리스크가 낮다.
//
// 언어 보정
//   같은 내용을 영문으로 쓰면 문자수가 늘어난다. 실적재 국문↔영문 제목 1,333쌍
//   실측 팽창비 중앙값 2.61배 → 라틴 문자 초록에는 국문 구간의 약 2.5배를 적용한다.
//   보정이 없으면 영문 행만 1~2문장으로 빈약해진다.

type Band = { minChars: number; maxShown: number };

/** 국문·중일문(CJK) 초록 구간 — minChars 내림차순 */
export const PREVIEW_BANDS_CJK: ReadonlyArray<Band> = [
  { minChars: 600, maxShown: 200 }, // 600자 이상  → 200자
  { minChars: 300, maxShown: 150 }, // 300~599자   → 150자
];

/** 라틴 문자(영문 등) 초록 구간 — CJK 구간의 약 2.5배 */
export const PREVIEW_BANDS_LATIN: ReadonlyArray<Band> = [
  { minChars: 1500, maxShown: 500 }, // 1,500자 이상 → 500자
  { minChars: 750, maxShown: 300 },  //   750~1,499자 → 300자
];

/** 최소 구간(CJK 300자 / 라틴 750자 미만) — 고정값은 전문에 근접하므로 비율로 처리 (C2) */
export const PREVIEW_MIN_BAND_RATIO = 0.4;

/** CJK 판정 임계 — 공백 제외 문자 중 한글·한자·가나 비율이 이 값 이상이면 CJK 구간 적용 */
export const CJK_DETECT_RATIO = 0.2;

/** 잘렸을 때 뒤에 붙는 말줄임 기호 — 표시 문자수에는 포함하지 않는다 */
export const PREVIEW_ELLIPSIS = '…';

// 한글(자모·음절) · 한자 · 히라가나/가타카나
const CJK_RE = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-䶿一-鿿가-힯]/;

export type AbstractScript = 'CJK' | 'LATIN';

/**
 * 표기 문자로 구간표를 고른다.
 * language 메타에 의존하지 않는 이유 — 값 누락·오기가 잦고, 영문초록 필드에 국문이
 * 들어오는 등 필드와 실제 내용이 어긋나는 경우가 있다. 내용으로 판정하면 그 영향을 받지 않는다.
 */
export function detectScript(text: string): AbstractScript {
  const chars = Array.from(text).filter(c => !/\s/.test(c));
  if (chars.length === 0) return 'LATIN';
  const cjk = chars.filter(c => CJK_RE.test(c)).length;
  return cjk / chars.length >= CJK_DETECT_RATIO ? 'CJK' : 'LATIN';
}

/** 원문 문자수 → 표시 상한. 구간표를 그대로 옮긴 함수이므로 표와 코드가 1:1 대응한다. */
export function previewLimit(totalChars: number, script: AbstractScript): number {
  const bands = script === 'CJK' ? PREVIEW_BANDS_CJK : PREVIEW_BANDS_LATIN;
  for (const { minChars, maxShown } of bands) {
    if (totalChars >= minChars) return Math.min(maxShown, totalChars);
  }
  return Math.floor(totalChars * PREVIEW_MIN_BAND_RATIO);
}

export type AbstractPreview = {
  /** 화면에 그릴 문자열 (잘린 경우 말줄임 포함) */
  text: string;
  /** 잘렸는지 여부 — 안내 문구 노출 조건 */
  truncated: boolean;
  /** 적용된 구간표 */
  script: AbstractScript;
  /** 원문 문자수 */
  totalChars: number;
  /** 말줄임을 제외한 실제 표시 문자수 */
  shownChars: number;
};

/**
 * 초록 원문을 미리보기 규격으로 자른다.
 *
 * 국문 예) 800자 → 200자(25%) · 400자 → 150자(38%) · 250자 → 100자(40%)
 * 영문 예) 2,000자 → 500자(25%) · 1,000자 → 300자(30%) · 600자 → 240자(40%)
 */
export function abstractPreview(raw?: string | null): AbstractPreview {
  const source = (raw ?? '').trim();
  // Array.from — 이모지·서로게이트 페어를 한 글자로 세기 위해 코드포인트 단위로 분해
  const chars = Array.from(source);
  const total = chars.length;
  const script = detectScript(source);
  if (total === 0) return { text: '', truncated: false, script, totalChars: 0, shownChars: 0 };

  const limit = previewLimit(total, script);
  if (limit <= 0) {
    // 원문이 2자 이하면 비율상 표시할 분량이 없다 — 전문 노출을 막기 위해 아무것도 내보내지 않는다
    return { text: '', truncated: true, script, totalChars: total, shownChars: 0 };
  }

  const shown = chars.slice(0, limit).join('').trimEnd();
  const shownCount = Array.from(shown).length;
  const truncated = shownCount < total;
  return {
    text: truncated ? shown + PREVIEW_ELLIPSIS : shown,
    truncated,
    script,
    totalChars: total,
    shownChars: shownCount,
  };
}
