# 특허 상세페이지 UI 항목 ↔ 수집 DB 필드 매핑표

- **목적**: 특허 검색결과 **상세페이지(`PatentDetail.tsx`)** 에 표시되는 각 UI 항목을 **수집 DB 컬럼**과 1:1로 매핑한다. 개발자가 이 표만 보고 각 표시값을 **어느 테이블·컬럼에서 불러올지**, 그리고 **그 값이 화면에 어떤 문자열로 렌더되는지** 알 수 있게 한다.
- **출처(정본)**: `[BLK] 특허 수집 데이터베이스 명세서`(원본 33p·254 컬럼 — KR 카탈로그 중심 + US/EP/JP 엔티티). 매핑은 `docs/기능정의서.md`「특허 · 상세페이지」④와 동일하며, **원본 명세서 컬럼 존재를 전수 확인**했다.
- **검증 결과(역방향)**: UI 렌더 필드 중 수집 근거가 없는 항목 **0건**. 계산·파싱 파생 3종만 컬럼 비대상(아래 `⚠파생`). 과거 `grade`(특허평가)·`dispute`(소송)는 명세서에 컬럼이 없어 **삭제 완료**.
- **표기**: `수집`=수집 컬럼 직결 · `⚠파생`=수집값에서 계산/파싱(컬럼 아님) · `⚠목업`=필드는 있으나 실데이터 연동 대기 · `조건`=특정 국가/상태에서만 렌더.
- **테이블 약칭**: `bibliographic`(서지 자연키 1행) · `custom`(국가고유 스칼라) · `KPA_*`(KR 영문보강) · `related_person`(인명, row별 classification) · `REP_APP`=`representative_applicant`(대표출원인 마스터 — 특허↔대표출원인은 `patent_representative_applicant` N:M 매핑) · US/EP/JP는 국가별 고유 테이블.
- **대조 방식(2026-07-28)**: 상세페이지에 부착한 `data-col` 값의 컬럼·테이블 토큰 **112개**를 원본 명세서 PDF 추출 텍스트와 기계 대조했다. **명세서에 없는 토큰 0건**(불일치로 잡힌 3건은 `aiPurpose`/`aiSolution`/`aiEffect` — 컬럼이 아닌 UI 파생 필드). 단 이 대조는 **토큰 존재 여부**까지이며, 컬럼이 그 테이블에 속하는지는 도면·특허고객번호 등 개별 확인한 항목에 한한다.
- **렌더 예시**: 「0. 예시 표본」의 실제 목업 데이터 값을 그대로 인용한다. 표의 `렌더 예시` 열은 **표본 A(KR/공개)** 기준이며, 국가·상태 조건 항목은 해당 표본 기호(B~E)를 함께 표기한다.

---

## 0. 예시 표본 (렌더 예시의 출처)

목업 데이터는 `src/data/patentSeed.ts`에서 **결정적(deterministic)으로 생성**되므로, 아래 표본은 항상 동일한 값으로 재현된다. 국가·권리상태별 조건부 렌더를 모두 덮도록 5건을 선정했다.

| 기호 | 문헌번호 (`number`) | 국가/상태 | 발명의 명칭 / 출원인 | 이 표본으로 확인할 조건 |
|---|---|---|---|---|
| **A** | `KR 10-2026-1000000 A` | KR / 공개 | 자율주행 차량용 라이다 기반 객체 감지 / 현대자동차주식회사 | KR 기본형(미등록) · 특허고객번호 · 국가 R&D · 표준특허 · 심판 · 서열목록 |
| **B** | `CN 1010299973 A` | CN / 등록 | 자율주행 차량용 라이다 기반 객체 감지 및 그 제조 방법 / 百度在线网络技术有限公司 | 등록계 필드(등록번호·등록일·존속만료) · 권리변동/권리이전 이력 · 분할출원 |
| **C** | `EP 3001604 A1` | EP / 거절 | LiDAR-Based Object Detection… / Robert Bosch GmbH | PCT·국제출원번호 · 지정국 · 우선권 주장 목록 · EPC · EP 커스텀 |
| **D** | `US 11007919 B2` | US / 심사중 | LiDAR-Based Object Detection… (Method) / Waymo LLC | UPC · US 관련출원·가출원 · 영문 문헌(요약/발명자/심사관) |
| **E** | `JP 2020-010074 A` | JP / 등록예정 | 자율주행 차량용 라이다 기반 객체 감지 및 그 동작 방법 / トヨタ自動車株式会社 | FI/F-term/테마 · JP 공보판·대리인 구분 · CPC 미수집(`—`) |

**재현 방법** — 표본 A는 검색 결과 첫 문헌(`PATENT_SEED[0]`)이다. 나머지는 아래로 조회한다.

```ts
import { PATENT_SEED } from './src/data/patentSeed';
const A = PATENT_SEED.find(p => p.country === 'KR' && p.status === '공개');
const B = PATENT_SEED.find(p => p.country === 'CN' && p.status === '등록');
const C = PATENT_SEED.find(p => p.country === 'EP');
const D = PATENT_SEED.find(p => p.country === 'US');
const E = PATENT_SEED.find(p => p.country === 'JP');
```

**표기·포맷 규칙(전 섹션 공통)** — 값이 어떻게 문자열로 변환되는지의 규칙. 실데이터 연동 시에도 동일하게 유지해야 한다.

