// Sheet 3 사양 — 특허 상세 페이지
import { useRef, useState } from 'react';
import clsx from 'clsx';
import type { PatentResult } from '../types';
import { Icon } from './Icon';
import { Badge } from './ui';
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

export function PatentDetail({ data, onBack, posLabel, onSave, onPrev, onNext, searchQuery, embedded = false }: {
  data: PatentResult; onBack: () => void; posLabel?: string;
  onSave?: () => void; onPrev?: () => void; onNext?: () => void;
  searchQuery?: string;
  embedded?: boolean; // 사이드 리더(분할) 모드 — 상단 액션바 숨김, 단일 컬럼(도면은 본문 내)
}) {
  const timeline = buildTimeline(data);
  const statusColor = data.status === '등록' ? 'green'
    : data.status === '심사중' ? 'amber'
    : data.status === '소멸' || data.status === '거절' ? 'neutral'
    : 'brand';

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

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">

      {/* ── 상단 액션 바 (전체화면 전용) ── */}
      {!embedded && (
      <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
        <Button variant="outlined" color="primary" size="sm" onClick={onBack}>
          <Icon name="arrow-left" size={13} /> 검색결과로
        </Button>
        {onPrev && <Button variant="outlined" color="primary" size="sm" onClick={onPrev} title="이전">◀</Button>}
        {posLabel && <span className="text-sm2 text-gray-500 font-mono">{posLabel}</span>}
        {onNext && <Button variant="outlined" color="primary" size="sm" onClick={onNext} title="다음">▶</Button>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="filled" color="primary" size="sm" onClick={() => alert('배경기술 참조 (mockup)')}>
            <Icon name="link" size={12} /> 배경기술 참조
          </Button>
          <Button variant="outlined" color="primary" size="sm" onClick={onSave}>
            <Icon name="star" size={11} /> 라이브러리 저장
          </Button>
        </div>
      </div>
      )}

      {/* ── 키워드 하이라이터 바 (keywert 참고) ── */}
      {searchQuery && parseKeywords(searchQuery).length > 0 && (
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
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.dot }}
                  />
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
      )}

      {/* ── 탭 + 2-column 본문 ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* 좌: 앵커 탭 + 스크롤 본문 */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Sticky 앵커 탭 바 */}
          <div className="sticky top-0 z-20 flex items-center gap-0 bg-white border-b border-gray-200 overflow-x-auto scroll-thin shrink-0">
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

          {/* 스크롤 본문 */}
          <div className="flex-1 overflow-y-auto scroll-thin px-6 py-4">

            {/* 타이틀 */}
            <div className="mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <Badge color={statusColor}>● {data.status}</Badge>
                <Badge color="brand">{data.country}</Badge>
                <span className="font-mono text-md2 font-semibold text-gray-600">{data.number}</span>
                {data.grade && <Badge color="brand">평가 {data.grade}</Badge>}
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-snug">{data.title}</h2>
            </div>

            {/* 도면 (분할 리더 전용 — 본문 내) */}
            {embedded && (data.figures || []).length > 0 && (
              <div className="mb-4">
                <div className="text-xs2 font-semibold text-gray-500 mb-1.5">도면 ({(data.figures || []).length})</div>
                <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden" style={{ height: 220 }}>
                  <DrawingsPanel figures={data.figures} />
                </div>
              </div>
            )}

            {/* 서지사항 */}
            <div ref={secBib}>
              <Section title="서지사항" icon="cal">
                <table className="w-full text-md2">
                  <tbody>
                    <BibRow k="문헌번호" v={data.number} mono k2="(문헌일)" v2={data.publicationDate || '—'} />
                    <BibRow k="출원번호" v={data.applicationNo} mono k2="(출원일)" v2={data.applicationDate || '—'} />
                    <BibRow k="공개/공고번호" v={data.publicationNo} mono k2="(공개/공고일)" v2={data.publicationDate || '—'} />
                    <BibRow k="등록번호" v={data.registerNo && data.registerNo !== '-' ? data.registerNo : '—'} mono k2="(등록일)" v2={data.registerDate && data.registerDate !== '-' ? data.registerDate : '—'} />
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

            {/* 상세설명 */}
            <div ref={secDesc}>
              <Section title="상세설명" icon="book">
                <TextBlock>{data.description || '(데모) 상세설명 원문이 표시되는 영역입니다. 발명의 배경, 기술적 과제, 해결수단, 효과 등 본문 전체가 노출됩니다.'}</TextBlock>
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
                  <div className="text-md2 font-semibold text-blue-700 mb-1.5">독립항 — 제1항</div>
                  <div className="text-base2 text-gray-700 leading-relaxed bg-blue-50 px-3 py-2 rounded border-l-4 border-blue-500">
                    {data.repClaim}
                  </div>
                  {claimMode === 'all' && (
                    <div className="mt-2.5 space-y-1.5">
                      <SubClaim n={2}>제2항에 있어서, … (예시)</SubClaim>
                      <SubClaim n={3}>제3항에 있어서, … (예시)</SubClaim>
                    </div>
                  )}
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

            {/* 인용·피인용 — 비특허 인용 별도 섹션 */}
            <div ref={secCite}>
              <Section title="인용·피인용" icon="link">
                <CiteBlock title={`인용 (${data.citing}건)`} patentCount={Math.max(1, (data.citing||0) - 2)} nplCount={2} />
                <div className="mt-3">
                  <CiteBlock title={`피인용 (${data.cited}건)`} patentCount={Math.max(1, (data.cited||0) - 1)} nplCount={1} />
                </div>
                <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-1.5 text-sm2 font-semibold text-gray-600 border-b border-gray-200">비특허 인용</div>
                  <table className="w-full text-sm2">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">No</th>
                        <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">카테고리</th>
                        <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">단계</th>
                        <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">출처</th>
                        <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-xs2 text-gray-400">1</td>
                        <td className="px-2 py-1.5 text-xs2 text-gray-600">선행</td>
                        <td className="px-2 py-1.5 text-xs2 text-gray-600">심사</td>
                        <td className="px-2 py-1.5 text-xs2 text-gray-600">조사자</td>
                        <td className="px-2 py-1.5 text-xs2 text-gray-600">(예시) 비특허 문헌 인용</td>
                      </tr>
                    </tbody>
                  </table>
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

          </div>
        </div>

        {/* 우: 도면 패널 (전체화면 전용 — 분할 리더에선 본문 내 표시) */}
        {!embedded && (
        <div className="w-56 shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 bg-white shrink-0">
            <span className="text-sm2 font-bold text-gray-600">도면</span>
            <span className="ml-1.5 text-xs2 text-gray-400">({(data.figures || []).length})</span>
          </div>
          <DrawingsPanel figures={data.figures} />
        </div>
        )}

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

function TextBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex justify-end mb-1.5">
        <Button variant="outlined" color="primary" size="xs" onClick={() => alert('🌐 자동번역 (mockup)')}>🌐 자동번역</Button>
      </div>
      <div className="text-base2 text-gray-700 leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  );
}

function SubClaim({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 bg-gray-50 rounded text-md2 text-gray-600 leading-relaxed">
      <span className="font-semibold text-gray-500 mr-1.5">종속항 (제{n}항)</span>
      {children}
    </div>
  );
}

function CiteBlock({ title, patentCount, nplCount }: { title: string; patentCount: number; nplCount: number }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
      <div className="text-base2 font-bold text-gray-700 mb-2">{title}</div>
      <div className="text-xs2 font-semibold text-gray-500 mt-2 mb-1">특허 정보</div>
      <ul className="text-md2 text-gray-700 list-disc pl-4 space-y-0.5">
        {Array.from({ length: Math.min(3, Math.max(1, patentCount)) }).map((_, i) => (
          <li key={i}><span className="font-mono">KR 10-2020-{1234567 + i}</span> · 라이다 기반 객체 인식 (예시)</li>
        ))}
      </ul>
      <div className="text-xs2 font-semibold text-gray-500 mt-3 mb-1">비특허(논문) 정보</div>
      <ul className="text-md2 text-gray-700 list-disc pl-4 space-y-0.5">
        {nplCount > 0 ? <li><span className="font-mono">[NPL]</span> Smith J. et al., "LiDAR object detection", IEEE Trans. ITS, 2023 (예시)</li>
                      : <li className="text-gray-400 list-none">없음</li>}
      </ul>
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
function DrawingsPanel({ figures }: { figures?: { label: string; desc: string }[] }) {
  const figs = figures || [];
  const [selected, setSelected] = useState(0);

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
      {/* 메인 도면 */}
      <div className="bg-white rounded-xl border border-neutral-150 shadow-card h-44 flex flex-col items-center justify-center mb-2 shrink-0 p-2">
        <Icon name="image" size={24} className="text-gray-300 mb-1" />
        <div className="text-xs2 font-semibold text-gray-500">{figs[selected]?.label}</div>
        <div className="text-xs2 text-gray-400 mt-0.5 px-2 text-center line-clamp-2">{figs[selected]?.desc}</div>
      </div>

      {/* 썸네일 그리드 (3열) */}
      <div className="grid grid-cols-3 gap-1">
        {figs.map((f, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={clsx(
              'bg-gray-100 rounded-md h-14 flex flex-col items-center justify-center p-1 transition-all',
              selected === i ? 'ring-2 ring-blue-400 bg-blue-50' : 'hover:bg-gray-200',
            )}
          >
            <Icon name="image" size={12} className={selected === i ? 'text-blue-400' : 'text-gray-400'} />
            <div className="text-xs2 text-gray-500 mt-0.5 font-mono truncate w-full text-center leading-tight">
              {f.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
