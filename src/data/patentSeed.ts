import type { PatentResult, PaperResult, PatentCitation } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// 시드 데이터 — 필터/정렬/페이지네이션을 의미있게 검증할 수 있도록 다분야·다국가·
// 다상태로 생성한다. 결정적(deterministic) 생성으로 리렌더 시 동일 결과 보장.
// ──────────────────────────────────────────────────────────────────────────

interface Domain {
  key: string;
  device: string;            // "~장치/시스템"
  titleKo: string;           // 한국어 명칭(접두)
  titleEn: string;           // 영어 명칭
  ipc: string; cpc: string;
  kw: string[];              // 검색 매칭 키워드(국문)
  parts: [string, string, string];   // 독립항 구성요소
  deps: string[];            // 종속항 한정
  abKo: string; abEn: string;
  pKo: string; sKo: string; eKo: string;   // 목적/해결/효과
  applicants: Record<'KR' | 'US' | 'JP' | 'CN' | 'EP', string>;
}

const DOMAINS: Domain[] = [
  {
    key: 'lidar', device: '객체 감지 장치',
    titleKo: '자율주행 차량용 라이다 기반 객체 감지', titleEn: 'LiDAR-Based Object Detection for Autonomous Driving',
    ipc: 'G01S 17/93', cpc: 'G06V 20/56', kw: ['라이다', '자율주행', '객체', '인식'],
    parts: ['라이다 센서로부터 3차원 포인트 클라우드를 획득하는 데이터 수집부', '상기 포인트 클라우드의 노이즈를 제거하는 전처리부', '딥러닝 모델로 객체를 분류하는 인식부'],
    deps: ['상기 인식부는 PointNet++ 구조를 포함하는 것', '상기 전처리부는 RANSAC 기반 지면 분리를 수행하는 것', '상기 데이터 수집부는 복수의 라이다를 시간 동기화하는 것'],
    abKo: '라이다 포인트 클라우드를 딥러닝으로 처리하여 보행자·차량·장애물을 실시간 감지·분류하는 장치 및 방법.',
    abEn: 'A device and method that processes LiDAR point clouds with deep learning to detect and classify objects in real time.',
    pKo: '주변 환경 인식 정확도와 실시간 처리 속도를 동시에 향상한다.', sKo: '지면 분리와 딥러닝 인식을 2단계로 처리한다.', eKo: '야간·악천후에서 카메라 단독 대비 18% 인식률 향상.',
    applicants: { KR: '현대자동차주식회사', US: 'Waymo LLC', JP: 'トヨタ自動車株式会社', CN: '百度在线网络技术有限公司', EP: 'Robert Bosch GmbH' },
  },
  {
    key: 'battery', device: '이차전지',
    titleKo: '고체 전해질을 이용한 리튬 이차전지', titleEn: 'Lithium Secondary Battery Using Solid Electrolyte',
    ipc: 'H01M 10/0562', cpc: 'H01M 10/0525', kw: ['배터리', '이차전지', '전해질', '리튬'],
    parts: ['리튬 함유 양극', '황화물계 고체 전해질층', '리튬 금속을 포함하는 음극'],
    deps: ['상기 고체 전해질은 Li6PS5Cl을 포함하는 것', '상기 음극은 보호층을 더 포함하는 것', '상기 양극은 NCM811 활물질을 포함하는 것'],
    abKo: '황화물계 고체 전해질을 적용하여 에너지 밀도와 안전성을 동시에 높인 전고체 리튬 이차전지.',
    abEn: 'An all-solid-state lithium secondary battery applying a sulfide solid electrolyte for higher energy density and safety.',
    pKo: '액체 전해질 누액·발화 위험을 제거하고 에너지 밀도를 높인다.', sKo: '황화물 고체 전해질과 리튬 금속 음극을 조합한다.', eKo: '에너지 밀도 450Wh/kg, 1000사이클 후 용량 유지율 92%.',
    applicants: { KR: '삼성SDI주식회사', US: 'QuantumScape Corporation', JP: 'パナソニックエナジー株式会社', CN: '宁德时代新能源科技股份有限公司', EP: 'BASF SE' },
  },
  {
    key: 'semi', device: '반도체 메모리 소자',
    titleKo: '3차원 적층 구조의 반도체 메모리', titleEn: 'Three-Dimensional Stacked Semiconductor Memory',
    ipc: 'H01L 27/11556', cpc: 'G11C 16/0483', kw: ['반도체', '메모리', '적층', '낸드'],
    parts: ['복수의 워드라인이 적층된 적층체', '상기 적층체를 관통하는 채널 구조', '상기 채널 구조에 연결된 비트라인'],
    deps: ['상기 적층체는 128단 이상으로 적층되는 것', '상기 채널 구조는 매크로니 형상을 갖는 것', '상기 적층체는 더미 워드라인을 더 포함하는 것'],
    abKo: '워드라인을 수직 적층하여 집적도를 높인 3차원 낸드 플래시 메모리 소자 및 그 제조 방법.',
    abEn: 'A 3D NAND flash memory device with vertically stacked word lines for higher integration, and its fabrication method.',
    pKo: '평면 미세화 한계를 넘어 비트당 비용을 낮춘다.', sKo: '워드라인 수직 적층과 관통 채널 구조를 적용한다.', eKo: '동일 면적 대비 집적도 4.2배, 비트당 비용 38% 절감.',
    applicants: { KR: 'SK하이닉스주식회사', US: 'Micron Technology, Inc.', JP: 'キオクシア株式会社', CN: '长江存储科技有限责任公司', EP: 'STMicroelectronics N.V.' },
  },
  {
    key: 'graphene', device: '복합 소재',
    titleKo: '그래핀 기반 고강도 복합 소재', titleEn: 'Graphene-Based High-Strength Composite Material',
    ipc: 'C01B 32/182', cpc: 'C08K 3/042', kw: ['그래핀', '복합', '소재', '강도'],
    parts: ['그래핀 산화물 분산액', '고분자 매트릭스', '상기 그래핀이 정렬된 계면층'],
    deps: ['상기 그래핀은 환원 그래핀 산화물인 것', '상기 매트릭스는 에폭시 수지인 것', '상기 계면층은 화학 결합을 형성하는 것'],
    abKo: '그래핀을 고분자 매트릭스에 정렬 분산하여 인장강도와 전기전도도를 동시에 향상한 복합 소재.',
    abEn: 'A composite material with graphene aligned in a polymer matrix to enhance tensile strength and conductivity.',
    pKo: '경량·고강도·전도성을 동시에 만족하는 소재를 제공한다.', sKo: '그래핀 정렬 분산과 계면 화학 결합을 적용한다.', eKo: '인장강도 1.8배, 전기전도도 220S/cm 달성.',
    applicants: { KR: '주식회사 엘지화학', US: 'Dow Inc.', JP: '東レ株式会社', CN: '华为技术有限公司', EP: 'BASF SE' },
  },
  {
    key: 'comm', device: '무선 통신 장치',
    titleKo: '5G NR 빔포밍 무선 통신', titleEn: '5G NR Beamforming Wireless Communication',
    ipc: 'H04W 16/28', cpc: 'H04B 7/0408', kw: ['통신', '빔포밍', '안테나', '기지국'],
    parts: ['복수의 안테나 소자를 포함하는 어레이', '빔 방향을 결정하는 제어부', '상기 빔으로 신호를 송신하는 송신부'],
    deps: ['상기 제어부는 채널 상태 정보에 기반하는 것', '상기 어레이는 64개 이상의 소자를 포함하는 것', '상기 송신부는 하이브리드 빔포밍을 수행하는 것'],
    abKo: '대규모 안테나 어레이와 채널 추정을 결합한 5G NR 빔포밍 무선 통신 장치 및 방법.',
    abEn: 'A 5G NR beamforming device combining a massive antenna array with channel estimation.',
    pKo: '밀집 환경에서 통신 용량과 커버리지를 향상한다.', sKo: '채널 상태 기반 하이브리드 빔포밍을 적용한다.', eKo: '셀 경계 처리율 2.6배, 간섭 9dB 저감.',
    applicants: { KR: '삼성전자주식회사', US: 'Qualcomm Incorporated', JP: '日本電気株式会社', CN: '华为技术有限公司', EP: 'Telefonaktiebolaget LM Ericsson' },
  },
  {
    key: 'medical', device: '의료 영상 진단 장치',
    titleKo: '딥러닝 기반 의료 영상 병변 검출', titleEn: 'Deep Learning-Based Lesion Detection in Medical Imaging',
    ipc: 'A61B 5/00', cpc: 'G06T 7/0012', kw: ['의료', '영상', '병변', '진단'],
    parts: ['의료 영상을 입력받는 입력부', '병변 후보를 검출하는 신경망부', '검출 결과를 시각화하는 출력부'],
    deps: ['상기 신경망부는 U-Net 구조를 포함하는 것', '상기 입력부는 CT 또는 MRI 영상을 수신하는 것', '상기 출력부는 신뢰도 점수를 함께 표시하는 것'],
    abKo: '딥러닝으로 CT·MRI 영상에서 병변을 자동 검출·분할하고 신뢰도와 함께 표시하는 진단 보조 장치.',
    abEn: 'A diagnostic-aid device that auto-detects and segments lesions in CT/MRI with deep learning and confidence scores.',
    pKo: '판독 누락을 줄이고 진단 일관성을 높인다.', sKo: 'U-Net 기반 분할과 신뢰도 추정을 결합한다.', eKo: '병변 검출 민감도 96.4%, 판독 시간 41% 단축.',
    applicants: { KR: '주식회사 루닛', US: 'GE HealthCare Technologies Inc.', JP: 'キヤノンメディカルシステムズ株式会社', CN: '上海联影医疗科技股份有限公司', EP: 'Siemens Healthineers AG' },
  },
  {
    key: 'display', device: '표시 장치',
    titleKo: '마이크로 LED 표시 장치', titleEn: 'Micro-LED Display Device',
    ipc: 'H01L 25/075', cpc: 'G09G 3/32', kw: ['디스플레이', '표시', 'LED', '화소'],
    parts: ['기판 상에 배열된 마이크로 LED 화소', '각 화소를 구동하는 박막 트랜지스터', '전사 정렬을 위한 정렬 마크'],
    deps: ['상기 마이크로 LED는 10마이크로미터 이하인 것', '상기 트랜지스터는 산화물 반도체를 포함하는 것', '상기 화소는 색변환층을 더 포함하는 것'],
    abKo: '마이크로미터급 LED 화소를 대량 전사·구동하여 고휘도·고효율을 구현한 표시 장치.',
    abEn: 'A display device that mass-transfers and drives micrometer-scale LED pixels for high brightness and efficiency.',
    pKo: '고휘도·저소비전력·장수명을 동시에 달성한다.', sKo: '대량 전사 정렬과 산화물 TFT 구동을 적용한다.', eKo: '휘도 5000nit, 소비전력 35% 절감.',
    applicants: { KR: '삼성디스플레이주식회사', US: 'Apple Inc.', JP: 'ソニーグループ株式会社', CN: '京东方科技集团股份有限公司', EP: 'ams-OSRAM AG' },
  },
  {
    key: 'hydrogen', device: '수전해 장치',
    titleKo: '고분자 전해질막 수전해', titleEn: 'PEM Water Electrolysis',
    ipc: 'C25B 1/04', cpc: 'C25B 9/23', kw: ['수소', '수전해', '연료전지', '촉매'],
    parts: ['고분자 전해질막', '상기 막의 양측에 배치된 촉매층', '물을 공급하는 유로'],
    deps: ['상기 촉매층은 이리듐 산화물을 포함하는 것', '상기 막은 강화 복합막인 것', '상기 유로는 물결 형상을 갖는 것'],
    abKo: '고분자 전해질막과 저백금 촉매를 적용하여 효율을 높인 그린수소 생산용 수전해 장치.',
    abEn: 'A PEM water electrolyzer for green hydrogen using a reinforced membrane and low-loading catalysts.',
    pKo: '귀금속 촉매 사용량을 줄이고 효율을 높인다.', sKo: '강화 복합막과 이리듐 산화물 촉매를 조합한다.', eKo: '전류밀도 3A/cm²에서 효율 78%, 촉매량 40% 절감.',
    applicants: { KR: '주식회사 한화솔루션', US: 'Plug Power Inc.', JP: '旭化成株式会社', CN: '阳光电源股份有限公司', EP: 'Siemens Energy AG' },
  },
  {
    key: 'robot', device: '로봇 매니퓰레이터',
    titleKo: '협동 로봇의 힘 제어', titleEn: 'Force Control for Collaborative Robots',
    ipc: 'B25J 9/16', cpc: 'B25J 13/085', kw: ['로봇', '협동', '제어', '관절'],
    parts: ['복수의 관절을 갖는 로봇 암', '각 관절의 토크를 측정하는 센서부', '힘 기반 궤적을 생성하는 제어부'],
    deps: ['상기 제어부는 임피던스 제어를 수행하는 것', '상기 센서부는 관절별 토크 센서를 포함하는 것', '상기 로봇 암은 충돌 감지 기능을 더 포함하는 것'],
    abKo: '관절 토크 센싱과 임피던스 제어를 결합하여 사람과 안전하게 협업하는 로봇 매니퓰레이터.',
    abEn: 'A collaborative robot manipulator combining joint-torque sensing with impedance control for safe human cooperation.',
    pKo: '사람과의 물리적 협업 안전성과 정밀도를 높인다.', sKo: '관절 토크 센싱과 임피던스 제어를 적용한다.', eKo: '충돌 감지 응답 8ms, 위치 정밀도 ±0.05mm.',
    applicants: { KR: '주식회사 두산로보틱스', US: 'Boston Dynamics, Inc.', JP: 'ファナック株式会社', CN: '深圳市大疆创新科技有限公司', EP: 'KUKA AG' },
  },
  {
    key: 'vision', device: '영상 처리 장치',
    titleKo: '트랜스포머 기반 영상 인식', titleEn: 'Transformer-Based Image Recognition',
    ipc: 'G06V 10/82', cpc: 'G06N 3/0455', kw: ['영상', '인식', '신경망', '트랜스포머'],
    parts: ['영상을 패치로 분할하는 임베딩부', '패치 간 관계를 학습하는 어텐션부', '클래스를 출력하는 분류부'],
    deps: ['상기 어텐션부는 멀티헤드 셀프 어텐션을 포함하는 것', '상기 임베딩부는 위치 인코딩을 더하는 것', '상기 분류부는 지식 증류로 학습되는 것'],
    abKo: '영상을 패치로 나누어 셀프 어텐션으로 전역 문맥을 학습하는 트랜스포머 기반 영상 인식 장치.',
    abEn: 'A transformer-based image recognition device learning global context via self-attention over image patches.',
    pKo: 'CNN 대비 전역 문맥 이해와 일반화 성능을 높인다.', sKo: '패치 임베딩과 멀티헤드 셀프 어텐션을 적용한다.', eKo: 'ImageNet Top-1 정확도 85.7%, 파라미터 30% 감소.',
    applicants: { KR: '네이버주식회사', US: 'Google LLC', JP: '株式会社Preferred Networks', CN: '腾讯科技（深圳）有限公司', EP: 'Robert Bosch GmbH' },
  },
];

