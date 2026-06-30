// 새 탭 상세 페이지 — 검색 결과 목록과 분리되어 독립적으로 상세를 본다.
import { PATENT_SEED, PAPER_SEED } from '../data/patentSeed';
import { PatentDetail } from '../components/PatentDetail';
import { PaperInlineDetail } from './PaperResults';
import { getDetailParams } from '../features/detailTab';
import { toast, Button } from '@muhayu/axp-ui';

export function StandaloneDetail() {
  const params = getDetailParams();

  if (!params) {
    return <NotFound message="잘못된 상세 주소입니다." />;
  }

  if (params.kind === 'patent') {
    const data = PATENT_SEED.find(p => p.number === params.key);
    if (!data) return <NotFound message={`특허를 찾을 수 없습니다: ${params.key}`} />;
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-white">
        <PatentDetail
          data={data}
          backLabel="탭 닫기"
          posLabel="상세 보기"
          onBack={() => window.close()}
          onSave={() => toast('저장은 검색 결과 화면에서 진행해 주세요.')}
        />
      </div>
    );
  }

  // paper
  const paper = PAPER_SEED.find(p => p.id === params.key);
  if (!paper) return <NotFound message={`논문을 찾을 수 없습니다: ${params.key}`} />;
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-50">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white shrink-0">
        <Button variant="outlined" color="primary" size="sm" onClick={() => window.close()}>탭 닫기</Button>
        <span className="text-sm2 text-gray-500">논문 상세</span>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin flex justify-center">
        <PaperInlineDetail
          paper={paper}
          posLabel="상세 보기"
          onClose={() => window.close()}
          onSave={() => toast('저장은 검색 결과 화면에서 진행해 주세요.')}
        />
      </div>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 text-gray-500 bg-white">
      <div className="text-base2 font-semibold">{message}</div>
      <Button variant="outlined" color="primary" size="sm" onClick={() => window.close()}>탭 닫기</Button>
    </div>
  );
}