| 규칙 | 처리 | 예 |
|---|---|---|
| 빈값 대체 | `undefined`·`''` → `—`(em dash) | 번역문 제출일(KR) → `—` |
| `'-'` 정규화 | 시드가 `'-'`로 채운 값도 `—`로 치환 | 등록번호 `'-'` → `—` |
| 단위 접미 | `claimCount` → `N개`, `drawingCount` → `N건`, 패밀리 → `N건` | `10개` / `5건` |
| 배열 결합 | 분류코드 = `'  ·  '`(공백2+중점+공백2), 지정국 = `', '` | `G01S 17/93  ·  G01S10/10` |
| 불리언 | `sequenceListing` → `있음` / `—` | `있음` |
| 조건부 행 숨김 | 값이 없으면 **행 자체를 렌더하지 않음**(빈 `—` 행도 안 남김) | 권리변동 이력, R&D, 표준특허 등 |
| 흐린 글씨(muted) | 미확정/플레이스홀더는 회색(`text-gray-400`) | 발명자 주소, 대리인 미상 |
| 고정폭(mono) | 번호·코드·일자 계열은 `font-mono` | 문헌번호·출원번호·IPC |

---

## 1. 제목 영역 (PAT-DET-020)

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 권리상태(평문) | `status` / `rightStatus` | `공개` (hover 툴팁: `공개 — 출원이 공개된 상태(심사 전/중, 권리 미발생)`) | `bibliographic.register_status` (+ `custom.legal_status`) | 수집 |
| 국가 | `country` | `KR` | `bibliographic.country_code` | 수집 |
| 문헌번호 | `number` | `KR 10-2026-1000000 A` | `bibliographic.literature_number` | 수집 |
| 발명의 명칭 | `title` | `자율주행 차량용 라이다 기반 객체 감지` (D: `LiDAR-Based Object Detection for Autonomous Driving (Method)`) | `bibliographic.invention_title` (+ `_eng`) | 수집 |
| 원문 PDF 다운로드 | (버튼) | `원문 PDF 다운로드` → 클릭 시 `KR 10-2026-1000000 A.pdf` 즉시 생성·저장(클라이언트 데모 표지 1p, 비ASCII는 `?` 치환) | ⚠미정 — 원문 PDF URL 컬럼 확인 필요 | ⚠목업 |

**목업 렌더 (표본 A)**

```
공개 · KR  KR 10-2026-1000000 A          ← status · country + number (mono)
자율주행 차량용 라이다 기반 객체 감지        ← title (2xl bold)
[ 원문 PDF 다운로드 ]                      ← primary filled 버튼
```

> 표시 특이사항: `country`와 `number`가 나란히 렌더되지만 목업의 `number`가 이미 국가 접두를 포함해 **`KR  KR 10-…`처럼 국가 코드가 두 번** 보인다. 실데이터 연동 시 `literature_number`에 국가 접두가 포함되는지 확인해 한쪽을 정리해야 한다.

## 2. 서지사항 (PAT-DET-050)

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 (A / 조건 표본) | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 문헌번호 / 문헌일 | `number` / `publicationDate` | `KR 10-2026-1000000 A` / `2026-04-06` | `bibliographic.literature_number` / `open_date` | 수집 |
| 출원번호 / 출원일 | `applicationNo` / `applicationDate` | `10-2025-1000000` / `2025-01-01` | `bibliographic.application_number` / `application_date` | 수집 |
| 공개·공고번호 / 일 | `publicationNo` / `publicationDate` | `10-2026-1000000 A` / `2026-04-06` | `bibliographic.open_number` / `publication_number`, `publication_date` | 수집 |
| 등록번호 / 등록일 | `registerNo` / `registerDate` | A: `—` / `—` · **B**: `CN 1010299973 B` / `2017-10-05` | `bibliographic.register_number` / `register_date` | 수집·조건(등록계) |
| 문헌종류 | `(docKind 파생: status)` | `공개특허공보` · **B**: `등록특허공보` | `bibliographic.document_kind` | 수집 |
| 권리상태 | `rightStatus` | `공개` · **B**: `존속 중` · **D**: `심사 중` · **E**: `등록결정(등록료 납부 전)` | `bibliographic.register_status` (+ `custom.legal_status`) | 수집 |
| 원출원번호 | `originalAppNo` | A: `—` · **B**: `20161010000099` | `bibliographic.original_application_number` | 수집·조건(분할·변경) |
| 국제출원번호 | `intlAppNo` | A: `—` · **C**: `PCT/EP2013/050052` | `bibliographic.international_application_number` | 수집·조건(PCT/국제) |
| 우선권주장일 | `priorityDate` | `2024-01-01` | `priority.priority_application_date` | 수집·조건 |
| 심사청구일 | `examRequestDate` | `2025-02-03` | `bibliographic.original_examination_request_date` | 수집 |
| 존속기간(예상)만료일 | `expirationDate` | A: `—` · **B**: `2036-04-07` (= 출원일 2016-04-07 + 20년) | **⚠파생** — 등록일 + 20년 계산(수집 컬럼 없음) | ⚠파생 |
| 권리변동(유무) | `rightChange` | `있음 (권리 양도)` · **D**: `없음` | `custom.has_ownership_change` | 수집 |
| 최종처분상태 | `finalDisposal` | `출원공개` · **B**: `설정등록` · **C**: `거절결정` · **D**: `심사청구` · **E**: `등록결정` | `bibliographic.final_disposal` | 수집 |
| 청구항 수 | `claimCount` | `10개` | `bibliographic.claim_count` (KR 보강 `KPA_BIBLIOGRAPHIC.claim_count`) | 수집 |
| 출원구분 | `applicationFlag` | `정상출원` · **B**: `분할출원` · **C**: `PCT 국내단계진입` | `bibliographic.application_flag` | 수집 |
| 번역문 제출일 | `translationSubmitDate` | A(KR): `—` · **D**: `2023-04-02` | `bibliographic.translation_submit_date` | 수집·조건(외국어) |
| 도면 수 | `drawingCount` | `5건` | `KPA_BIBLIOGRAPHIC.drawing_count` | 수집 |
| 실시권 등록일 | `licenseRegDate` | A: `—` · 등록·짝수 seq 문헌: `2018-06-06` 형태 | `custom.license_registration_date` | 수집·조건 |
| 지정국 | `designatedCountries` | A: `—` · **C**: `DE, FR, GB, IT, NL` | `DESIGNATED_COUNTRY.designated_country`(KR) · EP `DSGN.national_name` | 수집·조건(국제/EP) |
| 서열목록 | `sequenceListing` | A: `있음` · B~E: 행 미표시 | `custom.sequence_listing_yn` | 수집·조건 |
| 우선권 주장(목록) | `priorityList` | A: 블록 미표시 · **C**: `EP 20000068 · 2012-05-05` · **D**: `US 17000521 · 2021-02-02` | `priority`(priority_application_country_code · number · date) · JP `PRIR` | 수집·조건 |
| 타임라인 | `(timeline 파생)` | 아래 목업 블록 참조 | **⚠파생** — 위 일자 컬럼 조합(`client`) | ⚠파생 |