// 도면 부호의 설명용 — 도메인별 주요 구성요소(부호 110/120/130에 대응)
const DOMAIN_COMPS: Record<string, [string, string, string]> = {
  lidar: ['데이터 수집부', '전처리부', '인식부'],
  battery: ['양극', '고체 전해질층', '음극'],
  semi: ['적층체', '채널 구조', '비트라인'],
  graphene: ['그래핀 산화물 분산액', '고분자 매트릭스', '계면층'],
  comm: ['안테나 어레이', '빔 제어부', '송신부'],
  medical: ['영상 입력부', '신경망부', '출력부'],
  display: ['마이크로 LED 화소', '구동 트랜지스터', '정렬 마크'],
  hydrogen: ['고분자 전해질막', '촉매층', '유로'],
  robot: ['로봇 암', '토크 센서부', '제어부'],
  vision: ['패치 임베딩부', '어텐션부', '분류부'],
};

const COUNTRY_SEQ: Array<'KR' | 'US' | 'JP' | 'CN' | 'EP'> = ['KR', 'US', 'JP', 'CN', 'EP'];
const STATUS_SEQ = ['등록', '심사중', '공개', '거절', '소멸'] as const;
const GRADES = ['AAA', 'AA', 'A', 'BBB', 'BB'];

function pad(n: number, len: number): string { return String(n).padStart(len, '0'); }

