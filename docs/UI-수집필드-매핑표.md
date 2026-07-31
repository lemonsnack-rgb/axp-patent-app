# 특허 상세페이지 UI 항목 ↔ 수집 DB 필드 매핑표

- **목적**: 특허 검색결과 **상세페이지**에 표시되는 각 UI 항목을 **수집 DB 컬럼**과 1:1로 매핑한다. 개발자가 이 표만 보고 **화면의 어느 자리에 무엇이 어떤 형태로 보이는지**, 그 값을 **어느 테이블·컬럼에서 가져와야 하는지**를 알 수 있게 한다.
- **표의 형식은 「UI 명칭 → 예시 → 수집 필드」 3열로 고정한다.** 목업이 내부적으로 쓰는 필드명·변수명은 **실제 개발에서 사용되지 않으므로 표기하지 않는다.** 계약은 어디까지나 *화면에 보이는 항목*과 *수집 컬럼*이다.
- **출처(정본)**: `[BLK] 특허 수집 데이터베이스 명세서`(원본 33p·254 컬럼 — KR 카탈로그 중심 + US/EP/JP 엔티티). 매핑은 `docs/기능정의서.md`「특허 · 상세페이지」④와 동일하며, **원본 명세서 컬럼 존재를 전수 확인**했다.
- **검증 결과(역방향)**: 과거 **특허평가·소송/분쟁**은 컬럼 부재로 UI에서 삭제했고, **2026-07-31 조각 단위 재대조**에서 **인용·피인용 문헌의 '명칭'** 1건이 추가로 적발되어 **UI에서 제거**했다(§6·§12). 그 외 표시 조각은 전부 수집 컬럼 또는 문서화된 `⚠파생`이다.
  - 1차 대조가 이 항목을 놓친 이유: 검증 단위가 **필드(행)** 였다. 목록 필드는 `citingList → KPA_CITATION` 매핑이 성립하면 통과했고, **목록 원소 내부 조각(번호/명칭)까지 컬럼 존재를 확인하지 않았다.** 토큰 기계 대조도 *문서에 적힌 컬럼이 명세서에 있는지*(정방향)만 보므로 **어느 컬럼도 적히지 않은 조각**은 원리적으로 검출되지 않는다. → **§12 조각별 매핑**을 정본으로 두어 재발을 막는다.
- **수집 필드 열의 표기**: 컬럼명만 적힌 것은 **수집 컬럼 직결** · `⚠파생`=수집값에서 계산/파싱(컬럼 아님) · `⚠목업`=컬럼은 수집되나 화면이 아직 임시 데이터 · `⚠미정`=대응 컬럼 확인 필요 · `조건(…)`=특정 국가/상태에서만 렌더.
- **테이블 약칭**: `bibliographic`(서지 자연키 1행) · `custom`(국가고유 스칼라) · `KPA_*`(KR 영문보강) · `related_person`(인명, row별 classification) · `representative_applicant`(대표출원인 마스터 — 특허↔대표출원인은 `patent_representative_applicant` N:M 매핑) · US/EP/JP/CN은 국가별 고유 테이블.
- **대조 방식**
  - *2026-07-28(정방향)*: 화면에 부착한 컬럼·테이블 토큰 **112개**를 명세서 PDF 추출 텍스트와 기계 대조 → 명세서에 없는 토큰 **0건**.
  - *2026-07-31(역방향·조각 단위)*: 화면에 표시되는 **복합 값을 조각으로 분해**해 조각마다 대응 컬럼을 명세서 원문 컬럼 목록과 1:1 확인(§12). 축약 표기(`RND(… · number · department …)`)를 **실제 컬럼명**으로 전부 교체했다.
- **예시 열**: 「0. 예시 표본」의 값을 그대로 인용한다. 기본은 **표본 A(KR/공개)** 이고, 국가·상태 조건 항목은 해당 표본 기호(**B~E**)를 함께 표기한다.

---

## 0. 예시 표본 (예시 값의 출처)

목업 데이터는 결정적(deterministic)으로 생성되므로 아래 표본은 항상 동일한 값으로 재현된다. 국가·권리상태별 조건부 렌더를 모두 덮도록 5건을 선정했다.

| 기호 | 문헌번호 | 국가/상태 | 발명의 명칭 / 출원인 | 이 표본으로 확인할 조건 |
|---|---|---|---|---|
| **A** | `KR 10-2026-1000000 A` | KR / 공개 | 자율주행 차량용 라이다 기반 객체 감지 / 현대자동차주식회사 | KR 기본형(미등록) · 특허고객번호 · 국가 R&D · 표준특허 · 심판 · 서열목록 |
| **B** | `CN 1010299973 A` | CN / 등록 | 자율주행 차량용 라이다 기반 객체 감지 및 그 제조 방법 / 百度在线网络技术有限公司 | 등록계 항목(등록번호·등록일·존속만료) · 권리변동/권리이전 이력 · 분할출원 |
| **C** | `EP 3001604 A1` | EP / 거절 | LiDAR-Based Object Detection… / Robert Bosch GmbH | PCT·국제출원번호 · 지정국 · 우선권 주장 목록 · EPC · EP 고유항목 |
| **D** | `US 11007919 B2` | US / 심사중 | LiDAR-Based Object Detection… (Method) / Waymo LLC | UPC · US 관련출원·가출원 · 영문 문헌(요약/발명자/심사관) |
| **E** | `JP 2020-010074 A` | JP / 등록예정 | 자율주행 차량용 라이다 기반 객체 감지 및 그 동작 방법 / トヨタ自動車株式会社 | FI/F-term/테마 · JP 공보판·대리인 구분 · CPC 미수집(`—`) |

