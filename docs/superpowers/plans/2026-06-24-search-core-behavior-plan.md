# 특허 검색 핵심 동작 구현 계획 (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「[AXP] 특허검색 동작방식」 명세 §2~§3의 핵심 검색 동작(검색식 AND 누적, 검색 후 입력 비움/필드 유지, 검색 범위 적용, 메타필터 결과 반영, 검색 버튼 비활성)을 목업 데이터 위에서 구현한다.

**Architecture:** 검색식 조립/누적/범위적용/메타필터 로직을 순수 함수 모듈(`src/features/search/queryModel.ts`)로 분리해 단위 테스트한다. `PatentInput`은 이 모듈을 사용해 (a) 검색 시 필드값을 기존 검색식에 AND 누적하고, (b) 검색 후 필드 입력값만 비우며, (c) 범위탭을 선두 자유검색어에 적용한 "실행 검색식"과 메타필터를 `onRun(execQuery, meta)`로 상위에 전달한다. `PatentResults`는 메타필터를 패싯과 교집합으로 적용하고 새 검색 시 패싯·페이지를 초기화한다.

**Tech Stack:** React 18, TypeScript, Tailwind CSS. 신규 dev 의존성으로 **vitest** 추가(순수 로직 단위 테스트 전용). 런타임 의존성 추가 없음.

## Global Constraints

- **데모는 기능/API 레퍼런스, UI/UX는 신규 설계** — 데모사이트(`http://10.77.0.244:8010/patents`)의 UI를 그대로 복제하지 않는다. 데모의 **기능 구현 내역과 API(검색식 문법·필드·동작)는 그대로 활용**하되, **UX/UI는 우리 서비스에 맞게 새로 설계**한다. 데모 화면은 "이 기능이 이렇게 동작한다"를 확인하는 동작 레퍼런스일 뿐.
- **기능은 데모 API가 제공하는 범위로 한정 (억지 삽입 금지)** — 키워트 등 경쟁사 UX/UI는 참고하되, 데이터·검색 기능은 **데모가 쓰는 API(ISE 필드 설계 기준)가 주는 필드·연산만** 사용한다. API에 없는 필드/기능은 화면에 억지로 넣지 않는다. 목업 단계에서 임시 표기하더라도 **Phase 5 API 연동 시 미제공 항목은 제거/숨김**한다. 행·상세의 구성요소는 반드시 **데모 API 실제 응답 필드와 대조해 확정**한다.
- **확정 범위 = 현재 데모 페이지에 구현된 기능 (DB/API 미완성)** — DB·API가 아직 완료되지 않았다. **현재 데모 페이지에서 실제로 동작하는 기능만 "확정"**이고, 그 밖(초록 스니펫·도면 썸네일을 리스트 행에 노출, 확장 논문 상세 섹션, 패밀리 그룹화/동일문헌 묶기 등)은 **"미확정"**이다. 미확정 항목은 **하드 요구사항으로 만들지 않으며**, 계획서에서 `(미확정 — API/DB 완성 시 반영)`으로 표기하고 목업에서도 가벼운 플레이스홀더/숨김으로 처리한다.
- **사이드 리더 깊이 = 풀 상세 (확정)** — 행 클릭 시 우측 사이드 리더에는 *풀 상세*(서지·요약·청구항·도면 등)를 넣고 폭 ~480px에 적응시킨다. 새 탭은 정독·다건 비교용.
- **패싯 위치는 상단 필터바 유지** — 데모는 좌측 패싯 사이드바를 쓰지만, 실제 서비스가 좌측 작업 사이드바 구조라 "사이드바 속 사이드바"를 피하기 위한 의도적 UX 결정(신규 설계의 일부).
- **검색식 문자열 무보정 [검색-13]** — 검색식 입력창의 사용자 텍스트는 공백 정리·대소문자 변경·자동교정 금지. 단, 검색 필드 패널의 개별 입력값을 절(clause)로 변환할 때의 `trim()`은 구조적 조립이므로 허용.
- **입력은 임시 상태, 검색 버튼으로만 확정 [검색-50]** — 입력 중 결과 불변.
- **디자인 토큰 준수** — 기존 클래스/토큰만 사용(`brand-400`, `text-sm2/xs2/md2`, `.input`, `.scroll-thin` 등). 새 색상·임의 인라인 스타일 추가 금지.
- **기존 컴포넌트 구조 최소 변경** — `SlidingView`/`GalleryView`/`FilterDrawer`/`TableResults` 등 기존 컴포넌트 삭제 금지.
- **3단계 플로우는 항상 이용 가능해야 한다 (회귀 금지)** — `검색어 입력 → 검색결과 → 상세`와 역방향·`◀▶` 이동이 모든 변경 후에도 끊김 없이 동작해야 한다. (2026-06-24 기준 전 구간 정상 동작 확인됨.) 매 Task 완료 시 이 플로우를 우선 회귀 검증한다.
- **특허·논문 사용성 동일** — 아래 "결과 열람 & 패싯 상호작용" 설계 결정은 특허와 논문에 **동일하게** 적용한다.

---

## 결과 열람 & 패싯 상호작용 — 설계 결정 (2026-06-24)

### 1. 결과 → 상세 열람 모델 (현재 UX 교체)

**문제:** 현재 행 클릭 = 우측 *좁은 미리보기*(요약만, w-80=320px), 명칭/전체보기 = *별도 전체화면 페이지*. 클릭 액션이 이원화되어 모호하고, 전체화면 진입 시 목록 맥락이 끊겨 "훑어보다 관심항목만 확인"하는 변리사 패턴과 어긋난다.

**결정 — 2계층, 인앱 전체화면 모드 제거:**
- **① 사이드 리더(분할):** 행 클릭 → 우측에 *충분히 넓은*(현재 320px → 약 `min(45%, 480px)`) 상세 리더. 현재의 요약-only 미리보기를 **풀 상세 콘텐츠**(서지·요약·청구항·도면 등)로 교체. 목록은 좌측 상시 유지. 닫기(X)/다른 행 클릭으로 전환, `◀▶`로 목록 순서 이동. → 목록이 사라지지 않으므로 "검색결과로 돌아가기" 행위가 거의 불필요.
- **② 새 탭 전체 상세 `↗`:** 리더/행의 `새 탭에서 열기 ↗` → 문서별 URL(`?doc=<문헌번호>`)로 전체 상세를 **새 탭**에 표시. 여러 건을 탭으로 띄워 비교(키워트/WIPS ON 친숙성 = 동작방식 명세 대원칙). 결과 탭은 보존, 탭을 닫으면 자연 복귀.
- **인앱 "전체화면 토글"은 두지 않는다** — "새 페이지인가? 어떻게 돌아가지?" 모호성 제거. `↗` 아이콘은 보편적으로 "새로 열림"으로 이해됨.
- 기존 전체화면 `PatentDetail`은 삭제하지 않고 **②(새 탭 라우트)의 본문으로 재사용**한다.

