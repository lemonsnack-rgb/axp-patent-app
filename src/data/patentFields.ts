// 특허 검색필드 정의 — 페이지_필드설정_260527 Sheet 1 (기본 9필드) + Sheet 4 (전체 검색필터)
// 입력 스키마와 그룹 분류, 코드, 라벨, placeholder, type 메타데이터.

export interface PatentField {
  code: string;
  label: string;
  ph: string;
  type?: 'text' | 'date-range' | 'year-recent' | 'ipc';
  group: string;
}

export const PATENT_FIELDS_BASE: PatentField[] = [
  { code: 'TI_AB_CLI', label: '명칭+요약+독립항', ph: '예: 자율주행 and 라이다',                group: '텍스트' },
  { code: 'CLA',       label: '전체청구항',        ph: '예: 자율주행 and 라이다 and 객체',       group: '텍스트' },
  { code: 'DSC',       label: '상세설명',          ph: '딥러닝 and 검색 and 알고리즘',           group: '텍스트' },
  { code: 'AP',        label: '출원인',            ph: '엘지* | 119990527105',                   group: '인명' },
  { code: 'IPC_ALL',   label: 'IPC(All)',          ph: 'H04L-009/18% | G06F*',                   group: '분류', type: 'ipc' },
  { code: 'AN',        label: '출원번호',          ph: '',                                       group: '번호' },
  { code: 'PUB',       label: '공개/공고번호',     ph: '',                                       group: '번호' },
  { code: 'RN',        label: '등록번호',          ph: '',                                       group: '번호' },
  { code: 'AD',        label: '출원일',            ph: '최근 N년',                               group: '일자', type: 'year-recent' },
];

