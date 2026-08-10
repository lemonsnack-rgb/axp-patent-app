// ── 초록 미리보기 규격 ──────────────────────────────────────────────
// 저작권 보호를 위해 논문 초록은 "전문 노출 금지, 앞부분 일부만 표시"한다.
//
// "N줄"은 화면 폭·폰트·언어에 따라 표시량이 달라져 구현 기준이 될 수 없으므로,
// 표시량을 문자수로 정의한다. 두 조건을 동시에 만족하는 길이만 노출한다.
//
//   1) 상한   — 최대 PREVIEW_MAX_CHARS 자
//   2) 비율   — 원문 길이의 PREVIEW_MAX_RATIO 이하
//
// 비율 조건이 필요한 이유: 상한만 두면 원문이 상한보다 짧을 때 전문이 그대로
// 노출된다(= 저작권 목적 미달). 두 조건의 min을 취하므로 결과는 항상 원문보다 짧다.

/** 최대 표시 문자수 — 공백 포함, 유니코드 코드포인트 기준(한글·영문 동일 계산) */
export const PREVIEW_MAX_CHARS = 100;

/** 원문 대비 최대 표시 비율 — 짧은 초록의 전문 노출 방지 */
export const PREVIEW_MAX_RATIO = 0.5;

/** 잘렸을 때 뒤에 붙는 말줄임 기호 — 표시 문자수에는 포함하지 않는다 */
export const PREVIEW_ELLIPSIS = '…';

export type AbstractPreview = {
  /** 화면에 그릴 문자열 (잘린 경우 말줄임 포함) */
  text: string;
  /** 잘렸는지 여부 — 안내 문구 노출 조건 */
  truncated: boolean;
  /** 원문 문자수 */
  totalChars: number;
  /** 말줄임을 제외한 실제 표시 문자수 */
  shownChars: number;
};

/**
 * 초록 원문을 미리보기 규격으로 자른다.
 *
 * 계산: shown = min(PREVIEW_MAX_CHARS, floor(총 문자수 × PREVIEW_MAX_RATIO))
 *
 * 예) 총 600자 → min(100, 300) = 100자 표시
 *     총 120자 → min(100,  60) =  60자 표시
 *     총  10자 → min(100,   5) =   5자 표시
 */
export function abstractPreview(raw?: string | null): AbstractPreview {
  const source = (raw ?? '').trim();
  // Array.from — 이모지·서로게이트 페어를 한 글자로 세기 위해 코드포인트 단위로 분해
  const chars = Array.from(source);
  const total = chars.length;
  if (total === 0) return { text: '', truncated: false, totalChars: 0, shownChars: 0 };

  const limit = Math.min(PREVIEW_MAX_CHARS, Math.floor(total * PREVIEW_MAX_RATIO));
  if (limit <= 0) {
    // 원문이 1자뿐이면 비율상 표시할 분량이 없다 — 전문 노출을 막기 위해 아무것도 내보내지 않는다
    return { text: '', truncated: true, totalChars: total, shownChars: 0 };
  }

  const shown = chars.slice(0, limit).join('').trimEnd();
  return {
    text: shown + PREVIEW_ELLIPSIS,
    truncated: true,
    totalChars: total,
    shownChars: Array.from(shown).length,
  };
}
