# 특허 상세페이지 UI 항목 ↔ 수집 DB 필드 매핑표

- **목적**: 특허 검색결과 **상세페이지**에 표시되는 각 UI 항목을 **수집 DB 컬럼**과 1:1로 매핑한다. 개발자가 이 표만 보고 **화면의 어느 자리에 무엇이 어떤 형태로 보이는지**, 그 값을 **어느 테이블·컬럼에서 가져와야 하는지**를 알 수 있게 한다.
- **표 형식**: `UI 항목` → `렌더 필드`(목업 내부 필드명 — 목업 대조용 참고값, 개발 계약 아님) → `예시` → `수집 컬럼 · 테이블`(**계약**).
- **출처(정본)**: `[BLK] 특허 수집 데이터베이스 명세서 — 개발노트` **갱신본**(34p · 스키마 1.0.12 · 로컬 DB 적재 2026-07-30). **구버전(2026-07-28 PDF)과 차이가 크다** — 테이블 블록 47 → 119, 신규 KR 엔티티 다수. 아래 「갱신본에서 달라진 것」 참조.
- **검증 결과(역방향)**: 화면 표시 조각 중 대응 컬럼이 없는 것은 UI에서 제거한다(§12-1). 제거 완료: 인용문헌 명칭 · 상세설명 하위섹션 6개 · 도면 캡션 · 도면 부호의 설명 · (과거) 특허평가 · 소송/분쟁.
- **수집 컬럼 열 표기**: 컬럼명만 = 수집 직결 · `⚠파생` = 수집값에서 계산·분해(컬럼 아님) · `⚠목업` = 컬럼은 수집되나 화면이 아직 임시 데이터 · `⚠데이터0` = 컬럼은 있으나 명세서에 "로컬 DB 데이터 0건" · `조건(…)` = 특정 국가/상태에서만 렌더.
- **테이블 약칭**: `bibliographic`(서지 자연키 1행) · `custom`(국가고유 스칼라) · `kpa_*`(KR 영문보강) · `related_person`(인명, row별 classification) · `representative_applicant`(대표출원인 마스터 · 특허↔대표출원인은 `patent_representative_applicant` N:M) · US/JP/EP/CN/WIPO는 국가별 고유 테이블.
- **대조 방식**
  - *1차(2026-07-28 · 정방향)*: 화면 부착 컬럼 토큰 112개를 구버전 PDF와 기계 대조 → 없는 토큰 0건.
  - *2차(2026-07-31 · 역방향·조각 단위)*: 복합 값을 조각으로 분해해 조각마다 대응 컬럼 확인(§12). 축약 표기를 실제 컬럼명으로 교체.
  - *3차(2026-07-31 · 갱신본 대조)*: 문서의 `테이블.컬럼` 표기 **80건을 갱신본과 기계 대조 → 전건 존재 확인**. 단 **인용·피인용 계열은 테이블 자체가 교체**되어 아래와 같이 정정했다.
- **수집 컬럼 열은 「조합식」으로 적는다** — 화면 값이 컬럼 하나가 아니면 **어떻게 조합·가공하는지**를 식으로 표기한다. 표기 규약:
  | 기호 | 뜻 | 예 |
  |---|---|---|
  | `+` | 문자열 결합(리터럴은 따옴표) | `country_code + ' ' + literature_number` |
  | `JOIN(list, '구분자')` | 다건(N행) 결합 | `JOIN(ipc.ipc_number, '  ·  ')` |
  | `COALESCE(a, b, '—')` | 앞이 비면 뒤 값, 최종 폴백 `—` | `COALESCE(register_number, '—')` |
  | `CASE … THEN … ELSE …` | 조건 분기 | `CASE country='JP' THEN … ELSE …` |
  | `COUNT(*) GROUP BY x` | 집계 | `COUNT(*) GROUP BY family_country_code` |
  | `+20년`, `→` | 날짜 계산 · 순서 배치 | `register_date + 20년` |
  | `PARSE(x, 규칙)` | 텍스트 파싱(현재 미지원 = ⚠미수집) | `PARSE(specification, 섹션)` |
  | `[N행]` | 목록을 N행으로 반복 렌더 | `[N행] change_date + name + change_type` |
- **예시 열**: 「§0 예시 표본」의 목업 값을 그대로 인용한다. 기본은 **표본 A(KR/공개)** 이고, 국가·상태 조건 항목은 표본 기호(**B~E**)를 함께 표기한다.

### 갱신본에서 달라진 것 (구버전 기준 매핑 정정)

| # | 항목 | 구버전 매핑(오류) | **갱신본 확정** |
|---|---|---|---|
| 1 | **인용(backward)** | `kpa_citation` | **`citation`**(신규) — 자연키 `(application_number, std_citation_number, citation_type_code, std_citation_identification_code)`. `kpa_citation`은 **⚠데이터0** |
| 2 | **피인용(forward)** | `kpa_citation` · 별개로 선행기술문헌=`prior_technology_document` | **`prior_technology_document`** — 명세서에 *"⚠ 방향 주의(이름 ≠ 데이터): 이름은 선행기술문헌이지만 실제 담기는 데이터는 피인용(forward)"* 로 명시. `prior_technology_document_number` = **피인용(후행) 문헌의 출원번호** |
| 3 | **비특허(논문) 인용** | `prior_technology_document.non_patent_reference_text`(한 컬럼 통째) | **`paper_citation`**(신규) — `paper_title`·`paper_author`·`paper_year`·`paper_journal` **분리 수집**. 명세서: *"과거 non_patent_reference_text 로 기술됐으나 실제는 이 전용 테이블로 적재"*. `non_patent_reference_text`는 **현재 미사용** |
| 4 | **심판** | `custom.has_trial`(Y/N)만 | **`trial`**(신규, 24컬럼) — `trial_type`·`trial_status`·`trial_number`(+`trial_number_text`) 외 심급·심결·확정 정보. `custom.has_trial`은 유무 플래그로 유지 |
| 5 | 기술이전 희망 | `technology_transference` | **`custom.technology_transference_hope_status`**(기술 이전 희망 상태) |
| 6 | 행정처리 | 3컬럼 | `proc_status_en` · `step`(단계) · **`trial_number`(심판번호 브릿지)** · `registration_number`(등록번호 브릿지) · `captured_at` 추가(1.0.12) |
| 7 | 도면 링크 | 컬럼만 존재로 기술 | `custom.drawing_url`·`primary_drawing_url`에 **실 데이터 존재**(KIPRIS `fileToss.jsp?arg=…`). 반면 `patent_image`는 **⚠데이터0** |
| 8 | 상세설명 | `specification` 텍스트 | 동일하나 **값이 PDF URL인 경우가 있고**, `specification_extract_ticket`(신규 상태머신)이 전문 텍스트로 치환 |

