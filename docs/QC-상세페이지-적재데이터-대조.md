# 특허 상세페이지 QC — 적재 데이터 ↔ API ↔ 화면 대조

- **대상**: 개발서버 배포본 `https://www.copykiller.com/patent-front/patents/{literatureNumber}`
- **표본 문헌**: `KR 10-2620137 B1` (ＴＳＮ 트래픽 스케줄링에 대한 구현 및 평가 방법 / 네스트필드(주))
- **API**: `GET https://accounts.copykiller.com/api/service/axp/patent-searches/{literatureNumber}` (Bearer 인증)
- **원본**: `docs/데이터/patent.json` — **1,804건 전수**(122MB). 전건 KR·등록(`register_status`=`REG` 100%)
- **방법**: ① 원본 레코드 ↔ API 응답 필드 대조 ② API ↔ 렌더 화면 대조 ③ 원본 1,804건 전수 검사(채움률·형식·정합·논리)
- **부속 자료**: [`qc-원본오류.csv`](qc-원본오류.csv) (레코드 단위 4,574행) · [`qc-표시오류.csv`](qc-표시오류.csv) (항목 단위 7건)
- **작성**: 2026-08-06

## 결론

**API·프런트는 원본을 정확히 전달한다.** 승격 컬럼 12개 · `meta_json` 섹션 15개 · 서지 24필드가 **값·길이까지 전건 일치**했다. 따라서 결함은 두 갈래로만 나뉜다.

| 구분 | 소재 | 건수 | 문서 |
|---|---|---|---|
| **원본 오류** | 적재 데이터(`patent.json`) 자체가 잘못됨 | 5유형 **4,574행** | §A · [CSV](qc-원본오류.csv) |
| **표시 오류** | 원본은 정상인데 화면이 잘못 표현 | 7유형 (최대 전건 영향) | §B · [CSV](qc-표시오류.csv) |

## 범위

| 구분 | 항목 | 처리 |
|---|---|---|
| **제외** | 원문 PDF(`source_link` 0%) · 도면 이미지(`figures[].image` 0%) · 부호의 설명(`figures[].ref_signs` 0%) | **미적재 정상** — 오류 아님 |
| **제외** | 인용·피인용(명칭 0%, 국가 중복 표시 등) | 이번 범위 제외 |
| **대상** | 원본 오류 · 표시 오류 · 표시 정책 | §A ~ §F |

---

## A. 원본 오류 (적재 데이터 결함) — 5유형 4,574행

전수 검사에서 검출된 것만 싣는다. 검사한 항목 중 **오류 0건**인 것은 §A-6에 따로 적었다.
레코드 단위 전체 목록은 [`qc-원본오류.csv`](qc-원본오류.csv) (컬럼: `문헌번호 · 오류유형 · 상세 · 관련값`).

| 코드 | 오류 | 건수 | 비율 | 판정 근거 |
|---|---|---|---|---|
| **E7** | `figures` 는 있는데 `drawing_count` 가 `0` | **1,717** | 95% | 도면 설명이 적재된 문헌인데 도면 수가 0 → 두 값이 모순 |
| **E8** | `figures` 원소 1개에 **여러 도면 설명이 뭉쳐 있음** | **1,603** | 89% | 규격은 도면별 배열. `description` 안에 `도 N` 패턴 3개 이상 |
| **E4** | `claim_count` ≠ `claims` 배열 길이 | **1,245** | 69% | **방향이 전부 `claim_count < len(claims)`**(더 큰 사례 0건) |
| **E9** | 하위섹션이 비었는데 전문에 **해당 표제가 존재** | **7** | 0.4% | 섹션 파싱 누락 |
| **E10** | 공개번호는 있는데 **문헌일(공개일)이 없음** | **2** | 0.1% | 공개번호가 있으면 공개일이 있어야 함 |

### E7 · E8 — 도면 적재 구조