function docNumber(cc: string, year: number, seq: number): { number: string; pubNo: string; appNo: string; regNo: string } {
  const s7 = pad(1000000 + seq * 13457, 7).slice(-7);
  switch (cc) {
    case 'KR': return { number: `KR 10-${year}-${s7} A`, pubNo: `10-${year}-${s7} A`, appNo: `10-${year - 1}-${s7}`, regNo: `10-${pad(2500000 + seq * 311, 7)}` };
    case 'US': return { number: `US 1${pad(1000000 + seq * 7919, 7).slice(-7)} B2`, pubNo: `US ${year}/${pad(98000 + seq, 7).slice(-7)} A1`, appNo: `1${pad(7000000 + seq * 521, 7).slice(-7)}`, regNo: `US 1${pad(1000000 + seq * 7919, 7).slice(-7)} B2` };
    case 'JP': return { number: `JP ${year}-${pad(10000 + seq * 37, 6)} A`, pubNo: `특개${year}-${pad(10000 + seq * 37, 6)}`, appNo: `특원${year - 1}-${pad(90000 + seq * 53, 6)}`, regNo: `특허${pad(6000000 + seq * 211, 7)}` };
    case 'CN': return { number: `CN 1${pad(10000000 + seq * 99991, 9).slice(-9)} A`, pubNo: `CN 1${pad(10000000 + seq * 99991, 9).slice(-9)} A`, appNo: `${year - 1}1${pad(10000000 + seq * 33, 9).slice(-9)}`, regNo: `CN 1${pad(10000000 + seq * 99991, 9).slice(-9)} B` };
    default:   return { number: `EP ${pad(3000000 + seq * 401, 7)} A1`, pubNo: `EP ${pad(3000000 + seq * 401, 7)} A1`, appNo: `${pad(20000000 + seq * 17, 8)}`, regNo: `EP ${pad(3000000 + seq * 401, 7)} B1` };
  }
}

