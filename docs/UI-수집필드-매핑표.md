# 특허 상세페이지 UI 항목 ↔ 수집 DB 필드 매핑표

- **목적**: 특허 검색결과 **상세페이지(`PatentDetail.tsx`)** 에 표시되는 각 UI 항목을 **수집 DB 컬럼**과 1:1로 매핑한다. 개발자가 이 표만 보고 각 표시값을 **어느 테이블·컬럼에서 불러올지** 알 수 있게 한다.
- **출처(정본)**: `[BLK] 특허 수집 데이터베이스 명세서`(원본 33p·254 컬럼 — KR 카탈로그 중심 + US/EP/JP 엔티티). 매핑은 `docs/기능정의서.md`「특허 · 상세페이지」④와 동일하며, **원본 명세서 컬럼 존재를 전수 확인**했다.
- **검증 결과(역방향)**: UI 렌더 필드 중 수집 근거가 없는 항목 **0건**. 계산·파싱 파생 3종만 컬럼 비대상(아래 `⚠파생`). 과거 `grade`(특허평가)·`dispute`(소송)는 명세서에 컬럼이 없어 **삭제 완료**.
- **표기**: `수집`=수집 컬럼 직결 · `⚠파생`=수집값에서 계산/파싱(컬럼 아님) · `⚠목업`=필드는 있으나 실데이터 연동 대기 · `조건`=특정 국가/상태에서만 렌더.
- **테이블 약칭**: `bibliographic`(서지 자연키 1행) · `custom`(국가고유 스칼라) · `KPA_*`(KR 영문보강) · `related_person`(인명, row별 classification) · `REP_APP`=REPRESENTATIVE_APPLICANT · US/EP/JP는 국가별 고유 테이블.

---

## 1. 제목 영역 (PAT-DET-020)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 권리상태(평문) | `status` / `rightStatus` | `bibliographic.register_status` (+ `custom.legal_status`) | 수집 |
| 국가 | `country` | `bibliographic.country_code` | 수집 |
| 문헌번호 | `number` | `bibliographic.literature_number` | 수집 |
| 발명의 명칭 | `title` | `bibliographic.invention_title` (+ `_eng`) | 수집 |
| 원문 PDF 다운로드 | (버튼) | ⚠미정 — 원문 PDF URL 컬럼 확인 필요 | ⚠목업 |

## 2. 서지사항 (PAT-DET-050)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 문헌번호 / 문헌일 | `number` / `publicationDate` | `bibliographic.literature_number` / `open_date` | 수집 |
| 출원번호 / 출원일 | `applicationNo` / `applicationDate` | `bibliographic.application_number` / `application_date` | 수집 |
| 공개·공고번호 / 일 | `publicationNo` / `publicationDate` | `bibliographic.open_number` / `publication_number`, `publication_date` | 수집 |
| 등록번호 / 등록일 | `registerNo` / `registerDate` | `bibliographic.register_number` / `register_date` | 수집·조건(등록계) |
| 문헌종류 | `(docKind 파생: status)` | `bibliographic.document_kind` | 수집 |
| 권리상태 | `rightStatus` | `bibliographic.register_status` (+ `custom.legal_status`) | 수집 |
| 원출원번호 | `originalAppNo` | `bibliographic.original_application_number` | 수집·조건(분할·변경) |
| 국제출원번호 | `intlAppNo` | `bibliographic.international_application_number` | 수집·조건(PCT/국제) |
| 우선권주장일 | `priorityDate` | `priority.priority_application_date` | 수집·조건 |
| 심사청구일 | `examRequestDate` | `bibliographic.original_examination_request_date` | 수집 |
| 존속기간(예상)만료일 | `expirationDate` | **⚠파생** — 등록일 + 20년 계산(수집 컬럼 없음) | ⚠파생 |
| 권리변동(유무) | `rightChange` | `custom.has_ownership_change` | 수집 |
| 최종처분상태 | `finalDisposal` | `bibliographic.final_disposal` | 수집 |
| 청구항 수 | `claimCount` | `bibliographic.claim_count` (KR 보강 `KPA_BIBLIOGRAPHIC.claim_count`) | 수집 |
| 출원구분 | `applicationFlag` | `bibliographic.application_flag` | 수집 |
| 번역문 제출일 | `translationSubmitDate` | `bibliographic.translation_submit_date` | 수집·조건(외국어) |
| 도면 수 | `drawingCount` | `KPA_BIBLIOGRAPHIC.drawing_count` | 수집 |
| 실시권 등록일 | `licenseRegDate` | `custom.license_registration_date` | 수집·조건 |
| 지정국 | `designatedCountries` | `DESIGNATED_COUNTRY.designated_country`(KR) · EP `DSGN.national_name` | 수집·조건(국제/EP) |
| 서열목록 | `sequenceListing` | `custom.sequence_listing_yn` | 수집·조건 |
| 우선권 주장(목록) | `priorityList` | `priority`(priority_application_country_code · number · date) · JP `PRIR` | 수집·조건 |
| 타임라인 | `(timeline 파생)` | **⚠파생** — 위 일자 컬럼 조합(`client`) | ⚠파생 |