- **E7**: `drawing_count`는 **전건 `0`**인데 `figures`는 1,717건(95%)에 존재 → 서지 「도면 수 0건」과 도면 패널이 어긋난다
- **E8**: 단일 원소 안 설명 패턴 — **서술형(`도 1은 …이다`) 1,600건** · 콜론형(`도 1 : …`) 3건 · 2건 뭉침 71건 · 단일 도면 43건
- 최다 사례: `KR 10-2649972 B1` **249개** · `KR 10-2650076 B1` 228개 · `KR 10-2649543 B1` 215개 · `KR 10-2730699 B1` 134개 · `KR 10-2623680 B1` 122개
- → 도면 이미지 적재 시 **도면 단위 분리**가 전제되어야 하며, 현재 구조로는 도면별 캡션·썸네일을 만들 수 없다

### E4 — 청구항 수 불일치 (성격 확인 필요)

차이 분포: 일치 559건 · `-1` 359 · `-2` 319 · `-3` 162 · `-4` 138 · `-5` 65 · `-6` 56 · `-7` 46 · `-8` 23 · `-10` 25 …

| 문헌번호 | `claim_count` | `claims` 길이 | 차이 |
|---|---|---|---|
| `KR 10-2636917 B1` | 20 | 98 | 78 |
| `KR 10-2649972 B1` | 6 | 81 | 75 |
| `KR 10-2650369 B1` | 12 | 82 | 70 |
| `KR 10-2635013 B1` | 18 | 82 | 64 |
| `KR 10-2620415 B1` | **1** | **46** | 45 |
| `KR 10-2650496 B1` | 150 | 183 | 33 |

- **방향이 100% 한쪽**(항상 `claim_count`가 작음)이라 단순 오적재로 보기 어렵다. 두 값의 **정의 차이**(예: 등록 시점 청구항 수 vs 명세서 전체 청구항)일 가능성이 있으므로 **적재 정의 확인이 필요**하다 — 추정으로 단정하지 않는다
- 다만 화면에는 두 값이 **동시에 노출**된다(서지 「청구항 수」 vs 청구범위 탭의 실제 항 수) → 사용자가 불일치를 바로 본다

### E9 — 섹션 파싱 누락 7건

| 문헌번호 | 빈 섹션 |
|---|---|
| `KR 10-2620102 B1` · `KR 10-2624133 B1` | `technology_field`(기술분야) |
| `KR 10-2650550 B1` · `KR 10-2716761 B1` · `KR 10-2650760 B1` · `KR 10-2638059 B1` · `KR 10-2720190 B1` | `effect_of_invention`(발명의 효과) |

### E10 — 공개일 결손 2건

| 문헌번호 | `publication_number` | `open_date` |
|---|---|---|
| `KR 20-0497874 Y1` | `20-2023-0000689` | 없음 |
| `KR 20-0497883 Y1` | `20-2021-0000256` | 없음 |

- 둘 다 **실용신안(`20-`)** 이다. 공개번호가 적재됐으므로 공개일도 있어야 한다

### A-6. 검사했으나 오류 0건 (건전성 확인)

| 검사 | 결과 |
|---|---|
| 날짜 형식·유효성 (`YYYY-MM-DD` + 실재 날짜, 9개 일자 필드) | **0건** — 규격이 경고한 `2026-02-30` 류 없음 |
| 날짜 논리 (출원일>등록일, 공개일<출원일, 공고일<출원일) | **0건** |
| 존속기간만료일 = 등록일 + 20년 | **0건** — 1,804건 전건 계산 일치 |
| 문헌번호 ↔ 등록번호 정합 | **0건** |
| 문헌번호 접두 ↔ `country_code` 정합 | **0건** |
| `document_kind` ↔ 문헌번호 형태 (`B1`↔`10-`, `Y1`↔`20-`) | **0건** — 100% 정합 |
| 우선권주장일 있는데 `priorities` 배열 빔 | **0건** |
| 인명(`applicant`/`inventor`/`agent`) `name` 결손 | **0건** |
| 청구항 종속 파싱 (`제N항에 있어서` 인데 `depends_on` 없음) | **0건** — 파싱 정확 |
| IPC 코드 형식 일관성 | **0건** — 7,629개 전건 `^[A-Z]\d{2}[A-Z]-\d+/\d+$` 단일 형식 |
| 패밀리 문헌번호 국가 접두 | **0건** — 6,427개 전건 2자 접두 보유 |