**갱신본 신규 KR 엔티티(현재 UI 미노출)**: `examination_notice`(의견제출통지) · `rejection_decision`(거절결정) · `legal_status_history` · `final_right_holder`(등록원부 최종권리자) · `term_extension`(존속기간연장) · `sequence_listing` · `notice_due_date` · `deposited_microorganism` · `claim_revision_detail` · `rights_holder_change` · `applicant_name_change` · `classification_code_change_ipc/cpc` · `alloy_composition` · `patent_master` · `recollect_queue`.

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

**표기·포맷 규칙(전 섹션 공통)** — 값이 화면 문자열로 바뀌는 규칙. 실데이터 연동 시에도 동일하게 유지한다.

| 규칙 | 처리 | 예 |
|---|---|---|
| 빈값 대체 | 값 없음 → `—`(em dash) | 번역문 제출일(KR) → `—` |
| 하이픈 정규화 | 원본이 `-`로 채워진 값도 `—`로 치환 | 등록번호 `-` → `—` |
| 단위 접미 | 청구항 수 → `N개`, 도면 수·패밀리 → `N건` | `10개` / `6건` |
| 배열 결합 | 분류코드 = `'  ·  '`(공백2+중점+공백2), 지정국 = `', '` | `G01S 17/93  ·  G01S10/10` |
| 유무(Y/N) | 있음 → `있음`, 없음 → `—` | 서열목록 `있음` |
| 조건부 행 숨김 | 값이 없으면 **행·블록 자체를 렌더하지 않음** | 권리변동 이력, 국가 R&D, 표준특허, 심판 |
| 흐린 글씨(muted) | 미확정·플레이스홀더는 회색 | 발명자 주소, 대리인 미상 |
| 고정폭(mono) | 번호·코드·일자 계열 | 문헌번호·출원번호·IPC |

---

## 1. 제목 영역 (PAT-DET-020)

| UI 항목 | 렌더 필드 | 예시 | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 권리상태(평문) | `status` | `공개` (툴팁: `공개 — 출원이 공개된 상태(심사 전/중, 권리 미발생)`) | `COALESCE(bibliographic.register_status, custom.legal_status)` → 평문 라벨 매핑(툴팁 문구는 화면 상수) |
| 국가 | `country` | `KR` | `bibliographic.country_code` |
| 문헌번호 | `number` | `KR 10-2026-1000000 A` | `bibliographic.country_code + ' ' + bibliographic.literature_number` — 갱신본 `literature_number`엔 국가 접두가 없다(예 `1020190002417_PUB`) |
| 발명의 명칭 | `title` | `자율주행 차량용 라이다 기반 객체 감지` · **D**: `LiDAR-Based Object Detection for Autonomous Driving (Method)` | `CASE 원문언어=영문 THEN kpa_bibliographic.english_invention_name ELSE bibliographic.invention_title` |
| 원문 PDF 다운로드 | (버튼) | `원문 PDF 다운로드` → `KR 10-2026-1000000 A.pdf` 저장(현재 데모 표지 1p) | `specification.specification` 이 **KIPRIS PDF URL** 인 경우 그 URL(= `specification_extract_ticket.pdf_url`) · `⚠확인 필요`(공보 원문 PDF와 동일본인지) |

**목업 렌더 (표본 A)**

```
공개 · KR  KR 10-2026-1000000 A          ← 권리상태 · 국가 + 문헌번호(mono)
자율주행 차량용 라이다 기반 객체 감지        ← 발명의 명칭 (2xl bold)
[ 원문 PDF 다운로드 ]                      ← primary filled 버튼
```

> 특이사항: 국가와 문헌번호가 나란히 놓이는데 목업 문헌번호 값이 국가 접두를 포함해 **`KR  KR 10-…`처럼 국가 코드가 두 번** 보인다. 갱신본 `literature_number`는 접두가 없어 연동 시 해소된다.

## 2. 서지사항 (PAT-DET-050)

