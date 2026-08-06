# 특허 상세페이지 QC — 적재 데이터 ↔ API ↔ 화면 대조

- **대상**: 개발서버 배포본 `https://www.copykiller.com/patent-front/patents/{literatureNumber}`
- **표본 문헌**: `KR 10-2620137 B1` (ＴＳＮ 트래픽 스케줄링에 대한 구현 및 평가 방법 / 네스트필드(주))
- **API**: `GET https://accounts.copykiller.com/api/service/axp/patent-searches/{literatureNumber}` (Bearer 인증)
- **원본**: `docs/데이터/patent.json` — **1,804건 전수**(122MB). 전건 KR·등록(`register_status`=`REG` 100%)
- **방법**: ① 원본 레코드 ↔ API 응답 필드 대조 ② API ↔ 렌더 화면 대조 ③ 원본 1,804건 전수 채움률·형식 통계
- **작성**: 2026-08-06

## 결론

**API·프런트는 원본을 정확히 전달한다.** 승격 컬럼 12개 · `meta_json` 섹션 15개 · 서지 24필드가 **값·길이까지 전건 일치**했다. 따라서 화면에서 보이는 문제는 다음 둘로만 나뉜다.

1. **표시 로직 결함** — 데이터는 정상인데 화면이 잘못 표현 (§A, 6건)
2. **표시 정책 미정** — 데이터 특성상 판단이 필요 (§B, §C)

## 범위

| 구분 | 항목 | 처리 |
|---|---|---|
| **제외** | 원문 PDF(`source_link` 0%) · 도면 이미지(`figures[].image` 0%) · 부호의 설명(`figures[].ref_signs` 0%) | **미적재 정상** — 조치 불필요 |
| **제외** | 인용·피인용(명칭 0%, 국가 중복 표시 등) | 이번 범위 제외 |
| **대상** | 표시 로직 · 표시 정책 | 아래 §A~§E |

---

## A. 표시 로직 결함 (6건)

### A-1. 문헌종류 코드가 그대로 노출

- **현재**: `문헌종류  B1`
- **기대**: `문헌종류  등록특허공보`
- **근거**: 원본 `document_kind`는 전건 코드. **`B1` 1,801건 / `Y1` 3건**. 문헌번호 형태와 100% 정합 — `B1`↔`10-`(특허) 1,801건, `Y1`↔`20-`(실용) 3건
- **치환식** (§C에 상세)

### A-2. 지정국 행 반쪽 렌더

- **현재 DOM**: `["지정국", "—", ""]` — 3셀 중 마지막이 빈 셀. 「서열목록」 라벨·값이 없다
- **기대**: 2열(라벨·값)×2쌍 규칙 유지 → `지정국 | — | 서열목록 | —`
- **근거**: 다른 서지 행은 모두 4셀. 이 행만 셀 누락

### A-3. 제목 영역 국가코드 중복

- **현재**: `등록공고 · KR   KR 10-2620137 B1`
- **기대**: `등록공고 · KR 10-2620137 B1` (국가는 배지로만, 또는 번호 단독)
- **근거**: `literature_number`가 **전건 국가 접두 포함**(`KR 10-…`). 여기에 `country_code`를 덧붙여 2회 노출
- **치환식**: `표시번호 = literature_number` (앞에 `country_code` 결합 금지)

### A-4. 공개/공고번호 ↔ 공개/공고일 짝 어긋남 ★

- **현재**: `공개/공고번호 10-2023-0126008`(공개번호) + `공개/공고일 2024-01-02`(**공고일**), 공개일(2023-08-29)은 「문헌일」에 배치
- **원인**: 적재 규격이 `publication_number = (open_number or publication_number)` 로 **서로 다른 계열을 한 필드에 합침**. 실제 원본 1,804건 형식 분포:

