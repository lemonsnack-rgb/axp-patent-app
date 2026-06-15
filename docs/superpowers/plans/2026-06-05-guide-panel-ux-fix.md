# GuidePanel UX 개선 실행 프롬프트

대상 파일: `c:\project\06_AXP\react-app\src\views\SpecView.tsx`  
대상 함수: `function GuidePanel(...)` (line ~661)

---

## 진단 요약

브라우저 직접 확인으로 발견한 실제 문제:

1. **카드 선택 인지 약함** — 선택/미선택 차이가 border-color 뿐. 좌측 강조선·체크 아이콘 없음
2. **편집 아이콘(✎) 발견성 낮음** — 5×5 아이콘만 있고 레이블 없음. 사용자가 편집 기능 자체를 모름
3. **편집 완료 방법 없음** — textarea 열린 후 다른 카드를 클릭해야 암묵적으로 닫힘. Enter/확정 버튼 없음
4. **[✓ 적용] 후 카드가 갱신됐는지 알 수 없음** — applyFn은 작동하나 시각 피드백 전혀 없음
5. **채팅 컨텍스트 연결 불명확** — "카드를 먼저 클릭해야 채팅이 해당 카드에 연결된다"는 것을 사용자가 모름
6. **힌트 텍스트 모호** — "텍스트를 클릭하면 AI가 수정을 도와드립니다" → 어떤 텍스트?

---

## 수정 A — 카드 선택 시각화 강화

### 현재 코드 (line ~941~948)

```tsx
className={clsx(
  'rounded-lg border-2 p-3 cursor-pointer transition-all',
  isSelected && !isEditing && 'border-blue-700 bg-blue-50',
  isEditing && 'border-blue-500 bg-blue-50',
  isConfirmedCard && 'border-green-500 bg-green-50',
  !isSelected && !isConfirmedCard && !isDone && !isEditing && 'border-ck-border bg-ck-bg hover:border-blue-300',
  isDone && !isConfirmedCard && 'border-gray-200 bg-white opacity-60',
)}
```

### 교체 후

```tsx
className={clsx(
  'rounded-lg border-2 p-3 cursor-pointer transition-all relative',
  isSelected && !isEditing && 'border-blue-600 bg-blue-50 shadow-sm',
  isEditing && 'border-blue-500 bg-blue-50',
  isConfirmedCard && 'border-green-500 bg-green-50',
  !isSelected && !isConfirmedCard && !isDone && !isEditing && 'border-ck-border bg-white hover:border-blue-400 hover:bg-blue-50/40',
  isDone && !isConfirmedCard && 'border-gray-200 bg-white opacity-60',
)}
```

### 카드 헤더 행(letter 배지 옆)에 ✓ 체크 배지 추가

현재 `<div className="flex items-center gap-2 mb-2">` 내부의 letter 배지 다음에 삽입:

```tsx
<span className={clsx(
  'w-5 h-5 rounded-full text-xs2 font-bold flex items-center justify-center shrink-0',
  isSelected || isConfirmedCard || isEditing ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
)}>{letter}</span>

{/* 추가: 선택됨 ✓ 배지 */}
{isSelected && !isEditing && (
  <span className="text-xs2 text-blue-600 font-semibold">✓ 선택됨</span>
)}
```

---

## 수정 B — 편집 버튼 레이블 추가 + 편집 완료 버튼

### 현재 편집 버튼 (line ~978~985)

```tsx
<button
  onClick={e => { e.stopPropagation(); setEditingIdx(isEditing ? null : i); setGSel(p => ({ ...p, [step]: cardVal })); }}
  className={clsx('w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700',
    isEditing ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200')}
  title="직접 수정"
>
  <Icon name="edit" size={11} />
</button>
```

### 교체 후

```tsx
<button
  onClick={e => { e.stopPropagation(); setEditingIdx(isEditing ? null : i); setGSel(p => ({ ...p, [step]: cardVal })); }}
  className={clsx(
    'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs2 transition-colors',
    isEditing
      ? 'bg-blue-100 text-blue-700'
      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
  )}
  title="직접 수정"
>
  <Icon name="edit" size={10} />
  <span>수정</span>
</button>
```

### 편집 중일 때 textarea 아래 확정/취소 버튼 추가

현재 `{isEditing ? (<textarea ... />) : (...)}` 블록에서 textarea 다음에 삽입:

```tsx
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
        setGSel(p => ({ ...p, [step]: e.target.value }));
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          // Enter로 확정: 편집 종료 + 선택 유지
          setGSel(p => ({ ...p, [step]: editVals[i] ?? c }));
          setEditingIdx(null);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setEditVals(prev => { const n = { ...prev }; delete n[i]; return n; });
          setEditingIdx(null);
        }
      }}
    />
    {/* 확정/취소 버튼 */}
    <div className="flex gap-1.5 mt-1.5" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => {
          setGSel(p => ({ ...p, [step]: editVals[i] ?? c }));
          setEditingIdx(null);
        }}
        className="flex-1 py-1 text-xs2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        ✓ 확정
      </button>
      <button
        onClick={() => {
          setEditVals(prev => { const n = { ...prev }; delete n[i]; return n; });
          setEditingIdx(null);
        }}
        className="px-2.5 py-1 text-xs2 text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        취소
      </button>
    </div>
  </>
) : (
  <p className="text-sm2 font-semibold text-gray-800 leading-snug">{cardVal}</p>
)}
```

---

## 수정 C — [✓ 적용] 후 카드 업데이트 피드백

### 현재 상태

