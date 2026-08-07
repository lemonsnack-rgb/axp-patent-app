// Sheet 3 사양 — 특허 상세 페이지
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { PatentResult, PatentCitation } from '../types';
import { downloadPatentPdf } from '../features/patentPdf';
import { Icon } from './Icon';
import { SiteFooter } from './SiteFooter';
import { CK_WORDMARK } from '../assets/ckLogo';
import { getPatentStatusDesc } from '../utils/badgeUtils';
import { docKindLabel, pubSeries, stripCountry, isDeletedClaim, familyCounts, dedupeFamily, rightChangeCell } from './patentDetailRules';
import { parseKeywords } from '../features/search/mockMatch';
import { Button } from '@muhayu/axp-ui';

// 키워드 추출은 features/search/mockMatch 로 이동(JSX 없는 순수 모듈 → 테스트 가능).
// 기존 import 경로 호환을 위해 re-export 한다.
export { parseKeywords } from '../features/search/mockMatch';

// 도면 라벨 — 수집 컬럼이 아니라 이미지 순번으로 화면에서 생성한다(파생).
const figLabel = (i: number) => `FIG ${i + 1}`;

// 국가 고유 분류(라벨 → 수집 컬럼) — 수집필드 모드 뱃지용
const COUNTRY_CLASS_COL: Record<string, string> = {
  'FI': 'JP FI.fi_code',
  'F-term': 'JP FTERM.fterm_code',
  '테마': 'JP TEMA.tema_code',
  'UPC': 'US UPC.upc_code',
  'EPC': 'EP EPC.epc_code',
};

