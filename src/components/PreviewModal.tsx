// PreviewModal — 명세서 미리보기 (분석 결과 반영, B16/B17 fix)
import { useState } from 'react';
import { Button } from '@muhayu/axp-ui';
import { Icon } from './Icon';
import { exportDocx } from '../utils/exportDocx';
import { exportPdf } from '../utils/exportPdf';

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
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null);
  const [pdfBlocked, setPdfBlocked] = useState(false);

  const sections = (propSections && propSections.length > 0)
    ? propSections
    : defaultSections(taskName);

  const handleDocx = async () => {
    setExporting('docx');
    try {
      await exportDocx(taskName ?? '특허명세서', sections);
    } catch {
      alert('DOCX 생성 중 오류가 발생했습니다.');
    } finally {
      setExporting(null);
    }
  };

  const handlePdf = () => {
    setExporting('pdf');
    setPdfBlocked(false);
    const opened = exportPdf(taskName ?? '특허명세서', sections);
    if (!opened) {
      setPdfBlocked(true);
    }
    setTimeout(() => setExporting(null), 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all ${
          fullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-3xl max-h-[90vh]'
        }`}
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

        {/* 팝업 차단 경고 */}
        {pdfBlocked && (
          <div className="mx-4 mt-3 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-700 flex items-start gap-2 shrink-0">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>
              팝업이 차단되어 있습니다. 주소창 우측의 팝업 허용 버튼을 클릭한 후 다시 시도하세요.
            </span>
          </div>
        )}

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
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <Button variant="outlined" color="primary" size="sm" onClick={onClose}>닫기</Button>
          <Button
            variant="filled"
            color="primary"
            size="sm"
            onClick={handleDocx}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: '#2563eb' }}
          >
            {exporting === 'docx' ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : <Icon name="doc" size={12} />}
            DOCX 다운로드
          </Button>
          <Button
            variant="filled"
            color="primary"
            size="sm"
            onClick={handlePdf}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 disabled:opacity-60"
          >
            {exporting === 'pdf' ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : <Icon name="doc" size={12} />}
            PDF 내보내기
          </Button>
        </div>
      </div>
    </div>
  );
}