| `publication_number` 형식 | 건수 | 의미 | 문헌일(`open_date`) |
|---|---|---|---|
| `10-YYYY-NNNNNNN` | 985 (54%) | **공개**번호 | 있음 983 / 없음 2 |
| `10-NNNNNNN` | 314 (17%) | **공고**번호 — **314건 전부 `register_number`와 동일** | 있음 215 / 없음 99 |
| `WO YYYY/NNNNNN` | 113 (6%) | **국제공개**번호 | 혼재 |
| 없음(null) | 392 (21%) | 공개공보 미발생 | 없음 392 |

- **부작용**: 공고번호 계열 314건은 「공개/공고번호」에 **등록번호와 같은 값**이 나와 「등록번호」 행과 중복 표시된다
- **치환식**: §C-2

### A-5. 상세설명 중복 출력

- **현재**: 하위섹션 6개(기술분야·배경기술·해결하려는 과제·과제의 해결 수단·발명의 효과·도면의 설명) 표시 후, 「발명의 구체적인 내용」에 `specification_text` **전문을 재출력** → 같은 내용을 두 번 읽게 된다
- **근거**: 전문에 섹션 표제가 포함된 문헌 **1,250건(69%)**. 즉 전문 안에 하위섹션 내용이 그대로 들어 있다
- **치환식**: §C-4

### A-6. 도면 수 `0건` ↔ 도면 패널 `(1)` 모순

- **현재**: 서지 `도면 수 0건`, 도면 패널 헤더 `도면 (1)`, 본문 `도면 이미지 없음`
- **근거**: `drawing_count`는 **전건 `0`**(도면 미적재). `figures`는 설명만 담긴 **1원소**(전건 1개, 도면별 분리 0%) → 화면이 이를 도면 1장으로 계수
- **치환식**: §C-5

---

## B. 「문헌일은 원래 꼭 있는 값인가?」 — 아니다

**결론: 문헌일(`open_date`)은 필수값이 아니다.** 공개공보 없이 등록된 문헌에는 공개일이 존재하지 않는다. 원본 1,804건에서 **없음 494건(27%)** 이며, 내역은 전부 설명된다.

| 유형 | 건수 | 판정 |
|---|---|---|
| `publication_number` 자체가 null | **392** | **정상** — 공개공보 미발생(조기 등록). 표본 확인: `KR 10-2619202 B1`(출원 2022-11-25 → 등록 2023-12-22, 공개번호·공개일 모두 없음) |
| `publication_number`가 **공고번호**(=등록번호) 형식 | **99** | **정상** — 애초에 공개 정보가 아니라 공고 정보 |
| `publication_number`가 **공개번호** 형식인데 문헌일 없음 | **2** | **결손 의심** — 공개번호가 있으면 공개일이 있어야 한다 |
| 국제공개(WO) 형식 중 문헌일 없음 | 1 | 확인 필요 |

→ **화면 처리 원칙**: 문헌일은 `—`가 정상 상태(27%)이므로 결손으로 취급하지 않는다. 단 라벨을 데이터 의미에 맞춘다(§C-2). 공개번호형식 + 문헌일 없음 **2건**만 적재 측 확인 대상.

---

## C. 치환식 (있는 데이터로 바로 적용 가능)

### C-1. 문헌종류

```
문헌종류 =
  CASE document_kind
    WHEN 'B1' THEN '등록특허공보'          -- 1,801건 · 문헌번호 10-(특허) 100% 정합
    WHEN 'Y1' THEN '등록실용신안공보'      -- 3건 · 문헌번호 20-(실용) 100% 정합
    ELSE document_kind                     -- 미관측 코드는 원값 노출
  END
```

**주의**: 현재 표본은 **등록계(REG)만** 1,804건이라 `A`(공개특허공보)·`U`(공개실용신안공보) 등 **공개계 코드는 관측되지 않았다.** 공개 문헌 적재 후 코드 도메인을 확인해 매핑을 확장해야 한다(추정으로 채우지 않음).

### C-2. 공개/공고번호·일자 분리

