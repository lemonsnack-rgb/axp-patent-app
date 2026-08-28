// 한국어 조사 자동 선택 — 마지막 글자의 받침 유무로 결정
// 숫자는 한국어 읽기(영/일/이/삼/사/오/육/칠/팔/구) 기준, 영문 대문자 약어는 알파벳 발음 기준으로 판단한다.
const DIGIT_HAS_JONG: Record<string, boolean> = { '0': true, '1': true, '2': false, '3': true, '4': false, '5': false, '6': true, '7': true, '8': true, '9': false };
// 영문자 끝소리(L, M, N, R은 받침 있음으로 취급: 엘/엠/엔/알)
const LATIN_HAS_JONG = new Set(['l', 'm', 'n', 'r']);

function lastMeaningfulChar(word: string): string {
  const t = word.replace(/[\s)\]}」』"'”’.,]+$/g, '');
  return t.slice(-1);
}

export function hasJongseong(word: string): boolean | null {
  const ch = lastMeaningfulChar(word);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return DIGIT_HAS_JONG[ch];
  if (/[a-zA-Z]/.test(ch)) return LATIN_HAS_JONG.has(ch.toLowerCase());
  return null;
}

/** particle('도 1', '은', '는') → '은' / particle('구성도', '을', '를') → '를' */
export function particle(word: string, withJong: string, withoutJong: string): string {
  const j = hasJongseong(word);
  if (j === null) return `${withJong}(${withoutJong})`;
  return j ? withJong : withoutJong;
}

/** 단어 + 조사 결합 */
export function withParticle(word: string, withJong: string, withoutJong: string): string {
  return `${word}${particle(word, withJong, withoutJong)}`;
}
