// === Core domain types (mockup data model) ===

export type TaskType = 'spec' | 'patent_search' | 'paper_search';

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  folderId?: string;       // 소속 프로젝트 (구 "folder")
  techField?: string;
  clientId?: string;
  contactId?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  clientId?: string | null;
  contactId?: string | null;
  favorite?: boolean;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  industry?: string;
  address?: string;
  createdAt: number;
}

export interface Contact {
  id: string;
  clientId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  type: 'patent' | 'paper';
  refNumber: string;
  title: string;
  applicant?: string;
  applicationDate?: string;
  abstract?: string;
  collectionId?: string | null;   // = 폴더
  tags: string[];
  note?: string;
  favorite: boolean;
  savedAt: number;
  fromTaskId?: string;
  fromFolderId?: string;
  data?: any;
}

export interface LibraryCollection {        // = 폴더
  id: string;
  name: string;
  color: string;
  favorite?: boolean;
  _system?: 'uncat';
  createdAt: number;
}

export type AppMode =
  | 'newtask'
  | 'home'
  | 'project'
  | 'library'
  | 'clients'
  | 'search'
  | 'spec';

export interface PatentResult {
  number: string;
  country: string;
  status: string;
  title: string;
  applicant: string;
  inventors: string;
  applicationNo: string;
  applicationDate: string;
  publicationNo: string;
  publicationDate: string;
  registerNo: string;
  registerDate: string;
  expirationDate: string;
  ipc: string;
  cpc: string;
  rightStatus?: string;
  rightChange?: string;
  grade?: string;
  trial?: string;
  rejectionCount?: number;
  applicantStandard?: string;
  standardOrg?: string;
  dispute?: string;
  abstract: string;
  repClaim: string;
  aiPurpose?: string;
  aiSolution?: string;
  aiEffect?: string;
  family: number;
  citing: number;
  cited: number;
  figures?: { label: string; desc: string; art?: string }[];
  // 도면 부호의 설명 (도면 주요 부분에 대한 부호 설명)
  refSigns?: { sign: string; label: string }[];
  // 구조화된 청구항 (없으면 repClaim 단독 표시)
  claims?: { no: number; dependsOn?: number; text: string }[];
  // 구조화된 인용/피인용 (없으면 citing/cited 카운트만 표시)
  citingList?: PatentCitation[];
  citedList?: PatentCitation[];
  // Sheet 3 추가 필드
  applicantAddress?: string;
  inventorAddress?: string;
  applicantCode?: string;
  priorityDate?: string;
  examRequestDate?: string;
  terminationDate?: string;
  description?: string;
  agent?: string;
  agentAddress?: string;
}

export interface PatentCitation {
  kind: 'patent' | 'npl';   // 특허 / 비특허(논문)
  ref: string;              // 문헌번호 또는 [NPL]
  title: string;
  stage?: string;           // 심사/이의 등 (비특허 표용)
}

export interface PaperResult {
  id: string;
  title: string;
  authors: string;
  journal?: string;
  year?: number;
  abstract?: string;
  doi?: string;
  citationCount?: number;
  keywords?: string[];
  field?: string;           // 분야(카테고리) 필터용
  language?: 'EN' | 'KO' | 'JP' | 'ZH';
}
