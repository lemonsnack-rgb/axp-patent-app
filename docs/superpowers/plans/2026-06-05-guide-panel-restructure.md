# GuidePanel 구조 재설계 실행 프롬프트

대상: `c:\project\06_AXP\react-app\src\views\SpecView.tsx`

## 목표

**현재**: 오른쪽 GuidePanel에 A/B/C 후보 카드 + 채팅이 함께 있음 → 노트북에서 공간 부족

**변경 후**:
- 왼쪽 본문(flowRef): A/B/C 후보 카드 인라인 표시 (현재 단계만)
- 오른쪽 GuidePanel: 채팅 전용 + 상단에 "선택된 카드" 미러

```
왼쪽 본문                           오른쪽 GuidePanel
─────────────────────────────      ─────────────────────
AI: "발명의 명칭 후보입니다"         ┌ 선택됨 ──────────────┐
                                    │ A · 기술 기반...      │
┌─ A ✓ 선택됨 ──────────────┐      └─────────────────────┘
│  기술 기반 직무발명서 장치...│
│  [↺재생성] [✎수정] [→AI]  │      채팅 이력 (flex-1)
└────────────────────────────┘       사용자: "더 구체적으로"
                                      AI: 수정안 + [적용]
┌─ B ────────────────────────┐
│  인공지능을 이용한...        │      ─────────────────────
│  [↺재생성] [✎수정] [→AI]  │      [입력창]   [▶]
└────────────────────────────┘      [← 이전]   [다음 →]

┌─ C ────────────────────────┐
│  직무발명서를 위한...        │
│  [↺재생성] [✎수정] [→AI]  │
└────────────────────────────┘

┌─ D 직접 입력 ──────────────┐
│  [textarea]                 │
└────────────────────────────┘

            [다음 단계 →]
```

---

## Step 1 — FocusCtx 타입을 GuidePanel 밖으로 이동

GuidePanel 함수 내부에 정의된 `type FocusCtx`와 `type GuideChatMsg`를 GuidePanel 함수 **바깥**, 파일 상단으로 이동한다.

GuidePanel 내부(line ~697)에서 찾아 삭제:
```typescript
type GuideChatMsg = { ... };
type FocusCtx = { text: string; label: string; apply: (newText: string) => void };
```

GuidePanel 함수 선언 **위**에 추가:
```typescript
type FocusCtx = { text: string; label: string; apply: (newText: string) => void };
type GuideChatMsg = {
  id: number;
  role: 'user' | 'ai';
  text: string;
  proposed?: string;
  applyFn?: () => void;
  applied?: boolean;
  intentOptions?: string[];
  selectedIntent?: string;
  sourceMsg?: string;
  sourceFocusCtx?: FocusCtx;
};
```

---

## Step 2 — SpecView에 focusCtx state 추가 (lift up)

`SpecView` 함수 내부, `const [guideOpen, setGuideOpen]` 선언 근처에 추가:

```typescript
// GuidePanel 채팅 컨텍스트 — 어느 카드에 대해 AI에게 묻는지
const [specFocusCtx, setSpecFocusCtx] = useState<FocusCtx | null>(null);
```

---

## Step 3 — GuidePanel props에 focusCtx 추가

GuidePanel 함수 시그니처(line ~661)를 찾아 props에 추가:

```typescript
function GuidePanel({ step, gSel, setGSel, onConfirm, confirmed, onPrev, hasPrev,
  allDone, onGenerateSpec, customCandidates, aiComponents,
  mobileOpen, onMobileClose,
  focusCtx, setFocusCtx,    // ← 추가
}: {
  ...
  focusCtx: FocusCtx | null;       // ← 추가
  setFocusCtx: (ctx: FocusCtx | null) => void;  // ← 추가
})
```

GuidePanel 함수 내부에서 기존 `useState<FocusCtx | null>(null)` 선언을 **삭제**:
```typescript
// 삭제
const [focusCtx, setFocusCtx] = useState<FocusCtx | null>(null);
```

---

## Step 4 — GuidePanel 호출부에 props 전달

GuidePanel 렌더링(line ~606)에 두 props 추가:

```tsx
<GuidePanel
  key={`guide-panel-${guideStep}`}
  step={guideStep}
  ...기존 props...
  focusCtx={specFocusCtx}
  setFocusCtx={setSpecFocusCtx}
/>
```

---

## 구현 시 처리 방침 (설계 결정)

