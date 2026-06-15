# GuidePanel 내부 레이아웃 개선 프롬프트

당신은 `c:\project\06_AXP\react-app\src\views\SpecView.tsx` 파일의 `GuidePanel` 함수 컴포넌트 내부 레이아웃을 수정한다.

---

## 문제

GuidePanel 우측 패널에서:
1. AI 분석 결과 카드들(A/B/C/D) 아래에 빈 공간이 생김 — 카드가 적을 때 특히 심각
2. "텍스트를 클릭하면 AI가 수정을 도와드립니다" 힌트 텍스트가 채팅창 바로 위를 차지해 공간 낭비
3. 카드가 많아지는 Step(구성요소 등)에서 채팅창이 카드 영역을 압박

## 목표 레이아웃

```
┌──────────────────────────────┐
│ 헤더 + 설명 (shrink-0)        │
├────── flex-1 overflow-y-auto ─┤  ← 카드들이 남은 공간 전부 차지
│ A: ...                        │     카드 많으면 자체 스크롤
│ B: ...                        │
│ C: ...                        │
│ D: ...                        │
└──────────────────────────────┘
│ [AI에게 질문하세요...]  [▶]   │  ← shrink-0, 1줄 고정
│ [이전]          [다음 →]      │  ← shrink-0
└──────────────────────────────┘
```

---

## 실행

### Step 1 — GuidePanel의 `<aside>` 최상위 컨테이너 확인

`SpecView.tsx`에서 `function GuidePanel` 선언을 찾는다. 그 내부의 `return (` 다음 최상위 `<aside>` 태그를 찾는다.

`<aside>` 에 `flex flex-col` 클래스가 없으면 추가한다:

```tsx
<aside
  ref={panelRef}
  className="... flex flex-col overflow-hidden ..."
  style={{ ... }}
>
```

### Step 2 — 헤더/설명 영역에 `shrink-0` 추가

GuidePanel 상단의 헤더(단계 제목, 설명 텍스트)를 감싸는 div에 `shrink-0`을 추가한다. 해당 div는 단계 아이콘·제목·설명이 들어있는 블록이다:

```tsx
<div className="... shrink-0 ...">
  {/* 단계 제목, 설명 텍스트 */}
</div>
```

### Step 3 — 카드 목록 영역에 `flex-1 overflow-y-auto` 적용

AI 분석 결과 카드들(A/B/C/D 선택 카드 + "직접 입력" 카드)을 감싸는 div를 찾는다. 이 div의 클래스에 `flex-1 overflow-y-auto`를 추가하고, 기존에 고정 높이가 있으면 제거한다:

```tsx
{/* 카드 목록 영역 */}
<div className="flex-1 overflow-y-auto scroll-thin px-3 py-2 space-y-2">
  {/* A/B/C/D 후보 카드들 */}
</div>
```

Step마다 렌더링하는 카드 영역이 다를 수 있다(titleCandidates, abstractCandidates, componentItems 등). 각 Step의 카드 영역을 감싸는 가장 가까운 div에 동일하게 적용한다.

### Step 4 — "텍스트를 클릭하면 AI가 수정을 도와드립니다" 힌트 제거

다음과 유사한 텍스트를 가진 요소를 찾아 **삭제**한다:

```tsx
{/* 삭제 대상 */}
<p className="... text-ck-muted ...">텍스트를 클릭하면 AI가 수정을 도와드립니다</p>
```

또는 `focusCtx`가 null일 때 표시되는 힌트 메시지 전체 블록을 삭제한다. 채팅 input placeholder("AI에게 질문하세요...")로 역할이 충분히 전달된다.

### Step 5 — 채팅 입력창 + 네비게이션 버튼 영역에 `shrink-0` 확인

채팅 input(`<input placeholder="AI에게 질문하세요...">`)을 감싸는 div와 "이전/다음" 버튼을 감싸는 div 모두 `shrink-0` 클래스가 있는지 확인하고 없으면 추가한다:

```tsx
{/* 채팅 입력 영역 */}
<div className="shrink-0 border-t border-ck-border px-3 py-2">
  <div className="flex gap-2">
    <input placeholder="AI에게 질문하세요..." className="flex-1 ..." />
    <button>▶</button>
  </div>
</div>

{/* 네비게이션 버튼 */}
<div className="shrink-0 border-t border-ck-border flex justify-between px-3 py-2">
  <button>이전</button>
  <button>다음 →</button>
</div>
```

---

## 검증

```bash
cd c:\project\06_AXP\react-app
npm run build
```

빌드 성공 후 `npm run dev`로 개발 서버 실행.

브라우저에서 명세서 분석 흐름 진입 후 확인:

1. **Step 2 (명칭)**: 카드 4개 → 카드 아래 빈 공간 없이 채팅창이 바로 아래에 위치
2. **Step 4 (구성요소)**: 구성요소 항목이 많을 때 카드 영역만 스크롤되고, 채팅창·네비게이션은 고정
3. "텍스트를 클릭하면 AI가..." 힌트 텍스트 제거 확인
4. 채팅 input 동작 정상 확인
