// 단어 단위 diff 계산 — 에디터 제안 카드·위저드 AI 수정 제안 카드 공용 (U16)
export type DiffSeg = { text: string; type: 'same' | 'removed' | 'added' };

export function diffWords(source: string, target: string): { before: DiffSeg[]; after: DiffSeg[]; merged: DiffSeg[] } {
  const tok = (s: string) => s.split(/(\s+)/).filter(t => t.length > 0);
  const a = tok(source), b = tok(target);
  // 아주 긴 텍스트는 diff 생략 (성능)
  if (a.length * b.length > 250000) {
    return {
      before: [{ text: source, type: 'removed' }],
      after: [{ text: target, type: 'added' }],
      merged: [{ text: source, type: 'removed' }, { text: ' ', type: 'same' }, { text: target, type: 'added' }],
    };
  }
  const m = a.length, n = b.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const before: DiffSeg[] = [], after: DiffSeg[] = [], merged: DiffSeg[] = [];
  const push = (arr: DiffSeg[], text: string, type: DiffSeg['type']) => {
    const last = arr[arr.length - 1];
    if (last && last.type === type) last.text += text;
    else arr.push({ text, type });
  };
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { push(before, a[i], 'same'); push(after, b[j], 'same'); push(merged, a[i], 'same'); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push(before, a[i], 'removed'); push(merged, a[i], 'removed'); i++; }
    else { push(after, b[j], 'added'); push(merged, b[j], 'added'); j++; }
  }
  while (i < m) { push(before, a[i], 'removed'); push(merged, a[i], 'removed'); i++; }
  while (j < n) { push(after, b[j], 'added'); push(merged, b[j], 'added'); j++; }
  return { before, after, merged };
}

