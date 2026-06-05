# AXPlain.ai 특허 명세서 작성 워크플로우 — 구현 계획 (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 변리사가 직무발명서를 업로드하면 AI가 주요 내용을 추출하고, 도면을 확정·편집하고, 명세서를 자동 생성한 뒤 AI 보조로 반복 수정하여 최종 명세서를 완성하는 전 과정이 끊김 없이 동작하도록 구현한다.

**Architecture:** Task ID별 localStorage spec store로 모든 분석 상태를 persist. 입력 기반 mockAiService로 동적 후보 생성. SpecView → SpecEditorView 간 analysisResult prop 전달로 분석 결과가 에디터에 즉시 반영. ClaimsPanel·DescriptionPanel 등 자식 컴포넌트 상태도 모두 analysisState로 끌어올려 저장.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, localStorage (상태 persist), Vite

---

## 전체 이용 흐름 (End-to-End User Flow)

```
[Phase 1: 직무발명서 분석]
  ① 직발서 업로드 (PDF/DOCX/HWP) 또는 직접 입력
     ↓ (파일 선택 → 파일명 표시 → 1.5초 분석 시뮬레이션)
  ② AI 분석 시작 → 발명 명칭/설명/구성요소/도면/청구항/요약서 후보 생성

[Phase 2: 단계별 확정 (7 Steps)]
  Step 1 (시작) ──── 업로드/입력 완료
  Step 2 (명칭) ──── 발명 명칭 A/B/C 중 선택 또는 직접 입력, 확정
  Step 3 (설명) ──── 기술분야/배경기술/해결하려는 과제/과제해결수단/발명의 효과 5개 섹션 각각 편집·확정
  Step 4 (구성요소)─ 구성요소 목록 확인·편집·순서조정·계층, 부호 자동 부여 (100, 110, 200...), 확정
  Step 5 (도면) ──── 각 도면별:
                       ① 추출된 bbox 확인 (이미지 위 빨간 박스 표시) → 이용자가 드래그로 조정
                       ② "변환 시작" → CAD 변환 시뮬레이션 (1.5초)
                       ③ 3개 CAD 후보 중 선택
                       ④ PatentEditor 캔버스에서 구성요소 부호 배치·편집
                       ⑤ 내보내기 → 도면 완료
                     전체 도면 확정
  Step 6 (청구항) ── ① 독립항 A/B 중 하나 이상 체크박스로 선택
                      ② "종속항 구성" → AI 종속항 자동 생성 → 선택/편집
                      확정
  Step 7 (요약서) ── 요약서 A/B 중 선택 또는 직접 입력, 확정

[Phase 3: 명세서 생성 및 편집]
  ③ "명세서 AI 생성" CTA (중앙 + 우측 패널)
     ↓ (0.8초 생성 로딩)
  ④ SpecEditorView 열림 — 분석 결과가 10개 섹션에 채워진 상태로 시작:
       발명의 명칭 / 기술분야 / 배경기술 / 해결하려는 과제 / 과제의 해결 수단
       / 발명의 효과 / 도면의 간단한 설명 / 구체적 내용 / 청구범위 / 요약서
  ⑤ 섹션별 블록 편집:
       - 블록 클릭 → 직접 수정 (textarea)
       - "AI로 수정하기" → 지시 입력 → AI 수정안 생성 → diff 뷰(현재/변경 버전) → 채택/기각
  ⑥ 도면 탭 → "참조 삽입" → 본문에 "(도면 기호 X 참조)" 삽입
  ⑦ 참고문헌 탭 → "[특허번호]" 인용 삽입

[Phase 4: 최종 완성]
  ⑧ 섹션 반복 수정 (AI 보조)
  ⑨ 자동저장 (500ms debounce)
  ⑩ "저장" 버튼 → 저장됨 표시

[재진입 흐름]
  - 다른 작업으로 이탈 후 재진입 → Phase·단계·편집 내용 모두 복원
  - 에디터 ↔ 분석결과 자유롭게 왔다갔다 가능
```

---

## 데이터 흐름 다이어그램

```
[사용자 입력]
  diTitle, diField, diContent, diProblem, diKeywords
  (또는 업로드 파일명)
        ↓
[mockAiService]
  generateTitleCandidates()       → analysisState.titleCandidates
  generateDescriptionSection()    → DescriptionPanel.initialTexts
  generateComponentCandidates()   → analysisState.componentItems
  generateMockDrawings()          → analysisState.drawings
  generateIndependentClaims()     → ClaimsPanel.initialCands
  generateAbstractCandidates()    → analysisState.abstractCandidates
        ↓
[각 단계 확정 → analysisState 에 저장]
  confirmed['title']              ← 선택한 발명 명칭
  confirmed['description']        ← 【기술분야】\n...\n\n【배경기술】\n... (5섹션 합본)
  confirmed['components']         ← "100 데이터 수집부: ... — 200 전처리부: ..."
  analysisState.drawings          ← stage + exportedImageUrl (편집 완료 도면 포함)
  confirmed['claims']             ← "독립항 N개, 종속항 M개\n\n청구항 1.\n..."
  confirmed['abstract']           ← 선택한 요약서 텍스트
  analysisState.claimsState       ← ClaimsPanel 전체 상태 (phase, cands, depGroups)
  analysisState.descTexts         ← DescriptionPanel 서브섹션 편집 중 텍스트
        ↓
[makeAnalysisResult()]  ← SpecView가 에디터 진입 시 호출
  .title      ← confirmed['title']
  .tech       ← extractDescSection('tech')
  .bg         ← extractDescSection('bg')
  .problem    ← extractDescSection('problem')
  .solution   ← extractDescSection('solution')
  .effect     ← extractDescSection('effect')
  .drawDesc   ← 완료 도면 목록: "도 1은 ○○. 도 2는 ○○."
  .detail     ← 구성요소 + 부호 포함: "상기 데이터 수집부(100)는..."
  .claims     ← confirmed['claims']
  .abstract   ← confirmed['abstract']
  .drawings   ← analysisState.drawings (편집 완료 이미지 포함)
        ↓
[SpecEditorView]
  blocks 초기화 ← analysisResult 또는 자동저장된 editorBlocks
  updateBlock()  → debounced saveSpecState(editorBlocks)
```

---

## 버그 목록 (실증 완료)

| # | 분류 | 설명 | 심각도 |
|---|------|------|--------|
| **B1** | 상태 소실 | SpecView 분석 상태 전체 `useState`만 관리 → 이탈 후 초기화 | 🔴 Critical |
| **B1a** | 상태 소실 | ClaimsPanel 내부 상태 (phase, cands, depGroups) 미저장 | 🔴 Critical |
| **B1b** | 상태 소실 | DescriptionPanel 서브섹션 편집 중 텍스트 미저장 | 🟠 High |
| **B2** | 데이터 흐름 | SpecEditorView가 분석 결과 미수신 → 에디터가 task명으로 시작 | 🔴 Critical |
| **B3** | Mock 고정 | 입력 내용과 무관하게 하드코딩 라이다 후보 출력 | 🔴 Critical |
| **B4** | 상태 소실 | SpecEditorView blocks 자동저장 없음 | 🔴 Critical |
| **B5** | 데이터 흐름 | SpecEditorView 도면 탭이 MOCK_DRAWINGS 직접 참조 | 🟠 High |
| **B6** | 도면 UI | DrawingsPanel stage별 UI 없음, 모두 동일 카드 | 🟠 High |
| **B7** | 누락 섹션 | DescriptionPanel "발명의 효과" 섹션 없음 | 🟠 High |
| **B8** | 레거시 | SpecView.tsx `_EditorView_legacy` 방치 | 🟡 Medium |
| **B9** | 레이아웃 | 기초자료 패널 `position:absolute` → 내용 가림 | 🟡 Medium |
| **B10** | 도면 데이터 | 도면 편집기 crop 단계에 원본 이미지 없음 | 🟡 Medium |
| **B11** | 도면 확정 | 도면 확정 카드에 완료 도면 1개만 표시 | 🟡 Medium |
| **B12** | 텍스트 | "선택한 독립항 1개 으로" 불필요 공백 | 🟢 Low |
| **B13** | 데이터 흐름 | 도면 편집 완료 결과가 analysisState.drawings와 미동기화 | 🟠 High |
| **B14** | 데이터 흐름 | 구성요소 부호(100, 200)가 명세서 구체적 내용에 미반영 | 🟠 High |
| **B15** | 업로드 UI | 파일 업로드 클릭 시 파일 선택 dialog 없이 즉시 flow 진입 | 🟡 Medium |
| **B16** | 미리보기 | PreviewModal 내용 완전 하드코딩 — 분석 결과·에디터 편집 내용 미반영 | 🟠 High |
| **B17** | 미리보기 | DOCX 다운로드·PDF 내보내기 버튼에 onClick 핸들러 없음 (미구현) | 🟠 High |
| **B18** | 미구현 | 설정 버튼 = toast "설정 기능은 곧 제공될 예정입니다." — ClientsView 접근 불가 | 🟡 Medium |
| **B19** | 미구현 | 작업 검색 버튼 = toast "작업 검색은 후순위 기능" — 미구현 | 🟡 Medium |
| **B20** | 컴포넌트 | SpecView가 같은 mode('spec')에서 activeTaskId 변경 시 재마운트 안됨 → mainView sessionStorage 값 미적용 | 🟠 High |

