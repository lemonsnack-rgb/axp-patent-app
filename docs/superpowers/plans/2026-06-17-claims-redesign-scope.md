# AXPlain 청구항 재설계 + 구조 보완 작업 범위
작성일: 2026-06-17  
상태: 설계 확정, 구현 대기

---

## 배경

- 독립항 구조를 개별 후보(IndepClaimCandidate) → **쌍 기반 세트(IndependentClaimSet)** 로 전환
- 연구노트 기반: `docs/[AXP] M2 독립항 생성 기능 - 1차 실험.pdf`
- 기초자료 분석 단계에서 불필요한 항목(요약서, 해결수단) 제거
- 구현 전 디자인 품질 검토 포함

---

## 1. 변경 대상 파일 (5개)

| # | 파일 | 변경 성격 | 규모 |
|---|------|----------|------|
| 1 | `src/features/spec/types.ts` | 타입 추가/수정/삭제 | 소 |
| 2 | `src/features/spec/mockAiService.ts` | 함수 교체·삭제 | 중 |
| 3 | `src/views/SpecView.tsx` | ClaimsPanel 재설계 + 항목 제거 | 대 |
| 4 | `src/views/SpecEditorView.tsx` | 툴바 버튼 추가 | 소 |
| 5 | `src/features/spec/specStore.ts` | 초기값 정리 | 극소 |

---

## 2. types.ts

### 추가
```typescript
type ClaimCategory = 'process' | 'machine' | 'manufacture' | 'composition';
type AbstractionLevel = 'broad' | 'intermediate' | 'specific'; // 내부값, UI 노출 금지

interface Claim {
  category: ClaimCategory;
  value: string;
}

interface IndependentClaimSet {
  id: string;
  abstraction_level: AbstractionLevel;  // 내부 분류값
  claims: Claim[];                       // 2~3개 (기본: machine + process 쌍)
}
```

### 수정 — SpecClaimsState
| 기존 | 변경 후 |
|------|---------|
| `indepCands: Array<{id, label, text, selected}>` | 삭제 |
| — | `claimSets: IndependentClaimSet[]` 추가 |
| — | `selectedSetId: string \| null` 추가 |
| `depGroups: Record<number, {...}>` | key 타입 `number` → `string` (setId 기반) |

### 수정 — SpecStepId
- `'abstract'` 제거 (요약서 step 삭제)

### 수정 — SpecDescTexts
- `solution?: string` 제거 (해결수단 삭제)

### 수정 — SpecAnalysisState
- `abstractCandidates: string[]` 제거

---

## 3. mockAiService.ts

### 제거
- `IndepClaimCandidate` 인터페이스
- `generateIndependentClaims()` 함수
- `generateAbstractCandidates()` 함수
- `generateDescriptionSection()` 내 `'solution'` case

### 추가 — generateIndependentClaimSets()
```
반환: IndependentClaimSet[] (4~5개 세트)

세트 구성:
  broad        × 2개  (넓은 권리범위)
  intermediate × 2개  (균형 권리범위)
  specific     × 1개  (한정 권리범위)

각 세트 내 claim 구성:
  claims[0]: category=machine  (장치항)
  claims[1]: category=process  (방법항)
```

---

## 4. SpecView.tsx

### A. 요약서(Step 7) 전체 제거
- `StepId` 타입 → `'abstract'` 제거 (line 24)
- `STEPS` 배열 → 7번 항목 제거 (line 32)
- `STEP_LABEL`, `CONFIRM_LABEL`, `AI_NEXT` → `abstract` 키 제거 (lines 37, 42, 51)
- `AI_NEXT['claims']` 문구 수정: "청구항을 확정했습니다. 명세서 초안을 생성할 준비가 완료되었습니다."
- `GUIDE_CANDS['abstract']` 제거 (lines 66-68)
- `abstractCandidates` state + 저장/복원 로직 제거 (lines 113, 139, 147, 182)
- `isSpecialStep()` → `'abstract'` 제거 (line 162)
- `buildSpecPreview()` → `{ label: '요약서', ... }` 제거 (line 250)
- `buildAnalysisResult()` → `abstract: ...` 제거 (line 281)
- `AbstractPanel` 렌더링 제거 (line 601-602)
- `AbstractPanel` 컴포넌트 본체 제거

### B. 과제의 해결수단 제거
- `DESC_SECTIONS` → `{ key: 'solution', label: '과제의 해결 수단', ... }` 제거 (lines 2258-2261)
- `GUIDE_CANDS['description']` → `'해결수단: ...'` 항목 제거 (line 63)
- `buildSpecPreview()` → `{ label: '과제의 해결 수단', ... }` 제거 (line 247)
- `buildAnalysisResult()` → `solution: extractDescSec('과제의 해결 수단')` 제거 (line 276)

### C. ClaimsPanel 전면 재설계 (사후 선택형)

