// src/features/spec/mockAiService.ts
import type { InventionInput, SpecComponentItem, SpecDrawingItem } from './types';

export function generateTitleCandidates(input: InventionInput): string[] {
  const { title, field } = input;
  return [
    `${field} 기반 ${title} 장치 및 방법`,
    `인공지능을 이용한 ${title} 시스템`,
    `${title}을 위한 ${field} 처리 방법`,
  ];
}

export function generateDescriptionSection(
  sectionKey: 'tech' | 'bg' | 'problem' | 'solution' | 'effect',
  input: InventionInput,
): string {
  const { title, field, content, problem } = input;
  const map: Record<string, string> = {
    tech:     `본 발명은 ${field}에 관한 것으로, 보다 구체적으로는 ${title}에 관한 것이다.\n\n${content.slice(0, 120)}`,
    bg:       `${field} 분야에서 기존 방법은 여러 한계가 있었다.\n\n특히 ${problem || '처리 효율 및 정확도 측면에서 문제점이 있었다.'}`,
    problem:  `본 발명은 상기와 같은 문제점을 해결하기 위해 안출된 것으로, ${problem || `${title}을 효율적으로 수행할 수 있는 장치 및 방법을 제공하는 것을 목적으로 한다.`}`,
    solution: `상기 과제를 해결하기 위해, 본 발명은 ${content.slice(0, 200)}\n\n이를 통해 높은 정확도와 효율적인 처리를 달성한다.`,
    effect:   `본 발명에 의하면, ${field} 기반의 처리를 통해 기존 방식 대비 성능이 향상되고, 높은 정확도가 달성된다.\n\n또한 다양한 환경에서도 안정적인 동작이 가능하다.`,
  };
  return map[sectionKey] || '';
}

export function generateComponentCandidates(input: InventionInput): SpecComponentItem[] {
  const { title, field, content } = input;
  const base = [
    { text: `입력부: ${field} 환경에서 외부 데이터를 수신하여 처리 파이프라인에 전달` },
    { text: `전처리부: 수신된 데이터에 대한 전처리 및 정규화를 수행` },
    { text: `처리부: ${title} 핵심 알고리즘을 적용하여 데이터를 분석·처리` },
    { text: `출력부: 처리 결과를 외부 시스템에 출력` },
  ];
  if (content.length > 50) {
    base.push({ text: `제어부: ${content.slice(0, 30)}... 전반을 제어·관리` });
  }
  return base.map((c, i) => ({
    id: i + 1, text: c.text, sel: true, num: '', depth: 0,
  }));
}

export interface IndepClaimCandidate {
  id: number; label: string; text: string;
}

export function generateIndependentClaims(
  input: InventionInput,
  components: SpecComponentItem[],
): IndepClaimCandidate[] {
  const { title, field } = input;
  const selComps = components.filter(c => c.sel).slice(0, 3);
  return [
    {
      id: 1, label: 'A',
      text: `${selComps.map(c => {
        const name = c.text.split(':')[0];
        const desc = c.text.split(':')[1]?.trim() || '';
        return `${name}${c.num ? `(${c.num})` : ''}: ${desc}`;
      }).join(';\n')}을 포함하며,\n${field} 환경에서 실시간 처리가 가능한 ${title} 장치.`,
    },
    {
      id: 2, label: 'B',
      text: `외부로부터 데이터를 획득하는 단계;\n상기 데이터를 전처리하는 단계;\n${title} 알고리즘을 적용하여 처리 결과를 출력하는 단계를 포함하는, ${title} 방법.`,
    },
  ];
}

export function generateAbstractCandidates(input: InventionInput): string[] {
  const { title, field, content } = input;
  return [
    `본 발명은 ${field}에서 ${title}하는 장치 및 방법에 관한 것으로, ${content.slice(0, 100)} 이를 통해 높은 성능과 신뢰성을 달성한다.`,
    `${field} 기반 ${title} 시스템으로서, ${content.slice(0, 80)} 다양한 환경에서 효율적으로 동작하는 것을 특징으로 한다.`,
  ];
}

export function generateDependentClaims(
  indepId: number,
  indepText: string,
  input: InventionInput,
): Array<{ id: number; text: string; sel: boolean }> {
  const isDevice = indepText.includes('장치');
  const suffix = isDevice ? `${input.title} 장치.` : `${input.title} 방법.`;
  return [
    { id: 1, sel: true,  text: `제${indepId}항에 있어서, 상기 처리부는 ${input.field} 알고리즘을 포함하는, ${suffix}` },
    { id: 2, sel: true,  text: `제${indepId}항에 있어서, 상기 입력부는 복수의 센서를 포함하는, ${suffix}` },
    { id: 3, sel: true,  text: `제${indepId}항에 있어서, 상기 출력부는 처리 결과를 시각화하여 표시하는, ${suffix}` },
    { id: 4, sel: false, text: `제${indepId}항에 있어서, 상기 구성은 클라우드 환경에서 동작하는, ${suffix}` },
  ];
}

export function generateMockDrawings(input: InventionInput): SpecDrawingItem[] {
  const { title } = input;
  return [
    { id: 'd1', symbol: 1, label: '종래기술', name: `종래 ${title} 전체 구성도`,
      description: `종래 기술에 따른 ${title} 장치의 전체 구성을 나타내는 블록도.`,
      applied: false, pageNumber: 1, stage: 'extracted',
      bbox: { x: 60, y: 80, w: 376, h: 273 }, originalImageUrl: '' },
    { id: 'd2', symbol: 2, label: '종래기술', name: `종래 ${title} 처리 흐름도`,
      description: `종래 기술에 따른 ${title} 처리 순서를 나타내는 순서도.`,
      applied: false, pageNumber: 2, stage: 'extracted',
      bbox: { x: 40, y: 120, w: 336, h: 259 }, originalImageUrl: '' },
    { id: 'd3', symbol: 3, label: '제안기술', name: `제안 ${title} 구성도`,
      description: `본 발명에 따른 ${title} 장치 구성을 나타내는 블록도.`,
      applied: true, pageNumber: 3, stage: 'extracted',
      bbox: { x: 50, y: 100, w: 406, h: 315 }, originalImageUrl: '' },
    { id: 'd4', symbol: 4, label: '제안기술', name: `${title} 처리 흐름도`,
      description: `본 발명에 따른 ${title} 처리 순서를 나타내는 순서도.`,
      applied: true, pageNumber: 4, stage: 'extracted',
      bbox: { x: 70, y: 90, w: 237, h: 271 }, originalImageUrl: '' },
  ];
}