- **appliedIdx (초록 ring flash)**: 카드 분리 후 구현 복잡도 상승 → Step 5에서 제거. GuidePanel 내부 `appliedIdx` state 및 관련 코드 삭제. 추후 필요 시 별도 추가.
- **채팅 입력창**: 기존 `<textarea>`를 그대로 유지. `<input type="text">`로 변경하지 않음.
- **guideChatMsgs 리셋**: `key={guide-panel-${guideStep}}`에 의해 단계 이동 시 채팅 이력 초기화 — 현재 동작 유지, 변경 없음.

---

## Step 5 — GuidePanel에서 카드 영역 제거, 채팅 전용으로 변경

GuidePanel 내부에서 다음 블록을 **삭제**:
```tsx
{/* 일반 단계 A/B/C/D 카드 */}
{!isSpecial && (
  <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-2 ml-1.5">
    {cands.map(...)}
    {/* 직접 입력 카드 (D) */}
    {!isDone && (...)}
  </div>
)}
```

대신 상단 헤더 아래, 특수 패널(`{step === 'description' && ...}`) **위에** "선택된 카드 미러"를 삽입:

```tsx
{/* 선택된 카드 미러 — focusCtx가 있을 때 */}
{focusCtx && !isSpecial && (
  <div className="shrink-0 mx-3 mt-2 mb-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
    <p className="text-xs2 text-blue-500 font-semibold mb-0.5">선택됨</p>
    <p className="text-sm2 text-gray-800 font-semibold leading-snug line-clamp-2">
      {focusCtx.text}
    </p>
  </div>
)}

{/* 카드가 없는 일반 단계 — 안내 메시지 */}
{!isSpecial && !focusCtx && (
  <div className="shrink-0 mx-3 mt-2 mb-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg">
    <p className="text-xs2 text-zinc-400">
      왼쪽 본문에서 카드를 선택하면 AI에게 수정을 요청할 수 있습니다.
    </p>
  </div>
)}
```

GuidePanel의 `<aside>` 내부 flex 구조를 채팅 중심으로 조정:

```tsx
{/* 채팅 영역 — flex-1로 남은 공간 전부 차지 */}
<div className="flex-1 flex flex-col overflow-hidden border-t border-ck-border ml-1.5 bg-white">
  {/* 메시지 이력 */}
  {guideChatMsgs.length > 0 && (
    <div className="flex-1 overflow-y-auto scroll-thin px-3 py-2 space-y-2 bg-zinc-50">
      {guideChatMsgs.map(m => (...))}
      <div ref={guideChatEndRef} />
    </div>
  )}
  {/* 이력 없을 때 빈 공간 */}
  {guideChatMsgs.length === 0 && (
    <div className="flex-1" />
  )}
  {/* 포커스 컨텍스트 표시 */}
  {focusCtx && (
    <div className="shrink-0 px-3 pt-1.5 pb-0">
      <div className="flex items-center gap-1 text-xs2">
        <span className="text-blue-600 font-semibold shrink-0">수정 요청 중</span>
        <span className="text-zinc-400 truncate">· {focusCtx.text.slice(0, 22)}{focusCtx.text.length > 22 ? '…' : ''}</span>
      </div>
    </div>
  )}
  {!focusCtx && (
    <div className="shrink-0 px-3 pt-1.5 pb-0">
      <p className="text-xs2 text-zinc-400">카드를 선택하고 [→AI] 버튼을 눌러 수정을 요청하세요.</p>
    </div>
  )}
  {/* 입력창 */}
  <div className="shrink-0 flex gap-2 items-center px-3 py-2">
    <input
      type="text"
      className="flex-1 text-xs2 border border-zinc-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 transition-colors"
      placeholder={focusCtx ? `"${focusCtx.text.slice(0, 12)}…" 수정 요청...` : 'AI에게 질문하세요...'}
      value={guideChatInput}
      onChange={e => setGuideChatInput(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendGuideChat(); } }}
    />
    <button
      onClick={() => sendGuideChat()}
      disabled={!guideChatInput.trim()}
      className="shrink-0 w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition-colors">
      <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" width="12" height="12">
        <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z" fill="white" stroke="none"/>
      </svg>
    </button>
  </div>
</div>
```

---

## Step 6 — 본문 영역에 후보 카드 인라인 렌더링 추가

