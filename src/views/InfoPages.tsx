// 서비스 기본 콘텐츠 페이지 — 이용약관·개인정보처리방침·연락처·FAQ.
// 정책/FAQ 확정 문구는 muhayu 제공본으로 대체 예정 → 현재는 골격+자리표시자(⚠).
// 임의의 약관 문구·연락처·링크를 생성하지 않는다(자리표시자로만 영역 확보). (공통·횡단 COM-081)
import { useStore } from '../store';
import { Icon } from '../components/Icon';

function ContentShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { setMode } = useStore();
  return (
    <div data-spec="COM-081" className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <button
            onClick={() => setMode('home')}
            className="inline-flex items-center gap-1 text-sm2 text-gray-400 hover:text-brand-400 mb-4"
          ><Icon name="arrow-left" size={13} /> 홈으로</button>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="text-sm2 text-gray-500 mt-1">{subtitle}</p>}
          <div className="mt-6 text-md2 text-gray-700 leading-relaxed space-y-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// 확정 전 자리표시자 안내 배너
function PendingNotice({ owner = 'muhayu' }: { owner?: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm2 text-amber-800">
      ⚠ 확정 문구 준비 중 — 본 페이지의 내용은 <strong>{owner} 제공 최종본</strong>으로 대체될 예정입니다. (기획 단계 자리표시자)
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div>
      <div className="text-base2 font-semibold text-gray-700 mb-1">{label}</div>
      <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm2 text-gray-400">
        (내용 입력 영역 — 확정본 반영 예정)
      </div>
    </div>
  );
}

export function TermsView() {
  return (
    <ContentShell title="이용약관" subtitle="CK.Patent 서비스 이용약관">
      <PendingNotice />
      <Placeholder label="제1조 (목적)" />
      <Placeholder label="제2조 (정의)" />
      <Placeholder label="제3조 (약관의 효력 및 변경)" />
      <Placeholder label="제4조 (서비스의 제공 및 변경)" />
      <Placeholder label="제5조 (이용자의 의무)" />
      <Placeholder label="제6조 (지식재산권)" />
      <Placeholder label="부칙" />
    </ContentShell>
  );
}

export function PrivacyView() {
  return (
    <ContentShell title="개인정보처리방침" subtitle="CK.Patent 개인정보 수집·이용 안내">
      <PendingNotice />
      <Placeholder label="1. 수집하는 개인정보 항목" />
      <Placeholder label="2. 개인정보의 수집 및 이용 목적" />
      <Placeholder label="3. 개인정보의 보유 및 이용 기간" />
      <Placeholder label="4. 개인정보의 제3자 제공" />
      <Placeholder label="5. 개인정보 처리 위탁" />
      <Placeholder label="6. 이용자의 권리와 행사 방법" />
      <Placeholder label="7. 개인정보 보호책임자" />
    </ContentShell>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-1.5 border-b border-gray-100">
      <span className="w-40 shrink-0 text-sm2 font-semibold text-gray-500">{label}</span>
      <span className="text-md2 text-gray-800">{children}</span>
    </div>
  );
}

export function ContactView() {
  return (
    <ContentShell title="연락처" subtitle="운영사 · 고객지원 안내">
      <div>
        <div className="text-base2 font-bold text-gray-700 mb-2">운영사 정보</div>
        <InfoRow label="회사">㈜무하유 (muhayu)</InfoRow>
        <InfoRow label="대표이사">신동호</InfoRow>
        <InfoRow label="주소">서울시 성동구 성수일로8길 5, 서울숲 SK V1 A동 2층 (04793)</InfoRow>
        <InfoRow label="사업자등록번호">206-86-55577</InfoRow>
        <InfoRow label="통신판매업신고">제2011-서울성동-0831호</InfoRow>
      </div>
      <div>
        <div className="text-base2 font-bold text-gray-700 mb-2">고객지원</div>
        <InfoRow label="이메일">help@copykiller.com</InfoRow>
        <InfoRow label="마케팅 문의">marketing@muhayu.com</InfoRow>
        <InfoRow label="전화 / 팩스">T. 02-6233-8400 &nbsp; F. 02-6233-8420</InfoRow>
        <InfoRow label="운영시간">평일 10:00~17:00 (주말·공휴일 휴무)</InfoRow>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm2 text-amber-800">
        ⚠ CK.Patent 전용 지원 채널(문의 폼·기관/대학 도입문의 등)은 오픈 시 확정·연결 예정입니다.
      </div>
    </ContentShell>
  );
}

// FAQ — SEO/GEO/AEO 대비 콘텐츠 영역 '확보'만. 항목 콘텐츠는 추후 채움.
export function FaqView() {
  const slots = ['CK.Patent는 어떤 서비스인가요?', '카피킬러캠퍼스 계정으로 이용할 수 있나요?', '선행기술조사는 어떻게 진행되나요?', '검색 결과를 어떻게 활용하나요?'];
  return (
    <ContentShell title="자주 묻는 질문 (FAQ)" subtitle="SEO·GEO·AEO 대비 콘텐츠 영역 (준비 중)">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm2 text-blue-800">
        ⚠ 준비 중 — FAQ 콘텐츠는 순차 작성 예정입니다. 현재는 검색엔진·생성형 AI 노출(SEO/GEO/AEO)을 위한 <strong>영역만 확보</strong>한 상태입니다.
      </div>
      <div className="space-y-2">
        {slots.map((q, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-md2 font-medium text-gray-700">{q}</span>
              <Icon name="chevron-down" size={14} className="text-gray-300" />
            </div>
            <div className="px-4 pb-3 text-sm2 text-gray-400">(답변 콘텐츠 준비 중)</div>
          </div>
        ))}
      </div>
    </ContentShell>
  );
}