표본 A는 검색 결과의 첫 문헌이다. 목업에서 B~E를 찾으려면 **국가 패싯**(CN/EP/US/JP)으로 좁힌 뒤 위 문헌번호로 확인하면 된다.

**표기·포맷 규칙(전 섹션 공통)** — 값이 화면 문자열로 바뀌는 규칙. 실데이터 연동 시에도 동일하게 유지한다.

| 규칙 | 처리 | 예 |
|---|---|---|
| 빈값 대체 | 값 없음 → `—`(em dash) | 번역문 제출일(KR) → `—` |
| 하이픈 정규화 | 원본이 `-`로 채워진 값도 `—`로 치환 | 등록번호 `-` → `—` |
| 단위 접미 | 청구항 수 → `N개`, 도면 수·패밀리 → `N건` | `10개` / `6건` |
| 배열 결합 | 분류코드 = `'  ·  '`(공백2+중점+공백2), 지정국 = `', '` | `G01S 17/93  ·  G01S10/10` |
| 유무(Y/N) | 있음 → `있음`, 없음 → `—` | 서열목록 `있음` |
| 조건부 행 숨김 | 값이 없으면 **행·블록 자체를 렌더하지 않음**(빈 `—` 행도 안 남김) | 권리변동 이력, 국가 R&D, 표준특허 등 |
| 흐린 글씨(muted) | 미확정·플레이스홀더는 회색 | 발명자 주소, 대리인 미상 |
| 고정폭(mono) | 번호·코드·일자 계열 | 문헌번호·출원번호·IPC |

---

## 1. 제목 영역 (PAT-DET-020)

| UI 명칭 | 예시 | 수집 필드 |
|---|---|---|
| 권리상태(평문) | `공개` (hover 툴팁: `공개 — 출원이 공개된 상태(심사 전/중, 권리 미발생)`) | `bibliographic.register_status` (+ `custom.legal_status`) |
| 국가 | `KR` | `bibliographic.country_code` |
| 문헌번호 | `KR 10-2026-1000000 A` | `bibliographic.literature_number` |
| 발명의 명칭 | `자율주행 차량용 라이다 기반 객체 감지` · **D**: `LiDAR-Based Object Detection for Autonomous Driving (Method)` | `bibliographic.invention_title` (+ `_eng`) |
| 원문 PDF 다운로드 | 버튼 `원문 PDF 다운로드` → 클릭 시 `KR 10-2026-1000000 A.pdf` 즉시 저장(현재는 데모 표지 1p, 비ASCII는 `?` 치환) | `⚠미정` — 원문 PDF URL 컬럼 확인 필요 |

**목업 렌더 (표본 A)**

```
공개 · KR  KR 10-2026-1000000 A          ← 권리상태 · 국가 + 문헌번호(mono)
자율주행 차량용 라이다 기반 객체 감지        ← 발명의 명칭 (2xl bold)
[ 원문 PDF 다운로드 ]                      ← primary filled 버튼
```

> 표시 특이사항: 국가와 문헌번호가 나란히 놓이는데 목업의 문헌번호 값이 이미 국가 접두를 포함해 **`KR  KR 10-…`처럼 국가 코드가 두 번** 보인다. 연동 시 `literature_number`에 국가 접두가 포함되는지 확인해 한쪽을 정리해야 한다.

## 2. 서지사항 (PAT-DET-050)

| UI 명칭 | 예시 (A / 조건 표본) | 수집 필드 |
|---|---|---|
| 문헌번호 / 문헌일 | `KR 10-2026-1000000 A` / `2026-04-06` | `bibliographic.literature_number` / `open_date` |
| 출원번호 / 출원일 | `10-2025-1000000` / `2025-01-01` | `bibliographic.application_number` / `application_date` |
| 공개·공고번호 / 공개·공고일 | `10-2026-1000000 A` / `2026-04-06` | `bibliographic.open_number` / `publication_number`, `publication_date` |
| 등록번호 / 등록일 | A: `—` / `—` · **B**: `CN 1010299973 B` / `2017-10-05` | `bibliographic.register_number` / `register_date` · 조건(등록계) |
| 문헌종류 | `공개특허공보` · **B**: `등록특허공보` | `bibliographic.document_kind` (현재 화면은 권리상태에서 파생 표시) |
| 권리상태 | `공개` · **B**: `존속 중` · **D**: `심사 중` · **E**: `등록결정(등록료 납부 전)` | `bibliographic.register_status` (+ `custom.legal_status`) |
| 원출원번호 | A: `—` · **B**: `20161010000099` | `bibliographic.original_application_number` · 조건(분할·변경) |
| 국제출원번호 | A: `—` · **C**: `PCT/EP2013/050052` | `bibliographic.international_application_number` · 조건(PCT/국제) |
| 우선권주장일 | `2024-01-01` | `priority.priority_application_date` · 조건 |
| 심사청구일 | `2025-02-03` | `bibliographic.original_examination_request_date` |
| 존속기간(예상)만료일 | A: `—` · **B**: `2036-04-07` (= 출원일 2016-04-07 + 20년) | `⚠파생` — 등록일 + 20년(수집 컬럼 없음) |
| 권리변동(유무) | `있음 (권리 양도)` · **D**: `없음` | `custom.has_ownership_change` |
| 최종처분상태 | `출원공개` · **B**: `설정등록` · **C**: `거절결정` · **D**: `심사청구` · **E**: `등록결정` | `bibliographic.final_disposal` |
| 청구항 수 | `10개` | `bibliographic.claim_count` (KR 보강 `KPA_BIBLIOGRAPHIC.claim_count`) |
| 출원구분 | `정상출원` · **B**: `분할출원` · **C**: `PCT 국내단계진입` | `bibliographic.application_flag` |
| 번역문 제출일 | A(KR): `—` · **D**: `2023-04-02` | `bibliographic.translation_submit_date` · 조건(외국어) |
| 도면 수 | `6건` | `KPA_BIBLIOGRAPHIC.drawing_count` |
| 실시권 등록일 | A: `—` · 등록계 일부: `2018-06-06` 형태 | `custom.license_registration_date` · 조건 |
| 지정국 | A: `—` · **C**: `DE, FR, GB, IT, NL` | `DESIGNATED_COUNTRY.designated_country`(KR) · EP `DSGN.national_name` · 조건(국제/EP) |
| 서열목록 | A: `있음` · B~E: 행 미표시 | `custom.sequence_listing_yn` · 조건 |
| 우선권 주장(목록) | A: 블록 미표시 · **C**: `EP 20000068 · 2012-05-05` · **D**: `US 17000521 · 2021-02-02` | `priority.priority_application_country_code` · `priority_application_number` · `priority_application_date` (JP는 `PRIR`) · 조건 · 조각별 §12 |
| 타임라인 | 아래 목업 블록 참조 | `⚠파생` — 위 일자 컬럼 조합(화면 계산) |

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
도면 수             6건                     실시권 등록일  —
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
 EP  20000068 · 2012-05-05                ← 우선권 주장 목록 (국가 mono · 번호 mono · 일자)
