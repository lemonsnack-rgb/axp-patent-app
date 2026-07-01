// 새 탭 상세 페이지 — 검색 결과 목록과 분리되어 독립적으로 상세를 본다.
import { PATENT_SEED, PAPER_SEED } from '../data/patentSeed';
import { PatentDetail } from '../components/PatentDetail';
import { PaperDetailFull } from './PaperResults';
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
          backIcon={false}
          onBack={() => window.close()}
          onSave={() => toast('저장은 검색 결과 화면에서 진행해 주세요.')}
        />
      </div>
    );
  }

  // paper — PC 우선 전체 레이아웃
  const paper = PAPER_SEED.find(p => p.id === params.key);
  if (!paper) return <NotFound message={`논문을 찾을 수 없습니다: ${params.key}`} />;
  return (
    <PaperDetailFull
      paper={paper}
      onClose={() => window.close()}
      onSave={() => toast('저장은 검색 결과 화면에서 진행해 주세요.')}
      onOpenRelated={id => {
        // 같은 탭에서 관련 논문 상세로 이동 (해시 변경 후 재마운트)
        window.location.hash = `detail?kind=paper&key=${encodeURIComponent(id)}`;
        window.location.reload();
      }}
    />
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