export const PATENT_FIELDS_EXT: PatentField[] = [
  // 텍스트
  { code: 'TI',        label: '발명의 명칭',                ph: '',                              group: '텍스트' },
  { code: 'AB',        label: '요약',                       ph: '',                              group: '텍스트' },
  { code: 'CLI',       label: '독립항',                     ph: '',                              group: '텍스트' },
  { code: 'IDX',       label: '색인어',                     ph: '',                              group: '텍스트' },
  { code: 'TI_AB_CLA', label: '명칭+요약+전체청구항',       ph: '',                              group: '텍스트' },
  // 인명정보
  { code: 'AP_NAT',    label: '출원인 국적',                ph: 'KR | US | JP',                  group: '인명정보' },
  { code: 'OWN',       label: '현재 권리자',                ph: '',                              group: '인명정보' },
  { code: 'OWN_NAT',   label: '현재 권리자 국적',           ph: '',                              group: '인명정보' },
  { code: 'INV',       label: '발명자',                     ph: '김한국 | 김한*',                group: '인명정보' },
  { code: 'INV_NAT',   label: '발명자 국적',                ph: '',                              group: '인명정보' },
  { code: 'AP_REP',    label: '대표출원인 코드',            ph: '',                              group: '인명정보' },
  { code: 'ASR',       label: '양도인 (KR, US, CN)',        ph: '',                              group: '인명정보' },
  { code: 'ASE',       label: '양수인 (KR, US, CN)',        ph: '',                              group: '인명정보' },
  { code: 'AG',        label: '대리인',                     ph: '특허법인*',                     group: '인명정보' },
  { code: 'EXM',       label: '심사관',                     ph: '',                              group: '인명정보' },
  { code: 'LIC',       label: '실시권자 (KR)',              ph: '',                              group: '인명정보' },
  { code: 'PLG',       label: '질권자 (KR)',                ph: '',                              group: '인명정보' },
  { code: 'PCN_KR',    label: '특허고객번호 (KR)',          ph: '',                              group: '인명정보' },
  { code: 'AID_JP',    label: '출원인식별기호 (JP)',        ph: '',                              group: '인명정보' },
  { code: 'AP_ADDR',   label: '출원인 주소 (KR)',           ph: '',                              group: '인명정보' },
  { code: 'AS_HAS',    label: '양도 유무 (KR)',             ph: '있음 / 없음',                   group: '인명정보' },
  { code: 'LIC_HAS',   label: '실시권 유무 (KR)',           ph: '있음 / 없음',                   group: '인명정보' },
  { code: 'AG_ADDR',   label: '대리인 주소 (KR)',           ph: '',                              group: '인명정보' },
  // 분류코드
  { code: 'IPCM',      label: '메인 IPC',                   ph: '',                              group: '분류코드', type: 'ipc' },
  { code: 'IPC_FULL',  label: '전체 IPC',                   ph: '',                              group: '분류코드', type: 'ipc' },
  { code: 'CPCM',      label: '메인 CPC',                   ph: '',                              group: '분류코드' },
  { code: 'CPC_FULL',  label: '전체 CPC',                   ph: '',                              group: '분류코드' },
  { code: 'UPCM',      label: '메인 UPC',                   ph: '',                              group: '분류코드' },
  { code: 'UPC_FULL',  label: '전체 UPC',                   ph: '',                              group: '분류코드' },
  { code: 'FI',        label: 'FI (JP)',                    ph: '',                              group: '분류코드' },
  { code: 'FTERM',     label: 'F-term (JP)',                ph: '',                              group: '분류코드' },
  // 일자/번호/문헌종류
  { code: 'KIND',      label: '문헌종류',                   ph: '',                              group: '일자·번호·문헌' },
  { code: 'PN',        label: '공개번호',                   ph: '',                              group: '일자·번호·문헌' },
  { code: 'PD',        label: '공개일',                     ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'GN',        label: '공고번호',                   ph: '',                              group: '일자·번호·문헌' },
  { code: 'GD',        label: '공고일',                     ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'RD',        label: '등록일',                     ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'DOCN',      label: '문헌번호',                   ph: '',                              group: '일자·번호·문헌' },
  { code: 'DOCD',      label: '문헌일',                     ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'AS_RD_KR',  label: '양도 등록일 (KR)',           ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'LIC_RD_KR', label: '실시권 등록일 (KR)',         ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'LIC_SD_KR', label: '실시권 시작일 (KR)',         ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'LIC_ED_KR', label: '실시권 종료일 (KR)',         ph: '',                              group: '일자·번호·문헌', type: 'date-range' },
  { code: 'UPC_EP',    label: '단일특허 (EP)',              ph: '있음 / 없음',                   group: '일자·번호·문헌' },
  // 국제출원
  { code: 'WO_AN',     label: '국제출원번호',               ph: '',                              group: '국제출원' },
  { code: 'WO_AD',     label: '국제출원일',                 ph: '',                              group: '국제출원', type: 'date-range' },
  { code: 'WO_PN',     label: '국제공개번호',               ph: '',                              group: '국제출원' },
  { code: 'WO_PD',     label: '국제공개일',                 ph: '',                              group: '국제출원', type: 'date-range' },
  // 우선권/인용정보
  { code: 'PRI_NAT',   label: '우선권 국가',                ph: '',                              group: '우선권·인용' },
  { code: 'PRI_NUM',   label: '우선권 번호',                ph: '',                              group: '우선권·인용' },
  { code: 'PRI_DT',    label: '우선권 주장일',              ph: '',                              group: '우선권·인용', type: 'date-range' },
  { code: 'CIT_CNT',   label: '인용문헌 수',                ph: '',                              group: '우선권·인용' },
  { code: 'CIB_CNT',   label: '피인용문헌 수',              ph: '',                              group: '우선권·인용' },
  { code: 'CIT_NAT',   label: '특허인용 국가',              ph: '',                              group: '우선권·인용' },
  { code: 'CIT_NUM',   label: '특허인용 번호',              ph: '',                              group: '우선권·인용' },
  { code: 'CIB_NAT',   label: '특허피인용 국가',            ph: '',                              group: '우선권·인용' },
  { code: 'CIB_NUM',   label: '특허피인용 번호',            ph: '',                              group: '우선권·인용' },
  { code: 'NPL_HAS',   label: '비특허인용 유무',            ph: '있음 / 없음',                   group: '우선권·인용' },
  { code: 'NPL_TXT',   label: '비특허인용 명칭+저자',       ph: '',                              group: '우선권·인용' },
  // 표준정보
  { code: 'STD_ORG',   label: '표준화기구',                 ph: '3GPP | IEEE | ITU-T',           group: '표준정보' },
  { code: 'STD_INFO',  label: '표준정보',                   ph: '',                              group: '표준정보' },
  { code: 'STD_NUM',   label: '표준번호',                   ph: '',                              group: '표준정보' },
  { code: 'STD_NAME',  label: '표준기술명',                 ph: '',                              group: '표준정보' },
  { code: 'STD_DECL',  label: '선언(등재)자',               ph: '',                              group: '표준정보' },
  { code: 'STD_NAT',   label: '선언(등재)자 국적',          ph: '',                              group: '표준정보' },
  { code: 'STD_DT',    label: '선언(등재)일',               ph: '',                              group: '표준정보', type: 'date-range' },
  // 서열정보
  { code: 'SEQ_HAS',   label: '서열목록 유무',              ph: '있음 / 없음',                   group: '서열정보' },
  { code: 'SEQ_TXT',   label: '서열내용',                   ph: '',                              group: '서열정보' },
  // 과제정보
  { code: 'PRJ_NUM',   label: '과제고유번호',               ph: '',                              group: '과제정보' },
  { code: 'PRJ_NAME',  label: '사업명+과제명',              ph: '',                              group: '과제정보' },
  { code: 'PRJ_ORG',   label: '부처명+관리기관',            ph: '',                              group: '과제정보' },
  { code: 'PRJ_MAIN',  label: '주관기관',                   ph: '',                              group: '과제정보' },
  { code: 'PRJ_SD',    label: '연구시작일',                 ph: '',                              group: '과제정보', type: 'date-range' },
  { code: 'PRJ_ED',    label: '연구종료일',                 ph: '',                              group: '과제정보', type: 'date-range' },
];