```

> 표시 특이사항 ①: 타임라인 점 색은 값 유무로 갈린다(값 있음=파랑, `—`=회색). 권리상태가 `등록`이면 **등록일·존속만료**가, `소멸`이면 **등록일·소멸일**이 추가돼 6칸이 된다.
> 표시 특이사항 ②: 표본 B의 `원출원번호`가 `출원번호`와 같은 값으로 보인다. 목업의 값 생성 규칙이 KR 번호 형식만 변환하기 때문이며, 연동 시에는 `original_application_number`를 그대로 표시하면 된다.
> 표시 특이사항 ③: 목업에서 `문헌일`과 `공개/공고일`이 같은 값으로 나온다. 수집 컬럼은 `open_date`(문헌일)와 `publication_date`(공고일)가 **분리되어 있으므로 연동 시 두 컬럼으로 나눠 표시**해야 한다.

## 3. 인명정보 (PAT-DET-060) — 출처 `related_person`(row별 `classification`)

| UI 명칭 | 예시 (A / 조건 표본) | 수집 필드 |
|---|---|---|
| 출원인 / 출원인 주소 | `현대자동차주식회사` / `서울특별시 강남구 테헤란로 152` · **D**: `Waymo LLC` / `1 Innovation Way, San Jose, CA` | `related_person[APPLICANT].name` / `.address` |
| 특허고객번호(KR) · 출원인식별기호(JP) | 라벨 A: `특허고객번호 (KR)` → `120000000000` · **E**: `출원인식별기호 (JP)` → `120000015838` | `representative_applicant.patent_customer_number` / `custom(JP).applicant_identifier` · 조건(국가) |
| 대표출원인 | `현대자동차주식회사` | `representative_applicant.representative_applicant_name` |
| 발명자 / 발명자 주소 | `김OO, 이OO` / `서울특별시 서초구 서초대로 396`(회색) · **D**: `A. Researcher, B. Engineer` | `related_person[INVENTOR].name` / `.address` |
| 대리인 | `특허법인 다래` · **D**: `Wilson Sonsini Goodrich & Rosati` (주소는 「기타정보」에서 표시) | `related_person[AGENT].name` |
| 심사관 | `박심사` · **D**: `J. Smith` | `related_person[EXAMINER].name` (또는 `custom.examiners`) |

**목업 렌더 (표본 A)** · 1열(라벨-값) 테이블

```
출원인            현대자동차주식회사
출원인 주소       서울특별시 강남구 테헤란로 152
특허고객번호 (KR)  120000000000              ← 라벨이 국가에 따라 (KR)/(JP)로 전환
대표출원인        현대자동차주식회사
발명자            김OO, 이OO
발명자 주소       서울특별시 서초구 서초대로 396   ← 항상 회색(확정 데이터 아님을 표시)
대리인            특허법인 다래
심사관            박심사
```

> 표시 특이사항 ①: 라벨이 `KR`/`JP`만 분기하므로 **US·EP·CN 문헌도 `특허고객번호 (KR)` 라벨로 표시**된다(표본 D는 `특허고객번호 (KR) 120000007919`). 국가별 식별번호 체계가 다르므로 연동 시 라벨 분기를 국가 전체로 확장해야 한다.
> 표시 특이사항 ②: 수집 측은 KR `representative_applicant.patent_customer_number`와 JP `custom.applicant_identifier`가 **별개 컬럼**이지만 화면은 한 자리에 표시한다. 연동 시 **국가별로 어느 컬럼을 넣을지** 확정해야 한다.
> 표시 특이사항 ③: `발명자 주소`는 값이 없으면 `(예시) 동일 — 출원인 주소` 플레이스홀더가 나오고, 값이 있어도 항상 회색으로 표시된다.

## 4. 요약 · 상세설명 · 청구범위 (PAT-DET-070/080/090)

| UI 명칭 | 예시 (A) | 수집 필드 |
|---|---|---|
| 요약 | `라이다 포인트 클라우드를 딥러닝으로 처리하여 보행자·차량·장애물을 실시간 감지·분류하는 장치 및 방법. …` (약 300자, 회색 박스에 전문) | `abstract.abstract` (mediumtext 단일 컬럼) |
| 상세설명 | `[기술분야] 【0001】 본 발명은 자율주행 차량용 라이다 기반 객체 감지에 관한 것으로 …` (【0001】~【0023】 원문 전문, 개행 유지) | `specification.specification` (mediumtext 단일 컬럼 · KIPRIS는 전문 PDF URL) |
| ~~상세설명 하위섹션~~(기술분야·배경기술·해결하려는 과제·과제의 해결 수단·발명의 효과·도면의 설명) | (표시하지 않음) | **⚠미수집 — `specification` 은 단일 mediumtext 이고 섹션별 컬럼이 없다.** 2026-07-31 **UI에서 제거 확정**(원문 1블록으로 표시) |
| 청구범위(전체) | 10개 항 — 독립항 2개(제1·8항)·종속항 8개 | `claim.claim` (mediumtext 단일 컬럼) |
| 독립항/종속항 구조 · 인용 관계 | `독립항 — 제1항` / `종속항 (제2항 → 제1항 인용)` | `⚠파생` — `claim` 원문의 `제N항`·`제N항에 있어서` 패턴 분해(대표항 번호는 `KPA_BIBLIOGRAPHIC.representation_claim_number` 수집). 2026-07-31 **유지 확정** |

**목업 렌더 — 상세설명 (표본 A)** · 회색 박스에 원문 1블록

```
상세설명
 [기술분야]
 【0001】 본 발명은 자율주행 차량용 라이다 기반 객체 감지에 관한 것으로, 보다 상세하게는 …
 [배경기술]
 【0002】 최근 라이다 및 자율주행 기술의 수요가 급격히 증가함에 따라 …
 …
 【0023】 이상에서 본 발명의 실시예에 대하여 상세하게 설명하였지만, …
                                              ↑ specification 원문 그대로(섹션 표제도 원문에 포함)