```
계열 판정:
  IF   publication_number ~ '^\d{2}-\d{4}-\d{7}$'   → 공개계   (라벨 '공개번호',     일자 = open_date         → 라벨 '공개일')
  ELIF publication_number ~ '^WO \d{4}/\d{6}$'      → 국제공개 (라벨 '국제공개번호', 일자 = open_date         → 라벨 '국제공개일')
  ELIF publication_number ~ '^\d{2}-\d{7}$'         → 공고계   (라벨 '공고번호',     일자 = publication_date  → 라벨 '공고일')
  ELSE (null)                                        → 행 숨김 또는 '—'

문헌일 행:
  문헌일 = COALESCE(open_date, '—')     -- 27%가 정상적으로 없음(§B)
  ※ 공고계·null 계열에서는 「문헌일」 대신 「공고일 = publication_date」를 쓰는 것이 의미상 정확
```

- 공고계에서 `publication_number == register_number`(314건 전부)이므로, 등록번호 행과 중복되면 **공고번호 행을 숨기는 것**도 선택지다

### C-3. 권리상태

```
권리상태(표시)  = legal_status
   도메인(관측): 등록공고 1,786 · 정정공고 14 · 특허취소신청 2 · 특허취소신청 결정 1 · 연차료납부 1
등록계 판정      = (register_status = 'REG')    -- 전건 REG → 표시에는 쓰지 않고 분기용으로만
```

- `register_status`는 **전건 `REG`** 로 정보량이 없다 → 화면에 노출하지 않는다
- `legal_status` 값은 **공보·절차 상태**다. 목업의 「권리상태」(존속/소멸 도메인)와 성격이 달라, **라벨을 `법적 상태`로 바꾸거나** 「권리상태 = 등록(REG 파생)」 + 「법적 상태 = legal_status」 2행으로 나누는 것이 정확하다 → **결정 필요**

### C-4. 상세설명 중복 제거

```
발명의 구체적인 내용 =
  PARSE(specification_text, '발명을 실시하기 위한 구체적인 내용' 이후 구간)
대안:
  specification_text 전문은 「원문 전체 보기」 접기(collapse)로 분리하고, 기본 노출은 하위섹션만
```

- 근거: 전문에 섹션 표제 포함 1,250건(69%). 하위섹션 5개는 이미 전용 컬럼으로 채워져 있다(`technology_field` 99% · `background_art` 99% · `problem_to_solve` 93% · `solution_to_problem` 94% · `effect_of_invention` 89%)

### C-5. 도면 계수·패널

```
도면 수(서지)   = drawing_count + '건'                 -- 현재 전건 0
도면 패널 표시  = EXISTS(figures[].image)              -- 현재 0% → 패널 숨김 또는 '도면 준비 중'
도면의 설명     = figures[0].description               -- 도면별 분리 전이므로 '상세설명 > 도면의 설명'에서만 노출
도면 라벨       = 'FIG ' + (순번+1)                    -- 이미지 적재 후 유효
```

- `figures` 배열은 전건 **1원소**이고 그중 **1,608건(89%)** 이 하나의 `description`에 `도 1 … 도 N`을 뭉쳐 담고 있다 → 도면별 썸네일·캡션 전제와 맞지 않음

### C-6. 분류코드 표기 정규화 (선택)

```
표시코드 = REGEXP_REPLACE(code, '^([A-Z]\d{2}[A-Z])-0*(\d+)/(\d+)$', '\1 \2/\3')
   예) 'H04L-047/283' → 'H04L 47/283'
```

- 원본 IPC 코드 **7,629개 전부** `^[A-Z]\d{2}[A-Z]-\d+/\d+$` 단일 형식 → 변환 규칙 하나로 충분

### C-7. 패밀리 국가 추출 (있는 데이터로 국가별 집계 가능) ★

```
국가       = SUBSTRING(family.items[].literature_number, 1, 2)
국가별 건수 = COUNT(*) GROUP BY 국가
전체 건수   = family.document_count
```

