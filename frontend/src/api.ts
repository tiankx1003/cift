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
  total_chunks: number;
  total_vectors: number;
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
  chunk_size: number | null;
  chunk_overlap: number | null;
  separators: string | null;
  error_message: string | null;
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
  metadata: { doc_id: string; chunk_index: number; filename?: string; start_offset?: number; end_offset?: number };
  rerank_score: number | null;
  bm25_score: number | null;
}

export interface SearchResponse {
  results: SearchResult[];
}

export const search = (kbId: string, query: string, params?: { top_k?: number; similarity_threshold?: number; vector_weight?: number; hybrid_threshold?: number; use_rerank?: boolean; search_mode?: string }) =>
  request<SearchResponse>(`/kbs/${kbId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, ...params }),
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

export interface ChunkTaskInfo {
  task_id: string;
  doc_id: string;
  status: string;
  progress: number;
  total_chunks: number;
  current_chunk: number;
  error_message: string | null;
}

export const chunkDocument = (kbId: string, docId: string, body: { config_id?: string; chunk_size?: number; chunk_overlap?: number; separators?: string; strategy?: string; heading_level?: number }) =>
  request<{ task_id: string; doc_id: string; status: string }>(`/kbs/${kbId}/documents/${docId}/chunk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const getChunkProgress = (kbId: string, docId: string) =>
  request<ChunkTaskInfo>(`/kbs/${kbId}/documents/${docId}/chunk-progress`);

// --- Chunk Configs ---

export interface ChunkConfigInfo {
  id: string;
  name: string;
  chunk_size: number;
  chunk_overlap: number;
  separators: string;
  strategy: string;
  heading_level: number;
  is_default: boolean;
}

export const listChunkConfigs = (kbId: string) =>
  request<ChunkConfigInfo[]>(`/kbs/${kbId}/chunk-configs`);

export const createChunkConfig = (kbId: string, data: { name: string; chunk_size: number; chunk_overlap: number; separators: string; strategy?: string; heading_level?: number }) =>
  request<ChunkConfigInfo>(`/kbs/${kbId}/chunk-configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const updateChunkConfig = (kbId: string, configId: string, data: { name?: string; chunk_size?: number; chunk_overlap?: number; separators?: string; strategy?: string; heading_level?: number }) =>
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

export const getDefaultEmbedding = () =>
  request<{ provider: string; model_name: string; base_url: string }>('/models/default-embedding');

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

// --- API Keys ---

export interface ApiKeyInfo {
  id: string;
  name: string;
  key: string; // masked
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyCreated {
  id: string;
  name: string;
  key: string; // full key, shown only once
  is_active: boolean;
  created_at: string;
}

export const listApiKeys = () =>
  request<ApiKeyInfo[]>('/api-keys');

export const createApiKey = (name: string) =>
  request<ApiKeyCreated>('/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

export const deleteApiKey = (id: string) =>
  request<{ deleted: boolean }>(`/api-keys/${id}`, { method: 'DELETE' });

// --- Export ---

export const exportKb = async (kbId: string, format: 'json' | 'csv' = 'json') => {
  const res = await fetch(`${BASE}/kbs/${kbId}/export?format=${format}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const disposition = res.headers.get('content-disposition');
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  a.download = match ? match[1] : `export.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- Document Preview ---

export interface PreviewResponse {
  content: string;
  file_type: string;
  filename: string;
}

export const previewDocument = (kbId: string, docId: string) =>
  request<PreviewResponse>(`/kbs/${kbId}/documents/${docId}/preview`);

// --- Chat ---

export interface ChatSessionInfo {
  id: string;
  kb_id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ChatMessageInfo {
  id: string;
  session_id: string;
  role: string;
  content: string;
  sources: string | null;
  created_at: string | null;
}

export const createChatSession = (kbId: string, title?: string) =>
  request<ChatSessionInfo>('/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kb_id: kbId, title: title || 'New Chat' }),
  });

export const listChatSessions = (kbId: string) =>
  request<ChatSessionInfo[]>(`/chat/sessions?kb_id=${kbId}`);

export const getChatMessages = (sessionId: string) =>
  request<ChatMessageInfo[]>(`/chat/sessions/${sessionId}/messages`);

export const deleteChatSession = (sessionId: string) =>
  request<{ status: string }>(`/chat/sessions/${sessionId}`, { method: 'DELETE' });

export const streamChatMessage = async (
  sessionId: string,
  query: string,
  params?: { top_k?: number; similarity_threshold?: number; template_id?: string },
  onToken?: (token: string) => void,
  onSources?: (sources: any[]) => void,
  onError?: (error: string) => void,
) => {
  const res = await fetch(`${BASE}/chat/sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query, ...params }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.detail || `Chat failed: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'token' && onToken) {
          fullContent += event.content;
          onToken(event.content);
        } else if (event.type === 'sources' && onSources) {
          const citations = typeof event.citations === 'string' ? JSON.parse(event.citations) : event.citations;
          onSources(citations);
        } else if (event.type === 'error' && onError) {
          onError(event.content);
        }
      } catch { /* ignore parse errors */ }
    }
  }

  return fullContent;
};

// --- Prompt Templates ---

export interface PromptTemplateInfo {
  id: string;
  kb_id: string | null;
  name: string;
  system_prompt: string;
  rag_template: string;
  is_default: boolean;
}

export const listPromptTemplates = (kbId: string) =>
  request<PromptTemplateInfo[]>(`/kbs/${kbId}/prompt-templates`);

export const createPromptTemplate = (kbId: string, data: { name: string; system_prompt?: string; rag_template?: string; is_default?: boolean }) =>
  request<PromptTemplateInfo>(`/kbs/${kbId}/prompt-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const updatePromptTemplate = (kbId: string, templateId: string, data: { name?: string; system_prompt?: string; rag_template?: string }) =>
  request<PromptTemplateInfo>(`/kbs/${kbId}/prompt-templates/${templateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const deletePromptTemplate = (kbId: string, templateId: string) =>
  request<{ status: string }>(`/kbs/${kbId}/prompt-templates/${templateId}`, { method: 'DELETE' });

export const setDefaultPromptTemplate = (kbId: string, templateId: string) =>
  request<PromptTemplateInfo>(`/kbs/${kbId}/prompt-templates/${templateId}/default`, { method: 'PUT' });

// --- QA (智能问答) ---

export interface QaSessionInfo {
  id: string;
  user_id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface QaMessageInfo {
  id: string;
  session_id: string;
  role: string;
  content: string;
  kb_ids: string | null;
  sources: string | null;
  created_at: string | null;
}

export const createQaSession = (title?: string) =>
  request<QaSessionInfo>('/qa/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || '新对话' }),
  });

export const listQaSessions = () =>
  request<QaSessionInfo[]>('/qa/sessions');

export const renameQaSession = (sessionId: string, title: string) =>
  request<QaSessionInfo>(`/qa/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

export const getQaMessages = (sessionId: string) =>
  request<QaMessageInfo[]>(`/qa/sessions/${sessionId}/messages`);

export const deleteQaSession = (sessionId: string) =>
  request<{ status: string }>(`/qa/sessions/${sessionId}`, { method: 'DELETE' });

export const streamQaMessage = async (
  sessionId: string,
  query: string,
  params?: { kb_ids?: string[]; top_k?: number; similarity_threshold?: number; template_id?: string },
  onToken?: (token: string) => void,
  onSources?: (sources: any[]) => void,
  onError?: (error: string) => void,
) => {
  const res = await fetch(`${BASE}/qa/sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query, ...params }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.detail || `QA failed: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'token' && onToken) {
          fullContent += event.content;
          onToken(event.content);
        } else if (event.type === 'sources' && onSources) {
          const citations = typeof event.citations === 'string' ? JSON.parse(event.citations) : event.citations;
          onSources(citations);
        } else if (event.type === 'error' && onError) {
          onError(event.content);
        }
      } catch { /* ignore parse errors */ }
    }
  }

  return fullContent;
};