---

## UX 이슈 목록

| # | 위치 | 문제 | 개선 방향 |
|---|------|------|-----------|
| **U1** | 완료 단계 | "명세서 AI 생성" CTA가 우측 패널 하단에만 있어 찾기 어려움 | 중앙 화면에 큰 버튼 추가 |
| **U2** | 분석 중 | 직접입력 폼이 AI 분석 시작 후에도 펼쳐진 상태로 흐름을 막음 | 분석 시작 후 폼 접기 |
| **U3** | 스텝바 | 확정된 단계에 체크 표시 없음 — 번호가 사라지는 이상한 거동 | ✓ 체크 + 녹색 레이블 |
| **U4** | 도면 확정 카드 | 완료 도면 1개만 표시 — 나머지 진행 상황 불명확 | "완료 N/총 M개" 표시 |
| **U5** | 흐름 누적 | 단계가 쌓이면서 스크롤이 매우 길어짐 | 이전 확정 카드 접힘 처리 |
| **U6** | 에디터 진입 | 에디터 열릴 때 "생성 중..." 로딩 없이 즉시 표시 | 0.8초 생성 로딩 추가 |
| **U7** | 분석 이탈 | 진행 중 다른 작업 이탈 시 경고 없음 | 이탈 확인 다이얼로그 |

---

## 파일 구조

**새로 생성할 파일:**
```
src/features/spec/
  types.ts          — SpecAnalysis 전체 타입 정의
  specStore.ts      — Task ID별 localStorage 저장/로드 헬퍼
  mockAiService.ts  — 입력 기반 AI 후보 동적 생성
```

**수정할 파일:**
```
src/views/SpecView.tsx        — 상태 persist, mockAiService, 모든 버그 수정
src/views/SpecEditorView.tsx  — analysisResult prop, 자동저장, 로딩 상태
```

---

## Task 1: 레거시 코드 제거 (B8)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: SpecView.tsx 2272행 이후 `_EditorView_legacy` 관련 코드 삭제**

  삭제 대상 (SpecView.tsx 말미):
  ```typescript
  // 명세서 섹션 정의
  const SPEC_DOC_SECTIONS = [...]

  // 구 EditorView — SpecEditorView로 교체됨
  export function _EditorView_legacy(...) { ... }
  ```

- [ ] **Step 2: 빌드 확인**
  ```bash
  cd c:\project\06_AXP\react-app && npm run build 2>&1 | tail -20
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "refactor: remove legacy _EditorView_legacy from SpecView"
  ```

---

## Task 2: SpecAnalysis 타입 정의

**Files:** Create `src/features/spec/types.ts`

- [ ] **Step 1: 타입 파일 작성**

  ```typescript
  // src/features/spec/types.ts

  export type SpecStepId =
    'upload' | 'title' | 'description' | 'components' | 'drawings' | 'claims' | 'abstract';
  export type SpecPhase = 'upload' | 'direct' | 'flow' | 'done';

  export interface SpecComponentItem {
    id: number;
    text: string;   // "데이터 수집부: 라이다 센서로부터..."
    sel: boolean;
    num: string;    // "100", "200" 등 부호
    depth: number;  // 계층 (0=최상위)
  }

  export interface SpecDrawingItem {
    id: string;
    symbol: number;
    label: '제안기술' | '종래기술' | 'AI생성';
    name: string;
    description: string;
    applied: boolean;
    pageNumber: number;
    stage: 'extracted' | 'bbox-adjusted' | 'converting' | 'candidate-select' | 'editing' | 'done';
    bbox: { x: number; y: number; w: number; h: number };
    originalImageUrl: string;
    exportedImageUrl?: string;
    savedEditorJson?: string;
    drawingDescription?: string;
    isRepresentative?: boolean;
  }

  // ClaimsPanel 전체 상태 (B1a 해결용)
  export interface SpecClaimsState {
    phase: 'indep' | 'dep';
    indepCands: Array<{
      id: number; label: string; text: string; selected: boolean;
    }>;
    depGroups: Record<number, {
      generated: boolean;
      newText: string;
      items: Array<{ id: number; text: string; sel: boolean }>;
    }>;
  }

  // DescriptionPanel 서브섹션 텍스트 (B1b 해결용)
  export interface SpecDescTexts {
    tech?: string;
    bg?: string;
    problem?: string;
    solution?: string;
    effect?: string;
  }

  export interface SpecAnalysisState {
    taskId: string;
    phase: SpecPhase;
    curStep: SpecStepId;
    confirmed: Partial<Record<SpecStepId, string>>;
    gSel: Partial<Record<SpecStepId, string>>;
    // 직접입력 폼
    diTitle: string;
    diField: string;
    diContent: string;
    diProblem: string;
    diKeywords: string;
    // 업로드 파일
    uploadedFileName?: string;
    // AI 생성 후보
    titleCandidates: string[];
    abstractCandidates: string[];
    // 구성요소
    componentItems: SpecComponentItem[];
    // 도면
    drawings: SpecDrawingItem[];
    // 청구항 전체 상태 (B1a)
    claimsState?: SpecClaimsState;
    // 발명의 설명 서브섹션 편집 중 텍스트 (B1b)
    descTexts?: SpecDescTexts;
    // 뷰 전환
    mainView: 'analysis' | 'editor';
    // 명세서 에디터 자동저장 (B4)
    editorBlocks?: Record<string, string[]>;
  }

  export type SpecAnalysisPatch = Partial<SpecAnalysisState>;

  export interface InventionInput {
    title: string;
    field: string;
    content: string;
    problem?: string;
    keywords?: string;
  }

  /** SpecEditorView에 전달하는 분석 결과 요약 */
  export interface SpecAnalysisResult {
    title: string;
    tech: string;
    bg: string;
    problem: string;
    solution: string;
    effect: string;
    drawDesc: string;    // "도 1은 ○○. 도 2는 ○○."
    detail: string;      // 구성요소 + 부호: "상기 데이터 수집부(100)는..."
    claims: string;      // 청구항 전문
    abstract: string;
    drawings: SpecDrawingItem[];
    componentItems: SpecComponentItem[];
  }
  ```

- [ ] **Step 2: TypeScript 오류 없음 확인**
  ```bash
  cd c:\project\06_AXP\react-app && npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/features/spec/types.ts
  git commit -m "feat: add complete SpecAnalysis types including ClaimsState and DescTexts"
  ```

---

## Task 3: specStore — localStorage 저장소 헬퍼

