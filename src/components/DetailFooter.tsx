// 상세페이지 공통 푸터 (논문·특허 전체보기 공유) — 카피킬러 푸터 반영
export function DetailFooter() {
  const bottomLinks = ['개인정보 처리방침', '이용약관', '회사소개', '채용안내', '패밀리사이트'];
  const sns = ['Blog', 'Youtube', 'LinkedIn', 'Instagram'];
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-10">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs2 text-gray-500 leading-relaxed">
          {/* 회사 정보 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">㈜무하유</div>
            <div>서울시 성동구 성수일로 8길 5</div>
            <div>서울숲 SK V1 A동 2층 (04793)</div>
            <div className="mt-2">대표이사 신동호</div>
            <div>사업자등록번호 206-86-55577</div>
            <div>통신판매업신고번호 제2011-서울성동-0831호</div>
          </div>
          {/* 고객센터 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">카피킬러 고객센터</div>
            <div>평일 10:00~17:00 (주말 및 공휴일 휴무)</div>
            <div className="text-brand-400">help@copykiller.com</div>
            <div className="mt-2 flex gap-2">
              <button className="hover:text-brand-400">문의하기</button>
              <span className="text-gray-300">·</span>
              <button className="hover:text-brand-400">원격지원</button>
              <span className="text-gray-300">·</span>
              <button className="hover:text-brand-400">기관/대학 도입문의</button>
            </div>
            <div className="mt-2">T. 02-6233-8400 &nbsp; F. 02-6233-8420</div>
            <div className="text-brand-400">marketing@muhayu.com</div>
          </div>
          {/* 콘텐츠 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">콘텐츠</div>
            <div className="flex flex-wrap gap-3">
              {sns.map(s => <button key={s} className="hover:text-brand-400">{s}</button>)}
            </div>
          </div>
        </div>
        {/* 하단 링크 + 카피라이트 */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs2 text-gray-500">
          <nav className="flex items-center gap-1">
            {bottomLinks.map((l, i) => (
              <span key={l} className="flex items-center">
                {i > 0 && <span className="text-gray-300 mx-1.5">·</span>}
                <button className="hover:text-brand-400">{l}</button>
              </span>
            ))}
          </nav>
          <span className="text-gray-400">Copyright © MUHAYU Inc. All rights reserved. Since 2011</span>
        </div>
      </div>
    </footer>
  );
}