`STEPS.slice(1).map(s => {...})` 루프(line ~475)에서 각 단계별 렌더링 블록을 찾는다.

현재 각 step은 다음을 렌더링함:
1. AI 버블 (항상)
2. 확정 카드 (isDone일 때)

`isDone`이 아닌 **현재 단계(`s.id === guideStep`)** 일 때 후보 카드를 렌더링하는 블록을 추가한다.

각 step 블록 내부(`{isDone && (...)}` **앞**에) 삽입:

```tsx
{/* 현재 단계 후보 카드 — isDone 아닐 때만 */}
{s.id === guideStep && !isDone && !isSpecialStep(s.id) && (() => {
  const stepCands = (s.id === 'title' ? (titleCandidates.length > 0 ? titleCandidates : undefined) :
                     s.id === 'abstract' ? (abstractCandidates.length > 0 ? abstractCandidates : undefined) :
                     undefined) || GUIDE_CANDS[s.id] || [];
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const [localEditIdx, setLocalEditIdx] = useState<number | null>(null);  // ← 이 부분은 별도 컴포넌트로 분리
  const curSel = gSel[s.id] || stepCands[0] || '';

  return (
    <div className="space-y-2 mt-2">
      {stepCands.map((c, i) => {
        const letter = letters[i] || String(i + 1);
        const isSelected = curSel === c;
        return (
          <div
            key={i}
            onClick={() => {
              setGSel(p => ({ ...p, [s.id]: c }));
              setSpecFocusCtx({
                text: c,
                label: STEP_LABEL[s.id] || s.id,
                apply: (newText) => setGSel(p => ({ ...p, [s.id]: newText })),
              });
            }}
            className={clsx(
              'rounded-xl border-2 p-3 cursor-pointer transition-all bg-white',
              isSelected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30',
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={clsx(
                'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0',
                isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
              )}>{letter}</span>
              {isSelected && <span className="text-xs2 text-blue-600 font-semibold">✓ 선택됨</span>}
              <div className="ml-auto flex gap-1">
                {/* AI에게 수정 요청 버튼 */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setGSel(p => ({ ...p, [s.id]: c }));
                    setSpecFocusCtx({
                      text: c,
                      label: STEP_LABEL[s.id] || s.id,
                      apply: (newText) => setGSel(p => ({ ...p, [s.id]: newText })),
                    });
                    // GuidePanel 채팅 입력창으로 포커스
                    setTimeout(() => {
                      document.querySelector<HTMLInputElement>('aside input[type="text"]')?.focus();
                    }, 50);
                  }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs2 text-blue-500 hover:bg-blue-100 transition-colors"
                  title="AI에게 수정 요청"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
                    <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z" fill="currentColor" stroke="none"/>
                  </svg>
                  AI
                </button>
              </div>
            </div>
            <p className="text-sm2 font-semibold text-gray-800 leading-snug">{c}</p>
          </div>
        );
      })}

      {/* 직접 입력 카드 */}
      <div
        className={clsx(
          'rounded-xl border-2 p-3 transition-all bg-white',
          !stepCands.includes(curSel) && curSel.trim() ? 'border-blue-600 bg-blue-50' : 'border-zinc-200 hover:border-blue-300',
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 bg-gray-200 text-gray-500">
            {letters[stepCands.length] || 'D'}
          </span>
          <span className="text-xs2 text-gray-500 font-semibold">직접 입력</span>
        </div>
        <textarea
          className="w-full text-sm2 font-semibold bg-transparent outline-none resize-none"
          style={{
            color: !stepCands.includes(curSel) && curSel ? '#1f2937' : '#9ca3af',
            fontStyle: !stepCands.includes(curSel) && curSel ? 'normal' : 'italic',
          }}
          placeholder={`${STEP_LABEL[s.id]}을 직접 입력하세요`}
          value={stepCands.includes(curSel) ? '' : curSel}
          onChange={e => setGSel(p => ({ ...p, [s.id]: e.target.value }))}
          onClick={e => e.stopPropagation()}
          rows={2}
        />
      </div>

      {/* 다음 단계 버튼 */}
      <button
        onClick={() => {
          if (curSel.trim()) {
            setGSel(p => ({ ...p, [s.id]: curSel }));
            confirm(s.id);
          }
        }}
        disabled={!curSel.trim()}
        className="w-full py-2 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-40 transition-colors"
      >
        다음 →
      </button>
    </div>
  );
})()}
```

