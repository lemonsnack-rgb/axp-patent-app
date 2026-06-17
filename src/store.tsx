import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Task, Project, Client, Contact, LibraryItem, LibraryCollection, AppMode, TaskType } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';

// Storage 키 (기존 mockup과 호환)
const K_TASKS    = 'axp_tasks_v1';
const K_FOLDERS  = 'axp_folders_v1';
const K_CLIENTS  = 'axp_clients_v1';
const K_CONTACTS = 'axp_contacts_v1';
const K_LIBRARY  = 'axp_library_v1';
const K_COLLECTIONS = 'axp_library_collections_v1';
const K_SIDEBAR_COLLAPSED = 'axp_sidebar_collapsed_v1';

const TASK_TYPE_META: Record<TaskType, { label: string; color: string; icon: 'doc'|'search'|'paper' }> = {
  spec:          { label: '명세서',    color: 'blue',   icon: 'doc' },
  patent_search: { label: '특허 검색', color: 'violet', icon: 'search' },
  paper_search:  { label: '논문 검색', color: 'amber',  icon: 'paper' },
};

export function taskTypeMeta(t: TaskType) { return TASK_TYPE_META[t]; }

// ===== Store context =====
interface StoreCtx {
  // mode & active task
  mode: AppMode; setMode: (m: AppMode) => void;
  activeTaskId: string | null; setActiveTaskId: (id: string | null) => void;
  activeProjectId: string | null; setActiveProjectId: (id: string | null) => void;
  bgPatentRef: string | null; setBgPatentRef: (ref: string | null) => void;
  // sidebar
  sidebarCollapsed: boolean; setSidebarCollapsed: (v: boolean) => void;
  // tasks
  tasks: Task[];
  taskAdd: (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'favorite'> & { favorite?: boolean }) => Task;
  taskUpdate: (id: string, patch: Partial<Task>) => void;
  taskRemove: (id: string) => void;
  taskToggleFavorite: (id: string) => void;
  // projects (folders)
  projects: Project[];
  projectAdd: (p: Pick<Project, 'name' | 'description' | 'color' | 'clientId' | 'contactId' | 'favorite'>) => Project;
  projectToggleFavorite: (id: string) => void;
  projectUpdate: (id: string, patch: Partial<Project>) => void;
  projectRemove: (id: string) => void;
  // clients
  clients: Client[];
  clientAdd: (c: Omit<Client, 'id' | 'createdAt'>) => Client;
  clientUpdate: (id: string, patch: Partial<Client>) => void;
  clientRemove: (id: string) => void;
  // contacts
  contacts: Contact[];
  contactAdd: (c: Omit<Contact, 'id' | 'createdAt'>) => Contact;
  contactUpdate: (id: string, patch: Partial<Contact>) => void;
  contactRemove: (id: string) => void;
  contactByClient: (clientId: string) => Contact[];
  // library items
  library: LibraryItem[];
  libraryAdd: (li: Omit<LibraryItem, 'id' | 'savedAt'>) => LibraryItem;
  libraryRemove: (id: string) => void;
  libraryToggleFavorite: (id: string) => void;
  libraryUpdate: (id: string, patch: Partial<LibraryItem>) => void;
  // collections (folders)
  collections: LibraryCollection[];
  collectionAdd: (name: string, color?: string) => LibraryCollection;
  collectionUpdate: (id: string, patch: Partial<LibraryCollection>) => void;
  collectionRemove: (id: string) => void;
  collectionToggleFavorite: (id: string) => void;
  ensureUncategorized: () => string;
}

const Ctx = createContext<StoreCtx | null>(null);

const COLLECTION_COLORS = ['#1e5fa6', '#10b981', '#f59e0b', '#6d28d9', '#dc2626', '#0ea5e9', '#84cc16', '#ec4899'];