- 근거: 패밀리 문헌번호 **6,427개 전건**이 2자 국가 접두를 갖는다 — `US 1,426 · JP 1,153 · CN 870 · KR 794 · EP 680 · WO 446 · TW 173 · AU 139 · CA 119 · IL 77 · MX 59 · BR 58 …` (형식 불명 0건)
- → **국가 탭·알약을 현재 데이터로 구현할 수 있다.** 목업의 「총건수 기계 배분」 파생은 폐기 대상

---

## D. 있는 데이터로 화면을 채우는 방법 (필드별)

채움률은 원본 1,804건 기준. **조건부**는 값이 있는 문헌에만 행을 렌더한다는 뜻이다.

| 화면 항목 | 사용 필드 | 채움률 | 활용 방법 |
|---|---|---|---|
| 문헌번호 | `literature_number` | 100% | 단독 표시(국가 결합 금지, §A-3) |
| 국가 | `country_code` | 100% | 배지로만 |
| 발명의 명칭 | `invention_title` / `invention_title_eng` | 100% / 76% | 국문 기본, 영문 병기(76%만) |
| 권리상태 | `legal_status` | 100% | 5종 도메인 그대로(§C-3) |
| 문헌일 / 공개·공고 | `open_date` 72% · `publication_number` 78% · `publication_date` 100% | — | 계열 판정 후 라벨·짝 맞춤(§C-2) |
| 출원번호·출원일 | `application_number`·`application_date` | 100% | 그대로 |
| 등록번호·등록일 | `register_number`·`register_date` | 100% | 그대로 |
| 문헌종류 | `document_kind` | 100% | 라벨 치환(§C-1) |
| 존속기간(예상)만료일 | `expiration_date` | 100% | 그대로(적재 시 등록일+20년 계산 완료) |
| 청구항 수 | `claim_count` | 100% | `+ '개'` |
| 도면 수 | `drawing_count` | 100%(값 0) | `+ '건'`, 패널 계수와 일치시킴(§C-5) |
| 심사청구일 | `original_examination_request_date` | 30% | **조건부** |
| 우선권주장일 | `priority_application_date` | 12% | **조건부** |
| 원출원번호 | `original_application_number` | 7% | **조건부**(분할·변경 문헌) |
| 국제출원번호 | `international_application_number` | 2% | **조건부** |
| 번역문 제출일 | `translation_submit_date` | 2% | **조건부** |
| 서열목록 | `sequence_listing_yn` | 1% | **조건부** · `CASE 'Y' THEN '있음' ELSE '—'` |
| 요약 | `abstract` | 100% | 원문 그대로(개행 있는 문헌 17%) |
| 상세설명 하위섹션 | `technology_field`·`background_art`·`problem_to_solve`·`solution_to_problem`·`effect_of_invention` | 99·99·93·94·89% | 그대로. 없는 섹션은 행 숨김 |
| 발명의 구체적인 내용 | `specification_text` | 100% | 구간 파싱 또는 접기(§C-4) |
| 청구범위 | `claims[].number/text/depends_on` | 100% | 독립/전체 토글 그대로. **`depends_on` 파싱 정확**(§F-1) |
| 패밀리 | `family.document_count` + `items[].literature_number` | 728건 | 문헌번호 + **국가 접두로 국가별 집계**(§C-7) |
| 분류코드 | `classification_code.ipc`·`cpc` | 100% | 표기 정규화(§C-6) |
| 인명 | `related_person.applicant/inventor/agent` | 100% | 출원인·발명자(다수)·대리인. 발명자 주소는 **성명별 개별 행**(현재 구현이 목업보다 정확) |
| 행정처리 | `admin_process`(단일 객체) | 66% | **1건 표시로 확정** — 이력 목록 아님 |
| 심판 | `trial.type/status/number` | 10건(0.5%) | **조건부**. 관측 예: `{type:'거절결정불복', status:'심결', number:'2023101001625'}` — 번호는 숫자형(`trial_number`), `2023원…` 표기는 없음 |
| 권리변동 이력 | `right_history.change_histories[].name/date` | 7건 | **조건부** · `status`는 전건 null → 2열(일자·권리자)만 |

