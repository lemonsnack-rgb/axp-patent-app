// 패싯 그룹 정의 — 기본 결과 필터(국가·권리상태·출원연도·IPC·심판) + 확장 카테고리 + 논문 패싯
// 출원인 대표명화(applicant_top)는 이번 텀 미구현으로 기본 필터에서 제외됨

export interface FacetItem {
  label: string;
  count?: number | null;
  sub?: 'active' | 'inactive';
  isInput?: boolean;
  code?: string;
  kind?: 'yesno' | 'date-range';
}

export interface FacetGroup {
  key: string;
  title: string;
  badge?: string;
  items: FacetItem[];
}

// 기본 결과 필터
export const PATENT_FACET_GROUPS_BASE: FacetGroup[] = [
  {
    key: 'country', title: '국가',
    items: [
      { label: '전체', count: 4792 },
      { label: 'KR',   count: 1247 },
      { label: 'US',   count: 892 },
      { label: 'JP',   count: 543 },
      { label: 'CN',   count: 1876 },
      { label: 'EP',   count: 234 },
    ],
  },
  {
    key: 'right_status', title: '권리상태', badge: 'active / inactive',
    items: [
      { label: '공개',     count: 1134, sub: 'active' },
      { label: '심사중',   count: 2134, sub: 'active' },
      { label: '등록예정', count: 38,   sub: 'active' },
      { label: '등록',     count: 548,  sub: 'active' },
      { label: '거절',     count: 312,  sub: 'inactive' },
      { label: '소멸',     count: 412,  sub: 'inactive' },
      { label: '포기',     count: 87,   sub: 'inactive' },
      { label: '취하',     count: 56,   sub: 'inactive' },
      { label: '취소',     count: 11,   sub: 'inactive' },
      { label: '각하',     count: 8,    sub: 'inactive' },
    ],
  },
  {
    // 특허구분(공개/등록) — 검색이 문헌번호 기준이라 동일 출원이 공개+등록 문헌으로 모두 잡힘.
    // 이 축으로 문헌종류를 좁힌다(중복제거 컨트롤과 함께 사용).
    key: 'doc_kind', title: '공개/등록',
    items: [
      { label: '공개특허', count: 2891 },
      { label: '등록특허', count: 1901 },
    ],
  },
  {
    key: 'app_year', title: '출원연도',
    items: [
      { label: '2026', count: 89 },
      { label: '2025', count: 187 },
      { label: '2024', count: 312 },
      { label: '2023', count: 658 },
      { label: '2022', count: 891 },
      { label: '2021', count: 1024 },
      { label: '2020 이전', count: 1631 },
    ],
  },
  // 출원인 대표명화(applicant_top) 패싯 — 이번 텀 미구현으로 제거
  // IPC 패싯은 Main/All 토글을 가진다(아래 IPC_FACET_ITEMS 참조). group.items는 기본(All).
  {
    key: 'ipc_top', title: 'IPC', badge: 'Main/All',
    items: [
      // 기본 = All (개정이력 포함 — 한 문헌의 여러 판 IPC를 모두 집계 → 코드·건수 많음)
      { label: 'G01S-017 (LiDAR)',      count: 1245 },
      { label: 'G06V-020 (Vision)',     count: 876 },
      { label: 'B60W-030 (Vehicle)',    count: 654 },
      { label: 'G05D-001 (Control)',    count: 432 },
      { label: 'G01C-021 (Navigation)', count: 287 },
      { label: 'H04W-004 (Telematics)', count: 214 },
      { label: 'G08G-001 (Traffic)',    count: 176 },
    ],
  },
  {
    key: 'trial', title: '심판 유무',
    items: [
      { label: '있음', count: 87 },
      { label: '없음', count: 4705 },
    ],
  },
];

