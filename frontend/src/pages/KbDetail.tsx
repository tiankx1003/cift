import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Button,
  Table,
  Upload,
  Input,
  InputNumber,
  Typography,
  message,
  Popconfirm,
  Card,
  List,
  Tag,
  Space,
  Spin,
  Empty,
  Row,
  Col,
  Progress,
  Statistic,
  Modal,
  Form,
  Select,
  Alert,
  Tooltip,
} from 'antd';
import {
  UploadOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FileMarkdownOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  ScissorOutlined,
  PlusOutlined,
  EditOutlined,
  StarOutlined,
  ExportOutlined,
  EyeOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const { Title, Text, Paragraph } = Typography;

function highlightText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lowerQuery = trimmed.toLowerCase();
  const lowerText = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let searchFrom = 0;
  while (searchFrom < lowerText.length) {
    const idx = lowerText.indexOf(lowerQuery, searchFrom);
    if (idx === -1) break;
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <mark key={idx} style={{ background: '#fff3b0', padding: '0 2px', borderRadius: 2 }}>
        {text.slice(idx, idx + trimmed.length)}
      </mark>
    );
    lastIndex = idx + trimmed.length;
    searchFrom = lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}

export default function KbDetail() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();

  const [kb, setKb] = useState<api.KbInfo | null>(null);
  const [docs, setDocs] = useState<api.DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<api.SearchResult[]>([]);
  const [searchDone, setSearchDone] = useState(false);

  // Search parameters
  const [searchParamsExpanded, setSearchParamsExpanded] = useState(false);
  const [searchTopK, setSearchTopK] = useState(10);
  const [searchSimilarityThreshold, setSearchSimilarityThreshold] = useState(0.3);
  const [searchVectorWeight, setSearchVectorWeight] = useState(0.7);
  const [searchHybridThreshold, setSearchHybridThreshold] = useState(0.0);
  const [searchMode, setSearchMode] = useState<string>('vector');
  const [useRerank, setUseRerank] = useState(false);

  const [chunkModalOpen, setChunkModalOpen] = useState(false);
  const [chunkingDocId, setChunkingDocId] = useState<string>('');
  const [chunking, setChunking] = useState(false);
  const [chunkConfigs, setChunkConfigs] = useState<api.ChunkConfigInfo[]>([]);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<api.ChunkConfigInfo | null>(null);

  // Batch operations
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchChunking, setBatchChunking] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchChunkModalOpen, setBatchChunkModalOpen] = useState(false);

  // Async chunking progress
  const [chunkProgress, setChunkProgress] = useState<Record<string, api.ChunkTaskInfo>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Upload status polling
  const uploadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewFilename, setPreviewFilename] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!kbId) return;
    try {
      setLoading(true);
      const [kbData, docsData] = await Promise.all([
        api.getKb(kbId),
        api.listDocuments(kbId),
      ]);
      setKb(kbData);
      setDocs(docsData);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll chunk progress for processing docs
  useEffect(() => {
    const pollProgress = async () => {
      if (!kbId) return;
      const processingDocs = docs.filter(d => d.status === 'processing');
      if (processingDocs.length === 0) return;

      const updates: Record<string, api.ChunkTaskInfo> = {};
      for (const doc of processingDocs) {
        try {
          const info = await api.getChunkProgress(kbId, doc.doc_id);
          updates[doc.doc_id] = info;
        } catch { /* ignore */ }
      }
      if (Object.keys(updates).length > 0) {
        setChunkProgress(prev => ({ ...prev, ...updates }));
        // If all done, refresh doc list
        const allDone = Object.values(updates).every(t => t.status === 'completed' || t.status === 'failed');
        if (allDone) {
          fetchData();
        }
      }
    };

    // Poll every 2s if there are processing docs
    if (docs.some(d => d.status === 'processing')) {
      pollingRef.current = setInterval(pollProgress, 2000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [kbId, docs, fetchData]);

  // Poll document status after upload (every 3s until all stable)
  useEffect(() => {
    const pollUploadStatus = async () => {
      if (!kbId) return;
      const unstableDocs = docs.filter(d => d.status === 'parsing' || d.status === 'processing');
      if (unstableDocs.length === 0) {
        if (uploadPollRef.current) {
          clearInterval(uploadPollRef.current);
          uploadPollRef.current = null;
        }
        return;
      }
      try {
        const docsData = await api.listDocuments(kbId);
        setDocs(docsData);
      } catch { /* ignore */ }
    };

    if (docs.some(d => d.status === 'parsing' || d.status === 'processing')) {
      if (!uploadPollRef.current) {
        uploadPollRef.current = setInterval(pollUploadStatus, 3000);
      }
    }

    return () => {
      if (uploadPollRef.current) {
        clearInterval(uploadPollRef.current);
        uploadPollRef.current = null;
      }
    };
  }, [kbId, docs]);

  const handleBatchUpload = async (files: File[]) => {
    if (!kbId) return;
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['txt', 'md', 'pdf', 'docx', 'csv', 'json'].includes(ext || '');
    });
    const invalidCount = files.length - validFiles.length;
    if (invalidCount > 0) {
      message.warning(`${invalidCount} 个文件格式不支持，已跳过`);
    }
    if (validFiles.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < validFiles.length; i++) {
      setUploadProgress({ current: i + 1, total: validFiles.length });
      try {
        const res = await api.uploadFile(kbId, validFiles[i]);
        if (res.status === 'completed') successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      message.success(`${successCount} 个文件上传成功${failCount > 0 ? `，${failCount} 个失败` : ''}`);
    } else {
      message.error('所有文件上传失败');
    }
    setUploading(false);
    setUploadProgress(null);
    fetchData();
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!kbId) return;
    try {
      await api.deleteDocument(kbId, docId);
      message.success('已删除');
      fetchData();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleBatchDelete = async () => {
    if (!kbId || selectedRowKeys.length === 0) return;
    setBatchChunking(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < selectedRowKeys.length; i++) {
      setBatchProgress({ current: i + 1, total: selectedRowKeys.length });
      try {
        await api.deleteDocument(kbId, selectedRowKeys[i] as string);
        ok++;
      } catch { fail++; }
    }
    message.success(`已删除 ${ok} 个文档${fail > 0 ? `，${fail} 个失败` : ''}`);
    setBatchChunking(false);
    setBatchProgress(null);
    setSelectedRowKeys([]);
    fetchData();
  };

  const handleBatchChunk = async (values: any) => {
    if (!kbId || selectedRowKeys.length === 0) return;
    setBatchChunkModalOpen(false);
    const body: any = {};
    if (values.config_id) {
      body.config_id = values.config_id;
    } else {
      body.chunk_size = values.chunk_size || 800;
      body.chunk_overlap = values.chunk_overlap || 200;
      body.separators = values.separators || '';
      if (values.strategy) body.strategy = values.strategy;
      if (values.strategy === 'structural' && values.heading_level !== undefined) {
        body.heading_level = values.heading_level;
      }
    }
    let ok = 0, fail = 0;
    for (let i = 0; i < selectedRowKeys.length; i++) {
      try {
        await api.chunkDocument(kbId, selectedRowKeys[i] as string, body);
        ok++;
      } catch { fail++; }
    }
    message.success(`${ok} 个文档分段任务已提交${fail > 0 ? `，${fail} 个失败` : ''}`);
    setSelectedRowKeys([]);
    // Mark all as processing to trigger polling
    setDocs(prev => prev.map(d => selectedRowKeys.includes(d.doc_id) ? { ...d, status: 'processing' } : d));
  };

  const handleSearch = async () => {
    if (!kbId || !query.trim()) return;
    try {
      setSearching(true);
      setSearchDone(true);
      const res = await api.search(kbId, query, {
        top_k: searchTopK,
        similarity_threshold: searchSimilarityThreshold,
        vector_weight: searchVectorWeight,
        hybrid_threshold: searchHybridThreshold,
        use_rerank: useRerank,
        search_mode: searchMode,
      });
      setResults(res.results);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const fetchChunkConfigs = useCallback(async () => {
    if (!kbId) return;
    try {
      const configs = await api.listChunkConfigs(kbId);
      setChunkConfigs(configs);
    } catch { /* ignore */ }
  }, [kbId]);

  useEffect(() => { fetchChunkConfigs(); }, [fetchChunkConfigs]);

  const openChunkModal = async (docId: string) => {
    setChunkingDocId(docId);
    setChunkModalOpen(true);
    await fetchChunkConfigs();
  };

  const handleChunk = async (values: any) => {
    if (!kbId) return;
    try {
      setChunking(true);
      const body: any = {};
      if (values.config_id) {
        body.config_id = values.config_id;
      } else {
        body.chunk_size = values.chunk_size || 800;
        body.chunk_overlap = values.chunk_overlap || 200;
        body.separators = values.separators || '';
        if (values.strategy) body.strategy = values.strategy;
        if (values.strategy === 'structural' && values.heading_level !== undefined) {
          body.heading_level = values.heading_level;
        }
      }
      await api.chunkDocument(kbId, chunkingDocId, body);
      message.success('分段任务已提交');
      setChunkModalOpen(false);
      // Mark doc as processing immediately and start polling
      setDocs(prev => prev.map(d => d.doc_id === chunkingDocId ? { ...d, status: 'processing' } : d));
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setChunking(false);
    }
  };

  const handleSaveConfig = async (values: any) => {
    if (!kbId) return;
    try {
      if (editingConfig) {
        await api.updateChunkConfig(kbId, editingConfig.id, values);
        message.success('配置已更新');
      } else {
        await api.createChunkConfig(kbId, values);
        message.success('配置已创建');
      }
      setConfigModalOpen(false);
      setEditingConfig(null);
      fetchChunkConfigs();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleSetDefault = async (configId: string) => {
    if (!kbId) return;
    try {
      await api.setDefaultChunkConfig(kbId, configId);
      fetchChunkConfigs();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!kbId) return;
    try {
      await api.deleteChunkConfig(kbId, configId);
      message.success('已删除');
      fetchChunkConfigs();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handlePreview = async (docId: string, filename: string) => {
    if (!kbId) return;
    setPreviewLoading(true);
    setPreviewFilename(filename);
    setPreviewOpen(true);
    try {
      const res = await api.previewDocument(kbId, docId);
      setPreviewContent(res.content);
    } catch (e: any) {
      message.error(e.message);
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  if (!kb) {
    return <Empty description="知识库不存在" style={{ marginTop: 80 }} />;
  }

  const totalChunks = kb.total_chunks || docs.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
  const totalVectors = kb.total_vectors || 0;
  const totalFileSize = docs.reduce((sum, d) => sum + (d.file_size || 0), 0);
  const completedDocs = docs.filter(d => d.status === 'completed').length;

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const fileTypeIcon = (fileType: string) => {
    if (fileType === 'md' || fileType === 'markdown') return <FileMarkdownOutlined style={{ color: '#722ed1' }} />;
    if (fileType === 'pdf') return <FileTextOutlined style={{ color: '#f5222d' }} />;
    if (fileType === 'csv') return <FileTextOutlined style={{ color: '#52c41a' }} />;
    if (fileType === 'json') return <FileTextOutlined style={{ color: '#fa8c16' }} />;
    return <FileTextOutlined style={{ color: '#1677ff' }} />;
  };

  const scoreColor = (score: number) => {
    if (score > 0.8) return '#52c41a';
    if (score > 0.6) return '#1677ff';
    if (score > 0.4) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ borderRadius: 6 }}
        />
        <Title level={4} style={{ margin: 0, flex: 1 }}>{kb.name}</Title>
        {kb.description && <Text type="secondary">{kb.description}</Text>}
        <Button
          icon={<MessageOutlined />}
          onClick={() => navigate(`/kb/${kbId}/chat`)}
          size="small"
          type="primary"
        >
          对话
        </Button>
        <Button
          icon={<ExportOutlined />}
          onClick={() => api.exportKb(kbId!, 'json')}
          size="small"
        >
          导出
        </Button>
      </div>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="文档数"
              value={docs.length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1677ff' }}
              suffix={`(${completedDocs} 已完成)`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="分块数"
              value={totalChunks}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="向量数"
              value={totalVectors}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="条"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="存储大小"
              value={formatSize(totalFileSize)}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Upload + Documents */}
      <Card
        title={
          <span>
            <UploadOutlined style={{ marginRight: 8 }} />
            文件上传
          </span>
        }
        size="small"
        style={{ marginBottom: 24, borderRadius: 8 }}
      >
        <Upload
          accept=".txt,.md,.pdf,.docx,.csv,.json"
          showUploadList={false}
          multiple
          beforeUpload={(file, fileList) => {
            if (fileList.indexOf(file) === 0) {
              handleBatchUpload(fileList);
            }
            return false;
          }}
          disabled={uploading}
        >
          <Button icon={<UploadOutlined />} loading={uploading} type="primary">
            {uploading
              ? `处理中 (${uploadProgress?.current}/${uploadProgress?.total})...`
              : '选择文件 (.txt / .md / .pdf / .docx / .csv / .json)'}
          </Button>
        </Upload>
        <Text type="secondary" style={{ marginLeft: 12 }}>
          支持 .txt、.md、.pdf、.docx、.csv、.json，最大 10MB
        </Text>
      </Card>

      <Card
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8 }} />
            文档列表
          </span>
        }
        extra={
          selectedRowKeys.length > 0 && !batchChunking ? (
            <Space>
              <Button
                size="small"
                type="primary"
                icon={<ScissorOutlined />}
                onClick={() => { fetchChunkConfigs(); setBatchChunkModalOpen(true); }}
              >
                批量分段 ({selectedRowKeys.length})
              </Button>
              <Popconfirm
                title={`确认删除 ${selectedRowKeys.length} 个文档？`}
                onConfirm={handleBatchDelete}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            </Space>
          ) : null
        }
        size="small"
        style={{ marginBottom: 24, borderRadius: 8 }}
      >
        {batchChunking && batchProgress && (
          <Alert
            style={{ marginBottom: 12 }}
            type="info"
            showIcon
            message={`正在处理 ${batchProgress.current}/${batchProgress.total}...`}
          />
        )}
        {docs.length === 0 ? (
          <Empty description="暂无文档，上传文件开始使用" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            dataSource={docs}
            rowKey="doc_id"
            size="small"
            pagination={false}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            columns={[
              {
                title: '文件名',
                dataIndex: 'filename',
                ellipsis: true,
                render: (name: string, record: api.DocumentInfo) => (
                  <span>
                    <span style={{ marginRight: 8 }}>{fileTypeIcon(record.file_type)}</span>
                    {record.status === 'completed' && record.chunk_count > 0 ? (
                      <Link to={`/kb/${kbId}/documents/${record.doc_id}/preview`}>{name}</Link>
                    ) : (
                      name
                    )}
                  </span>
                ),
              },
              {
                title: '类型',
                dataIndex: 'file_type',
                width: 70,
                align: 'center',
              },
              {
                title: '大小',
                dataIndex: 'file_size',
                width: 90,
                align: 'right',
                render: (size: number) => size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`,
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                align: 'center',
                render: (s: string, record: api.DocumentInfo) => {
                  if (s === 'processing') {
                    return <span style={{ color: '#fa8c16' }}><Spin size="small" /> 处理中</span>;
                  }
                  if (s === 'completed') {
                    return <Tag color="green">完成</Tag>;
                  }
                  if (s === 'failed' || s === 'parse_failed') {
                    return (
                      <Tooltip title={record.error_message || '未知错误'}>
                        <Tag color="red" style={{ cursor: 'pointer' }}>失败</Tag>
                      </Tooltip>
                    );
                  }
                  if (s === 'uploaded') {
                    return <Tag color="blue">待分段</Tag>;
                  }
                  return <Tag color="orange">{s}</Tag>;
                },
              },
              {
                title: '分块',
                dataIndex: 'chunk_count',
                width: 70,
                align: 'center',
              },
              {
                title: '进度',
                width: 120,
                align: 'center',
                render: (_: unknown, record: api.DocumentInfo) => {
                  const taskInfo = chunkProgress[record.doc_id];
                  if (record.status === 'processing' && taskInfo) {
                    return (
                      <Progress
                        percent={taskInfo.progress}
                        size="small"
                        status={taskInfo.status === 'failed' ? 'exception' : 'active'}
                        format={(p) => `${p}%`}
                      />
                    );
                  }
                  if (record.status === 'completed') {
                    return <Tag color="green">已完成</Tag>;
                  }
                  return null;
                },
              },
              {
                title: '分段策略',
                width: 160,
                align: 'center',
                render: (_: unknown, record: api.DocumentInfo) =>
                  record.chunk_size != null
                    ? <Text style={{ fontSize: 12 }}>{record.chunk_size}/{record.chunk_overlap}{record.separators ? `/${record.separators}` : ''}</Text>
                    : '—',
              },
              {
                title: '操作',
                width: 160,
                align: 'center',
                render: (_: unknown, record: api.DocumentInfo) => (
                  <Space size="small">
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(record.doc_id, record.filename)}
                      title="预览"
                    />
                    <Button
                      size="small"
                      type={record.status === 'uploaded' ? 'primary' : 'default'}
                      icon={<ScissorOutlined />}
                      onClick={() => {
                        if (record.status === 'completed' && record.chunk_count > 0) {
                          Modal.confirm({
                            title: '重新分段',
                            content: '重新分段将清除原有分块数据，确定继续？',
                            onOk: () => openChunkModal(record.doc_id),
                          });
                        } else {
                          openChunkModal(record.doc_id);
                        }
                      }}
                    >
                      分段
                    </Button>
                    <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDoc(record.doc_id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Search */}
      <Card
        title={
          <span>
            <SearchOutlined style={{ marginRight: 8 }} />
            语义搜索
          </span>
        }
        size="small"
        style={{ marginBottom: 24, borderRadius: 8 }}
      >
        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
          <Input
            placeholder="输入查询内容..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={handleSearch}
            size="large"
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={searching}
            size="large"
          >
            搜索
          </Button>
        </Space.Compact>

        {/* Collapsible search parameters */}
        <div style={{ marginBottom: 16 }}>
          <Button
            type="link"
            size="small"
            onClick={() => setSearchParamsExpanded(!searchParamsExpanded)}
            style={{ padding: 0, color: '#999' }}
          >
            {searchParamsExpanded ? '收起参数' : '搜索参数'}
          </Button>
          {searchParamsExpanded && (
            <Card size="small" style={{ marginTop: 8, background: '#fafafa' }}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>检索模式</Text>
                <Space>
                  {[
                    { value: 'vector', label: '语义搜索' },
                    { value: 'bm25', label: '关键词搜索' },
                    { value: 'hybrid', label: '混合搜索' },
                  ].map(m => (
                    <Button
                      key={m.value}
                      size="small"
                      type={searchMode === m.value ? 'primary' : 'default'}
                      onClick={() => setSearchMode(m.value)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </Space>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>启用重排序</Text>
                  <input
                    type="checkbox"
                    checked={useRerank}
                    onChange={(e) => setUseRerank(e.target.checked)}
                  />
                </Space>
              </div>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>返回数量 (top-k): {searchTopK}</Text>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={searchTopK}
                      onChange={(e) => setSearchTopK(Number(e.target.value))}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>最低相似度: {searchSimilarityThreshold.toFixed(2)}</Text>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(searchSimilarityThreshold * 100)}
                      onChange={(e) => setSearchSimilarityThreshold(Number(e.target.value) / 100)}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>向量权重: {searchVectorWeight.toFixed(2)}</Text>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(searchVectorWeight * 100)}
                      onChange={(e) => setSearchVectorWeight(Number(e.target.value) / 100)}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>混合阈值: {searchHybridThreshold.toFixed(2)}</Text>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(searchHybridThreshold * 100)}
                      onChange={(e) => setSearchHybridThreshold(Number(e.target.value) / 100)}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                </Col>
              </Row>
            </Card>
          )}
        </div>

        {searchDone && results.length === 0 && !searching && (
          <Empty description="未找到相关结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        <List
          dataSource={results}
          renderItem={(item) => (
            <List.Item style={{ padding: '12px 0' }}>
              <div style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <Space size={8}>
                    {item.metadata.filename ? (
                      <Link to={`/kb/${kbId}/documents/${item.metadata.doc_id}/preview`}>
                        <Text strong style={{ fontSize: 13 }}>{item.metadata.filename}</Text>
                      </Link>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>文档: {item.metadata.doc_id}</Text>
                    )}
                    <Tag style={{ fontSize: 11 }}>#{item.metadata.chunk_index}</Tag>
                  </Space>
                  <Tag color={item.score > 0.6 ? 'green' : item.score > 0.3 ? 'blue' : 'default'}>
                    {(item.score * 100).toFixed(1)}%
                  </Tag>
                  {item.rerank_score != null && (
                    <Tag color="purple" style={{ fontSize: 10 }}>Rerank: {(item.rerank_score * 100).toFixed(1)}%</Tag>
                  )}
                  {item.bm25_score != null && (
                    <Tag color="orange" style={{ fontSize: 10 }}>BM25</Tag>
                  )}
                </div>
                <Progress
                  percent={Math.round(item.score * 100)}
                  strokeColor={scoreColor(item.score)}
                  showInfo={false}
                  size="small"
                  style={{ marginBottom: 8 }}
                />
                <Paragraph style={{ margin: 0, color: '#333', lineHeight: 1.8 }}>{highlightText(item.content, query)}</Paragraph>
              </div>
            </List.Item>
          )}
        />
      </Card>

      {/* Chunk Configs */}
      <Card
        title={
          <span>
            <ScissorOutlined style={{ marginRight: 8 }} />
            分段策略
          </span>
        }
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => { setEditingConfig(null); setConfigModalOpen(true); }}
          >
            新建配置
          </Button>
        }
        size="small"
        style={{ marginBottom: 24, borderRadius: 8 }}
      >
        {chunkConfigs.length === 0 ? (
          <Empty description="暂无分段配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            dataSource={chunkConfigs}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: '名称', dataIndex: 'name' },
              { title: '策略', dataIndex: 'strategy', width: 90, align: 'center', render: (v: string) => v === 'structural' ? <Tag color="purple">结构化</Tag> : <Tag>固定长度</Tag> },
              { title: '大小', dataIndex: 'chunk_size', width: 70, align: 'center' },
              { title: '重叠', dataIndex: 'chunk_overlap', width: 70, align: 'center' },
              { title: '分隔符', dataIndex: 'separators', width: 100, ellipsis: true, render: (v: string) => v || '-' },
              {
                title: '默认',
                dataIndex: 'is_default',
                width: 60,
                align: 'center',
                render: (v: boolean) => v ? <Tag color="blue">默认</Tag> : '-',
              },
              {
                title: '操作',
                width: 140,
                align: 'center',
                render: (_: unknown, record: api.ChunkConfigInfo) => (
                  <Space size={4}>
                    {!record.is_default && (
                      <Button size="small" type="link" icon={<StarOutlined />} onClick={() => handleSetDefault(record.id)}>默认</Button>
                    )}
                    <Button size="small" type="link" icon={<EditOutlined />} onClick={() => { setEditingConfig(record); setConfigModalOpen(true); }} />
                    <Popconfirm title="确认删除？" onConfirm={() => handleDeleteConfig(record.id)}>
                      <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Chunk Document Modal */}
      <Modal
        title="执行分段"
        open={chunkModalOpen}
        onCancel={() => setChunkModalOpen(false)}
        footer={null}
        width={500}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleChunk} autoComplete="off" initialValues={{ strategy: 'fixed', heading_level: 0 }}>
          <Form.Item name="config_id" label="使用已保存配置">
            <Select
              allowClear
              placeholder="选择已保存的配置，或留空自定义"
              options={chunkConfigs.map(c => ({
                value: c.id,
                label: `${c.name} (${c.chunk_size}/${c.chunk_overlap}${c.strategy === 'structural' ? '/结构化' : ''})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="strategy" label="分段策略（未选择配置时生效）">
            <Select
              options={[
                { value: 'fixed', label: '固定长度' },
                { value: 'structural', label: '结构化分段（按标题/章节）' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.strategy !== cur.strategy}>
            {({ getFieldValue }) =>
              getFieldValue('strategy') === 'structural' ? (
                <Form.Item name="heading_level" label="切分层级">
                  <Select
                    options={[
                      { value: 0, label: '自动检测' },
                      { value: 1, label: 'H1（一级标题）' },
                      { value: 2, label: 'H2（二级标题）' },
                      { value: 3, label: 'H3（三级标题）' },
                      { value: 4, label: 'H4（四级标题）' },
                    ]}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item label="自定义参数（未选择配置时生效）">
            <Input.Group compact>
              <Form.Item name="chunk_size" noStyle>
                <InputNumber placeholder="大小 800" style={{ width: '33%' }} min={100} />
              </Form.Item>
              <Form.Item name="chunk_overlap" noStyle>
                <InputNumber placeholder="重叠 200" style={{ width: '33%' }} min={0} />
              </Form.Item>
              <Form.Item name="separators" noStyle>
                <Input placeholder="分隔符" style={{ width: '34%' }} />
              </Form.Item>
            </Input.Group>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setChunkModalOpen(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit" loading={chunking}>执行分段</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Chunk Config Create/Edit Modal */}
      <Modal
        title={editingConfig ? '编辑分段配置' : '新建分段配置'}
        open={configModalOpen}
        onCancel={() => { setConfigModalOpen(false); setEditingConfig(null); }}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form
          layout="vertical"
          onFinish={handleSaveConfig}
          autoComplete="off"
          initialValues={editingConfig ? {
            name: editingConfig.name,
            chunk_size: editingConfig.chunk_size,
            chunk_overlap: editingConfig.chunk_overlap,
            separators: editingConfig.separators,
            strategy: editingConfig.strategy || 'fixed',
            heading_level: editingConfig.heading_level ?? 0,
          } : { chunk_size: 800, chunk_overlap: 200, separators: '', strategy: 'fixed', heading_level: 0 }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：默认分段" />
          </Form.Item>
          <Form.Item name="strategy" label="分段策略">
            <Select
              options={[
                { value: 'fixed', label: '固定长度' },
                { value: 'structural', label: '结构化分段（按标题/章节）' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.strategy !== cur.strategy}>
            {({ getFieldValue }) =>
              getFieldValue('strategy') === 'structural' ? (
                <Form.Item name="heading_level" label="切分层级">
                  <Select
                    options={[
                      { value: 0, label: '自动检测' },
                      { value: 1, label: 'H1（一级标题）' },
                      { value: 2, label: 'H2（二级标题）' },
                      { value: 3, label: 'H3（三级标题）' },
                      { value: 4, label: 'H4（四级标题）' },
                    ]}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="chunk_size" label="分块大小">
                <InputNumber min={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="chunk_overlap" label="重叠长度">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="separators" label="自定义分隔符（逗号分隔）">
            <Input placeholder="如: \\n\\n,##" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => { setConfigModalOpen(false); setEditingConfig(null); }} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">{editingConfig ? '保存' : '创建'}</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Batch Chunk Modal */}
      <Modal
        title={`批量分段 (${selectedRowKeys.length} 个文档)`}
        open={batchChunkModalOpen}
        onCancel={() => setBatchChunkModalOpen(false)}
        footer={null}
        width={500}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleBatchChunk} autoComplete="off" initialValues={{ strategy: 'fixed', heading_level: 0 }}>
          <Form.Item name="config_id" label="使用已保存配置">
            <Select
              allowClear
              placeholder="选择已保存的配置，或留空自定义"
              options={chunkConfigs.map(c => ({
                value: c.id,
                label: `${c.name} (${c.chunk_size}/${c.chunk_overlap}${c.strategy === 'structural' ? '/结构化' : ''})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="strategy" label="分段策略（未选择配置时生效）">
            <Select
              options={[
                { value: 'fixed', label: '固定长度' },
                { value: 'structural', label: '结构化分段（按标题/章节）' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.strategy !== cur.strategy}>
            {({ getFieldValue }) =>
              getFieldValue('strategy') === 'structural' ? (
                <Form.Item name="heading_level" label="切分层级">
                  <Select
                    options={[
                      { value: 0, label: '自动检测' },
                      { value: 1, label: 'H1（一级标题）' },
                      { value: 2, label: 'H2（二级标题）' },
                      { value: 3, label: 'H3（三级标题）' },
                      { value: 4, label: 'H4（四级标题）' },
                    ]}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item label="自定义参数（未选择配置时生效）">
            <Input.Group compact>
              <Form.Item name="chunk_size" noStyle>
                <InputNumber placeholder="大小 800" style={{ width: '33%' }} min={100} />
              </Form.Item>
              <Form.Item name="chunk_overlap" noStyle>
                <InputNumber placeholder="重叠 200" style={{ width: '33%' }} min={0} />
              </Form.Item>
              <Form.Item name="separators" noStyle>
                <Input placeholder="分隔符" style={{ width: '34%' }} />
              </Form.Item>
            </Input.Group>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setBatchChunkModalOpen(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">执行分段</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        title={`预览: ${previewFilename}`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={800}
      >
        {previewLoading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : (
          <pre style={{
            maxHeight: 600,
            overflow: 'auto',
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {previewContent}
          </pre>
        )}
      </Modal>
    </div>
  );
}