`[✓ 적용]` 클릭 시 `m.applyFn?.()` 호출 → `setEditVals`, `setGSel` 업데이트되나 시각 피드백 없음.

### 수정 방법

GuidePanel 함수 내부 state에 `appliedIdx` state 추가:

```typescript
const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
```

`[✓ 적용]` 버튼의 onClick을 수정:

```tsx
<button
  onClick={() => {
    m.applyFn?.();
    setFocusCtx(prev => prev ? { ...prev, text: m.proposed! } : null);
    // 적용된 카드 인덱스 찾아 flash 효과
    const appliedCardIdx = cands.findIndex((c, ci) => {
      const cv = editVals[ci] ?? c;
      return cv === focusCtx?.text || gSel[step] === cv;
    });
    if (appliedCardIdx >= 0) {
      setAppliedIdx(appliedCardIdx);
      setTimeout(() => setAppliedIdx(null), 1500);
    }
    // 수정안 카드를 "적용됨"으로 표시
    setGuideChatMsgs(prev => prev.map(msg =>
      msg.id === m.id ? { ...msg, applied: true } : msg
    ));
  }}
  className="flex-1 py-1 text-xs2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
>
  ✓ 적용
</button>
```

카드 렌더링에서 `appliedIdx === i` 일 때 flash 클래스 추가:

```tsx
className={clsx(
  'rounded-lg border-2 p-3 cursor-pointer transition-all relative',
  appliedIdx === i && 'ring-2 ring-green-400 ring-offset-1',  // 추가
  isSelected && !isEditing && 'border-blue-600 bg-blue-50 shadow-sm',
  ...
)}
```

`GuideChatMsg` 타입에 `applied?: boolean` 필드 추가:

```typescript
type GuideChatMsg = {
  ...
  applied?: boolean;
};
```

수정안 카드에서 이미 적용됐을 때 버튼 상태 변경:

```tsx
<div className="flex gap-1 px-2 pb-2">
  <button
    disabled={m.applied}
    onClick={...}
    className={clsx(
      'flex-1 py-1 text-xs2 font-semibold rounded-lg transition-colors',
      m.applied
        ? 'bg-green-100 text-green-700 cursor-default'
        : 'bg-blue-600 text-white hover:bg-blue-700',
    )}
  >
    {m.applied ? '✓ 적용됨' : '✓ 적용'}
  </button>
  ...
</div>
```

---

## 수정 D — 채팅 힌트 텍스트 + 컨텍스트 표시 개선

### 현재 힌트 텍스트 제거/교체

GuidePanel 내 `"텍스트를 클릭하면 AI가 수정을 도와드립니다"` 문자열을 찾아 교체:

```tsx
{/* 현재 */}
{/* 텍스트를 클릭하면 AI가 수정을 도와드립니다 */}

{/* 교체 후: focusCtx 없을 때만 표시, 문구 개선 */}
{!focusCtx && (
  <div className="px-3 pt-1.5 pb-0">
    <p className="text-xs2 text-zinc-400">카드를 클릭하여 선택하면 AI에게 수정을 요청할 수 있습니다.</p>
  </div>
)}
```

### 현재 "편집 중:" 레이블 개선 (line ~1103~1108)

```tsx
{/* 현재 */}
{focusCtx && (
  <div className="shrink-0 px-3 pt-1 pb-0 text-xs2">
    <span className="text-zinc-400">편집 중: <span className="text-blue-600 font-semibold">{focusCtx.label}</span></span>
  </div>
)}

{/* 교체 후: 선택된 카드의 텍스트 앞부분 표시 */}
{focusCtx && (
  <div className="shrink-0 px-3 pt-1.5 pb-0">
    <div className="flex items-center gap-1 text-xs2">
      <span className="text-blue-600 font-semibold shrink-0">선택됨</span>
      <span className="text-zinc-400 truncate">· {focusCtx.text.slice(0, 22)}{focusCtx.text.length > 22 ? '…' : ''}</span>
    </div>
  </div>
)}
```

---

## 수정 E — 채팅 입력창 placeholder 개선

현재: `placeholder="AI에게 질문하세요..."`

```tsx
placeholder={focusCtx ? `"${focusCtx.text.slice(0, 12)}…" 수정 요청...` : 'AI에게 질문하세요...'}
```

focusCtx가 있을 때 선택된 카드와 연결됨을 placeholder로 명시.

---

## 빌드 검증

```bash
cd c:\project\06_AXP\react-app
npm run build
```

### 브라우저 시나리오 검증

**시나리오 1 — 카드 선택**
1. Step 2 (발명의 명칭) 진입
2. A 카드 클릭 → `✓ 선택됨` 배지 + 파란 배경 확인
3. B 카드 클릭 → B로 선택 이동, A는 흰 배경으로 복귀

**시나리오 2 — 직접 수정**
1. A 카드의 "수정" 버튼 클릭 → textarea 열림 + 확정/취소 버튼 표시
2. 텍스트 수정 후 "✓ 확정" 클릭 → textarea 닫힘, 수정된 텍스트 카드에 반영
3. A 카드 "수정" 버튼 클릭 → Esc 키 → textarea 닫힘, 원래 텍스트 복원

**시나리오 3 — AI 채팅 수정**
1. B 카드 클릭 → 하단에 "선택됨 · 인공지능을..." 레이블 표시
2. 채팅 placeholder가 `"인공지능…" 수정 요청...`으로 변경 확인
3. "더 기술적으로 바꿔줘" 입력 → AI 수정안 카드 출력
4. [✓ 적용] 클릭 → B 카드 텍스트 업데이트 + 초록 ring flash → "✓ 적용됨" 표시
