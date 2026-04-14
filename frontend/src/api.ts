import { getAuthHeaders, removeToken } from './utils/auth';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
    ...getAuthHeaders(),
  };

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('未登录或登录已过期');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// --- Auth ---

export interface AuthResponse {
  user: { id: string; username: string };
  token: string;
}

export interface UserInfo {
  id: string;
  username: string;
  created_at: string;
}

export const login = (username: string, password: string) =>
  request<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

export const register = (username: string, password: string) =>
  request<AuthResponse>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

export const getMe = () => request<UserInfo>('/auth/me');

// --- KB ---

export interface KbInfo {
  kb_id: string;
  name: string;
  description: string;
  doc_count: number;
}

export const listKbs = () => request<KbInfo[]>('/kbs');

export const createKb = (name: string, description = '') =>
  request<KbInfo>('/kbs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });

export const getKb = (kbId: string) => request<KbInfo>(`/kbs/${kbId}`);

export const deleteKb = (kbId: string) =>
  request<{ status: string }>(`/kbs/${kbId}`, { method: 'DELETE' });

// --- Documents ---

export interface DocumentInfo {
  doc_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  chunk_count: number;
}

export const listDocuments = (kbId: string) =>
  request<DocumentInfo[]>(`/kbs/${kbId}/documents`);

export const deleteDocument = (kbId: string, docId: string) =>
  request<{ status: string }>(`/kbs/${kbId}/documents/${docId}`, { method: 'DELETE' });

// --- Upload ---

export interface UploadResponse {
  doc_id: string;
  kb_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_key: string;
  status: string;
  chunk_count: number;
  error_message: string | null;
}

export const uploadFile = (kbId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return request<UploadResponse>(`/kbs/${kbId}/documents/upload`, {
    method: 'POST',
    body: form,
  });
};

// --- Search ---

export interface SearchResult {
  chunk_id: string;
  content: string;
  score: number;
  metadata: { doc_id: string; chunk_index: number };
}

export interface SearchResponse {
  results: SearchResult[];
}

export const search = (kbId: string, query: string, topK = 5) =>
  request<SearchResponse>(`/kbs/${kbId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  });
