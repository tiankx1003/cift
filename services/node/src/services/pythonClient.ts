import { config } from '../config.js';

const BASE = config.pythonServiceUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.detail || `Python service error: ${res.status}`), { status: res.status });
  }
  return res.json();
}

interface UploadResult {
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

export const pythonClient = {
  createKb: (name: string, description: string) =>
    request<{ kb_id: string; name: string; description: string; doc_count: number }>('/internal/kbs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    }),

  getKb: (kbId: string) =>
    request<{ kb_id: string; name: string; description: string; doc_count: number }>(`/internal/kbs/${kbId}`),

  deleteKb: (kbId: string) =>
    request<{ status: string }>(`/internal/kbs/${kbId}`, { method: 'DELETE' }),

  listDocuments: (kbId: string) =>
    request<Array<{ doc_id: string; filename: string; file_type: string; file_size: number; status: string; chunk_count: number }>>(
      `/internal/kbs/${kbId}/documents`
    ),

  parseDocument: (docId: string, storageKey: string, fileType: string, kbId: string) =>
    request<{ doc_id: string; status: string; chunk_count: number; error_message: string | null }>('/internal/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, storage_key: storageKey, file_type: fileType, kb_id: kbId }),
    }),

  deleteDocVectors: (kbId: string, docId: string) =>
    request<{ status: string }>(`/internal/vectors/${kbId}/doc/${docId}`, { method: 'DELETE' }),

  uploadDocument: (kbId: string, fileBuffer: Buffer, filename: string, mimeType: string) => {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename);
    formData.append('kb_id', kbId);
    return request<UploadResult>('/internal/upload', {
      method: 'POST',
      body: formData,
    });
  },

  search: (kbId: string, query: string, topK = 5) => {
    type SR = { results: Array<{ chunk_id: string; content: string; score: number; metadata: Record<string, unknown> }> };
    return request<SR>('/internal/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kb_id: kbId, query, top_k: topK }),
    });
  },
};
