# AXPlain.ai UX 수정 구현 계획서
**작성일**: 2026-06-05  
**기준**: UX 평가 보고서 (2026-06-05 브라우저 전수 검증)  
**원칙**: 현재 UI 스타일 준수 / 각 단위 기능의 양방향 완성도(순방향 + 역방향 + 재실행) 보장

---

## 전제 조건 — 완성도 기준 정의

각 수정 항목은 다음 3가지 흐름을 모두 통과해야 완성으로 간주한다:

| 흐름 | 의미 |
|------|------|
| **순방향** | 정상 흐름으로 기능 완수 |
| **역방향** | 뒤로가기, 취소, 실행취소(Ctrl+Z), 단계 되돌리기 후 상태 무결성 유지 |
| **재실행** | 역방향 후 다시 순방향 진행 시 데이터·UI 정합성 유지 |

---

## P0 — 서비스 완수 차단 (즉시 수정)

---

### P0-1. SpecView 7단계 분석 상태 localStorage 영속화 (B1)

**파일**: `src/views/SpecView.tsx`, `src/features/spec/specStore.ts`

#### 문제
- `phase`, `curStep`, `confirmed`, `gSel`, 입력폼 값, AI 후보 목록이 컴포넌트 state에만 존재
- 사이드바에서 다른 작업 선택 후 재진입 시 Step 1(upload)부터 초기화
- `axp_tasks_v1`의 작업 객체에 `step`, `analysisState` 필드 없음

#### specStore.ts 수정

`axp_spec_v2_{taskId}` 키에 분석 흐름 상태를 추가 저장한다:

```typescript
// src/features/spec/specStore.ts
// 기존 SpecStoredState에 analysisFlow 필드 추가

export interface AnalysisFlowState {
  phase: 'upload' | 'direct' | 'flow' | 'done';
  curStep: string;
  confirmed: Record<string, string>;
  gSel: Record<string, string>;
  // 직접입력 폼 값
  diTitle: string;
  diField: string;
  diContent: string;
  diProblem: string;
  diKeywords: string;
  // AI 후보 (재생성 방지)
  titleCandidates: string[];
  abstractCandidates: string[];
  aiComponents: unknown[];
}

export interface SpecStoredState {
  editorBlocks?: Record<string, string[]>;
  analysisFlow?: AnalysisFlowState;  // ← 추가
}

// saveAnalysisFlow / loadAnalysisFlow 함수 추가
export function saveAnalysisFlow(taskId: string, flow: AnalysisFlowState): void {
  try {
    const existing = loadSpecState(taskId) ?? {};
    const next = { ...existing, analysisFlow: flow };
    localStorage.setItem(`axp_spec_v2_${taskId}`, JSON.stringify(next));
  } catch { /* storage full 등 무시 */ }
}

export function loadAnalysisFlow(taskId: string): AnalysisFlowState | null {
  try {
    const raw = localStorage.getItem(`axp_spec_v2_${taskId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SpecStoredState;
    return parsed.analysisFlow ?? null;
  } catch { return null; }
}
```

#### SpecView.tsx 수정

**1. 초기화 — 저장된 상태 복원**

```typescript
// useState 초기값을 함수형으로 변경하여 저장값 복원
const savedFlow = task?.id ? loadAnalysisFlow(task.id) : null;

