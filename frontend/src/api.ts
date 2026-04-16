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

// --- Chunks ---

export interface ChunkInfo {
  chunk_index: number;
  content: string;
  char_count: number;
  start_offset?: number;
  end_offset?: number;
}

export interface ChunksResponse {
  filename: string;
  extracted_text: string;
  chunks: ChunkInfo[];
}

export const getDocumentChunks = (kbId: string, docId: string) =>
  request<ChunksResponse>(`/kbs/${kbId}/documents/${docId}/chunks`);

// --- Chunking ---

export const chunkDocument = (kbId: string, docId: string, body: { config_id?: string; chunk_size?: number; chunk_overlap?: number; separators?: string }) =>
  request<{ doc_id: string; status: string; chunk_count: number }>(`/kbs/${kbId}/documents/${docId}/chunk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// --- Chunk Configs ---

export interface ChunkConfigInfo {
  id: string;
  name: string;
  chunk_size: number;
  chunk_overlap: number;
  separators: string;
  is_default: boolean;
}

export const listChunkConfigs = (kbId: string) =>
  request<ChunkConfigInfo[]>(`/kbs/${kbId}/chunk-configs`);

export const createChunkConfig = (kbId: string, data: { name: string; chunk_size: number; chunk_overlap: number; separators: string }) =>
  request<ChunkConfigInfo>(`/kbs/${kbId}/chunk-configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const updateChunkConfig = (kbId: string, configId: string, data: { name?: string; chunk_size?: number; chunk_overlap?: number; separators?: string }) =>
  request<ChunkConfigInfo>(`/kbs/${kbId}/chunk-configs/${configId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const deleteChunkConfig = (kbId: string, configId: string) =>
  request<{ status: string }>(`/kbs/${kbId}/chunk-configs/${configId}`, { method: 'DELETE' });

export const setDefaultChunkConfig = (kbId: string, configId: string) =>
  request<ChunkConfigInfo>(`/kbs/${kbId}/chunk-configs/${configId}/default`, { method: 'PUT' });

// --- Model Configs ---

export interface ModelConfigInfo {
  id: string;
  model_type: string;
  provider: string;
  model_name: string;
  base_url: string;
  api_key: string;
  is_active: boolean;
  extra_params: string | null;
}

export const listModels = (type?: string) =>
  request<ModelConfigInfo[]>(`/models${type ? `?type=${type}` : ''}`);

export const getActiveModels = () =>
  request<ModelConfigInfo[]>('/models/active');

export const createModel = (data: { model_type: string; provider: string; model_name: string; base_url?: string; api_key?: string; extra_params?: string }) =>
  request<ModelConfigInfo>('/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const updateModel = (id: string, data: { provider?: string; model_name?: string; base_url?: string; api_key?: string; extra_params?: string }) =>
  request<ModelConfigInfo>(`/models/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const deleteModel = (id: string) =>
  request<{ status: string }>(`/models/${id}`, { method: 'DELETE' });

export const activateModel = (id: string) =>
  request<ModelConfigInfo>(`/models/${id}/activate`, { method: 'PUT' });

export const testModel = (data: { model_type: string; provider: string; model_name: string; base_url?: string; api_key?: string }) =>
  request<{ success: boolean; message: string }>('/models/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// --- Knowledge Graphs ---

export interface GraphInfo {
  id: string;
  name: string;
  node_count: number;
  edge_count: number;
  status: string;
  error_message: string | null;
  created_at: string | null;
}

export interface GraphData {
  nodes: Array<{ id: string; name: string; type: string }>;
  edges: Array<{ source: string; target: string; label: string }>;
}

export const createKnowledgeGraph = (kbId: string) =>
  request<{ id: string; status: string }>(`/kbs/${kbId}/knowledge-graphs`, { method: 'POST' });

export const listKnowledgeGraphs = (kbId: string) =>
  request<GraphInfo[]>(`/kbs/${kbId}/knowledge-graphs`);

export const getKnowledgeGraph = (kbId: string, graphId: string) =>
  request<{ id: string; name: string; node_count: number; edge_count: number; status: string; error_message: string | null; graph_data?: GraphData }>(`/kbs/${kbId}/knowledge-graphs/${graphId}`);

export const deleteKnowledgeGraph = (kbId: string, graphId: string) =>
  request<{ status: string }>(`/kbs/${kbId}/knowledge-graphs/${graphId}`, { method: 'DELETE' });