export const KW_COLORS = [
  { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  { dot: '#f59e0b', bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  { dot: '#10b981', bg: '#f0fdf4', text: '#059669', border: '#a7f3d0' },
  { dot: '#3b82f6', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  { dot: '#8b5cf6', bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  { dot: '#ec4899', bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' },
  { dot: '#06b6d4', bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' },
  { dot: '#84cc16', bg: '#f7fee7', text: '#65a30d', border: '#d9f99d' },
];

export function PatentDetail({ data, onBack, posLabel, onSave, onPrev, onNext, searchQuery, embedded = false, backLabel = '검색결과로', backIcon = true }: {
  data: PatentResult; onBack: () => void; posLabel?: string;
  onSave?: () => void; onPrev?: () => void; onNext?: () => void;
  searchQuery?: string;
  embedded?: boolean; // 사이드 리더(분할) 모드 — 상단 액션바 숨김, 단일 컬럼(도면은 본문 내)
  backLabel?: string; // 뒤로가기 버튼 라벨 (검색/라이브러리 등 진입 맥락에 맞춤)
  backIcon?: boolean; // false면 화살표 숨김 (탭 닫기 등 복귀가 아닌 액션)
}) {
  const timeline = buildTimeline(data);
  // 문헌종류 — bibliographic.document_kind 코드를 라벨로 치환한다(코드 그대로 노출 금지).
  // 관측 코드는 등록계 B1·Y1뿐. 공개계(A·U)는 미적재라 도메인 미확정 → 미관측 코드는 원값 노출.
  const docKind = docKindLabel(data.documentKind)
    ?? ((data.status === '등록' || data.status === '소멸') ? '등록특허공보' : '공개특허공보');
  // 공개/공고 계열 — 번호 형식 + 일자 논리(공고일은 등록일 이후)로 라벨·값을 정한다.
  //   실데이터에 publication_date 가 공고일이 아닌 문헌이 115건 있다(WO 국제공개 113 + 실용신안 2).
  //   docs/상세페이지-수정지시서-2차.md §1·§2
  const pub = pubSeries(data.publicationNo, data.publicationDate, data.openDate, data.registerDate);
  // 권리변동(서지) — has_ownership_change 는 채움률 0% → 이력 배열 유무로 판정한다
  const rightChangeValue = rightChangeCell(data.rightChangeList);

  const [activeTab, setActiveTab] = useState('bib');
  const [claimMode, setClaimMode] = useState<'independent' | 'all'>('independent');
  const [showDeleted, setShowDeleted] = useState(false);
  const [familyTab, setFamilyTab] = useState('all');
  const secBib      = useRef<HTMLDivElement>(null);
  const secPerson   = useRef<HTMLDivElement>(null);
  const secAbstract = useRef<HTMLDivElement>(null);
  const secDesc     = useRef<HTMLDivElement>(null);
  const secClaim    = useRef<HTMLDivElement>(null);
  const secFamily   = useRef<HTMLDivElement>(null);
  const secCite     = useRef<HTMLDivElement>(null);
  const secClass    = useRef<HTMLDivElement>(null);
  const secEtc      = useRef<HTMLDivElement>(null);

  const TABS = [
    { key: 'bib',      label: '서지사항',    ref: secBib },
    { key: 'person',   label: '인명정보',    ref: secPerson },
    { key: 'abstract', label: '요약',        ref: secAbstract },
    { key: 'desc',     label: '상세설명',    ref: secDesc },
    { key: 'claim',    label: '청구범위',    ref: secClaim },
    { key: 'family',   label: '패밀리정보',  ref: secFamily },
    { key: 'cite',     label: '인용·피인용', ref: secCite },
    { key: 'class',    label: '분류코드',    ref: secClass },
    { key: 'etc',      label: '기타정보',    ref: secEtc },
  ] as const;

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>, key: string) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveTab(key);
  };

  // ── 키워드 하이라이터 바 (keywert 참고) ──
  const keywordBar = searchQuery && parseKeywords(searchQuery).length > 0 ? (
    <div data-spec="PAT-DET-030" className="shrink-0 bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs2 font-semibold text-gray-400 shrink-0">키워드</span>
        {parseKeywords(searchQuery).map((kw, i) => {
          const c = KW_COLORS[i % KW_COLORS.length];
          return (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-sm2 font-medium"
              style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
            >
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
              {kw}
              <span className="text-xs2 opacity-60 font-mono ml-0.5">0/0</span>
              <span className="flex gap-0.5 ml-0.5">
                <button className="text-xs2 opacity-50 hover:opacity-100 leading-none">↑</button>
                <button className="text-xs2 opacity-50 hover:opacity-100 leading-none">↓</button>
              </span>
            </span>
          );
        })}
        <button className="ml-auto text-xs2 text-gray-400 hover:text-gray-600 shrink-0">- 접기</button>
      </div>
    </div>
  ) : null;

  // ── 특허명·기본사항 + 제목 하단 액션 링크 (논문 상세와 동일 순서) ──
  const titleBlock = (
    <div data-spec="PAT-DET-020" className="px-6 pt-4 pb-3 border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span data-col="COALESCE(bibliographic.register_status, custom.legal_status) → 평문 라벨" title={getPatentStatusDesc(data.status)} className="cursor-help font-semibold text-gray-700">{data.status}</span>
        <span className="text-gray-300">·</span>
        <span data-col="bibliographic.country_code" className="font-semibold text-gray-600">{data.country}</span>
        <span data-col="REGEXP_REPLACE(bibliographic.literature_number, '^[A-Z]{2} ', '') — 국가는 왼쪽 배지로만 표시(중복 금지)" className="font-mono text-md2 font-semibold text-gray-600">{stripCountry(data.number)}</span>
      </div>
      <h2 data-col="CASE 원문언어=영문 THEN kpa_bibliographic.english_invention_name ELSE bibliographic.invention_title" className="text-2xl font-bold text-gray-800 leading-snug">{data.title}</h2>
      {/* 제목 하단 액션 링크 — 논문(원문 보기/본문 보기)과 동일 패턴 */}
      {/* 원문 PDF — source_link 채움률 0%(미반입). 버튼 자리는 유지하고 값이 없으면 비활성·안내로 상태를 알린다.
          (0% 필드를 숨기는 규칙은 서지 표의 '값 행'에만 적용한다. 액션 버튼은 기능 자리라 유지) */}
      <div data-col="CASE WHEN source_link IS NULL THEN 비활성('원문 준비 중') ELSE source_link 링크 END" className="flex flex-wrap items-center gap-2 mt-3">
        <Button data-spec="PAT-DET-021" variant="filled" color="primary" size="sm" className="text-xs2 h-8" onClick={() => downloadPatentPdf(data)} title="특허 원문 PDF 다운로드">
          <Icon name="doc" size={12} /> 원문 PDF 다운로드
        </Button>
      </div>
    </div>
  );

  // ── 앵커 탭 바 (sticky 처리는 레이아웃별 래퍼가 담당) ──
  const tabsBar = (
    <div data-spec="PAT-DET-040" className="flex items-center gap-0 bg-white border-b border-gray-200 overflow-x-auto scroll-thin shrink-0">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => scrollToSection(tab.ref, tab.key)}
          className={clsx(
            'px-3 py-2 text-sm2 font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
            activeTab === tab.key
              ? 'border-blue-400 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // ── 도면 패널 (전체보기 우측 rail / 오버레이 본문 내 공용) ──
  const drawingsAside = (
    <div data-spec="PAT-DET-140" className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
      <div className="px-3 py-2 border-b border-gray-200 bg-white shrink-0">
        <span className="text-sm2 font-bold text-gray-600">도면</span>
        <span className="ml-1.5 text-xs2 text-gray-400">({(data.figures || []).length})</span>
      </div>
      <DrawingsPanel figures={data.figures} refSigns={data.refSigns} />
    </div>
  );

  // ── 본문 섹션 (서지~기타) — 전체보기·오버레이 공용 ──
  const sections = (
    <>
            {/* 서지사항 */}
            <div ref={secBib} data-spec="PAT-DET-050">
              <Section title="서지사항" icon="cal">
                <table className="w-full text-md2">
                  <tbody>
                    <BibRow k="문헌번호" v={stripCountry(data.number)} mono k2={pub.headRight[0]} v2={pub.headRight[1]} hideEmpty
                      col="REGEXP_REPLACE(bibliographic.literature_number, '^[A-Z]{2} ', '') — 국가는 배지로만"
                      col2="CASE WHEN publication_date >= register_date THEN '공고일'=publication_date ELSE '공개일'=open_date END" />
                    <BibRow k="출원번호" v={data.applicationNo} mono k2="출원일" v2={data.applicationDate || '—'}
                      col="bibliographic.application_number" col2="bibliographic.application_date" />
                    {/* 공개 계열 — 번호가 없으면(공개 없이 등록, 21%) 행 자체를 숨긴다.
                        WO 국제공개는 짝 일자가 open_date 가 아니라 publication_date(국제공개일)다. */}
                    {pub.numberRow && (
                      <BibRow k={pub.numberRow[0]} v={pub.numberRow[1]} mono k2={pub.numberRow[2]} v2={pub.numberRow[3]} hideEmpty
                        col="bibliographic.publication_number (라벨은 번호 형식으로 판정)"
                        col2="공개계→open_date · 국제공개→publication_date(국제공개일)" />
                    )}
                    <BibRow k="등록번호" v={data.registerNo && data.registerNo !== '-' ? data.registerNo : '—'} mono k2="등록일" v2={data.registerDate && data.registerDate !== '-' ? data.registerDate : '—'}
                      col="COALESCE(bibliographic.register_number, '—')" col2="COALESCE(bibliographic.register_date, '—')" />
                    <BibRow k="문헌종류" v={docKind} k2="권리상태" v2={data.rightStatus || '—'}
                      col="CASE bibliographic.document_kind WHEN 'B1' THEN '등록특허공보' WHEN 'Y1' THEN '등록실용신안공보' ELSE document_kind END" col2="COALESCE(bibliographic.register_status, custom.legal_status) (이력 legal_status_history)" />
                    <BibRow k="원출원번호" v={data.originalAppNo && data.originalAppNo !== '-' ? data.originalAppNo : '—'} mono k2="국제출원번호" v2={data.intlAppNo && data.intlAppNo !== '-' ? data.intlAppNo : '—'}
                      col="bibliographic.original_application_number" col2="bibliographic.international_application_number" />
                    <BibRow k="우선권주장일" v={data.priorityDate || '—'} k2="심사청구일" v2={data.examRequestDate || '—'}
                      col="priority.priority_application_date" col2="bibliographic.original_examination_request_date" />
                    {/* 아래 행들은 값이 없으면 칸(라벨 포함)을 비우고, 양쪽 다 없으면 행을 숨긴다.
                        권리변동·최종처분상태·출원구분·실시권 등록일·지정국은 실데이터 채움률 0%다. */}
                    <BibRow k="존속기간(예상)만료일" v={data.expirationDate && data.expirationDate !== '-' ? data.expirationDate : ''} k2="권리변동" v2={rightChangeValue} hideEmpty
                      col="⚠파생 = bibliographic.register_date + 20년 (연장 시 + term_extension)" col2="CASE WHEN COUNT(right_history.change_histories) > 0 THEN '있음' END (has_ownership_change 는 0%)" />
                    <BibRow k="최종처분상태" v={data.finalDisposal || ''} k2="청구항 수" v2={data.claimCount != null ? `${data.claimCount}개` : ''} hideEmpty
                      col="bibliographic.final_disposal" col2="bibliographic.claim_count + '개' (삭제항 제외 실질 항 수)" />
                    <BibRow k="출원구분" v={data.applicationFlag || ''} k2="번역문 제출일" v2={data.translationSubmitDate || ''} hideEmpty
                      col="bibliographic.application_flag" col2="bibliographic.translation_submit_date" />
                    <BibRow k="도면 수" v={data.drawingCount ? `${data.drawingCount}건` : ''} k2="실시권 등록일" v2={data.licenseRegDate || ''} hideEmpty
                      col="bibliographic.drawing_count + '건' — 도면 미반입 구간에는 숨김" col2="custom.license_registration_date" />
                    <BibRow k="지정국" v={(data.designatedCountries?.length ?? 0) > 0 ? data.designatedCountries!.join(', ') : ''} k2="서열목록" v2={data.sequenceListing ? '있음' : ''} hideEmpty
                      col="JOIN(designated_country.designated_country, ', ') · EP는 JOIN(dsgn.national_name, ', ')" col2="CASE custom.sequence_listing_yn='Y' THEN '있음' END" />
                  </tbody>
                </table>
                {(data.priorityList?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">우선권 주장</div>
                    <ul data-col="[N행] priority.priority_application_country_code + ' ' + priority_application_number + ' · ' + priority_application_date (JP는 prir)" className="text-md2 text-gray-700 space-y-0.5">
                      {data.priorityList!.map((p, i) => (
                        <li key={i}><span className="font-mono text-gray-500">{p.country}</span> <span className="font-mono">{p.number}</span> · {p.date}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3.5">
                  <div className="text-sm2 font-semibold text-gray-500 mb-2">타임라인</div>
                  <div data-col="⚠파생 = priority_application_date → application_date → original_examination_request_date → COALESCE(open_date, publication_date) → register_date → (register_date + 20년)"><Timeline items={timeline} /></div>
                </div>
              </Section>
            </div>

            {/* 인명정보 */}
            <div ref={secPerson} data-spec="PAT-DET-060">
              <Section title="인명정보" icon="user">
                <table className="w-full text-md2">
                  <tbody>
                    <InfoRow k="출원인" v={data.applicant || '—'} col="JOIN(related_person[classification=APPLICANT].name, ', ')" />
                    <InfoRow k="출원인 주소" v={data.applicantAddress || '—'} muted={!data.applicantAddress} col="related_person[APPLICANT].address" />
                    <InfoRow k={data.country === 'JP' ? '출원인식별기호 (JP)' : '특허고객번호 (KR)'} v={data.applicantCode || ''} mono hideEmpty col="CASE country='JP' THEN custom.applicant_identifier ELSE representative_applicant.patent_customer_number (라벨도 같은 분기)" />
                    <InfoRow k="대표출원인" v={data.repApplicant || '—'} muted={!data.repApplicant} col="representative_applicant.representative_applicant_name" />
                    <InfoRow k="발명자" v={data.inventors || '—'} col="JOIN(related_person[classification=INVENTOR].name, ', ')" />
                    {/* 발명자 주소 — 전원 주소가 같으면 주소 1줄만, 다르면 '이름 — 주소'를 사람마다 한 줄(실데이터 렌더 규칙) */}
                    <InfoRow k="발명자 주소" v={data.inventorAddress || '(예시) 동일 — 출원인 주소'} muted col="CASE WHEN 전원 동일 THEN address ELSE [N행] name + ' — ' + address END (related_person[INVENTOR].address)" />
                    <InfoRow k="대리인" v={data.agent || '—'} muted={!data.agent} col="related_person[AGENT].name" />
                    <InfoRow k="심사관" v={data.examiner || ''} hideEmpty col="COALESCE(JOIN(related_person[classification=EXAMINER].name, ', '), custom.examiners)" />
                  </tbody>
                </table>
              </Section>
            </div>

            {/* 요약 */}
            <div ref={secAbstract} data-spec="PAT-DET-070">
              <Section title="요약" icon="doc">
                <TextBlock col="abstract.abstract (mediumtext 단일 · JP/CN 영문요약 e_abstract)">{data.abstract || '—'}</TextBlock>
              </Section>
            </div>

            {/* 상세설명 — specification 원문을 섹션 표제로 파싱해 하위섹션으로 표시한다.
                (기술분야·배경기술·해결하려는 과제·과제의 해결 수단·발명의 효과·도면의 설명·구체적 내용)
                파싱 반입이 확정되어 하위섹션 구성을 유지한다. [2026-07-31 확정] */}
            <div ref={secDesc} data-spec="PAT-DET-080">
              <Section title="상세설명" icon="book">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3.5">
                  {data.techField && <DescSub title="기술분야" col="PARSE(specification, '기술분야' 섹션)">{data.techField}</DescSub>}
                  {data.background && <DescSub title="배경기술" col="PARSE(specification, '배경기술' 섹션)">{data.background}</DescSub>}
                  {data.aiPurpose && <DescSub title="해결하려는 과제" col="PARSE(specification, '해결하려는 과제' 섹션)">{data.aiPurpose}</DescSub>}
                  {data.aiSolution && <DescSub title="과제의 해결 수단" col="PARSE(specification, '과제의 해결 수단' 섹션)">{data.aiSolution}</DescSub>}
                  {data.aiEffect && <DescSub title="발명의 효과" col="PARSE(specification, '발명의 효과' 섹션)">{data.aiEffect}</DescSub>}
                  {(data.figures || []).length > 0 && (
                    <div>
                      <div className="text-sm2 font-semibold text-gray-600 mb-1">도면의 설명</div>
                      <ul data-col="PARSE(specification, '도면의 간단한 설명' 섹션) → [N행] 'FIG ' + (순번+1) + ' ' + 설명" className="text-base2 text-gray-700 leading-relaxed space-y-0.5">
                        {(data.figures || []).map((f, i) => (
                          <li key={i}><span className="font-mono text-gray-500 mr-1.5">{figLabel(i)}</span>{f.desc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <DescSub title="발명의 구체적인 내용" col="specification.specification (값이 KIPRIS PDF URL이면 specification_extract_ticket이 전문 치환)">
                    {data.description || '(데모) 발명의 배경, 기술적 과제, 해결수단, 효과 등 본문 전체가 노출됩니다.'}
                  </DescSub>
                </div>
              </Section>
            </div>

            {/* 청구범위 */}
            <div ref={secClaim} data-spec="PAT-DET-090">
              <Section title="청구범위" icon="target">
                <div data-spec="PAT-DET-091" className="flex items-center gap-1 mb-2.5">
                  <button
                    onClick={() => setClaimMode('independent')}
                    className={clsx('px-2.5 py-0.5 rounded text-sm2 font-medium border', claimMode === 'independent' ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                  >독립항</button>
                  <button
                    onClick={() => setClaimMode('all')}
                    className={clsx('px-2.5 py-0.5 rounded text-sm2 font-medium border', claimMode === 'all' ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                  >전체청구항</button>
                </div>
                <div data-col="claim.claim (단일 텍스트) · 구조는 ⚠파생 = PARSE(claim.claim, '제N항' 분할 + '제M항에 있어서' → 인용관계) · 대표항 kpa_bibliographic.representation_claim_number" className="border border-blue-200 rounded-lg p-3.5 bg-white">
                  {(() => {
                    const all = data.claims && data.claims.length
                      ? data.claims
                      : [{ no: 1, text: data.repClaim }];
                    // ⚠ 잠정(A안) — 삭제항 처리 방식은 **변리사 확인 후 확정**한다. 확정 전까지 개발 구현 보류.
                    //    A안: 삭제항을 목록에서 빼고 「삭제된 청구항 N개」 접기로 알린다.
                    //    B안: 「삭제」 라벨로 목록에 남기되 독립항 분류에서만 제외.  C안: 현행 유지.
                    //    배경: 삭제항은 본문이 '삭제' 한 단어이고 인용관계가 없어 지금은 독립항으로 분류된다.
                    //    docs/상세페이지-수정지시서.md §7
                    const claims = all.filter(c => !isDeletedClaim(c.text));
                    const deleted = all.filter(c => isDeletedClaim(c.text));
                    const independents = claims.filter(c => !c.dependsOn);
                    const visible = claimMode === 'independent' ? independents : claims;
                    return <>
                    {deleted.length > 0 && (
                      <div className="mb-2.5 text-sm2">
                        <button
                          onClick={() => setShowDeleted(v => !v)}
                          className="text-gray-500 hover:text-gray-700 underline decoration-dotted"
                        >{showDeleted ? '▾' : '▸'} 삭제된 청구항 {deleted.length}개</button>
                        {showDeleted && (
                          <div data-col="claims[] WHERE TRIM(text) = '삭제'" className="mt-1.5 text-gray-500">
                            {deleted.map(c => `제${c.no}항`).join(', ')} — 심사 중 삭제되어 권리가 없습니다.
                          </div>
                        )}
                      </div>
                    )}
                    {visible.map((c, idx) => (
                      c.dependsOn ? (
                        <div key={c.no} className={clsx(idx > 0 && 'mt-2.5')}>
                          <SubClaim n={c.no} dependsOn={c.dependsOn}>{stripClaimNo(c.text)}</SubClaim>
                        </div>
                      ) : (
                        <div key={c.no} className={clsx(idx > 0 && 'mt-2.5')}>
                          <div className="text-md2 font-semibold text-blue-700 mb-1.5">독립항 — 제{c.no}항</div>
                          <div className="text-base2 text-gray-700 leading-relaxed bg-blue-50 px-3 py-2 rounded border-l-4 border-blue-500">
                            {stripClaimNo(c.text)}
                          </div>
                        </div>
                      )
                    ))}
                    </>;
                  })()}
                </div>
              </Section>
            </div>

            {/* 패밀리정보 — 국가 탭 필터 */}
            <div ref={secFamily} data-spec="PAT-DET-100">
              <Section title="패밀리 정보" icon="grid">
                {(() => {
                  const families = familyCounts(data.familyList);
                  const total = families.reduce((s, [, n]) => s + n, 0);
                  const filtered = familyTab === 'all' ? families : families.filter(([cc]) => cc === familyTab);
                  return (
                    <>
                      <div data-spec="PAT-DET-101" className="flex items-center gap-0 border-b border-gray-100 mb-3 overflow-x-auto scroll-thin">
                        {[['all', `전체(${total})`] as [string, string], ...families.map(([cc, n]) => [cc, `${cc}(${n})`] as [string, string])].map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => setFamilyTab(key)}
                            className={clsx(
                              'px-3 py-1.5 text-sm2 font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
                              familyTab === key
                                ? 'border-blue-400 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700',
                            )}
                          >{label}</button>
                        ))}
                      </div>
                      <div data-col="국가 = SUBSTRING(family.items[].literature_number, 1, 2) · 국가별 = COUNT(DISTINCT 정규화키) GROUP BY 국가 · 전체 = 국가별 합계" className="flex items-center gap-2 flex-wrap">
                        {filtered.map(([cc, n]) => (
                          <span key={cc} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-md2 text-blue-700">
                            <strong className="font-mono">{cc}</strong> <span>{n}건</span>
                          </span>
                        ))}
                      </div>
                      {(data.familyList?.length ?? 0) > 0 && (
                        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-1.5 text-xs2 font-semibold text-gray-600 border-b border-gray-200">패밀리 문헌</div>
                          <ul data-col="[N행] family.family_country_code + ' ' + family_literature_number + ' ' + application_date + ' ' + invention_title" className="divide-y divide-gray-50">
                            {/* 명칭·출원일은 채움률 0%라 열을 만들지 않는다. 0 패딩만 다른 중복 문헌은 합친다. */}
                            {dedupeFamily(data.familyList!).filter(f => familyTab === 'all' || f.country === familyTab).map((f, i) => (
                              <li key={i} className="flex items-baseline gap-2 px-3 py-1.5 text-sm2">
                                <span className="shrink-0 font-mono text-gray-500">{f.country}</span>
                                <span className="font-mono text-brand-400 shrink-0">{f.docNumber}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}
              </Section>
            </div>

            {/* 인용·피인용 — 구조화된 목록 */}
            <div ref={secCite} data-spec="PAT-DET-110">
              <Section title="인용·피인용" icon="link">
                <CiteBlock title={`인용 (${(data.citingList ?? []).length || data.citing}건)`} list={data.citingList} />
                <div className="mt-3">
                  <CiteBlock title={`피인용 (${(data.citedList ?? []).length || data.cited}건)`} list={data.citedList} cited />
                </div>
                {(data.priorArtDocs?.length ?? 0) > 0 && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                    <div className="text-base2 font-bold text-gray-700 mb-2">선행기술문헌 ({data.priorArtDocs!.length}건)</div>
                    <ul data-col="[N행] prior_technology_document.prior_technology_document_country + ' ' + prior_technology_document_number — ⚠갱신본 기준 피인용(forward)과 동일 테이블 → 피인용 블록과 통합 필요" className="text-md2 text-gray-700 list-disc pl-4 space-y-0.5">
                      {data.priorArtDocs!.map((d, i) => (
                        <li key={i}><span className="font-mono text-brand-400">{d.country} {d.number}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            </div>

            {/* 분류코드 */}
            <div ref={secClass} data-spec="PAT-DET-120">
              <Section title="분류코드" icon="tag">
                <table className="w-full text-md2">
                  <tbody>
                    <InfoRow k="IPC" v={(data.ipcList?.length ? data.ipcList : [data.ipc]).filter(Boolean).join('  ·  ') || '—'} mono col="JOIN(COALESCE(ipc.ipc_number, kpa_ipc.ipc_code), '  ·  ') (버전 kpa_ipc.ipc_version)" />
                    <InfoRow k="CPC" v={(data.cpcList?.length ? data.cpcList : [data.cpc]).filter(v => v && v !== '-').join('  ·  ') || '—'} mono col="COALESCE(JOIN(cpc.cpc_code, '  ·  '), custom.cpc_code, '—')" />
                    {data.countryClassifications?.map((c, i) => (
                      <InfoRow key={i} k={c.label} v={c.codes.join('  ·  ') || '—'} mono col={COUNTRY_CLASS_COL[c.label] ?? '국가고유 분류 테이블'} />
                    ))}
                  </tbody>
                </table>
              </Section>
            </div>

            {/* 기타정보 — 대리인 + 심판 통합 */}
            <div ref={secEtc} data-spec="PAT-DET-130">
              <Section title="기타정보" icon="briefcase">
                <table className="w-full text-md2 mb-3">
                  <tbody>
                    <InfoRow k="대리인 주소" v={data.agentAddress || '—'} muted={!data.agentAddress} col="related_person[AGENT].address" />
                  </tbody>
                </table>
                {(data.rightChangeList?.length ?? 0) > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">권리변동 이력</div>
                    <ul data-col="[N행] right_change.change_date + ' │ ' + name + ' │ ' + change_type" className="text-md2 text-gray-700 space-y-0.5">
                      {data.rightChangeList!.map((r, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-gray-400 font-mono w-24 shrink-0">{r.date}</span>
                          <span className="flex-1">{r.name}</span>
                          <span className="text-gray-500 shrink-0">{r.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(data.rightTransferList?.length ?? 0) > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">권리이전 이력</div>
                    <ul data-col="[N행] right_transfer.registration_date + ' │ ' + document_name + ' (' + change_before_content + ' → ' + change_after_content + ') │ ' + registration_number" className="text-md2 text-gray-700 space-y-0.5">
                      {data.rightTransferList!.map((r, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-gray-400 font-mono w-24 shrink-0">{r.date}</span>
                          <span className="flex-1">{r.docName} <span className="text-gray-400">({r.before} → {r.after})</span></span>
                          <span className="font-mono text-sm2 text-gray-400">{r.regNo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(data.adminProcess?.length ?? 0) > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">행정처리(수발신) 이력</div>
                    <ul data-col="[N행] administrative_process.receipt_send_date + ' ' + receipt_send_document_name + ' ' + proc_status (부가 step · trial_number 브릿지)" className="text-md2 text-gray-700 space-y-0.5">
                      {data.adminProcess!.map((a, i) => (
                        <li key={i} className="flex items-center gap-2"><span className="text-gray-400 font-mono w-24 shrink-0">{a.date}</span><span className="flex-1">{a.docName}</span><span className="text-gray-500 shrink-0">{a.status}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {(data.rnd?.length ?? 0) > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">국가 R&D 정보</div>
                    {data.rnd!.map((r, i) => (
                      <div key={i} data-col="[N행] 1행 = rnd.rnd_task_name + ' (' + rnd_task_number + ')' · 2행 = rnd_department_name + ' · ' + rnd_project_name + ' · ' + rnd_managing_institute_name + ' · ' + rnd_duration" className="text-md2 text-gray-700 mb-1.5">
                        <div className="font-medium">{r.task} <span className="text-gray-400 font-mono text-sm2">({r.taskNo})</span></div>
                        <div className="text-sm2 text-gray-500">{r.dept} · {r.project} · {r.institute} · {r.period}</div>
                      </div>
                    ))}
                  </div>
                )}
                {data.standard && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">표준특허</div>
                    <Row k="표준화기구" v={data.standard.org} col="standard.standardization_organization" />
                    <Row k="표준번호" v={data.standard.numbers} col="standard.standard_numbers" />
                    <Row k="표준기술명" v={data.standard.techName} col="standard.standard_technology_name" />
                    <Row k="선언(등재)자" v={data.standard.declarants} col="standard.standard_declarants" />
                    <Row k="선언일" v={data.standard.date} col="standard.standard_declaration_date" />
                  </div>
                )}
                {(data.jpEdition || data.agentCategory || data.epFileRef || data.epFilingLanguage || (data.usProvisional?.length ?? 0) > 0 || (data.usRelatedApps?.length ?? 0) > 0) && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">국가별 추가정보</div>
                    {data.jpEdition && <Row k="공보판(JP)" v={data.jpEdition} col="custom.edition (JP)" />}
                    {data.agentCategory && <Row k="대리인 구분(JP)" v={data.agentCategory} col="custom.agent_category (JP)" />}
                    {data.epFileRef && <Row k="출원인 정리번호(EP)" v={data.epFileRef} col="custom.applicant_file_reference (EP)" />}
                    {data.epFilingLanguage && <Row k="출원/공개 언어(EP)" v={data.epFilingLanguage} col="custom.filing_language (EP)" />}
                    {(data.usProvisional?.length ?? 0) > 0 && <Row k="가출원 번호(US)" v={data.usProvisional!.join(', ')} col="JOIN(custom.provisional_application_numbers, ', ')" />}
                    {(data.usRelatedApps?.length ?? 0) > 0 && (
                      <div className="mt-1.5">
                        <div className="text-sm2 font-semibold text-gray-500 mb-2">관련출원(US)</div>
                        <ul data-col="[N행] rel_appl.registration_number + ' │ ' + registration_date + ' │ ' + classification + ' │ ' + status" className="text-md2 text-gray-700 space-y-0.5">
                          {data.usRelatedApps!.map((u, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="font-mono text-gray-500 w-28 shrink-0">{u.regNo}</span>
                              <span className="text-gray-400 font-mono w-24 shrink-0">{u.date}</span>
                              <span className="flex-1">{u.classification}</span>
                              <span className="text-gray-500 shrink-0">{u.status}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {data.trial && (
                  // 심판 — 수집 측 3개 파라미터(타입·상태·번호)를 각각 표시. [2026-07-31 확정]
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">심판 정보</div>
                    <Row k="심판 종류" v={data.trial.type} col="trial.trial_type (심판종류) · 블록 표시 = custom.has_trial='Y' OR EXISTS(trial)" />
                    <Row k="심판 상태" v={data.trial.status} col="trial.trial_status (심판상태)" />
                    <Row k="심판 번호" v={data.trial.number} col="COALESCE(trial.trial_number_text, trial.trial_number)" />
                  </div>
                )}
              </Section>
            </div>
    </>
  );

  // ── 전체보기(새 탭): 가운데 정렬 문서형 — 논문 상세와 동일 레이아웃 ──
  if (!embedded) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-zinc-50">
        {/* 헤더 — 논문 전체보기와 동일(닫기 + 저장 filled) */}
        <div data-spec="PAT-DET-010" className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
          <img src={CK_WORDMARK} alt="CK.Patent" className="h-6 w-auto object-contain" />
          {onPrev && <Button data-spec="PAT-DET-011" variant="outlined" color="primary" size="sm" onClick={onPrev} title="이전">◀</Button>}
          {posLabel && <span data-spec="PAT-DET-011" className="text-sm2 text-gray-500 font-mono">{posLabel}</span>}
          {onNext && <Button data-spec="PAT-DET-011" variant="outlined" color="primary" size="sm" onClick={onNext} title="다음">▶</Button>}
          <span className="flex-1" />
          <Button data-spec="PAT-DET-012" variant="filled" color="primary" size="sm" onClick={onSave}><Icon name="star" size={12} /> 라이브러리 저장</Button>
          <Button data-spec="PAT-DET-013" variant="outlined" color="primary" size="sm" onClick={onBack}>
            {backIcon && <Icon name="arrow-left" size={13} />} {backLabel}
          </Button>
        </div>
        {keywordBar}
        {/* 스크롤 페이지 — 가운데 정렬 문서 + 우측 도면 rail + 푸터 */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <main className="lg:col-span-8 min-w-0 space-y-6">
                {/* 제목+탭 카드 — 스크롤 시 제목 영역 자체를 상단 고정(중복 압축제목 제거) */}
                <div className="sticky top-0 z-20 bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {titleBlock}
                  {tabsBar}
                </div>
                {/* 본문 섹션 카드 */}
                <div className="bg-white border border-gray-200 rounded-xl px-6 py-4">{sections}</div>
              </main>
              {/* 우측 rail — 도면 (논문 전체보기의 인용 rail과 동일 위치) */}
              <aside className="lg:col-span-4 lg:sticky lg:top-6">
                {drawingsAside}
              </aside>
            </div>
          </div>
          <SiteFooter />
        </div>
      </div>
    );
  }

  // ── 오버레이 드로어(embedded): 단일 컬럼 ──
  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {titleBlock}
        {tabsBar}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-4">
          {/* 도면 (드로어 전용 — 본문 내). 대표도면 우선 */}
          {(data.figures || []).length > 0 && (
            <div data-spec="PAT-DET-140" className="mb-4">
              <div className="text-sm2 font-semibold text-gray-500 mb-2">도면 ({(data.figures || []).length})</div>
              <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden" style={{ height: 360 }}>
                <DrawingsPanel figures={data.figures} refSigns={data.refSigns} />
              </div>
            </div>
          )}
          {sections}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="flex items-center gap-1.5 text-base2 font-bold text-gray-700 pb-1.5 border-b border-gray-200 mb-2.5">
        <span className="text-blue-600"><Icon name={icon} size={13} /></span>
        {title}
      </h3>
      <div className="text-md2 text-gray-700">{children}</div>
    </section>
  );
}

// ── 수집필드 모드(data-col) ──
// col/col2 = 해당 표시값의 수집 DB 컬럼(테이블.컬럼). '⚠'로 시작하면 파생·목업·미정.
// 정본은 docs/UI-수집필드-매핑표.md — 값 변경 시 문서와 함께 갱신한다.
// hideEmpty: 값이 없는 칸은 라벨까지 비우고, 양쪽 다 없으면 행 자체를 렌더하지 않는다.
//   빈 칸은 <td>로 자리를 유지해 표 정렬(4칸)이 깨지지 않게 한다.
function BibRow({ k, v, mono, k2, v2, col, col2, hideEmpty }: { k: string; v: string; mono?: boolean; k2: string; v2: string; col?: string; col2?: string; hideEmpty?: boolean }) {
  const blank = (x?: string) => !x || x === '—' || x === '-';
  if (hideEmpty && blank(v) && blank(v2)) return null;
  const showL = !hideEmpty || !blank(v);
  const showR = !hideEmpty || !blank(v2);
  return (
    <tr className="border-b border-gray-100">
      <td className="text-gray-500 py-1.5 w-28 whitespace-nowrap pr-2">{showL ? k : ''}</td>
      <td data-col={showL ? col : undefined} className={`text-gray-800 py-1.5 pr-3 ${mono ? 'font-mono' : ''}`}>{showL ? v : ''}</td>
      <td className="text-gray-500 py-1.5 w-28 whitespace-nowrap pr-2">{showR ? k2 : ''}</td>
      <td data-col={showR ? col2 : undefined} className="text-gray-800 py-1.5">{showR ? v2 : ''}</td>
    </tr>
  );
}

// hideEmpty: 채움률 0% 필드(심사관·특허고객번호 등)는 '—'로 자리를 차지하지 않고 행을 숨긴다.
function InfoRow({ k, v, mono, muted, col, hideEmpty }: { k: string; v: string; mono?: boolean; muted?: boolean; col?: string; hideEmpty?: boolean }) {
  if (hideEmpty && (!v || v === '—' || v === '-')) return null;
  return (
    <tr className="border-b border-gray-100">
      <td className="text-gray-500 py-1.5 w-28 whitespace-nowrap pr-2">{k}</td>
      <td data-col={col} className={`py-1.5 ${mono ? 'font-mono' : ''} ${muted ? 'text-gray-400' : 'text-gray-800'}`}>{v}</td>
    </tr>
  );
}

function Row({ k, v, col }: { k: string; v: string; col?: string }) {
  return <div className="flex items-center gap-2 py-1.5 text-md2"><span className="text-gray-500 w-28 shrink-0">{k}</span><span data-col={col} className="text-gray-800">{v}</span></div>;
}

// 상세설명 하위 섹션 (기술분야/배경기술/과제/해결수단/효과/구체적 내용) — specification 파싱 결과
function DescSub({ title, children, col }: { title: string; children: React.ReactNode; col?: string }) {
  return (
    <div>
      <div className="text-sm2 font-semibold text-gray-600 mb-1">{title}</div>
      <div data-col={col} className="text-base2 text-gray-700 leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  );
}

function TextBlock({ children, col }: { children: React.ReactNode; col?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div data-col={col} className="text-base2 text-gray-700 leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  );
}

function SubClaim({ n, dependsOn, children }: { n: number; dependsOn?: number; children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 bg-gray-50 rounded text-md2 text-gray-600 leading-relaxed border-l-4 border-gray-200">
      <span className="font-semibold text-gray-500 mr-1.5">종속항 (제{n}항{dependsOn ? ` → 제${dependsOn}항 인용` : ''})</span>
      {children}
    </div>
  );
}

// "제N항." 접두를 제거해 라벨과 중복되지 않게 한다.
function stripClaimNo(text: string): string {
  return text.replace(/^제\s*\d+\s*항\.?\s*/, '');
}

function CiteBlock({ title, list, cited }: { title: string; list?: PatentCitation[]; cited?: boolean }) {
  const items = list ?? [];
  const patents = items.filter(c => c.kind === 'patent');
  const npls = items.filter(c => c.kind === 'npl');
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
      <div className="text-base2 font-bold text-gray-700 mb-2">{title}</div>
      <div className="text-xs2 font-semibold text-gray-500 mt-2 mb-1">특허 정보</div>
      {patents.length > 0 ? (
        // 인용문헌 '명칭'은 수집 컬럼이 없어 표시하지 않는다 → 번호·국가·발명자명·일자로 식별.
        <ul data-col={cited
          ? '[N행] 피인용(forward) = prior_technology_document.prior_technology_document_country + \' \' + prior_technology_document_number (+ std_status_name · citation_type_name) — 번호는 피인용 문헌의 출원번호'
          : '[N행] 인용(backward) = citation.std_citation_country_code + \' \' + std_citation_number + \' · \' + std_citation_publication_date (원문 표기는 original_citation_number · 발명자명은 US·JP ctltr.inventor_name)'} className="text-md2 text-gray-700 list-disc pl-4 space-y-0.5">
          {patents.map((c, i) => (
            <li key={i}>
              <span className="font-mono text-gray-500 mr-1">{c.country}</span>
              <span className="font-mono text-brand-400">{c.ref}</span>
              {c.inventor && <span className="text-gray-600"> · {c.inventor}</span>}
              {c.date && <span className="font-mono text-gray-400"> · {c.date}</span>}
            </li>
          ))}
        </ul>
      ) : <div className="text-md2 text-gray-400 pl-1">없음</div>}
      <div className="text-xs2 font-semibold text-gray-500 mt-3 mb-1">비특허(논문) 정보</div>
      {npls.length > 0 ? (
        // 비특허 인용은 제목·저널·연도가 한 컬럼에 통째로 들어온다 → 파싱 없이 원문 그대로 표시.
        <ul data-col="[N행] '[NPL] ' + paper_citation.paper_title + ', ' + COALESCE(paper_journal, '') + ', ' + paper_year (저자 paper_author 병기 여부는 화면 결정 · US·JP는 ctltr_etc.other_citations 원문)" className="text-md2 text-gray-700 list-disc pl-4 space-y-0.5">
          {npls.map((c, i) => (
            <li key={i}><span className="font-mono text-gray-400 mr-1">[NPL]</span>{c.text}</li>
          ))}
        </ul>
      ) : <div className="text-md2 text-gray-400 pl-1">없음</div>}
    </div>
  );
}

function buildTimeline(d: PatentResult) {
  const isReg = d.status === '등록';
  const isExp = d.status === '소멸';
  const examReq = d.examRequestDate || (d.applicationDate ? addDays(d.applicationDate, 30) : '');
  const items = [
    { label: '우선권주장일', date: d.priorityDate || d.applicationDate || '—' },
    { label: '출원일',       date: d.applicationDate || '—' },
    { label: '심사청구일',   date: examReq || '—' },
    { label: '공개/공고일',  date: d.publicationDate || '—' },
  ];
  if (isReg) {
    items.push({ label: '등록일', date: (d.registerDate && d.registerDate !== '-') ? d.registerDate : '—' });
    items.push({ label: '존속기간예상만료일', date: (d.expirationDate && d.expirationDate !== '-') ? d.expirationDate : '—' });
  } else if (isExp) {
    items.push({ label: '등록일', date: (d.registerDate && d.registerDate !== '-') ? d.registerDate : '—' });
    items.push({ label: '소멸일', date: d.terminationDate || '—' });
  }
  return items;
}
function addDays(s: string, n: number): string {
  try { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); } catch { return ''; }
}

function Timeline({ items }: { items: { label: string; date: string }[] }) {
  return (
    <div className="flex flex-wrap items-start gap-x-1 gap-y-3 pb-1">
      {items.map((it, i) => (
        <div key={i} className="flex items-start">
          <div className="flex flex-col items-center text-center w-[88px] px-1">
            <div className={`w-2.5 h-2.5 rounded-full mb-1.5 ${it.date === '—' ? 'bg-gray-300' : 'bg-blue-500'}`} />
            <div className="text-xs2 font-semibold text-gray-500 mb-0.5">{it.label}</div>
            <div className="text-sm2 font-mono text-gray-700">{it.date}</div>
          </div>
          {i < items.length - 1 && <div className="w-4 h-px bg-gray-300 mt-2.5" />}
        </div>
      ))}
    </div>
  );
}

// ── 우측 도면 패널 (keywert 참고) ──
function DrawingsPanel({ figures, refSigns }: { figures?: { desc: string; imageKey?: string }[]; refSigns?: { sign: string; label: string }[] }) {
  const figs = figures || [];
  const signs = refSigns || [];
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(false);

  if (figs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-300 px-4">
        <Icon name="image" size={28} className="mb-2" />
        <div className="text-sm2 text-center">도면 없음</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto scroll-thin p-3">
      {/* 메인 도면 — 클릭 시 확대 */}
      <div data-col="⚠목업(현재 절차 SVG) = COALESCE(custom.drawing_url, S3(patent_image.scrape_site + '/' + key_name)) · 건수 = COUNT(*) 또는 kpa_bibliographic.drawing_count · 라벨 = 'FIG ' + (순번+1)" className="bg-white rounded-xl border border-neutral-150 shadow-card mb-2 shrink-0 overflow-hidden">
        <div className="px-3 pt-2 flex items-center gap-2">
          {selected === 0 && <span className="text-xs2 font-semibold text-white bg-brand-400 rounded px-1.5 py-0.5 shrink-0">대표</span>}
          <span className="text-xs2 font-semibold text-gray-600 font-mono">{figLabel(selected)}</span>
          <span data-col="PARSE(specification, '도면의 간단한 설명')" className="text-xs2 text-gray-400 truncate flex-1">{figs[selected]?.desc}</span>
          <button onClick={() => setZoom(true)} className="text-xs2 text-brand-400 hover:underline shrink-0" title="도면 확대">⤢ 확대</button>
        </div>
        <button onClick={() => setZoom(true)} className="block w-full cursor-zoom-in" title="도면 확대">
          <FigureSVG index={selected} className="w-full h-64" />
        </button>
      </div>

      {/* 대표도면 */}
      <div data-col="⚠목업 · custom.primary_drawing_url (KR·CN · 실데이터 있음)" className="text-xs2 font-semibold text-gray-500 mt-2 mb-1.5">대표도면</div>
      <button
        onClick={() => setSelected(0)}
        onDoubleClick={() => { setSelected(0); setZoom(true); }}
        className={clsx(
          'relative rounded-md overflow-hidden border transition-all bg-white w-1/2',
          selected === 0 ? 'ring-2 ring-blue-400 border-blue-400' : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <span className="absolute top-1 left-1 z-10 text-xs2 font-semibold text-white bg-brand-400 rounded px-1 leading-tight">대표</span>
        <FigureSVG index={0} className="w-full h-24" />
        <div className="text-xs2 text-gray-500 font-mono truncate w-full text-center leading-tight py-0.5 border-t border-gray-100">{figLabel(0)}</div>
      </button>

      {/* 그 외 도면 */}
      {figs.length > 1 && (
        <>
          <div className="text-xs2 font-semibold text-gray-500 mt-3 mb-1.5">그 외 도면 ({figs.length - 1})</div>
          <div className="grid grid-cols-3 gap-1">
            {figs.slice(1).map((_f, idx) => {
              const i = idx + 1;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  onDoubleClick={() => { setSelected(i); setZoom(true); }}
                  className={clsx(
                    'rounded-md overflow-hidden border transition-all bg-white',
                    selected === i ? 'ring-2 ring-blue-400 border-blue-400' : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <FigureSVG index={i} className="w-full h-14" />
                  <div className="text-xs2 text-gray-500 font-mono truncate w-full text-center leading-tight py-0.5 border-t border-gray-100">
                    {figLabel(i)}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* 부호의 설명 */}
      {signs.length > 0 && <RefSigns signs={signs} className="mt-3" />}

      {zoom && (
        <DrawingZoomModal
          figures={figs}
          refSigns={signs}
          index={selected}
          onIndex={setSelected}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}

// ── 부호의 설명 (도면 주요 부분에 대한 부호 설명) — specification 말미 파싱 ──
function RefSigns({ signs, className }: { signs: { sign: string; label: string }[]; className?: string }) {
  return (
    <div className={clsx('border border-gray-200 rounded-lg overflow-hidden', className)}>
      <div data-col="PARSE(specification, '부호의 설명' 섹션) → [N행] 부호 + 명칭" className="bg-gray-50 px-3 py-1.5 text-xs2 font-semibold text-gray-600 border-b border-gray-200">
        도면 주요 부분에 대한 부호의 설명
      </div>
      <ul className="divide-y divide-gray-50">
        {signs.map(sg => (
          <li key={sg.sign} className="flex items-baseline gap-2 px-3 py-1.5 text-sm2">
            <span className="font-mono font-semibold text-brand-400 shrink-0 w-10">{sg.sign}</span>
            <span className="text-gray-700">{sg.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 도면 확대 모달 (도면 출력창) ── 확대/축소·팬 + 부호의 설명
function DrawingZoomModal({ figures, refSigns, index, onIndex, onClose }: {
  figures: { desc: string; imageKey?: string }[];
  refSigns?: { sign: string; label: string }[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const clampScale = (s: number) => Math.min(5, Math.max(0.5, s));
  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  // 도면 전환 시 줌 초기화
  useEffect(() => { reset(); }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onIndex(Math.min(figures.length - 1, index + 1));
      else if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
      else if (e.key === '+' || e.key === '=') setScale(s => clampScale(s + 0.25));
      else if (e.key === '-') setScale(s => clampScale(s - 0.25));
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, figures.length, onIndex, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 헤더 + 줌 컨트롤 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <span className="font-mono font-semibold text-gray-700">{figLabel(index)}</span>
          <span className="text-sm2 text-gray-500 truncate flex-1">{figures[index]?.desc}</span>
          <div className="flex items-center gap-0.5 shrink-0 mr-1">
            <button onClick={() => setScale(s => clampScale(s - 0.25))} className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-brand-400 font-bold" title="축소 (-)">−</button>
            <span className="text-xs2 text-gray-500 font-mono w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => clampScale(s + 0.25))} className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-brand-400 font-bold" title="확대 (+)">+</button>
            <button onClick={reset} className="ml-1 px-1.5 h-7 rounded border border-gray-300 text-xs2 text-gray-600 hover:border-blue-400 hover:text-brand-400" title="원래 크기 (0)">맞춤</button>
          </div>
          <span className="text-xs2 text-gray-400 font-mono shrink-0">{index + 1} / {figures.length}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 shrink-0" title="닫기 (Esc)"><Icon name="close" size={16} /></button>
        </div>
        {/* 큰 도면 (줌·팬) + 부호의 설명 */}
        <div className="flex-1 min-h-0 flex flex-col bg-gray-50 overflow-auto">
          <div
            className={clsx('relative h-[46vh] shrink-0 overflow-hidden bg-white border-b border-gray-100', scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
            onWheel={e => { e.preventDefault(); setScale(s => clampScale(s + (e.deltaY < 0 ? 0.15 : -0.15))); }}
            onDoubleClick={() => setScale(s => (s >= 2 ? 1 : clampScale(s + 1)))}
            onMouseDown={e => { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
            onMouseMove={e => { if (drag.current) setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); }}
            onMouseUp={() => { drag.current = null; }}
            onMouseLeave={() => { drag.current = null; }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transition: drag.current ? 'none' : 'transform 0.08s' }}
            >
              <FigureSVG index={index} className="w-full max-w-2xl h-auto px-6" />
            </div>
            <div className="absolute bottom-1.5 right-2 text-xs2 text-gray-400 bg-white/70 rounded px-1.5 py-0.5 pointer-events-none">휠: 확대/축소 · 더블클릭 · 드래그 이동</div>
          </div>
          {refSigns && refSigns.length > 0 && (
            <div className="p-4">
              <RefSigns signs={refSigns} />
            </div>
          )}
        </div>
        {/* 하단 내비 + 썸네일 */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-200 bg-white shrink-0">
          <Button variant="outlined" color="primary" size="sm" disabled={index <= 0} onClick={() => onIndex(index - 1)} title="이전 (←)">◀ 이전</Button>
          <Button variant="outlined" color="primary" size="sm" disabled={index >= figures.length - 1} onClick={() => onIndex(index + 1)} title="다음 (→)">다음 ▶</Button>
          <div className="flex-1 flex gap-1 overflow-x-auto scroll-thin justify-end">
            {figures.map((_f, i) => (
              <button
                key={i}
                onClick={() => onIndex(i)}
                className={clsx('rounded border shrink-0 overflow-hidden w-16', index === i ? 'ring-2 ring-blue-400 border-blue-400' : 'border-gray-200 hover:border-gray-300')}
                title={figLabel(i)}
              >
                <FigureSVG index={i} className="w-full h-10" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── 절차적 도면(SVG) — 특허 도면 느낌의 블록/흐름/구조 다이어그램 ──
function FigureSVG({ index, className }: { index: number; className?: string }) {
  const variant = index % 4;
  const stroke = '#475069';
  const label = '#94a0b8';
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="특허 도면 도식" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="200" height="120" fill="#fbfcfe" />
      {variant === 0 && (
        // 블록도: 3 박스 + 화살표
        <g fill="none" stroke={stroke} strokeWidth="1.4">
          <rect x="16" y="46" width="40" height="28" rx="3" />
          <rect x="80" y="46" width="40" height="28" rx="3" />
          <rect x="144" y="46" width="40" height="28" rx="3" />
          <line x1="56" y1="60" x2="80" y2="60" markerEnd="url(#ah)" />
          <line x1="120" y1="60" x2="144" y2="60" markerEnd="url(#ah)" />
          <text x="36" y="40" fill={label} fontSize="8" textAnchor="middle">110</text>
          <text x="100" y="40" fill={label} fontSize="8" textAnchor="middle">120</text>
          <text x="164" y="40" fill={label} fontSize="8" textAnchor="middle">130</text>
        </g>
      )}
      {variant === 1 && (
        // 흐름도: 마름모 + 박스
        <g fill="none" stroke={stroke} strokeWidth="1.4">
          <rect x="74" y="12" width="52" height="20" rx="3" />
          <path d="M100 44 L126 60 L100 76 L74 60 Z" />
          <rect x="74" y="88" width="52" height="20" rx="3" />
          <line x1="100" y1="32" x2="100" y2="44" markerEnd="url(#ah)" />
          <line x1="100" y1="76" x2="100" y2="88" markerEnd="url(#ah)" />
          <text x="138" y="62" fill={label} fontSize="8">S20</text>
        </g>
      )}
      {variant === 2 && (
        // 적층/구조: 수평 레이어
        <g fill="none" stroke={stroke} strokeWidth="1.4">
          {[0, 1, 2, 3].map(i => <rect key={i} x="50" y={28 + i * 16} width="100" height="14" />)}
          <text x="158" y="38" fill={label} fontSize="8">210</text>
          <text x="158" y="54" fill={label} fontSize="8">220</text>
          <text x="158" y="70" fill={label} fontSize="8">230</text>
        </g>
      )}
      {variant === 3 && (
        // 그래프: 축 + 곡선
        <g fill="none" stroke={stroke} strokeWidth="1.4">
          <line x1="30" y1="100" x2="180" y2="100" />
          <line x1="30" y1="100" x2="30" y2="20" />
          <polyline points="30,92 60,78 90,70 120,48 150,40 175,30" stroke="#2c5fa8" strokeWidth="1.8" />
          <polyline points="30,96 60,90 90,86 120,80 150,76 175,70" stroke="#bd7a1c" strokeWidth="1.4" strokeDasharray="3 2" />
        </g>
      )}
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={stroke} />
        </marker>
      </defs>
    </svg>
  );
}
