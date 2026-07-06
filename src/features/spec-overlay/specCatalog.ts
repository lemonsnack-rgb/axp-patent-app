// 기능명세 항목 카탈로그 — docs/기능정의서.md 「메뉴·화면별 기능명세」의 구성요소별 통합표와 1:1.
// 목업 요소의 data-spec="<ID>"와 매칭되어 "명세 모드"에서 조회된다.
// (파일럿: 특허 · 검색어 입력 PAT-INP-*. 확장 시 나머지 화면 ID를 이어서 추가)

export interface SpecEntry {
  id: string;
  screen: string;
  component: string;
  display: string;        // 표시 정보·구성
  interaction: string;    // 기능·상호작용
  precondition: string;   // 사전조건
  postcondition: string;  // 사후결과
}

export const SPEC_CATALOG: Record<string, SpecEntry> = {
  'PAT-INP-010': {
    id: 'PAT-INP-010',
    screen: '특허 · 검색어 입력',
    component: '메타필터 (국가·문헌종류·기간·상태)',
    display: '국가(전체/KR/US/JP/CN/EP/PCT/DE/GB+추가) · 문헌종류(전체/공개/등록/실용공개/실용등록) · 기간(전체/최근5·10·20년+일자범위) · 상태(전체/A:출원·심사중·등록 / I:거절·소멸·취하·포기·무효). 활성 칩=체크(✓)+색상',
    interaction: '칩 토글로 선택. "전체"는 라디오형(해제 불가)',
    precondition: '화면 진입',
    postcondition: '선택 상태 반영 · 다음 검색 payload에 countries/docTypes/statuses/dateFrom·To 포함',
  },
  'PAT-INP-020': {
    id: 'PAT-INP-020',
    screen: '특허 · 검색어 입력',
    component: '검색어 범위 탭',
    display: 'KEY(명칭+요약+독립항) / TAC(명칭+요약+전체청구항) / DSC(명칭+요약+전체청구항+상세설명)',
    interaction: '탭 전환(라벨 정합은 명세 비교 확인 대상)',
    precondition: '화면 진입',
    postcondition: '선두 자유어에 적용될 범위코드 변경(직접 필드식은 불변)',
  },
  'PAT-INP-030': {
    id: 'PAT-INP-030',
    screen: '특허 · 검색어 입력',
    component: '입력방식 토글',
    display: '일반(textarea) / 편집기(구문강조+실시간 진단)',
    interaction: '모드 전환',
    precondition: '화면 진입',
    postcondition: '표시 방식 전환 · 편집기모드는 진단 표시(실행 차단 안 함)',
  },
  'PAT-INP-040': {
    id: 'PAT-INP-040',
    screen: '특허 · 검색어 입력',
    component: '검색식 입력창 + 검색/초기화 (영역)',
    display: '입력창 + 우측 검색·초기화 버튼',
    interaction: '↓ 액션별 (검색 실행 / 초기화)',
    precondition: '—',
    postcondition: '개별 액션(PAT-INP-041/042) 참조',
  },
  'PAT-INP-041': {
    id: 'PAT-INP-041',
    screen: '특허 · 검색어 입력',
    component: '검색 실행',
    display: '검색 버튼',
    interaction: '클릭 / ⏎',
    precondition: '검색식 입력창 또는 항목별 필드에 값 1개 이상',
    postcondition: 'searchQuery 조립·POST → 결과 목록 전환 · 히스토리 1건 추가 · (연동 시)URL 직렬화',
  },
  'PAT-INP-042': {
    id: 'PAT-INP-042',
    screen: '특허 · 검색어 입력',
    component: '초기화',
    display: '초기화 버튼',
    interaction: '클릭',
    precondition: '—',
    postcondition: '입력값·활성필드를 디폴트로 복원',
  },
  'PAT-INP-050': {
    id: 'PAT-INP-050',
    screen: '특허 · 검색어 입력',
    component: '항목별 상세검색',
    display: '필드별 조합(펼침/접힘 · 필드 추가/확장 모달)',
    interaction: '필드 값 입력 시 검색식에 AND 누적',
    precondition: '항목별 상세검색 펼침 · 필드 선택됨',
    postcondition: '검색식에 CODE:(값) AND 누적(자유어는 선두만 범위 래핑, 직접 필드식 불변) · 실행 후 입력값만 비우고 구성 유지',
  },
  'PAT-INP-060': {
    id: 'PAT-INP-060',
    screen: '특허 · 검색어 입력',
    component: '검색 히스토리 (영역)',
    display: '최근 검색식 목록(공통·횡단 기능)',
    interaction: '↓ 액션별 (재검색 / 즐겨찾기 / 삭제)',
    precondition: '검색 1회 이상 실행됨',
    postcondition: '개별 액션(PAT-INP-061/062/063) 참조',
  },
  'PAT-INP-061': {
    id: 'PAT-INP-061',
    screen: '특허 · 검색어 입력',
    component: '항목 재검색',
    display: '히스토리 항목 행',
    interaction: '클릭',
    precondition: '기록 존재',
    postcondition: '선택 검색식으로 재실행',
  },
  'PAT-INP-062': {
    id: 'PAT-INP-062',
    screen: '특허 · 검색어 입력',
    component: '★즐겨찾기',
    display: '별 아이콘',
    interaction: '토글',
    precondition: '기록 존재',
    postcondition: '즐겨찾기 on/off 저장',
  },
  'PAT-INP-063': {
    id: 'PAT-INP-063',
    screen: '특허 · 검색어 입력',
    component: '삭제',
    display: '× 버튼 / 전체 삭제',
    interaction: '클릭',
    precondition: '기록 존재',
    postcondition: '해당(또는 전체) 기록 제거',
  },
};