| UI 항목 | 렌더 필드 | 예시 (A / 조건 표본) | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 문헌번호 / 문헌일 | `number` / `publicationDate` | `KR 10-2026-1000000 A` / `2026-04-06` | `bibliographic.literature_number` / `open_date` |
| 출원번호 / 출원일 | `applicationNo` / `applicationDate` | `10-2025-1000000` / `2025-01-01` | `bibliographic.application_number` / `application_date` |
| 공개·공고번호 / 공개·공고일 | `publicationNo` / `publicationDate` | `10-2026-1000000 A` / `2026-04-06` | `bibliographic.open_number` · `publication_number` / `publication_date` |
| 등록번호 / 등록일 | `registerNo` / `registerDate` | A: `—` / `—` · **B**: `CN 1010299973 B` / `2017-10-05` | `COALESCE(bibliographic.register_number, '—')` / `COALESCE(bibliographic.register_date, '—')` · 조건(등록계) |
| 문헌종류 | `(status 파생)` | `공개특허공보` · **B**: `등록특허공보` | `COALESCE(bibliographic.document_kind, CASE register_status IN ('등록','소멸') THEN '등록특허공보' ELSE '공개특허공보')` — 현재 화면은 후자(파생)만 사용 |
| 권리상태 | `rightStatus` | `공개` · **B**: `존속 중` · **D**: `심사 중` · **E**: `등록결정(등록료 납부 전)` | `bibliographic.register_status` (+ `custom.legal_status` · 이력 `legal_status_history`·`register_status_history`) |
| 원출원번호 | `originalAppNo` | A: `—` · **B**: `20161010000099` | `bibliographic.original_application_number` · 조건(분할·변경) |
| 국제출원번호 | `intlAppNo` | A: `—` · **C**: `PCT/EP2013/050052` | `bibliographic.international_application_number` · 조건(PCT/국제) |
| 우선권주장일 | `priorityDate` | `2024-01-01` | `priority.priority_application_date` · 조건 |
| 심사청구일 | `examRequestDate` | `2025-02-03` | `bibliographic.original_examination_request_date` |
| 존속기간(예상)만료일 | `expirationDate` | A: `—` · **B**: `2036-04-07` | `⚠파생` = `bibliographic.register_date + 20년` (연장 있으면 `+ term_extension` 반영) |
| 권리변동(유무) | `rightChange` | `있음 (권리 양도)` · **D**: `없음` | `custom.has_ownership_change` |
| 최종처분상태 | `finalDisposal` | `출원공개` · **B**: `설정등록` · **C**: `거절결정` · **D**: `심사청구` · **E**: `등록결정` | `bibliographic.final_disposal` (상세는 신규 `examination_notice`·`rejection_decision`) |
| 청구항 수 | `claimCount` | `10개` | `COALESCE(bibliographic.claim_count, kpa_bibliographic.claim_count) + '개'` |
| 출원구분 | `applicationFlag` | `정상출원` · **B**: `분할출원` · **C**: `PCT 국내단계진입` | `bibliographic.application_flag` |
| 번역문 제출일 | `translationSubmitDate` | A(KR): `—` · **D**: `2023-04-02` | `bibliographic.translation_submit_date` · 조건(외국어) |
| 도면 수 | `drawingCount` | `6건` | `kpa_bibliographic.drawing_count + '건'` |
| 실시권 등록일 | `licenseRegDate` | A: `—` · 등록계 일부: `2018-06-06` | `custom.license_registration_date` · 조건 |
| 지정국 | `designatedCountries` | A: `—` · **C**: `DE, FR, GB, IT, NL` | `JOIN(designated_country.designated_country, ', ')` · EP는 `JOIN(dsgn.national_name, ', ')` · 조건 |
| 서열목록 | `sequenceListing` | A: `있음` · B~E: 행 미표시 | `CASE custom.sequence_listing_yn='Y' THEN '있음' ELSE '—'` (내용 `sequence_listing_content` · 신규 `sequence_listing`) · 조건 |
| 우선권 주장(목록) | `priorityList` | A: 블록 미표시 · **C**: `EP 20000068 · 2012-05-05` | `[N행] priority.priority_application_country_code + ' ' + priority_application_number + ' · ' + priority_application_date` (JP `prir`) · 조건 |
| 타임라인 | `(timeline 파생)` | 아래 블록 참조 | `⚠파생` = `priority_application_date → application_date → original_examination_request_date → COALESCE(open_date, publication_date) → register_date → (register_date + 20년)` · 소멸이면 마지막이 소멸일 |

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

> 특이사항 ①: 타임라인 점 색은 값 유무로 갈린다(값 있음=파랑, `—`=회색). 권리상태 `등록`이면 등록일·존속만료가, `소멸`이면 등록일·소멸일이 추가돼 6칸이 된다.
> 특이사항 ②: 표본 B의 `원출원번호`가 `출원번호`와 같은 값으로 보인다(목업 값 생성 규칙이 KR 번호 형식만 변환). 연동 시 `original_application_number` 직결.
> 특이사항 ③: 목업에서 `문헌일`과 `공개/공고일`이 같은 값이다. 수집은 `open_date`(문헌일)와 `publication_date`(공고일)가 **분리**되어 있으므로 두 컬럼으로 나눠 표시한다.

## 3. 인명정보 (PAT-DET-060) — 출처 `related_person`(row별 `classification`)

| UI 항목 | 렌더 필드 | 예시 (A / 조건 표본) | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 출원인 / 출원인 주소 | `applicant` / `applicantAddress` | `현대자동차주식회사` / `서울특별시 강남구 테헤란로 152` · **D**: `Waymo LLC` | `JOIN(related_person[classification=APPLICANT].name, ', ')` / 대표 1행의 `.address` |
| 특허고객번호(KR) · 출원인식별기호(JP) | `applicantCode` | A: `특허고객번호 (KR)` → `120000000000` · **E**: `출원인식별기호 (JP)` → `120000015838` | `CASE country='JP' THEN custom.applicant_identifier ELSE representative_applicant.patent_customer_number` (라벨도 같은 분기) |
| 대표출원인 | `repApplicant` | `현대자동차주식회사` | `representative_applicant.representative_applicant_name` (명칭 변동 이력 `applicant_name_change`) |
| 발명자 / 발명자 주소 | `inventors` / `inventorAddress` | `김OO, 이OO` / `서울특별시 서초구 서초대로 396`(회색) · **D**: `A. Researcher, B. Engineer` | `JOIN(related_person[classification=INVENTOR].name, ', ')` / 대표 1행의 `.address` |
| 대리인 | `agent` | `특허법인 다래` · **D**: `Wilson Sonsini Goodrich & Rosati` (주소는 「기타정보」) | `related_person[AGENT].name` |
| 심사관 | `examiner` | `박심사` · **D**: `J. Smith` | `COALESCE(JOIN(related_person[classification=EXAMINER].name, ', '), custom.examiners)` |
| (UI 미노출) 현재권리자 | — | — | 신규 `final_right_holder`(등록원부 최종권리자) · `custom.current_assignees_country` |

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

> 특이사항 ①: 라벨이 `KR`/`JP`만 분기하므로 **US·EP·CN 문헌도 `특허고객번호 (KR)` 라벨**로 표시된다 → 연동 시 국가 전체로 확장.
> 특이사항 ②: KR `patent_customer_number`와 JP `applicant_identifier`는 **별개 컬럼**이지만 화면은 한 자리에 표시한다 → 국가별 정본 컬럼 확정 필요.
> 특이사항 ③: `발명자 주소`는 값이 없으면 `(예시) 동일 — 출원인 주소` 플레이스홀더가 나오고, 값이 있어도 항상 회색이다.