## E. 데이터에 없는 것 — 활용 불가 (행·블록 숨김)

| 항목 | 채움률 | 화면 처리 |
|---|---|---|
| 원문 PDF (`source_link`) | **0%** | 버튼 숨김 (적재 예정) |
| 도면 이미지 (`figures[].image`) | **0%** | 패널 숨김 또는 '도면 준비 중' (적재 예정) |
| 부호의 설명 (`figures[].ref_signs`) | **0%** | 블록 숨김 (적재 예정) |
| 권리변동 유무 (`has_ownership_change`) | **0%** | 행 숨김 |
| 최종처분상태 (`final_disposal`) | **0%** | 행 숨김 |
| 출원구분 (`application_flag`) | **0%** | 행 숨김 |
| 실시권 등록일 (`license_registration_date`) | **0%** | 행 숨김 |
| 지정국 (`designated_country`) | **0%** | 행 숨김 |
| 특허고객번호 (`patent_customer_number_kr`) · 심사관 (`examiner.name`) | 0% | 행 숨김 |
| 패밀리 명칭·출원일 (`items[].invention_title`·`application_date`) | **0%** | 열 숨김 — 문헌번호·국가만 표시 |
| 권리변동 상태 (`change_histories[].status`) | **0%** | 열 숨김 |
| 표준특허 · US 관련출원 · US 가출원 · JP · EP | 0% (전건 KR) | 블록 숨김 |
| 인용·피인용 명칭 | 0% | **이번 범위 제외** |

→ **원칙**: 0% 필드는 `—`로 채우기보다 **행·블록을 숨긴다**. 현재 화면은 서지 5행이 모두 `—`로 남아 정보 없는 행이 화면을 차지한다.

## F. 앞선 판정 정정

1. **청구항 `depends_on` 24% 미채움 → 결함 아님.** `제N항에 있어서` 패턴인데 `depends_on`이 빈 케이스는 **0건**. 24%는 실제로 종속항이 없는(전부 독립항) 문헌이다. 종속항 파싱은 정확하다
2. **요약 문단 붙음 → 원본 특성.** 원본 `abstract`에 개행이 있는 문헌은 **17%(320건)** 뿐이다. 화면 결함이 아니며, 문장 경계 후처리는 원문 훼손 위험이 있어 권하지 않는다
3. **명칭 전각 문자**(`ＴＳＮ`)는 **7건(0.4%)** — 정규화 우선순위 낮음

## 부록. 원본 1,804건 채움률 요약

| 구분 | 100% | 부분 | 0% |
|---|---|---|---|
| 승격 컬럼 | `literature_number`·`country_code`·`invention_title`·`abstract`·`specification_text` | `invention_title_eng` 76% · `technology_field` 99% · `background_art` 99% · `problem_to_solve` 93% · `solution_to_problem` 94% · `effect_of_invention` 89% | `source_link` |
| 서지 | `register_status`·`legal_status`·`application_number`·`application_date`·`publication_date`·`register_number`·`register_date`·`document_kind`·`expiration_date`·`claim_count`·`drawing_count`(값 0) | `publication_number` 78% · `open_date` 72% · `original_examination_request_date` 30% · `priority_application_date` 12% · `original_application_number` 7% · `international_application_number`·`translation_submit_date` 2% · `sequence_listing_yn` 1% | `has_ownership_change`·`final_disposal`·`application_flag`·`license_registration_date`·`designated_country` |
| 섹션 | `related_person`·`claims`·`family`·`citation`·`classification_code`·`right_history` | `figures` 95% · `admin_process` 66% · `trial` 0.5% | `standard`·`us_related_apps`·`us_provisional`·`jp`·`ep` |

**구조 품질**: `figures` 원소 2개 이상(도면별 분리) **0%** · `image` **0%** · `ref_signs` **0%** · 설명 뭉침 89% · `drawing_count=0`인데 `figures` 존재 95%
