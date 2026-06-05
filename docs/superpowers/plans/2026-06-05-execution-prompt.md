# AXPlain.ai 실행 프롬프트

당신은 `c:\project\06_AXP\react-app` React 앱(React 18 + TypeScript + Tailwind CSS)의 UX/UI 버그를 수정한다.

아래 7개 Task를 **Task 1 → 7 순서대로** 실행하라. 각 Task 완료 시 즉시 `npm run build`로 타입 에러 없음을 확인한 뒤 다음 Task로 진행한다.

**스타일 원칙**: 기존 Tailwind 클래스(`ck-*`, `btn-primary`, `text-xs2`, `scroll-thin`)를 그대로 쓴다. 새 클래스를 만들지 않는다.

---

## Task 1 — SpecView 7단계 분석 상태 영속화

### 문제
`src/views/SpecView.tsx`의 모든 분석 상태(`phase`, `curStep`, `confirmed`, `gSel`, 입력폼 값, AI 후보 배열)가 컴포넌트 `useState`에만 존재한다. 다른 작업으로 이탈 후 재진입하면 Step 1로 초기화된다.

### 이미 존재하는 것
- `src/features/spec/types.ts`의 `SpecAnalysisState` — 필요한 모든 필드가 이미 정의되어 있다
- `src/features/spec/specStore.ts`의 `loadSpecState(taskId)` / `saveSpecState(taskId, patch)` — 이미 구현되어 있다

### 실행

**1-A. `src/views/SpecView.tsx` 상단 import에 추가**

```typescript
import { loadSpecState, saveSpecState } from '../features/spec/specStore';
import type { SpecAnalysisState } from '../features/spec/types';
```

**1-B. `SpecView` 함수 내부 — `const task = ...` 바로 다음 줄에 삽입**

```typescript
const saved = task?.id ? loadSpecState(task.id) : null;
```

**1-C. 아래 `useState` 선언들을 교체**

```typescript
// 교체 전
const [phase, setPhase] = useState<'upload' | 'direct' | 'flow' | 'done'>('upload');
const [curStep, setCurStep] = useState<StepId>('upload');
const [confirmed, setConfirmed] = useState<Partial<Record<StepId, string>>>({});
const [guideStep, setGuideStep] = useState<StepId>('title');
const [gSel, setGSel] = useState<Partial<Record<StepId, string>>>({});
const [diTitle, setDiTitle] = useState('');
const [diField, setDiField] = useState('');
const [diContent, setDiContent] = useState('');
const [diProblem, setDiProblem] = useState('');
const [diKeywords, setDiKeywords] = useState('');
const [titleCandidates, setTitleCandidates] = useState<string[]>([]);
const [abstractCandidates, setAbstractCandidates] = useState<string[]>([]);
const [aiComponents, setAiComponents] = useState<{ id: number; text: string; sel: boolean; num: string; depth: number }[]>([]);

// 교체 후
const [phase, setPhase] = useState<'upload' | 'direct' | 'flow' | 'done'>(
  saved?.phase ?? 'upload'
);
const [curStep, setCurStep] = useState<StepId>(
  (saved?.curStep as StepId) ?? 'upload'
);
const [confirmed, setConfirmed] = useState<Partial<Record<StepId, string>>>(
  (saved?.confirmed as Partial<Record<StepId, string>>) ?? {}
);
const [guideStep, setGuideStep] = useState<StepId>(
  (saved?.curStep as StepId) ?? 'title'
);
const [gSel, setGSel] = useState<Partial<Record<StepId, string>>>(
  (saved?.gSel as Partial<Record<StepId, string>>) ?? {}
);
const [diTitle, setDiTitle] = useState(saved?.diTitle ?? '');
const [diField, setDiField] = useState(saved?.diField ?? '');
const [diContent, setDiContent] = useState(saved?.diContent ?? '');
const [diProblem, setDiProblem] = useState(saved?.diProblem ?? '');
const [diKeywords, setDiKeywords] = useState(saved?.diKeywords ?? '');
const [titleCandidates, setTitleCandidates] = useState<string[]>(saved?.titleCandidates ?? []);
const [abstractCandidates, setAbstractCandidates] = useState<string[]>(saved?.abstractCandidates ?? []);
const [aiComponents, setAiComponents] = useState<{ id: number; text: string; sel: boolean; num: string; depth: number }[]>(
  (saved?.componentItems as { id: number; text: string; sel: boolean; num: string; depth: number }[]) ?? []
);
```

**1-D. `flowRef` 선언 다음 줄에 자동저장 useEffect 삽입**