**목업 렌더 (표본 A — KR/공개)** · 2열(라벨-값) × 2쌍 테이블

```
문헌번호            KR 10-2026-1000000 A   문헌일         2026-04-06
출원번호            10-2025-1000000        출원일         2025-01-01
공개/공고번호       10-2026-1000000 A      공개/공고일    2026-04-06
등록번호            —                      등록일         —
문헌종류            공개특허공보            권리상태       공개
원출원번호          —                      국제출원번호   —
우선권주장일        2024-01-01             심사청구일     2025-02-03
존속기간(예상)만료일 —                      권리변동       있음 (권리 양도)
최종처분상태        출원공개                청구항 수      10개
출원구분            정상출원                번역문 제출일  —
도면 수             5건                     실시권 등록일  —
지정국              —                      서열목록       있음     ← 둘 중 하나라도 있을 때만 행 렌더

타임라인
 ●───────● ───────● ───────●
 우선권주장일 출원일   심사청구일  공개/공고일
 2024-01-01 2025-01-01 2025-02-03 2026-04-06
```

**목업 렌더 (표본 B — CN/등록: 등록계 행이 채워지고 타임라인이 6칸으로 확장)**

```
등록번호            CN 1010299973 B        등록일         2017-10-05
문헌종류            등록특허공보            권리상태       존속 중
원출원번호          20161010000099         국제출원번호   —
존속기간(예상)만료일 2036-04-07             권리변동       없음
출원구분            분할출원                번역문 제출일  2017-06-04

타임라인
 ●───────●───────●───────●───────●───────●
 우선권주장일 출원일  심사청구일 공개/공고일 등록일   존속기간예상만료일
 2015-04-04 2016-04-07 2016-05-06 2017-07-09 2017-10-05 2036-04-07
```

**목업 렌더 (표본 C — EP: 국제출원·지정국·우선권 블록)**

```
원출원번호          —                      국제출원번호   PCT/EP2013/050052
출원구분            PCT 국내단계진입        번역문 제출일  2014-07-05
지정국              DE, FR, GB, IT, NL      서열목록       —

우선권 주장
 EP  20000068 · 2012-05-05                ← priorityList[] (국가 mono · 번호 mono · 일자)
```

> 표시 특이사항 ①: 타임라인의 점 색은 값 유무로 갈린다(값 있음=파랑, `—`=회색). 상태가 `등록`이면 등록일·존속만료가, `소멸`이면 등록일·소멸일(`terminationDate`)이 추가된다.
> 표시 특이사항 ②: 표본 B의 `원출원번호`가 `출원번호`와 같은 값으로 보인다. 목업의 원출원번호 생성 규칙이 KR 번호 형식(`-1234567`)만 변환하도록 되어 있어 CN 번호는 그대로 복사되기 때문이다. 실데이터에서는 `original_application_number`를 그대로 표시하면 된다.
> 표시 특이사항 ③: `문헌일`과 `공개/공고일`이 동일한 `publicationDate` 하나를 공유한다. 수집 컬럼은 `open_date`(문헌일)와 `publication_date`(공고일)가 분리되어 있으므로 연동 시 두 필드로 나눠야 한다.

## 3. 인명정보 (PAT-DET-060) — 출처 `related_person`(row별 `classification`)

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 (A / 조건 표본) | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 출원인 / 주소 | `applicant` / `applicantAddress` | `현대자동차주식회사` / `서울특별시 강남구 테헤란로 152` · **D**: `Waymo LLC` / `1 Innovation Way, San Jose, CA` | `related_person[APPLICANT].name` / `.address` | 수집 |
| 특허고객번호(KR) / 식별기호(JP) | `applicantCode` (`customerNo`) | 라벨 A: `특허고객번호 (KR)` → `120000000000` · **E**: `출원인식별기호 (JP)` → `120000015838` | `REP_APP.patent_customer_number` / `custom(JP).applicant_identifier` | 수집·조건(국가) |
| 대표출원인 | `repApplicant` | `현대자동차주식회사` | `REP_APP.representative_applicant_name` | 수집 |
| 발명자 / 주소 | `inventors` / `inventorAddress` | `김OO, 이OO` / `서울특별시 서초구 서초대로 396`(회색) · **D**: `A. Researcher, B. Engineer` | `related_person[INVENTOR].name` / `.address` | 수집 |
| 대리인 / 주소 | `agent` / `agentAddress` | `특허법인 다래` · **D**: `Wilson Sonsini Goodrich & Rosati` (주소는 「기타정보」에서 렌더) | `related_person[AGENT].name` / `.address` | 수집 |
| 심사관 | `examiner` | `박심사` · **D**: `J. Smith` | `related_person[EXAMINER].name` (또는 `custom.examiners`) | 수집 |

