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
    request<Array<{ doc_id: string; filename: string; file_type: string; file_size: number; status: string; chunk_count: number; chunk_size: number | null; chunk_overlap: number | null; separators: string | null }>>(
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

  getDocumentChunks: (docId: string, kbId: string) =>
    request<{ chunks: Array<{ chunk_index: number; content: string; char_count: number }> }>(
      `/internal/documents/${docId}/chunks?kb_id=${kbId}`
    ),

  chunkDocument: (docId: string, body: { kb_id: string; config_id?: string; chunk_size?: number; chunk_overlap?: number; separators?: string }) =>
    request<{ task_id: string; doc_id: string; status: string }>(`/internal/documents/${docId}/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  getChunkProgress: (docId: string) =>
    request<{ task_id: string; doc_id: string; status: string; progress: number; total_chunks: number; current_chunk: number; error_message: string | null }>(
      `/internal/documents/${docId}/chunk-progress`
    ),

  listChunkConfigs: (kbId: string) =>
    request<Array<{ id: string; name: string; chunk_size: number; chunk_overlap: number; separators: string; is_default: boolean }>>(
      `/internal/kbs/${kbId}/chunk-configs`
    ),

  createChunkConfig: (kbId: string, data: { name: string; chunk_size: number; chunk_overlap: number; separators: string }) =>
    request<{ id: string; name: string; chunk_size: number; chunk_overlap: number; separators: string; is_default: boolean }>(
      `/internal/kbs/${kbId}/chunk-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    ),

  updateChunkConfig: (kbId: string, configId: string, data: { name?: string; chunk_size?: number; chunk_overlap?: number; separators?: string }) =>
    request<{ id: string; name: string; chunk_size: number; chunk_overlap: number; separators: string; is_default: boolean }>(
      `/internal/kbs/${kbId}/chunk-configs/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    ),

  deleteChunkConfig: (kbId: string, configId: string) =>
    request<{ status: string }>(`/internal/kbs/${kbId}/chunk-configs/${configId}`, { method: 'DELETE' }),

  setDefaultChunkConfig: (kbId: string, configId: string) =>
    request<{ id: string; name: string; chunk_size: number; chunk_overlap: number; separators: string; is_default: boolean }>(
      `/internal/kbs/${kbId}/chunk-configs/${configId}/default`, { method: 'PUT' }
    ),

  // --- Model Configs ---

  getDefaultEmbedding: () =>
    request<{ provider: string; model_name: string; base_url: string }>('/internal/models/default-embedding'),

  listModels: (type?: string) =>
    request<Array<{ id: string; model_type: string; provider: string; model_name: string; base_url: string; api_key: string; is_active: boolean; extra_params: string | null }>>(
      `/internal/models${type ? `?type=${type}` : ''}`
    ),

  getActiveModels: () =>
    request<Array<{ id: string; model_type: string; provider: string; model_name: string; base_url: string; api_key: string; is_active: boolean; extra_params: string | null }>>(
      '/internal/models/active'
    ),

  createModel: (data: { model_type: string; provider: string; model_name: string; base_url?: string; api_key?: string; extra_params?: string }) =>
    request<{ id: string; model_type: string; provider: string; model_name: string; base_url: string; api_key: string; is_active: boolean }>(
      '/internal/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    ),

  updateModel: (id: string, data: { provider?: string; model_name?: string; base_url?: string; api_key?: string; extra_params?: string }) =>
    request<{ id: string; model_type: string; provider: string; model_name: string; base_url: string; api_key: string; is_active: boolean }>(
      `/internal/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    ),

  deleteModel: (id: string) =>
    request<{ status: string }>(`/internal/models/${id}`, { method: 'DELETE' }),

  activateModel: (id: string) =>
    request<{ id: string; model_type: string; provider: string; model_name: string; base_url: string; api_key: string; is_active: boolean }>(
      `/internal/models/${id}/activate`, { method: 'PUT' }
    ),

  testModel: (data: { model_type: string; provider: string; model_name: string; base_url?: string; api_key?: string }) =>
    request<{ success: boolean; message: string }>('/internal/models/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // --- Knowledge Graphs ---

  createKnowledgeGraph: (kbId: string) =>
    request<{ id: string; status: string }>(`/internal/kbs/${kbId}/knowledge-graphs`, {
      method: 'POST',
    }),

  listKnowledgeGraphs: (kbId: string) =>
    request<Array<{ id: string; name: string; node_count: number; edge_count: number; status: string; error_message: string | null; created_at: string | null }>>(
      `/internal/kbs/${kbId}/knowledge-graphs`
    ),

  getKnowledgeGraph: (kbId: string, graphId: string) =>
    request<any>(`/internal/kbs/${kbId}/knowledge-graphs/${graphId}`),

  deleteKnowledgeGraph: (kbId: string, graphId: string) =>
    request<{ status: string }>(`/internal/kbs/${kbId}/knowledge-graphs/${graphId}`, { method: 'DELETE' }),
};
