// 전역 서비스 푸터 — copykiller.com 푸터 스타일과 통일.
// 다크 네이비(#212c42) 배경 + 흰 글자, 4단(㈜무하유 / 고객센터 / 기관·대학 도입문의 / 콘텐츠)
// + 하단 정책링크 바(개인정보처리방침·이용약관·연락처·FAQ) + Copyright © MUHAYU Inc. Since 2011. (COM-080)
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
    <footer data-spec="COM-080" className="mt-10 text-gray-300" style={{ backgroundColor: '#212c42' }}>
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-xs2 leading-relaxed">
          {/* 회사 정보 */}
          <div>
            <div className="text-base2 font-bold text-white mb-3">CK.Patent</div>
            <div className="text-gray-400 mb-3">특허 선행기술조사·명세서 작성 서비스 by muhayu</div>
            <div className="text-white font-semibold mb-1">㈜무하유</div>
            <div>서울시 성동구 성수일로8길 5</div>
            <div>서울숲 SK V1 A동 2층 (04793)</div>
            <div className="mt-2">대표이사 신동호</div>
            <div>사업자등록번호 206-86-55577</div>
            <div>통신판매업신고번호 제2011-서울성동-0831호</div>
          </div>
          {/* 고객센터 */}
          <div>
            <div className="text-white font-bold mb-2.5">카피킬러 고객센터</div>
            <div>평일 10:00~17:00</div>
            <div className="text-gray-400">(주말 및 공휴일 휴무)</div>
            <div className="mt-2 text-gray-200">help@copykiller.com</div>
            <div className="mt-3 flex gap-1.5">
              <button onClick={() => go('contact')} className="px-2 py-1 border border-gray-500 rounded text-xs2 text-gray-200 hover:border-white hover:text-white transition-colors">문의하기</button>
              <button className="px-2 py-1 border border-gray-500 rounded text-xs2 text-gray-200 hover:border-white hover:text-white transition-colors">원격지원</button>
            </div>
          </div>
          {/* 기관/대학 도입문의 */}
          <div>
            <div className="text-white font-bold mb-2.5">기관/대학 도입문의</div>
            <div>T. 02-6233-8400</div>
            <div>F. 02-6233-8420</div>
            <div className="mt-2 text-gray-200">marketing@muhayu.com</div>
          </div>
          {/* 콘텐츠 */}
          <div>
            <div className="text-white font-bold mb-2.5">콘텐츠</div>
            <div className="flex flex-col gap-1.5">
              {SNS.map(s => <button key={s} className="text-left hover:text-white transition-colors">{s}</button>)}
            </div>
          </div>
        </div>
      </div>
      {/* 하단 바 — 저작권 + 정책 링크 */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}>
        <div className="mx-auto max-w-6xl px-8 py-4 flex flex-wrap items-center justify-between gap-3 text-xs2">
          <span className="text-gray-500">Copyright © MUHAYU Inc. All rights reserved. Since 2011</span>
          <nav className="flex items-center gap-1 text-gray-300">
            {NAV.map((l, i) => (
              <span key={l.mode} className="flex items-center">
                {i > 0 && <span className="text-gray-600 mx-1.5">·</span>}
                <button
                  onClick={() => go(l.mode)}
                  className={l.bold ? 'font-semibold text-white hover:text-blue-300' : 'hover:text-white'}
                >{l.label}</button>
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