> 키워트 '슬라이드뷰'식 "선택분만 정독"은 기존 `SlidingView`(체크박스 선택 연동)로 추후 확장 — 본 결정 범위 밖, 별도 결정.

### 2. 패싯(필터) — 사이드바 부재 사용성 평가 + 보완

**전제:** 패싯은 좌측 사이드바로 두지 않는다(실서비스의 좌측 작업 사이드바와 "사이드바 속 사이드바" 회피 + 결과 영역 우선).

**평가:**
- **검색필드명 입력 패널:** 입력 영역 하단 접이식 + 그룹 탭(텍스트/분류/인명/번호/일자) 구조는 사이드바보다 이 서비스에 **더 적합**. 검색 시에만 펼쳐 조건을 추가하고 평소엔 결과에 집중(사이드바였다면 상시 점유로 결과 영역 축소). → **현 구조 유지**.
- **패싯/필터:** 사이드바 부재의 실제 약점은 "값별 분포(건수)를 한눈에" 보는 능력 상실[검색-150]. 상단 바는 공간이 좁아 분포를 상시 노출하기 어렵다. → **보완: 패싯 칩별 스코프 팝오버**. 각 칩(국가/권리상태/출원연도/IPC…)을 클릭하면 *그 패싯의 값+건수만* 뜨는 팝오버. "모든 필터"는 전체 카테고리 드로어. 적용 필터는 칩 행으로 상시 노출(현존). → 사이드바의 분포-가시성을 칩별 팝오버로 회수하면서 결과 폭은 넓게 유지.

**현재 코드 버그 (확인됨, `PatentResults.tsx:219-244`):** 모든 패싯 칩과 "모든 필터" 버튼이 동일한 단일 `drawerOpen`을 토글 → **칩 하나만 눌러도 전체 필터 드로어가 열림**. 위 스코프 팝오버 설계로 교체하며 수정한다.

### 3. 논문 동일 사용성

위 ①②와 패싯 스코프 팝오버를 **논문 결과에도 동일 적용**한다(Phase 4 대칭 재작성에 포함). 논문 패싯은 발행처·발행연도, 새 탭 상세 URL은 `?paper=<id>`.

---

## 검색결과 목록 & 상세 구성요소 + 가독성 (특허·논문, 키워트 참고)

> 레퍼런스: 키워트(`keywert.com/search/fulltext`) 실제 화면(`docs/검색식/키워크 검색결과.png`, `키워트 상세화면.png`) + 「특허검색 동작방식」 [검색-90·100·130]. **현재 전체 구성이 미완 상태**이며 아래로 완성한다. (키워트는 *동작/구성* 참고이지 UI 복제 아님 — 우리 디자인 토큰·레이아웃 유지.)

### 0. 검색결과 목록 — 행(row) 구성 (키워트 참고, 핵심 보강)

**문제(현재):** 우리 결과는 *빈약한 테이블*(상태·문헌번호·일자·명칭·출원인·만료일)뿐 — **초록 스니펫·도면 썸네일이 행에 없어** "상세를 안 열고 훑어보는" 변리사 패턴을 지원하지 못한다. 키워트는 행마다 제목+초록+도면을 노출해 목록에서 1차 선별이 끝난다.

**결정 — 리치 행(기본 리스트):** 빈약한 테이블을 *읽히는 행*으로 바꾼다. 단, **확정 필드(데모/ISE에 존재)로만 구성**하고 미확정은 분리한다.

*확정 필드 (현재 구현/ISE display 존재 — 바로 사용):*
- 체크박스 · No · 문헌번호 + 국가 + **상태 배지**
- **제목 — 다색 키워드 하이라이트**[검색-100] (검색어 토큰별 색)
- 메타라인: 출원일/공개·등록일 · 출원인 · IPC(주분류)
- 우측: 원문/PDF(있으면) · 라이브러리 저장(★)
- 행 클릭 → 사이드 리더(풀 상세, "결과 열람 모델 ①"), `↗`/제목 더블클릭 → 새 탭 전체 상세

*미확정 (API/DB 완성 시 반영 — 지금 하드 요구사항 아님):*
- **초록 스니펫**(검색어 하이라이트, 2~3줄) — `(미확정)` 리스트 응답에 초록 포함 시 추가
- **도면 대표 썸네일** — `(미확정)` 리스트 응답이 도면 이미지 참조를 줄 때만 추가, 미제공이면 생략

> ISE display 기본 설정은 명칭·출원인만 노출하므로, 초록·도면의 *리스트 노출*은 데모/API 확정 전까지 넣지 않는다. 리치 행의 1차 형태 = **확정 필드만으로도 컴팩트 테이블보다 읽기 쉬운 행**(제목 하이라이트 강조 + 메타라인 정리).

**결과 영역 상단 바:**
- 국가별 건수 탭(전체/KR/US/JP/EP…) · 종류(특허공개/등록/실용…) · 상태(active/inactive)
- **패밀리 그룹화 토글**(동일 패밀리 묶어 보기) · 정렬(매칭/최신/오래된) · NN개씩 · **뷰 토글(리스트/2분할/갤러리)**[검색-130] · 컬럼 설정
- 적용 검색식 칩(실제 검색식) · 검색조건 수정

**뷰 밀도 옵션:** 리치 행(기본, 스캔용) ↔ 컴팩트 테이블(대량 비교용) ↔ 갤러리(도면 스크리닝). 기존 `SlidingView`(2분할/연속 스크롤)·`GalleryView` 재사용.

### 특허 상세 — 섹션 구성 (현행 `PatentDetail.tsx` 기준, 키워트 정합 유지)