const [phase, setPhase] = useState<'upload'|'direct'|'flow'|'done'>(
  savedFlow?.phase ?? 'upload'
);
const [curStep, setCurStep] = useState<StepId>(
  (savedFlow?.curStep as StepId) ?? 'upload'
);
const [confirmed, setConfirmed] = useState<Partial<Record<StepId,string>>>(
  savedFlow?.confirmed ?? {}
);
const [gSel, setGSel] = useState<Partial<Record<StepId,string>>>(
  savedFlow?.gSel ?? {}
);
const [diTitle, setDiTitle] = useState(savedFlow?.diTitle ?? '');
const [diField, setDiField] = useState(savedFlow?.diField ?? '');
const [diContent, setDiContent] = useState(savedFlow?.diContent ?? '');
const [diProblem, setDiProblem] = useState(savedFlow?.diProblem ?? '');
const [diKeywords, setDiKeywords] = useState(savedFlow?.diKeywords ?? '');
const [titleCandidates, setTitleCandidates] = useState<string[]>(
  savedFlow?.titleCandidates ?? []
);
const [abstractCandidates, setAbstractCandidates] = useState<string[]>(
  savedFlow?.abstractCandidates ?? []
);
const [aiComponents, setAiComponents] = useState<AiComponentCandidate[]>(
  (savedFlow?.aiComponents as AiComponentCandidate[]) ?? []
);
```

**2. 저장 — 상태 변경 시 debounce 저장**

```typescript
// useEffect로 핵심 상태 변경 감지 → debounce 저장
const flowSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (!task?.id || phase === 'upload') return; // upload 단계는 저장 불필요
  if (flowSaveTimer.current) clearTimeout(flowSaveTimer.current);
  flowSaveTimer.current = setTimeout(() => {
    saveAnalysisFlow(task.id, {
      phase, curStep, confirmed, gSel,
      diTitle, diField, diContent, diProblem, diKeywords,
      titleCandidates, abstractCandidates, aiComponents,
    });
  }, 300);
  return () => {
    if (flowSaveTimer.current) clearTimeout(flowSaveTimer.current);
  };
}, [phase, curStep, confirmed, gSel, diTitle, diField, diContent,
    diProblem, diKeywords, titleCandidates, abstractCandidates, aiComponents]);
```

**3. 역방향 — 분석 다시 시작 버튼**

`phase === 'flow'` 상태에서 Step 1(upload)로 돌아가는 경우:

```typescript
// "처음부터 다시 시작" 핸들러 추가
const resetAnalysis = () => {
  setPhase('upload');
  setCurStep('upload');
  setConfirmed({});
  setGSel({});
  setTitleCandidates([]);
  setAbstractCandidates([]);
  setAiComponents([]);
  if (task?.id) {
    // 저장된 분석 상태 초기화
    const existing = loadSpecState(task.id) ?? {};
    delete existing.analysisFlow;
    localStorage.setItem(`axp_spec_v2_${task.id}`, JSON.stringify(existing));
  }
};
```

`phase === 'flow'` 화면 상단에 "처음부터 다시 시작" 텍스트 버튼 추가 (현재 progress bar 좌측):

```tsx
{phase === 'flow' && (
  <button
    onClick={resetAnalysis}
    className="text-xs text-ck-muted hover:text-red-500 transition-colors"
  >
    ↺ 처음부터 다시 시작
  </button>
)}
```

**4. 완성도 체크리스트**
- [ ] 순방향: Step 3 완료 후 이탈 → 재진입 시 Step 3 상태로 복원
- [ ] 역방향: `reselect()` 호출 시 이전 단계로 돌아감 + 저장 상태도 업데이트
- [ ] 재실행: 역방향 후 confirm() 재실행 시 정상 진행
- [ ] 역방향 전체: "처음부터 다시 시작" 후 새 PDF 업로드 또는 직접 입력 정상 작동
- [ ] task 전환: 작업 A → 작업 B → 작업 A 복귀 시 각 작업의 독립적 상태 유지

---

### P0-2. "도면 편집 →" 버튼 → DrawingEditorModal 트리거 복구 (NEW-1)

**파일**: `src/views/SpecView.tsx`

#### 문제
SpecView Step 5(도면)에서 "도면 편집 →" 버튼 클릭 시 DrawingEditorModal이 열리지 않는다.

#### 원인 파악 우선
SpecView.tsx에서 DrawingEditorModal 관련 state와 handler를 찾아 확인:

```typescript
// 확인할 패턴
const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);
// 또는
const [drawingModalOpen, setDrawingModalOpen] = useState(false);
```

"도면 편집 →" 버튼의 onClick 핸들러가 실제로 state를 변경하는지, 그리고 DrawingEditorModal이 조건부 렌더링되는지 확인.

#### 수정 방향

**케이스 A — state가 있지만 Modal 렌더링 조건 오류인 경우**:

```tsx
// DrawingEditorModal을 phase === 'flow' && curStep === 'drawings' 조건 외에서도 렌더링
{editingDrawingId !== null && (
  <DrawingEditorModal
    open={editingDrawingId !== null}
    drawingId={editingDrawingId}
    drawings={drawings}
    components={aiComponents}
    onSave={(id, update) => {
      setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...update } : d));
      setEditingDrawingId(null);
    }}
    onClose={() => setEditingDrawingId(null)}
  />
)}
```

**케이스 B — "도면 편집 →" 버튼에 onClick 핸들러가 없는 경우**:

Step 5 도면 카드에서 버튼을 찾아 onClick 추가:

```tsx
<button
  onClick={() => setEditingDrawingId(drawing.id)}  // ← 이 핸들러가 없을 가능성
  className="text-xs text-blue-600 hover:text-blue-700"