#### 구조 변경
| 항목 | 기존 | 변경 후 |
|------|------|---------|
| 상태 | `cands[]` 다중 체크박스 | `claimSets[]` 단일 라디오 |
| 독립항 단위 | 개별 claim | 2개 claim 쌍(세트) |
| 선택 방식 | 여러 개 선택 가능 | 1개 세트만 선택 |

#### Phase A UI (사후 비교 선택)
```
AI가 권리범위별로 독립항 세트를 생성했습니다.
1개를 선택하면 해당 세트의 종속항이 구성됩니다.

┌─ ○  넓은 권리범위 ──────────────────────────────────────────┐
│  장치항  라이다 센서로부터 포인트 클라우드 데이터를...           │
│  방법항  라이다 센서로부터 데이터를 획득하는 단계...             │
└──────────────────────────────────────────────────────────────┘
┌─ ●  균형 권리범위 ──────────────────────────────────────────┐  ← 선택
│  ...                                                        │
└──────────────────────────────────────────────────────────────┘
┌─ ○  한정 권리범위 ──────────────────────────────────────────┐
│  ...                                                        │
└──────────────────────────────────────────────────────────────┘

[선택한 세트로 종속항 구성 →]
```

#### abstraction_level → UI 레이블 매핑
| 내부값 | UI 레이블 | 부제 |
|--------|----------|------|
| `broad` | 넓은 권리범위 | 청구 범위 최대화, 심사 대응 필요 |
| `intermediate` | 균형 권리범위 | 등록 가능성과 보호 범위 균형 |
| `specific` | 한정 권리범위 | 구체 구성 한정, 등록 용이 |

#### Phase B (종속항 생성)
- 선택된 세트의 claims[0] (장치항) 종속항 그룹 표시
- 선택된 세트의 claims[1] (방법항) 종속항 그룹 표시
- "← 세트 재선택" 버튼으로 Phase A 복귀

#### 오탈자 수정 (Phase A 재설계 시 자연 해소)
- line 2054: `{n}개 으로` → `{n}개로`

---

## 5. SpecEditorView.tsx

### 툴바 내보내기 버튼 추가
- 위치: 수식(`∑`) 버튼 우측에 separator + 버튼 추가
- `미리보기` 버튼 → `setEditorPreviewOpen(true)` (PreviewModal 이미 구현됨)
- `DOCX 내보내기` 버튼 → 기존 버그 B17 핸들러 연결 (docx 패키지 기사용)

---

## 6. specStore.ts

- `getDefaultSpecState()` → `abstractCandidates: []` 제거

---

## 7. 디자인 품질 검토 요구사항 (구현 시 병행)

> 전체 리디자인 금지. 기존 Tailwind 스타일·컴포넌트 패턴 유지.
> 실제 변리사가 사용하는 전문 업무 도구로 보기 어색한 부분만 보완.

### 검토 관점
1. **정보 위계** — 현재 단계/주요 작업/다음 행동의 시각적 명확성
2. **레이아웃** — 좌(작업목록)/중(본문)/우(어시스턴트) 역할 구분, 스크롤 구조
3. **여백과 정렬** — 카드·패널·버튼 간격 일관성, 빽빽하지 않은 밀도
4. **컴포넌트 일관성** — 동일 의미 버튼의 동일 스타일, 모달·폼·리스트 일관성
5. **상태 표시** — AI 후보/검토 중/확정/최종 상태 명확한 구분
6. **전문 업무 도구 신뢰감** — 챗봇·데모 페이지가 아닌 특허 실무 도구다운 정돈
7. **색상과 강조** — 주요/보조/위험/완료/경고 액션 색상 구분, 과도한 혼색 없음
8. **반응형** — 3패널 구조 좁은 화면 대응, 보조 패널 접힘/오버레이

### 보완 원칙
- 새 디자인 시스템 임의 생성 금지
- 전체 UI 재작성 금지
- 기존 구조 유지 + 사용성·일관성·정보 위계·레이아웃 안정성 개선
- 현재 작업 범위 외 화면 임의 수정 금지
- 비즈니스 로직·기존 기능 흐름 불변
- 개발자가 재사용할 수 있는 반복 가능한 컴포넌트 패턴 유지

### 작업 보고 시 추가 항목
1. 디자인 관점에서 발견한 문제
2. 정보 위계 개선 내용
3. 레이아웃 및 여백 개선 내용
4. 컴포넌트 일관성 개선 내용
5. 상태 표시 디자인 개선 내용
6. 전문 업무 도구다운 신뢰감 측면의 개선 내용
7. 반응형 디자인 검토 결과
8. 전체 리디자인이 아니라 기존 디자인을 유지하며 보완한 범위

---

## 변경하지 않는 것

| 파일 | 이유 |
|------|------|
| `specStore.ts` (저장 로직) | 초기값 정리 외 변경 없음 |
| `RefListPanel.tsx` | 이전 세션 수정 완료 |
| SpecEditorView 툴바 외 영역 | 버튼 추가 외 변경 없음 |
| 작업 범위 외 화면 | 임의 수정 금지 |
