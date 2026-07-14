// 전역 서비스 푸터 — copykiller.com 푸터와 통일(㈜무하유 패밀리 서비스로 인지).
// 3단(회사정보·고객센터·콘텐츠) + 하단 정책 링크 + 저작권. 정책/연락처/FAQ 링크는 서비스 내 페이지로 연결.
// 페이지 스크롤 최하단에 1회 배치(단일 규칙, COM-080). store 없으면(새 탭) 앱으로 이동.
import { useOptionalStore } from '../store';
import type { AppMode } from '../types';

const SNS = ['Blog', 'Youtube', 'LinkedIn', 'Instagram'];
const NAV: { mode: AppMode; label: string; bold?: boolean }[] = [
  { mode: 'privacy', label: '개인정보처리방침', bold: true },
  { mode: 'terms',   label: '이용약관' },
  { mode: 'contact', label: '연락처' },
  { mode: 'faq',     label: 'FAQ' },
];

export function SiteFooter() {
  const store = useOptionalStore();
  const go = (m: AppMode) => {
    if (store) store.setMode(m);
    else window.open('/', '_blank');
  };
  return (
    <footer data-spec="COM-080" className="border-t border-gray-200 bg-gray-50 mt-10">
      <div className="mx-auto max-w-6xl px-8 py-8">
        {/* 서비스 식별 — CK.Patent(무하유 패밀리) */}
        <div className="mb-5 text-sm2 text-gray-500">
          <span className="font-bold text-gray-700">CK.Patent</span> · 특허 선행기술조사·명세서 작성 서비스 by muhayu
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs2 text-gray-500 leading-relaxed">
          {/* 회사 정보 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">㈜무하유</div>
            <div>서울시 성동구 성수일로8길 5</div>
            <div>서울숲 SK V1 A동 2층 (04793)</div>
            <div className="mt-2">대표이사 신동호</div>
            <div>사업자등록번호 206-86-55577</div>
            <div>통신판매업신고번호 제2011-서울성동-0831호</div>
          </div>
          {/* 고객센터 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">고객센터</div>
            <div>평일 10:00~17:00 (주말 및 공휴일 휴무)</div>
            <div className="text-brand-400">help@copykiller.com</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => go('contact')} className="hover:text-brand-400">문의하기</button>
              <span className="text-gray-300">·</span>
              <button className="hover:text-brand-400">원격지원</button>
              <span className="text-gray-300">·</span>
              <button onClick={() => go('contact')} className="hover:text-brand-400">기관/대학 도입문의</button>
            </div>
            <div className="mt-2">T. 02-6233-8400 &nbsp; F. 02-6233-8420</div>
            <div className="text-brand-400">marketing@muhayu.com</div>
          </div>
          {/* 콘텐츠 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">콘텐츠</div>
            <div className="flex flex-wrap gap-3">
              {SNS.map(s => <button key={s} className="hover:text-brand-400">{s}</button>)}
            </div>
          </div>
        </div>
        {/* 하단 정책 링크 + 카피라이트 */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs2 text-gray-500">
          <nav className="flex items-center gap-1">
            {NAV.map((l, i) => (
              <span key={l.mode} className="flex items-center">
                {i > 0 && <span className="text-gray-300 mx-1.5">·</span>}
                <button
                  onClick={() => go(l.mode)}
                  className={l.bold ? 'font-semibold text-gray-700 hover:text-brand-400' : 'hover:text-brand-400'}
                >{l.label}</button>
              </span>
            ))}
          </nav>
          <span className="text-gray-400">Copyright © MUHAYU Inc. All rights reserved. Since 2011</span>
        </div>
      </div>
    </footer>
  );
}