**목업 렌더 (표본 A)** · 1열(라벨-값) 테이블

```
출원인            현대자동차주식회사
출원인 주소       서울특별시 강남구 테헤란로 152
특허고객번호 (KR)  120000000000              ← 라벨이 country에 따라 (KR)/(JP)로 전환
대표출원인        현대자동차주식회사
발명자            김OO, 이OO
발명자 주소       서울특별시 서초구 서초대로 396   ← 항상 회색(확정 데이터 아님을 표시)
대리인            특허법인 다래
심사관            박심사
```

> 표시 특이사항 ①: 라벨은 `country`로 `KR`/`JP`만 분기하므로 **US·EP·CN 문헌도 `특허고객번호 (KR)` 라벨로 표시**된다(표본 D는 `특허고객번호 (KR) 120000007919`). 국가별 식별번호 체계가 다르므로 연동 시 라벨 분기를 국가 전체로 확장해야 한다.
> 표시 특이사항 ②: 값은 `applicantCode` 하나만 사용하며, 별도로 존재하는 `customerNo`(KR만 채워지고 그 외 `'-'`) 필드는 **현재 화면에서 쓰이지 않는다**. 연동 시 어느 쪽을 정본으로 할지 결정 필요.
> 표시 특이사항 ③: `발명자 주소`는 값이 없으면 `(예시) 동일 — 출원인 주소` 플레이스홀더가 나오고, 값이 있어도 항상 회색으로 렌더된다.

## 4. 요약 · 상세설명 · 청구범위 (PAT-DET-070/080/090)

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 (A) | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 요약 | `abstract` | `라이다 포인트 클라우드를 딥러닝으로 처리하여 보행자·차량·장애물을 실시간 감지·분류하는 장치 및 방법. 본 발명에 따른 객체 감지 장치는 …(약 300자, 회색 박스 전문 표시)` | `abstract.abstract` (JP/CP 영문요약 `e_abstract`) | 수집(현재 목업) |
| 상세설명(본문) | `description` | `[기술분야] 【0001】 본 발명은 자율주행 차량용 라이다 기반 객체 감지에 관한 것으로 …` (문단 번호 【0001】~【0023】, 개행 유지) | `specification.specification` (KIPRIS는 전문 PDF URL) | 수집·⚠목업 |
| 상세설명 하위섹션(기술분야·배경·과제·해결수단·효과·구체적내용) | `aiPurpose`·`aiSolution`·`aiEffect` 등 | 과제: `주변 환경 인식 정확도와 실시간 처리 속도를 동시에 향상한다.` / 해결수단: `지면 분리와 딥러닝 인식을 2단계로 처리한다.` / 효과: `야간·악천후에서 카메라 단독 대비 18% 인식률 향상.` | **⚠파생** — `specification` 파싱(구조 분해 규칙 정의 필요) | ⚠파생 |
| 도면의 설명 | `figures[].desc` | `FIG 1 객체 감지 장치의 전체 구성도` … `FIG 5 성능 비교 그래프` | **⚠파생** — `specification` 파싱 | ⚠파생 |
| 청구범위(전체) | `claims` | 10개 항(`claims[0..9]`), 독립항 2개(제1·8항)·종속항 8개 | `claim.claim` | 수집·⚠목업 |
| 대표청구항 · 독립/종속 구조 | `repClaim` / `claims[].dependsOn` | `dependsOn`이 없으면 독립항, 있으면 `제2항 → 제1항 인용` | **⚠파생** 구조 분해 (대표청구항 번호 `KPA_BIBLIOGRAPHIC.representation_claim_number`) | ⚠파생 |

**목업 렌더 — 상세설명 (표본 A)** · 회색 박스 안 6개 하위섹션

```
기술분야
 본 발명은 자율주행 차량용 라이다 기반 객체 감지에 관한 것으로, 해당 기술분야의 장치 및 방법에 관한 것이다.
                                              ↑ 현재 컴포넌트 내 고정 문장 + data.title 삽입
배경기술
 종래 기술은 정확도와 견고성 측면에서 한계가 있었으며, 다양한 환경 조건에서 안정적인 성능을 확보하기 어려웠다.
                                              ↑ 현재 완전 고정 문장(데이터 미연동)
해결하려는 과제      ← data.aiPurpose 있을 때만
 주변 환경 인식 정확도와 실시간 처리 속도를 동시에 향상한다.
과제의 해결 수단     ← data.aiSolution
 지면 분리와 딥러닝 인식을 2단계로 처리한다.
발명의 효과          ← data.aiEffect
 야간·악천후에서 카메라 단독 대비 18% 인식률 향상.
도면의 설명          ← figures[] 있을 때만
 FIG 1  객체 감지 장치의 전체 구성도
 FIG 2  주요 동작 흐름도
 FIG 3  핵심 구성요소의 상세 구조
 FIG 4  실시예 적용 예시
 FIG 5  성능 비교 그래프
발명의 구체적인 내용  ← data.description (없으면 "(데모) …" 안내문)
 [기술분야]
 【0001】 본 발명은 자율주행 차량용 라이다 기반 객체 감지에 관한 것으로, 보다 상세하게는 …
 …
 【0023】 이상에서 본 발명의 실시예에 대하여 상세하게 설명하였지만, …
```

> 표시 특이사항: `기술분야`·`배경기술` 2개 하위섹션은 **수집 데이터가 아니라 컴포넌트에 하드코딩된 문장**이다(`기술분야`만 `title`을 끼워 넣음). 나머지 4개는 데이터 기반. 연동 시 `specification` 파싱 결과로 6개 모두를 채워야 한다.

