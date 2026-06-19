# AXPlain.ai — 개발자 핸드오프 문서

> 작성일: 2026-06-17  
> 대상: 이 프로젝트를 처음 인수받는 프론트엔드 개발자  
> 상태: React 프로토타입 → 제품 수준 완성 전환 단계

---

## 1. 프로젝트 개요

변리사가 **PDF 직무발명서**를 입력하면 AI가 **특허 명세서 초안**을 자동 생성해주는 전문 업무 도구.

### 핵심 워크플로우 (15단계)
```
1. PDF 직무발명서 업로드
2. AI 분석
3. 발명의 명칭 후보 선택/확정
4. 발명의 설명 항목 검토/확정
5. 구성요소 후보 검토/확정
6. 도면 후보 식별
7. 사람이 도면 영역 확정
8. AI CAD 스타일 변환
9. 도면 편집기 수정
10. 최종 도면 확정
11. 청구항 후보 생성
12. 독립항 검토·수정·확정
13. 종속항 생성·검토·확정
14. 명세서 본문 초안 자동 작성
15. 우측 AI 어시스턴트로 반복 수정·보완
```

---

## 2. 주요 파일 구조

```
react-app/src/
├── App.tsx                          # 라우팅 Shell (mode 기반)
├── store.tsx                        # 전역 상태 (tasks, activeTaskId, mode)
├── views/
│   ├── SpecView.tsx                 # ★ 핵심 파일 (2,400줄) — 단계별 분석 흐름
│   └── SpecEditorView.tsx           # ★ 명세서 에디터 (~1,007줄)
├── features/
│   ├── spec/
│   │   ├── types.ts                 # 전체 타입 정의
│   │   ├── specStore.ts             # localStorage 영속화
│   │   └── mockAiService.ts         # AI mock 함수 모음
│   ├── drawing-workflow/
│   │   ├── DrawingEditorModal.tsx   # 도면 3단계 편집기
│   │   ├── types.ts                 # DrawingItem, MOCK_DRAWINGS
│   │   └── editorChannel.ts        # 새 탭 도면 편집기 통신
│   ├── patent-editor/
│   │   └── PatentEditor.tsx         # 실제 캔버스 도면 편집기
│   └── ai/
│       └── clarityAnalyzer.ts       # mock 명확도 분석 / 수정안 생성
├── components/
│   ├── PreviewModal.tsx             # DOCX/PDF 내보내기 (연결 완료)
│   ├── Sidebar.tsx                  # 좌측 작업 목록
│   └── TopBar.tsx                   # 상단 바 (작업명 인라인 편집)
└── utils/
    ├── exportDocx.ts                # docx 패키지 기반 DOCX 생성
    └── exportPdf.ts                 # window.print 기반 PDF
```

---

## 3. 레이아웃 구조

### SpecView (분석 단계)
```
┌──────────────────────────────────────────────────────────┐
│  TopBar                                                    │
├──────────────────────────────────────────────────────────┤
│  Sidebar │  Stepper (7단계)                               │
│  (작업   ├────────────────────────────────────────────────┤
│   목록)  │  중앙 분석 흐름          │  우측 GuidePanel     │
│          │  (카드 + 확정 UI)        │  (AI 어시스턴트)     │
│          │                          │  [채팅 + 수정안]     │
│          ├──────────────────────────┤                     │
│          │  하단 네비게이션 바      │                     │
└──────────────────────────────────────────────────────────┘
```

### SpecEditorView (명세서 편집)
```
┌──────────────────────────────────────────────────────────┐
│  툴바 (← 뒤로 | Undo/Redo | 표 | 수식)                   │
│  섹션 탭 (명칭 | 기술분야 | 배경기술 | ... | 요약서)      │
├────────────────────────────────────────────┬─────────────┤
│  중앙 에디터                                │ AI 어시스턴트│
│  (단락 블록 편집, LaTeX 렌더링)             │ 또는 도면 패널│
│                                            ├─────────────┤
│                                            │ 40px 아이콘바│
└────────────────────────────────────────────┴─────────────┘
```

---

## 4. 상태 관리

### SpecView 핵심 상태 변수