// IPC 패싯 Main/All 토글용 아이템 세트.
//  - All  = 문헌에 반영된 IPC를 개정판 전체 집계(한 문헌이 여러 코드로 잡힘 → 코드·건수 많음). 필드 `IPC`.
//  - Main = 최신 대표 IPC만 집계(문헌당 1개). 필드 `IPCM`. 코드·건수가 All의 부분집합.
export const IPC_FACET_ITEMS: { all: FacetItem[]; main: FacetItem[] } = {
  all: PATENT_FACET_GROUPS_BASE.find(g => g.key === 'ipc_top')!.items,
  main: [
    { label: 'G01S-017 (LiDAR)',      count: 812 },
    { label: 'G06V-020 (Vision)',     count: 534 },
    { label: 'B60W-030 (Vehicle)',    count: 398 },
    { label: 'G05D-001 (Control)',    count: 251 },
    { label: 'G01C-021 (Navigation)', count: 143 },
  ],
};

// Sheet 4: 전체 검색필터 (확장 9 카테고리)
export const PATENT_FACET_GROUPS_EXT: FacetGroup[] = [
  {
    key: 'ext_text', title: '텍스트', badge: '추가 검색 입력',
    items: [
      { label: '발명의 명칭',          isInput: true, code: 'TI' },
      { label: '요약',                 isInput: true, code: 'AB' },
      { label: '독립항',               isInput: true, code: 'CLI' },
      { label: '색인어',               isInput: true, code: 'IDX' },
      { label: '명칭+요약+전체청구항', isInput: true, code: 'TI_AB_CLA' },
    ],
  },
  {
    key: 'ext_person', title: '인명정보',
    items: [
      { label: '출원인 국적',        isInput: true, code: 'AP_NAT' },
      { label: '현재 권리자',        isInput: true, code: 'OWN' },
      { label: '현재 권리자 국적',   isInput: true, code: 'OWN_NAT' },
      { label: '발명자',             isInput: true, code: 'INV' },
      { label: '발명자 국적',        isInput: true, code: 'INV_NAT' },
      { label: '대표출원인 코드',    isInput: true, code: 'AP_REP' },
      { label: '양도인',             isInput: true, code: 'ASR' },
      { label: '양수인',             isInput: true, code: 'ASE' },
      { label: '대리인',             isInput: true, code: 'AG' },
      { label: '심사관',             isInput: true, code: 'EXM' },
      { label: '실시권자 (KR)',      isInput: true, code: 'LIC' },
      { label: '질권자 (KR)',        isInput: true, code: 'PLG' },
      { label: '양도 유무',          isInput: true, code: 'AS_HAS', kind: 'yesno' },
      { label: '실시권 유무',        isInput: true, code: 'LIC_HAS', kind: 'yesno' },
    ],
  },
  {
    key: 'ext_class', title: '분류코드',
    items: [
      { label: '메인 IPC',     isInput: true, code: 'IPCM' },
      { label: '전체 IPC',     isInput: true, code: 'IPC_FULL' },
      { label: '메인 CPC',     isInput: true, code: 'CPCM' },
      { label: '전체 CPC',     isInput: true, code: 'CPC_FULL' },
      { label: '메인 UPC',     isInput: true, code: 'UPCM' },
      { label: '전체 UPC',     isInput: true, code: 'UPC_FULL' },
      { label: 'FI (JP)',      isInput: true, code: 'FI' },
      { label: 'F-term (JP)',  isInput: true, code: 'FTERM' },
    ],
  },
  {
    key: 'ext_date', title: '일자·번호·문헌',
    items: [
      { label: '문헌종류',       isInput: true, code: 'KIND' },
      { label: '공개번호',       isInput: true, code: 'PN' },
      { label: '공개일',         isInput: true, code: 'PD', kind: 'date-range' },
      { label: '공고번호',       isInput: true, code: 'GN' },
      { label: '공고일',         isInput: true, code: 'GD', kind: 'date-range' },
      { label: '등록일',         isInput: true, code: 'RD', kind: 'date-range' },
      { label: '문헌번호',       isInput: true, code: 'DOCN' },
      { label: '문헌일',         isInput: true, code: 'DOCD', kind: 'date-range' },
      { label: '단일특허 (EP)',  isInput: true, code: 'UPC_EP', kind: 'yesno' },
    ],
  },
  {
    key: 'ext_wo', title: '국제출원',
    items: [
      { label: '국제출원번호', isInput: true, code: 'WO_AN' },
      { label: '국제출원일',   isInput: true, code: 'WO_AD', kind: 'date-range' },
      { label: '국제공개번호', isInput: true, code: 'WO_PN' },
      { label: '국제공개일',   isInput: true, code: 'WO_PD', kind: 'date-range' },
    ],
  },
  {
    key: 'ext_cite', title: '우선권·인용',
    items: [
      { label: '우선권 국가',         isInput: true, code: 'PRI_NAT' },
      { label: '우선권 번호',         isInput: true, code: 'PRI_NUM' },
      { label: '우선권 주장일',       isInput: true, code: 'PRI_DT', kind: 'date-range' },
      { label: '인용문헌 수',         isInput: true, code: 'CIT_CNT' },
      { label: '피인용문헌 수',       isInput: true, code: 'CIB_CNT' },
      { label: '특허인용 국가',       isInput: true, code: 'CIT_NAT' },
      { label: '특허인용 번호',       isInput: true, code: 'CIT_NUM' },
      { label: '특허피인용 국가',     isInput: true, code: 'CIB_NAT' },
      { label: '특허피인용 번호',     isInput: true, code: 'CIB_NUM' },
      { label: '비특허인용 유무',     isInput: true, code: 'NPL_HAS', kind: 'yesno' },
      { label: '비특허인용 명칭+저자', isInput: true, code: 'NPL_TXT' },
    ],
  },
  {
    key: 'ext_std', title: '표준정보',
    items: [
      { label: '표준화기구',        isInput: true, code: 'STD_ORG' },
      { label: '표준정보',          isInput: true, code: 'STD_INFO' },
      { label: '표준번호',          isInput: true, code: 'STD_NUM' },
      { label: '표준기술명',        isInput: true, code: 'STD_NAME' },
      { label: '선언(등재)자',      isInput: true, code: 'STD_DECL' },
      { label: '선언(등재)자 국적', isInput: true, code: 'STD_NAT' },
      { label: '선언(등재)일',      isInput: true, code: 'STD_DT', kind: 'date-range' },
    ],
  },
  {
    key: 'ext_seq', title: '서열정보',
    items: [
      { label: '서열목록 유무', isInput: true, code: 'SEQ_HAS', kind: 'yesno' },
      { label: '서열내용',      isInput: true, code: 'SEQ_TXT' },
    ],
  },
  {
    key: 'ext_proj', title: '과제정보',
    items: [
      { label: '과제고유번호',   isInput: true, code: 'PRJ_NUM' },
      { label: '사업명+과제명',  isInput: true, code: 'PRJ_NAME' },
      { label: '부처명+관리기관', isInput: true, code: 'PRJ_ORG' },
      { label: '주관기관',       isInput: true, code: 'PRJ_MAIN' },
      { label: '연구시작일',     isInput: true, code: 'PRJ_SD', kind: 'date-range' },
      { label: '연구종료일',     isInput: true, code: 'PRJ_ED', kind: 'date-range' },
    ],
  },
];

// 논문 패싯은 실제 시드(PAPER_SEED)에서 동적 산출 — 라벨 불일치로 0건 되는 문제 방지
import { PAPER_SEED } from './patentSeed';

function countBy<T>(items: T[], key: (t: T) => string | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

const yearCounts = countBy(PAPER_SEED, p => p.year != null ? String(p.year) : undefined);
const journalCounts = countBy(PAPER_SEED, p => p.journal);

export const PAPER_FACET_GROUPS: FacetGroup[] = [
  {
    key: 'pub_year', title: '발행연도',
    items: [...yearCounts.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([label, count]) => ({ label, count })),
  },
  {
    key: 'journal', title: '저널명',
    items: [...journalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count })),
  },
];