**주의**: 위 코드에서 `useState`를 IIFE 내부에 쓸 수 없다. 카드 렌더링 부분을 별도 컴포넌트 `InlineCandidateCards`로 분리하여 작성한다.

---

## Step 6 (실제) — InlineCandidateCards 컴포넌트 작성

GuidePanel 함수 **위**, FocusCtx 타입 선언 아래에 추가:

```tsx
function InlineCandidateCards({
  stepId,
  cands,
  gSel,
  setGSel,
  onConfirm,
  setFocusCtx,
  guidePanelInputRef,
}: {
  stepId: StepId;
  cands: string[];
  gSel: Partial<Record<StepId, string>>;
  setGSel: React.Dispatch<React.SetStateAction<Partial<Record<StepId, string>>>>;
  onConfirm: (id: StepId) => void;
  setFocusCtx: (ctx: FocusCtx | null) => void;
  guidePanelInputRef: React.RefObject<HTMLInputElement>;
}) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const curSel = gSel[stepId] || cands[0] || '';
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<Record<number, string>>({});

  const selectCard = (text: string) => {
    setGSel(p => ({ ...p, [stepId]: text }));
    setFocusCtx({
      text,
      label: STEP_LABEL[stepId] || stepId,
      apply: (newText) => setGSel(p => ({ ...p, [stepId]: newText })),
    });
  };

  const requestAI = (text: string) => {
    selectCard(text);
    setTimeout(() => guidePanelInputRef.current?.focus(), 50);
  };

  return (
    <div className="space-y-2 mt-3">
      {cands.map((c, i) => {
        const letter = letters[i] || String(i + 1);
        const cardVal = editVals[i] ?? c;
        const isSelected = curSel === cardVal || curSel === c;
        const isEditing = editingIdx === i;
        return (
          <div
            key={i}
            onClick={() => { if (!isEditing) selectCard(cardVal); }}
            className={clsx(
              'rounded-xl border-2 p-3 cursor-pointer transition-all bg-white',
              isEditing && 'border-blue-500 bg-blue-50',
              isSelected && !isEditing && 'border-blue-600 bg-blue-50 shadow-sm',
              !isSelected && !isEditing && 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30',
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={clsx(
                'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0',
                isSelected || isEditing ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
              )}>{letter}</span>
              {isSelected && !isEditing && <span className="text-xs2 text-blue-600 font-semibold">✓ 선택됨</span>}
              <div className="ml-auto flex gap-1">
                {/* 수정 버튼 */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setEditingIdx(isEditing ? null : i);
                    setGSel(p => ({ ...p, [stepId]: cardVal }));
                  }}
                  className={clsx(
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs2 transition-colors',
                    isEditing ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
                  )}
                  title="직접 수정"
                >
                  <Icon name="edit" size={10} />
                  <span>수정</span>
                </button>
                {/* AI 수정 버튼 */}
                <button
                  onClick={e => { e.stopPropagation(); requestAI(cardVal); }}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs2 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                  title="AI에게 수정 요청"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="9" height="9">
                    <path d="M2 14L14 8L2 2v4.5l7 1.5-7 1.5V14z"/>
                  </svg>
                  AI 수정
                </button>
              </div>
            </div>
            {/* 편집 중: textarea + 확정/취소 / 일반: 텍스트 */}
            {isEditing ? (
              <>
                <textarea
                  autoFocus
                  className="w-full text-sm2 font-semibold text-gray-800 bg-white border border-blue-300 rounded px-2 py-1 outline-none resize-none"
                  value={editVals[i] ?? c}
                  rows={2}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    setEditVals(prev => ({ ...prev, [i]: e.target.value }));
                    setGSel(p => ({ ...p, [stepId]: e.target.value }));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setGSel(p => ({ ...p, [stepId]: editVals[i] ?? c }));
                      setEditingIdx(null);
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditVals(prev => { const n = { ...prev }; delete n[i]; return n; });
                      setEditingIdx(null);
                    }
                  }}
                />
                <div className="flex gap-1.5 mt-1.5" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setGSel(p => ({ ...p, [stepId]: editVals[i] ?? c })); setEditingIdx(null); }}
                    className="flex-1 py-1 text-xs2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >✓ 확정</button>
                  <button
                    onClick={() => { setEditVals(prev => { const n = { ...prev }; delete n[i]; return n; }); setEditingIdx(null); }}
                    className="px-2.5 py-1 text-xs2 text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >취소</button>
                </div>
              </>
            ) : (
              <p className="text-sm2 font-semibold text-gray-800 leading-snug">{cardVal}</p>
            )}
          </div>
        );
      })}

      {/* 직접 입력 */}
      <div className={clsx(
        'rounded-xl border-2 p-3 bg-white transition-all',
        !cands.includes(curSel) && curSel.trim() ? 'border-blue-600 bg-blue-50' : 'border-zinc-200',
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0 bg-gray-200 text-gray-500">
            {letters[cands.length] || 'D'}
          </span>
          <span className="text-xs2 text-gray-500 font-semibold">직접 입력</span>
        </div>
        <textarea
          className="w-full text-sm2 font-semibold bg-transparent outline-none resize-none"
          style={{
            color: !cands.includes(curSel) && curSel ? '#1f2937' : '#9ca3af',
            fontStyle: !cands.includes(curSel) && curSel ? 'normal' : 'italic',
          }}
          placeholder={`${STEP_LABEL[stepId]}을 직접 입력하세요`}
          value={cands.includes(curSel) ? '' : curSel}
          onChange={e => setGSel(p => ({ ...p, [stepId]: e.target.value }))}
          onClick={e => e.stopPropagation()}
          rows={2}
        />
      </div>

      {/* 확정 버튼 */}
      <button
        onClick={() => { if (curSel.trim()) { setGSel(p => ({ ...p, [stepId]: curSel })); onConfirm(stepId); } }}
        disabled={!curSel.trim()}
        className="w-full py-2.5 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-40 transition-colors"
      >
        다음 →
      </button>
    </div>
  );
}
```