```

> 2026-07-31 이전에는 기술분야·배경기술·과제·해결수단·효과·도면의 설명 6개 하위섹션으로 쪼개 표시했으나, **수집 컬럼이 없어(단일 mediumtext) 제거**했다. 기술분야·배경기술은 화면에 하드코딩된 문장이기도 했다.

**목업 렌더 — 청구범위 (표본 A)** · `[독립항] [전체청구항]` 토글, 기본값 = 독립항

```
[독립항]  전체청구항                          ← 독립항 = 인용 관계가 없는 항만

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

| UI 명칭 | 예시 | 수집 필드 |
|---|---|---|
| 국가별 건수(탭 + 알약) | A(패밀리 1건): 탭 `전체(1) KR(1)` + 알약 `KR 1건` · **B**(패밀리 4건): 탭 `전체(4) KR(1) US(1) JP(1) CN(1)` | `custom.family_document_count` / `family_country_count` |
| 패밀리 문헌(국가·번호·일자·명칭) | A: `KR  KR 10-2026-1000000 A  2026-01-03  자율주행 차량용 라이다 기반 객체 감지` (1건) · **B**: 4건(CN·EP·KR·US) | `family.family_country_code` · `family_literature_number` · `application_date` · `invention_title` · 조각별 §12 |

**목업 렌더 (표본 B — CN/등록, 패밀리 4건)**

```
[전체(4)]  KR(1)  US(1)  JP(1)  CN(1)         ← 탭: 총건수를 KR→US→JP→CN→EP 순 1건씩 배분(파생)
 (KR 1건) (US 1건) (JP 1건) (CN 1건)          ← 파란 알약

패밀리 문헌
 CN  CN 1012099811 A   2017-04-06  자율주행 차량용 라이다 기반 객체 감지
 EP  EP 3008822 A1     2016-05-07  자율주행 차량용 라이다 기반 객체 감지
 KR  KR 10-2015-1309511 A 2015-06-08 자율주행 차량용 라이다 기반 객체 감지
 US  US 11190056 B2    2017-07-09  자율주행 차량용 라이다 기반 객체 감지
                                              ↑ 명칭은 1행 truncate
```

> 표시 특이사항: 상단 탭·알약은 **총 건수 하나를 국가 순서대로 1건씩 기계 배분한 파생 목업**이고, 하단 목록은 패밀리 문헌의 실제 국가다. 그래서 표본 B에서는 `EP` 문헌이 목록에 있는데 **`EP` 탭은 없다**(전체 탭에서만 보임). 연동 시 국가별 건수는 **패밀리 문헌을 국가로 집계(group by)** 해야 한다.

## 6. 인용·피인용 (PAT-DET-110)

| UI 명칭 | 예시 (A) | 수집 필드 |
|---|---|---|
| 인용 / 피인용 — 특허 정보 | 헤더 `인용 (4건)` / `피인용 (2건)`, 항목 `KR  10-2023-1004513 · 김OO · 2023-05-12` | KR `kpa_citation.citation_literature_country_code` · `citation_literature_number` · `citation_literature_inventor_name` · `citation_literature_publication_date` / US·JP `ctltr.citation_literature_country_code` · `registration_number` · `inventor_name` · `registration_date` · 조각별 §12 |
| 인용 / 피인용 — 비특허(논문) 정보 | `[NPL] LiDAR-Based Object Detection for Autonomous Driving: A Review, IEEE/Elsevier, 2025` | `ctltr_etc.other_citations` / `prior_technology_document.non_patent_reference_text` — **제목·저널·연도가 한 컬럼에 통째로** 들어오므로 파싱 없이 원문 그대로 표시(`[NPL]`은 화면 라벨) |
| ~~인용문헌 명칭~~ | (표시하지 않음) | **⚠미수집 — 인용 테이블에 명칭 컬럼 없음.** `kpa_citation`·`ctltr` 컬럼은 번호·국가코드·발명자명·공개(등록)일·분류뿐이다. 2026-07-31 UI에서 제거 확정 |
| 선행기술문헌 | `선행기술문헌 (1건)` · `KR KR 10-2023-1000000 A` | `prior_technology_document.prior_technology_document_country` · `prior_technology_document_number` · 조건 |