| 변수 | 타입 | 역할 |
|------|------|------|
| `phase` | `'upload' \| 'direct' \| 'flow' \| 'done'` | 전체 분석 진행 단계 |
| `curStep` | `StepId` | 현재 진행 중인 스텝 |
| `guideStep` | `StepId` | GuidePanel이 어떤 스텝 기준으로 표시될지 |
| `confirmed` | `Partial<Record<StepId, string>>` | 각 스텝 최종 확정값 |
| `gSel` | `Partial<Record<StepId, string>>` | 각 스텝 현재 선택 중인 값 (미확정) |
| `aiComponents` | `SpecComponentItem[]` | mockAiService가 생성한 구성요소 |
| `confirmedComponents` | `InventionComponent[]` | 도면 편집기에 전달되는 확정 구성요소 |
| `titleCandidates` | `string[]` | mockAiService가 생성한 명칭 후보 |
| `abstractCandidates` | `string[]` | mockAiService가 생성한 요약서 후보 |

**주의**: `phase`, `curStep`, `guideStep` 세 값이 별도 관리되므로 동기화 주의.  
`guideStep`은 하단 "← 이전" 버튼으로 독립 탐색이 가능해 curStep과 다를 수 있음.

### localStorage 스키마

```typescript
// 키: axp_spec_v2_{taskId}
// SpecAnalysisState (src/features/spec/types.ts 참조)
{
  taskId: string;
  phase: SpecPhase;
  curStep: SpecStepId;
  confirmed: Partial<Record<SpecStepId, string>>;
  gSel: Partial<Record<SpecStepId, string>>;
  diTitle: string;   // 사용자 직접 입력 — 발명 명칭 가제
  diField: string;   // 기술 분야
  diContent: string; // 핵심 내용
  diProblem: string; // 해결 과제
  diKeywords: string;
  titleCandidates: string[];
  abstractCandidates: string[];
  componentItems: SpecComponentItem[];
  drawings: SpecDrawingItem[];       // 현재는 항상 [] (미저장)
  claimsState?: SpecClaimsState;
  mainView: 'analysis' | 'editor';
  editorBlocks?: Record<string, string[]>; // 에디터 단락 내용
}
```

---

## 5. 핵심 데이터 흐름

### 올바른 흐름 (목표)
```
사용자 입력 (diTitle, diField, diContent)
    ↓ startFlow() 호출
mockAiService.generate*()
    ├→ titleCandidates     → InlineCandidateCards
    ├→ abstractCandidates  → AbstractPanel (ABSTRACT_CANDS 대체해야 함)
    ├→ aiComponents        → ComponentsPanel (initialItems prop으로 전달됨 ✅)
    └→ mockDrawings        → DrawingsPanel (MOCK_DRAWINGS 대체해야 함 ❌)

사용자 각 단계 확정
    ↓ confirm(stepId)
confirmed 객체에 저장
    ↓ 모든 단계 완료 후 명세서 편집으로 이동
makeAnalysisResult()
    ↓ SpecEditorView의 초기 블록 내용으로 사용
```

### 현재 끊어진 경로 (수정 필요)
```
diContent/diField → DescriptionPanel      ❌ DESC_SECTIONS 하드코딩 사용
confirmed components → ClaimsPanel        ❌ INDEP_CANDS_INIT 하드코딩 사용  
abstractCandidates → AbstractPanel        ❌ ABSTRACT_CANDS 하드코딩 사용
실제 PDF 도면 → DrawingsPanel             ❌ MOCK_DRAWINGS 항상 사용
확정된 drawings → makeAnalysisResult()    ❌ MOCK_DRAWINGS 하드코딩
```

---

## 6. 하드코딩 위치 전체 목록

> **이 목록의 모든 상수가 실제 API 연동 시 교체 대상**

| 상수명 | 파일 | 교체 방법 |
|--------|------|-----------|
| `DESC_SECTIONS` | `SpecView.tsx` L2208 | `generateDescriptionSection(input)` × 5 섹션 |
| `INDEP_CANDS_INIT` | `SpecView.tsx` L1734 | `generateIndependentClaims(input, confirmedComponents)` |
| `MOCK_DEPS_BY_INDEP` | `SpecView.tsx` L1753 | `generateDependentClaims(indepId, indepText, input)` |
| `ABSTRACT_CANDS` | `SpecView.tsx` L2312 | `abstractCandidates` state (이미 생성됨) |
| `GUIDE_CANDS` | `SpecView.tsx` L52 | `titleCandidates` state (title만 연결됨, abstract/description은 미연결) |
| `MOCK_DRAWINGS` | `features/drawing-workflow/types.ts` L46 | `generateMockDrawings(input)` 또는 PDF 추출 API |
| `MOCK_SVGS` | `DrawingEditorModal.tsx` L45 | AI CAD 변환 API |
| `INIT_COMPS` | `SpecView.tsx` L1257 | `aiComponents` state의 fallback |

---

## 7. mockAiService 함수 연결 현황