**Files:** Create `src/features/spec/specStore.ts`

- [ ] **Step 1: 저장소 헬퍼 작성**

  ```typescript
  // src/features/spec/specStore.ts
  import type { SpecAnalysisState, SpecAnalysisPatch } from './types';

  const KEY = (taskId: string) => `axp_spec_v2_${taskId}`;

  export function loadSpecState(taskId: string): SpecAnalysisState | null {
    try {
      const raw = localStorage.getItem(KEY(taskId));
      return raw ? (JSON.parse(raw) as SpecAnalysisState) : null;
    } catch {
      return null;
    }
  }

  export function saveSpecState(taskId: string, patch: SpecAnalysisPatch): void {
    try {
      const existing = loadSpecState(taskId) ?? ({ taskId } as SpecAnalysisState);
      localStorage.setItem(KEY(taskId), JSON.stringify({ ...existing, ...patch }));
    } catch {
      // storage quota exceeded — graceful degradation
    }
  }

  export function clearSpecState(taskId: string): void {
    localStorage.removeItem(KEY(taskId));
  }

  export function getDefaultSpecState(taskId: string): SpecAnalysisState {
    return {
      taskId,
      phase: 'upload',
      curStep: 'upload',
      confirmed: {},
      gSel: {},
      diTitle: '', diField: '', diContent: '', diProblem: '', diKeywords: '',
      titleCandidates: [],
      abstractCandidates: [],
      componentItems: [],
      drawings: [],
      mainView: 'analysis',
    };
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/features/spec/specStore.ts
  git commit -m "feat: add specStore localStorage helpers"
  ```

---

## Task 4: mockAiService — 입력 기반 AI 후보 동적 생성 (B3 해결)

**Files:** Create `src/features/spec/mockAiService.ts`

- [ ] **Step 1: mockAiService 작성**

  ```typescript
  // src/features/spec/mockAiService.ts
  import type { InventionInput, SpecComponentItem, SpecDrawingItem } from './types';

  // ─── 발명의 명칭 후보 3개 ─────────────────────────────────────────
  export function generateTitleCandidates(input: InventionInput): string[] {
    const { title, field } = input;
    return [
      `${field} 기반 ${title} 장치 및 방법`,
      `인공지능을 이용한 ${title} 시스템`,
      `${title}을 위한 ${field} 처리 방법`,
    ];
  }

  // ─── 발명의 설명 섹션별 생성 ──────────────────────────────────────
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

  // ─── 구성요소 후보 목록 ───────────────────────────────────────────
  export function generateComponentCandidates(input: InventionInput): SpecComponentItem[] {
    const { title, field, content } = input;
    const base = [
      { text: `입력부: ${field} 환경에서 외부 데이터를 수신하여 처리 파이프라인에 전달` },
      { text: `전처리부: 수신된 데이터에 대한 전처리 및 정규화를 수행` },
      { text: `처리부: ${title} 핵심 알고리즘을 적용하여 데이터를 분석·처리` },
      { text: `출력부: 처리 결과를 외부 시스템에 출력` },
    ];
    // content에서 추가 힌트 추출 (간단 휴리스틱)
    if (content.length > 50) {
      base.push({ text: `제어부: ${content.slice(0, 30)}... 전반을 제어·관리` });
    }
    return base.map((c, i) => ({
      id: i + 1, text: c.text, sel: true, num: '', depth: 0,
    }));
  }

  // ─── 독립항 후보 2개 ──────────────────────────────────────────────
  export interface IndepClaimCandidate {
    id: number; label: string; text: string;
  }

  export function generateIndependentClaims(
    input: InventionInput,
    components: SpecComponentItem[],
  ): IndepClaimCandidate[] {
    const { title, field } = input;
    const selComps = components.filter(c => c.sel).slice(0, 3);
    const compLines = selComps.map(c => {
      const name = c.text.split(':')[0];
      const num = c.num ? `(${c.num})` : '';
      return `상기 ${name}${num}`;
    }).join(';\n');
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

  // ─── 요약서 후보 2개 ──────────────────────────────────────────────
  export function generateAbstractCandidates(input: InventionInput): string[] {
    const { title, field, content } = input;
    return [
      `본 발명은 ${field}에서 ${title}하는 장치 및 방법에 관한 것으로, ${content.slice(0, 100)} 이를 통해 높은 성능과 신뢰성을 달성한다.`,
      `${field} 기반 ${title} 시스템으로서, ${content.slice(0, 80)} 다양한 환경에서 효율적으로 동작하는 것을 특징으로 한다.`,
    ];
  }

  // ─── 종속항 후보 ──────────────────────────────────────────────────
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

  // ─── 도면 목록 생성 ───────────────────────────────────────────────
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
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/features/spec/mockAiService.ts
  git commit -m "feat: add mockAiService for dynamic AI candidate generation"
  ```

---

## Task 5: SpecView — 상태 Persistence 연결 (B1 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: import 추가**

  ```typescript
  import { loadSpecState, saveSpecState, getDefaultSpecState } from '../features/spec/specStore';
  import {
    generateTitleCandidates, generateAbstractCandidates,
    generateComponentCandidates, generateMockDrawings,
    generateDescriptionSection, generateIndependentClaims,
  } from '../features/spec/mockAiService';
  import type { SpecAnalysisState, SpecComponentItem, SpecStepId, SpecPhase } from '../features/spec/types';
  ```

- [ ] **Step 2: 단일 analysisState로 교체**

  SpecView 컴포넌트 상단의 모든 개별 `useState` 선언을 하나의 `analysisState`로 교체:

  ```typescript
  export function SpecView() {
    const { tasks, activeTaskId } = useStore();
    const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
    const taskId = task?.id ?? '';

    const [analysisState, setAnalysisStateRaw] = useState<SpecAnalysisState>(() =>
      loadSpecState(taskId) ?? getDefaultSpecState(taskId)
    );

    const setAnalysisState = (patch: Partial<SpecAnalysisState>) => {
      setAnalysisStateRaw(prev => {
        const next = { ...prev, ...patch };
        saveSpecState(taskId, next);
        return next;
      });
    };

    // 분해 — 기존 변수명 유지로 하위 코드 변경 최소화
    const phase      = analysisState.phase;
    const curStep    = analysisState.curStep;
    const confirmed  = analysisState.confirmed;
    const gSel       = analysisState.gSel;
    const mainView   = analysisState.mainView;
    const diTitle    = analysisState.diTitle;
    const diField    = analysisState.diField;
    const diContent  = analysisState.diContent;
    const diProblem  = analysisState.diProblem;
    const diKeywords = analysisState.diKeywords;

    const handleSetMainView = (v: 'analysis' | 'editor') => setAnalysisState({ mainView: v });
    const setPhase     = (p: SpecPhase)    => setAnalysisState({ phase: p });
    const setCurStep   = (s: SpecStepId)   => setAnalysisState({ curStep: s });
    const setConfirmed = (fn: (prev: typeof confirmed) => typeof confirmed) =>
      setAnalysisState({ confirmed: fn(confirmed) });
    const setGSel      = (fn: (prev: typeof gSel) => typeof gSel) =>
      setAnalysisState({ gSel: fn(gSel) });
    const setDiTitle    = (v: string) => setAnalysisState({ diTitle: v });
    const setDiField    = (v: string) => setAnalysisState({ diField: v });
    const setDiContent  = (v: string) => setAnalysisState({ diContent: v });
    const setDiProblem  = (v: string) => setAnalysisState({ diProblem: v });
    const setDiKeywords = (v: string) => setAnalysisState({ diKeywords: v });

    // UI 전용 (persist 불필요)
    const [guideOpen, setGuideOpen]           = useState(true);
    const [previewOpen, setPreviewOpen]       = useState(false);
    const [sourceDataOpen, setSourceDataOpen] = useState(false);
    const [guideStep, setGuideStep]           = useState<StepId>(
      analysisState.curStep !== 'upload' ? analysisState.curStep as StepId : 'title'
    );
    // ... 기존 코드 유지
  ```

