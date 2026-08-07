// === Core domain types (mockup data model) ===

export type TaskType = 'spec' | 'patent_search' | 'paper_search';

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  folderId?: string;       // 소속 프로젝트 (구 "folder")
  techField?: string;
  clientId?: string;
  contactId?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  clientId?: string | null;
  contactId?: string | null;
  favorite?: boolean;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  industry?: string;
  address?: string;
  createdAt: number;
}

export interface Contact {
  id: string;
  clientId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  type: 'patent' | 'paper';
  refNumber: string;
  title: string;
  applicant?: string;
  applicationDate?: string;
  abstract?: string;
  collectionId?: string | null;   // = 폴더
  tags: string[];
  note?: string;
  favorite: boolean;
  savedAt: number;
  fromTaskId?: string;
  fromFolderId?: string;
  data?: any;
}

export interface LibraryCollection {        // = 폴더
  id: string;
  name: string;
  color: string;
  favorite?: boolean;
  _system?: 'uncat';
  createdAt: number;
}

export type AppMode =
  | 'newtask'
  | 'home'
  | 'project'
  | 'library'
  | 'clients'
  | 'search'
  | 'spec'
  // 서비스 기본 콘텐츠(푸터 링크 진입) — 정책·연락처·FAQ
  | 'terms'
  | 'privacy'
  | 'contact'
  | 'faq';

export interface PatentResult {
  number: string;
  country: string;
  status: string;
  title: string;
  applicant: string;
  inventors: string;
  applicationNo: string;
  applicationDate: string;
  publicationNo: string;
  publicationDate: string;        // 공고일 (bibliographic.publication_date)
  openDate?: string;              // 공개일 (bibliographic.open_date) — 27%는 없음(공개 없이 등록)
  documentKind?: string;          // 문헌종류 코드 (bibliographic.document_kind) — B1/Y1 …
  registerNo: string;
  registerDate: string;
  expirationDate: string;
  ipc: string;
  cpc: string;
  rightStatus?: string;
  rightChange?: string;
  // 심판 — 수집 측에서 타입·상태·번호 3개 파라미터로 분리 수집된다(2026-07-31 확인).
  // 명세서 PDF에는 custom.has_trial(Y/N)만 있어 컬럼명은 확인 필요.
  trial?: { type: string; status: string; number: string };
  rejectionCount?: number;
  applicantStandard?: string;
  standardOrg?: string;
  abstract: string;
  repClaim: string;
  family: number;
  citing: number;
  cited: number;
  // 상세설명 하위섹션 — specification 원문을 섹션 표제로 파싱해 채운다. [2026-07-31 파싱 확정]
  techField?: string;      // 기술분야
  background?: string;     // 배경기술
  aiPurpose?: string;      // 해결하려는 과제
  aiSolution?: string;     // 과제의 해결 수단
  aiEffect?: string;       // 발명의 효과
  // 도면 — 이미지 키(patent_image.key_name) + 도면의 설명(specification 파싱).
  // 라벨(FIG n)은 순번으로 화면에서 생성한다.
  figures?: { desc: string; imageKey?: string }[];
  // 도면 주요 부분에 대한 부호의 설명 (specification 말미 파싱)
  refSigns?: { sign: string; label: string }[];
  // 구조화된 청구항 (없으면 repClaim 단독 표시)
  claims?: { no: number; dependsOn?: number; text: string }[];
  // 구조화된 인용/피인용 (없으면 citing/cited 카운트만 표시)
  citingList?: PatentCitation[];
  citedList?: PatentCitation[];
  // Sheet 3 추가 필드
  applicantAddress?: string;
  inventorAddress?: string;
  applicantCode?: string;
  priorityDate?: string;
  examRequestDate?: string;
  terminationDate?: string;
  description?: string;
  agent?: string;
  agentAddress?: string;
  // ── 수집 DB 대조 보강 필드 (목업) — docs/상세페이지-수집필드-대조.md ──
  finalDisposal?: string;                 // 최종 처분 상태
  claimCount?: number;                    // 청구항 수
  originalAppNo?: string;                 // 원출원번호
  intlAppNo?: string;                     // 국제출원번호
  intlAppDate?: string;                   // 국제출원일
  examiner?: string;                      // 심사관
  repApplicant?: string;                  // 대표출원인명
  customerNo?: string;                    // 특허고객번호
  ipcList?: string[];                     // IPC 전체 리스트
  cpcList?: string[];                     // CPC 전체 리스트
  priorityList?: { country: string; number: string; date: string }[];   // 우선권
  familyList?: { country: string; docNumber: string; date: string; title: string }[];  // 패밀리 문헌
  priorArtDocs?: { number: string; country: string }[];                  // 선행기술문헌
  rightChangeList?: { type: string; name: string; date: string }[];      // 권리변동 이력
  adminProcess?: { docName: string; date: string; status: string }[];    // 행정처리(수발신)
  standard?: { org: string; numbers: string; techName: string; declarants: string; date: string };             // 표준특허
  // ── 추가 보강 (P3 + 국가고유, 목업) ──
  applicationFlag?: string;               // 출원 구분(정상/분할/변경/PCT국내단계)
  translationSubmitDate?: string;         // 번역문 제출일 (외국어/PCT)
  licenseRegDate?: string;                // 실시권(라이선스) 등록일 (등록 문헌)
  drawingCount?: number;                  // 도면 수
  sequenceListing?: boolean;              // 서열목록 유무 (바이오)
  designatedCountries?: string[];         // 지정국 (EP/국제출원)
  rightTransferList?: { date: string; regNo: string; docName: string; before: string; after: string }[]; // 권리이전 이력
  countryClassifications?: { label: string; codes: string[] }[];  // 국가 고유 분류: JP FI/FTERM/테마, US UPC, EP EPC
  usRelatedApps?: { regNo: string; date: string; classification: string; status: string }[];  // US 관련출원
  usProvisional?: string[];               // US 가출원 번호
  jpEdition?: string;                     // JP 공보판
  agentCategory?: string;                 // 대리인 구분(JP)
  epFileRef?: string;                     // EP 출원인 정리번호
  epFilingLanguage?: string;              // EP 출원/공개 언어
}