| 함수 | 구현 | SpecView 호출 | 비고 |
|------|------|---------------|------|
| `generateTitleCandidates` | ✅ | ✅ startFlow() | 완료 |
| `generateAbstractCandidates` | ✅ | ✅ startFlow() | 생성은 되나 AbstractPanel에서 미사용 |
| `generateComponentCandidates` | ✅ | ✅ startFlow() | ComponentsPanel에 initialItems로 전달됨 |
| `generateDescriptionSection` | ✅ | ❌ | DescriptionPanel이 DESC_SECTIONS 사용 |
| `generateIndependentClaims` | ✅ | ❌ | ClaimsPanel이 INDEP_CANDS_INIT 사용 |
| `generateDependentClaims` | ✅ | ❌ | ClaimsPanel이 MOCK_DEPS_BY_INDEP 사용 |
| `generateMockDrawings` | ✅ | ❌ | DrawingsPanel이 MOCK_DRAWINGS 사용 |

---

## 8. 도면 워크플로우 상세

### DrawingStage 전이 순서
```
extracted → bbox-adjusted → converting → candidate-select → editing → done
    ↑              ↑              ↑               ↑             ↑        ↑
 PDF 추출       영역 확인      AI 변환 중      후보 선택      편집 중    완료
```

### 편집기 탭 통신 (editorChannel.ts)
- 데스크탑에서 `openEditorTab()` → 새 탭에서 `StandaloneEditor` 실행
- 편집 완료 시 `writeEditorResult()` → 원래 탭에서 `onEditorResult()` 수신
- 팝업 차단 시 `DrawingEditorModal` 인라인 모달로 폴백

### 확정 데이터 누락 경로 (버그)
```typescript
// SpecView.tsx 258줄 — makeAnalysisResult()
drawings: MOCK_DRAWINGS as any[],  // ← 실제 확정 도면이 아님
```
DrawingsPanel 내부의 `drawings` state (수정된 데이터)가 SpecView 상위로 올라오지 않음.  
**수정 방법**: `DrawingsPanel`에 `onDrawingsChange` prop 추가 → SpecView에서 상태 관리.

---

## 9. 청구항 패널 구조

### Phase 전환
```
Phase 'indep' (독립항 선택)
  → 체크박스로 n개 선택
  → "선택한 독립항 N개로 종속항 구성 →" 클릭
  → confirmIndep() 실행: 각 독립항에 대해 MOCK_DEPS 자동 생성
Phase 'dep' (종속항 검토)
  → 독립항별 섹션 표시
  → 종속항 체크박스 선택/해제
  → "← 독립항 재선택" 으로 Phase A 복귀 가능
```

### 연결 필요 props (현재 없음)
```typescript
// ClaimsPanel에 다음 props 추가 필요
interface ClaimsPanelProps {
  inventionInput?: InventionInput;        // 발명 기초 정보
  confirmedComponents?: InventionComponent[];  // 확정 구성요소
}
// 내부에서 generateIndependentClaims(inventionInput, confirmedComponents) 호출
```

---

## 10. 에디터 (SpecEditorView) 구조

### 섹션 목록 (EDITOR_SECTIONS)
```
title → tech → bg → problem → solution → effect → 
draw_desc → detail → claims → abstract
```
각 섹션은 복수의 단락(block) 배열로 구성됨.

### 블록 선택 vs AI 컨텍스트 다중 선택
- `sel` (단일): 현재 편집 중인 블록 (textarea 활성화)
- `selSet` (Set): AI 명령 대상 블록들 (체크박스 선택, 복수 가능)
- 우측 패널 입력창: selSet이 있으면 해당 블록들 대상, 없으면 sel 대상, 둘 다 없으면 전체 문서 Q&A

### 현재 누락된 UI 요소
- **미리보기/내보내기 버튼** — `editorPreviewOpen` 상태와 PreviewModal 렌더링은 있으나 트리거 버튼 없음
  ```typescript
  // SpecEditorView.tsx 툴바에 추가 필요
  <button onClick={() => setEditorPreviewOpen(true)}>미리보기 / 내보내기</button>
  ```

---

## 11. 알려진 버그 목록

| ID | 설명 | 파일:줄 | 우선순위 |
|----|------|---------|---------|
| B3 | 사용자 입력과 AI 후보 완전 불일치 (라이다 고정) | SpecView 1734, 2208, 2312 | Critical |
| B-DRAW | 확정 도면이 에디터에 전달되지 않음 | SpecView 258, DrawingsPanel | Critical |
| B-PDF | PDF 파일 업로드 미구현 (더미 데이터로 startFlow) | SpecView 422-435 | Critical |
| B-PREVIEW | SpecEditorView 미리보기 버튼 없음 | SpecEditorView 툴바 | High |
| B-COMP-CONFIRM | 구성요소 모달 확정 시 스텝 진행 안됨 | SpecView 777 | High |
| B-CHAT-RESET | GuidePanel key prop으로 단계 전환 시 채팅 이력 초기화 | SpecView 736 | Medium |
| B-ABSTRACT | abstractCandidates 생성되나 AbstractPanel 미사용 | SpecView 2312 | Medium |
| B-DRAWINGS-SAVE | DrawingsPanel 완료 상태가 localStorage에 저장 안됨 | specStore.ts | Medium |

