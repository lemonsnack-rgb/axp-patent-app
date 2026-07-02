// Sheet 3 사양 — 특허 상세 페이지
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { PatentResult, PatentCitation } from '../types';
import { downloadPatentPdf } from '../features/patentPdf';
import { Icon } from './Icon';
import { DetailFooter } from './DetailFooter';
import { CK_WORDMARK } from '../assets/ckLogo';
import { Badge } from './ui';
import { getPatentStatusDesc } from '../utils/badgeUtils';
import { Button } from '@muhayu/axp-ui';

export function parseKeywords(query: string): string[] {
  if (!query) return [];
  const cleaned = query
    .replace(/[A-Z_]+=\(/g, ' ')
    .replace(/[A-Z_]+=/g, ' ')
    .replace(/\b(AND|OR|NOT|ADJ|NEAR|KEY)\b/gi, ' ')
    .replace(/[():*?"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set(
    cleaned.split(' ').map(w => w.trim()).filter(w => w.length > 1)
  )].slice(0, 10);
}

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
  const statusColor = data.status === '등록' ? 'green'
    : data.status === '심사중' ? 'amber'
    : data.status === '소멸' || data.status === '거절' ? 'neutral'
    : 'brand';
  // 문헌종류 — 등록/소멸은 등록특허공보, 그 외는 공개특허공보
  const docKind = (data.status === '등록' || data.status === '소멸') ? '등록특허공보' : '공개특허공보';

  const [activeTab, setActiveTab] = useState('bib');
  const [claimMode, setClaimMode] = useState<'independent' | 'all'>('independent');
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
    <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-2">
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
    <div className="px-6 pt-4 pb-3 border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span title={getPatentStatusDesc(data.status)} className="inline-block cursor-help"><Badge color={statusColor}>● {data.status}</Badge></span>
        <Badge color="brand">{data.country}</Badge>
        <span className="font-mono text-md2 font-semibold text-gray-600">{data.number}</span>
        {data.grade && <Badge color="brand">평가 {data.grade}</Badge>}
      </div>
      <h2 className="text-2xl font-bold text-gray-800 leading-snug">{data.title}</h2>
      {/* 제목 하단 액션 링크 — 논문(원문 보기/본문 보기)과 동일 패턴 */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button variant="filled" color="primary" size="sm" className="text-xs2 h-8" onClick={() => downloadPatentPdf(data)} title="특허 원문 PDF 다운로드">
          <Icon name="doc" size={12} /> 원문 PDF 다운로드
        </Button>
      </div>
    </div>
  );

  // ── 앵커 탭 바 (sticky 처리는 레이아웃별 래퍼가 담당) ──
  const tabsBar = (
    <div className="flex items-center gap-0 bg-white border-b border-gray-200 overflow-x-auto scroll-thin shrink-0">
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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
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
            <div ref={secBib}>
              <Section title="서지사항" icon="cal">
                <table className="w-full text-md2">
                  <tbody>
                    <BibRow k="문헌번호" v={data.number} mono k2="(문헌일)" v2={data.publicationDate || '—'} />
                    <BibRow k="출원번호" v={data.applicationNo} mono k2="(출원일)" v2={data.applicationDate || '—'} />
                    <BibRow k="공개/공고번호" v={data.publicationNo} mono k2="(공개/공고일)" v2={data.publicationDate || '—'} />
                    <BibRow k="등록번호" v={data.registerNo && data.registerNo !== '-' ? data.registerNo : '—'} mono k2="(등록일)" v2={data.registerDate && data.registerDate !== '-' ? data.registerDate : '—'} />
                    <BibRow k="문헌종류" v={docKind} k2="권리상태" v2={data.rightStatus || '—'} />
                    <BibRow k="우선권주장일" v={data.priorityDate || '—'} k2="심사청구일" v2={data.examRequestDate || '—'} />
                    <BibRow k="존속기간(예상)만료일" v={data.expirationDate && data.expirationDate !== '-' ? data.expirationDate : '—'} k2="권리변동" v2={data.rightChange || '—'} />
                  </tbody>
                </table>
                <div className="mt-3.5">
                  <div className="text-xs2 font-semibold text-gray-500 mb-2">타임라인</div>
                  <Timeline items={timeline} />
                </div>
              </Section>
            </div>

            {/* 인명정보 */}
            <div ref={secPerson}>
              <Section title="인명정보" icon="user">
                <table className="w-full text-md2">
                  <tbody>
                    <InfoRow k="출원인" v={data.applicant || '—'} />
                    <InfoRow k="출원인 주소" v={data.applicantAddress || '—'} muted={!data.applicantAddress} />
                    <InfoRow k={data.country === 'JP' ? '출원인식별기호 (JP)' : '특허고객번호 (KR)'} v={data.applicantCode || '—'} mono />
                    <InfoRow k="발명자" v={data.inventors || '—'} />
                    <InfoRow k="발명자 주소" v={data.inventorAddress || '(예시) 동일 — 출원인 주소'} muted />
                  </tbody>
                </table>
              </Section>
            </div>

            {/* 요약 */}
            <div ref={secAbstract}>
              <Section title="요약" icon="doc">
                <TextBlock>{data.abstract || '—'}</TextBlock>
              </Section>
            </div>

            {/* 상세설명 — 표준 구조(기술분야·배경기술·과제·해결수단·효과·도면의 설명·구체적 내용) */}
            <div ref={secDesc}>
              <Section title="상세설명" icon="book">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3.5">
                  <DescSub title="기술분야">{`본 발명은 ${data.title}에 관한 것으로, 해당 기술분야의 장치 및 방법에 관한 것이다.`}</DescSub>
                  <DescSub title="배경기술">{`종래 기술은 정확도와 견고성 측면에서 한계가 있었으며, 다양한 환경 조건에서 안정적인 성능을 확보하기 어려웠다.`}</DescSub>
                  {data.aiPurpose && <DescSub title="해결하려는 과제">{data.aiPurpose}</DescSub>}
                  {data.aiSolution && <DescSub title="과제의 해결 수단">{data.aiSolution}</DescSub>}
                  {data.aiEffect && <DescSub title="발명의 효과">{data.aiEffect}</DescSub>}
                  {(data.figures || []).length > 0 && (
                    <div>
                      <div className="text-sm2 font-semibold text-gray-600 mb-1">도면의 설명</div>
                      <ul className="text-base2 text-gray-700 leading-relaxed space-y-0.5">
                        {(data.figures || []).map((f, i) => (
                          <li key={i}><span className="font-mono text-gray-500 mr-1.5">{f.label}</span>{f.desc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <DescSub title="발명의 구체적인 내용">{data.description || '(데모) 발명의 배경, 기술적 과제, 해결수단, 효과 등 본문 전체가 노출됩니다.'}</DescSub>
                </div>
              </Section>
            </div>

            {/* 청구범위 */}
            <div ref={secClaim}>
              <Section title="청구범위" icon="target">
                <div className="flex items-center gap-1 mb-2.5">
                  <button
                    onClick={() => setClaimMode('independent')}
                    className={clsx('px-2.5 py-0.5 rounded text-sm2 font-medium border', claimMode === 'independent' ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                  >독립항</button>
                  <button
                    onClick={() => setClaimMode('all')}
                    className={clsx('px-2.5 py-0.5 rounded text-sm2 font-medium border', claimMode === 'all' ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                  >전체청구항</button>
                </div>
                <div className="border border-blue-200 rounded-lg p-3.5 bg-white">
                  {(() => {
                    const claims = data.claims && data.claims.length
                      ? data.claims
                      : [{ no: 1, text: data.repClaim }];
                    const independents = claims.filter(c => !c.dependsOn);
                    const visible = claimMode === 'independent' ? independents : claims;
                    return visible.map((c, idx) => (
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
                    ));
                  })()}
                </div>
              </Section>
            </div>

            {/* 패밀리정보 — 국가 탭 필터 */}
            <div ref={secFamily}>
              <Section title="패밀리 정보" icon="grid">
                {(() => {
                  const families = renderFamilyPills(data.family);
                  const total = families.reduce((s, [, n]) => s + n, 0);
                  const filtered = familyTab === 'all' ? families : families.filter(([cc]) => cc === familyTab);
                  return (
                    <>
                      <div className="flex items-center gap-0 border-b border-gray-100 mb-3 overflow-x-auto scroll-thin">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {filtered.map(([cc, n]) => (
                          <span key={cc} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-md2 text-blue-700">
                            <strong className="font-mono">{cc}</strong> <span>{n}건</span>
                          </span>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </Section>
            </div>

            {/* 인용·피인용 — 구조화된 목록 */}
            <div ref={secCite}>
              <Section title="인용·피인용" icon="link">
                <CiteBlock title={`인용 (${(data.citingList ?? []).length || data.citing}건)`} list={data.citingList} />
                <div className="mt-3">
                  <CiteBlock title={`피인용 (${(data.citedList ?? []).length || data.cited}건)`} list={data.citedList} />
                </div>
              </Section>
            </div>

            {/* 분류코드 */}
            <div ref={secClass}>
              <Section title="분류코드" icon="tag">
                <table className="w-full text-md2">
                  <tbody>
                    <InfoRow k="Original IPC" v={data.ipc || '—'} mono />
                    <InfoRow k="Original CPC" v={data.cpc || '—'} mono />
                  </tbody>
                </table>
              </Section>
            </div>

            {/* 기타정보 — 대리인 + 심판/소송 + 특허평가 통합 */}
            <div ref={secEtc}>
              <Section title="기타정보" icon="briefcase">
                <table className="w-full text-md2 mb-3">
                  <tbody>
                    <InfoRow k="대리인" v={data.agent || '—'} muted={!data.agent} />
                    <InfoRow k="대리인 주소" v={data.agentAddress || '—'} muted={!data.agentAddress} />
                  </tbody>
                </table>
                {((data.trial && data.trial !== '심판 없음') || (data.dispute && data.dispute !== '분쟁 없음')) && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">심판/소송 정보</div>
                    {data.trial && data.trial !== '심판 없음' && <Row k="심판" v={data.trial} />}
                    {data.dispute && data.dispute !== '분쟁 없음' && <Row k="분쟁" v={data.dispute} />}
                  </div>
                )}
                {data.grade && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-sm2 font-semibold text-gray-500 mb-2">특허평가</div>
                    <div className="flex items-center gap-2 text-md2">
                      <span className="text-gray-500 w-24">평가등급</span>
                      <Badge color="brand">{data.grade}</Badge>
                    </div>
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
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
          <img src={CK_WORDMARK} alt="CK.Patent" className="h-6 w-auto object-contain" />
          <Button variant="outlined" color="primary" size="sm" onClick={onBack}>
            {backIcon && <Icon name="arrow-left" size={13} />} {backLabel}
          </Button>
          {onPrev && <Button variant="outlined" color="primary" size="sm" onClick={onPrev} title="이전">◀</Button>}
          {posLabel && <span className="text-sm2 text-gray-500 font-mono">{posLabel}</span>}
          {onNext && <Button variant="outlined" color="primary" size="sm" onClick={onNext} title="다음">▶</Button>}
          <span className="flex-1" />
          <Button variant="filled" color="primary" size="sm" onClick={onSave}><Icon name="star" size={12} /> 라이브러리 저장</Button>
        </div>
        {keywordBar}
        {/* 스크롤 페이지 — 가운데 정렬 문서 + 우측 도면 rail + 푸터 */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <main className="lg:col-span-8 min-w-0 space-y-6">
                {/* 제목 카드 */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">{titleBlock}</div>
                {/* 본문 카드 — 스크롤 시 제목+탭 고정(sticky) + 섹션 */}
                <div className="bg-white border border-gray-200 rounded-xl">
                  <div className="sticky top-0 z-20 bg-white rounded-t-xl">
                    {/* 압축 제목 줄 — 스크롤 중에도 어떤 문헌인지 유지 */}
                    <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5 border-b border-gray-100 min-w-0">
                      <span title={getPatentStatusDesc(data.status)} className="shrink-0 cursor-help"><Badge color={statusColor}>● {data.status}</Badge></span>
                      <span className="font-mono text-sm2 text-gray-500 shrink-0">{data.number}</span>
                      <span className="truncate text-sm2 font-semibold text-gray-700">{data.title}</span>
                    </div>
                    {tabsBar}
                  </div>
                  <div className="px-6 pb-5">{sections}</div>
                </div>
              </main>
              {/* 우측 rail — 도면 (논문 전체보기의 인용 rail과 동일 위치) */}
              <aside className="lg:col-span-4 lg:sticky lg:top-6">
                {drawingsAside}
              </aside>
            </div>
          </div>
          <DetailFooter />
        </div>
      </div>
    );
  }

  // ── 오버레이 드로어(embedded): 단일 컬럼 ──
  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {keywordBar}
      <div className="flex-1 flex flex-col overflow-hidden">
        {titleBlock}
        {tabsBar}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-4">
          {/* 도면 (드로어 전용 — 본문 내). 대표도면 우선 */}
          {(data.figures || []).length > 0 && (
            <div className="mb-4">
              <div className="text-xs2 font-semibold text-gray-500 mb-1.5">도면 ({(data.figures || []).length})</div>
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

function BibRow({ k, v, mono, k2, v2 }: { k: string; v: string; mono?: boolean; k2: string; v2: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="text-gray-500 py-1.5 w-28 whitespace-nowrap pr-2">{k}</td>
      <td className={`text-gray-800 py-1.5 pr-3 ${mono ? 'font-mono' : ''}`}>{v}</td>
      <td className="text-gray-500 py-1.5 w-24 whitespace-nowrap pr-2">{k2}</td>
      <td className="text-gray-800 py-1.5">{v2}</td>
    </tr>
  );
}

function InfoRow({ k, v, mono, muted }: { k: string; v: string; mono?: boolean; muted?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="text-gray-500 py-1.5 w-40 whitespace-nowrap pr-2">{k}</td>
      <td className={`py-1.5 ${mono ? 'font-mono' : ''} ${muted ? 'text-gray-400' : 'text-gray-800'}`}>{v}</td>
    </tr>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center gap-2 py-1 text-md2"><span className="text-gray-500 w-32">{k}</span><span>{v}</span></div>;
}

// 상세설명 하위 섹션 (기술분야/배경기술/과제/해결수단/효과/구체적 내용)
function DescSub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm2 font-semibold text-gray-600 mb-1">{title}</div>
      <div className="text-base2 text-gray-700 leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  );
}

function TextBlock({ children }: { children: React.ReactNode }) {
  const [translated, setTranslated] = useState(false);
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex justify-end mb-1.5">
        <Button
          variant={translated ? 'filled' : 'outlined'} color="primary" size="xs"
          onClick={() => setTranslated(v => !v)}
          title="원문/자동번역 보기 전환"
        >🌐 {translated ? '원문 보기' : '자동번역'}</Button>
      </div>
      {translated && (
        <div className="mb-2 text-xs2 text-blue-700 bg-blue-50 border border-blue-100 rounded px-2.5 py-1.5">
          자동번역 미리보기 — 외부 번역 서비스 연동 시 번역문이 이 영역에 표시됩니다. 현재는 원문을 표시합니다.
        </div>
      )}
      <div className="text-base2 text-gray-700 leading-relaxed whitespace-pre-line">{children}</div>
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

function CiteBlock({ title, list }: { title: string; list?: PatentCitation[] }) {
  const items = list ?? [];
  const patents = items.filter(c => c.kind === 'patent');
  const npls = items.filter(c => c.kind === 'npl');
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
      <div className="text-base2 font-bold text-gray-700 mb-2">{title}</div>
      <div className="text-xs2 font-semibold text-gray-500 mt-2 mb-1">특허 정보</div>
      {patents.length > 0 ? (
        <ul className="text-md2 text-gray-700 list-disc pl-4 space-y-0.5">
          {patents.map((c, i) => (
            <li key={i}><span className="font-mono text-brand-400">{c.ref}</span> · {c.title}</li>
          ))}
        </ul>
      ) : <div className="text-md2 text-gray-400 pl-1">없음</div>}
      <div className="text-xs2 font-semibold text-gray-500 mt-3 mb-1">비특허(논문) 정보</div>
      {npls.length > 0 ? (
        <ul className="text-md2 text-gray-700 list-disc pl-4 space-y-0.5">
          {npls.map((c, i) => (
            <li key={i}><span className="font-mono">{c.ref}</span> {c.title}</li>
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
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start">
          <div className="flex flex-col items-center text-center min-w-[88px] px-1">
            <div className={`w-2.5 h-2.5 rounded-full mb-1.5 ${it.date === '—' ? 'bg-gray-300' : 'bg-blue-500'}`} />
            <div className="text-xs2 font-semibold text-gray-500 mb-0.5">{it.label}</div>
            <div className="text-sm2 font-mono text-gray-700">{it.date}</div>
          </div>
          {i < items.length - 1 && <div className="flex-1 min-w-4 h-px bg-gray-300 mt-2.5 mx-1" />}
        </div>
      ))}
    </div>
  );
}

function renderFamilyPills(total: number): [string, number][] {
  if (!total) return [];
  const seed: [string, number][] = [['KR', 1], ['US', 1], ['JP', 1], ['CN', 1], ['EP', 1]];
  const out: [string, number][] = [];
  let rem = total;
  for (const [cc, b] of seed) { if (rem <= 0) break; const n = Math.min(b, rem); out.push([cc, n]); rem -= n; }
  if (rem > 0) out.push(['기타', rem]);
  return out;
}

// ── 우측 도면 패널 (keywert 참고) ──
function DrawingsPanel({ figures, refSigns }: { figures?: { label: string; desc: string }[]; refSigns?: { sign: string; label: string }[] }) {
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
      <div className="bg-white rounded-xl border border-neutral-150 shadow-card mb-2 shrink-0 overflow-hidden">
        <div className="px-3 pt-2 flex items-center gap-2">
          {selected === 0 && <span className="text-xs2 font-semibold text-white bg-brand-400 rounded px-1.5 py-0.5 shrink-0">대표</span>}
          <span className="text-xs2 font-semibold text-gray-600 font-mono">{figs[selected]?.label}</span>
          <span className="text-xs2 text-gray-400 truncate flex-1">{figs[selected]?.desc}</span>
          <button onClick={() => setZoom(true)} className="text-xs2 text-brand-400 hover:underline shrink-0" title="도면 확대">⤢ 확대</button>
        </div>
        <button onClick={() => setZoom(true)} className="block w-full cursor-zoom-in" title="도면 확대">
          <FigureSVG index={selected} className="w-full h-64" />
        </button>
      </div>

      {/* 대표도면 */}
      <div className="text-xs2 font-semibold text-gray-500 mt-2 mb-1.5">대표도면</div>
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
        <div className="text-xs2 text-gray-500 font-mono truncate w-full text-center leading-tight py-0.5 border-t border-gray-100">{figs[0]?.label}</div>
      </button>

      {/* 그 외 도면 */}
      {figs.length > 1 && (
        <>
          <div className="text-xs2 font-semibold text-gray-500 mt-3 mb-1.5">그 외 도면 ({figs.length - 1})</div>
          <div className="grid grid-cols-3 gap-1">
            {figs.slice(1).map((f, idx) => {
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
                    {f.label}
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

// ── 부호의 설명 (도면 주요 부분에 대한 부호 설명) ──
function RefSigns({ signs, className }: { signs: { sign: string; label: string }[]; className?: string }) {
  return (
    <div className={clsx('border border-gray-200 rounded-lg overflow-hidden', className)}>
      <div className="bg-gray-50 px-3 py-1.5 text-xs2 font-semibold text-gray-600 border-b border-gray-200">
        도면 주요 부분에 대한 부호의 설명
      </div>
      <ul className="divide-y divide-gray-50">
        {signs.map(s => (
          <li key={s.sign} className="flex items-baseline gap-2 px-3 py-1.5 text-sm2">
            <span className="font-mono font-semibold text-brand-400 shrink-0 w-10">{s.sign}</span>
            <span className="text-gray-700">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 도면 확대 모달 (도면 출력창) ── 확대/축소·팬 + 부호의 설명
function DrawingZoomModal({ figures, refSigns, index, onIndex, onClose }: {
  figures: { label: string; desc: string }[];
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

  const fig = figures[index];
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 헤더 + 줌 컨트롤 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <span className="font-mono font-semibold text-gray-700">{fig?.label}</span>
          <span className="text-sm2 text-gray-500 truncate flex-1">{fig?.desc}</span>
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
            {figures.map((f, i) => (
              <button
                key={i}
                onClick={() => onIndex(i)}
                className={clsx('rounded border shrink-0 overflow-hidden w-16', index === i ? 'ring-2 ring-blue-400 border-blue-400' : 'border-gray-200 hover:border-gray-300')}
                title={f.label}
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