**목업 렌더 (표본 A)** · 회색 박스 2개(인용/피인용) + 선행기술문헌 박스

```
인용 (4건)                                    ← 인용 목록 건수
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
 · KR KR 10-2023-1000000 A                    ← 국가 + 문헌번호를 이어 붙임
```

> 표시 특이사항: 선행기술문헌은 국가와 문헌번호를 그대로 이어 붙여 목업에서는 국가 코드가 두 번 보인다(제목 영역과 같은 원인).

## 7. 분류코드 (PAT-DET-120)

| UI 명칭 | 예시 (A / 조건 표본) | 수집 필드 |
|---|---|---|
| IPC | `G01S 17/93  ·  G01S10/10  ·  H04L 9/10` | `ipc.ipc_number` (KR `KPA_IPC.ipc_code`) |
| CPC | A: `G06V 20/56  ·  G06V2200/10` · **E**(JP): `—`(미수집) | `CPC.cpc_code` (JP/EP `custom.cpc_code`) |
| FI / F-term / 테마 | **E**: `FI G01S,302` / `F-term 5B002AA2` / `테마 5B002` | `FI.fi_code` / `FTERM.fterm_code` / `TEMA.tema_code` · 조건(JP) |
| UPC | **D**: `UPC 301/101` | `UPC.upc_code` · 조건(US) |
| EPC | **C**: `EPC G01S14/04` | `EPC.epc_code` · 조건(EP) |

**목업 렌더 (표본 E — JP: CPC 미수집 + 국가 고유 분류 3종)**

```
IPC       G01S 17/93  ·  G01S12/12  ·  H04L 11/12     ← 다중 코드는 중점으로 결합
CPC       —                                            ← JP는 CPC 미수집 → em dash
FI        G01S,302                                     ← 국가 고유 분류는 종류별 1행씩
F-term    5B002AA2
테마      5B002
```

## 8. 기타정보 (PAT-DET-130) — 있는 항목만 조건부 렌더

| UI 명칭 | 예시 (표본) | 수집 필드 |
|---|---|---|
| 대리인 주소 | A: `서울특별시 강남구 테헤란로 152` · **D**: `650 Page Mill Rd, Palo Alto, CA` | `related_person[AGENT].address` |
| 권리변동 이력 | **B**: `2018-04-04 │ 百度在线网络技术有限公司 → OO기술지주(주) │ 권리 양도` | `right_change.change_date` · `name` · `change_type` · 조건 · 조각별 §12 |
| 권리이전 이력 | **B**: `2018-04-04 │ 권리이전등록신청서 (百度在线网络技术有限公司 → OO기술지주(주)) │ CN 1010299973 B` | `right_transfer.registration_date` · `document_name` · `change_before_content` · `change_after_content` · `registration_number` · 조건 · 조각별 §12 |
| 행정처리(수발신) 이력 | A: `2025-01-01 출원서 수리` · **B**: 3건(출원서 수리 / 의견제출통지서 발송 / 등록결정서 발송) | `administrative_process.receipt_send_date` · `receipt_send_document_name` · `proc_status` · 조건 · 조각별 §12 |
| 국가 R&D 정보 | A: `자율주행 차량용 라이다 기반 객체 감지 원천기술 개발 (2025-000000)` / `산업통상자원부 · 차세대 핵심기술개발사업 · 현대자동차주식회사 · 2024.03 ~ 2026.02` | `rnd.rnd_task_name` · `rnd_task_number` · `rnd_department_name` · **`rnd_project_name`** · `rnd_managing_institute_name` · `rnd_duration` · 조건(KR) · 조각별 §12 |
| 표준특허 | A: `3GPP` / `TS 38.300` / `자율주행 차량용 라이다 기반 객체 감지 표준` / `현대자동차주식회사` / `2026-01-01` | `standard.standardization_organization` · `standard_numbers` · `standard_technology_name` · `standard_declarants` · `standard_declaration_date` · 조건 · **⚠명세서상 「현재는 적재 골격만」(US는 소스에 표준특허 선언 정보 없음) → 필드는 있어도 값이 비어 올 수 있다** |
| 심판 정보 | A: `무효심판 계속 중 (2026당0000)` · B~E: `심판 없음` → 블록 미표시 | `custom.has_trial` |
| 관련출원(US) | **D**: `US 9000013 │ 2021-02-02 │ Continuation │ Granted` | `rel_appl.registration_number` · `registration_date` · `classification` · `status` · 조건(US) · 조각별 §12 |
| 가출원 번호(US) | **D**: `US 2021/600007` | `CUSTOM(US).provisional_application_numbers` · 조건(US) |
| 공보판(JP) / 대리인 구분(JP) | **E**: `공개특허공보(A)` / `弁理士` | `CUSTOM(JP).edition` / `agent_category` · 조건(JP) |
| 출원인 정리번호(EP) / 출원·공개 언어(EP) | **C**: `P000068EP` / `en` | `CUSTOM(EP).applicant_file_reference` / `filing_language` · 조건(EP) |

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
 심판          무효심판 계속 중 (2026당0000)             ← "심판 없음"이면 블록 전체 미표시
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

**목업 렌더 (표본 D·C·E — 국가별 추가정보 블록)**