> 사이드 리더(분할 ~480px)와 새 탭 전체(≥960px)는 **하나의 상세 컴포넌트가 너비에 적응**한다(컴포넌트 2개로 분기 금지). 아래 섹션 구성은 두 모드 공통, 레이아웃만 너비에 따라 달라진다.

| # | 섹션 | 구성요소 |
|---|---|---|
| — | 상단 액션 바 | `검색결과로`(분할에선 닫기 X) · `◀ pos ▶` · 배경기술 참조 · 라이브러리 저장 · **새 탭에서 열기 `↗`** |
| — | 키워드 하이라이터 바 | 검색어 키워드 pill(색상·매칭 `n/n`·`↑↓` 이동·접기) |
| — | 앵커 탭(sticky) | 서지사항·인명정보·요약·상세설명·청구범위·패밀리정보·인용·피인용·분류코드·기타정보 |
| 1 | 타이틀 | 상태 배지·국가·문헌번호·평가등급 + 발명의 명칭 |
| 2 | 서지사항 | 문헌/출원/공개공고/등록 번호+일자 표 + **타임라인**(우선권→출원→심사청구→공개→등록→만료) |
| 3 | 인명정보 | 출원인·주소·특허고객번호(KR)/식별기호(JP)·발명자·발명자주소 |
| 4 | 요약 | 원문 + `🌐 자동번역` 토글 |
| 5 | 상세설명 | 원문(전문) + `🌐 자동번역` 토글 |
| 6 | 청구범위 | `독립항`/`전체청구항` 토글 + 대표청구항 강조 박스 + 종속항 |
| 7 | 패밀리정보 | 국가 탭(전체/KR/US/JP…) + 국가별 건수 pill |
| 8 | 인용·피인용 | 인용/피인용 각각: 특허 인용 목록 + 비특허(논문) 인용 목록 + 비특허 인용 표(카테고리/단계/출처/내용) |
| 9 | 분류코드 | Original IPC / CPC (정합 후 Main/All 구분) |
| 10 | 기타정보 | 대리인·주소 + 심판/소송 + 특허평가 |
| — | 도면 패널 | 메인 도면 + 썸네일 그리드(클릭 전환) |

> **데이터 의존 렌더:** 각 섹션은 **데이터가 있을 때만 렌더**한다. 데모/API에서 아직 안 오는 항목(패밀리 분포, 인용/피인용·비특허 인용, 심판/소송, 특허평가, 자동번역 등)은 `(미확정)` — 목업에선 가벼운 플레이스홀더, API 미제공 시 숨김. 확정 핵심 = 서지·인명·요약·상세설명·청구범위·분류코드 + 도면.

### 논문 상세 — 섹션 구성 (주요 메타데이터 + 원문링크 수준)

> **논문은 특허처럼 깊은 상세를 만들지 않는다 — "주요 메타데이터 + 원문링크" 수준으로 가볍게.** 인용/피인용·저자 소속 상세 등 무거운 섹션은 넣지 않는다(특허 대칭 ≠ 동일 분량).

| # | 섹션 | 구성요소 |
|---|---|---|
| — | 상단 액션 바 | 닫기/`◀ pos ▶` · 라이브러리 저장 · 인용 복사 · **새 탭 `↗`** · **원문 링크(전문 보기)** |
| — | 키워드 하이라이터 바 | 특허와 동일(검색어 매칭 강조) |
| 1 | 타이틀 | 유형 배지(저널/학회)·발행연도 + 논문 제목 |
| 2 | 서지 메타데이터 | 저자 · 저널/발행처 · 발행연도 · DOI · 키워드 |
| 3 | 초록 | 원문 + `🌐 자동번역` 토글 |
| 4 | 원문 링크 | 전문(원문) 바로가기 — 자체 DB가 보유한 링크 |
| — | (AI 요약) | 우리 앱 부가요소(목업), 유지 가능 — 데이터 무관 |

> **논문 소스 = 자체 구축 DB (외부 PubMed/OpenAlex 아님).** 데모 `papers` 페이지가 이 DB를 사용 → **데모 구현 필드가 확정 범위**.
> - *확정 필드(데모 papers 기준):* 제목 · 초록 · 키워드(KWD) · 전문(DSC) · 저자(AP) + 패싯 **발행처·발행연도**. → 위 1~4 구성 가능(주요 메타데이터 + 원문링크).
> - *제외:* 저자 소속·교신저자, **인용/피인용**, 분야 분류 — 이번 범위 밖(메타데이터+링크 수준 유지).
> - **주의(Phase 4 코드 수정):** 현재 `PaperInput`의 "PubMed · Scopus · Web of Science · arXiv · Google Scholar 통합 검색" 안내 문구는 **사실과 다름**(자체 DB임) → 자체 DB 기준 문구로 교체.

### 가독성 규칙 (두 모드 공통 + 너비 적응)

- **너비 적응(핵심):**
  - **새 탭 전체(≥960px):** 본문 + 우측 도면 패널 **2-column**. 본문은 줄길이 폭주 방지를 위해 `max-w` 제한(약 `72ch`). 앵커 탭 가로.
  - **사이드 리더 분할(~480px):** **단일 컬럼**. 도면 패널(특허)은 우측 고정 대신 본문 내 **가로 썸네일 스트립** 또는 "도면" 앵커 섹션으로 이동. 서지/인명 **4열 표 → 2열 키-값 스택**. 앵커 탭은 가로 스크롤 스트립(또는 섹션 점프 드롭다운). 타임라인 가로 스크롤.
- **타이포 위계:** 제목 `text-xl`, 섹션 제목 `text-base2` bold + 하단 구분선, 본문 `text-base2`(14px) `leading-relaxed`. 긴 텍스트(상세설명·청구항·초록)는 measure 제한으로 줄길이 통제.
- **스캔성:** sticky 앵커 탭으로 섹션 점프 + 현재 섹션 활성 표시(스크롤 동기화), 검색어 하이라이트 + 매칭 이동(`↑↓`).
- **국/영 혼재:** 요약·상세설명·청구항·초록에 `🌐 자동번역` 토글. 영문 원문은 좌측 정렬·적정 measure.
- **표 가독성:** 라벨 열 고정폭·좌측 정렬, 값은 `font-mono`(번호·일자). 분할 모드에서 표가 넘치면 스택 전환(위 너비 적응).
- **컨트롤 일관성:** 토글/탭/배지는 서비스 전체 동일 패턴(메모리 *컨트롤 일관성* 준수).