>
  도면 편집 →
</button>
```

#### 역방향 처리 (모달 닫기 완성도)

DrawingEditorModal 닫기 시나리오별 처리:

```typescript
// 1. 저장 후 닫기 (onSave)
const handleDrawingSave = (id: string, update: DrawingUpdate) => {
  setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...update } : d));
  saveAnalysisFlow(task.id, { ...currentFlow, drawings: updatedDrawings });
  setEditingDrawingId(null);
  // 완료 토스트
  showToast('도면이 저장되었습니다.');
};

// 2. 저장 없이 닫기 (onClose) — 변경사항 경고
const handleDrawingClose = () => {
  // DrawingEditorModal 내부에서 "저장하지 않고 닫으시겠습니까?" 확인
  // (모달 내부 구현 필요)
  setEditingDrawingId(null);
};
```

DrawingEditorModal 내부에 "닫기" 버튼 클릭 시 미저장 변경 경고 추가:

```tsx
// DrawingEditorModal.tsx
const handleCloseAttempt = () => {
  if (hasUnsavedChanges) {
    if (window.confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) {
      onClose();
    }
  } else {
    onClose();
  }
};
```

Stage 1 취소 버튼 추가 (UX-3 동시 수정):

```tsx
// Stage 1 (crop) 좌측 하단에 취소 버튼 추가
<div className="flex items-center justify-between p-3 border-t border-ck-border bg-ck-surface">
  <button
    onClick={handleCloseAttempt}
    className="text-sm text-ck-muted hover:text-red-500 transition-colors"
  >
    ✕ 취소
  </button>
  <button onClick={startConvert} className="btn-primary btn-sm">
    영역 확인 완료 — 변환 시작
  </button>
</div>
```

**완성도 체크리스트**
- [ ] 순방향: Step 5 → "도면 편집 →" 클릭 → 모달 열림 → Stage 1/2/3 완료 → 도면 저장
- [ ] 역방향: 모달 열고 Stage 1에서 취소 → 도면 변경 없이 Step 5로 복귀
- [ ] 역방향: Stage 3 편집 중 닫기 → 미저장 경고 → "계속" 선택 시 모달 유지
- [ ] 재실행: 닫기 후 동일 도면 "도면 편집 →" 재클릭 → 직전 저장 상태로 편집 재개

---

### P0-3. AI 수정안 카드 Step 범위 격리 (NEW-2)

**파일**: `src/views/SpecView.tsx` 또는 GuidePanel 관련 컴포넌트

#### 문제
Step 3에서 발생한 AI 수정안 카드가 Step 4→7→완료 화면에 계속 잔류

#### 원인
GuidePanel 내부의 chatHistory 또는 suggestion 상태가 step 변경 시 초기화되지 않음

#### 수정

GuidePanel에 `step` prop이 변경될 때 AI 수정안 상태 초기화:

```typescript
// GuidePanel 내부 또는 SpecView에서 GuidePanel key prop 활용
// step 변경 시 GuidePanel을 완전히 리마운트하여 내부 state 초기화
<GuidePanel
  key={`guide-${guideStep}`}  // ← step이 바뀌면 컴포넌트 재마운트
  step={guideStep}
  // ... 기타 props
/>
```

또는 GuidePanel 내부에서 useEffect로 step 변경 감지:

```typescript
// GuidePanel.tsx 내부
useEffect(() => {
  // step 변경 시 AI 수정안 관련 상태 초기화
  setChatHistory([]);
  setSuggestion(null);
  setEditingDirection(null);
}, [step]);
```

우측 패널의 "편집 중:" 라벨도 같은 맥락에서 수정 (NEW-3 동시 해결):

```typescript
// GuidePanel에서 현재 편집 중인 필드명을 step으로 동적 매핑
const STEP_LABEL_MAP: Record<StepId, string> = {
  title: '발명의 명칭',
  description: '발명의 설명',
  components: '구성요소',
  drawings: '도면',
  claims: '청구항',
  abstract: '요약서',
};