function mkDate(year: number, monthSeed: number, daySeed: number): string {
  const m = (monthSeed % 12) + 1;
  const d = (daySeed % 27) + 1;
  return `${year}-${pad(m, 2)}-${pad(d, 2)}`;
}

function buildClaims(dm: Domain): { no: number; dependsOn?: number; text: string }[] {
  const dev = dm.device;
  const claims: { no: number; dependsOn?: number; text: string }[] = [
    { no: 1, text: `제1항. ${dm.parts[0]}; ${dm.parts[1]}; 및 ${dm.parts[2]}를 포함하는, ${dev}.` },
    { no: 2, dependsOn: 1, text: `제2항. 제1항에 있어서, ${dm.deps[0]}을 특징으로 하는, ${dev}.` },
    { no: 3, dependsOn: 1, text: `제3항. 제1항에 있어서, ${dm.deps[1]}을 특징으로 하는, ${dev}.` },
    { no: 4, dependsOn: 2, text: `제4항. 제2항에 있어서, ${dm.deps[2]}을 특징으로 하는, ${dev}.` },
    { no: 5, dependsOn: 1, text: `제5항. 제1항의 ${dev}를 이용하는, 동작 방법.` },
  ];
  return claims;
}

function buildCitations(dm: Domain, year: number, seq: number): { citing: PatentCitation[]; cited: PatentCitation[] } {
  const c = (off: number): string => `KR 10-${year - 3}-${pad(1000000 + (seq * 7 + off) * 4513, 7).slice(-7)}`;
  const citing: PatentCitation[] = [
    { kind: 'patent', ref: c(1), title: `${dm.titleKo} 관련 선행기술` },
    { kind: 'patent', ref: c(2), title: `${dm.kw[0]} ${dm.kw[2] ?? ''} 종래 구조` },
    { kind: 'patent', ref: `US ${pad(9000000 + seq * 131, 7)} B2`, title: `Prior art on ${dm.titleEn.toLowerCase()}` },
    { kind: 'npl', ref: '[NPL]', title: `${dm.titleEn}: A Review, IEEE/Elsevier, ${year - 1}`, stage: '심사' },
  ];
  const cited: PatentCitation[] = [
    { kind: 'patent', ref: c(9), title: `${dm.titleKo} 후속 개량 발명` },
    ...(seq % 3 === 0 ? [{ kind: 'npl' as const, ref: '[NPL]', title: `Follow-up study citing this work, ${year + 1}`, stage: '심사' }] : []),
  ];
  return { citing, cited };
}

