// StandaloneEditor — 새 탭에서 열리는 풀스크린 도면 편집 워크플로
import { useEffect, useState } from 'react';
import { DrawingEditorModal } from '../features/drawing-workflow/DrawingEditorModal';
import { openAlertDialog, Button } from '@muhayu/axp-ui';
import {
  readEditorSession,
  writeEditorResult,
  clearEditorChannel,
} from '../features/drawing-workflow/editorChannel';
import type { EditorReference } from '../features/patent-editor';

export function StandaloneEditor() {
  const session = readEditorSession();

  // 도면 부호 상태 — 구성요소 목록으로 초기화, 편집 중 변경 가능
  const [refs] = useState<EditorReference[]>(() => session?.references ?? []);

  // 탭 타이틀 업데이트
  useEffect(() => {
    document.title = session?.drawingName
      ? `도면 편집 — ${session.drawingName} · AXPlain.ai`
      : '도면 편집 · AXPlain.ai';
  }, [session?.drawingName]);

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-center p-8">
        <div>
          <p className="text-base2 font-semibold text-gray-700 mb-2">세션 데이터가 없습니다.</p>
          <p className="text-sm2 text-gray-500 mb-4">도면 목록에서 편집기를 다시 열어주세요.</p>
          <Button variant="outlined" color="primary" size="sm" onClick={() => window.close()}>탭 닫기</Button>
        </div>
      </div>
    );
  }

  const syncResult = (drawingId: string, stage: 'editing' | 'done', extra?: { editorJson?: string; exportedImageUrl?: string; adjustedBbox?: { x: number; y: number; w: number; h: number }; detail?: { name?: string; label?: string; description?: string } }) => {
    writeEditorResult({ drawingId, stage, references: refs, ...extra, timestamp: Date.now() });
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* 컨텍스트 바 — 명세서 참고 안내 */}
      <div className="shrink-0 bg-blue-700 text-white px-4 py-1.5 flex items-center gap-3 text-xs2">
        <span className="font-semibold">도면 편집</span>
        <span className="opacity-50">·</span>
        <span className="opacity-90 truncate max-w-xs">{session.drawingName}</span>
        <span className="opacity-50 hidden sm:inline">·</span>
        <span className="opacity-70 hidden sm:inline">이 창을 메인 창 옆에 나란히 열어 명세서를 참고하세요</span>
        <div className="ml-auto">
          <button
            className="text-white/70 hover:text-white text-xs2 border border-white/30 rounded px-2 py-0.5"
            onClick={() => openAlertDialog(
              { title: '확인', description: '편집을 종료하고 탭을 닫으시겠습니까?', confirm: '닫기', cancel: '취소' },
              { theme: 'danger', onConfirm: (ctrl) => { clearEditorChannel(); ctrl.close(); window.close(); } }
            )}>
            ✕ 닫기
          </button>
        </div>
      </div>

      {/* DrawingEditorModal — standalone 모드 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <DrawingEditorModal
          standalone
          drawings={session.drawings}
          initialDrawingId={session.drawingId}
          availableReferences={refs}
          onSave={(drawingId, updates) => {
            const stage = (updates.stage === 'done' || updates.stage === 'editing')
              ? updates.stage : 'editing';
            const hasDetail = updates.name !== undefined || updates.label !== undefined || updates.description !== undefined;
            syncResult(drawingId, stage, {
              editorJson: updates.savedEditorJson,
              exportedImageUrl: updates.exportedImageUrl,
              adjustedBbox: updates.adjustedBbox,
              detail: hasDetail ? { name: updates.name, label: updates.label, description: updates.description } : undefined,
            });
          }}
          onClose={() => {
            clearEditorChannel();
            window.close();
          }}
        />
      </div>
    </div>
  );
}
