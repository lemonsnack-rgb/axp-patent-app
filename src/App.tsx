import { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { NewTaskView } from './views/NewTaskView';
import { HomeView } from './views/HomeView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { LibraryView } from './views/LibraryView';
import { ClientsView } from './views/ClientsView';
import { SearchView } from './views/SearchView';
import { SpecView } from './views/SpecView';
import { TermsView, PrivacyView, ContactView, FaqView } from './views/InfoPages';
import { LoginView } from './components/LoginView';
import { SpecOverlay } from './features/spec-overlay/SpecOverlay';
import { StandaloneEditor } from './views/StandaloneEditor';
import { StandaloneDetail } from './views/StandaloneDetail';
import { isEditorTab } from './features/drawing-workflow/editorChannel';
import { isDetailTab } from './features/detailTab';

function Shell() {
  const { mode, sidebarCollapsed, setSidebarCollapsed, activeTaskId } = useStore();

  // 모바일(<768px)에서 사이드바 자동 접힘
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSidebarCollapsed(true);
    };
    handler(mq); // 초기 실행
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setSidebarCollapsed]);

  // 모바일에서 사이드바 열릴 때 오버레이 표시 여부
  const isMobileOpen = !sidebarCollapsed && window.innerWidth < 768;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        {/* 모바일: 사이드바 열릴 때 반투명 오버레이 */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={() => setSidebarCollapsed(true)}
            aria-hidden="true"
          />
        )}
        <main className="flex-1 flex flex-col overflow-hidden animate-fade-up"
          key={mode === 'spec' ? `spec-${activeTaskId}` : mode}>
          {mode === 'newtask' && <NewTaskView />}
          {mode === 'home'    && <HomeView />}
          {mode === 'project' && <ProjectDetailView />}
          {mode === 'library' && <LibraryView />}
          {mode === 'clients' && <ClientsView />}
          {mode === 'search'  && <SearchView />}
          {mode === 'spec'    && <SpecView />}
          {mode === 'terms'   && <TermsView />}
          {mode === 'privacy' && <PrivacyView />}
          {mode === 'contact' && <ContactView />}
          {mode === 'faq'     && <FaqView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  // 새 탭으로 열린 도면 편집기 — 로그인 불필요, 독립 렌더
  if (isEditorTab()) {
    return <StandaloneEditor />;
  }

  // 새 탭으로 열린 검색 상세 — 독립 렌더
  if (isDetailTab()) {
    return <StandaloneDetail />;
  }

  const [loggedIn, setLoggedIn] = useState(
    () => sessionStorage.getItem('axp_auth') === '1'
  );

  if (!loggedIn) {
    return <LoginView onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <StoreProvider>
      <Shell />
      <SpecOverlay />
    </StoreProvider>
  );
}