function figuresFor(dm: Domain): { label: string; desc: string }[] {
  const base = [
    `${dm.device}의 전체 구성도`,
    `주요 동작 흐름도`,
    `핵심 구성요소의 상세 구조`,
    `실시예 적용 예시`,
    `성능 비교 그래프`,
  ];
  const n = 4 + (dm.key.length % 3); // 4~6
  return base.slice(0, n).map((desc, i) => ({ label: `FIG ${i + 1}`, desc }));
}

function buildPatent(dm: Domain, domIdx: number, slot: number): PatentResult {
  const seq = domIdx * 5 + slot;
  const cc = COUNTRY_SEQ[slot % COUNTRY_SEQ.length];
  const status = STATUS_SEQ[(domIdx + slot) % STATUS_SEQ.length];
  const year = 2024 - ((seq * 3) % 16); // 2008~2024 분포
  const nums = docNumber(cc, year, seq);
  const isReg = status === '등록' || status === '소멸';
  const appDate = mkDate(year - 1, seq, seq * 2);
  const pubDate = mkDate(year, seq + 3, seq + 5);
  const regDate = isReg ? mkDate(year, seq + 6, seq + 1) : '-';
  const exp = isReg ? `${year - 1 + 20}-${appDate.slice(5)}` : '-';
  // device명과 중복되지 않는 자연스러운 접미 (slot 0은 접미 없음)
  const titleSuffix = ['', ' 및 그 동작 방법', ' 및 제어 방법', ' 및 그 제조 방법', '를 포함하는 시스템'][slot % 5];
  const { citing, cited } = buildCitations(dm, year, seq);
  const applicant = dm.applicants[cc];
  const isEn = cc === 'US' || cc === 'EP';

  const rightStatus = status === '등록' ? '존속 중' : status === '소멸' ? '소멸' : status === '거절' ? '거절확정' : status === '심사중' ? '심사 중' : '공개';
  const dispute = seq % 7 === 0 ? `분쟁 있음 (IPR${year}-${pad(seq, 4)})` : '분쟁 없음';
  const trial = seq % 9 === 0 ? `무효심판 계속 중 (${year}당${pad(seq, 4)})` : '심판 없음';

  return {
    number: nums.number, country: cc, status,
    title: isEn
      ? `${dm.titleEn}${['', ' (Method)', ' (Control Method)', ' (Manufacturing Method)', ' (System)'][slot % 5]}`
      : `${dm.titleKo}${titleSuffix}`,
    applicant, inventors: isEn ? 'A. Researcher, B. Engineer' : '김OO, 이OO',
    applicationNo: nums.appNo, applicationDate: appDate,
    publicationNo: nums.pubNo, publicationDate: pubDate,
    registerNo: nums.regNo && isReg ? nums.regNo : '-', registerDate: regDate,
    expirationDate: exp,
    ipc: dm.ipc, cpc: cc === 'JP' ? '-' : dm.cpc,
    rightStatus, rightChange: seq % 5 === 0 ? '있음 (권리 양도)' : '없음',
    grade: GRADES[seq % GRADES.length],
    trial, rejectionCount: status === '거절' ? 2 : status === '심사중' ? 1 : 0,
    applicantStandard: applicant, standardOrg: seq % 6 === 0 ? '3GPP' : '-', dispute,
    abstract: isEn ? dm.abEn : dm.abKo,
    repClaim: `제1항. ${dm.parts[0]}; ${dm.parts[1]}; 및 ${dm.parts[2]}를 포함하는, ${dm.device}.`,
    claims: buildClaims(dm),
    aiPurpose: dm.pKo, aiSolution: dm.sKo, aiEffect: dm.eKo,
    family: 1 + (seq % 5), citing: citing.length, cited: cited.length,
    citingList: citing, citedList: cited,
    figures: figuresFor(dm),
    refSigns: (() => {
      const c = DOMAIN_COMPS[dm.key] ?? ['제1 구성부', '제2 구성부', '제3 구성부'];
      return [
        { sign: '100', label: dm.device },
        { sign: '110', label: c[0] },
        { sign: '120', label: c[1] },
        { sign: '130', label: c[2] },
      ];
    })(),
    applicantAddress: cc === 'KR' ? '서울특별시 강남구 테헤란로 152' : cc === 'US' ? '1 Innovation Way, San Jose, CA' : cc === 'JP' ? '東京都港区赤坂1-1-1' : cc === 'CN' ? '深圳市南山区科技园' : 'Hauptstraße 1, München',
    applicantCode: pad(120000000000 + seq * 7919, 12),
    priorityDate: mkDate(year - 2, seq, seq), examRequestDate: mkDate(year - 1, seq + 1, seq + 2),
    terminationDate: status === '소멸' ? mkDate(year + 5, seq, seq) : undefined,
    description: isEn
      ? `The present invention relates to ${dm.titleEn.toLowerCase()}. Conventional approaches suffered from limited accuracy and robustness. ${dm.sKo}`
      : `본 발명은 ${dm.titleKo}에 관한 것이다. 종래 기술은 정확도와 견고성에 한계가 있었다. ${dm.sKo} ${dm.eKo}`,
    agent: cc === 'KR' ? '특허법인 다래' : cc === 'US' ? 'Wilson Sonsini Goodrich & Rosati' : cc === 'JP' ? '弁理士法人OOO' : 'Maucher Jenkins',
    agentAddress: cc === 'KR' ? '서울특별시 강남구 테헤란로 152' : '—',
  };
}