---

## Step 7 — guidePanelInputRef 추가 및 연결

`SpecView` 함수 내부에 ref 추가:
```typescript
const guidePanelInputRef = useRef<HTMLInputElement>(null);
```

GuidePanel 호출부에 prop 추가:
```tsx
<GuidePanel
  ...
  chatInputRef={guidePanelInputRef}
/>
```

GuidePanel 함수 props에 추가:
```typescript
chatInputRef?: React.RefObject<HTMLInputElement>;
```

GuidePanel 내부 input에 ref 연결:
```tsx
<input
  ref={chatInputRef}
  type="text"
  ...
/>
```

---

## Step 8 — STEPS.map에서 InlineCandidateCards 렌더링

`flowRef` 내부 `STEPS.slice(1).map(s => {...})` 루프에서 각 step 블록 안에 추가.

`isSpecialStep` 헬퍼 추가 (GuidePanel에 있던 `isSpecial` 로직):
```typescript
const isSpecialStep = (id: StepId) =>
  id === 'description' || id === 'components' || id === 'drawings' || id === 'claims' || id === 'abstract';
```

각 step 블록에서 `{isDone && (...)}` **앞**에 삽입:
```tsx
{/* 현재 단계 후보 카드 인라인 */}
{s.id === guideStep && !isDone && !isSpecialStep(s.id) && (
  <InlineCandidateCards
    stepId={s.id}
    cands={(s.id === 'title' ? (titleCandidates.length > 0 ? titleCandidates : undefined) :
            s.id === 'abstract' ? (abstractCandidates.length > 0 ? abstractCandidates : undefined) :
            undefined) || GUIDE_CANDS[s.id] || []}
    gSel={gSel}
    setGSel={setGSel}
    onConfirm={confirm}
    setFocusCtx={setSpecFocusCtx}
    guidePanelInputRef={guidePanelInputRef}
  />
)}
```

---

## Step 9 — isSpecial 단계 State를 SpecView로 lift up

GuidePanel 내부에 있는 아래 state들을 SpecView 함수 본체로 이동한다.

GuidePanel 내부에서 **삭제**:
```typescript
// 삭제 대상 (GuidePanel 내부)
const [confirmedComponents, setConfirmedComponents] = useState<InventionComponent[]>([]);
const [descMode, setDescMode] = useState<string>('');
const [descPromptTrigger, setDescPromptTrigger] = useState<number>(0);
const [descSubInfo, setDescSubInfo] = useState<{ ... } | null>(null);
```