```typescript
const flowSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (!task?.id) return;
  if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current);
  flowSaveTimerRef.current = setTimeout(() => {
    saveSpecState(task.id, {
      phase,
      curStep,
      confirmed: confirmed as SpecAnalysisState['confirmed'],
      gSel: gSel as SpecAnalysisState['gSel'],
      diTitle, diField, diContent, diProblem, diKeywords,
      titleCandidates,
      abstractCandidates,
      componentItems: aiComponents as SpecAnalysisState['componentItems'],
      mainView,
    });
  }, 400);
  return () => { if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current); };
}, [phase, curStep, confirmed, gSel, diTitle, diField, diContent,
    diProblem, diKeywords, titleCandidates, abstractCandidates, aiComponents, mainView, task?.id]);
```

**1-E. `confirm` 함수 선언 바로 앞에 `resetAnalysis` 함수 삽입**

```typescript
const resetAnalysis = () => {
  setPhase('upload');
  setCurStep('upload');
  setConfirmed({});
  setGSel({});
  setTitleCandidates([]);
  setAbstractCandidates([]);
  setAiComponents([]);
  if (task?.id) {
    saveSpecState(task.id, {
      phase: 'upload', curStep: 'upload',
      confirmed: {}, gSel: {},
      titleCandidates: [], abstractCandidates: [], componentItems: [],
    });
  }
};
```

**1-F. JSX에서 progress bar / 액션바 영역에 "↺ 다시 시작" 버튼 추가**

`phase === 'flow'` 또는 `phase === 'done'`일 때 표시되는 상단 액션바의 가장 왼쪽(단계 표시기 왼쪽)에 삽입한다:

```tsx
{(phase === 'flow' || phase === 'done') && (
  <button
    onClick={resetAnalysis}
    className="text-xs text-ck-muted hover:text-red-500 transition-colors flex-shrink-0"
    title="처음부터 다시 시작"
  >
    ↺ 다시 시작
  </button>
)}
```

---

## Task 2 — GuidePanel AI 수정안 Step 격리 + "편집 중:" 라벨 수정

### 문제
`GuidePanel` (SpecView.tsx 내부 함수 컴포넌트)의 `guideChatMsgs`, `focusCtx` 등 내부 state가 `guideStep` 변경 시 초기화되지 않는다. 이전 step의 AI 수정안 카드가 다음 step에도 그대로 표시되고, "편집 중: 발명의 명칭" 라벨이 고정된다.

### 실행

`SpecView.tsx`에서 `<GuidePanel` 렌더링 부분을 찾아 `key` prop 한 줄을 추가한다:

```tsx
// 현재
<GuidePanel
  step={guideStep}
  gSel={gSel}
  ...

// 수정 후
<GuidePanel
  key={`guide-panel-${guideStep}`}
  step={guideStep}
  gSel={gSel}
  ...
```

이 한 줄로 `guideStep`이 바뀔 때 GuidePanel이 re-mount되어 `guideChatMsgs`, `focusCtx`, `editingIdx`, `descMode` 등 모든 내부 state가 초기값으로 리셋된다.

---

## Task 3 — "도면 편집 →" 버튼: 팝업 차단 시 모달 폴백 + Stage 1 취소 버튼

### 문제
데스크탑에서 `openEditorTab()`이 `window.open()`을 호출하지만 브라우저 팝업 차단 시 아무것도 열리지 않는다. Stage 1에서 작업 취소 방법이 없다.

### 실행

**3-A. `src/features/drawing-workflow/editorChannel.ts`**

`openEditorTab` 함수의 반환 타입을 `void`에서 `boolean`으로 변경한다:

```typescript
// 변경 전
export function openEditorTab(session: EditorSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const base = window.location.href.split('#')[0];
  window.open(`${base}#drawing-editor`, '_blank');
}

// 변경 후
export function openEditorTab(session: EditorSession): boolean {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const base = window.location.href.split('#')[0];
  const newWin = window.open(`${base}#drawing-editor`, '_blank');
  return newWin !== null;
}
```

**3-B. `src/views/SpecView.tsx`의 `DrawingsPanel` 내부 `openEditor` 함수 교체**

```typescript
const openEditor = (id: string) => {
  if (isMobile()) {
    setModalStartId(id);
    setModalOpen(true);
  } else {
    const draw = drawings.find(d => d.id === id);
    const opened = openEditorTab({
      drawingId: id,
      drawings,
      components: inventionComponents ?? [],
      references: (inventionComponents ?? []).map(c => ({ number: c.number, name: c.name })),
      drawingName: draw?.name ?? id,
      timestamp: Date.now(),
    });
    // 팝업 차단 시 모달로 폴백
    if (!opened) {
      setModalStartId(id);
      setModalOpen(true);
    }
  }
};
```

**3-C. `src/features/drawing-workflow/DrawingEditorModal.tsx` — Stage 1 취소 버튼**

Stage 1(crop/reselect) 화면의 하단 버튼 영역을 찾는다. "영역 확인 완료 — 변환 시작" 버튼이 단독으로 있을 것이다. 이를 다음으로 교체한다:

```tsx
<div className="flex items-center justify-between w-full gap-2">
  <button
    type="button"
    onClick={onClose}
    className="text-sm text-ck-muted hover:text-red-500 transition-colors px-3 py-1.5 rounded"
  >
    ✕ 취소
  </button>
  {/* 기존 "영역 확인 완료 — 변환 시작" 버튼을 여기에 유지 */}
