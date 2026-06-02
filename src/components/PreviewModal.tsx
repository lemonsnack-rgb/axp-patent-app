// PreviewModal — 명세서 미리보기 (분석 결과 반영, B16/B17 fix)
import { useState } from 'react';
import { Icon } from './Icon';

export interface PreviewSection {
  label: string;
  content: string;
}

interface Props {
  taskName?: string;
  sections?: PreviewSection[];
  onClose: () => void;
}

function defaultSections(taskName?: string): PreviewSection[] {
  const name = taskName || '발명의 명칭';
  return [
    { label: '발명의 명칭', content: name },
    { label: '기술분야', content: '기술분야 내용을 입력하세요.' },
    { label: '배경기술', content: '배경기술 내용을 입력하세요.' },
    { label: '해결하고자 하는 과제', content: '해결 과제를 입력하세요.' },
    { label: '과제의 해결 수단', content: '해결 수단을 입력하세요.' },
    { label: '발명의 효과', content: '발명의 효과를 입력하세요.' },
    { label: '청구범위', content: `청구항 1.\n${name} 장치.` },
    { label: '도면의 간단한 설명', content: '도면의 간단한 설명을 입력하세요.' },
    { label: '발명을 실시하기 위한 구체적인 내용', content: '구체적인 내용을 입력하세요.' },
    { label: '요약서', content: `${name}에 관한 발명입니다.` },
  ];
}

export function PreviewModal({ taskName, sections: propSections, onClose }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  const sections = (propSections && propSections.length > 0)
    ? propSections
    : defaultSections(taskName);

  const handleDocx = () => {
    alert('DOCX 다운로드 기능은 준비 중입니다.\n(실제 서비스에서는 서버 API 연동 예정)');
  };

  const handlePdf = () => {
    alert('PDF 내보내기 기능은 준비 중입니다.\n(실제 서비스에서는 서버 API 연동 예정)');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all ${fullscreen ? 'w-full h-full rounded-none' : 'w-[720px] max-h-[85vh]'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h3 className="text-base2 font-bold text-gray-800">명세서 미리보기</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFullscreen(f => !f)}
              className="w-7 h-7 flex items-center justify-center border-none bg-gray-100 rounded hover:bg-gray-200 text-gray-500"
              title="전체화면"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center border-none bg-gray-100 rounded hover:bg-gray-200 text-gray-500 text-lg leading-none"
            >×</button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5">
          {sections.filter(s => s.content?.trim()).map((s, i) => (
            <div key={i} className="mb-5">
              <h4 className="text-sm2 font-bold text-gray-700 mb-1.5 pb-1 border-b border-gray-100">
                【{s.label}】
              </h4>
              <p className="text-md2 text-gray-700 leading-relaxed whitespace-pre-line">{s.content}</p>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <button onClick={onClose} className="btn-outline btn-sm">닫기</button>
          <button onClick={handleDocx} className="btn-primary btn-sm" style={{ background: '#2563eb' }}>
            <Icon name="doc" size={12} /> DOCX 다운로드
          </button>
          <button onClick={handlePdf} className="btn-primary btn-sm">
            <Icon name="doc" size={12} /> PDF 내보내기
          </button>
        </div>
      </div>
    </div>
  );
}