```
국가별 추가정보                                ← 6개 항목 중 하나라도 있을 때만 블록 렌더
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

> **도면은 수집 대상이다.** 원본 명세서에 `patent_image`(KR·US·EP·JP·CN 전 엔티티, "특허 이미지(도면) 저장 키 참조") · `custom.drawing_url`/`primary_drawing_url`(KR·CN, "도면 링크"/"대표도면 링크") · `KPA_BIBLIOGRAPHIC.drawing_count`/`drawing_area_count`/`representation_image_source_status_code` · `custom(JP).figures`("도면 figure 목록")가 모두 존재한다. 이미지 바이너리는 DB가 아니라 **S3에 있고 DB는 키(`scrape_site` + `key_name`)만 보관**한다. 이 섹션의 `⚠목업`은 **화면이 아직 임시 도식을 그린다**는 뜻이며, 미수집을 의미하지 않는다.

| UI 명칭 | 예시 (A) | 수집 필드 |
|---|---|---|
| 도면 이미지 | `도면 (6)` — 현재 이미지는 임시 생성 도식(블록도·흐름도·적층구조·그래프 4종 순환) | `patent_image.scrape_site` · `key_name`(→ S3 경로, 둘 다 NOT NULL) · `custom.drawing_url`(KR·CN) · `custom(JP).figures` · `⚠목업` |
| 대표도면 | `대표` 배지 + 첫 도면 | `custom.primary_drawing_url`(KR·CN) · `⚠목업` |
| 도면 라벨 | `FIG 1` … `FIG 6` | **⚠파생 — 수집 컬럼 아님.** 이미지 **순번으로 화면에서 생성**(2026-07-31 확정) |
| ~~도면 설명(캡션)~~ | (표시하지 않음) | **⚠미수집** — `specification` 파싱 필요. 2026-07-31 **UI에서 제거 확정** |
| ~~도면 주요 부분에 대한 부호의 설명~~ | (표시하지 않음) | **⚠미수집** — 전용 컬럼 없음(`specification` 말미 파싱 필요). 2026-07-31 **UI에서 제거 확정** |
| (UI 미노출) 도면 수 · 도면 영역 수 · 대표도면 출처 상태 | — | `KPA_BIBLIOGRAPHIC.drawing_count`(서지에 표시) · `drawing_area_count` · `representation_image_source_status_code` |

**목업 렌더 (표본 A)** · 전체보기=우측 rail, 오버레이 드로어=본문 상단

```
도면 (6)                                       ← 이미지 건수
┌──────────────────────────────────────┐
│ [대표] FIG 1                      ⤢ 확대 │  ← 첫 도면 선택 시에만 [대표] 배지
│           (선택 도면 크게 — 클릭 시 확대 모달)     │
└──────────────────────────────────────┘
대표도면
 ┌─────────┐
 │[대표] 썸네일 │  FIG 1                        ← 폭 1/2, 선택 시 파란 링
 └─────────┘
그 외 도면 (5)                                 ← 전체 건수 - 1
 [FIG 2] [FIG 3] [FIG 4]                       ← 3열 그리드
 [FIG 5] [FIG 6]