## 4. 요약 · 상세설명 · 청구범위 (PAT-DET-070/080/090)

| UI 항목 | 렌더 필드 | 예시 (A) | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 요약 | `abstract` | `라이다 포인트 클라우드를 딥러닝으로 처리하여 …` (약 300자 전문) | `abstract.abstract` (mediumtext 단일) · JP/CN 영문요약 `e_abstract` |
| 상세설명 | `description` | `[기술분야] 【0001】 본 발명은 … 【0023】` 원문 전문 | `specification.specification` (longtext 단일). **값이 KIPRIS PDF URL 인 경우가 있고**, `specification_extract_ticket`(service·pdf_url·ticket_key·status)이 전문 텍스트로 치환 |
| ~~상세설명 하위섹션~~(기술분야·배경기술·해결하려는 과제·과제의 해결 수단·발명의 효과·도면의 설명) | (제거) | (표시하지 않음) | **⚠미수집** — `specification` 은 단일 컬럼이고 섹션별 컬럼이 없다. 2026-07-31 **UI에서 제거 확정** |
| 청구범위(전체) | `claims` | 10개 항 — 독립항 2개(제1·8항)·종속항 8개 | `claim.claim` (mediumtext 단일) · 변동 이력 `claim_revision`·`claim_revision_detail`(신규) |
| 독립항/종속항 구조 · 인용 관계 | `claims[].dependsOn` | `독립항 — 제1항` / `종속항 (제2항 → 제1항 인용)` | `⚠파생` = `PARSE(claim.claim, '제N항' 분할 + '제M항에 있어서' → 인용관계)` · 대표항 = `kpa_bibliographic.representation_claim_number`. 2026-07-31 **유지 확정** |

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

**목업 렌더 — 청구범위 (표본 A)** · `[독립항] [전체청구항]` 토글, 기본값 = 독립항

```
[독립항]  전체청구항                          ← 독립항 = 인용 관계가 없는 항만

독립항 — 제1항
 라이다 센서로부터 3차원 포인트 클라우드를 획득하는 데이터 수집부; 상기 포인트 클라우드의
 노이즈를 제거하는 전처리부; 및 딥러닝 모델로 객체를 분류하는 인식부를 포함하는, 객체 감지 장치.
                                              ↑ 파란 박스 + 좌측 굵은 파란 보더, "제1항." 접두 제거

독립항 — 제8항
 제1 데이터를 획득하는 단계; … 를 포함하는, 객체 감지 장치의 동작 방법.

── [전체청구항] 전환 시 위 2개 사이에 종속항이 순서대로 삽입 ──
종속항 (제2항 → 제1항 인용) 제1항에 있어서, 상기 인식부는 PointNet++ 구조를 …
종속항 (제3항 → 제1항 인용) 제1항에 있어서, 상기 전처리부는 RANSAC 기반 지면 분리를 …
                                              ↑ 회색 박스 + 좌측 회색 보더
```

## 5. 패밀리 정보 (PAT-DET-100)

| UI 항목 | 렌더 필드 | 예시 | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 국가별 건수(탭 + 알약) | `family` | A(1건): 탭 `전체(1) KR(1)` · **B**(4건): `전체(4) KR(1) US(1) JP(1) CN(1)` | 전체 = `custom.family_document_count` · 국가별 = `COUNT(*) GROUP BY family.family_country_code` → `family_country_code + '(' + N + ')'` (현재 화면은 총건수 기계 배분 = ⚠파생) |
| 패밀리 문헌(국가·번호·일자·명칭) | `familyList` | A: `KR  KR 10-2026-1000000 A  2026-01-03  자율주행 차량용 라이다 기반 객체 감지` · **B**: 4건 | `[N행] family.family_country_code + ' ' + family_literature_number + ' ' + application_date + ' ' + invention_title` |
| (UI 미노출) 패밀리 상세 | — | — | `family.family_category` · `family_identification` · `family_country` · `open_number`/`open_date` · `register_number`/`register_date` · `publication_number`/`publication_date` |

**목업 렌더 (표본 B — CN/등록, 패밀리 4건)**

```
[전체(4)]  KR(1)  US(1)  JP(1)  CN(1)         ← 탭: 총건수를 KR→US→JP→CN→EP 순 1건씩 배분(파생)
 (KR 1건) (US 1건) (JP 1건) (CN 1건)          ← 파란 알약

패밀리 문헌
 CN  CN 1012099811 A   2017-04-06  자율주행 차량용 라이다 기반 객체 감지
 EP  EP 3008822 A1     2016-05-07  자율주행 차량용 라이다 기반 객체 감지
 KR  KR 10-2015-1309511 A 2015-06-08 자율주행 차량용 라이다 기반 객체 감지
 US  US 11190056 B2    2017-07-09  자율주행 차량용 라이다 기반 객체 감지
```

> 특이사항: 상단 탭·알약은 **총 건수 하나를 국가 순서대로 1건씩 기계 배분한 파생 목업**이고, 하단 목록은 실제 국가다. 표본 B는 `EP` 문헌이 목록에 있는데 **`EP` 탭이 없다** → 연동 시 `family`를 국가로 집계(group by).

## 6. 인용·피인용 (PAT-DET-110) — **갱신본에서 테이블 교체**

