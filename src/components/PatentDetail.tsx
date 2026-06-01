// Sheet 3 사양 — 특허 상세 페이지
import type { PatentResult } from '../types';
import { Icon } from './Icon';

export function PatentDetail({ data, onBack, posLabel, onSave, onPrev, onNext }: {
  data: PatentResult; onBack: () => void; posLabel?: string;
  onSave?: () => void; onPrev?: () => void; onNext?: () => void;
}) {
  const timeline = buildTimeline(data);
  const statusClass = data.status === '등록' ? 'badge-green'
    : data.status === '심사중' ? 'badge-amber'
    : data.status === '소멸' || data.status === '거절' ? 'badge-gray'
    : 'badge-blue';

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
        <button onClick={onBack} className="btn-outline btn-sm">
          <Icon name="arrow-left" size={13} /> 검색결과로
        </button>
        {onPrev && <button onClick={onPrev} className="btn-outline btn-sm" title="이전">◀</button>}
        {posLabel && <span className="text-sm2 text-gray-500 font-mono">{posLabel}</span>}
        {onNext && <button onClick={onNext} className="btn-outline btn-sm" title="다음">▶</button>}
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn-primary btn-sm" onClick={() => alert('배경기술 참조 (mockup)')}>
            <Icon name="link" size={12} /> 배경기술 참조
          </button>
          <button className="btn-outline btn-sm" onClick={onSave}>
            <Icon name="star" size={11} /> 라이브러리 저장
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-8 py-6">
        {/* 타이틀바 */}
        <div className="sticky -top-6 bg-white z-10 pt-4 pb-3 -mt-6 mb-1 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`badge ${statusClass}`}>● {data.status}</span>
            <span className="badge badge-blue">{data.country}</span>
            <span className="font-mono text-md2 font-semibold text-gray-600">{data.number}</span>
            {data.grade && <span className="badge badge-blue">평가 {data.grade}</span>}
          </div>
          <h2 className="text-xl font-bold text-gray-800 leading-snug">{data.title}</h2>
        </div>

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

        <Section title="분류코드" icon="tag">
          <table className="w-full text-md2">
            <tbody>
              <InfoRow k="Original IPC" v={data.ipc || '—'} mono />
              <InfoRow k="Original CPC" v={data.cpc || '—'} mono />
            </tbody>
          </table>
        </Section>

        <Section title="요약" icon="doc">
          <TextBlock>{data.abstract || '—'}</TextBlock>
        </Section>

        <Section title="청구범위" icon="target">
          <div className="border border-blue-200 rounded-lg p-3.5 bg-white">
            <div className="text-md2 font-semibold text-blue-700 mb-1.5">독립항 — 제1항</div>
            <div className="text-base2 text-gray-700 leading-relaxed bg-blue-50 px-3 py-2 rounded border-l-4 border-blue-500">
              {data.repClaim}
            </div>
            <div className="mt-2.5 space-y-1.5">
              <SubClaim n={2}>제1항에 있어서, … (예시)</SubClaim>
              <SubClaim n={3}>제2항에 있어서, … (예시)</SubClaim>
            </div>
          </div>
        </Section>

        <Section title="도면의 설명" icon="image">
          <TextBlock>
            <ul className="list-disc pl-5 space-y-1">
              {(data.figures || []).length === 0 && <li className="text-gray-400">도면 설명 없음</li>}
              {(data.figures || []).map(f => (
                <li key={f.label}><strong className="font-mono">{f.label}</strong> — {f.desc}</li>
              ))}
            </ul>
          </TextBlock>
        </Section>

        <Section title="상세설명" icon="book">
          <TextBlock>{data.description || '(데모) 상세설명 원문이 표시되는 영역입니다. 발명의 배경, 기술적 과제, 해결수단, 효과 등 본문 전체가 노출됩니다.'}</TextBlock>
        </Section>

        <Section title="패밀리 정보" icon="grid">
          <div className="flex items-center gap-2 flex-wrap">
            {renderFamilyPills(data.family).map(([cc, n]) => (
              <span key={cc} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-md2 text-blue-700">
                <strong className="font-mono">{cc}</strong> <span>{n}건</span>
              </span>
            ))}
            <button className="btn-outline btn-sm ml-auto">중복제거</button>
          </div>
        </Section>

        <Section title="인용/피인용" icon="link">
          <div className="grid grid-cols-2 gap-3.5">
            <CiteBlock title={`인용 (${data.citing}건)`} patentCount={Math.max(1, (data.citing||0) - 2)} nplCount={2} />
            <CiteBlock title={`피인용 (${data.cited}건)`} patentCount={Math.max(1, (data.cited||0) - 1)} nplCount={1} />
          </div>
        </Section>

        {data.grade && (
          <Section title="특허평가정보" icon="award">
            <div className="flex items-center gap-2 text-md2"><span className="text-gray-500 w-32">평가등급</span><span className="badge badge-blue">{data.grade}</span></div>
          </Section>
        )}

        {((data.trial && data.trial !== '심판 없음') || (data.dispute && data.dispute !== '분쟁 없음')) && (
          <Section title="심판/소송정보" icon="scale">
            {data.trial && data.trial !== '심판 없음' && <Row k="심판" v={data.trial} />}
            {data.dispute && data.dispute !== '분쟁 없음' && <Row k="분쟁" v={data.dispute} />}
          </Section>
        )}

        {data.standardOrg && data.standardOrg !== '-' && (
          <Section title="표준정보" icon="award">
            <Row k="표준화기구" v={data.standardOrg} />
          </Section>
        )}

        <Section title="대리인정보" icon="briefcase">
          <table className="w-full text-md2">
            <tbody>
              <InfoRow k="대리인" v={data.agent || '—'} muted={!data.agent} />
              <InfoRow k="대리인 주소" v={data.agentAddress || '—'} muted={!data.agentAddress} />
            </tbody>
          </table>
        </Section>
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
        <button className="btn-outline btn-xs" onClick={() => alert('🌐 자동번역 (mockup)')}>🌐 자동번역</button>
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