```

> 확대 모달은 휠 확대/축소(50~500%)·드래그 이동·`←/→` 도면 이동·`+/-/0` 줌·`Esc` 닫기를 지원하며, 하단에 전체 도면 썸네일 스트립과 `n / 6` 카운터가 표시된다. 도면이 없으면 패널 전체가 `도면 없음`으로 대체된다.
> 라벨 외 텍스트(도면 캡션·부호의 설명)는 수집 컬럼이 없어 표시하지 않는다 → 화면에는 **이미지와 순번 라벨만** 남는다.

---

## 10. 요약 통계 및 잔여 과제

- **UI 표시 항목 전수 대조 결과**: 근거 없는 항목 **0건**. 전부 (a) 수집 컬럼 매핑 또는 (b) 문서화된 계산·파싱 파생(`⚠파생` 6종: 존속만료 · 타임라인 · 상세설명 하위섹션 · 도면의 설명 · 독립/종속 구조 · 도면 부호설명).
- **제외 확정(수집 컬럼 없음)**: **특허평가 · 소송/분쟁** — 명세서에 컬럼 부재로 UI에서 삭제 완료. (**심판**은 `custom.has_trial`로 수집되어 유지)
- **잔여 과제(정방향 — 수집엔 있으나 UI 미반영/목업)**:
  - **P1**: 실 도면 이미지 표시 — 컬럼은 전부 수집됨(`patent_image.scrape_site`+`key_name` → S3 · `custom.drawing_url` · `custom.primary_drawing_url` · `custom(JP).figures`). 화면이 임시 도식을 쓰고 있고 **이미지 URL을 화면까지 전달하는 경로가 없는 것**이 유일한 격차. **S3 키 → 접근 URL 변환(서명 URL 여부)** 이 연동 시 결정 사항.
  - **P1(목업→실)**: `specification`(원문/PDF) · `claim`(청구항 원문) · 인용(`KPA_CITATION`/`CTLTR`) 실데이터 연동.
  - **P3**: 기술이전/도입 희망(`technology_transference`) · KPA_IPC 상세(`ipc_version`/`level`) · 도면 부가정보(`drawing_area_count`·`representation_image_source_status_code`) — 미노출.
- **소스 노출 방식(연동 시 결정)**: 위 컬럼은 수집 DB에 존재하나, 상세페이지로 전달할 **검색 hit `columns` 패스스루 vs 상세 조회 API**는 미설계.

### 10-1. 예시 대조에서 드러난 정리 필요 항목 (연동 전 확인)

목업 값과 실제 화면을 맞춰보며 확인된, **매핑은 맞지만 표시 방식을 손봐야 하는** 항목이다. 수집 필드 누락 이슈는 아니다.

| # | 위치 | 현상 (목업 화면) | 연동 시 조치 |
|---|---|---|---|
| 1 | 제목 영역 · 선행기술문헌 | 국가 + 문헌번호를 이어 붙여 `KR  KR 10-2026-1000000 A`처럼 국가 코드 중복 | `literature_number`의 국가 접두 포함 여부 확인 후 한쪽 제거 |
| 2 | 서지 · 문헌일 / 공개공고일 | 두 칸이 같은 값으로 표시 | `open_date`(문헌일)와 `publication_date`(공고일)로 분리 |
| 3 | 인명 · 특허고객번호 | 라벨이 KR/JP만 분기 → US·EP·CN도 `특허고객번호 (KR)`로 표시 | 라벨 국가 분기 확장 + 국가별 정본 컬럼 확정(KR `patent_customer_number` / JP `applicant_identifier`) |
| 4 | 패밀리 · 국가별 건수 | 탭·알약이 총건수를 KR→EP 순 1건씩 배분한 파생값이라 패밀리 문헌의 실제 국가와 불일치(표본 B: EP 문헌은 있으나 EP 탭 없음) | 패밀리 문헌을 국가로 집계(group by) |
| 5 | 상세설명 · 기술분야/배경기술 | 화면에 하드코딩된 고정 문장(기술분야만 발명의 명칭 삽입) | `specification` 파싱 결과로 6개 하위섹션 전체 치환 |
| 6 | 서지 · 원출원번호 | 목업 값 생성 규칙이 KR 번호 형식만 변환해 CN(표본 B)은 출원번호와 동일하게 보임 | 실데이터 `original_application_number` 직결(목업 한정 이슈) |

---

## 11. UI에서 바로 확인하기 — 「수집필드 모드」

이 문서의 매핑을 **목업 화면 위에서 직접** 확인할 수 있다. 좌하단 `명세 모드` 옆의 **`수집필드`** 토글을 켜면 특허 상세페이지의 각 표시값 아래에 **수집 필드(`테이블.컬럼`)** 가 뱃지로 붙는다. 즉 **UI 명칭 → 예시(실값) → 수집 필드**를 화면에서 한 번에 읽을 수 있다.

- **켜는 곳**: 검색 결과 오버레이 상세, 그리고 전체보기(새 탭) 상세 — 두 경로 모두 좌하단 토글. 명세 모드와 **독립 토글**이라 동시에 켤 수 있다.
- **뱃지 색 규칙**
  - 남색(indigo) = **수집 컬럼 직결**. 값이 `—`여도 뱃지는 보이므로 "수집되나 이 문헌엔 값 없음"과 "미수집"을 화면에서 구분할 수 있다.
  - 호박색(amber, `⚠` 접두) = **계산·파싱 파생 / 목업 / 미정**. 예: `⚠파생 · 등록일 + 20년(수집 컬럼 없음)`, `⚠목업(현재 절차 SVG · 컬럼은 수집됨) · patent_image.…`, `⚠미정 · 원문 PDF URL 컬럼 확인 필요`.
- **구현**: 표시값 요소에 `data-col="<테이블.컬럼>"` 속성을 부착하고 CSS가 그 값을 뱃지로 렌더한다(화면 상태와 무관 → 성능 부담 없음). 현재 상세페이지 부착 지점 **68개**(표본 A 기준).
  - 토글: [SpecOverlay.tsx](../src/features/spec-overlay/SpecOverlay.tsx) · 스타일: [index.css](../src/index.css)「수집필드 모드」블록 · 부착 지점: [PatentDetail.tsx](../src/components/PatentDetail.tsx)
- **유지 규칙**: 화면 뱃지의 값과 이 문서 「수집 필드」 열은 **같은 내용이어야 한다. 한쪽만 고치지 말고 함께 갱신**한다.

```
공개 · KR  KR 10-2026-1000000 A
⟨bibliographic.register_status⟩ ⟨bibliographic.country_code⟩ ⟨bibliographic.literature_number⟩

문헌종류   공개특허공보                    권리상태  공개
           ⚠현재 status 파생 ·                      bibliographic.register_status
           bibliographic.document_kind              + custom.legal_status