| UI 항목 | 렌더 필드 | 예시 (A) | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 인용(backward) — 특허 | `citingList` | `KR  10-2023-1004513 · 김OO · 2023-02-03` | **`citation`** — `std_citation_country_code`(국가명 `std_citation_country_name`) · `std_citation_number` · `original_citation_number`(원문 표기, 예 `유럽특허공개공보0082977`) · `std_citation_publication_date` · `std_citation_identification_code` · `citation_type_code`/`citation_type_name` |
| 피인용(forward) — 특허 | `citedList` | `KR  10-2023-1040617 · 박OO · 2023-05-09` | **`prior_technology_document`** — `prior_technology_document_number`(**피인용 문헌의 출원번호**) · `prior_technology_document_country` · `std_status_code`/`std_status_name` · `citation_type_code`/`citation_type_name`. ⚠테이블명은 "선행기술문헌"이지만 **데이터는 피인용** |
| 비특허(논문) 인용 | `citingList`(kind=npl) | `[NPL] LiDAR-Based Object Detection for Autonomous Driving: A Review, IEEE/Elsevier, 2025` | `[N행] '[NPL] ' + paper_citation.paper_title + ', ' + COALESCE(paper_journal, '') + ', ' + paper_year` (저자 `paper_author` 병기 여부는 화면 결정 · `[NPL]`은 화면 라벨) |
| ~~인용문헌 명칭(특허)~~ | (제거) | (표시하지 않음) | **⚠미수집** — `citation`·`kpa_citation`·`ctltr` 모두 명칭 컬럼 없음. 2026-07-31 UI에서 제거 확정 |
| 인용문헌 발명자명 | `citingList[].inventor` | `김OO` | US·JP `ctltr.inventor_name` · KR `kpa_citation.citation_literature_inventor_name`(⚠데이터0) — **KR `citation` 에는 발명자 컬럼 없음** |
| (참고) 구버전 인용 테이블 | — | — | `kpa_citation`(KR) **⚠데이터0** · US·JP `ctltr`(`registration_number`·`inventor_name`·`registration_date`·`kind`·`upc`) · `ctltr_etc.other_citations` |

**목업 렌더 (표본 A)** · 회색 박스 2개(인용/피인용)

```
인용 (4건)                                    ← 인용 목록 건수
 특허 정보
  · KR  10-2023-1004513 · 김OO · 2023-02-03   ← 국가 · 번호 · 발명자명 · 일자 (명칭 없음)
  · KR  10-2023-1009026 · 이OO · 2023-03-05
  · US  9000000 B2 · J. Smith · 2023-04-07
 비특허(논문) 정보
  · [NPL] LiDAR-Based Object Detection for Autonomous Driving: A Review, IEEE/Elsevier, 2025

피인용 (2건)
 특허 정보
  · KR  10-2023-1040617 · 박OO · 2023-05-09
 비특허(논문) 정보
  · [NPL] Follow-up study citing this work, 2027
                                              ← 어느 한쪽이 비면 그 자리에 "없음"(회색)

선행기술문헌 (1건)                             ← ⚠갱신본 기준 '피인용'과 같은 테이블 → 통합 필요
 · KR KR 10-2023-1000000 A
```

> **연동 시 정리 필요 ①**: 화면은 「인용 / 피인용 / 선행기술문헌」 3블록인데, 갱신본에서 **선행기술문헌 = 피인용**(`prior_technology_document`)으로 같은 테이블이다 → 「인용(`citation`) / 피인용(`prior_technology_document`)」 2블록으로 통합.
> **연동 시 정리 필요 ②**: 비특허 인용은 갱신본에서 **제목·저자·저널·연도가 분리 수집**되므로, 현재의 한 줄 텍스트 대신 4조각으로 나눠 표시한다(§12).

## 7. 분류코드 (PAT-DET-120)

| UI 항목 | 렌더 필드 | 예시 (A / 조건 표본) | 수집 컬럼 · 테이블 |
|---|---|---|---|
| IPC | `ipc` / `ipcList` | `G01S 17/93  ·  G01S10/10  ·  H04L 9/10` | `JOIN(COALESCE(ipc.ipc_number, kpa_ipc.ipc_code), '  ·  ')` (버전 `kpa_ipc.ipc_version`) |
| CPC | `cpc` / `cpcList` | A: `G06V 20/56  ·  G06V2200/10` · **E**(JP): `—` | `COALESCE(JOIN(cpc.cpc_code, '  ·  '), custom.cpc_code, '—')` |
| FI / F-term / 테마 | `countryClassifications` | **E**: `FI G01S,302` / `F-term 5B002AA2` / `테마 5B002` | JP `fi.fi_code` / `fterm.fterm_code` / `tema.tema_code` · 조건(JP) |
| UPC | `countryClassifications` | **D**: `UPC 301/101` | US `upc.upc_code` · 조건(US) |
| EPC | `countryClassifications` | **C**: `EPC G01S14/04` | EP `epc.epc_code` · 조건(EP) |
| (UI 미노출) 분류 변경 이력 | — | — | 신규 `classification_code_change_ipc` · `classification_code_change_cpc` |

**목업 렌더 (표본 E — JP: CPC 미수집 + 국가 고유 분류 3종)**

```
IPC       G01S 17/93  ·  G01S12/12  ·  H04L 11/12     ← 다중 코드는 중점으로 결합
CPC       —                                            ← JP는 CPC 미수집 → em dash
FI        G01S,302                                     ← 국가 고유 분류는 종류별 1행씩
F-term    5B002AA2
테마      5B002
```

## 8. 기타정보 (PAT-DET-130) — 있는 항목만 조건부 렌더