// 우측 패널 하단
<span className="text-xs text-ck-muted">
  편집 중: {STEP_LABEL_MAP[step] ?? step}
</span>
```

**완성도 체크리스트**
- [ ] 순방향: Step 3 AI 수정안 수락 → Step 4 이동 시 Step 3 수정안 카드 사라짐
- [ ] 역방향: Step 4 → reselect로 Step 3 복귀 → Step 3 수정안 상태 초기화됨 (재생성 필요)
- [ ] 재실행: Step 3 재진입 후 AI 수정안 다시 요청 → 정상 생성

---

## P1 — 핵심 기능 저해 (단기 수정)

---

### P1-1. 분석 완료 시 발명의 명칭 → 작업 이름 자동 저장 (UX-1)

**파일**: `src/views/SpecView.tsx`, `src/store.tsx`

#### 문제
46개 작업 중 44개가 "새 명세서" — 작업 목록에서 구별 불가

#### store.tsx 수정

작업 이름 업데이트 액션 확인/추가:

```typescript
// store.tsx — updateTaskName 함수 확인 또는 추가
export function updateTaskName(taskId: string, name: string): void {
  const tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  tasks[idx] = { ...tasks[idx], name, updatedAt: Date.now() };
  saveTasks(tasks);
}
```

#### SpecView.tsx 수정

Phase가 'flow'로 전환되는 시점(startFlow)에서 발명의 명칭으로 작업명 업데이트:

```typescript
const startFlow = (override?: ...) => {
  const title = override?.title ?? diTitle.trim();
  // ...
  setTimeout(() => {
    // ... 기존 후보 생성 로직 ...

    // 작업 이름 자동 설정 (최대 30자)
    if (task?.id && title) {
      const taskName = title.length > 30 ? title.slice(0, 30) + '…' : title;
      updateTaskName(task.id, taskName);
    }

    setPhase('flow');
    // ...
  }, 1500);
};
```

#### 역방향 처리 — 이름 변경 후 분석 초기화 시

"처음부터 다시 시작" 실행 시 작업 이름을 이전 이름으로 되돌리지 않음 (사용자가 직접 ⋯ 메뉴에서 이름 변경 가능). 단, 분석 재시작 후 새 발명 명칭으로 다시 AI 분석 시작하면 이름 덮어쓰기.

**완성도 체크리스트**
- [ ] 순방향: PDF 업로드 → AI 분석 시작 시 사이드바 작업 이름이 발명의 명칭으로 변경
- [ ] 순방향: 직접 입력 후 AI 분석 시작 시 이름 변경
- [ ] 역방향: ⋯ 메뉴 → 이름 변경으로 수동 수정 가능 (기존 기능 유지)
- [ ] 재실행: "처음부터 다시 시작" → 새 발명 명칭으로 재분석 → 새 이름으로 업데이트

---

### P1-2. 해결수단(과제의 해결 수단) Step 3 연결 (NEW-4)

**파일**: `src/views/SpecView.tsx`, `src/features/spec/mockAiService.ts`

#### 문제
Step 3(설명) 서브탭: 기술분야/배경기술/해결하려는 과제/발명의 효과 — 해결수단 없음  
미리보기 모달에서 "과제의 해결 수단" 항목이 플레이스홀더로 표시됨

#### 분석
SpecEditorView의 `solution` 섹션(과제의 해결 수단)에 데이터가 전달되지 않음.
`makeAnalysisResult()`에서 `solution` 필드 생성 필요.

#### mockAiService.ts 수정

`generateSolutionContent()` 함수 추가:

```typescript
// src/features/spec/mockAiService.ts
export function generateSolutionContent(input: {
  title: string;
  field: string;
  content: string;
  components: AiComponentCandidate[];
}): string {
  const compList = input.components
    .slice(0, 4)
    .map((c, i) => `상기 ${c.name}(${(i+1)*100})은 ${c.description ?? c.name + ' 기능을 수행'}한다.`)
    .join(' ');
  return `본 발명의 과제를 해결하기 위한 ${input.title}은 ${input.field} 분야에 적용되며, ${compList} 이와 같은 구성에 의해 상기 과제가 해결된다.`;
}
```

#### SpecView.tsx 수정

Step 3 서브탭에 "해결수단" 탭 추가:

```typescript
// 기존 서브탭 배열에 solution 추가
const DESCRIPTION_SUBTABS = [
  { id: 'tech',     label: '기술분야' },
  { id: 'bg',       label: '배경기술' },
  { id: 'problem',  label: '해결하려는 과제' },
  { id: 'solution', label: '과제의 해결 수단' },  // ← 추가
  { id: 'effect',   label: '발명의 효과' },
];
```

`makeAnalysisResult()`에 solution 필드 추가:

```typescript
const makeAnalysisResult = (): SpecAnalysisResult => ({
  title: gSel['title'] || confirmed['title'] || diTitle,
  tech:     confirmed['description_tech']     || '',
  bg:       confirmed['description_bg']       || '',
  problem:  confirmed['description_problem']  || '',
  solution: confirmed['description_solution'] || // ← 추가
            generateSolutionContent({
              title: diTitle, field: diField, content: diContent,
              components: aiComponents
            }),
  effect:   confirmed['description_effect']   || '',
  // ...나머지 필드
});
```

**완성도 체크리스트**
- [ ] 순방향: Step 3 > 해결수단 탭에서 내용 확정 → 미리보기 모달에 반영
- [ ] 순방향: 해결수단 탭 미확정 시 AI 자동 생성값으로 폴백
- [ ] 역방향: 해결수단 내용 재선택 (reselect) 후 재확정 가능
- [ ] 재실행: SpecEditorView solution 섹션에 내용 표시 및 편집 가능

---

## P2 — 기능 완성 (중기)

---

### P2-1. DOCX/PDF 클라이언트 사이드 생성 (B17)

**파일**: `src/components/PreviewModal.tsx`, `package.json`

#### 의존성 추가
```bash
npm install docx file-saver
npm install @types/file-saver --save-dev
```

#### DOCX 생성 구현

```typescript
// src/utils/exportDocx.ts (신규 파일)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import type { PreviewSection } from '../types';

