import { useState } from 'react';
import { StoreProvider, useStore } from './store';
import { ToastProvider } from './components/Toast';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { NewTaskView } from './views/NewTaskView';
import { HomeView } from './views/HomeView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { LibraryView } from './views/LibraryView';
import { ClientsView } from './views/ClientsView';
import { SearchView } from './views/SearchView';
import { SpecView } from './views/SpecView';
import { LoginView } from './components/LoginView';
import { StandaloneEditor } from './views/StandaloneEditor';
import { isEditorTab } from './features/drawing-workflow/editorChannel';

function Shell() {
  const { mode } = useStore();
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {mode === 'newtask' && <NewTaskView />}
          {mode === 'home'    && <HomeView />}
          {mode === 'project' && <ProjectDetailView />}
          {mode === 'library' && <LibraryView />}
          {mode === 'clients' && <ClientsView />}
          {mode === 'search'  && <SearchView />}
          {mode === 'spec'    && <SpecView />}
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

  const [loggedIn, setLoggedIn] = useState(
    () => sessionStorage.getItem('axp_auth') === '1'
  );

  if (!loggedIn) {
    return <LoginView onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}