</div>
```

---

## Task 4 — 해결수단 섹션 추가 (Step 3 연결)

### 문제
`DESC_SECTIONS` 배열에 `solution`(과제의 해결 수단) 항목이 없다.
`makeAnalysisResult()`의 `solution` 필드가 `''`로 하드코딩되어 있다.
미리보기 모달과 SpecEditorView의 `solution` 섹션이 항상 비어 있다.

### 실행

**4-A. `src/views/SpecView.tsx`의 `DESC_SECTIONS` 배열 수정**

`problem` 항목과 `effect` 항목 **사이**에 삽입한다:

```typescript
  {
    key: 'solution', label: '과제의 해결 수단',
    text: '본 발명의 과제를 해결하기 위한 수단으로, 라이다 포인트 클라우드 데이터를 입력받는 데이터 수집부(100)와, 입력된 데이터를 정규화·필터링하는 전처리부(200)와, 딥러닝 기반 특징을 추출하는 특징 추출부(300)와, 최종 객체를 분류하는 인식부(400)와, 인식 결과를 자율주행 제어부에 전달하는 출력부(500)를 포함한다.',
  },
```

**4-B. `makeAnalysisResult()` 수정**

`solution: '',`을 다음으로 교체한다:

```typescript
solution: extractDescSec('과제의 해결 수단'),
```

**4-C. `makePreviewSections()` 수정**

`해결하고자 하는 과제` 항목 바로 다음에 삽입한다:

```typescript
{ label: '과제의 해결 수단', content: extractDesc('과제의 해결 수단') },
```

---

## Task 5 — AI 분석 시작 시 작업 이름 자동 저장

### 실행

**5-A. `src/views/SpecView.tsx`에서 `useStore()` 구조분해에 `taskUpdate` 추가**

```typescript
// 현재
const { tasks, activeTaskId } = useStore();

// 수정 후
const { tasks, activeTaskId, taskUpdate } = useStore();
```

**5-B. `startFlow` 함수 내부의 `setTimeout` 콜백에서 `setPhase('flow');` 다음 줄에 삽입**

```typescript
      if (task?.id && title) {
        const taskName = title.length > 40 ? title.slice(0, 40) + '…' : title;
        taskUpdate(task.id, { name: taskName });
      }
```

---

## Task 6 — DOCX 다운로드 + PDF 내보내기 구현

### 실행

**6-A. 패키지 설치**

```bash
npm install docx file-saver
npm install --save-dev @types/file-saver
```

**6-B. `src/utils/exportDocx.ts` 신규 생성**

```typescript
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

export interface ExportSection {
  label: string;
  content: string;
}

export async function exportDocx(title: string, sections: ExportSection[]): Promise<void> {
  const children = sections.flatMap(sec => [
    new Paragraph({
      text: sec.label,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    }),
    ...sec.content.split('\n\n').filter(p => p.trim()).map(para =>
      new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 24, font: 'Malgun Gothic' })],
        spacing: { after: 160 },
        alignment: AlignmentType.JUSTIFIED,
      })
    ),
  ]);

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: `[특허명세서] ${title}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
        }),
        ...children,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
  saveAs(blob, `${safeName}_명세서.docx`);
}
```

**6-C. `src/utils/exportPdf.ts` 신규 생성**