export async function exportDocx(
  title: string,
  sections: PreviewSection[]
): Promise<void> {
  const children = sections.flatMap(section => [
    new Paragraph({
      text: section.label,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    }),
    ...section.content.split('\n\n').map(para =>
      new Paragraph({
        children: [new TextRun({ text: para, size: 24 })],
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED,
      })
    ),
  ]);

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
        }),
        ...children,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${title.replace(/[^\w가-힣]/g, '_')}_명세서.docx`;
  saveAs(blob, fileName);
}
```

#### PDF 생성 구현

```typescript
// src/utils/exportPdf.ts (신규 파일)
import type { PreviewSection } from '../types';

export async function exportPdf(
  title: string,
  sections: PreviewSection[]
): Promise<void> {
  // window.print() 활용 — 인쇄 스타일 CSS로 PDF 변환
  const printContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title} 특허명세서</title>
        <style>
          body { font-family: 'Malgun Gothic', sans-serif; font-size: 12pt; line-height: 1.8; margin: 2cm; }
          h1 { font-size: 16pt; margin-bottom: 1em; }
          h2 { font-size: 13pt; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          p { text-align: justify; margin: 0.5em 0; }
          @page { margin: 2cm; size: A4; }
        </style>
      </head>
      <body>
        <h1>${title} 특허명세서</h1>
        ${sections.map(s => `
          <h2>${s.label}</h2>
          ${s.content.split('\n\n').map(p => `<p>${p}</p>`).join('')}
        `).join('')}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('팝업 차단을 해제한 후 다시 시도하세요.');
    return;
  }
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}
```

#### PreviewModal.tsx 수정