export const PATENT_FIELDS_ALL: PatentField[] = [...PATENT_FIELDS_BASE, ...PATENT_FIELDS_EXT];

export const PATENT_FIELDS_MAP: Record<string, PatentField> = {};
PATENT_FIELDS_ALL.forEach(f => { PATENT_FIELDS_MAP[f.code] = f; });

export const PATENT_FIELDS_GROUPS = ['텍스트', '인명정보', '분류코드', '일자·번호·문헌', '국제출원', '우선권·인용', '표준정보', '서열정보', '과제정보'];

export const COUNTRY_LIST = [
  { code: 'KR', label: 'KR 한국' },
  { code: 'US', label: 'US 미국' },
  { code: 'JP', label: 'JP 일본' },
  { code: 'CN', label: 'CN 중국' },
  { code: 'EP', label: 'EP 유럽' },
  { code: 'PCT', label: 'PCT' },
  { code: 'DE', label: 'DE 독일' },
  { code: 'GB', label: 'GB 영국' },
];

export const COUNTRY_ADDITIONAL = [
  'FR 프랑스', 'RU 러시아', 'IN 인도', 'TW 대만', 'CA 캐나다', 'AU 호주',
  'IT 이탈리아', 'NL 네덜란드', 'AT 오스트리아', 'CH 스위스', 'DK 덴마크', 'ES 스페인',
];

export const PATENT_PERIODS = [
  { id: 'all', label: '전체' },
  { id: '5y',  label: '최근 5년' },
  { id: '10y', label: '최근 10년' },
  { id: '20y', label: '최근 20년' },
];

export const PATENT_SCOPES = ['KEY', '서지+요약+대표', '서지+요약+전체', '전체문서'];
export const PATENT_LANGS = ['한+영', '국문', '영문'];
export const PATENT_DOC_KINDS = ['공개', '등록', '실용공개', '실용등록'];
export const PATENT_STATUS_ACTIVE = ['출원', '심사중', '등록'];
export const PATENT_STATUS_INACTIVE = ['거절', '소멸', '취하', '포기', '무효'];