```typescript
export interface ExportSection {
  label: string;
  content: string;
}

export function exportPdf(title: string, sections: ExportSection[]): void {
  const sectionsHtml = sections
    .filter(s => s.content.trim())
    .map(s => `
      <h2>${s.label}</h2>
      ${s.content.split('\n\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('')}
    `).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${title} 특허명세서</title>
  <style>
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 11pt; line-height: 1.9; margin: 0; color: #111; }
    .wrap { margin: 2.5cm; }
    h1 { font-size: 15pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
    h2 { font-size: 12pt; margin-top: 28px; margin-bottom: 8px; border-left: 3px solid #555; padding-left: 8px; }
    p { text-align: justify; margin: 0 0 8px; }
    @page { margin: 2.5cm; size: A4; }
    @media print { .wrap { margin: 0; } }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>[특허명세서] ${title}</h1>
    ${sectionsHtml}
  </div>
</body>
</html>`;

  const pw = window.open('', '_blank');
  if (!pw) {
    alert('팝업이 차단되어 있습니다.\n주소창 우측의 팝업 허용 버튼을 클릭한 후 다시 시도하세요.');
    return;
  }
  pw.document.write(html);
  pw.document.close();
  pw.focus();
  setTimeout(() => { pw.print(); }, 600);
}
```

**6-D. `src/components/PreviewModal.tsx` 수정**

import에 추가:
```typescript
import { exportDocx } from '../utils/exportDocx';
import { exportPdf } from '../utils/exportPdf';
import { Loader2 } from 'lucide-react';
```

컴포넌트 내부에 state 추가:
```typescript
const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null);
```

`handleDocx` 교체:
```typescript
const handleDocx = async () => {
  setExporting('docx');
  try {
    await exportDocx(taskName ?? '특허명세서', sections);
  } catch {
    alert('DOCX 생성 중 오류가 발생했습니다.');
  } finally {
    setExporting(null);
  }
};
```

`handlePdf` 교체:
```typescript
const handlePdf = () => {
  setExporting('pdf');
  exportPdf(taskName ?? '특허명세서', sections);
  setTimeout(() => setExporting(null), 800);
};
```

DOCX 버튼 교체:
```tsx
<button
  onClick={handleDocx}
  disabled={exporting !== null}
  className="btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-60"
  style={{ background: '#2563eb' }}
>
  {exporting === 'docx' ? <Loader2 size={12} className="animate-spin" /> : <Icon name="doc" size={12} />}
  DOCX 다운로드
</button>
```

PDF 버튼 교체:
```tsx
<button
  onClick={handlePdf}
  disabled={exporting !== null}
  className="btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-60"
>
  {exporting === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <Icon name="doc" size={12} />}
  PDF 내보내기