## 3. 인명정보 (PAT-DET-060) — 출처 `related_person`(row별 `classification`)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 출원인 / 주소 | `applicant` / `applicantAddress` | `related_person[APPLICANT].name` / `.address` | 수집 |
| 특허고객번호(KR) / 식별기호(JP) | `applicantCode` (`customerNo`) | `REP_APP.patent_customer_number` / `custom(JP).applicant_identifier` | 수집·조건(국가) |
| 대표출원인 | `repApplicant` | `REP_APP.representative_applicant_name` | 수집 |
| 발명자 / 주소 | `inventors` / `inventorAddress` | `related_person[INVENTOR].name` / `.address` | 수집 |
| 대리인 / 주소 | `agent` / `agentAddress` | `related_person[AGENT].name` / `.address` | 수집 |
| 심사관 | `examiner` | `related_person[EXAMINER].name` (또는 `custom.examiners`) | 수집 |

## 4. 요약 · 상세설명 · 청구범위 (PAT-DET-070/080/090)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 요약 | `abstract` | `abstract.abstract` (JP/CP 영문요약 `e_abstract`) | 수집(현재 목업) |
| 상세설명(본문) | `description` | `specification.specification` (KIPRIS는 전문 PDF URL) | 수집·⚠목업 |
| 상세설명 하위섹션(기술분야·배경·과제·해결수단·효과·구체적내용) | `aiPurpose`·`aiSolution`·`aiEffect` 등 | **⚠파생** — `specification` 파싱(구조 분해 규칙 정의 필요) | ⚠파생 |
| 도면의 설명 | `figures[].desc` | **⚠파생** — `specification` 파싱 | ⚠파생 |
| 청구범위(전체) | `claims` | `claim.claim` | 수집·⚠목업 |
| 대표청구항 · 독립/종속 구조 | `repClaim` / `claims[].dependsOn` | **⚠파생** 구조 분해 (대표청구항 번호 `KPA_BIBLIOGRAPHIC.representation_claim_number`) | ⚠파생 |

## 5. 패밀리 정보 (PAT-DET-100)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 국가별 건수 | `family` | `custom.family_document_count` / `family_country_count` | 수집 |
| 패밀리 문헌(국가·번호·일자·명칭) | `familyList` | `family`(family_country_code · family_literature_number · application_date · invention_title) | 수집 |

## 6. 인용·피인용 (PAT-DET-110)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 인용 / 피인용(특허) | `citingList` / `citedList` | KR `KPA_CITATION`(citation_literature_number · country_code) · JP/US `CTLTR` | 수집·⚠목업 |
| 비특허 인용 | `citingList`(kind=npl) | US `CTLTR_ETC.other_citations` · `PRIOR_TECHNOLOGY_DOCUMENT.non_patent_reference_text` | 수집 |
| 선행기술문헌 | `priorArtDocs` | `PRIOR_TECHNOLOGY_DOCUMENT`(prior_technology_document_number · country) | 수집·조건 |