export const PATENT_SEED: PatentResult[] = DOMAINS.flatMap((dm, di) =>
  Array.from({ length: 5 }, (_, slot) => buildPatent(dm, di, slot)),
);

// ──────────────────────────────────────────────────────────────────────────
// 논문 시드 — 분야·언어·연도·피인용 다양화 (30건)
// ──────────────────────────────────────────────────────────────────────────

interface PaperTpl {
  field: string;
  topics: string[]; koTopics: string[];
  journals: string[]; koJournals: string[];
  kw: string[];
}
const PAPER_TPLS: PaperTpl[] = [
  { field: '전자공학',
    topics: ['LiDAR Point Cloud 3D Object Detection', 'Multi-Sensor Fusion for Perception', 'BEV-Based Scene Understanding'],
    koTopics: ['라이다 포인트 클라우드 기반 3차원 객체 검출', '자율주행 인식을 위한 다중 센서 융합', 'BEV 기반 주행환경 인식'],
    journals: ['IEEE Transactions on Intelligent Transportation Systems', 'Sensors', 'CVPR Proceedings'],
    koJournals: ['한국지능형교통시스템학회 논문지', '한국센서학회 논문지', '한국컴퓨터비전학회 논문집'],
    kw: ['라이다', '자율주행', '객체검출'] },
  { field: '화학공학',
    topics: ['Solid-State Electrolyte for Li Batteries', 'Sulfide Electrolyte Interface Stability', 'High-Nickel Cathode Degradation'],
    koTopics: ['리튬전지용 고체 전해질', '황화물 전해질 계면 안정성', '고니켈 양극재 열화 거동'],
    journals: ['Nature Energy', 'Journal of Power Sources', 'Advanced Energy Materials'],
    koJournals: ['한국에너지학회지', '전기화학회지', '한국전지학회 논문지'],
    kw: ['배터리', '전해질', '리튬'] },
  { field: '전기공학',
    topics: ['3D NAND Cell Reliability', 'Vertical Channel Scaling Limits', 'Charge Trap Flash Endurance'],
    koTopics: ['3차원 낸드 셀 신뢰성', '수직 채널 스케일링 한계', '전하트랩 플래시 내구성'],
    journals: ['IEEE Electron Device Letters', 'IEDM Proceedings', 'Solid-State Electronics'],
    koJournals: ['한국반도체학회 논문지', '전자공학회 논문지', '한국전자소자학회지'],
    kw: ['반도체', '메모리', '낸드'] },
  { field: '재료공학',
    topics: ['Graphene Composite Mechanical Properties', 'Reduced Graphene Oxide Conductivity', 'Interfacial Bonding in Nanocomposites'],
    koTopics: ['그래핀 복합소재의 기계적 물성', '환원 그래핀 산화물의 전도도', '나노복합재의 계면 결합'],
    journals: ['Carbon', 'ACS Nano', 'Composites Science and Technology'],
    koJournals: ['한국탄소학회지', '한국재료학회지', '복합재료학회 논문집'],
    kw: ['그래핀', '복합소재'] },
  { field: '정보통신공학',
    topics: ['Massive MIMO Beamforming', 'Hybrid Precoding for 5G NR', 'Channel Estimation in mmWave'],
    koTopics: ['대규모 MIMO 빔포밍', '5G NR 하이브리드 프리코딩', '밀리미터파 채널 추정'],
    journals: ['IEEE Transactions on Wireless Communications', 'IEEE JSAC', 'IEEE Communications Letters'],
    koJournals: ['한국통신학회 논문지', '한국전자파학회 논문지', '정보통신학회 논문지'],
    kw: ['통신', '빔포밍', '안테나'] },
  { field: '의공학',
    topics: ['Deep Learning Lesion Segmentation', 'Self-Supervised Medical Image Pretraining', 'Uncertainty Estimation in Diagnosis'],
    koTopics: ['딥러닝 기반 병변 분할', '자기지도 의료영상 사전학습', '진단 불확실성 추정'],
    journals: ['Medical Image Analysis', 'Radiology: Artificial Intelligence', 'Nature Medicine'],
    koJournals: ['대한의료정보학회지', '대한영상의학회지', '의공학회 논문지'],
    kw: ['의료', '영상', '진단'] },
  { field: '컴퓨터공학',
    topics: ['Vision Transformers at Scale', 'Knowledge Distillation for ViT', 'Self-Attention Efficiency'],
    koTopics: ['대규모 비전 트랜스포머', 'ViT 지식 증류', '셀프 어텐션 효율화'],
    journals: ['ICLR Proceedings', 'NeurIPS Proceedings', 'IEEE TPAMI'],
    koJournals: ['한국컴퓨터비전학회 논문집', '한국정보과학회 논문지', '패턴인식학회 논문지'],
    kw: ['영상인식', '트랜스포머', '신경망'] },
];