---

## 12. 환경 정보

```bash
# 로컬 실행
cd react-app
npm install
npm run dev   # http://localhost:5173

# 배포 사이트
https://axp-patent-app.vercel.app/
# 로그인: muhayu / scl2026!
```

### 주요 패키지
| 패키지 | 용도 |
|--------|------|
| `react` + `typescript` | 프레임워크 |
| `tailwindcss` | 스타일링 (CK.Patent 디자인 시스템) |
| `clsx` | 조건부 클래스 |
| `katex` | LaTeX 수식 렌더링 |
| `docx` | DOCX 생성 |
| `file-saver` | 파일 다운로드 |
| `zustand` (또는 Context) | 전역 상태 (store.tsx) |

---

## 13. 수정 권장 순서

### 1단계: 데이터 흐름 연결 (약 1~2일)

**A. ClaimsPanel에 발명 입력 연결**
```typescript
// SpecView.tsx — ClaimsPanel props 추가
<ClaimsPanel
  inventionInput={{ title: diTitle, field: diField, content: diContent }}
  confirmedComponents={confirmedComponents}
  // ...
/>

// ClaimsPanel 내부 — INDEP_CANDS_INIT 대신:
const [cands, setCands] = useState(() =>
  generateIndependentClaims(inventionInput, confirmedComponents)
    .map(c => ({ ...c, selected: true, ... }))
);
```

**B. AbstractPanel에 abstractCandidates 연결**
```typescript
// SpecView.tsx AbstractPanel props:
<AbstractPanel
  candidates={abstractCandidates.length > 0 ? abstractCandidates : ABSTRACT_CANDS.map(c => c.text)}
  // ...
/>
```

**C. DescriptionPanel에 mockAiService 연결**
```typescript
// startFlow()에서 descriptionTexts 생성 후 DescriptionPanel에 전달
const descTexts = {
  tech: generateDescriptionSection('tech', input),
  bg: generateDescriptionSection('bg', input),
  // ...
};
```

### 2단계: UI 접근성 (0.5일)

**A. SpecEditorView 미리보기 버튼 추가** (툴바 우측)

**B. 구성요소 모달 확정 시 스텝 진행**
```typescript
// SpecView.tsx 777줄
onConfirm={() => {
  setCompModalOpen(false);
  confirm('components');  // 스텝 진행
}}
```

### 3단계: 도면 흐름 완성 (약 1일)

**A. DrawingsPanel finalDrawings 상태 올리기**
```typescript
// DrawingsPanel에 prop 추가
onDrawingsChange: (drawings: DrawingItem[]) => void;

// SpecView에서
const [finalDrawings, setFinalDrawings] = useState<DrawingItem[]>(MOCK_DRAWINGS);

// makeAnalysisResult()에서
drawings: finalDrawings,
```

**B. SpecView에서 generateMockDrawings 호출**
```typescript
// startFlow() 내부
const mockDrawings = generateMockDrawings(input);
setFinalDrawings(mockDrawings);
```

### 4단계: PDF 업로드 (별도 스프린트, 백엔드 필요)

현재 SpecView 420-435줄의 업로드 존에 `<input type="file" accept=".pdf">` 추가 후 백엔드 PDF 파싱 API 연동 필요.

---

## 14. GuidePanel vs SpecEditorView 우측 패널 차이

| | GuidePanel (SpecView) | 우측 패널 (SpecEditorView) |
|-|-----------------------|---------------------------|
| 역할 | 분석 단계별 AI 수정 요청 | 에디터 단락 AI 수정 요청 |
| 컨텍스트 | 선택된 카드 텍스트 (focusCtx) | 선택된 단락 블록 (selSet) |
| 탭 구조 | 없음 (단일) | AI 어시스턴트 / 도면 (2탭) |
| 채팅 이력 | 스텝 전환 시 초기화됨 (버그) | 뷰 유지 중 유지됨 |

---

*이 문서는 코드 분석 기반으로 자동 생성되었습니다. 실제 API 연동 시 섹션 5-7을 먼저 확인하세요.*
