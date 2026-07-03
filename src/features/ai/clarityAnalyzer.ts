/**
 * AI 프롬프트 명확도 분석 모듈
 * TODO: analyzePromptClarity 함수를 실제 API 호출로 교체
 */

export type ClarityResult = 'direct' | 'options';

// ── 명확도 판단 ──────────────────────────────────────────────────────────────
// 실제 구현 시 이 함수를 API 호출로 교체
export function analyzePromptClarity(prompt: string): ClarityResult {
  const DIRECT_PATTERNS = [
    '로 바꿔', '으로 바꿔', '해줘', '으로 수정', '로 수정',
    '삭제해', '추가해', '압축해', '줄여', '늘려', '번역해',
    '한 문장', '두 문장', '간결하게', '짧게', '길게',
  ];
  const isSpecific =
    prompt.length >= 10 &&
    DIRECT_PATTERNS.some(p => prompt.includes(p));
  return isSpecific ? 'direct' : 'options';
}

// ── 방향 선택지 생성 ──────────────────────────────────────────────────────────
// 실제 구현 시 컨텍스트 기반 API 응답으로 교체
export function generateIntentOptions(prompt: string): string[] {
  if (prompt.includes('길게') || prompt.includes('상세') || prompt.includes('늘려')) {
    return ['기술적 세부사항 추가', '예시 포함', '발명의 효과 강조'];
  }
  if (prompt.includes('문체') || prompt.includes('어투') || prompt.includes('톤')) {
    return ['특허 공식 문체', '간결한 기술 문체', '설명적 문체'];
  }
  return ['더 간결하게', '특허 문체로', '구체적 수치 추가'];
}

// ── 수정안 생성 (mock) ────────────────────────────────────────────────────────
// 실제 구현 시 LLM API 호출로 교체
export function generateMockModification(originalText: string, instruction: string): string {
  const trimmed = (instruction.slice(0, 20).trim()) || '요청';
  // 이전 mock 보완 주석을 제거한 뒤 최신 지시를 반영 — 반복 수정 시에도 매번 변경이 보이도록
  // (원문이 '이다.'로 끝나지 않아도 항상 수정된 결과를 반환)
  const base = originalText
    .replace(/\s*—\s*\([^()]*관점 보완\)\s*$/u, '')       // 새 형식 주석 제거
    .replace(/\s*[^.]*관점에서 보완했습니다\.\s*$/u, '')   // 구 형식 주석 제거
    .trimEnd();
  return `${base} — (${trimmed} 관점 보완)`;
}