</button>
```

---

## Task 7 — 작업 검색 패널 구현

### 문제
"작업 검색" 버튼 클릭 시 독립 검색 화면이 없고 이전 작업으로 리다이렉트된다.

### 실행

`src/components/Sidebar.tsx`를 열어 다음을 실행한다.

**7-A. state 추가** (Sidebar 컴포넌트 내부):

```typescript
const [taskSearchOpen, setTaskSearchOpen] = useState(false);
const [taskSearchQuery, setTaskSearchQuery] = useState('');
const [taskSearchType, setTaskSearchType] = useState('all');
```

**7-B. "작업 검색" 버튼 onClick 교체**:

```typescript
onClick={() => { setTaskSearchOpen(true); setTaskSearchQuery(''); setTaskSearchType('all'); }}
```

**7-C. 사이드바 최상위 컨테이너 안에 검색 오버레이 추가**

사이드바의 최상위 `div`(relative position이어야 함 — 없으면 `relative` 클래스 추가)에 자식으로 삽입:

```tsx
{taskSearchOpen && (
  <div className="absolute inset-0 z-30 bg-white flex flex-col">
    {/* 헤더 */}
    <div className="flex items-center gap-2 px-3 py-2 border-b border-ck-border shrink-0">
      <span className="text-sm font-semibold flex-1">작업 검색</span>
      <button
        onClick={() => setTaskSearchOpen(false)}
        className="text-ck-muted hover:text-ck-text w-6 h-6 flex items-center justify-center rounded"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>

    {/* 검색 입력 */}
    <div className="px-3 py-2 border-b border-ck-border shrink-0 space-y-1.5">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ck-muted pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </span>
        <input
          autoFocus
          type="text"
          value={taskSearchQuery}
          onChange={e => setTaskSearchQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setTaskSearchOpen(false); }}
          placeholder="작업 이름 검색..."
          className="w-full pl-7 pr-3 py-1.5 text-xs border border-ck-border rounded-lg bg-ck-surface focus:outline-none focus:border-blue-500"
        />
      </div>
      {/* 타입 필터 */}
      <div className="flex gap-1 flex-wrap">
        {[
          { id: 'all', label: '전체' },
          { id: 'spec', label: '명세서' },
          { id: 'patent', label: '특허' },
          { id: 'paper', label: '논문' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setTaskSearchType(f.id)}
            className={`text-xs2 px-2 py-0.5 rounded-full border transition-colors ${
              taskSearchType === f.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-ck-border text-ck-muted hover:border-blue-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>

    {/* 결과 */}
    <div className="flex-1 overflow-y-auto scroll-thin py-1">
      {(() => {
        const q = taskSearchQuery.toLowerCase();
        const filtered = tasks.filter(t => {
          if (q && !t.name.toLowerCase().includes(q)) return false;
          if (taskSearchType !== 'all' && t.type !== taskSearchType) return false;
          return true;
        });
        if (filtered.length === 0) {
          return (
            <div className="text-center text-ck-muted py-8">
              <p className="text-xs">검색 결과 없음</p>
              {(taskSearchQuery || taskSearchType !== 'all') && (
                <button
                  onClick={() => { setTaskSearchQuery(''); setTaskSearchType('all'); }}
                  className="text-xs text-blue-500 mt-1 hover:underline"
                >
                  필터 초기화
                </button>
              )}
            </div>
          );
        }
        return filtered.map(t => {
          // Sidebar에서 task 클릭 시 사용하는 기존 핸들러와 동일하게 호출
          const handleClick = () => {
            // 기존 sidebar의 task 선택 로직 참고하여 동일하게 실행
            // (예: setActiveTaskId(t.id), setMode('spec') 등)
            setTaskSearchOpen(false);
          };
          return (
            <button
              key={t.id}
              onClick={handleClick}
              className="w-full text-left px-3 py-2 hover:bg-ck-hover transition-colors flex items-center gap-2"
            >
              {t.favorite && <span className="text-amber-400 text-xs leading-none">★</span>}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{t.name}</p>
                <p className="text-xs2 text-ck-muted">
                  {t.type === 'spec' ? '명세서' : t.type === 'patent' ? '특허 검색' : '논문 검색'}
                </p>
              </div>
            </button>
          );
        });
      })()}
    </div>

    <div className="px-3 py-1.5 border-t border-ck-border shrink-0">
      <p className="text-xs2 text-ck-muted">총 {tasks.length}개 작업</p>
    </div>
  </div>
)}
```

`handleClick` 내부의 task 선택 로직은 Sidebar.tsx에서 기존 task 클릭 시 실행하는 코드(예: `setActiveTaskId`, `setMode` 호출)를 그대로 복사하여 사용한다.

---

## UI/UX 시각 수정 (Task 8)

코드 수정 완료 후 다음 UI/UX 시각 문제를 추가로 수정한다.

### 8-A. Stage 2 "버전 C" 라디오 버튼 시각 오류

`src/features/drawing-workflow/DrawingEditorModal.tsx`에서 Stage 2(decide) 화면의 버전 선택 라디오 버튼을 찾는다.  
"버전 C"만 비활성화된 것처럼 보이는 원인을 파악하고 수정한다.

3개 버전 버튼(`A`, `B`, `C`)이 동일한 스타일로 렌더링되도록 한다:

```tsx
{(['A', 'B', 'C'] as const).map(v => (
  <label
    key={v}
    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
      selectedVersion === v
        ? 'border-blue-500 bg-blue-50'
        : 'border-ck-border hover:border-blue-300 bg-white'
    }`}
  >
    <input
      type="radio"
      name="drawing-version"
      value={v}
      checked={selectedVersion === v}
      onChange={() => setSelectedVersion(v)}
      className="accent-blue-600"
    />
    <span className="text-xs font-medium">버전 {v}</span>
  </label>
))}
```

### 8-B. 도면 편집 버튼 — 새 탭 열림 안내 토스트

Task 3-B에서 `openEditorTab()`이 성공적으로 새 탭을 열었을 때(`opened === true`), 사용자에게 안내한다.  
Sidebar나 App에 이미 toast 시스템이 있으면 그것을 사용한다. 없으면 간단한 상태로 구현한다.

`openEditor` 함수에서 `opened === true`인 경우 처리:

```typescript
if (opened) {
  // 새 탭 열림 안내 — 기존 toast 시스템 활용
  // showToast('도면 편집기가 새 탭에서 열렸습니다.', 'info');
  // toast 시스템이 없으면 아래처럼 임시 상태 사용
  setNewTabNotice(true);
  setTimeout(() => setNewTabNotice(false), 3000);
}
```

DrawingsPanel 내부에 안내 배너 추가:

```tsx
{newTabNotice && (
  <div className="mx-3 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs2 text-blue-700 flex items-center gap-1.5 shrink-0">
    <span>↗</span>
    도면 편집기가 새 탭에서 열렸습니다. 편집 완료 후 이 탭으로 돌아오세요.
  </div>
)}
```

### 8-C. 작업 목록 타입 아이콘 시각화

`src/components/Sidebar.tsx`의 작업 목록 아이템에서 작업 타입별 아이콘 색상이 구분되는지 확인한다.  
현재 모두 동일한 파란색 아이콘이면, 타입별로 색상을 달리한다:

```tsx
// 타입별 아이콘 색상
const typeColor = {
  spec: 'text-blue-500',
  patent: 'text-green-500',
  paper: 'text-purple-500',
}[task.type] ?? 'text-gray-400';

