// 기능명세 항목 카탈로그 — docs/기능정의서.md 「메뉴·화면별 기능명세」의 구성요소별 통합표와 1:1.
// 목업 요소의 data-spec="<ID>"와 매칭되어 "명세 모드"에서 조회된다.
// 전 화면: PAT-INP / PAT-LST / PAP-INP / PAP-LST / COM. data-spec 부착과 1:1로 유지한다.

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
    component: '메타필터 (영역)',
    display: '국가 · 문헌종류 · 기간 · 상태 필터 묶음. 활성 칩=체크(✓)+색상',
    interaction: '↓ 필터별 (국가/문헌종류/기간/상태)',
    precondition: '화면 진입',
    postcondition: '개별 필터(PAT-INP-011~014) 참조',
  },
  'PAT-INP-011': {
    id: 'PAT-INP-011',
    screen: '특허 · 검색어 입력',
    component: '국가 필터',
    display: '전체 / KR / US / JP / CN / EP / PCT / DE / GB + "국가설정"으로 추가국가',
    interaction: '칩 토글("전체"=라디오, 해제 불가) · 국가설정 팝업에서 추가',
    precondition: '화면 진입',
    postcondition: '다음 검색 payload에 countries[] 포함',
  },
  'PAT-INP-012': {
    id: 'PAT-INP-012',
    screen: '특허 · 검색어 입력',
    component: '문헌종류 필터',
    display: '전체 / 공개 / 등록 / 실용공개 / 실용등록',
    interaction: '칩 토글("전체"=라디오)',
    precondition: '화면 진입',
    postcondition: '다음 검색 payload에 docTypes[] 포함',
  },
  'PAT-INP-013': {
    id: 'PAT-INP-013',
    screen: '특허 · 검색어 입력',
    component: '기간 필터',
    display: '전체 / 최근5·10·20년 + 일자범위(시작~종료 date)',
    interaction: '프리셋 라디오 선택 또는 일자 직접 입력',
    precondition: '화면 진입',
    postcondition: '다음 검색 payload에 dateFrom/dateTo 반영',
  },
  'PAT-INP-014': {
    id: 'PAT-INP-014',
    screen: '특허 · 검색어 입력',
    component: '상태 필터',
    display: '전체 / A(출원·심사중·등록) / I(거절·소멸·취하·포기·무효)',
    interaction: '칩 토글("전체"=전체 초기화, 빈 선택 방지)',
    precondition: '화면 진입',
    postcondition: '다음 검색 payload에 statuses[] 포함',
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

  // ── 특허 · 결과 목록 ──
  'PAT-LST-010': { id: 'PAT-LST-010', screen: '특허 · 결과 목록', component: '상단 요약바', display: '적용 검색식 칩 · 총 건수 · → 논문으로', interaction: '교차검색 진입', precondition: '검색 실행 완료', postcondition: '총건수 표시 / 교차검색=논문 검색으로 검색어 이관·화면 전환' },
  'PAT-LST-020': { id: 'PAT-LST-020', screen: '특허 · 결과 목록', component: '결과 표·카드 (영역)', display: '컬럼: 체크박스·상태·문헌번호·원문PDF·발명의명칭(+새 탭)·출원인·출원일·IPC. 상태=평문(색 Badge 미사용)', interaction: '목록 렌더 / ↓ 액션별', precondition: '검색 실행 완료(응답 수신)', postcondition: '목록 렌더(totalCount·hits)' },
  'PAT-LST-021': { id: 'PAT-LST-021', screen: '특허 · 결과 목록', component: '행/카드 선택', display: '행/카드 본문', interaction: '클릭', precondition: '결과 행 존재', postcondition: '선택 인덱스 설정 · 미리보기 패널 오픈(내용은 보류(상세페이지))' },
  'PAT-LST-022': { id: 'PAT-LST-022', screen: '특허 · 결과 목록', component: '체크박스 선택', display: '행별 체크박스', interaction: '체크', precondition: '결과 행 존재', postcondition: '저장 대상 선택 상태 반영(→ 다중 선택 저장)' },
  'PAT-LST-030': { id: 'PAT-LST-030', screen: '특허 · 결과 목록', component: '패싯 필터바/사이드바', display: '국가·현재권리상태·IPC·CPC·출원연도', interaction: '체크 후 실행', precondition: '결과 1건 이상 · 패싯 로드됨', postcondition: '체크한 축을 필터에 추가해 재검색 → 1페이지로 이동' },
  'PAT-LST-040': { id: 'PAT-LST-040', screen: '특허 · 결과 목록', component: '정렬·perPage·페이지네이션', display: '출원일/공개일/등록일+방향 · perPage · 페이지', interaction: '변경 시 재요청(새 검색은 1페이지로)', precondition: '결과 존재', postcondition: 'orderByQuery/fetchOffset/fetchCount 갱신 후 재요청' },
  'PAT-LST-050': { id: 'PAT-LST-050', screen: '특허 · 결과 목록', component: 'CSV 다운로드', display: '버튼', interaction: '내보내기', precondition: '결과 1건 이상', postcondition: '현재 hits → CSV 생성·다운로드' },
  'PAT-LST-060': { id: 'PAT-LST-060', screen: '특허 · 결과 목록', component: '다중 선택 저장', display: '체크박스 + 선택 저장 버튼', interaction: '라이브러리 일괄 저장', precondition: '체크박스 1개 이상 선택', postcondition: '선택 특허를 라이브러리에 저장하고 체크 해제' },
  'PAT-LST-070': { id: 'PAT-LST-070', screen: '특허 · 결과 목록', component: '상태 표시(로딩/0건/오류)', display: '로딩·0건 안내·오류 메시지', interaction: '—', precondition: '검색 실행됨', postcondition: '응답 대기=로딩 · 0건=안내 · 실패=오류 메시지' },

  // ── 논문 · 검색어 입력 ──
  'PAP-INP-010': { id: 'PAP-INP-010', screen: '논문 · 검색어 입력', component: '발행연도 필터', display: '전체/최근1·5·10년 + 연도 from~to (국가 필터 없음)', interaction: '프리셋/범위 선택', precondition: '화면 진입', postcondition: 'yearFrom/yearTo(또는 years[]) 반영' },
  'PAP-INP-020': { id: 'PAP-INP-020', screen: '논문 · 검색어 입력', component: '검색어 범위 탭', display: '제목+초록 / 제목+초록+전문', interaction: '탭 전환', precondition: '화면 진입', postcondition: '선두 자유어 적용 범위 변경' },
  'PAP-INP-030': { id: 'PAP-INP-030', screen: '논문 · 검색어 입력', component: '검색식 입력창 + 검색/초기화 (영역)', display: '입력창 + 검색·초기화 버튼', interaction: '↓ 액션별', precondition: '—', postcondition: '개별 액션(PAP-INP-031/032) 참조' },
  'PAP-INP-031': { id: 'PAP-INP-031', screen: '논문 · 검색어 입력', component: '검색 실행', display: '검색 버튼', interaction: '클릭 / ⏎', precondition: '검색식 또는 항목별 필드에 값 1개 이상', postcondition: 'PaperSearchRequest 조립·POST → 논문 목록 전환 · 히스토리 추가' },
  'PAP-INP-032': { id: 'PAP-INP-032', screen: '논문 · 검색어 입력', component: '초기화', display: '초기화 버튼', interaction: '클릭', precondition: '—', postcondition: '입력값·필드 구성 복원' },
  'PAP-INP-040': { id: 'PAP-INP-040', screen: '논문 · 검색어 입력', component: '항목별 상세검색', display: '제목·초록·키워드·전문·저자 등(펼침/접힘)', interaction: '필드 값 입력 시 검색식 AND 누적', precondition: '상세검색 펼침·필드 선택됨', postcondition: '검색식 AND 누적 · 실행 후 입력값만 비움' },
  'PAP-INP-050': { id: 'PAP-INP-050', screen: '논문 · 검색어 입력', component: '검색 히스토리 (영역)', display: '최근 검색식 목록(특허와 동일 · 공통·횡단)', interaction: '↓ 액션별', precondition: '검색 1회 이상 실행됨', postcondition: '개별 액션(PAP-INP-051/052/053) 참조' },
  'PAP-INP-051': { id: 'PAP-INP-051', screen: '논문 · 검색어 입력', component: '항목 재검색', display: '히스토리 항목 행', interaction: '클릭', precondition: '기록 존재', postcondition: '선택 검색식으로 재실행' },
  'PAP-INP-052': { id: 'PAP-INP-052', screen: '논문 · 검색어 입력', component: '★즐겨찾기', display: '별 아이콘', interaction: '토글', precondition: '기록 존재', postcondition: '즐겨찾기 on/off 저장' },
  'PAP-INP-053': { id: 'PAP-INP-053', screen: '논문 · 검색어 입력', component: '삭제', display: '× 버튼 / 전체 삭제', interaction: '클릭', precondition: '기록 존재', postcondition: '해당(또는 전체) 기록 제거' },

  // ── 논문 · 결과 목록 ──
  'PAP-LST-010': { id: 'PAP-LST-010', screen: '논문 · 결과 목록', component: '상단 요약바', display: '검색식 칩 · 총 건수 · → 특허로', interaction: '교차검색 진입', precondition: '검색 실행 완료', postcondition: '총건수 표시 / 교차검색=특허 검색으로 검색어 이관·전환' },
  'PAP-LST-020': { id: 'PAP-LST-020', screen: '논문 · 결과 목록', component: '결과 카드 목록 (영역)', display: '제목(+대등제목) · 메타라인 · 초록("초록" 라벨) · 새 탭 열기 · 체크박스', interaction: '목록 렌더 / ↓ 액션별', precondition: '검색 실행 완료(응답 수신)', postcondition: '목록 렌더(totalCount·paper)' },
  'PAP-LST-021': { id: 'PAP-LST-021', screen: '논문 · 결과 목록', component: '카드 선택', display: '카드 본문', interaction: '클릭', precondition: '카드 존재', postcondition: '선택 인덱스 설정 · 미리보기 패널 오픈(내용은 보류(상세페이지))' },
  'PAP-LST-022': { id: 'PAP-LST-022', screen: '논문 · 결과 목록', component: '체크박스 선택', display: '카드별 체크박스', interaction: '체크', precondition: '카드 존재', postcondition: '저장 대상 선택 상태 반영(→ 다중 선택 저장)' },
  'PAP-LST-030': { id: 'PAP-LST-030', screen: '논문 · 결과 목록', component: '패싯 필터바', display: '저널 · 발행연도', interaction: '체크 후 실행', precondition: '결과 1건 이상 · 패싯 로드됨', postcondition: '저널/연도 필터 추가해 재검색 → 1페이지로' },
  'PAP-LST-040': { id: 'PAP-LST-040', screen: '논문 · 결과 목록', component: '정렬·perPage·페이지네이션', display: '매칭순/발행연도(최신·오래된) · perPage · 페이지', interaction: '변경 시 재요청', precondition: '결과 존재', postcondition: 'orderByQuery/fetchOffset 갱신 후 재요청' },
  'PAP-LST-050': { id: 'PAP-LST-050', screen: '논문 · 결과 목록', component: 'CSV 다운로드', display: '버튼', interaction: '내보내기', precondition: '결과 1건 이상', postcondition: '카드(제목·저자·저널·발행연도) → CSV 다운로드' },
  'PAP-LST-060': { id: 'PAP-LST-060', screen: '논문 · 결과 목록', component: '다중 선택 저장', display: '체크박스 + 선택 저장 버튼', interaction: '라이브러리 저장', precondition: '체크 1개 이상', postcondition: '선택 논문을 라이브러리에 저장하고 체크 해제' },
  'PAP-LST-070': { id: 'PAP-LST-070', screen: '논문 · 결과 목록', component: '상태 표시(로딩/0건/오류)', display: '로딩·0건 안내·오류 메시지', interaction: '—', precondition: '검색 실행됨', postcondition: '응답 대기=로딩 · 0건=안내 · 실패=오류 메시지' },

  // ── 공통 · 횡단 기능 (화면 요소에 걸쳐 실현 — 대표 위치에 부착) ──
  'COM-010': { id: 'COM-010', screen: '공통 · 횡단', component: '검색 히스토리', display: 'client(로컬 store)', interaction: '공통·횡단 기능', precondition: '검색 1회 이상 실행됨(기록 존재)', postcondition: '항목 선택 시 해당 검색식으로 재실행 · ★즐겨찾기 토글 저장(최대 100건)' },
  'COM-020': { id: 'COM-020', screen: '공통 · 횡단', component: 'URL 상태(SSOT)', display: '⚠ 프로토타입 미구현 — 연동 시 정의', interaction: '공통·횡단 기능', precondition: '검색 실행 or 쿼리 포함 URL 진입', postcondition: '상태를 URL에 직렬화 → 공유·뒤로가기·새로고침 복원' },
  'COM-030': { id: 'COM-030', screen: '공통 · 횡단', component: '재검색 재요청', display: 'client', interaction: '공통·횡단 기능', precondition: '동일 검색 조건으로 재실행', postcondition: 'URL 무변경이어도 명시적 invalidate·재요청' },
  'COM-040': { id: 'COM-040', screen: '공통 · 횡단', component: '라이브러리 저장', display: 'client(오버레이·상세 저장 버튼은 보류)', interaction: '공통·횡단 기능', precondition: '저장 대상(목록 체크 1개↑) 선택', postcondition: '선택 항목을 로컬 라이브러리에 저장하고 체크 해제' },
  'COM-050': { id: 'COM-050', screen: '공통 · 횡단', component: '특허 ↔ 논문 교차검색', display: 'client(별도 API 없음)', interaction: '공통·횡단 기능', precondition: '현재 검색어 존재', postcondition: '반대 도메인 검색으로 검색어 이관·화면 전환' },
  'COM-060': { id: 'COM-060', screen: '공통 · 횡단', component: 'CSV 내보내기', display: 'client', interaction: '공통·횡단 기능', precondition: '결과 1건 이상', postcondition: '현재 hits → CSV 생성·다운로드' },
  'COM-070': { id: 'COM-070', screen: '공통 · 횡단', component: '로딩/0건/오류 상태', display: 'client + 응답 성공/실패', interaction: '공통·횡단 기능', precondition: '검색 실행됨', postcondition: '응답 대기=로딩 · 0건=안내 · 실패=오류 메시지' },
};