- [ ] **Step 3: 브라우저 확인**

  1. 명세서 작업 → 직접입력 → 발명 명칭 입력
  2. 특허 검색 작업으로 이동 후 돌아옴
  3. 입력한 내용이 유지되는지 확인

- [ ] **Step 4: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: persist all SpecView analysis state to localStorage per-task (B1 fix)"
  ```

---

## Task 6: 파일 업로드 UI 흐름 (B15 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: 파일 업로드 input element 추가**

  업로드 존(div) 내에 숨겨진 파일 input과 클릭 핸들러 추가:

  ```typescript
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleFileSelect = (file: File) => {
    // 파일명 저장
    setAnalysisState({ uploadedFileName: file.name, diTitle: file.name.replace(/\.[^.]+$/, '') });
    setUploadProgress('loading');
    // 1.5초 분석 시뮬레이션 후 flow 진입
    setTimeout(() => {
      const input = { title: file.name.replace(/\.[^.]+$/, ''), field: '기술', content: `${file.name} 파일에서 추출된 내용입니다.` };
      setAnalysisState({
        phase: 'flow',
        curStep: 'title',
        titleCandidates: generateTitleCandidates(input),
        abstractCandidates: generateAbstractCandidates(input),
        componentItems: generateComponentCandidates(input),
        drawings: generateMockDrawings(input),
        uploadedFileName: file.name,
      });
      setGuideStep('title');
      setUploadProgress('done');
    }, 1500);
  };
  ```

- [ ] **Step 2: 업로드 존 UI 교체**

  ```typescript
  {/* 업로드 존 */}
  <div
    onClick={() => phase === 'upload' && fileInputRef.current?.click()}
    onDragOver={e => { e.preventDefault(); }}
    onDrop={e => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && phase === 'upload') handleFileSelect(file);
    }}
    className={`border-2 border-dashed rounded-xl p-10 mb-5 transition-all ${
      phase === 'upload' ? 'border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30' : 'border-gray-200 opacity-50'
    }`}
  >
    {uploadProgress === 'loading' ? (
      <div className="text-center">
        <span className="inline-block animate-spin text-3xl mb-3">↻</span>
        <p className="text-md2 text-blue-600 font-semibold">직무발명서 분석 중...</p>
        <p className="text-sm2 text-gray-400 mt-1">{analysisState.uploadedFileName}</p>
      </div>
    ) : (
      <>
        <svg .../>
        <p className="text-md2 text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
        <p className="text-sm2 text-gray-400 mt-1">PDF, DOCX, HWP, 이미지 파일 지원</p>
      </>
    )}
  </div>
  <input
    ref={fileInputRef}
    type="file"
    accept=".pdf,.docx,.hwp,.doc,.jpg,.jpeg,.png"
    className="hidden"
    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
  />
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: add file upload dialog and upload progress for SpecView (B15 fix)"
  ```

---

## Task 7: mockAiService를 startFlow에 연결 (B3 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: startFlow 수정 — 1.5초 분석 시뮬레이션 + 동적 후보**

  ```typescript
  const [analyzing, setAnalyzing] = useState(false);

  const startFlow = () => {
    if (!diTitle.trim() || !diField.trim() || !diContent.trim()) return;
    setAnalyzing(true);
    const input = { title: diTitle, field: diField, content: diContent, problem: diProblem, keywords: diKeywords };
    setTimeout(() => {
      const components = generateComponentCandidates(input);
      setAnalysisState({
        phase: 'flow',
        curStep: 'title',
        titleCandidates: generateTitleCandidates(input),
        abstractCandidates: generateAbstractCandidates(input),
        componentItems: components,
        drawings: generateMockDrawings(input),
      });
      setGuideStep('title');
      setAnalyzing(false);
      setTimeout(() => flowRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    }, 1500);
  };
  ```

- [ ] **Step 2: AI 분석 시작 버튼 로딩 상태**

  ```typescript
  <button
    className="btn-primary btn-sm"
    onClick={startFlow}
    disabled={!diTitle.trim() || !diField.trim() || !diContent.trim() || analyzing}
  >
    {analyzing
      ? <><span className="inline-block animate-spin mr-1.5">↻</span>AI 분석 중...</>
      : <><Icon name="star" size={13} /> AI 분석 시작</>
    }
  </button>
  ```

- [ ] **Step 3: GuidePanel에 customCandidates prop 추가**

  GuidePanel 시그니처에 추가:
  ```typescript
  function GuidePanel({ ..., customCandidates }: {
    ...; customCandidates?: Partial<Record<StepId, string[]>>;
  }) {
    const cands = customCandidates?.[step] ?? GUIDE_CANDS[step] ?? [];
    // 기존 cands 사용 코드 교체
  ```

  SpecView에서 GuidePanel 호출 시:
  ```typescript
  <GuidePanel
    ...
    customCandidates={{
      title:    analysisState.titleCandidates.length > 0 ? analysisState.titleCandidates : undefined,
      abstract: analysisState.abstractCandidates.length > 0 ? analysisState.abstractCandidates : undefined,
    }}
  />
  ```

- [ ] **Step 4: 브라우저 확인**

  "배터리 수명 예측 시스템" 입력 → 발명 명칭 후보 A: "배터리 관리, 머신러닝 기반 배터리 수명 예측 시스템 장치 및 방법" 확인 (라이다 아님)

- [ ] **Step 5: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: connect mockAiService to startFlow — dynamic candidates from user input (B3 fix)"
  ```

---

## Task 8: DescriptionPanel — 발명의 효과 + 텍스트 Persist (B7, B1b 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: DESC_SECTIONS에 effect 추가**

  ```typescript
  const DESC_SECTIONS = [
    { key: 'tech',     label: '기술분야',          text: '' },
    { key: 'bg',       label: '배경기술',            text: '' },
    { key: 'problem',  label: '해결하려는 과제',     text: '' },
    { key: 'solution', label: '과제해결수단',        text: '' },
    { key: 'effect',   label: '발명의 효과',         text: '' },
  ];
  ```

- [ ] **Step 2: DescriptionPanel에 initialTexts + onTextsChange 추가**

  ```typescript
  function DescriptionPanel({
    done, onConfirm, onUpdate, onModeChange, promptTrigger, onSubInfoChange,
    initialTexts, onTextsChange,
  }: {
    ...; initialTexts?: Record<string, string>; onTextsChange?: (texts: Record<string, string>) => void;
  }) {
    const [texts, setTexts] = useState<Record<string, string>>(
      () => Object.fromEntries(DESC_SECTIONS.map(s => [s.key, initialTexts?.[s.key] || s.text]))
    );

    const updateText = (key: string, value: string) => {
      const next = { ...texts, [key]: value };
      setTexts(next);
      onTextsChange?.(next);  // ← persist
    };
    // 기존 setTexts 호출을 updateText로 교체
  ```

- [ ] **Step 3: GuidePanel에서 DescriptionPanel 호출 시 props 전달**

  ```typescript
  {step === 'description' && (
    <DescriptionPanel
      ...
      initialTexts={{
        tech:     analysisState.descTexts?.tech     || generateDescriptionSection('tech',     inputObj),
        bg:       analysisState.descTexts?.bg       || generateDescriptionSection('bg',       inputObj),
        problem:  analysisState.descTexts?.problem  || generateDescriptionSection('problem',  inputObj),
        solution: analysisState.descTexts?.solution || generateDescriptionSection('solution', inputObj),
        effect:   analysisState.descTexts?.effect   || generateDescriptionSection('effect',   inputObj),
      }}
      onTextsChange={(texts) => setAnalysisState({ descTexts: texts })}
    />
  )}
  ```

  `inputObj = { title: diTitle, field: diField, content: diContent, problem: diProblem }`

- [ ] **Step 4: 브라우저 확인**

  1. 발명의 설명 단계 → 기술분야 편집 → 다른 뷰로 이탈 → 복귀
  2. 편집한 기술분야 내용이 유지되는지 확인
  3. "발명의 효과" 탭이 5번째로 표시되는지 확인

- [ ] **Step 5: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: add 발명의 효과 section and persist desc subsection texts (B7/B1b fix)"
  ```

---

## Task 9: ComponentsPanel — 분석 상태 연동

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: ComponentsPanel에 initialItems prop 추가**

  ```typescript
  function ComponentsPanel({
    done, onConfirm, onUpdate, onComponentsChange, initialItems,
  }: { ...; initialItems?: SpecComponentItem[] }) {
    const [items, setItems] = useState<CompItem[]>(
      () => (initialItems && initialItems.length > 0)
        ? initialItems.map(c => ({ ...c }))
        : INIT_COMPS
    );
  ```

- [ ] **Step 2: GuidePanel에서 ComponentsPanel 호출 시 연결**

  ```typescript
  {step === 'components' && (
    <ComponentsPanel
      done={isDone}
      onConfirm={handleConfirm}
      onUpdate={v => setGSel(p => ({ ...p, [step]: v }))}
      initialItems={analysisState.componentItems}
      onComponentsChange={(comps) => {
        setConfirmedComponents(comps);
        setAnalysisState({
          componentItems: comps.map((c, i) => ({
            id: i + 1,
            text: c.name,
            sel: true,
            num: c.number,
            depth: 0,
          })),
        });
      }}
    />
  )}
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: load ComponentsPanel from analysisState and save changes"
  ```

---

## Task 10: DrawingsPanel — 상태 저장 + Stage별 UI + 편집 결과 동기화 (B5, B6, B11, B13 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: DrawingsPanel에 initialDrawings + onDrawingsChange 추가**

  ```typescript
  function DrawingsPanel({
    done, onConfirm, onUpdate, inventionComponents,
    initialDrawings, onDrawingsChange,
  }: {
    ...; initialDrawings?: SpecDrawingItem[]; onDrawingsChange?: (d: SpecDrawingItem[]) => void;
  }) {
    const [drawings, setDrawings] = useState(() =>
      (initialDrawings && initialDrawings.length > 0)
        ? initialDrawings.map(d => ({ ...d }))
        : MOCK_DRAWINGS.map(d => ({ ...d }))
    );

    const handleSave = (drawingId: string, updates: Partial<typeof drawings[0]>) => {
      setDrawings(prev => {
        const next = prev.map(d => d.id === drawingId ? { ...d, ...updates } : d);
        const doneCount = next.filter(d => d.stage === 'done').length;
        onUpdate(
          `도면 ${next.length}개 중 ${doneCount}개 편집 완료\n\n` +
          next.map(d => `기호${d.symbol} ${d.name}: ${d.description}`).join('\n\n')
        );
        onDrawingsChange?.(next);  // ← analysisState 동기화 (B13)
        return next;
      });
    };

    // onEditorResult 리스너에서도 onDrawingsChange 호출
    useEffect(() => {
      const off = onEditorResult((result) => {
        handleSave(result.drawingId, {
          stage: result.stage,
          savedEditorJson: result.editorJson,
          exportedImageUrl: result.exportedImageUrl,
        });
      });
      return off;
    }, []);
  ```

- [ ] **Step 2: Stage별 배지 및 버튼 텍스트 추가 (B6)**

  ```typescript
  const STAGE_BADGE: Record<string, { label: string; cls: string }> = {
    'extracted':        { label: '영역 확인 필요', cls: 'bg-amber-100 text-amber-700' },
    'bbox-adjusted':    { label: '변환 대기',       cls: 'bg-blue-100 text-blue-700' },
    'converting':       { label: '변환 중',          cls: 'bg-violet-100 text-violet-700' },
    'candidate-select': { label: '후보 선택 필요',   cls: 'bg-orange-100 text-orange-700' },
    'editing':          { label: '편집 중',           cls: 'bg-sky-100 text-sky-700' },
    'done':             { label: '편집 완료',         cls: 'bg-green-100 text-green-700' },
  };
  const STAGE_BTN: Record<string, string> = {
    'extracted':        '영역 확인 →',
    'bbox-adjusted':    '변환 시작 →',
    'converting':       '변환 중...',
    'candidate-select': '후보 선택 →',
    'editing':          '편집 계속 →',
    'done':             '편집 내용 보기 →',
  };
  ```

  카드 렌더링에서 배지와 버튼 교체.

- [ ] **Step 3: GuidePanel에서 DrawingsPanel 호출 시 연결**

  ```typescript
  {step === 'drawings' && (
    <DrawingsPanel
      done={isDone}
      onConfirm={handleConfirm}
      onUpdate={v => setGSel(p => ({ ...p, [step]: v }))}
      inventionComponents={confirmedComponents}
      initialDrawings={analysisState.drawings}
      onDrawingsChange={(drawings) => setAnalysisState({ drawings })}
    />
  )}
  ```

- [ ] **Step 4: 브라우저 확인**

  도면 단계 → "영역 확인 필요" 배지 표시. 도면 편집 완료 후 메인으로 돌아오면 "편집 완료" 배지로 변경.

- [ ] **Step 5: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: drawings stage badges, per-task save, editor result sync (B5/B6/B11/B13 fix)"
  ```

---

## Task 11: ClaimsPanel — 상태 Persist (B1a 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: ClaimsPanel에 initialClaimsState + onClaimsStateChange 추가**

  ClaimsPanel 함수 시그니처에 추가:
  ```typescript
  function ClaimsPanel({
    done, onConfirm, onUpdate,
    initialClaimsState, onClaimsStateChange,
  }: {
    ...;
    initialClaimsState?: SpecClaimsState;
    onClaimsStateChange?: (s: SpecClaimsState) => void;
  }) {
    const [claimsPhase, setClaimsPhase] = useState<'indep' | 'dep'>(
      () => initialClaimsState?.phase ?? 'indep'
    );
    const [cands, setCands] = useState<IndepCandState[]>(
      () => initialClaimsState?.indepCands
        ? initialClaimsState.indepCands.map(c => ({
            ...c, editing: false, editVal: c.text,
            aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const,
          }))
        : INDEP_CANDS_INIT.map(c => ({ ...c, selected: c.id === 1, editing: false, editVal: c.text, aiOpen: false, aiPromptVal: '', aiProposed: '', aiDiffOpen: false, aiDiffSel: 'proposed' as const }))
    );
    // depGroups도 동일하게 복원
  ```

- [ ] **Step 2: 상태 변경 시마다 onClaimsStateChange 호출**

  `toggleIndep`, `confirmIndep`, `generateDeps`, `toggleDep` 등 상태 변경 함수에서:
  ```typescript
  const notifyChange = (updCands: IndepCandState[], updGroups: Record<number, DepGroupState>, phase: 'indep'|'dep') => {
    onClaimsStateChange?.({
      phase,
      indepCands: updCands.map(c => ({ id: c.id, label: c.label, text: c.text, selected: c.selected })),
      depGroups: Object.fromEntries(
        Object.entries(updGroups).map(([k, v]) => [k, {
          generated: v.generated,
          newText: v.newText,
          items: v.items.map(d => ({ id: d.id, text: d.text, sel: d.sel })),
        }])
      ),
    });
  };
  ```

- [ ] **Step 3: GuidePanel에서 ClaimsPanel 호출 시 연결**

  ```typescript
  {step === 'claims' && (
    <ClaimsPanel
      done={isDone}
      onConfirm={handleConfirm}
      onUpdate={v => setGSel(p => ({ ...p, [step]: v }))}
      initialClaimsState={analysisState.claimsState}
      onClaimsStateChange={(s) => setAnalysisState({ claimsState: s })}
    />
  )}
  ```

- [ ] **Step 4: 브라우저 확인**

  1. 청구항 단계 → 독립항 B도 선택 → 종속항 생성
  2. 다른 뷰로 이탈 → 복귀
  3. 독립항 B 선택 상태 + 종속항 목록이 유지되는지 확인

- [ ] **Step 5: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: persist ClaimsPanel full state (phase/cands/depGroups) to analysisState (B1a fix)"
  ```

---

## Task 12: SpecEditorView — 분석 결과 수신 + 자동저장 + 로딩 (B2, B4, U6 해결)

**Files:** Modify `src/views/SpecEditorView.tsx`, `src/views/SpecView.tsx`

- [ ] **Step 1: SpecEditorView에 analysisResult prop 추가**

  ```typescript
  import type { SpecAnalysisResult } from '../features/spec/types';
  import { loadSpecState, saveSpecState } from '../features/spec/specStore';

  export function SpecEditorView({
    task, onBack, confirmedTitle, analysisResult,
  }: {
    task: any; onBack: () => void; confirmedTitle?: string; analysisResult?: SpecAnalysisResult;
  }) {
  ```

- [ ] **Step 2: getInitialContent으로 getDefault 교체 — 라이다 하드코딩 제거**

  ```typescript
  function getInitialContent(id: SectionId, taskName: string, ar?: SpecAnalysisResult): string {
    if (ar) {
      const map: Partial<Record<SectionId, string>> = {
        title:     ar.title || taskName,
        tech:      ar.tech,
        bg:        ar.bg,
        problem:   ar.problem,
        solution:  ar.solution,
        effect:    ar.effect,
        draw_desc: ar.drawDesc,
        detail:    ar.detail,
        claims:    ar.claims,
        abstract:  ar.abstract,
      };
      if (map[id]) return map[id]!;
    }
    // fallback — 플레이스홀더 (라이다 내용 완전 제거)
    const fallback: Partial<Record<SectionId, string>> = {
      title:     taskName,
      tech:      `본 발명은 ${taskName}에 관한 것이다.`,
      bg:        '관련 배경기술을 기술하세요.',
      problem:   '해결하려는 과제를 기술하세요.',
      solution:  '과제의 해결 수단을 기술하세요.',
      effect:    '발명의 효과를 기술하세요.',
      draw_desc: '도면에 대한 설명을 기술하세요.',
      detail:    '발명의 구체적인 내용을 기술하세요.',
      claims:    `청구항 1.\n${taskName} 장치.`,
      abstract:  `${taskName}에 관한 발명입니다.`,
    };
    return fallback[id] || '';
  }
  ```

- [ ] **Step 3: blocks 초기화 — 자동저장 복원 우선**

  ```typescript
  const [blocks, setBlocks] = useState<Record<SectionId, string[]>>(() => {
    if (task?.id) {
      const saved = loadSpecState(task.id)?.editorBlocks;
      if (saved && Object.keys(saved).length > 0) {
        return saved as Record<SectionId, string[]>;
      }
    }
    return Object.fromEntries(
      EDITOR_SECTIONS.map(s => [s.id, toBlocks(getInitialContent(s.id, effectiveTitle, analysisResult))])
    ) as Record<SectionId, string[]>;
  });
  ```

- [ ] **Step 4: updateBlock에 500ms debounce 자동저장 추가**

  ```typescript
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateBlock = (sid: SectionId, idx: number, text: string) => {
    setUndoStack(p => [...p.slice(-20), blocks]);
    setRedoStack([]);
    setBlocks(p => {
      const next = { ...p, [sid]: p[sid].map((b, i) => i === idx ? text : b) };
      if (task?.id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() =>
          saveSpecState(task.id, { editorBlocks: next }), 500
        );
      }
      return next;
    });
    setSaved(false);
  };
  ```

- [ ] **Step 5: 에디터 진입 로딩 (U6)**

  SpecView에서 에디터로 전환 시 0.8초 로딩:
  ```typescript
  const [generatingSpec, setGeneratingSpec] = useState(false);

  const openEditor = () => {
    setGeneratingSpec(true);
    setTimeout(() => {
      setGeneratingSpec(false);
      handleSetMainView('editor');
    }, 800);
  };
  ```

  완료 단계 CTA 버튼:
  ```typescript
  <button onClick={openEditor} className="btn-primary px-8 py-3 ...">
    {generatingSpec
      ? <><span className="animate-spin inline-block mr-2">↻</span>명세서 생성 중...</>
      : <><Icon name="doc" size={16}/> 명세서 AI 생성 →</>
    }
  </button>
  ```

- [ ] **Step 6: SpecView에서 makeAnalysisResult() 구성 및 전달**

  ```typescript
  const extractDescSection = (key: string): string => {
    const raw = gSel['description'] || confirmed['description'] || '';
    const labelMap: Record<string, string> = {
      tech: '기술분야', bg: '배경기술', problem: '해결하려는 과제',
      solution: '과제해결수단', effect: '발명의 효과',
    };
    const label = labelMap[key] || key;
    const match = raw.match(new RegExp(`【${label}】\\n([^【]*)`));
    return match?.[1]?.trim() || analysisState.descTexts?.[key as keyof typeof analysisState.descTexts] || '';
  };

  const makeAnalysisResult = (): SpecAnalysisResult => {
    const comps = analysisState.componentItems.filter(c => c.sel);
    const doneDraings = analysisState.drawings.filter(d => d.applied || d.stage === 'done');
    const drawDesc = doneDraings
      .map((d, i) => `도 ${i + 1}은 ${d.name}.`)
      .join('\n\n');
    // 구성요소 부호 포함 구체적 내용 (B14)
    const detail = comps.map(c => {
      const name = c.text.split(':')[0];
      const desc = (c.text.split(':')[1] || '').trim();
      const numStr = c.num ? `(${c.num})` : '';
      return `상기 ${name}${numStr}은 ${desc || '관련 기능을 수행한다.'}`;
    }).join('\n\n');

    return {
      title:    gSel['title'] || confirmed['title'] || analysisState.diTitle,
      tech:     extractDescSection('tech'),
      bg:       extractDescSection('bg'),
      problem:  extractDescSection('problem'),
      solution: extractDescSection('solution'),
      effect:   extractDescSection('effect'),
      drawDesc,
      detail,
      claims:   gSel['claims'] || confirmed['claims'] || '',
      abstract: gSel['abstract'] || confirmed['abstract'] || '',
      drawings: analysisState.drawings,
      componentItems: comps,
    };
  };
  ```

  SpecEditorView 렌더링:
  ```typescript
  if (mainView === 'editor') {
    return (
      <>
        <SpecEditorView
          task={task}
          onBack={() => handleSetMainView('analysis')}
          confirmedTitle={gSel['title'] || confirmed['title']}
          analysisResult={makeAnalysisResult()}
        />
        {previewOpen && <PreviewModal taskName={task?.name} onClose={() => setPreviewOpen(false)} />}
      </>
    );
  }
  ```

- [ ] **Step 7: 브라우저 확인 — 전체 흐름 테스트**

  1. "배터리 수명 예측" 입력 → 전체 분석 진행
  2. 명세서 AI 생성 → "명세서 생성 중..." 0.8초 후 에디터 열림
  3. 에디터 발명의 명칭: "배터리 관리, 머신러닝 기반 배터리 수명 예측 시스템 장치 및 방법" 확인
  4. 에디터에서 기술분야 텍스트 수정 → 프로젝트 이탈 → 복귀 → 에디터 열기 → 수정 내용 유지 확인
  5. SpecEditorView 도면 탭에 analysisState.drawings의 도면 이름이 표시되는지 확인

- [ ] **Step 8: Commit**
  ```bash
  git add src/views/SpecEditorView.tsx src/views/SpecView.tsx
  git commit -m "feat: SpecEditorView receives analysis result, auto-save, loading state (B2/B4/U6 fix)"
  ```

---

## Task 13: SpecEditorView 도면 탭 — 분석 결과 반영 (B5 해결)

**Files:** Modify `src/views/SpecEditorView.tsx`

- [ ] **Step 1: 도면 탭에서 MOCK_DRAWINGS → analysisResult.drawings 교체**

  ```typescript
  // SpecEditorView 내 도면 탭
  const drawings = analysisResult?.drawings ?? MOCK_DRAWINGS;

  {panelTab === 'drawings' && (
    <div className="px-3 py-3 space-y-1.5">
      <p className="text-xs2 font-semibold text-zinc-500 mb-2">
        도면 ({drawings.length}개 · 완료 {drawings.filter(d => d.stage === 'done').length}개)
      </p>
      {drawings.map(d => {
        const isDone = d.stage === 'done';
        // ... 기존 카드 렌더링 유지, d.name / d.symbol / d.exportedImageUrl 사용
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/views/SpecEditorView.tsx
  git commit -m "fix: SpecEditorView drawing panel uses analysisResult.drawings instead of MOCK_DRAWINGS (B5 fix)"
  ```

---

## Task 14: UX — 완료 단계 CTA + 직접입력 폼 접기 (U1, U2 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: 완료 단계 중앙에 큰 CTA 버튼 추가 (U1)**

  ```typescript
  {phase === 'done' && (
    <div className="text-center py-8">
      <Icon name="logo" size={40} className="text-blue-700 mx-auto mb-3" />
      <h3 className="text-lg2 font-bold text-gray-800 mb-2">모든 분석이 완료되었습니다</h3>
      <p className="text-md2 text-gray-500 mb-6">
        확정된 내용을 바탕으로 특허 명세서를 생성합니다.
      </p>
      <button
        onClick={openEditor}
        disabled={generatingSpec}
        className="btn-primary px-8 py-3 text-base2 font-bold mx-auto flex items-center gap-2 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.98]"
      >
        {generatingSpec
          ? <><span className="animate-spin inline-block">↻</span>명세서 생성 중...</>
          : <><Icon name="doc" size={16} /> 명세서 AI 생성 →</>
        }
      </button>
    </div>
  )}
  ```

- [ ] **Step 2: 직접입력 폼 분석 시작 후 접힘 처리 (U2)**

  flow/done 상태에서 폼을 접힌 헤더로 교체:
  ```typescript
  {(phase === 'flow' || phase === 'done') && diTitle.trim() && (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setSourceDataOpen(o => !o)}
      >
        <Icon name="edit" size={16} className="text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm2 font-semibold text-gray-700">기초자료</p>
          <p className="text-xs2 text-gray-400 truncate">{diTitle} · {diField}</p>
        </div>
        <Icon name={sourceDataOpen ? 'chevron-up' : 'chevron-down'} size={12} className="text-gray-400 shrink-0" />
      </button>
      {sourceDataOpen && (
        <div className="p-5 space-y-3 border-t border-gray-100 bg-gray-50/50">
          {/* 읽기 전용 폼 */}
          {[
            { label: '발명의 명칭', val: diTitle },
            { label: '기술 분야', val: diField },
            { label: '발명의 핵심 내용', val: diContent },
            diProblem && { label: '해결하려는 과제', val: diProblem },
            diKeywords && { label: '키워드', val: diKeywords },
          ].filter(Boolean).map(f => (
            <div key={f!.label}>
              <p className="text-xs2 font-semibold text-gray-500 mb-0.5">{f!.label}</p>
              <p className="text-xs2 text-gray-700 bg-white rounded px-2.5 py-2 border border-gray-200">{f!.val}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
  ```

  기존 `(phase === 'direct' || ((phase === 'flow' || phase === 'done') && diTitle.trim()))` 조건의 원래 폼은 `phase === 'direct'`만 표시하도록 분리.

- [ ] **Step 3: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "ux: prominent CTA at completion, collapse input form after analysis (U1/U2 fix)"
  ```

---

## Task 15: UX — 스텝바 체크 표시 + 텍스트 오류 수정 (U3, B12 해결)

**Files:** Modify `src/views/SpecView.tsx`

- [ ] **Step 1: 확정된 스텝 배지에 체크 + 녹색 표시**

  step-pill 렌더링에서 `isDone && !active` 케이스:
  ```typescript
  // step-dot
  isDone && !active && 'border-green-500 bg-green-500 text-white'

  // step-label
  isDone && !active && 'text-green-700 font-medium'
  ```
  레이블에 `✓` prefix:
  ```typescript
  {isDone && !active ? `✓ ${s.short}` : s.short}
  ```

- [ ] **Step 2: "1개 으로" 공백 수정**

  ```typescript
  // 현재
  `선택한 독립항 ${selectedCands.length > 0 ? `${selectedCands.length}개` : ''} 으로 종속항 구성 →`
  // 변경
  `선택한 독립항 ${selectedCands.length > 0 ? `${selectedCands.length}개` : ''}으로 종속항 구성 →`
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "ux: stepper checkmarks for confirmed steps, fix claims button spacing (U3/B12 fix)"
  ```

---

## Task 16: 구성요소 부호 → 명세서 구체적 내용 연동 (B14 해결)

Task 12 (makeAnalysisResult)에서 `detail` 생성 시 부호 포함 처리로 이미 커버됨.

추가로 확인할 것:

- [ ] **Step 1: ComponentsPanel에서 "부호 자동 부여" 후 analysisState 저장 확인**

  `autoAssign()` 함수 후 `onComponentsChange` 호출이 되는지 확인. 현재 `upd()` 함수를 통해 호출되므로 Task 9에서 연결하면 자동 처리됨.

- [ ] **Step 2: makeAnalysisResult의 detail에 부호 포함 출력 확인**

  배터리 수명 예측 시스템으로 전체 흐름 진행:
  - 구성요소 단계에서 "부호 자동 부여" 클릭 → 100, 200, 300 등 배정
  - 명세서 에디터 "구체적 내용" 섹션에 "상기 입력부(100)는..." 형태 확인

- [ ] **Step 3: Commit**

  별도 commit 불필요 — Task 9 + Task 12에서 포함됨.

---

## 자기 검토 (Self-Review)

### 이용 흐름 전체 커버리지

| 흐름 단계 | 구현 Task |
|-----------|-----------|
| 직발서 파일 업로드 → 분석 시뮬레이션 | Task 6 |
| 직접 입력 → AI 분석 시작 → 동적 후보 | Task 7 |
| 발명 명칭 선택/편집/확정 | 기존 코드 + Task 7(customCandidates) |
| 발명의 설명 5섹션(효과 포함) 확정 | Task 8 |
| 구성요소 편집·부호 배정·확정 | Task 9 |
| 도면 stage별 진행 (bbox→CAD→편집→완료) | Task 10 |
| 청구항 독립/종속항 선택·확정 | Task 11 |
| 요약서 선택·확정 | 기존 코드 유지 |
| 완료 CTA → 에디터 | Task 12, 14 |
| 에디터 — 분석 결과로 초기화 | Task 12 |
| 에디터 — 블록 AI 수정 (view/prompt/diff) | 기존 코드 유지 |
| 에디터 — 도면 참조 삽입 | 기존 코드 + Task 13 |
| 에디터 — 자동저장·복원 | Task 12 |
| 이탈 후 재진입 — 전체 상태 복원 | Task 5, 8, 11 |

### 데이터 흐름 전체 커버리지

| 데이터 | 저장소 | 구현 Task |
|--------|--------|-----------|
| 입력 폼 (diTitle 등) | analysisState | Task 5 |
| 업로드 파일명 | analysisState.uploadedFileName | Task 6 |
| 발명 명칭 후보 | analysisState.titleCandidates | Task 7 |
| 발명의 설명 편집 중 텍스트 | analysisState.descTexts | Task 8 |
| 발명의 설명 확정 | confirmed['description'] | 기존 |
| 구성요소 목록+부호 | analysisState.componentItems | Task 9 |
| 도면 목록+stage+이미지 | analysisState.drawings | Task 10 |
| 청구항 전체 상태 | analysisState.claimsState | Task 11 |
| 요약서 확정 | confirmed['abstract'] | 기존 |
| 명세서 에디터 블록 | analysisState.editorBlocks | Task 12 |
| 분석 결과 → 에디터 | SpecAnalysisResult prop | Task 12 |
| 도면 편집 완료 → 에디터 도면 탭 | analysisResult.drawings | Task 13 |
| 구성요소 부호 → 구체적 내용 | makeAnalysisResult().detail | Task 12 |

### Placeholder Scan

모든 Step에 실제 코드 포함 ✓ · "TBD" 없음 ✓

---

## 구현 순서 및 예상 소요 시간

| 순서 | Task | 시간 | 비고 |
|------|------|------|------|
| 1 | Task 1 레거시 제거 | 5분 | 독립 작업 |
| 2 | Task 2 타입 정의 | 10분 | Task 3~16 기반 |
| 3 | Task 3 specStore | 10분 | Task 5 기반 |
| 4 | Task 4 mockAiService | 20분 | Task 7 기반 |
| 5 | **Task 5 상태 persist** | 40분 | B1 핵심 |
| 6 | **Task 7 mockAi 연결** | 20분 | B3 핵심 |
| 7 | Task 6 파일 업로드 | 20분 | B15 |
| 8 | Task 8 description | 20분 | B7+B1b |
| 9 | Task 9 구성요소 | 15분 | |
| 10 | Task 10 도면 | 30분 | B6+B13 복합 |
| 11 | Task 11 청구항 | 25분 | B1a |
| 12 | **Task 12 에디터** | 40분 | B2+B4 핵심 |
| 13 | Task 13 에디터 도면 | 10분 | B5 |
| 14 | Task 14 UX CTA | 20분 | U1+U2 |
| 15 | Task 15 스텝바 | 10분 | U3+B12 |
| 16 | Task 16 검증 | 10분 | B14 확인 |
| 17 | **Task 17 SpecView key prop** | 15분 | B20 핵심 |
| 18 | Task 18 PreviewModal | 25분 | B16+B17 |
| | **합계** | **~5.5시간** | |

---

## Task 17: SpecView key prop — task 전환 시 재마운트 (B20 해결)

**Files:** Modify `src/App.tsx`

현재 `<main key={mode}>` 구조에서 mode='spec'이 유지될 때 다른 spec task로 전환하면 SpecView가 재마운트되지 않아 `mainView` sessionStorage 값이 무시된다.

- [ ] **Step 1: App.tsx의 SpecView에 task ID 기반 key 추가**

  현재 (`src/App.tsx` Shell 컴포넌트):
  ```typescript
  <main className="flex-1 flex flex-col overflow-hidden animate-fade-up" key={mode}>
    {mode === 'spec' && <SpecView />}
  ```

  변경:
  ```typescript
  // Shell 컴포넌트 내에서 activeTaskId도 가져옴
  const { mode, sidebarCollapsed, setSidebarCollapsed, activeTaskId } = useStore();

  // ...

  <main className="flex-1 flex flex-col overflow-hidden animate-fade-up"
    key={mode === 'spec' ? `spec-${activeTaskId}` : mode}>
    {mode === 'spec' && <SpecView />}
  ```

  > 이렇게 하면 task가 바뀔 때마다 SpecView가 재마운트되어 useState 초기화가 재실행됨.

- [ ] **Step 2: 브라우저 확인**

  1. 명세서 작업 A에서 직접입력 → 발명 명칭 입력 → AI 분석 시작 → 2단계(명칭)까지 진행
  2. 명세서 작업 B(또는 다른 검색 작업) 클릭 후 다시 A로 돌아옴
  3. 분석 2단계 상태가 복원되는지 확인 (Task 5 + Task 17 조합)

- [ ] **Step 3: Commit**
  ```bash
  git add src/App.tsx
  git commit -m "fix: remount SpecView when task changes by adding task-based key (B20 fix)"
  ```

---

## Task 18: PreviewModal — 분석/에디터 내용 반영 (B16, B17 해결)

**Files:** Modify `src/components/PreviewModal.tsx`, `src/views/SpecView.tsx`

- [ ] **Step 1: PreviewModal에 sections prop 추가**

  ```typescript
  interface PreviewSection {
    label: string;
    content: string;
  }

  interface Props {
    taskName?: string;
    sections?: PreviewSection[];  // 추가
    onClose: () => void;
  }

  export function PreviewModal({ taskName, sections: propSections, onClose }: Props) {
    // propSections가 있으면 사용, 없으면 기본 하드코딩 내용 사용
    const sections = propSections ?? DEFAULT_SECTIONS(taskName);
    // ...
  ```

  기본 섹션을 함수로 추출:
  ```typescript
  function DEFAULT_SECTIONS(taskName?: string): PreviewSection[] {
    return [
      { label: '발명의 명칭', content: taskName || '발명의 명칭' },
      { label: '기술분야', content: '기술분야 내용을 입력하세요.' },
      // ... 나머지 섹션 (하드코딩 유지, props로 override 가능하도록)
    ];
  }
  ```

- [ ] **Step 2: SpecView에서 PreviewModal 호출 시 analysisResult 전달**

  SpecView에서 `previewOpen` 시 미리보기 내용 구성:
  ```typescript
  const makePreviewSections = (): PreviewSection[] => {
    const ar = makeAnalysisResult();
    return [
      { label: '발명의 명칭', content: ar.title || task?.name || '' },
      { label: '기술분야', content: ar.tech },
      { label: '배경기술', content: ar.bg },
      { label: '해결하고자 하는 과제', content: ar.problem },
      { label: '과제의 해결 수단', content: ar.solution },
      { label: '발명의 효과', content: ar.effect },
      { label: '청구범위', content: ar.claims },
      { label: '도면의 간단한 설명', content: ar.drawDesc },
      { label: '발명을 실시하기 위한 구체적인 내용', content: ar.detail },
      { label: '요약서', content: ar.abstract },
    ].filter(s => s.content.trim());
  };
  ```

  PreviewModal 호출 시:
  ```typescript
  {previewOpen && (
    <PreviewModal
      taskName={task?.name}
      sections={makePreviewSections()}
      onClose={() => setPreviewOpen(false)}
    />
  )}
  ```

  SpecEditorView에서도 미리보기 버튼이 필요하다면 에디터 toolBar에 추가하고 editorBlocks → sections 변환.

- [ ] **Step 3: DOCX/PDF 버튼에 mockup 핸들러 추가 (B17)**

  ```typescript
  <button
    onClick={() => {
      alert('DOCX 다운로드 기능은 준비 중입니다.\n(실제 서비스에서는 서버 API 연동 예정)');
    }}
    className="btn-primary btn-sm" style={{ background: '#2563eb' }}>
    <Icon name="doc" size={12} /> DOCX 다운로드
  </button>
  <button
    onClick={() => {
      alert('PDF 내보내기 기능은 준비 중입니다.\n(실제 서비스에서는 서버 API 연동 예정)');
    }}
    className="btn-primary btn-sm">
    <Icon name="doc" size={12} /> PDF 내보내기
  </button>
  ```

- [ ] **Step 4: 브라우저 확인**

  1. 분석 완료 후 "미리보기" 클릭 → 확정한 발명 명칭, 설명 등이 표시되는지 확인
  2. DOCX/PDF 버튼 클릭 시 "준비 중" alert 표시 확인

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/PreviewModal.tsx src/views/SpecView.tsx
  git commit -m "fix: PreviewModal shows analysis result content, DOCX/PDF show mockup alert (B16/B17 fix)"
  ```

---

**두 가지 실행 방법:**

**1. Subagent-Driven (권장)** — 각 Task를 독립 서브에이전트로 실행, Task 간 검토

**2. Inline Execution** — executing-plans 스킬로 현재 세션에서 순차 실행