존속기간   —                               권리변동  있음 (권리 양도)
(예상)만료일 ⚠파생 · 등록일 + 20년(수집 컬럼 없음)     custom.has_ownership_change
```

---

## 12. 복합 값의 조각별 매핑 (개발 계약용 정본)

화면 한 줄이 여러 컬럼의 조합인 항목은 **조각마다** 대응 컬럼을 적는다. 축약 표기(`RND(… · number · …)`)는 쓰지 않고 **실제 컬럼명**만 쓴다.
`⚠미수집`은 대응 컬럼이 없어 **UI에서 제거한 것**이고, `⚠파생`은 수집값으로 계산·분해해 만드는 것이다.

| UI 항목 | 표시 조각(예시) | 수집 컬럼 |
|---|---|---|
| 제목 영역 | `공개` | `bibliographic.register_status` |
| ↳ | `KR` | `bibliographic.country_code` |
| ↳ | `KR 10-2026-1000000 A` | `bibliographic.literature_number` |
| ↳ | `자율주행 차량용 라이다 기반 객체 감지` | `bibliographic.invention_title` (영문 `_eng`) |
| 우선권 주장 | `EP` | `priority.priority_application_country_code` |
| ↳ | `20000068` | `priority.priority_application_number` |
| ↳ | `2012-05-05` | `priority.priority_application_date` |
| 패밀리 문헌 | `KR` | `family.family_country_code` |
| ↳ | `KR 10-2026-1000000 A` | `family.family_literature_number` |
| ↳ | `2026-01-03` | `family.application_date` |
| ↳ | `자율주행 차량용 라이다 기반 객체 감지` | `family.invention_title` |
| 인용·피인용(특허) | `KR` | KR `kpa_citation.citation_literature_country_code` · US·JP `ctltr.citation_literature_country_code` |
| ↳ | `10-2023-1004513` | KR `kpa_citation.citation_literature_number` · US·JP `ctltr.registration_number` |
| ↳ | `김OO` | KR `kpa_citation.citation_literature_inventor_name` · US·JP `ctltr.inventor_name` |
| ↳ | `2023-05-12` | KR `kpa_citation.citation_literature_publication_date` · US·JP `ctltr.registration_date` |
| ↳ ~~인용문헌 명칭~~ | (제거) | **⚠미수집** — 인용 테이블에 명칭 컬럼 없음 |
| 인용·피인용(비특허) | `LiDAR-Based …: A Review, IEEE/Elsevier, 2025` | `ctltr_etc.other_citations` · `prior_technology_document.non_patent_reference_text` (제목·저널·연도 한 컬럼 통째) |
| 선행기술문헌 | `KR` / `10-2023-1000000` | `prior_technology_document.prior_technology_document_country` / `prior_technology_document_number` |
| 권리변동 이력 | `2018-04-04` | `right_change.change_date` |
| ↳ | `百度在线网络技术有限公司 → OO기술지주(주)` | `right_change.name` |
| ↳ | `권리 양도` | `right_change.change_type` |
| 권리이전 이력 | `2018-04-04` | `right_transfer.registration_date` |
| ↳ | `권리이전등록신청서` | `right_transfer.document_name` |
| ↳ | `(변경 전 → 변경 후)` | `right_transfer.change_before_content` / `change_after_content` |
| ↳ | `CN 1010299973 B` | `right_transfer.registration_number` |
| 행정처리 이력 | `2025-01-01` | `administrative_process.receipt_send_date` |
| ↳ | `출원서` | `administrative_process.receipt_send_document_name` (영문 `_eng`) |
| ↳ | `수리` | `administrative_process.proc_status` |
| 국가 R&D | `자율주행 차량용 라이다 기반 객체 감지 원천기술 개발` | `rnd.rnd_task_name` |
| ↳ | `(2025-000000)` | `rnd.rnd_task_number` |
| ↳ | `산업통상자원부` | `rnd.rnd_department_name` |
| ↳ | `차세대 핵심기술개발사업` | `rnd.rnd_project_name` |
| ↳ | `현대자동차주식회사` | `rnd.rnd_managing_institute_name` |
| ↳ | `2024.03 ~ 2026.02` | `rnd.rnd_duration` |
| ↳ (UI 미노출) | — | `rnd.rnd_serial_number` · `rnd_special_institute_name` · `rnd_task_contribution` |
| 표준특허 | `3GPP` | `standard.standardization_organization` |
| ↳ | `TS 38.300` | `standard.standard_numbers` |
| ↳ | `자율주행 … 표준` | `standard.standard_technology_name` |
| ↳ | `현대자동차주식회사` | `standard.standard_declarants` |
| ↳ | `2026-01-01` | `standard.standard_declaration_date` |
| ↳ (UI 미노출) | — | `standard.standards_information` · `standard_declarant_nationalities` |
| 관련출원(US) | `US 9000013` | `rel_appl.registration_number` |
| ↳ | `2021-02-02` | `rel_appl.registration_date` |
| ↳ | `Continuation` | `rel_appl.classification` |
| ↳ | `Granted` | `rel_appl.status` |
| 도면 | 이미지 | `patent_image.scrape_site` · `key_name` (`⚠목업`) |
| ↳ | `FIG 1` | `⚠파생` — 이미지 순번(화면 생성) |
| ↳ ~~캡션·부호의 설명~~ | (제거) | **⚠미수집** |
| 청구범위 | 청구항 본문 | `claim.claim` |
| ↳ | `독립항 — 제1항` / `종속항 (제2항 → 제1항 인용)` | `⚠파생` — 원문 패턴 분해(대표항 `KPA_BIBLIOGRAPHIC.representation_claim_number`) |
| 서지 · 존속기간(예상)만료일 | `2036-04-07` | `⚠파생` — 등록일 + 20년 |
| 서지 · 타임라인 | 6칸 일자 | `⚠파생` — 위 일자 컬럼 조합 |
| 패밀리 · 국가별 건수 | `전체(4) KR(1) US(1) …` | `custom.family_document_count` / `family_country_count` + `family` 국가 집계 |

### 12-1. 미수집으로 UI에서 제거한 항목 (2026-07-31 확정)

| 제거 항목 | 근거 |
|---|---|
| 인용·피인용 문헌의 **명칭** | `kpa_citation`·`ctltr` 에 명칭 컬럼 없음(번호·국가·발명자명·일자·분류만) |
| 상세설명 **하위섹션 6개**(기술분야·배경기술·해결하려는 과제·과제의 해결 수단·발명의 효과·도면의 설명) | `specification` 은 단일 mediumtext, 섹션 컬럼 없음 |
| 도면 **캡션** | 위와 동일(`specification` 파싱 필요) |
| 도면 **부호의 설명** | 전용 컬럼 없음 |
| (기존) 특허평가 · 소송/분쟁 | 명세서에 컬럼 부재 |

**유지 결정**: 청구범위 독립/종속 구조(선행기술조사 핵심 기능 · 대표항 번호 컬럼 수집됨) · 계산 파생(존속기간만료·타임라인·도면 라벨·패밀리 집계).