SpecView 함수 내부 (`const [specFocusCtx, ...]` 선언 근처)에 **추가**:
```typescript
const [confirmedComponents, setConfirmedComponents] = useState<InventionComponent[]>([]);
const [descMode, setDescMode] = useState<string>('');
const [descPromptTrigger, setDescPromptTrigger] = useState<number>(0);
const [descSubInfo, setDescSubInfo] = useState<Parameters<NonNullable<React.ComponentProps<typeof DescriptionPanel>['onSubInfoChange']>>[0] | null>(null);
```

`InventionComponent` 타입이 GuidePanel 내부에 정의되어 있다면 GuidePanel 함수 **위**로 이동한다.

---

## Step 10 — 본문(flowRef)에 특수 패널 인라인 렌더링

`STEPS.slice(1).map(s => {...})` 루프에서 각 isSpecial step 블록 안, `{isDone && (...)}` **앞**에 삽입한다.

```tsx
{/* isSpecial 단계 패널 인라인 */}
{s.id === guideStep && !isDone && isSpecialStep(s.id) && (
  <div className="mt-3">
    {s.id === 'description' && (
      <DescriptionPanel
        done={false}
        onConfirm={() => confirm('description')}
        onUpdate={v => setGSel(p => ({ ...p, description: v }))}
        onModeChange={setDescMode}
        promptTrigger={descPromptTrigger}
        onSubInfoChange={setDescSubInfo}
        onFocusContext={setSpecFocusCtx}
      />
    )}
    {s.id === 'components' && (
      <ComponentsPanel
        done={false}
        onConfirm={() => confirm('components')}
        onUpdate={v => setGSel(p => ({ ...p, components: v }))}
        onComponentsChange={setConfirmedComponents}
        initialItems={aiComponents}
      />
    )}
    {s.id === 'drawings' && (
      <DrawingsPanel
        done={false}
        onConfirm={() => confirm('drawings')}
        onUpdate={v => setGSel(p => ({ ...p, drawings: v }))}
        inventionComponents={confirmedComponents}
      />
    )}
    {s.id === 'claims' && (
      <ClaimsPanel
        done={false}
        onConfirm={() => confirm('claims')}
        onUpdate={v => setGSel(p => ({ ...p, claims: v }))}
        onFocusContext={setSpecFocusCtx}
      />
    )}
    {s.id === 'abstract' && (
      <AbstractPanel
        done={false}
        onConfirm={() => confirm('abstract')}
        onUpdate={v => setGSel(p => ({ ...p, abstract: v }))}
        onFocusContext={setSpecFocusCtx}
      />
    )}
  </div>
)}
```

---

## Step 11 — GuidePanel에서 특수 패널 렌더링 제거

GuidePanel 함수 내부(line ~1057–1062)에서 아래 블록을 **삭제**:

```tsx
// 삭제
{step === 'description' && <DescriptionPanel ... />}
{step === 'components' && <ComponentsPanel ... />}
{step === 'drawings' && <DrawingsPanel ... />}
{step === 'claims' && <ClaimsPanel ... />}
{step === 'abstract' && <AbstractPanel ... />}
```

GuidePanel에서 삭제된 state(confirmedComponents 등)를 참조하는 코드도 함께 삭제한다.

`isSpecial` 변수 자체도 GuidePanel에서 불필요해지므로 삭제한다:
```typescript
// 삭제
const isSpecial = step === 'description' || ...;
```

GuidePanel `<aside>` 내부 구조를 모든 단계에 동일하게 적용:
1. 상단: "선택됨" 미러 (focusCtx 있을 때) / 안내 메시지 (없을 때)
2. 중간: 채팅 이력 (flex-1 overflow-y-auto)
3. 하단: 입력창 (shrink-0)

---

## Step 12 — 네비게이션 버튼을 본문 하단으로 이동

### GuidePanel에서 버튼 바 삭제

GuidePanel 하단(line ~1182–1252)의 버튼 바 전체를 **삭제**:
```tsx
// 삭제
<div className="flex gap-2 px-3 py-2.5 border-t border-ck-border bg-ck-bg shrink-0 ml-1.5">
  <button>← 이전</button>
  <button>건너뛰기</button>  {/* drawings만 */}
  <button>다음 →</button>
  <button>명세서 AI 생성</button>  {/* allDone일 때 */}
</div>
```

GuidePanel props에서도 관련 props 제거:
```typescript
// GuidePanel props에서 제거
onPrev?: () => void;
hasPrev?: boolean;
allDone?: boolean;
onGenerateSpec?: () => void;
```

### 본문 하단에 네비게이션 바 추가

