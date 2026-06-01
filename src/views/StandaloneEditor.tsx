// StandaloneEditor — 새 탭에서 열리는 풀스크린 도면 편집기
import { useState, useEffect } from 'react';
import { PatentEditor } from '../features/patent-editor';
import {
  readEditorSession,
  writeEditorResult,
  clearEditorChannel,
} from '../features/drawing-workflow/editorChannel';
import type { EditorReference } from '../features/patent-editor';

export function StandaloneEditor() {
  const session = readEditorSession();
  const [refs, setRefs] = useState<EditorReference[]>(() => session?.references ?? []);
  const [saved, setSaved] = useState(false);

  // 탭 타이틀 업데이트
  useEffect(() => {
    if (session?.drawingName) {
      document.title = `도면 편집 — ${session.drawingName} · AXPlain.ai`;
    }
  }, [session?.drawingName]);

  // 탭 닫기 전 미저장 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!saved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saved]);

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-center">
        <div>
          <p className="text-base2 font-semibold text-gray-700 mb-2">세션 데이터가 없습니다.</p>
          <p className="text-sm2 text-gray-500">도면 목록에서 편집기를 다시 열어주세요.</p>
          <button className="mt-4 btn-outline btn-sm" onClick={() => window.close()}>
            탭 닫기
          </button>
        </div>
      </div>
    );
  }

  const handleSave = (drawingId: string, json: string) => {
    writeEditorResult({
      drawingId,
      editorJson: json,
      stage: 'editing',
      references: refs,
      timestamp: Date.now(),
    });
    setSaved(true);
  };

  const handleExport = (drawingId: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    writeEditorResult({
      drawingId,
      exportedImageUrl: url,
      stage: 'done',
      references: refs,
      timestamp: Date.now(),
    });
    setSaved(true);
  };

  const handleClose = () => {
    // 저장 후 탭 닫기
    if (!saved) {
      const ok = window.confirm('저장하지 않은 내용이 있습니다. 탭을 닫으시겠습니까?');
      if (!ok) return;
    }
    clearEditorChannel();
    window.close();
  };

  const handleComponentsSync = (accepted: EditorReference[]) => {
    const merged = [
      ...refs.filter(r => !accepted.find(a => a.number === r.number)),
      ...accepted,
    ];
    setRefs(merged);
    writeEditorResult({
      drawingId: session.drawingId,
      stage: 'editing',
      references: merged,
      timestamp: Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col">
      {/* 상단 컨텍스트 바 — 명세서 작업 중임을 상기 */}
      <div className="shrink-0 bg-blue-700 text-white px-4 py-1.5 flex items-center gap-3 text-xs2">
        <span className="font-semibold">도면 편집 중</span>
        <span className="opacity-70">·</span>
        <span className="opacity-90">{session.drawingName}</span>
        <span className="opacity-70">·</span>
        <span className="opacity-80">저장 후 메인 창에서 명세서를 확인하세요</span>
        <div className="ml-auto flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-green-300">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              저장됨
            </span>
          )}
        </div>
      </div>

      <PatentEditor
        drawings={session.drawings}
        activeDrawingId={session.drawingId}
        inventionComponents={session.components}
        availableReferences={refs}
        onReferenceAdd={ref => setRefs(p => [...p, ref])}
        onReferenceUpdate={ref => setRefs(p => p.map(r => r.number === ref.number ? ref : r))}
        onReferenceDelete={num => setRefs(p => p.filter(r => r.number !== num))}
        onSaveProject={handleSave}
        onExportComplete={handleExport}
        onClose={handleClose}
        onActiveDrawingChange={() => {}}
        onComponentsSync={handleComponentsSync}
      />
    </div>
  );
}