// === seed demo data on first load ===
function seedDemo() {
  if (!localStorage.getItem(K_TASKS)) {
    const now = Date.now();
    const demo: Task[] = [
      { id: 't1', type: 'spec', name: '자율주행 LIDAR 객체감지 명세서', favorite: true, createdAt: now - 86400000, updatedAt: now - 60000 },
      { id: 't2', type: 'patent_search', name: '자율주행 라이다 선행기술 조사', favorite: false, createdAt: now - 172800000, updatedAt: now - 3600000 },
      { id: 't3', type: 'paper_search', name: 'LiDAR Deep Learning 논문 리뷰', favorite: true, createdAt: now - 259200000, updatedAt: now - 7200000 },
    ];
    localStorage.setItem(K_TASKS, JSON.stringify(demo));
  }
  if (!localStorage.getItem(K_FOLDERS)) {
    const demo: Project[] = [
      { id: 'fld_auto', name: '자율주행 프로젝트', color: '#1e5fa6', createdAt: Date.now() - 86400000 },
      { id: 'fld_lit',  name: '논문 리뷰',         color: '#10b981', createdAt: Date.now() - 172800000 },
    ];
    localStorage.setItem(K_FOLDERS, JSON.stringify(demo));
  }
  if (!localStorage.getItem(K_CLIENTS)) {
    localStorage.setItem(K_CLIENTS, JSON.stringify([
      { id: 'c_hd', name: '현대자동차주식회사', industry: '자동차', createdAt: Date.now() - 86400000 },
    ]));
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // seed once
  useState(() => { seedDemo(); });

  const [tasks, setTasks] = useLocalStorage<Task[]>(K_TASKS, []);
  const [projects, setProjects] = useLocalStorage<Project[]>(K_FOLDERS, []);
  const [clients, setClients] = useLocalStorage<Client[]>(K_CLIENTS, []);
  const [contacts, setContacts] = useLocalStorage<Contact[]>(K_CONTACTS, []);
  const [library, setLibrary] = useLocalStorage<LibraryItem[]>(K_LIBRARY, []);
  const [collections, setCollections] = useLocalStorage<LibraryCollection[]>(K_COLLECTIONS, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage<boolean>(K_SIDEBAR_COLLAPSED, false);

  // app state (not persisted)
  const [mode, setMode] = useState<AppMode>('newtask');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [bgPatentRef, setBgPatentRef] = useState<string | null>(null);

  // 진입 시 디폴트 = 새 작업 (사용자 결정)
  // activeTaskId는 사이드바에서 task 클릭 시 설정됨

  // === task ops ===
  const taskAdd: StoreCtx['taskAdd'] = useCallback((t) => {
    const now = Date.now();
    const nt: Task = { id: 't_' + now, favorite: !!t.favorite, createdAt: now, updatedAt: now, ...t };
    setTasks(prev => [nt, ...prev]);
    return nt;
  }, [setTasks]);
  const taskUpdate = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t));
  }, [setTasks]);
  const taskRemove = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [setTasks]);
  const taskToggleFavorite = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, favorite: !t.favorite } : t));
  }, [setTasks]);

  // === project ops ===
  const projectAdd: StoreCtx['projectAdd'] = useCallback((p) => {
    const np: Project = { id: 'fld_' + Date.now(), createdAt: Date.now(), ...p };
    setProjects(prev => [np, ...prev]);
    return np;
  }, [setProjects]);
  const projectUpdate = useCallback((id: string, patch: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, [setProjects]);
  const projectRemove = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, [setProjects]);
  const projectToggleFavorite = useCallback((id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p));
  }, [setProjects]);

  // === client ops ===
  const clientAdd: StoreCtx['clientAdd'] = useCallback((c) => {
    const nc: Client = { id: 'cl_' + Date.now(), createdAt: Date.now(), ...c };
    setClients(prev => [nc, ...prev]);
    return nc;
  }, [setClients]);
  const clientUpdate = useCallback((id: string, patch: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [setClients]);
  const clientRemove = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  }, [setClients]);

  // === contact ops ===
  const contactAdd: StoreCtx['contactAdd'] = useCallback((c) => {
    const nc: Contact = { id: 'co_' + Date.now(), createdAt: Date.now(), ...c };
    setContacts(prev => [nc, ...prev]);
    return nc;
  }, [setContacts]);
  const contactUpdate = useCallback((id: string, patch: Partial<Contact>) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [setContacts]);
  const contactRemove = useCallback((id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  }, [setContacts]);
  const contactByClient = useCallback((clientId: string) => contacts.filter(c => c.clientId === clientId), [contacts]);

  // === library ops ===
  const libraryAdd: StoreCtx['libraryAdd'] = useCallback((li) => {
    const nl: LibraryItem = { id: 'li_' + Date.now(), savedAt: Date.now(), ...li };
    setLibrary(prev => [nl, ...prev]);
    return nl;
  }, [setLibrary]);
  const libraryRemove = useCallback((id: string) => setLibrary(prev => prev.filter(l => l.id !== id)), [setLibrary]);
  const libraryToggleFavorite = useCallback((id: string) => setLibrary(prev => prev.map(l => l.id === id ? { ...l, favorite: !l.favorite } : l)), [setLibrary]);
  const libraryUpdate = useCallback((id: string, patch: Partial<LibraryItem>) => setLibrary(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l)), [setLibrary]);

  // === collection ops ===
  const collectionAdd: StoreCtx['collectionAdd'] = useCallback((name, color) => {
    const list = collections;
    const nc: LibraryCollection = {
      id: 'lc_' + Date.now(),
      name: name.trim(),
      color: color || COLLECTION_COLORS[list.length % COLLECTION_COLORS.length],
      createdAt: Date.now(),
    };
    setCollections(prev => [nc, ...prev]);
    return nc;
  }, [collections, setCollections]);
  const collectionUpdate = useCallback((id: string, patch: Partial<LibraryCollection>) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [setCollections]);
  const collectionRemove = useCallback((id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
    setLibrary(prev => prev.map(l => l.collectionId === id ? { ...l, collectionId: null } : l));
  }, [setCollections, setLibrary]);
  const collectionToggleFavorite = useCallback((id: string) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c));
  }, [setCollections]);
  const ensureUncategorized = useCallback(() => {
    const exist = collections.find(c => c.name === '미분류' || c._system === 'uncat');
    if (exist) return exist.id;
    const nc: LibraryCollection = {
      id: 'lc_' + Date.now() + '_uncat',
      name: '미분류',
      color: '#94a3b8',
      _system: 'uncat',
      createdAt: Date.now(),
    };
    setCollections(prev => [nc, ...prev]);
    return nc.id;
  }, [collections, setCollections]);

  const value: StoreCtx = useMemo(() => ({
    mode, setMode,
    activeTaskId, setActiveTaskId,
    activeProjectId, setActiveProjectId,
    bgPatentRef, setBgPatentRef,
    sidebarCollapsed, setSidebarCollapsed,

    tasks, taskAdd, taskUpdate, taskRemove, taskToggleFavorite,
    projects, projectAdd, projectUpdate, projectRemove, projectToggleFavorite,
    clients, clientAdd, clientUpdate, clientRemove,
    contacts, contactAdd, contactUpdate, contactRemove, contactByClient,
    library, libraryAdd, libraryRemove, libraryToggleFavorite, libraryUpdate,
    collections, collectionAdd, collectionUpdate, collectionRemove, collectionToggleFavorite, ensureUncategorized,
  }), [
    mode, activeTaskId, activeProjectId, bgPatentRef, sidebarCollapsed,
    tasks, projects, clients, contacts, library, collections,
    taskAdd, taskUpdate, taskRemove, taskToggleFavorite,
    projectAdd, projectUpdate, projectRemove, projectToggleFavorite,
    clientAdd, clientUpdate, clientRemove,
    contactAdd, contactUpdate, contactRemove, contactByClient,
    libraryAdd, libraryRemove, libraryToggleFavorite, libraryUpdate,
    collectionAdd, collectionUpdate, collectionRemove, collectionToggleFavorite, ensureUncategorized,
    setSidebarCollapsed,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