```typescript
// 기존 alert() 핸들러 교체
import { exportDocx } from '../utils/exportDocx';
import { exportPdf } from '../utils/exportPdf';

// DOCX 다운로드 버튼
<button
  onClick={async () => {
    setExporting('docx');
    try {
      await exportDocx(title, sections);
    } catch (e) {
      showToast('DOCX 생성 중 오류가 발생했습니다.');
    } finally {
      setExporting(null);
    }
  }}
  disabled={exporting !== null}
  className="btn-secondary btn-sm flex items-center gap-1.5"
>
  {exporting === 'docx' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
  DOCX 다운로드
</button>

// PDF 내보내기 버튼
<button
  onClick={async () => {
    setExporting('pdf');
    try {
      await exportPdf(title, sections);
    } catch (e) {
      showToast('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setExporting(null);
    }
  }}
  disabled={exporting !== null}
  className="btn-secondary btn-sm flex items-center gap-1.5"
>
  {exporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
  PDF 내보내기
</button>
```

**완성도 체크리스트**
- [ ] 순방향: 미리보기 → DOCX 다운로드 → 파일 저장 → 내용 정합성 확인
- [ ] 순방향: 미리보기 → PDF 내보내기 → 인쇄 대화상자 → PDF 저장
- [ ] 역방향: 다운로드 중 취소(disabled 상태) → 버튼 재활성화
- [ ] 역방향: 팝업 차단 시 → 안내 메시지 표시
- [ ] 재실행: 내용 수정 후 미리보기 재열기 → 수정된 내용으로 재다운로드

---

### P2-2. 작업 검색 전용 화면 구현 (B19)

**파일**: `src/views/SearchView.tsx` (신규 또는 기존 파일), `src/components/Sidebar.tsx`

#### SearchView.tsx 구현

```typescript
// src/views/SearchTaskView.tsx (신규)
import { useState, useMemo } from 'react';
import { Search, FileText, Globe, BookOpen, Filter, Star } from 'lucide-react';
import { useTasks } from '../store';

const TYPE_LABELS = {
  spec: { label: '명세서', icon: FileText, color: 'text-blue-600' },
  patent: { label: '특허 검색', icon: Globe, color: 'text-green-600' },
  paper: { label: '논문 검색', icon: BookOpen, color: 'text-purple-600' },
};

const DATE_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'today', label: '오늘' },
  { id: 'week', label: '이번 주' },
  { id: 'month', label: '이번 달' },
];

export function SearchTaskView({ onSelectTask }: { onSelectTask: (taskId: string) => void }) {
  const tasks = useTasks();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [starOnly, setStarOnly] = useState(false);

  const filtered = useMemo(() => {
    const now = Date.now();
    return tasks.filter(t => {
      // 이름 검색
      if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
      // 타입 필터
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      // 날짜 필터
      if (dateFilter === 'today' && now - t.updatedAt > 86400000) return false;
      if (dateFilter === 'week' && now - t.updatedAt > 7 * 86400000) return false;
      if (dateFilter === 'month' && now - t.updatedAt > 30 * 86400000) return false;
      // 즐겨찾기
      if (starOnly && !t.favorite) return false;
      return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [tasks, query, typeFilter, dateFilter, starOnly]);

  return (
    <div className="flex flex-col h-full">
      {/* 검색 헤더 */}
      <div className="p-4 border-b border-ck-border space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ck-muted" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="작업 이름 검색..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ck-border rounded-lg bg-ck-surface focus:outline-none focus:border-blue-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ck-muted hover:text-ck-text"
            >
              ✕
            </button>
          )}
        </div>

        {/* 필터 행 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 타입 필터 */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs border border-ck-border rounded px-2 py-1 bg-ck-surface"
          >
            <option value="all">모든 유형</option>
            <option value="spec">명세서</option>
            <option value="patent">특허 검색</option>
            <option value="paper">논문 검색</option>
          </select>

          {/* 날짜 필터 */}
          {DATE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                dateFilter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-ck-border text-ck-muted hover:border-blue-400'
              }`}
            >
              {f.label}
            </button>
          ))}

          {/* 즐겨찾기 토글 */}
          <button
            onClick={() => setStarOnly(p => !p)}
            className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors ${
              starOnly
                ? 'bg-amber-500 text-white border-amber-500'
                : 'border-ck-border text-ck-muted hover:border-amber-400'
            }`}
          >
            <Star size={11} /> 즐겨찾기만
          </button>
        </div>
      </div>

      {/* 결과 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center text-ck-muted py-16">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">검색 결과가 없습니다.</p>
            {query && (
              <button
                onClick={() => { setQuery(''); setTypeFilter('all'); setDateFilter('all'); setStarOnly(false); }}
                className="text-xs text-blue-500 mt-2 hover:underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-ck-muted mb-2">{filtered.length}개 작업</p>
            {filtered.map(task => {
              const meta = TYPE_LABELS[task.type as keyof typeof TYPE_LABELS];
              return (
                <button
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-ck-hover transition-colors group"
                >
                  {meta && <meta.icon size={16} className={meta.color} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {task.favorite && <Star size={11} className="text-amber-400 fill-amber-400" />}
                      <span className="text-sm font-medium truncate">{task.name}</span>
                    </div>
                    <span className="text-xs text-ck-muted">
                      {meta?.label} · {formatRelativeTime(task.updatedAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '방금';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${Math.floor(diff / 86400000)}일 전`;
}
```

#### Sidebar.tsx 수정

"작업 검색" 버튼 클릭 시 검색 패널 토글:

```typescript
// Sidebar.tsx
const [searchOpen, setSearchOpen] = useState(false);