| UI 항목 | 렌더 필드 | 예시 (표본) | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 대리인 주소 | `agentAddress` | A: `서울특별시 강남구 테헤란로 152` · **D**: `650 Page Mill Rd, Palo Alto, CA` | `related_person[AGENT].address` |
| 권리변동 이력 | `rightChangeList` | **B**: `2018-04-04 │ 百度… → OO기술지주(주) │ 권리 양도` | `[N행] right_change.change_date + ' │ ' + name + ' │ ' + change_type`(현재권리자/양도인/양수인/전용실시권자) · 조건 |
| 권리이전 이력 | `rightTransferList` | **B**: `2018-04-04 │ 권리이전등록신청서 (百度… → OO기술지주(주)) │ CN 1010299973 B` | `right_transfer.registration_date` · `document_name` · `change_before_content` · `change_after_content` · `registration_number`(+`information_change_cause`·`receipt_number`) · 조건 |
| 행정처리(수발신) 이력 | `adminProcess` | A: `2025-01-01 출원서 수리` · **B**: 3건 | `[N행] administrative_process.receipt_send_date + ' ' + receipt_send_document_name + ' ' + proc_status` (영문 `_eng`/`proc_status_en` · 부가 `step`·`trial_number` 브릿지) · 조건 |
| 국가 R&D 정보 | `rnd` | A: `자율주행 … 원천기술 개발 (2025-000000)` / `산업통상자원부 · 차세대 핵심기술개발사업 · 현대자동차주식회사 · 2024.03 ~ 2026.02` | `[N행]` 1행 = `rnd.rnd_task_name + ' (' + rnd_task_number + ')'` · 2행 = `rnd_department_name + ' · ' + rnd_project_name + ' · ' + rnd_managing_institute_name + ' · ' + rnd_duration` · 조건(KR) |
| 표준특허 | `standard` | A: `3GPP` / `TS 38.300` / `자율주행 … 표준` / `현대자동차주식회사` / `2026-01-01` | `standard.standardization_organization` · `standard_numbers` · `standard_technology_name` · `standard_declarants` · `standard_declaration_date`(+`standards_information`·`standard_declarant_nationalities`) · **⚠데이터0**(명세서: "적재 골격만", US는 소스에 선언 정보 없음) |
| 심판 정보 | `trial.type` / `.status` / `.number` | A: `무효심판` / `계속 중` / `2026당0000` (3행) · B~E: 블록 미표시 | **`trial.trial_type`**(심판종류, 예 `거절결정불복`) · **`trial.trial_status`**(심판상태, 예 `심결`) · **`trial.trial_number_text`**(심판번호문자, 예 `2008원2960`) · 자연키 `trial.trial_number`(예 `2008101002960`) · 유무 `custom.has_trial` |
| 관련출원(US) | `usRelatedApps` | **D**: `US 9000013 │ 2021-02-02 │ Continuation │ Granted` | `[N행] rel_appl.registration_number + ' │ ' + registration_date + ' │ ' + classification + ' │ ' + status` · 조건(US) |
| 가출원 번호(US) | `usProvisional` | **D**: `US 2021/600007` | `JOIN(custom.provisional_application_numbers, ', ')` · 조건(US) |
| 공보판(JP) / 대리인 구분(JP) | `jpEdition` / `agentCategory` | **E**: `공개특허공보(A)` / `弁理士` | JP `custom.edition` / `agent_category` · 조건(JP) |
| 출원인 정리번호(EP) / 출원·공개 언어(EP) | `epFileRef` / `epFilingLanguage` | **C**: `P000068EP` / `en` | EP `custom.applicant_file_reference` / `filing_language` · 조건(EP) |
| (UI 미노출) 심판 상세 | — | — | `trial.instance_category`(심급) · `right_type` · `request_date` · `case_display` · `request_purport` · `decision_order`(심결주문) · `decision_date` · `confirm_status`/`confirm_result`/`confirm_date`/`confirm_order_content` · `sub_code` · `merged_trial_number` · `original_trial_number` · `appeal_yn`/`supreme_appeal_yn` |
| (UI 미노출) 심사·거절 | — | — | 신규 `examination_notice`(의견제출통지) · `rejection_decision`(거절결정) · `notice_due_date` |
| (UI 미노출) 기타 | — | — | 신규 `term_extension`(존속기간연장) · `final_right_holder` · `deposited_microorganism` · `alloy_composition` · `custom.technology_transference_hope_status`(기술 이전 희망 상태) |

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

심판 정보                                      ← 심판 없으면 블록 전체 미표시
 심판 종류      무효심판
 심판 상태      계속 중
 심판 번호      2026당0000
```

**목업 렌더 (표본 B — 권리 이력) · (표본 D·C·E — 국가별 추가정보)**

```
권리변동 이력
 2018-04-04   百度在线网络技术有限公司 → OO기술지주(주)          권리 양도
권리이전 이력
 2018-04-04   권리이전등록신청서 (百度… → OO기술지주(주))   CN 1010299973 B
행정처리(수발신) 이력
 2016-04-07 출원서 / 2017-08-04 의견제출통지서 / 2017-10-05 등록결정서

국가별 추가정보                                ← 6개 항목 중 하나라도 있을 때만 블록 렌더
 가출원 번호(US)      US 2021/600007            (표본 D)
 관련출원(US)         US 9000013  2021-02-02  Continuation  Granted
 출원인 정리번호(EP)  P000068EP                 (표본 C)
 출원/공개 언어(EP)   en
 공보판(JP)          공개특허공보(A)            (표본 E)
 대리인 구분(JP)      弁理士