> 본 구성·가독성 규칙의 bite-sized 구현은 Phase 1B(사이드 리더 너비 적응) + Phase 4(논문 상세 신규)에서 상세화한다.

---

## 명세 → 태스크 매핑 (Phase 1 범위)

| 요구사항 | 내용 | 태스크 |
|---|---|---|
| [검색-60~63] | 검색 필드 AND 누적, 누적식 입력창 표시 | Task 1, 2 |
| [검색-62] | 검색 후 필드 입력값 비움 | Task 2 |
| [검색-70~72] | 필드 구성 유지, 패널 자동 접힘 | Task 2 |
| [검색-20~22] | 범위탭을 선두 자유검색어에만 적용 | Task 1, 2 |
| [검색-51] | 검색식·필드 모두 비면 검색 버튼 비활성 | Task 2 |
| [검색-13] | 검색식 무보정(trim 제거) | Task 1, 2 |
| [검색-41/154] | 메타필터 독립 채널 + 패싯 교집합 | Task 3 |
| [검색-121/155] | 새 검색 시 첫 페이지·패싯 해제 | Task 3 |
| 결과 칩 | 실제 실행 검색식 표시(하드코딩 제거) | Task 3 |

> **Phase 1 범위 밖(후속 계획서):** URL 공유·복원[검색-80~82], 로딩/0건/오류 상태[검색-140~142], 논문 대칭 재작성[검색-213], 검색식 이월[검색-212], ISE 필드코드 전면 정합 — 본 문서 말미 "로드맵" 참고.

---

## 파일 구조

| 파일 | 변경 | 역할 |
|------|------|------|
| `src/features/search/queryModel.ts` | **Create** | 순수 함수: 필드→절 변환, AND 누적, 범위 적용, 메타필터 타입/생성 |
| `src/features/search/queryModel.test.ts` | **Create** | queryModel 단위 테스트 |
| `src/features/search/index.ts` | **Create** | 배럴 export |
| `vitest.config.ts` | **Create** | vitest 설정 |
| `package.json` | Modify | `vitest` devDependency + `test` 스크립트 |
| `src/views/PatentInput.tsx` | Modify | 누적·범위·비움·버튼비활성 로직 연결, `onRun(execQuery, meta)` |
| `src/views/SearchView.tsx` | Modify | `onRun` 시그니처에 meta 추가, `committedMeta` 상태 보관·전달 |
| `src/views/PatentResults.tsx` | Modify | meta 필터 prop 수신, 패싯 교집합, 새 검색 시 초기화, 실제 검색식 칩 |

---

## Task 1: queryModel 순수 모듈 + vitest 설정

**Files:**
- Create: `react-app/src/features/search/queryModel.ts`
- Create: `react-app/src/features/search/queryModel.test.ts`
- Create: `react-app/src/features/search/index.ts`
- Create: `react-app/vitest.config.ts`
- Modify: `react-app/package.json`

**Interfaces:**
- Produces:
  - `type ScopeTab = 'KEY_CLI' | 'KEY_CLA' | 'DSC'`
  - `interface SFieldInput { code: string; type: 'text' | 'date-range' | 'ipc'; value: string; dateFrom?: string; dateTo?: string }`
  - `interface MetaFilter { countries: string[]; docKinds: string[]; statusAll: boolean; statusActive: string[]; statusInactive: string[]; periodChip: string; periodFrom: string; periodTo: string }`
  - `fieldClause(f: SFieldInput): string | null`
  - `accumulateQuery(current: string, fields: SFieldInput[]): string`
  - `applyScope(query: string, scope: ScopeTab): string`
  - `hasSearchInput(formula: string, fields: SFieldInput[]): boolean`

- [ ] **Step 1: vitest devDependency 설치**

```bash
cd react-app && npm install -D vitest@^2
```
Expected: `package.json` devDependencies에 `vitest` 추가, 설치 성공.

- [ ] **Step 2: `package.json`에 test 스크립트 추가**

`react-app/package.json` 의 `"scripts"` 블록에 한 줄 추가:

```json
"test": "vitest run",
```

- [ ] **Step 3: `vitest.config.ts` 생성**

`react-app/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: 실패하는 테스트 작성**

`react-app/src/features/search/queryModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  fieldClause, accumulateQuery, applyScope, hasSearchInput,
  type SFieldInput,
} from './queryModel';

const text = (code: string, value: string): SFieldInput => ({ code, type: 'text', value });
const date = (code: string, dateFrom: string, dateTo: string): SFieldInput =>
  ({ code, type: 'date-range', value: '', dateFrom, dateTo });

describe('fieldClause', () => {
  it('텍스트 필드를 CODE=(값) 절로 변환', () => {
    expect(fieldClause(text('TI', '엔진'))).toBe('TI=(엔진)');
  });
  it('값이 공백뿐이면 null', () => {
    expect(fieldClause(text('TI', '   '))).toBeNull();
  });
  it('일자 범위를 CODE=[from ~ to] 절로 변환', () => {
    expect(fieldClause(date('AD', '20080101', '20081231'))).toBe('AD=[20080101 ~ 20081231]');
  });
  it('일자 from/to 모두 비면 null', () => {
    expect(fieldClause(date('AD', '', ''))).toBeNull();
  });
});

describe('accumulateQuery', () => {
  it('기존 검색식에 필드 절을 AND로 누적', () => {
    expect(accumulateQuery('하이브리드', [text('TI', '엔진')]))
      .toBe('하이브리드 AND TI=(엔진)');
  });
  it('기존 검색식이 비면 필드 절만으로 구성', () => {
    expect(accumulateQuery('', [text('TI', '엔진')])).toBe('TI=(엔진)');
  });
  it('여러 필드를 모두 AND로 누적', () => {
    expect(accumulateQuery('(A)', [text('TI', '엔진'), text('AB', '연료')]))
      .toBe('(A) AND TI=(엔진) AND AB=(연료)');
  });
  it('빈 필드는 건너뛴다', () => {
    expect(accumulateQuery('A', [text('TI', ''), text('AB', '연료')]))
      .toBe('A AND AB=(연료)');
  });
  it('기존 검색식 문자열을 보정하지 않는다(공백 보존)', () => {
    expect(accumulateQuery('  하이브리드  ', [])).toBe('  하이브리드  ');
  });
});