---

## B. 표시 오류 (원본 정상 · 화면 결함) — 7유형

항목 단위 요약은 [`qc-표시오류.csv`](qc-표시오류.csv). 영향 건수는 원본 1,804건 기준.

| 코드 | 표시 오류 | 영향 | 현재 화면 | 기대 | 치환식 |
|---|---|---|---|---|---|
| **D1** | 문헌종류 **코드 노출** | **1,804 (100%)** | `문헌종류 B1` | `등록특허공보` | §C-1 |
| **D2** | 지정국 행 **반쪽 렌더** | **1,804 (100%)** | DOM 셀 `["지정국","—",""]` — 서열목록 라벨·값 누락 | 2열×2쌍 유지 | §C-8 |
| **D3** | 제목 영역 **국가코드 중복** | **1,804 (100%)** | `등록공고 · KR  KR 10-2620137 B1` | 번호 단독 | §C-3 |
| **D7** | **빈 서지 5행 노출** | **1,804 (100%)** | 권리변동·최종처분·출원구분·실시권·지정국이 모두 `—` | 행 숨김 | §E |
| **D6** | 도면 수 `0건` ↔ 도면 패널 `(1)` | **1,717 (95%)** | 서지 `0건` / 패널 `(1)` / `도면 이미지 없음` | 계수 일치 | §C-5 |
| **D5** | **상세설명 중복 출력** | **1,250 (69%)** | 하위섹션 6개 뒤에 전문 재출력 | 구간 파싱 또는 접기 | §C-4 |
| **D4** | 공개·공고 **번호↔일자 계열 불일치** | **1,098 (60%)** | `공개/공고번호 10-2023-0126008`(공개) + `공개/공고일 2024-01-02`(**공고**) | 계열별 라벨·짝 | §C-2 |

### D4 상세 — `publication_number` 3계열 혼재

| 형식 | 건수 | 의미 | 화면 일자(`publication_date`)와 짝 |
|---|---|---|---|
| `10-YYYY-NNNNNNN` | 985 (54%) | **공개**번호 | ✗ 불일치(일자는 공고일) |
| `WO YYYY/NNNNNN` | 113 (6%) | **국제공개**번호 | ✗ 불일치 |
| `10-NNNNNNN` | 314 (17%) | **공고**번호 — **314건 전부 `register_number`와 동일** | ○ 일치(다만 등록번호 행과 값 중복) |
| 없음 | 392 (21%) | 공개공보 미발생 | — |

---

## C. 치환식 (있는 데이터로 바로 적용 가능)

### C-1. 문헌종류 (D1)

```
문헌종류 =
  CASE document_kind
    WHEN 'B1' THEN '등록특허공보'          -- 1,801건 · 문헌번호 10-(특허) 100% 정합
    WHEN 'Y1' THEN '등록실용신안공보'      -- 3건 · 문헌번호 20-(실용) 100% 정합
    ELSE document_kind                     -- 미관측 코드는 원값 노출
  END
```

**주의**: 현재 표본은 **등록계(REG)만** 1,804건이라 `A`(공개특허공보)·`U`(공개실용신안공보) 등 **공개계 코드는 관측되지 않았다.** 공개 문헌 적재 후 코드 도메인을 확인해 확장한다(추정으로 채우지 않음).

### C-2. 공개/공고번호·일자 분리 (D4)