```

## 9. 도면 (PAT-DET-140)

> **도면은 수집 대상이다.** 갱신본에서 `custom.drawing_url`·`custom.primary_drawing_url`에 **실 데이터가 있다**(KIPRIS `fileToss.jsp?arg=…`). 반면 `patent_image`(scrape_site·key_name)는 **⚠데이터0**이다. 이 섹션의 `⚠목업`은 화면이 아직 임시 도식을 그린다는 뜻이며 미수집이 아니다.

| UI 항목 | 렌더 필드 | 예시 (A) | 수집 컬럼 · 테이블 |
|---|---|---|---|
| 도면 이미지 | `figures` | `도면 (6)` — 현재 이미지는 임시 생성 도식(4종 순환) | `custom.drawing_url`(도면 링크 · **실데이터 있음**) · `patent_image.scrape_site`+`key_name`(→S3, **⚠데이터0**) · JP `custom.figures` · `⚠목업` |
| 대표도면 | `figures[0]` | `대표` 배지 + 첫 도면 | `custom.primary_drawing_url`(**실데이터 있음**) · `⚠목업` |
| 도면 라벨 | `(index 파생)` | `FIG 1` … `FIG 6` | `⚠파생` = `'FIG ' + (이미지 순번 + 1)` — 화면 생성(2026-07-31 확정) |
| ~~도면 캡션~~ · ~~부호의 설명~~ | (제거) | (표시하지 않음) | **⚠미수집** — `specification` 파싱 필요. 2026-07-31 UI에서 제거 확정 |
| (UI 미노출) 도면 부가 | — | — | `kpa_bibliographic.drawing_area_count`(도면 영역 수) · `representation_image_source_status_code`(대표도면 출처 상태) |

**목업 렌더 (표본 A)** · 전체보기=우측 rail, 오버레이 드로어=본문 상단

```
도면 (6)                                       ← 이미지 건수
┌──────────────────────────────────────┐
│ [대표] FIG 1                      ⤢ 확대 │  ← 첫 도면 선택 시에만 [대표] 배지
└──────────────────────────────────────┘
대표도면   [대표] 썸네일 FIG 1                  ← 폭 1/2, 선택 시 파란 링
그 외 도면 (5)   [FIG 2] [FIG 3] [FIG 4] [FIG 5] [FIG 6]
```

> 확대 모달: 휠 확대/축소(50~500%)·드래그 이동·`←/→` 도면 이동·`+/-/0` 줌·`Esc` 닫기 + 하단 썸네일 스트립·`n / 6` 카운터. 도면이 없으면 패널 전체가 `도면 없음`으로 대체된다.

---

## 10. 요약 통계 및 잔여 과제

- **표시 항목 근거**: 전 항목이 (a) 수집 컬럼 직결 또는 (b) 문서화된 `⚠파생`(존속만료 · 타임라인 · 도면 라벨 · 청구항 구조 · 패밀리 국가 집계)이다. 근거 없는 항목은 §12-1로 제거했다.
- **연동 시 결정/작업**
  - **P1 · 인용 3블록 → 2블록 통합**: 갱신본에서 선행기술문헌 = 피인용(`prior_technology_document`) → 「인용(`citation`) / 피인용」으로 합친다.
  - **P1 · 비특허 인용 4조각화**: `paper_citation.paper_title`·`paper_author`·`paper_journal`·`paper_year` 로 나눠 표시(현재는 한 줄 텍스트 가정).
  - **P1 · 실 도면 연동**: `custom.drawing_url`·`primary_drawing_url`(실데이터 존재)을 화면까지 전달하는 경로가 없다. KIPRIS `fileToss.jsp` URL의 **인증·캐싱 정책** 확정 필요. `patent_image`(S3 키)는 데이터 0건.
  - **P1 · 상세설명/청구항 실데이터**: `specification` 값이 PDF URL 인 경우 `specification_extract_ticket` 상태(`PENDING/SENT/DONE/FAILED`)에 따라 본문이 없을 수 있다 → 화면 폴백 필요.
  - **P2 · 존속기간연장**: `term_extension` 반영 시 「존속기간(예상)만료일」 파생 규칙 교체.
  - **P2 · 심판 상세**: 현재 3조각만 표시. 심급·심결주문·심결일자·확정결과 노출 여부 결정.
  - **P3 · 미노출 신규 엔티티**: `examination_notice` · `rejection_decision` · `legal_status_history` · `final_right_holder` · `notice_due_date` · `sequence_listing` · `deposited_microorganism` · `claim_revision_detail` · `rights_holder_change` · `applicant_name_change` · `classification_code_change_ipc/cpc` · `custom.technology_transference_hope_status`.
- **소스 노출 방식(연동 시 결정)**: 상세페이지로 전달할 **검색 hit 패스스루 vs 상세 조회 API**는 미설계.

### 10-1. 표시 로직 정리 필요 (연동 전)

| # | 위치 | 현상 (목업 화면) | 연동 시 조치 |
|---|---|---|---|
| 1 | 제목 영역 · 선행기술문헌 | 국가 + 번호를 이어 붙여 `KR  KR 10-…`처럼 국가 코드 중복 | 갱신본 `literature_number`는 접두 없음 → 해소 |
| 2 | 서지 · 문헌일 / 공개공고일 | 두 칸이 같은 값 | `open_date` / `publication_date` 로 분리 |
| 3 | 인명 · 특허고객번호 | 라벨이 KR/JP만 분기 | 국가 전체로 확장 + 국가별 정본 컬럼 확정 |
| 4 | 패밀리 · 국가별 건수 | 총건수 기계 배분이라 실제 국가와 불일치 | `family` 국가 집계(group by) |
| 5 | 인용 · 3블록 구성 | 인용/피인용/선행기술문헌 3블록 | 갱신본 기준 2블록 통합(P1) |
| 6 | 서지 · 원출원번호 | CN(표본 B)이 출원번호와 동일하게 보임 | 실데이터 `original_application_number` 직결(목업 한정) |

---

## 11. UI에서 바로 확인하기 — 「수집필드 모드」

좌하단 `명세 모드` 옆 **`수집필드`** 토글을 켜면 각 표시값 아래에 **수집 필드(`테이블.컬럼`)** 가 뱃지로 붙는다. **UI 항목 → 예시(실값) → 수집 필드**를 화면에서 한 번에 읽을 수 있다.

- **켜는 곳**: 검색 결과 오버레이 상세 · 전체보기(새 탭) 상세. 명세 모드와 독립 토글.
- **뱃지 색**: 남색 = 수집 컬럼 직결(값이 `—`여도 뱃지는 보이므로 "수집되나 값 없음"과 "미수집"을 구분) · 호박색(`⚠`) = 파생·목업·미정.
- **구현**: 표시값 요소에 `data-col="<테이블.컬럼>"` 부착 → CSS가 뱃지로 렌더. 토글: [SpecOverlay.tsx](../src/features/spec-overlay/SpecOverlay.tsx) · 스타일: [index.css](../src/index.css) · 부착: [PatentDetail.tsx](../src/components/PatentDetail.tsx)
- **유지 규칙**: 화면 뱃지 값과 이 문서 「수집 컬럼」 열은 **같은 내용이어야 한다. 한쪽만 고치지 말 것.**

---

## 12. 복합 값의 조각별 매핑 (개발 계약용 정본)

화면 한 줄이 여러 컬럼의 조합인 항목은 **조각마다** 대응 컬럼을 적는다. 축약 표기는 쓰지 않고 **실제 컬럼명**만 쓴다.

| UI 항목 | 표시 조각(예시) | 수집 컬럼 |
|---|---|---|
| 제목 영역 | `공개` / `KR` / `KR 10-2026-1000000 A` / `자율주행 …` | `bibliographic.register_status` / `country_code` / `literature_number` / `invention_title` |
| 우선권 주장 | `EP` / `20000068` / `2012-05-05` | `priority.priority_application_country_code` / `priority_application_number` / `priority_application_date` |
| 패밀리 문헌 | `KR` / `KR 10-2026-1000000 A` / `2026-01-03` / `자율주행 …` | `family.family_country_code` / `family_literature_number` / `application_date` / `invention_title` |
| **인용(backward)** | `KR` | `citation.std_citation_country_code` (국가명 `std_citation_country_name`) |
| ↳ | `10-2023-1004513` | `citation.std_citation_number` (원문 표기 `original_citation_number`) |
| ↳ | `2023-02-03` | `citation.std_citation_publication_date` |
| ↳ | (문헌종류·구분 코드) | `citation.std_citation_identification_code` · `citation_type_code`/`citation_type_name` |
| ↳ | `김OO`(발명자명) | US·JP `ctltr.inventor_name` — **KR `citation` 에는 발명자 컬럼 없음** |
| **피인용(forward)** | `10-2023-1040617` | `prior_technology_document.prior_technology_document_number`(피인용 문헌 출원번호) |
| ↳ | `KR` | `prior_technology_document.prior_technology_document_country` |
| ↳ | (표준화 상태·구분) | `std_status_code`/`std_status_name` · `citation_type_code`/`citation_type_name` |
| **비특허 인용** | `LiDAR-Based …: A Review` | `paper_citation.paper_title` |
| ↳ | (저자) | `paper_citation.paper_author` |
| ↳ | `IEEE/Elsevier` | `paper_citation.paper_journal` |
| ↳ | `2025` | `paper_citation.paper_year` |
| ↳ 인용문헌 명칭(특허) | (제거) | **⚠미수집** |
| 권리변동 이력 | `2018-04-04` / `百度… → OO기술지주(주)` / `권리 양도` | `right_change.change_date` / `name` / `change_type` |
| 권리이전 이력 | `2018-04-04` / `권리이전등록신청서` / `(변경 전 → 후)` / `CN 1010299973 B` | `right_transfer.registration_date` / `document_name` / `change_before_content`·`change_after_content` / `registration_number` |
| 행정처리 이력 | `2025-01-01` / `출원서` / `수리` | `administrative_process.receipt_send_date` / `receipt_send_document_name` / `proc_status` |
| ↳ (미노출) | 단계 · 심판/등록 브릿지 · 영문 상태 | `administrative_process.step` · `trial_number` · `registration_number` · `proc_status_en` |
| 국가 R&D | `자율주행 … 원천기술 개발` | `rnd.rnd_task_name` |
| ↳ | `(2025-000000)` | `rnd.rnd_task_number` |
| ↳ | `산업통상자원부` | `rnd.rnd_department_name` |
| ↳ | `차세대 핵심기술개발사업` | `rnd.rnd_project_name` |
| ↳ | `현대자동차주식회사` | `rnd.rnd_managing_institute_name` |
| ↳ | `2024.03 ~ 2026.02` | `rnd.rnd_duration` |
| ↳ (미노출) | — | `rnd.rnd_serial_number` · `rnd_special_institute_name` · `rnd_task_contribution` |
| 표준특허 | `3GPP` / `TS 38.300` / `자율주행 … 표준` / `현대자동차주식회사` / `2026-01-01` | `standard.standardization_organization` / `standard_numbers` / `standard_technology_name` / `standard_declarants` / `standard_declaration_date` |
| **심판** | `무효심판` | `trial.trial_type`(심판종류) |
| ↳ | `계속 중` | `trial.trial_status`(심판상태) |
| ↳ | `2026당0000` | `trial.trial_number_text`(심판번호문자) · 자연키는 `trial.trial_number` |
| ↳ 유무 | 블록 표시 여부 | `custom.has_trial`(Y/N) |
| 관련출원(US) | `US 9000013` / `2021-02-02` / `Continuation` / `Granted` | `rel_appl.registration_number` / `registration_date` / `classification` / `status` |
| 도면 | 이미지 | `custom.drawing_url` · `primary_drawing_url` (대안 `patent_image.scrape_site`+`key_name`) |
| ↳ | `FIG 1` | `⚠파생` — 이미지 순번(화면 생성) |
| 청구범위 | 청구항 본문 | `claim.claim` |
| ↳ | `독립항 — 제1항` / `종속항 (제2항 → 제1항 인용)` | `⚠파생` — 원문 패턴 분해(대표항 `kpa_bibliographic.representation_claim_number`) |
| 서지 · 존속기간(예상)만료일 | `2036-04-07` | `⚠파생` — 등록일 + 20년 (연장 시 `term_extension`) |
| 서지 · 타임라인 | 6칸 일자 | `⚠파생` — 위 일자 컬럼 조합 |
| 패밀리 · 국가별 건수 | `전체(4) KR(1) …` | `custom.family_document_count` · `family_country_count` + `family` 국가 집계 |

### 12-1. 미수집으로 UI에서 제거한 항목

| 제거 항목 | 근거(갱신본 재확인) |
|---|---|
| 인용·피인용 문헌의 **명칭** | `citation`·`kpa_citation`·`ctltr` 모두 명칭 컬럼 없음 |
| 상세설명 **하위섹션 6개** | `specification` 단일 컬럼, 섹션 컬럼 없음 |
| 도면 **캡션** | 위와 동일(`specification` 파싱 필요) |
| 도면 **부호의 설명** | 전용 컬럼 없음 |
| (기존) 특허평가 · 소송/분쟁 | 대응 컬럼 부재 |

**유지 결정**: 청구범위 독립/종속 구조(대표항 번호 컬럼 수집 · 선행기술조사 핵심) · 계산 파생(존속기간만료 · 타임라인 · 도면 라벨 · 패밀리 집계).