// 인용·피인용 문헌 — 수집 컬럼과 1:1.
// 인용문헌의 '명칭'은 수집 대상이 아니다(KPA_CITATION·CTLTR 에 명칭 컬럼 없음) → 표시하지 않는다.
export interface PatentCitation {
  kind: 'patent' | 'npl';   // 특허 / 비특허(논문)
  // 특허 인용 — KR KPA_CITATION / US·JP CTLTR
  country?: string;         // citation_literature_country_code
  ref?: string;             // KR citation_literature_number · US·JP registration_number
  inventor?: string;        // citation_literature_inventor_name · inventor_name
  date?: string;             // KR citation_literature_publication_date · US·JP registration_date
  // 비특허 인용 — CTLTR_ETC.other_citations / PRIOR_TECHNOLOGY_DOCUMENT.non_patent_reference_text
  // 제목·저널·연도가 한 컬럼에 통째로 들어오므로 파싱하지 않고 원문 그대로 표시한다.
  text?: string;
}

export interface PaperResult {
  id: string;
  title: string;            // 한글 논문명(주 표시)
  authors: string;          // 저자명(한글)
  journal?: string;         // 저널정보(한글)
  year?: number;
  abstract?: string;        // 초록(한글)
  // 영문 메타데이터 (DBpia 참고 — 한/영 병기)
  titleKo?: string;         // 한글 논문명(대등제목)
  titleEn?: string;         // 영문 논문명
  authorsEn?: string;       // 저자 영문명
  journalEn?: string;       // 영문 저널명
  abstractEn?: string;      // 영문 초록
  doi?: string;
  citationCount?: number;
  keywords?: string[];
  // 서지 상세 (검색결과 출력용) — 없으면 생략
  volume?: string;          // 권
  issue?: string;           // 호
  startPage?: number;       // 시작 페이지
  endPage?: number;         // 끝 페이지
  month?: number;           // 발행 월
  paperType?: 'journal' | 'thesis';   // 학술지논문 / 학위논문
  institution?: string;     // 학위수여기관 (학위논문)
  field?: string;           // 분야(카테고리)
  language?: 'EN' | 'KO' | 'JP' | 'ZH';   // 원문 언어
  internalUrl?: string;     // 본문 내용(내부 전용 링크)
  externalUrl?: string;     // 외부 제공 링크(원문/DOI)
}