**목업 렌더 — 청구범위 (표본 A)** · `[독립항] [전체청구항]` 토글, 기본값 = 독립항

```
[독립항]  전체청구항                          ← 독립항 = dependsOn 없는 항만

독립항 — 제1항
 라이다 센서로부터 3차원 포인트 클라우드를 획득하는 데이터 수집부; 상기 포인트 클라우드의
 노이즈를 제거하는 전처리부; 및 딥러닝 모델로 객체를 분류하는 인식부를 포함하는, 객체 감지 장치.
                                              ↑ 파란 박스 + 좌측 굵은 파란 보더, "제1항." 접두는 제거

독립항 — 제8항
 제1 데이터를 획득하는 단계; 상기 제1 데이터를 전처리하는 단계; 및 전처리된 데이터로부터
 결과를 산출하는 단계를 포함하는, 객체 감지 장치의 동작 방법.

── [전체청구항] 전환 시 위 2개 사이에 종속항이 순서대로 삽입 ──
종속항 (제2항 → 제1항 인용) 제1항에 있어서, 상기 인식부는 PointNet++ 구조를 …
종속항 (제3항 → 제1항 인용) 제1항에 있어서, 상기 전처리부는 RANSAC 기반 지면 분리를 …
종속항 (제4항 → 제2항 인용) 제2항에 있어서, 상기 데이터 수집부는 복수의 라이다를 …
                                              ↑ 회색 박스 + 좌측 회색 보더
```

## 5. 패밀리 정보 (PAT-DET-100)

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 국가별 건수 | `family` | A(`family=1`): 탭 `전체(1) KR(1)` + 알약 `KR 1건` · **B**(`family=4`): 탭 `전체(4) KR(1) US(1) JP(1) CN(1)` | `custom.family_document_count` / `family_country_count` | 수집 |
| 패밀리 문헌(국가·번호·일자·명칭) | `familyList` | A: `KR  KR 10-2026-1000000 A  2026-01-03  자율주행 차량용 라이다 기반 객체 감지` (1건) · **B**: 4건(CN·EP·KR·US) | `family`(family_country_code · family_literature_number · application_date · invention_title) | 수집 |

**목업 렌더 (표본 B — CN/등록, `family=4`)**

```
[전체(4)]  KR(1)  US(1)  JP(1)  CN(1)         ← 탭: family 건수를 KR→US→JP→CN→EP 순 1건씩 배분(파생)
 (KR 1건) (US 1건) (JP 1건) (CN 1건)          ← 파란 알약

패밀리 문헌
 CN  CN 1012099811 A   2017-04-06  자율주행 차량용 라이다 기반 객체 감지
 EP  EP 3008822 A1     2016-05-07  자율주행 차량용 라이다 기반 객체 감지
 KR  KR 10-2015-1309511 A 2015-06-08 자율주행 차량용 라이다 기반 객체 감지
 US  US 11190056 B2    2017-07-09  자율주행 차량용 라이다 기반 객체 감지
                                              ↑ 명칭은 1행 truncate
```

> 표시 특이사항: 상단 탭·알약은 `family`(총 건수) 하나를 국가 순서대로 **1건씩 기계적으로 배분한 파생 목업**이고, 하단 목록은 `familyList`의 실제 국가다. 그래서 표본 B에서는 `EP` 문헌이 목록에 있는데 **`EP` 탭은 없다**(전체 탭에서만 보임). 연동 시 국가별 건수는 `familyList`를 `group by country`로 집계해야 한다.

## 6. 인용·피인용 (PAT-DET-110)

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 (A) | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 인용 / 피인용(특허) | `citingList` / `citedList` | 헤더 `인용 (4건)` / `피인용 (2건)`, 항목 `KR 10-2023-1004513 · 자율주행 차량용 라이다 기반 객체 감지 관련 선행기술` | KR `KPA_CITATION`(citation_literature_number · country_code) · JP/US `CTLTR` | 수집·⚠목업 |
| 비특허 인용 | `citingList`(kind=npl) | `[NPL] LiDAR-Based Object Detection for Autonomous Driving: A Review, IEEE/Elsevier, 2025` | US `CTLTR_ETC.other_citations` · `PRIOR_TECHNOLOGY_DOCUMENT.non_patent_reference_text` | 수집 |
| 선행기술문헌 | `priorArtDocs` | `선행기술문헌 (1건)` · `KR KR 10-2023-1000000 A` | `PRIOR_TECHNOLOGY_DOCUMENT`(prior_technology_document_number · country) | 수집·조건 |

**목업 렌더 (표본 A)** · 회색 박스 2개(인용/피인용) + 선행기술문헌 박스

```
인용 (4건)                                    ← citingList.length (없으면 citing 카운트)
 특허 정보
  · KR 10-2023-1004513 · 자율주행 차량용 라이다 기반 객체 감지 관련 선행기술
  · KR 10-2023-1009026 · 라이다 객체 종래 구조
  · US 9000000 B2 · Prior art on lidar-based object detection for autonomous driving
 비특허(논문) 정보
  · [NPL] LiDAR-Based Object Detection for Autonomous Driving: A Review, IEEE/Elsevier, 2025

피인용 (2건)
 특허 정보
  · KR 10-2023-1040617 · 자율주행 차량용 라이다 기반 객체 감지 후속 개량 발명
 비특허(논문) 정보
  · [NPL] Follow-up study citing this work, 2027
                                              ← 어느 한쪽이 비면 그 자리에 "없음"(회색)

선행기술문헌 (1건)
 · KR KR 10-2023-1000000 A                    ← {country} {number} 연결
```