const AUTHORS_EN = [
  'Kim, J., Lee, S., Park, H.', 'Zhang, L., Wang, X., Chen, Y.', 'Smith, J., Brown, K., Davis, M.',
  'Tanaka, H., Suzuki, R.', 'Müller, F., Schmidt, A.', 'Gupta, R., Nair, P.',
];
const AUTHORS_KO = ['김정현, 이상우, 박해진', '장리, 왕샤오, 천위', '스미스, 브라운, 데이비스', '다나카, 스즈키', '뮐러, 슈미트', '굽타, 나이르'];

// DBpia 참고 — 한글 primary + 영문 병기 (분야·언어·키워드·내부/외부 링크)
function buildPaper(tpl: PaperTpl, ti: number, slot: number): PaperResult {
  const seq = ti * 5 + slot;
  const i = slot % tpl.topics.length;
  const topicEn = tpl.topics[i];
  const topicKo = tpl.koTopics[i];
  const isSurvey = slot % 3 === 0;
  const year = 2024 - ((seq * 2) % 12); // 2012~2024
  const lang: 'KO' | 'EN' = slot % 5 === 4 ? 'KO' : 'EN'; // 원문 언어

  const titleEn = `${isSurvey ? 'A Survey of ' : ''}${topicEn}${isSurvey ? ' for Real-World Applications' : ''}`;
  const titleKo = `${topicKo}${isSurvey ? ' 연구 동향' : ' 연구'}`;
  const authorsKo = AUTHORS_KO[seq % AUTHORS_KO.length];
  const authorsEn = AUTHORS_EN[seq % AUTHORS_EN.length];
  const journalEn = tpl.journals[i];
  const journalKo = tpl.koJournals[i];
  const abstractKo = `본 ${isSurvey ? '논문은' : '연구는'} ${tpl.field} 분야의 ${topicKo} 문제를 다룬다. 기존 방법은 정확도와 일반화 성능에서 한계를 보였으며, 특히 다양한 환경 조건에서 견고성이 부족하였다. 본 ${isSurvey ? '논문' : '연구'}에서는 이러한 한계를 극복하기 위한 새로운 접근 방식을 제안하고, 대규모 공개 데이터셋과 자체 구축 데이터셋을 활용하여 광범위한 실험을 수행하였다. 실험 결과 제안 방법은 기존 최고 성능 대비 정확도를 유의미하게 향상시켰으며, 연산 효율성 측면에서도 실용적인 수준을 달성하였다. 또한 다양한 절제 실험을 통해 각 구성 요소의 기여도를 정량적으로 분석하였으며, 실제 응용 환경에서의 적용 가능성을 검증하였다.`;
  const abstractEn = `This ${isSurvey ? 'survey reviews recent advances in' : 'paper proposes a novel method for'} ${topicEn.toLowerCase()}. Existing approaches suffer from limited accuracy and poor generalization, particularly under diverse real-world conditions. To address these limitations, we introduce a new framework and conduct extensive experiments on both large-scale public benchmarks and a self-collected dataset. The results demonstrate that the proposed method significantly outperforms prior state-of-the-art baselines in accuracy while maintaining practical computational efficiency. We further provide comprehensive ablation studies to analyze the contribution of each component and validate its applicability in real deployment scenarios.`;
  const doi = `10.${1000 + (seq % 9000)}/${tpl.field.length}${year}.${pad(seq, 6)}`;

  // 서지 상세 — 일부는 학위논문(학위수여기관 표시)
  const isThesis = seq % 10 === 7;
  const INSTITUTIONS = ['서울대학교 대학원', 'KAIST', '연세대학교 대학원', '고려대학교 대학원', '한양대학교 대학원'];
  const startPage = 1 + ((seq * 13) % 280);
  const endPage = startPage + 10 + (seq % 15);
  const month = 1 + (seq % 12);

  const ko = lang === 'KO';
  return {
    id: `pp_${seq}`,
    // 원문 언어가 primary(주 표시), 영문은 보조
    title: ko ? titleKo : titleEn, titleEn, titleKo,
    authors: ko ? authorsKo : authorsEn, authorsEn,
    journal: ko ? journalKo : journalEn, journalEn,
    abstract: ko ? abstractKo : abstractEn, abstractEn,
    year,
    doi,
    keywords: tpl.kw,
    field: tpl.field,
    language: lang,
    internalUrl: `axp-internal://fulltext/pp_${seq}`,   // 본문 내용(내부 전용)
    externalUrl: doi ? `https://doi.org/${doi}` : undefined, // 외부 제공 링크
    // 서지 상세
    paperType: isThesis ? 'thesis' : 'journal',
    institution: isThesis ? INSTITUTIONS[seq % INSTITUTIONS.length] : undefined,
    volume: isThesis ? undefined : `${10 + (seq % 40)}`,
    issue: isThesis ? undefined : `${1 + (seq % 6)}`,
    startPage,
    endPage,
    month,
  };
}

export const PAPER_SEED: PaperResult[] = PAPER_TPLS.flatMap((tpl, ti) =>
  Array.from({ length: 5 }, (_, slot) => buildPaper(tpl, ti, slot)),
);