```
계열 판정:
  IF   publication_number ~ '^\d{2}-\d{4}-\d{7}$'   → 공개계   (라벨 '공개번호',     일자 = open_date        → '공개일')
  ELIF publication_number ~ '^WO \d{4}/\d{6}$'      → 국제공개 (라벨 '국제공개번호', 일자 = open_date        → '국제공개일')
  ELIF publication_number ~ '^\d{2}-\d{7}$'         → 공고계   (라벨 '공고번호',     일자 = publication_date → '공고일')
  ELSE (null)                                        → 행 숨김

문헌일 행:
  문헌일 = COALESCE(open_date, '—')      -- 27%가 정상적으로 없음(§D)
  ※ 공고계·null 계열에서는 「문헌일」 대신 「공고일 = publication_date」가 의미상 정확
```

- 공고계는 `publication_number == register_number`(314건 전부)이므로 **공고번호 행을 숨기는 것**도 선택지다

### C-3. 제목 영역 번호 (D3)

```
표시번호 = literature_number          -- 전건 국가 접두 포함('KR 10-…')
국가     = country_code               -- 배지로만, 번호와 결합 금지
```

### C-4. 상세설명 중복 제거 (D5)

```
발명의 구체적인 내용 = PARSE(specification_text, '발명을 실시하기 위한 구체적인 내용' 이후 구간)
대안                 = specification_text 전문을 「원문 전체 보기」 접기로 분리, 기본은 하위섹션만
```

### C-5. 도면 계수·패널 (D6)

```
도면 수(서지)  = drawing_count + '건'          -- 현재 전건 0
도면 패널 표시 = EXISTS(figures[].image)       -- 현재 0% → 패널 숨김 또는 '도면 준비 중'
도면의 설명    = figures[0].description        -- 도면별 분리 전(E8)이므로 '상세설명 > 도면의 설명'에서만 노출
도면 라벨      = 'FIG ' + (순번+1)             -- 이미지·도면별 분리 적재 후 유효
```

### C-6. 분류코드 표기 정규화 (선택)

```
표시코드 = REGEXP_REPLACE(code, '^([A-Z]\d{2}[A-Z])-0*(\d+)/(\d+)$', '\1 \2/\3')
   예) 'H04L-047/283' → 'H04L 47/283'
```
- IPC 7,629개 전건 단일 형식 → 규칙 하나로 충분

### C-7. 패밀리 국가 추출 — 국가별 집계 가능 ★

```
국가        = SUBSTRING(family.items[].literature_number, 1, 2)
국가별 건수 = COUNT(*) GROUP BY 국가
전체 건수   = family.document_count
```
- 근거: 패밀리 문헌번호 **6,427개 전건** 2자 국가 접두 — `US 1,426 · JP 1,153 · CN 870 · KR 794 · EP 680 · WO 446 · TW 173 · AU 139 · CA 119 · IL 77 · MX 59 · BR 58 …` (형식 불명 0건)
- → 목업의 「총건수 기계 배분」 파생은 폐기하고 실제 집계로 대체

### C-8. 지정국 행 (D2)

```
지정국 행 = [ '지정국' | JOIN(designated_country, ', ') or '—' | '서열목록' | CASE sequence_listing_yn='Y' THEN '있음' ELSE '—' ]
   ※ 현재 오른쪽 두 셀이 렌더되지 않음. 또는 지정국을 단독 전폭 행으로 분리
```

### C-9. 권리상태 (표시 정책)

```
권리상태(표시) = legal_status
   도메인(관측): 등록공고 1,786 · 정정공고 14 · 특허취소신청 2 · 특허취소신청 결정 1 · 연차료납부 1
등록계 판정    = (register_status = 'REG')   -- 전건 REG → 표시하지 않고 분기용으로만
```
- `legal_status` 값은 **공보·절차 상태**다. 목업의 「권리상태」(존속/소멸 도메인)와 성격이 달라 **라벨을 `법적 상태`로 바꾸거나** 「권리상태 = 등록(REG 파생)」 + 「법적 상태 = legal_status」 2행으로 나누는 것이 정확하다 → **결정 필요**

---

## D. 문헌일은 필수값이 아니다