> 표시 특이사항: 선행기술문헌은 `country`와 `number`를 그대로 이어 붙여 목업에서는 국가 코드가 두 번 보인다(제목 영역과 같은 원인). `citing`/`cited` 스칼라는 목록이 비었을 때의 **대체 카운트**로만 쓰인다.

## 7. 분류코드 (PAT-DET-120)

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 (A / 조건 표본) | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| IPC | `ipc` / `ipcList` | `G01S 17/93  ·  G01S10/10  ·  H04L 9/10` | `ipc.ipc_number` (KR `KPA_IPC.ipc_code`) | 수집 |
| CPC | `cpc` / `cpcList` | A: `G06V 20/56  ·  G06V2200/10` · **E**(JP): `—`(미수집) | `CPC.cpc_code` (JP/EP `custom.cpc_code`) | 수집 |
| JP FI / F-term / 테마 | `countryClassifications` | **E**: `FI G01S,302` / `F-term 5B002AA2` / `테마 5B002` | `FI.fi_code` / `FTERM.fterm_code` / `TEMA.tema_code` | 수집·조건(JP) |
| US UPC | `countryClassifications` | **D**: `UPC 301/101` | `UPC.upc_code` | 수집·조건(US) |
| EP EPC | `countryClassifications` | **C**: `EPC G01S14/04` | `EPC.epc_code` | 수집·조건(EP) |

**목업 렌더 (표본 E — JP: CPC 미수집 + 국가 고유 분류 3종)**

```
IPC       G01S 17/93  ·  G01S12/12  ·  H04L 11/12     ← ipcList 우선, 없으면 ipc 단건
CPC       —                                            ← cpcList=[] & cpc='-' → em dash
FI        G01S,302                                     ← countryClassifications[] 를 label별 1행씩
F-term    5B002AA2
테마      5B002
```

## 8. 기타정보 (PAT-DET-130) — 있는 항목만 조건부 렌더

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 (표본) | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 대리인 주소 | `agentAddress` | A: `서울특별시 강남구 테헤란로 152` · **D**: `650 Page Mill Rd, Palo Alto, CA` | `related_person[AGENT].address` | 수집 |
| 권리변동 이력 | `rightChangeList` | **B**: `2018-04-04 │ 百度在线网络技术有限公司 → OO기술지주(주) │ 권리 양도` | `RIGHT_CHANGE`(change_type · name · change_date) | 수집·조건 |
| 권리이전 이력 | `rightTransferList` | **B**: `2018-04-04 │ 권리이전등록신청서 (百度在线网络技术有限公司 → OO기술지주(주)) │ CN 1010299973 B` | `RIGHT_TRANSFER`(document_name · change_before/after_content · registration_number/date) | 수집·조건 |
| 행정처리(수발신) | `adminProcess` | A: `2025-01-01 출원서 수리` · **B**: 3건(출원서 수리 / 의견제출통지서 발송 / 등록결정서 발송) | `ADMINISTRATIVE_PROCESS`(receipt_send_document_name · date · proc_status) | 수집·조건 |
| 국가 R&D | `rnd` | A: `자율주행 차량용 라이다 기반 객체 감지 원천기술 개발 (2025-000000)` / `산업통상자원부 · 차세대 핵심기술개발사업 · 현대자동차주식회사 · 2024.03 ~ 2026.02` | `RND`(rnd_task_name · number · department · managing_institute · duration) | 수집·조건(KR) |
| 표준특허 | `standard` | A: `3GPP` / `TS 38.300` / `자율주행 차량용 라이다 기반 객체 감지 표준` / `현대자동차주식회사` / `2026-01-01` | `STANDARD`(standardization_organization · standard_numbers · technology_name · declarants · date) | 수집·조건 |
| 심판(유무) | `trial` | A: `무효심판 계속 중 (2026당0000)` · B~E: `심판 없음` → 블록 미표시 | `custom.has_trial` | 수집 |
| US 관련출원 | `usRelatedApps` | **D**: `US 9000013 │ 2021-02-02 │ Continuation │ Granted` | `REL_APPL`(registration_number · date · classification · status) | 수집·조건(US) |
| US 가출원 | `usProvisional` | **D**: `US 2021/600007` | `CUSTOM(US).provisional_application_numbers` | 수집·조건(US) |
| JP 공보판 / 대리인 구분 | `jpEdition` / `agentCategory` | **E**: `공개특허공보(A)` / `弁理士` | `CUSTOM(JP).edition` / `agent_category` | 수집·조건(JP) |
| EP 정리번호 / 출원·공개 언어 | `epFileRef` / `epFilingLanguage` | **C**: `P000068EP` / `en` | `CUSTOM(EP).applicant_file_reference` / `filing_language` | 수집·조건(EP) |

**목업 렌더 (표본 A — KR/공개: R&D·표준특허·심판이 채워지는 케이스)**

```
대리인 주소   서울특별시 강남구 테헤란로 152

행정처리(수발신) 이력
 2025-01-01   출원서                                    수리

국가 R&D 정보
 자율주행 차량용 라이다 기반 객체 감지 원천기술 개발 (2025-000000)
 산업통상자원부 · 차세대 핵심기술개발사업 · 현대자동차주식회사 · 2024.03 ~ 2026.02

표준특허
 표준화기구    3GPP
 표준번호      TS 38.300
 표준기술명    자율주행 차량용 라이다 기반 객체 감지 표준
 선언(등재)자  현대자동차주식회사
 선언일        2026-01-01

심판 정보
 심판          무효심판 계속 중 (2026당0000)             ← trial === '심판 없음' 이면 블록 전체 미표시
```

**목업 렌더 (표본 B — CN/등록: 권리 이력이 채워지는 케이스)**