## 7. 분류코드 (PAT-DET-120)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| IPC | `ipc` / `ipcList` | `ipc.ipc_number` (KR `KPA_IPC.ipc_code`) | 수집 |
| CPC | `cpc` / `cpcList` | `CPC.cpc_code` (JP/EP `custom.cpc_code`) | 수집 |
| JP FI / F-term / 테마 | `countryClassifications` | `FI.fi_code` / `FTERM.fterm_code` / `TEMA.tema_code` | 수집·조건(JP) |
| US UPC | `countryClassifications` | `UPC.upc_code` | 수집·조건(US) |
| EP EPC | `countryClassifications` | `EPC.epc_code` | 수집·조건(EP) |

## 8. 기타정보 (PAT-DET-130) — 있는 항목만 조건부 렌더

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 대리인 주소 | `agentAddress` | `related_person[AGENT].address` | 수집 |
| 권리변동 이력 | `rightChangeList` | `RIGHT_CHANGE`(change_type · name · change_date) | 수집·조건 |
| 권리이전 이력 | `rightTransferList` | `RIGHT_TRANSFER`(document_name · change_before/after_content · registration_number/date) | 수집·조건 |
| 행정처리(수발신) | `adminProcess` | `ADMINISTRATIVE_PROCESS`(receipt_send_document_name · date · proc_status) | 수집·조건 |
| 국가 R&D | `rnd` | `RND`(rnd_task_name · number · department · managing_institute · duration) | 수집·조건(KR) |
| 표준특허 | `standard` | `STANDARD`(standardization_organization · standard_numbers · technology_name · declarants · date) | 수집·조건 |
| 심판(유무) | `trial` | `custom.has_trial` | 수집 |
| US 관련출원 | `usRelatedApps` | `REL_APPL`(registration_number · date · classification · status) | 수집·조건(US) |
| US 가출원 | `usProvisional` | `CUSTOM(US).provisional_application_numbers` | 수집·조건(US) |
| JP 공보판 / 대리인 구분 | `jpEdition` / `agentCategory` | `CUSTOM(JP).edition` / `agent_category` | 수집·조건(JP) |
| EP 정리번호 / 출원·공개 언어 | `epFileRef` / `epFilingLanguage` | `CUSTOM(EP).applicant_file_reference` / `filing_language` | 수집·조건(EP) |

## 9. 도면 (PAT-DET-140)

| UI 항목 | 렌더 필드 `data.*` | 수집 컬럼 · 테이블 | 성격 |
|---|---|---|---|
| 도면 이미지 | `figures` | `patent_image`(scrape_site · key_name → S3 URL) / `custom.drawing_url` | 수집·⚠목업(현재 절차 SVG) |
| 대표도면 | `figures[0]` | `custom.primary_drawing_url` | 수집·⚠목업 |
| 도면 부호의 설명 | `refSigns` | **⚠파생** — `specification` 파싱 | ⚠파생 |

---

## 10. 요약 통계 및 잔여 과제

- **UI 렌더 필드 전수 대조 결과**: 근거 없는 항목 **0건**. 전부 (a) 수집 컬럼 매핑 또는 (b) 문서화된 계산·파싱 파생(`⚠파생` 6개: 존속만료·타임라인·상세설명 하위섹션·도면의 설명·대표청구항 구조·도면 부호설명).
- **제외 확정(수집 컬럼 없음)**: `grade`(특허평가)·`dispute`(소송/분쟁) — 명세서에 컬럼 부재로 UI에서 삭제 완료. (심판 `trial`은 `custom.has_trial`로 수집되어 유지)
- **잔여 과제(정방향 — 수집엔 있으나 UI 미반영/목업)**:
  - **P1**: 실 도면 이미지(`patent_image`/`drawing_url`/`primary_drawing_url`) 연동 — 현재 절차 SVG 목업, `imageUrl` 필드 미도입.
  - **P1(목업→실)**: `specification`(원문/PDF)·`claim`(청구항 원문)·인용(`KPA_CITATION`/`CTLTR`) 실데이터 연동.
  - **P3**: 기술이전/도입 희망(`technology_transference`) · KPA_IPC 상세(`ipc_version`/`level`) — 미노출.
- **소스 노출 방식(연동 시 결정)**: 위 컬럼은 수집 DB에 존재하나, 상세페이지로 전달할 **검색 hit `columns` 패스스루 vs 상세 조회 API**는 미설계.