**공개공보 없이 등록된 문헌에는 공개일이 존재하지 않는다.** 원본에서 **없음 494건(27%)** 이며 내역이 전량 설명된다.

| 유형 | 건수 | 판정 |
|---|---|---|
| `publication_number` 자체가 null | **392** | **정상** — 공개 미발생(조기 등록). 예: `KR 10-2619202 B1` 출원 2022-11-25 → 등록 2023-12-22, 공개번호·공개일 모두 없음 |
| `publication_number`가 **공고번호**(=등록번호) 형식 | **99** | **정상** — 공개 정보가 아니라 공고 정보 |
| **공개번호** 형식인데 문헌일 없음 | **2** | **원본 오류(E10)** |
| 국제공개(WO) 형식 중 문헌일 없음 | 1 | 확인 필요 |

→ 화면은 문헌일 `—`를 결손으로 취급하지 않는다. 라벨만 계열에 맞춘다(§C-2).

## E. 있는 데이터로 화면을 채우는 방법 / 없는 것은 활용 불가

**원칙**: 채움률 0% 필드는 `—`로 채우지 않고 **행·블록을 숨긴다**(D7 해소).

| 화면 항목 | 사용 필드 | 채움률 | 활용 방법 |
|---|---|---|---|
| 문헌번호 · 국가 | `literature_number` · `country_code` | 100% | 번호 단독 표시, 국가는 배지(§C-3) |
| 발명의 명칭 | `invention_title` / `invention_title_eng` | 100% / 76% | 국문 기본 · 영문 병기(76%만) |
| 권리상태 | `legal_status` | 100% | 5종 도메인(§C-9) |
| 문헌일 / 공개·공고 | `open_date` 72% · `publication_number` 78% · `publication_date` 100% | — | 계열 판정 후 라벨·짝 맞춤(§C-2) |
| 출원·등록 번호/일자 | `application_number`·`application_date`·`register_number`·`register_date` | 100% | 그대로 |
| 문헌종류 | `document_kind` | 100% | 라벨 치환(§C-1) |
| 존속기간(예상)만료일 | `expiration_date` | 100% | 그대로 — **전건 등록일+20년 검증 통과** |
| 청구항 수 | `claim_count` | 100% | `+ '개'` · **E4 정의 확인 후** 청구범위 항 수와 일치시킬지 결정 |
| 도면 수 | `drawing_count` | 100%(값 0) | `+ '건'` · 패널 계수와 일치(§C-5) |
| 심사청구일 | `original_examination_request_date` | 30% | **조건부** |
| 우선권주장일 | `priority_application_date` | 12% | **조건부** |
| 원출원번호 | `original_application_number` | 7% | **조건부** |
| 국제출원번호 · 번역문 제출일 | `international_application_number` · `translation_submit_date` | 2% | **조건부** |
| 서열목록 | `sequence_listing_yn` | 1% | **조건부** · `CASE 'Y' THEN '있음' ELSE '—'` |
| 요약 | `abstract` | 100% | 원문 그대로(개행 보유 17%) |
| 상세설명 하위섹션 | `technology_field`·`background_art`·`problem_to_solve`·`solution_to_problem`·`effect_of_invention` | 99·99·93·94·89% | 그대로 · 없는 섹션은 행 숨김 |
| 발명의 구체적인 내용 | `specification_text` | 100% | 구간 파싱 또는 접기(§C-4) |
| 청구범위 | `claims[].number/text/depends_on` | 100% | 독립/전체 토글 · **종속 파싱 정확** |
| 패밀리 | `family.document_count` + `items[].literature_number` | 728건 | 문헌번호 + **국가 접두로 국가별 집계**(§C-7) |
| 분류코드 | `classification_code.ipc`·`cpc` | 100% | 표기 정규화(§C-6) |
| 인명 | `related_person.applicant/inventor/agent` | 100% | 발명자 주소는 **성명별 개별 행**(현재 구현이 목업보다 정확) |
| 행정처리 | `admin_process`(단일 객체) | 66% | **1건 표시로 확정** — 이력 목록 아님 |
| 심판 | `trial.type/status/number` | 10건(0.5%) | **조건부**. 예: `{type:'거절결정불복', status:'심결', number:'2023101001625'}` — 번호는 숫자형 |
| 권리변동 이력 | `right_history.change_histories[].name/date` | 7건 | **조건부** · `status` 전건 null → 2열(일자·권리자)만 |