```
권리변동 이력
 2018-04-04   百度在线网络技术有限公司 → OO기술지주(주)          권리 양도

권리이전 이력
 2018-04-04   권리이전등록신청서 (百度在线网络技术有限公司 → OO기술지주(주))   CN 1010299973 B

행정처리(수발신) 이력
 2016-04-07   출원서                                    수리
 2017-08-04   의견제출통지서                             발송
 2017-10-05   등록결정서                                 발송
```

**목업 렌더 (표본 D·C — 국가별 추가정보 블록)**

```
국가별 추가정보                                ← 6개 필드 중 하나라도 있을 때만 블록 렌더
 가출원 번호(US)      US 2021/600007            (표본 D)
 관련출원(US)
  US 9000013   2021-02-02   Continuation   Granted
 ─────────────────────────────────────────
 출원인 정리번호(EP)  P000068EP                 (표본 C)
 출원/공개 언어(EP)   en
 ─────────────────────────────────────────
 공보판(JP)          공개특허공보(A)            (표본 E)
 대리인 구분(JP)      弁理士
```

## 9. 도면 (PAT-DET-140)

> **도면은 수집 대상이다.** 원본 명세서에 `patent_image`(KR·US·EP·JP·CN 전 엔티티, "특허 이미지(도면) 저장 키 참조") · `custom.drawing_url`/`primary_drawing_url`(KR·CN, "도면 링크"/"대표도면 링크") · `KPA_BIBLIOGRAPHIC.drawing_count`/`drawing_area_count`/`representation_image_source_status_code` · `custom(JP).figures`("도면 figure 목록")가 모두 존재한다. 이미지 바이너리는 DB가 아니라 **S3에 있고 DB는 키(`scrape_site` + `key_name`)만 보관**한다. 이 섹션의 `⚠목업`은 **UI가 아직 절차 생성 SVG를 그린다**는 뜻이며, 미수집을 의미하지 않는다.

| UI 항목 | 렌더 필드 `data.*` | 렌더 예시 (A) | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|---|
| 도면 이미지 | `figures` | `도면 (5)` — `FIG 1`~`FIG 5`, 이미지는 `index % 4` 규칙의 절차 생성 SVG(블록도·흐름도·적층구조·그래프) | `patent_image`(scrape_site · key_name → S3 경로, 둘 다 NOT NULL) · `custom.drawing_url`(KR·CN) · JP `custom.figures`(도면 figure 목록) | 수집·⚠목업(현재 절차 SVG) |
| 대표도면 | `figures[0]` | `대표` 배지 + `FIG 1 객체 감지 장치의 전체 구성도` | `custom.primary_drawing_url`(KR·CN) | 수집·⚠목업 |
| 도면 라벨(`FIG n`) | `figures[].label` | `FIG 1` … `FIG 5` | JP `custom.figures`(목록 내 항목) · 그 외 국가는 `patent_image.key_name` 순서 파생 | 수집·조건 |
| 도면 부호의 설명 | `refSigns` | `100 객체 감지 장치` / `110 데이터 수집부` / `120 전처리부` / `130 인식부` | **⚠파생** — `specification` 파싱(전용 컬럼 없음) | ⚠파생 |
| (UI 미노출) 도면 영역 수 | — | — | `KPA_BIBLIOGRAPHIC.drawing_area_count` | 수집·미노출 |
| (UI 미노출) 대표도면 출처 상태 | — | — | `KPA_BIBLIOGRAPHIC.representation_image_source_status_code` | 수집·미노출 |

**목업 렌더 (표본 A)** · 전체보기=우측 rail, 오버레이 드로어=본문 상단

```
도면 (5)                                       ← figures.length
┌──────────────────────────────────────┐
│ [대표] FIG 1  객체 감지 장치의 전체 구성도  ⤢ 확대 │  ← selected===0 일 때만 [대표] 배지
│           (선택 도면 크게 — 클릭 시 확대 모달)     │
└──────────────────────────────────────┘
대표도면
 ┌─────────┐
 │[대표] 썸네일 │  FIG 1                        ← 폭 1/2, 선택 시 파란 링
 └─────────┘
그 외 도면 (4)                                 ← figures.length - 1
 [FIG 2] [FIG 3] [FIG 4]                       ← 3열 그리드
 [FIG 5]

도면 주요 부분에 대한 부호의 설명
 100   객체 감지 장치
 110   데이터 수집부
 120   전처리부
 130   인식부
```

> 표시 특이사항: 확대 모달은 휠 확대/축소(50~500%)·드래그 이동·`←/→` 도면 이동·`+/-/0` 줌·`Esc` 닫기를 지원하며, 하단에 전체 도면 썸네일 스트립과 `n / 5` 카운터가 표시된다. `figures`가 비면 패널 전체가 `도면 없음`(아이콘+문구)으로 대체된다.

---

## 10. 요약 통계 및 잔여 과제

- **UI 렌더 필드 전수 대조 결과**: 근거 없는 항목 **0건**. 전부 (a) 수집 컬럼 매핑 또는 (b) 문서화된 계산·파싱 파생(`⚠파생` 6개: 존속만료·타임라인·상세설명 하위섹션·도면의 설명·대표청구항 구조·도면 부호설명).
- **제외 확정(수집 컬럼 없음)**: `grade`(특허평가)·`dispute`(소송/분쟁) — 명세서에 컬럼 부재로 UI에서 삭제 완료. (심판 `trial`은 `custom.has_trial`로 수집되어 유지)
- **잔여 과제(정방향 — 수집엔 있으나 UI 미반영/목업)**:
  - **P1**: 실 도면 이미지 연동 — 컬럼은 전부 수집됨(`patent_image.scrape_site`+`key_name` → S3 · `custom.drawing_url` · `custom.primary_drawing_url` · JP `custom.figures`). UI가 절차 SVG를 쓰고 있고 `imageUrl` 필드가 미도입인 것이 유일한 격차. **S3 키 → 접근 URL 변환(서명 URL 여부)** 이 연동 시 결정 사항.
  - **P1(목업→실)**: `specification`(원문/PDF)·`claim`(청구항 원문)·인용(`KPA_CITATION`/`CTLTR`) 실데이터 연동.
  - **P3**: 기술이전/도입 희망(`technology_transference`) · KPA_IPC 상세(`ipc_version`/`level`) · 도면 부가정보(`drawing_area_count`·`representation_image_source_status_code`) — 미노출.
