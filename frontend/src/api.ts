const BASE = '/internal';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

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
  request<{ status: string }>(`/vectors/${kbId}/doc/${docId}`, { method: 'DELETE' });

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
  form.append('kb_id', kbId);
  return request<UploadResponse>('/upload', { method: 'POST', body: form });
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
  request<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kb_id: kbId, query, top_k: topK }),
  });