`flowRef` div의 **형제로**, 왼쪽 본문 영역 **바깥** (flex-1 overflow-y-auto div 아래)에 네비게이션 바를 추가한다.

`flowRef` div를 감싸는 flex 컨테이너 구조를 변경:

```tsx
{/* 왼쪽 영역: 본문 + 네비게이션 바 */}
<div className="flex-1 flex flex-col overflow-hidden min-h-0">
  {/* 본문 스크롤 영역 */}
  <div ref={flowRef} className="flex-1 overflow-y-auto scroll-thin bg-ck-bg">
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-3">
      {/* 기존 내용 */}
    </div>
  </div>

  {/* 네비게이션 바 — 본문 하단 고정 */}
  {(phase === 'flow' || phase === 'done') && (
    <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-ck-border bg-white max-w-3xl mx-auto w-full">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
      >
        ← 이전
      </button>

      {/* drawings 단계: 건너뛰기 */}
      {guideStep === 'drawings' && !confirmed['drawings'] && (
        <button
          onClick={() => confirm('drawings')}
          className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          건너뛰기
        </button>
      )}

      {/* 마지막: 명세서 AI 생성 */}
      {allDone ? (
        <button
          onClick={onGenerateSpec}
          className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 transition-colors"
        >
          명세서 AI 생성
        </button>
      ) : (
        <button
          onClick={() => {
            const cur = gSel[guideStep];
            if (cur?.trim()) confirm(guideStep);
          }}
          disabled={!gSel[guideStep]?.trim()}
          className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-40 transition-colors"
        >
          다음 →
        </button>
      )}
    </div>
  )}
</div>
```

`onPrev`, `hasPrev`, `allDone`, `onGenerateSpec`은 SpecView 함수 내 기존 로직을 참조한다. GuidePanel에 전달되던 값들이므로 SpecView에 이미 계산된 값이 있음.

### InlineCandidateCards에서 "다음 →" 버튼 제거

Step 6에서 추가한 `InlineCandidateCards` 내부의 "확정 버튼"을 **삭제**:
```tsx
// 삭제 — 네비게이션 바로 통일
<button onClick={...} className="...">다음 →</button>
```

---

## Step 13 — GuidePanel 너비 통일 (채팅 전용)

모든 단계에서 GuidePanel이 채팅 전용이 되므로 너비를 축소한다.

GuidePanel `<aside>` 클래스에서:
```tsx
// 변경 전
'md:w-[380px] md:min-w-[320px] md:max-w-[700px]'

// 변경 후
'md:w-[320px] md:min-w-[260px] md:max-w-[480px]'
```

---

## 빌드 및 검증

```bash
cd c:\project\06_AXP\react-app
npm run build
```

### 브라우저 시나리오

**시나리오 1 — Step 2 (발명의 명칭)**
1. 왼쪽 본문에 A/B/C 카드 인라인 표시 확인
2. B 카드 클릭 → "✓ 선택됨" + 오른쪽 패널 상단 미러 확인
3. [AI 수정] → 오른쪽 채팅 입력창 포커스 확인
4. 본문 하단 "← 이전 / 다음 →" 버튼 확인

**시나리오 2 — Step 3 (발명의 설명)**
1. 왼쪽 본문에 DescriptionPanel (탭 UI) 인라인 표시 확인
2. 오른쪽 GuidePanel: 채팅만 (DescriptionPanel 없음) 확인
3. 텍스트 클릭 → 오른쪽 채팅 focusCtx 연결 확인
4. 본문 하단 "← 이전 / 다음 →" 버튼 확인

**시나리오 3 — Step 4 (구성요소)**
1. 왼쪽 본문에 ComponentsPanel 표시 확인
2. 오른쪽 GuidePanel: 채팅만 확인

**시나리오 4 — Step 5 (도면)**
1. 왼쪽 본문에 DrawingsPanel 표시 확인
2. 본문 하단 "건너뛰기" 버튼 표시 확인

**시나리오 5 — Step 7 (요약서, allDone)**
1. 모든 단계 완료 후 본문 하단 "명세서 AI 생성" 버튼 표시 확인

**시나리오 6 — 노트북(1366×768)**
1. 본문: 각 패널 스크롤 표시
2. GuidePanel(320px): 채팅 이력 + 입력창만, 공간 여유 확인
3. 모든 단계에서 네비게이션 버튼이 본문 하단으로 통일됨 확인