- **소스 노출 방식(연동 시 결정)**: 위 컬럼은 수집 DB에 존재하나, 상세페이지로 전달할 **검색 hit `columns` 패스스루 vs 상세 조회 API**는 미설계.

### 10-1. 렌더 예시 대조에서 드러난 정리 필요 항목 (연동 전 확인)

목업 값과 실제 렌더 결과를 맞춰보며 확인된, **매핑은 맞지만 표시 로직을 손봐야 하는** 항목이다. 수집 필드 누락 이슈는 아니다.

| # | 위치 | 현상 (목업 렌더) | 연동 시 조치 |
|---|---|---|---|
| 1 | 제목 영역 · 선행기술문헌 | `country` + `number`를 이어 붙여 `KR  KR 10-2026-1000000 A`처럼 국가 코드 중복 | `literature_number`의 국가 접두 포함 여부 확인 후 한쪽 제거 |
| 2 | 서지 · 문헌일/공개공고일 | 두 칸이 같은 `publicationDate` 하나를 공유 | `open_date`(문헌일)와 `publication_date`(공고일)로 분리 |
| 3 | 인명 · 특허고객번호 | 라벨이 KR/JP만 분기 → US·EP·CN도 `특허고객번호 (KR)`로 표시. 값은 `applicantCode`만 사용하고 `customerNo`는 미사용 | 라벨 국가 분기 확장 + 식별번호 정본 필드 확정 |
| 4 | 패밀리 · 국가별 건수 | 탭·알약이 `family` 총건수를 KR→EP 순 1건씩 배분한 파생값이라 `familyList`의 실제 국가와 불일치(표본 B: EP 문헌은 있으나 EP 탭 없음) | `familyList`를 `group by country`로 집계 |
| 5 | 상세설명 · 기술분야/배경기술 | 컴포넌트에 하드코딩된 고정 문장(기술분야만 `title` 삽입) | `specification` 파싱 결과로 6개 하위섹션 전체 치환 |
| 6 | 서지 · 원출원번호 | 목업 생성 규칙이 KR 번호 형식만 변환해 CN(표본 B)은 출원번호와 동일한 값으로 보임 | 실데이터 `original_application_number` 직결(목업 한정 이슈) |

---

## 11. UI에서 바로 확인하기 — 「수집필드 모드」

이 문서의 매핑을 **목업 화면 위에서 직접** 확인할 수 있다. 좌하단 `명세 모드` 옆의 **`수집필드`** 토글을 켜면 특허 상세페이지의 각 표시값 아래에 수집 DB 컬럼(`테이블.컬럼`)이 뱃지로 붙는다.

- **켜는 곳**: 검색 결과 오버레이 상세, 그리고 전체보기(새 탭) 상세 — 두 경로 모두 좌하단 토글. 명세 모드와 **독립 토글**이라 동시에 켤 수 있다.
- **뱃지 색 규칙**
  - 남색(indigo) = **수집 컬럼 직결**. 값이 `—`여도 뱃지는 보이므로 "수집되나 이 문헌엔 값 없음"과 "미수집"을 화면에서 구분할 수 있다.
  - 호박색(amber, `⚠` 접두) = **계산·파싱 파생 / 목업 / 미정**. 예: `⚠파생 · 등록일 + 20년(수집 컬럼 없음)`, `⚠목업(절차 SVG) · patent_image.…`, `⚠미정 · 원문 PDF URL 컬럼 확인 필요`.
- **구현**: 표시값 요소에 `data-col="<테이블.컬럼>"` 속성을 부착하고, `body.field-mode [data-col]::after`가 CSS로 렌더한다(React 상태와 무관 → 레이아웃 부담 없음).
  - 토글: [SpecOverlay.tsx](../src/features/spec-overlay/SpecOverlay.tsx) · 스타일: [index.css](../src/index.css) `수집필드 모드` 블록 · 부착 지점: [PatentDetail.tsx](../src/components/PatentDetail.tsx)(`BibRow`/`InfoRow`/`Row`의 `col`·`col2` prop, 목록·블록 컨테이너의 `data-col`)
  - 현재 상세페이지에 부착된 `data-col` 지점 **68개**(표본 A 기준 렌더 수).
- **유지 규칙**: `data-col` 값이 이 문서의 「수집 컬럼 · 테이블」 열의 정본이다. **한쪽만 고치지 말고 문서와 코드를 함께 갱신**한다.

```
공개 · KR  KR 10-2026-1000000 A
⟨bibliographic.register_status⟩ ⟨bibliographic.country_code⟩ ⟨bibliographic.literature_number⟩

문헌종류   공개특허공보                    권리상태  공개
           ⚠현재 status 파생 ·                      bibliographic.register_status
           bibliographic.document_kind              + custom.legal_status
존속기간   —                               권리변동  있음 (권리 양도)
(예상)만료일 ⚠파생 · 등록일 + 20년(수집 컬럼 없음)     custom.has_ownership_change
```
