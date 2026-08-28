// 구성요소 명칭 하이라이트 — 읽기 모드 텍스트 어디서나 동일 표시 (위저드 청구항·종속항·중간명세서 / 에디터 본문·청구범위)
import React from 'react';
import clsx from 'clsx';
import { buildElementPattern, splitNameAndSymbol } from '../features/spec/elementRename';

export type ElementLike = { value_ko: string; symbol?: string | null; description?: string };

export function ElementText({ text, elements, onClickElement, className }: {
  text: string;
  elements: ElementLike[];
  onClickElement?: (name: string) => void;   // 지정 시 클릭 가능(에디터: 이름 변경 팝업)
  className?: string;
}) {
  const names = elements.map(e => e.value_ko?.trim()).filter(Boolean) as string[];
  const re = buildElementPattern(names);
  if (!re || !text?.trim()) return <>{text}</>;
  const byName = new Map(elements.map(e => [e.value_ko?.trim(), e]));
  const nodes: React.ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) nodes.push(<span key={`t${i++}`}>{text.slice(last, start)}</span>);
    const { name } = splitNameAndSymbol(m[0]);
    const el = byName.get(name);
    const tip = el ? `구성요소${el.symbol ? ` · ${el.symbol}` : ''}${el.description ? ` · ${el.description}` : ''}${onClickElement ? ' — 클릭: 이름 변경' : ''}` : undefined;
    nodes.push(
      <mark
        key={`m${i++}`}
        title={tip}
        onClick={onClickElement ? (e) => { e.stopPropagation(); onClickElement(name); } : undefined}
        className={clsx(
          'bg-transparent text-brand-700 font-medium not-italic',
          // 클릭 가능(전체 이름 변경)한 곳은 점선 밑줄로 '동작 있음'을 표시 — 읽기 전용 하이라이트와 구분
          onClickElement && 'cursor-pointer border-b border-dashed border-brand-400 hover:bg-brand-100 hover:border-solid transition-colors',
          className,
        )}
        style={{ textDecoration: 'none' }}
      >{m[0]}</mark>
    );
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(<span key={`t${i}`}>{text.slice(last)}</span>);
  return <>{nodes}</>;
}