// 아이콘에 적용
<Icon name={typeIconName} size={13} className={typeColor} />
```

---

## Task 9 — 반응형 웹 구현

### 문제
모바일(< 768px) 환경에서 다음 레이아웃 붕괴 발생:
- `SpecEditorView` 우측 AI 패널: `w-[380px]` 고정 → 화면 너비 초과
- `SpecView` GuidePanel: `width: 380px` 인라인 고정 → 동일
- `PreviewModal`: `w-[720px]` 고정 → 화면 잘림
- 반응형 Tailwind prefix(`sm:` `md:` `lg:`) 사용이 전체 5곳에 불과

### 적용 패턴: 하단 슬라이드업 시트 (Bottom Sheet)
모바일(< 768px)에서 사이드 패널은 FAB 버튼 → 탭 → 하단에서 올라오는 시트 패턴 적용.  
데스크탑(≥ 768px): 기존 우측 패널 레이아웃 유지.

---

### 9-A. `src/views/SpecEditorView.tsx` — AI 어시스턴트 패널

**9-A-1. state 추가** (컴포넌트 내부 최상단 state 선언 블록에):

```typescript
const [mobileAiOpen, setMobileAiOpen] = useState(false);
```

**9-A-2. aside 내부 전체 JSX를 인라인 렌더 함수로 추출**

현재 `<aside ...>` 태그 안의 모든 JSX를 컴포넌트 함수 내부에 선언하는 렌더 함수로 이동한다:

```typescript
const renderAiPanel = () => (
  <>
    {/* 기존 <aside> 내부 JSX 전체 — 그대로 이동 */}
  </>
);
```

**9-A-3. 기존 `<aside>` 수정** — 데스크탑 전용으로 전환:

```tsx
// 변경 전
<aside className="w-[380px] shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden">
  {/* ... */}
</aside>

// 변경 후
<aside className="hidden md:flex w-[380px] shrink-0 border-l border-zinc-200 bg-white flex-col overflow-hidden">
  {renderAiPanel()}
</aside>
```

**9-A-4. 모바일 FAB 버튼 + 하단 시트 추가**

최상위 flex 컨테이너 `<div className="flex-1 flex overflow-hidden ...">` 닫힘 태그 바로 뒤에 삽입:

```tsx
{/* 모바일: AI 어시스턴트 FAB */}
<button
  className="md:hidden fixed bottom-5 right-4 z-30 bg-blue-600 text-white rounded-full px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform"
  onClick={() => setMobileAiOpen(true)}
  aria-label="AI 어시스턴트 열기"
>
  <Icon name="ai" size={14} />
  AI 어시스턴트
</button>