**활용 불가 (0%) → 행·블록 숨김**

`source_link`(원문 PDF) · `figures[].image`(도면) · `figures[].ref_signs`(부호) — *적재 예정* / `has_ownership_change`(권리변동) · `final_disposal`(최종처분) · `application_flag`(출원구분) · `license_registration_date`(실시권) · `designated_country`(지정국) · `patent_customer_number_kr`(특허고객번호) · `examiner.name`(심사관) · `family.items[].invention_title`·`application_date`(패밀리 명칭·출원일) · `change_histories[].status`(권리변동 상태) · `standard`·`us_related_apps`·`us_provisional`·`jp`·`ep`(전건 KR) / 인용·피인용 명칭 — *범위 제외*

## F. 판정 정정 (초기 QC 보고 대비)

1. **청구항 `depends_on` 24% 미채움 → 결함 아님.** `제N항에 있어서` 패턴인데 `depends_on`이 빈 케이스는 **0건**. 24%는 실제로 종속항이 없는 문헌이다
2. **요약 문단 붙음 → 원본 특성.** 원본 `abstract`에 개행이 있는 문헌은 **17%(320건)** 뿐. 문장 경계 후처리는 원문 훼손 위험이 있어 권하지 않는다
3. **명칭 전각 문자**(`ＴＳＮ`)는 **7건(0.4%)** — 정규화 우선순위 낮음
4. **`claim_count` 불일치는 원본 오류로 격상**(E4, 1,245건) — 초기 보고에서는 다루지 않았다

## G. 우선순위

| 순위 | 대상 | 항목 |
|---|---|---|
| **P1** | 프런트 | D1 문헌종류 라벨 · D4 공개/공고 짝 · D3 국가 중복 · D2 지정국 행 · D7 빈 행 숨김 |
| **P1** | 적재 | E7 `drawing_count` 실제값 · E8 도면별 분리(이미지 적재 전제) |
| **P2** | 적재 | E4 `claim_count` 정의 확인 · E9 섹션 파싱 7건 · E10 공개일 2건 |
| **P2** | 프런트 | D5 상세설명 중복 · C-6 분류 표기 · C-7 패밀리 국가 집계 |
| **P3** | 결정 | C-9 권리상태 라벨 정책 · E4 확인 후 청구항 수 표시 기준 |

## 부록. 원본 1,804건 채움률 요약

| 구분 | 100% | 부분 | 0% |
|---|---|---|---|
| 승격 컬럼 | `literature_number`·`country_code`·`invention_title`·`abstract`·`specification_text` | `invention_title_eng` 76% · `technology_field` 99% · `background_art` 99% · `problem_to_solve` 93% · `solution_to_problem` 94% · `effect_of_invention` 89% | `source_link` |
| 서지 | `register_status`·`legal_status`·`application_number`·`application_date`·`publication_date`·`register_number`·`register_date`·`document_kind`·`expiration_date`·`claim_count`·`drawing_count`(값 0) | `publication_number` 78% · `open_date` 72% · `original_examination_request_date` 30% · `priority_application_date` 12% · `original_application_number` 7% · `international_application_number`·`translation_submit_date` 2% · `sequence_listing_yn` 1% | `has_ownership_change`·`final_disposal`·`application_flag`·`license_registration_date`·`designated_country` |
| 섹션 | `related_person`·`claims`·`family`·`citation`·`classification_code`·`right_history` | `figures` 95% · `admin_process` 66% · `trial` 0.5% | `standard`·`us_related_apps`·`us_provisional`·`jp`·`ep` |
