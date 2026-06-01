// editorChannel.ts — 메인 탭 ↔ 편집기 탭 간 데이터 통신 (localStorage 기반)
import type { EditorReference, InventionComponent, PatentDrawing } from '../patent-editor';

const SESSION_KEY = 'axp_drawing_editor_session';
const RESULT_KEY  = 'axp_drawing_editor_result';

/** 메인 탭이 새 탭에 전달하는 세션 데이터 */
export interface EditorSession {
  drawingId: string;
  drawings: PatentDrawing[];
  components: InventionComponent[];
  references: EditorReference[];
  drawingName: string;
  timestamp: number;
}

/** 편집기 탭이 메인 탭에 전달하는 결과 */
export interface EditorResult {
  drawingId: string;
  editorJson?: string;
  exportedImageUrl?: string;
  stage: 'editing' | 'done';
  references: EditorReference[];
  timestamp: number;
}

/** 현재 환경이 모바일인지 여부 */
export function isMobile(): boolean {
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

/** 편집기 탭을 새 탭으로 열고 세션 데이터를 저장 */
export function openEditorTab(session: EditorSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const base = window.location.href.split('#')[0];
  window.open(`${base}#drawing-editor`, '_blank');
}

/** 현재 탭이 편집기 탭인지 확인 */
export function isEditorTab(): boolean {
  return window.location.hash === '#drawing-editor';
}

/** 편집기 탭에서 세션 데이터를 읽기 */
export function readEditorSession(): EditorSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as EditorSession) : null;
  } catch {
    return null;
  }
}

/** 편집기 탭에서 결과를 저장 (메인 탭이 storage 이벤트로 수신) */
export function writeEditorResult(result: EditorResult): void {
  localStorage.setItem(RESULT_KEY, JSON.stringify(result));
}

/** 메인 탭에서 편집기 결과를 수신하는 리스너 등록, 해제 함수 반환 */
export function onEditorResult(
  callback: (result: EditorResult) => void,
): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === RESULT_KEY && e.newValue) {
      try { callback(JSON.parse(e.newValue) as EditorResult); } catch { /* ignore */ }
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** 세션/결과 데이터 정리 */
export function clearEditorChannel(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(RESULT_KEY);
}
