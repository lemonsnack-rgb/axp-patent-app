// PreviewModal — 명세서 미리보기 모달 (원본 preview-modal 포팅)
import { useState } from 'react';
import { Icon } from './Icon';

interface Props {
  taskName?: string;
  onClose: () => void;
}

export function PreviewModal({ taskName, onClose }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  const sections = [
    { label: '발명의 명칭', content: taskName || '라이다 기반 자율주행 객체 인식 장치 및 방법' },
    { label: '기술분야', content: '본 발명은 자율주행 차량에서 라이다 센서를 이용한 객체 감지 기술에 관한 것으로, 특히 딥러닝 기반의 포인트 클라우드 처리를 이용한 실시간 3D 객체 인식 장치 및 방법에 관한 것이다.' },
    { label: '배경기술', content: '종래의 자율주행 객체 인식 기술에서는 카메라 기반 2D 인식 방식이 주로 사용되었으나, 야간이나 악천후 환경에서 성능이 저하되는 문제점이 있었다. 또한, 기존 라이다 기반 방식은 처리 속도가 느려 실시간 응용에 한계가 있었다.' },
    { label: '해결하고자 하는 과제', content: '본 발명은 상기와 같은 문제점을 해결하기 위해 안출된 것으로, 라이다 센서와 딥러닝을 결합하여 다양한 환경 조건에서도 높은 정확도와 처리 속도로 주변 객체를 감지할 수 있는 장치 및 방법을 제공하는 것을 목적으로 한다.' },
    { label: '과제의 해결 수단', content: '상기 목적을 달성하기 위한 본 발명의 라이다 기반 객체 감지 장치는, 라이다 센서로부터 3차원 포인트 클라우드 데이터를 획득하는 데이터 수집부; 상기 포인트 클라우드 데이터를 전처리하는 전처리부; PointNet++ 아키텍처를 적용하여 포인트 특징을 추출하는 특징 추출부; 딥러닝 모델을 이용하여 객체를 분류하는 인식부; 및 인식된 객체의 3D 위치, 크기, 종류를 출력하는 출력부를 포함한다.' },
    { label: '발명의 효과', content: '본 발명에 의하면, 딥러닝 기반의 포인트 클라우드 처리를 통해 기존 방식 대비 처리 속도가 40% 향상되고, 객체 인식 정확도가 95% 이상 달성된다. 또한, 야간 및 악천후 환경에서도 안정적인 객체 인식 성능을 유지할 수 있다.' },
    { label: '청구범위', content: '【청구항 1】 라이다 센서로부터 3차원 포인트 클라우드 데이터를 획득하는 데이터 수집부; 상기 데이터를 전처리하는 전처리부; 딥러닝 모델로 객체를 분류하는 인식부를 포함하는, 라이다 기반 객체 감지 장치.\n\n【청구항 2】 제1항에 있어서, 상기 인식부는 PointNet++ 아키텍처를 포함하는, 라이다 기반 객체 감지 장치.' },
    { label: '도면의 간단한 설명', content: '[도 1]은 본 발명의 일 실시예에 따른 전체 시스템 구성도이다.\n[도 2]는 LiDAR 센서 배치 및 포인트 클라우드 수집 방식을 나타낸 도면이다.\n[도 3]은 전처리부의 노이즈 제거 흐름도이다.\n[도 4]는 PointNet++ 기반 특징 추출 구조도이다.' },
    { label: '발명을 실시하기 위한 구체적인 내용', content: '이하, 첨부된 도면을 참조하여 본 발명의 실시예를 상세히 설명한다. 도 1을 참조하면, 본 발명의 라이다 기반 객체 감지 장치(100)는 데이터 수집부(110), 전처리부(120), 특징 추출부(130), 인식부(140) 및 출력부(150)를 포함한다...' },
    { label: '요약서', content: '본 발명은 자율주행 차량에서 라이다 센서를 이용하여 주변 객체를 실시간으로 감지하고 분류하는 장치 및 방법에 관한 것이다. 딥러닝 기반의 포인트 클라우드 처리 알고리즘을 적용하여 보행자, 차량, 장애물 등을 정확하게 인식한다.' },
  ];

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
            >
              ×
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5">
          {sections.map((s, i) => (
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
          <button className="btn-primary btn-sm" style={{ background: '#2563eb' }}>
            <Icon name="doc" size={12} /> DOCX 다운로드
          </button>
          <button className="btn-primary btn-sm">
            <Icon name="doc" size={12} /> PDF 내보내기
          </button>
        </div>
      </div>
    </div>
  );
}