describe('applyScope', () => {
  it('선두 자유검색어에 범위 인덱스를 적용', () => {
    expect(applyScope('하이브리드 자동차', 'KEY_CLI')).toBe('KEY_CLI=(하이브리드 자동차)');
  });
  it('이미 필드 지정된 식은 건드리지 않는다', () => {
    expect(applyScope('TI=(엔진)', 'KEY_CLI')).toBe('TI=(엔진)');
  });
  it('선두가 자유검색어이고 뒤에 AND 절이 있으면 선두만 감싼다', () => {
    expect(applyScope('하이브리드 AND TI=(엔진)', 'KEY_CLA'))
      .toBe('KEY_CLA=(하이브리드) AND TI=(엔진)');
  });
  it('빈 검색식은 그대로', () => {
    expect(applyScope('', 'DSC')).toBe('');
  });
});

describe('hasSearchInput', () => {
  it('검색식이 있으면 true', () => {
    expect(hasSearchInput('하이브리드', [])).toBe(true);
  });
  it('필드 입력이 있으면 true', () => {
    expect(hasSearchInput('', [text('TI', '엔진')])).toBe(true);
  });
  it('둘 다 비면 false', () => {
    expect(hasSearchInput('   ', [text('TI', '  ')])).toBe(false);
  });
});
```

- [ ] **Step 5: 테스트가 실패하는지 확인**

Run: `cd react-app && npx vitest run src/features/search/queryModel.test.ts`
Expected: FAIL — `Failed to resolve import "./queryModel"` (모듈 미존재).

- [ ] **Step 6: `queryModel.ts` 구현**

`react-app/src/features/search/queryModel.ts`:

```ts
// 검색식 조립/누적/범위적용 순수 로직 — 「특허검색 동작방식」 §2~§3 구현.
// 검색식 입력창 문자열은 보정하지 않는다 [검색-13]. 필드 입력값만 절 변환 시 trim.

export type ScopeTab = 'KEY_CLI' | 'KEY_CLA' | 'DSC';