{/* 모바일: 하단 시트 오버레이 */}
{mobileAiOpen && (
  <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
    {/* 배경 클릭 시 닫힘 */}
    <div
      className="absolute inset-0 bg-black/40"
      onClick={() => setMobileAiOpen(false)}
    />
    {/* 시트 본체 */}
    <div
      className="relative bg-white rounded-t-2xl flex flex-col overflow-hidden shadow-2xl"
      style={{ height: '72vh' }}
    >
      {/* 시트 핸들 + 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 shrink-0 relative">
        <div className="w-8 h-1 bg-zinc-300 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
        <span className="font-semibold text-sm">AI 어시스턴트</span>
        <button
          onClick={() => setMobileAiOpen(false)}
          className="btn-ghost p-1"
          aria-label="닫기"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      {/* 기존 패널 내용 — renderAiPanel() 호출 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderAiPanel()}
      </div>
    </div>
  </div>
)}
```

---

### 9-B. `src/views/SpecView.tsx` — GuidePanel 모바일 처리

**9-B-1. SpecView에 state 추가**:

```typescript
const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
```

**9-B-2. `GuidePanel` props 타입 선언에 추가** (GuidePanel 타입 정의 블록):

```typescript
mobileOpen?: boolean;
onMobileClose?: () => void;
```

**9-B-3. GuidePanel 컴포넌트 함수 시그니처에 추가**:

```typescript
function GuidePanel({ step, gSel, setGSel, onConfirm, confirmed, ..., mobileOpen, onMobileClose }: GuidePanelProps) {
```

**9-B-4. GuidePanel 내부의 `<aside>` 수정**

인라인 style을 제거하고 Tailwind 반응형 클래스로 교체한다.  
`clsx` import가 없으면 추가: `import clsx from 'clsx';`

```tsx
// 변경 전
<aside
  ref={panelRef}
  className="border-l border-ck-border bg-white flex flex-col overflow-hidden shrink-0"
  style={{ width: '380px', minWidth: '320px', maxWidth: '700px', position: 'relative' }}
>

// 변경 후
<aside
  ref={panelRef}
  className={clsx(
    'bg-white flex-col overflow-hidden',
    // 데스크탑: 인라인 우측 사이드 패널
    'md:flex md:relative md:shrink-0 md:border-l md:border-ck-border',
    'md:w-[380px] md:min-w-[320px] md:max-w-[700px]',
    // 모바일: 하단 고정 시트
    'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50',
    'max-md:h-[72vh] max-md:rounded-t-2xl max-md:shadow-2xl',
    'max-md:border-t max-md:border-ck-border',
    'max-md:transition-transform max-md:duration-300 max-md:ease-out',
    mobileOpen
      ? 'flex max-md:translate-y-0'
      : 'max-md:hidden md:flex',
  )}
>
```

**9-B-5. GuidePanel aside 내부 첫 번째 자식으로 모바일 헤더 추가**

(기존 aside 콘텐츠 앞에 삽입):

```tsx
{/* 모바일 전용: 시트 핸들 + 닫기 버튼 — 데스크탑에서 숨김 */}
<div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-ck-border shrink-0 relative">
  <div className="w-8 h-1 bg-zinc-300 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
  <span className="font-semibold text-sm">AI 가이드</span>
  <button
    onClick={onMobileClose}
    className="btn-ghost p-1"
    aria-label="가이드 닫기"
  >
    <Icon name="close" size={16} />
  </button>
</div>
```

**9-B-6. SpecView에서 GuidePanel 렌더링 수정**

현재 `{guideOpen && (phase === 'flow' || phase === 'done') && (<GuidePanel .../>)}` 블록을 교체:

```tsx
{/* 모바일 배경 오버레이 — 시트 열림 시에만 표시 */}
{mobileGuideOpen && (
  <div
    className="md:hidden fixed inset-0 bg-black/40 z-40"
    onClick={() => setMobileGuideOpen(false)}
  />
)}

{/* GuidePanel: 데스크탑에서는 guideOpen 상태, 모바일에서는 mobileGuideOpen 상태로 제어 */}
{(guideOpen || mobileGuideOpen) && (phase === 'flow' || phase === 'done') && (
  <GuidePanel
    key={`guide-panel-${guideStep}`}
    step={guideStep}
    gSel={gSel}
    {/* 기존 props 전체 유지 */}
    mobileOpen={mobileGuideOpen}
    onMobileClose={() => setMobileGuideOpen(false)}
  />
)}

{/* 모바일 전용: AI 가이드 FAB */}
{(phase === 'flow' || phase === 'done') && (
  <button
    className="md:hidden fixed bottom-5 right-4 z-30 bg-blue-600 text-white rounded-full px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform"
    onClick={() => setMobileGuideOpen(true)}
    aria-label="AI 가이드 열기"
  >
    <Icon name="ai" size={14} />
    AI 가이드
  </button>
)}
```

---

### 9-C. `src/components/PreviewModal.tsx` — 모달 반응형

모달 컨테이너의 고정 너비/높이를 반응형으로 교체한다.

```tsx
// 변경 전 (고정 너비 예시)
<div className="bg-white rounded-xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col overflow-hidden">

// 변경 후
<div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
```

하단 버튼 영역 — 모바일에서 버튼이 세로 배치되도록:

```tsx
// 변경 전 (예시)
<div className="flex items-center gap-2">

// 변경 후
<div className="flex flex-wrap items-center gap-2">
```

---

### 9-D. `src/components/TopBar.tsx` — 모바일 간소화

도움말, 언어 버튼을 모바일에서 숨겨 TopBar 좌측 작업명 영역 공간을 확보한다.  
알림 버튼은 모바일에서도 유지한다.

```tsx
// 도움말 링크
<a ... className="btn-ghost hidden md:inline-flex" ...>

// KR 버튼
<button ... className="btn-ghost text-sm2 px-2 hidden md:inline-flex" ...>
```

---

### 9-E. `src/views/SpecView.tsx` — 직접 입력 폼 필드 너비

직접 입력(direct) 단계의 입력 폼에서 고정 너비 클래스(`w-60`, `w-52`, `w-80` 등)를 찾아 반응형으로 교체한다:

```tsx
// 단일 행 input 예시
// 변경 전: className="... w-60 ..."
// 변경 후: className="... w-full md:w-60 ..."

// 전체 폼 래퍼가 있다면
// 변경 전: className="... max-w-lg ..."
// 변경 후: className="... w-full max-w-lg px-4 md:px-0 ..."
```

---

### 9-F. 모바일 스크롤 및 터치 최적화

모바일 스크롤 영역에 터치 친화적 최솟값을 적용한다.

**탭/버튼 최소 터치 영역** — 작은 버튼(`btn-ghost`, `text-xs2`)의 탭 영역이 44×44px 미만인 경우:
```tsx
// 예: 단계 확정/재선택 버튼
className="... min-h-[44px] min-w-[44px] ..."
// 또는 패딩 확대
className="... p-3 md:p-1 ..."
```

**스크롤 관성** — iOS Safari에서 스크롤 영역에 `overflow-y-auto` 사용 시 `-webkit-overflow-scrolling: touch`가 필요한 경우 `src/index.css`에 추가:
```css
.scroll-thin {
  -webkit-overflow-scrolling: touch;
}
```

---

## 최종 빌드 검증

```bash
cd c:\project\06_AXP\react-app
npm run build
```

빌드 성공 후 `npm run dev`로 개발 서버를 실행하고 다음 3가지 시나리오를 직접 브라우저에서 확인한다.

**시나리오 A — 상태 복원 (Task 1)**
1. 새 작업 생성 → 직접 입력 → AI 분석 시작
2. 사이드바에 발명의 명칭으로 작업명 변경 확인
3. Step 3까지 진행 후 다른 작업 클릭
4. 원래 작업 재클릭 → Step 3 상태로 복원됨 확인
5. "↺ 다시 시작" 클릭 → Step 1로 복귀 확인

**시나리오 B — AI 수정안 격리 (Task 2)**
1. Step 2에서 텍스트 클릭 → "편집 중: 발명의 명칭" 표시
2. AI 수정안 카드 생성
3. Step 3으로 이동 → 수정안 카드 사라짐, "편집 중:" 초기화 확인

**시나리오 C — 해결수단 + 출력 (Task 4, 6)**
1. Step 3에서 "과제의 해결 수단" 탭 표시 확인
2. 분석 완료 → 미리보기 → "과제의 해결 수단" 섹션 표시 확인
3. DOCX 다운로드 → 파일 저장 확인
4. PDF 내보내기 → 인쇄 대화상자 열림 확인

**시나리오 D — 반응형 웹 (Task 9)**

브라우저 개발자 도구 → Device Toolbar (iPhone SE, 375px 기준) 에서 검증.

1. **SpecEditorView 모바일**
   - 우측 AI 패널이 화면에 보이지 않음 (숨김) 확인
   - 우측 하단 FAB 버튼 "AI 어시스턴트" 표시 확인
   - FAB 클릭 → 하단 시트 슬라이드업 확인
   - 시트 내에서 채팅 입력 및 [✓ 적용] 동작 확인
   - 배경(반투명) 클릭 → 시트 닫힘 확인

2. **SpecView 분석 진행 중 모바일**
   - GuidePanel이 사이드에 표시되지 않음 확인
   - 우측 하단 FAB "AI 가이드" 표시 확인
   - FAB 클릭 → 가이드 시트 슬라이드업 확인
   - 시트 내에서 확정/재선택 동작 확인
   - 시트 닫기 버튼 동작 확인

3. **PreviewModal 모바일**
   - 미리보기 모달이 화면 너비에 맞게 표시됨 (잘리지 않음) 확인
   - DOCX/PDF 버튼이 모두 접근 가능함 확인

4. **TopBar 모바일**
   - 도움말/KR 버튼 숨김 확인
   - 알림 버튼 표시 유지 확인
   - 작업명이 TopBar에 충분히 표시됨 확인

5. **데스크탑 회귀 테스트**
   - 768px 이상에서 기존 레이아웃(우측 패널 인라인) 유지됨 확인
   - FAB 버튼이 데스크탑에서 보이지 않음 확인

---

## Task 9 — 반응형 웹 (Responsive)

Task 1~8 완료 후 반응형 구현을 실행한다.  
상세 지시서: `docs/superpowers/plans/2026-06-05-responsive-prompt.md`

이 파일을 읽고 **R1 → R9 순서대로** 실행한다. 각 Task 완료 시 `npm run build` 확인 후 다음으로 진행한다.

**핵심 브레이크포인트**:
- 모바일 기본(`<768px`): 사이드바 오버레이, GuidePanel 하단 드로어, input 16px+
- 태블릿 `md:` (`768–1023px`): 사이드바 icon-only 자동 접힘, 패널 토글 버튼, 300px 축소 패널
- PC `lg:` (`≥1024px`): 기존 레이아웃 그대로 (260px 사이드바, 380px GuidePanel)