// "작업 검색" 버튼 onClick
onClick={() => setSearchOpen(p => !p)}

// 검색 패널 (사이드바 내부 또는 오버레이)
{searchOpen && (
  <div className="absolute inset-0 z-20 bg-ck-bg flex flex-col">
    <div className="flex items-center justify-between p-3 border-b border-ck-border">
      <span className="text-sm font-semibold">작업 검색</span>
      <button onClick={() => setSearchOpen(false)} className="text-ck-muted hover:text-ck-text">✕</button>
    </div>
    <SearchTaskView
      onSelectTask={(id) => {
        onSelectTask(id);    // 기존 작업 선택 핸들러
        setSearchOpen(false);
      }}
    />
  </div>
)}
```

**완성도 체크리스트**
- [ ] 순방향: 사이드바 "작업 검색" → 검색 패널 열림 → 검색어 입력 → 결과 클릭 → 해당 작업 진입
- [ ] 역방향: ✕ 버튼 또는 Escape → 검색 패널 닫힘 → 이전 화면 유지
- [ ] 역방향: 필터 적용 → "필터 초기화" → 전체 목록 복원
- [ ] 재실행: 검색 패널 재열기 → 이전 검색어 초기화(빈 상태로 시작)

---

## P3 — 개선 (장기)

---

### P3-1. 알림 패널 구현 (UX-2)

**파일**: `src/components/TopBar.tsx`, `src/store.tsx`

#### 알림 데이터 구조

```typescript
// src/types.ts 추가
export interface Notification {
  id: string;
  type: 'spec_complete' | 'drawing_done' | 'info';
  title: string;
  message: string;
  taskId?: string;
  read: boolean;
  createdAt: number;
}
```

#### 알림 생성 시점
- SpecView: `phase === 'done'` 진입 시 "분석 완료" 알림 생성
- DrawingEditorModal: 도면 저장 완료 시 "도면 저장 완료" 알림 생성

#### TopBar 알림 패널

```tsx
// 알림 버튼 클릭 시 드롭다운 패널
{notifOpen && (
  <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-ck-border rounded-xl shadow-lg z-50">
    <div className="flex items-center justify-between p-3 border-b border-ck-border">
      <span className="text-sm font-semibold">알림</span>
      {unreadCount > 0 && (
        <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
          모두 읽음 처리
        </button>
      )}
    </div>
    <div className="max-h-80 overflow-y-auto">
      {notifications.length === 0 ? (
        <p className="text-xs text-ck-muted p-4 text-center">알림이 없습니다.</p>
      ) : notifications.map(n => (
        <div key={n.id} className={`p-3 border-b border-ck-border last:border-0 ${!n.read ? 'bg-blue-50' : ''}`}>
          <p className="text-sm font-medium">{n.title}</p>
          <p className="text-xs text-ck-muted mt-0.5">{n.message}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

**완성도 체크리스트**
- [ ] 순방향: 분석 완료 → 알림 생성 → 알림 아이콘 배지 표시 → 패널 열기 → 알림 확인
- [ ] 역방향: 패널 외부 클릭 또는 Escape → 패널 닫힘
- [ ] 재실행: 읽음 처리 후 패널 재열기 → 읽음 상태 유지

---

### P3-2. Stage 2 버전 C 버튼 시각 수정 (UX-4)

**파일**: `src/features/drawing-workflow/DrawingEditorModal.tsx`

버전 C 라디오 버튼이 비활성화처럼 보이는 원인 파악:

```typescript
// 원인 1: disabled prop이 남아있는 경우
// 원인 2: 스타일 클래스 조건식 오류

// 수정: 버전 선택 라디오 버튼 스타일 통일
const versionOptions = ['A', 'B', 'C'];
{versionOptions.map(v => (
  <label
    key={v}
    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
      selectedVersion === v
        ? 'border-blue-500 bg-blue-50'
        : 'border-ck-border hover:border-blue-300'
    }`}
  >
    <input
      type="radio"
      name="version"
      value={v}
      checked={selectedVersion === v}
      onChange={() => setSelectedVersion(v)}
      className="text-blue-600"
    />
    <span className="text-sm">버전 {v}</span>
  </label>
))}
```

---

## 수정 실행 순서

```
1단계 (P0, 동시 진행 가능)
  ├── specStore.ts — AnalysisFlowState 타입/함수 추가
  ├── SpecView.tsx — 상태 복원 + 저장 로직
  ├── SpecView.tsx — "도면 편집 →" 버튼 핸들러 수정
  └── GuidePanel — AI 수정안 step-scope 격리 + 라벨 수정

2단계 (P1, 1단계 완료 후)
  ├── store.tsx — updateTaskName 확인/추가
  ├── SpecView.tsx — startFlow에서 작업명 자동 업데이트
  └── SpecView.tsx + mockAiService — 해결수단 Step 3 연결

3단계 (P2, 독립 작업)
  ├── exportDocx.ts + exportPdf.ts 신규 파일
  ├── PreviewModal.tsx 버튼 핸들러 교체
  └── SearchTaskView.tsx 신규 + Sidebar.tsx 수정

4단계 (P3, 선택 작업)
  ├── 알림 시스템 구현
  └── Stage 2 버전 C 시각 수정
```

---

## 검증 체크리스트 (전체 워크플로우)

P0~P1 완료 후 다음 시나리오를 브라우저에서 순서대로 검증:

### 시나리오 A — 전체 순방향 흐름
1. 새 작업 → PDF 업로드 (또는 직접 입력) → AI 분석 시작
2. 사이드바에 발명의 명칭으로 작업 이름 표시 확인
3. Step 2~7 순서대로 진행 (각 단계 확정)
4. Step 5에서 "도면 편집 →" 클릭 → 모달 열림 확인
5. 도면 Stage 1/2/3 완료 → 도면 저장 확인
6. Step 7 완료 → "명세서 AI 생성" 버튼 클릭
7. SpecEditorView 진입 → 해결수단 섹션에 내용 있음 확인
8. 미리보기 → DOCX 다운로드 → 파일 확인
9. 미리보기 → PDF 내보내기 → 인쇄 대화상자 확인

### 시나리오 B — 상태 복원 (B1)
1. 시나리오 A의 Step 4 완료 후 다른 작업 클릭
2. 원래 작업으로 재진입 → Step 5에서 시작됨 확인
3. confirmed 상태가 Steps 2~4에 유지됨 확인

### 시나리오 C — 역방향 흐름
1. Step 6에서 reselect → Step 5로 복귀 확인
2. Step 3 복귀 → AI 수정안 카드 초기화 확인
3. "처음부터 다시 시작" → Step 1(upload)로 복귀 확인
4. 새 PDF 업로드 → 정상 분석 재시작 확인

### 시나리오 D — 도면 편집 역방향
1. "도면 편집 →" 클릭 → Stage 1 진입
2. Stage 1에서 취소 버튼 클릭 → 모달 닫힘 확인
3. 동일 도면 재편집 시작 → 정상 진입 확인
4. Stage 3 편집 중 닫기 시도 → 경고 다이얼로그 확인

### 시나리오 E — 작업 검색
1. 사이드바 "작업 검색" → 검색 패널 열림
2. 발명 명칭 검색어 입력 → 결과 필터링 확인
3. 작업 클릭 → 해당 작업 진입
4. Escape/✕ → 패널 닫힘 확인