export interface SFieldInput {
  code: string;
  type: 'text' | 'date-range' | 'ipc';
  value: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MetaFilter {
  countries: string[];
  docKinds: string[];
  statusAll: boolean;
  statusActive: string[];
  statusInactive: string[];
  periodChip: string;
  periodFrom: string;
  periodTo: string;
}

// 필드 하나를 검색식 절로 변환. 비어 있으면 null.
export function fieldClause(f: SFieldInput): string | null {
  if (f.type === 'date-range') {
    const from = (f.dateFrom || '').trim();
    const to = (f.dateTo || '').trim();
    if (!from && !to) return null;
    return `${f.code}=[${from} ~ ${to}]`;
  }
  const v = f.value.trim();
  if (!v) return null;
  return `${f.code}=(${v})`;
}

// 기존 검색식(current)에 필드 절들을 AND로 누적 [검색-60·61].
// current 문자열은 보정하지 않는다 [검색-13].
export function accumulateQuery(current: string, fields: SFieldInput[]): string {
  const clauses = fields.map(fieldClause).filter((c): c is string => c !== null);
  if (clauses.length === 0) return current;
  if (current === '') return clauses.join(' AND ');
  return [current, ...clauses].join(' AND ');
}

// 선두 토큰이 필드 지정 식인지 검사 (CODE=(...) 또는 CODE:...).
function startsWithFieldOperator(query: string): boolean {
  return /^\s*[A-Za-z_][A-Za-z0-9_]*\s*[:=]/.test(query);
}

// 검색 범위(모드)를 선두 자유검색어에만 적용 [검색-20~22].
// 사용자가 필드 지정 전문가 검색식을 쓴 경우 건드리지 않는다 [검색-22].
export function applyScope(query: string, scope: ScopeTab): string {
  if (query.trim() === '') return query;
  if (startsWithFieldOperator(query)) return query;

  // 선두 자유검색어 = 첫 boolean 연산자( AND/OR/NOT ) 또는 필드절 이전까지.
  const m = query.match(/^(.*?)(\s+(?:AND|OR|NOT)\s+.*)$/i);
  if (m) {
    return `${scope}=(${m[1].trim()})${m[2]}`;
  }
  return `${scope}=(${query.trim()})`;
}

// 검색식 또는 필드 입력 중 하나라도 값이 있으면 true [검색-51].
export function hasSearchInput(formula: string, fields: SFieldInput[]): boolean {
  if (formula.trim() !== '') return true;
  return fields.some(f => fieldClause(f) !== null);
}
```

- [ ] **Step 7: `index.ts` 배럴 생성**

`react-app/src/features/search/index.ts`:

```ts
export * from './queryModel';
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `cd react-app && npx vitest run src/features/search/queryModel.test.ts`
Expected: PASS — 전체 테스트 green.

- [ ] **Step 9: Commit**

```bash
git add react-app/src/features/search react-app/vitest.config.ts react-app/package.json react-app/package-lock.json
git commit -m "feat(search): queryModel — 검색식 누적/범위적용 순수 로직 + vitest"
```

---

## Task 2: PatentInput — 누적·범위·검색후 비움·버튼 비활성 연결

**Files:**
- Modify: `react-app/src/views/PatentInput.tsx`
- Modify: `react-app/src/views/SearchView.tsx`

**Interfaces:**
- Consumes: `accumulateQuery`, `applyScope`, `hasSearchInput`, `fieldClause`, `type ScopeTab`, `type SFieldInput`, `type MetaFilter` (Task 1)
- Produces: `interface Props { onRun: (execQuery: string, meta: MetaFilter) => void }` (PatentInput)

- [ ] **Step 1: import 추가**

`src/views/PatentInput.tsx` 상단 import 블록에 추가:

```tsx
import { accumulateQuery, applyScope, hasSearchInput, type ScopeTab, type SFieldInput, type MetaFilter } from '../features/search';
```

- [ ] **Step 2: 로컬 `KeyTab` 타입을 공유 `ScopeTab`으로 교체**

기존 (line ~137):

```tsx
type KeyTab = 'KEY_CLI' | 'KEY_CLA' | 'DSC';
const KEY_TABS: { id: KeyTab; label: string }[] = [
```

변경 후 (로컬 타입 제거, 공유 타입 사용):

```tsx
const KEY_TABS: { id: ScopeTab; label: string }[] = [
```

그리고 `const [keyTab, setKeyTab] = useState<KeyTab>('KEY_CLI');` (line ~166) →

```tsx
  const [keyTab, setKeyTab] = useState<ScopeTab>('KEY_CLI');
```

- [ ] **Step 3: Props 시그니처 변경**

기존 (line ~134):

```tsx
interface Props { onRun: (query: string) => void }
```

변경 후:

```tsx
interface Props { onRun: (execQuery: string, meta: MetaFilter) => void }
```

- [ ] **Step 4: `handleSearch` 교체 — 누적 + 범위 + 비움 + 메타 전달**

기존 `handleSearch` (line ~216-228) 전체를 교체:

```tsx
  const handleSearch = () => {
    // [검색-51] 검색식·필드 모두 비면 실행하지 않음 (버튼도 disabled)
    const fieldInputs: SFieldInput[] = fields.map(f => ({
      code: f.code, type: f.type, value: f.value, dateFrom: f.dateFrom, dateTo: f.dateTo,
    }));
    if (!hasSearchInput(formulaText, fieldInputs)) return;

    // [검색-60~63] 필드 절을 기존 검색식에 AND 누적 → 입력창에 반영
    const accumulated = accumulateQuery(formulaText, fieldInputs);
    setFormulaText(accumulated);

    // [검색-62] 검색 후 필드 입력값만 비움 (필드 구성은 유지 [검색-70])
    setFields(prev => prev.map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' })));

    // [검색-72] 검색 후 검색필드 패널 자동 접힘
    setFieldsOpen(false);

    // [검색-20~22] 범위탭을 선두 자유검색어에만 적용한 "실행 검색식"
    const execQuery = applyScope(accumulated, keyTab);

    // [검색-40·41] 메타필터를 독립 채널로 함께 전달
    const meta: MetaFilter = {
      countries: Object.keys(countries).filter(k => countries[k]),
      docKinds,
      statusAll, statusActive, statusInactive,
      periodChip, periodFrom, periodTo,
    };

    onRun(execQuery, meta);
  };
```

> **주의:** 기존 코드의 `formulaText.trim()`·`f.value.trim()` 보정은 제거됨 — [검색-13] 준수. 빈 여부 판정·절 변환은 `queryModel`이 담당.

- [ ] **Step 5: 검색 버튼 `disabled` 연결 [검색-51]**

`handleSearch` 다음에 파생값 추가 (line ~234 부근, `resetAll` 위):

```tsx
  const canSearch = hasSearchInput(
    formulaText,
    fields.map(f => ({ code: f.code, type: f.type, value: f.value, dateFrom: f.dateFrom, dateTo: f.dateTo })),
  );
```

검색 버튼(line ~417)을 교체:

```tsx
          <Button variant="filled" color="primary" size="sm" className="text-sm2" disabled={!canSearch} onClick={handleSearch}>검색</Button>
```

- [ ] **Step 6: SearchView — `onRun` 시그니처 + committedMeta 전달**

`src/views/SearchView.tsx` import에 타입 추가:

```tsx
import type { MetaFilter } from '../features/search';
```

상태 추가 (line ~24, `searchQuery` 다음):

```tsx
  const [committedMeta, setCommittedMeta] = useState<MetaFilter | null>(null);
```

`PatentInput` 호출부(line ~71-73)를 교체:

```tsx
            <PatentInput
              onRun={(q, meta) => { setSearchQuery(q); setCommittedMeta(meta); setPatentSearched(true); }}
            />
```

`PatentResults` 호출부(line ~78-83)에 `meta` prop 추가:

```tsx
          {patentSearched && (
            <PatentResults
              onModify={() => setPatentSearched(false)}
              onOpenDetail={i => { setDetailIdx(i); setPatentDetailOpen(true); }}
              onSave={openSavePatent}
              searchQuery={searchQuery}
              meta={committedMeta}
            />
          )}
```

> `PatentResults`의 `meta` prop은 Task 3에서 수신·사용한다. 이 단계에서는 prop만 전달(미사용 경고 방지 위해 Task 3와 연속 실행 권장).

- [ ] **Step 7: 빌드 확인**

Run: `cd react-app && npm run build`
Expected: 타입 에러 없음. (PatentResults가 아직 `meta` prop을 받지 않으면 타입 에러 → Task 3에서 해소. Task 2·3을 연속 커밋 권장.)

- [ ] **Step 8: Commit**

```bash
git add react-app/src/views/PatentInput.tsx react-app/src/views/SearchView.tsx
git commit -m "feat(search): PatentInput 검색식 AND 누적/범위적용/검색후 비움/버튼 비활성"
```

---

## Task 3: PatentResults — 메타필터 교집합 + 새 검색 초기화 + 실제 검색식 칩

**Files:**
- Modify: `react-app/src/views/PatentResults.tsx`

**Interfaces:**
- Consumes: `type MetaFilter` (Task 1), `meta: MetaFilter | null`, `searchQuery?: string` props (Task 2)

- [ ] **Step 1: import + Props에 meta 추가**

`src/views/PatentResults.tsx` import에 추가:

```tsx
import type { MetaFilter } from '../features/search';
```

`Props` 인터페이스(line ~45-50)를 교체:

```tsx
interface Props {
  onModify: () => void;
  onOpenDetail: (idx: number) => void;
  onSave: (idx: number) => void;
  searchQuery?: string;
  meta?: MetaFilter | null;
}
```

함수 시그니처(line ~52)를 교체:

```tsx
export function PatentResults({ onModify, onOpenDetail, onSave, searchQuery, meta }: Props) {
```

- [ ] **Step 2: 메타필터 적용 함수 추가**

`applyFacetFilters` 함수(line ~18) **위에** 추가:

```tsx
// 메타필터(국가·문헌종류·상태·기간)를 결과에 적용 [검색-41].
function applyMetaFilter(items: PatentResult[], meta?: MetaFilter | null): PatentResult[] {
  if (!meta) return items;
  return items.filter(p => {
    // 국가: 선택된 국가가 있으면 그 중 하나여야 함
    if (meta.countries.length > 0 && !meta.countries.includes(p.country)) return false;
    // 상태: 전체가 아니면 active/inactive 선택값에 포함되어야 함
    if (!meta.statusAll) {
      const picked = [...meta.statusActive, ...meta.statusInactive];
      if (picked.length > 0 && !picked.includes(p.status)) return false;
    }
    // 기간(custom from~to, YYYYMMDD): 출원일 기준
    const yyyymmdd = (p.applicationDate || '').replace(/\D/g, '');
    if (meta.periodFrom && yyyymmdd && yyyymmdd < meta.periodFrom.replace(/\D/g, '')) return false;
    if (meta.periodTo && yyyymmdd && yyyymmdd > meta.periodTo.replace(/\D/g, '')) return false;
    return true;
  });
}
```

- [ ] **Step 3: 데이터 파이프라인에 메타필터 합성 [검색-154]**

기존 (line ~70):

```tsx
  const filtered = applyFacetFilters(PATENT_SEED, appliedFilters);
```

변경 후 — 메타필터(검색어 채널) ∩ 패싯(결과 좁히기 채널) 교집합:

```tsx
  const metaScoped = applyMetaFilter(PATENT_SEED, meta);
  const filtered = applyFacetFilters(metaScoped, appliedFilters);
```

- [ ] **Step 4: 실제 실행 검색식 칩 [하드코딩 제거]**

기존 (line ~79):

```tsx
  const appliedQuery = 'TI=(자율주행* OR autonomous driving) AND IPCM=G01S*';
```

변경 후:

```tsx
  const appliedQuery = searchQuery && searchQuery.trim() ? searchQuery : '전체 검색';
```

- [ ] **Step 5: 새 검색 시 패싯·페이지 초기화 [검색-121·155]**

import에 `useEffect` 추가 (line ~2):

```tsx
import { useState, useRef, useEffect } from 'react';
```

`PatentResults` 함수 내 state 선언 끝(line ~67, `sortDir` 다음)에 추가:

```tsx
  // [검색-121·155] 새 검색(searchQuery 변경) 시 패싯 해제 + 첫 페이지
  useEffect(() => {
    setPendingFilters({});
    setAppliedFilters([]);
    setAppliedFilterRowVisible(false);
    setExtFilterValues({});
    setPage(1);
    setSelectedCard(0);
  }, [searchQuery]);
```

- [ ] **Step 6: 빌드 확인**

Run: `cd react-app && npm run build`
Expected: 타입 에러 없음, 빌드 성공.

- [ ] **Step 7: 단위 테스트 회귀 확인**

Run: `cd react-app && npm run test`
Expected: queryModel 테스트 전체 PASS.

- [ ] **Step 8: Commit**

```bash
git add react-app/src/views/PatentResults.tsx
git commit -m "feat(search): PatentResults 메타필터 교집합 + 새 검색 초기화 + 실제 검색식 칩"
```

---

## Task 4: 전체 플로우 브라우저 E2E 검증

**Files:** (변경 없음 — 검증 전용)

- [ ] **Step 1: 개발 서버 실행**

```bash
cd react-app && npm run dev
```

- [ ] **Step 2: 누적 동작 확인 [검색-60~63]**

1. 사이드바 → `자율주행 라이다 선행기술 조사`(특허 검색) 선택
2. 검색식 입력창에 `하이브리드` 입력 → `검색`
3. 결과 화면 진입 → `검색조건 수정`으로 입력 복귀
4. 검색필드 패널 펼침 → 텍스트 그룹 `발명의 명칭(TI)`에 `엔진` 입력 → `검색`
5. **확인:** 입력창 검색식이 `하이브리드 AND TI=(엔진)`으로 누적되어 표시됨
6. **확인:** TI 필드 입력값은 비워졌고, 필드 패널 구성(어떤 필드가 켜져 있는지)은 유지됨
7. **확인:** 검색 후 검색필드 패널이 자동으로 접힘

- [ ] **Step 3: 범위탭 적용 확인 [검색-20~22]**

1. 입력 초기화 → `명칭+요약+독립청구항` 탭 선택, 검색식에 `하이브리드 자동차` 입력 → `검색`
2. **확인:** 결과 상단 검색식 칩이 `KEY_CLI=(하이브리드 자동차)`로 표시됨
3. 입력 복귀 → 검색식을 `TI=(엔진)`으로 바꾸고 같은 탭 유지 → `검색`
4. **확인:** 칩이 `TI=(엔진)` 그대로 (필드 지정 식은 범위 미적용 [검색-22])

- [ ] **Step 4: 검색 버튼 비활성 확인 [검색-51]**

1. `초기화` 클릭 → 검색식·필드 모두 빈 상태
2. **확인:** `검색` 버튼이 비활성(disabled)
3. 검색식에 한 글자 입력 → **확인:** 버튼 활성화

- [ ] **Step 5: 메타필터 + 패싯 교집합 확인 [검색-41·154]**

1. 국가 칩에서 `KR`만 활성, `US` 해제 → 검색식 입력 → `검색`
2. **확인:** 결과 목록이 KR 문헌만 표시(목업 데이터 기준 건수 감소)
3. 결과의 패싯(상단 필터바)에서 권리상태 `등록` 체크 → `적용`
4. **확인:** KR ∩ 등록 교집합으로 결과가 더 좁혀짐

- [ ] **Step 6: 새 검색 초기화 확인 [검색-121·155]**

1. 패싯을 적용해 둔 상태에서 `검색조건 수정` → 검색식 변경 → `검색`
2. **확인:** 직전 패싯 선택이 해제되고 첫 페이지부터 표시됨

- [ ] **Step 7: 프로덕션 빌드 확인**

```bash
cd react-app && npm run build
```
Expected: 빌드 성공, 타입 에러 없음.

- [ ] **Step 8: 데모사이트 동작 대조**

`http://10.77.0.244:8010/patents`와 동작 비교 — 검색 버튼 비활성 조건, 검색 후 입력 비움, 범위탭 의미가 데모와 일치하는지 확인. (UI 레이아웃 차이는 의도된 것이므로 무시 — 동작만 대조.)

---

## Self-Review

- **Spec coverage:** [검색-60~63]→T1·T2, [검색-62/70~72]→T2, [검색-20~22]→T1·T2, [검색-51]→T2, [검색-13]→T1·T2(trim 제거), [검색-41/154]→T3, [검색-121/155]→T3, 검색식 칩→T3. Phase 1 매핑표 전 항목에 태스크 존재. ✅
- **Phase 1 밖 항목:** URL 복원·로딩/오류 상태·논문 대칭·검색식 이월·ISE 전면정합은 로드맵으로 명시 분리. ✅
- **Type 일관성:** `ScopeTab`('KEY_CLI'|'KEY_CLA'|'DSC')·`SFieldInput`·`MetaFilter`를 T1에서 정의하고 T2·T3에서 동일 명칭으로 소비. `onRun(execQuery, meta)` 시그니처를 PatentInput(T2 정의)·SearchView(T2 호출)에서 일치. ✅
- **Placeholder 스캔:** 모든 코드 단계에 실제 코드 포함, "TBD/적절히 처리" 없음. ✅

---

## 로드맵 (Phase 1B~5 — 후속 계획서로 상세화)

> 각 Phase는 본 Phase 1 완료·승인 후 별도 계획서(`2026-06-DD-...md`)로 bite-sized 상세화한다.

**Phase 1B — 결과 열람 & 패싯 상호작용 재설계 (위 "설계 결정" 구현)**
- **사이드 리더(분할)**: `PatentResults`의 행 클릭 → 좁은 요약 미리보기(`InlineDetail`)를 *넓은 풀 상세 리더*로 교체. 인앱 전체화면 토글 없음. `◀▶`·닫기(X)·다른 행 클릭 전환. (라우팅 불필요 — Phase 2 선행 가능)
- **패싯 스코프 팝오버 + 버그 수정**: 단일 `drawerOpen`(전체 필터 열림 버그)을 폐기하고, 패싯 칩별 독립 팝오버(그 패싯 값+건수만) + "모든 필터" 전체 드로어로 분리.
- 새 탭 전체 상세(`↗`)의 라우트 의존부는 Phase 2에서 활성화(아래).

**Phase 1C — 검색 보조 기능 (경쟁사 비교에서 도출, 변리사 친숙성 보강) — 지금 정식 편입**

> 키워트·WIPS ON 등 변리사 전문 도구와의 플로우 비교에서 도출. 추후로 미루면 누락되므로 계획에 확정 편입. 모두 데모/자체 DB가 주는 범위 내에서 구현.

- **검색 저장 (라이브러리) — `LibraryItem` 확장**: *현재 라이브러리는 개별 문서(`type: 'patent'|'paper'`)만 저장 가능하고, **검색(검색식·조건) 자체는 저장 불가**.* → `LibraryItem.type`에 `'search'` 추가(또는 `SavedSearch` 분리)해 검색식+메타+범위+패싯을 저장하고 클릭 시 재실행. (저장 UI = 결과 헤더의 ★ "검색 저장")
- **검색 히스토리**: 실행한 검색(검색식·조건·건수·시각)을 작업별로 자동 누적, 목록에서 클릭 재실행. (키워트 *검색 히스토리* 패턴 — 변리사 상시 사용 동선) store에 영속화.
- **결과 내 검색**: 현재 결과 집합 안에서 추가 검색하는 명시 동선. AND 누적[검색-60]과 통합하되 "결과 내 검색" 진입점을 결과 헤더에 노출(키워트·WIPS 핵심 동선).
- **패싯 팝오버 내 검색**: IPC 등 값이 많은 패싯의 팝오버 안에 검색창(데모의 *패싯 그룹 검색·IPC 검색* 동일). → Phase 1B 패싯 팝오버에 포함 확정.

**Phase 2 — URL 상태/공유 + 문서 라우트 [검색-80~82, 34, 73]**
- 검색 상태(검색식·메타·정렬·페이지·선택문서·패싯)를 URL 쿼리스트링으로 직렬화/역직렬화
- 뒤로/앞으로·새로고침 복원, 공유 링크 진입 시 결과 우선 표시 + 패널 접힘
- **문서 상세 라우트(`?doc=<번호>` / `?paper=<id>`)** → Phase 1B의 "새 탭 전체 상세 ↗" 활성화(공유 링크 = 문서 상세 링크)

**Phase 3 — 결과 상태 & 정합 [검색-92, 110~111, 140~142]**
- 로딩 / 0건 "결과 없음" / 오류(검색식 오류 vs 시스템 오류 구분) 상태 UI
- 페이지 전체 스크롤로 전환(내부 스크롤 박스 제거), 페이지 이동 중 직전 결과 유지(깜빡임 방지)
- 정렬 옵션 데모 정합(매칭순/최신순/오래된순), 정렬·뷰 상태 공유 대상화
- ISE 필드 연산자 정합: `IPCR/CPCR`→`IPCM/CPCM` 등 3중 불일치(PatentInput / patentFields.ts / ISE 설계) 단일 소스로 통일, 범위탭 라벨·인덱스 매핑 확정
- 편집기모드 실시간 진단(알 수 없는 필드·괄호 불일치 경고, 단 실행은 막지 않음 [검색-11·12])

**Phase 4 — 논문 대칭 재작성 [검색-210~213]**
- `PaperInput` row-builder → 데모와 동일한 단일 검색식 + 범위탭(제목+초록 / +전문) + 검색필드 패널(TI/AB/KWD/DSC/AP) + 빠른삽입
- `PaperResults` 인라인화(stage 전환 제거) + 페이지네이션 + **Phase 1B 상호작용 동일 적용**(사이드 리더 + 새 탭 `?paper=` + 패싯 스코프 팝오버: 발행처·발행연도)
- 검색식 이월(특허↔논문 키워드 교차) [검색-212] — 헤더 토글
- Phase 1~3에서 만든 queryModel/상태 패턴 재사용으로 특허와 대칭 보장 [검색-213]

**Phase 5 — 실제 API 연동(별도)**
- **데모가 사용하는 API를 그대로 연동** — 데모(`10.77.0.244:8010`)가 호출하는 검색 API 엔드포인트·요청/응답 계약을 파악(네트워크 요청 캡처 + ISE 필드 설계 문서)해 동일 API에 연결. 새 백엔드를 만들지 않고 데모와 같은 API 재사용.
- 목업 SEED → 실데이터 교체, 페이지네이션·패싯 집계 서버화
- 우리 신규 UX/UI는 그대로 두고 데이터 소스만 교체(queryModel이 만든 실행 검색식을 API 요청으로 매핑)
