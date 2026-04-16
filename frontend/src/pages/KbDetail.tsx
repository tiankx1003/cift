import { useCallback, useEffect, useState } from 'react';
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
  EyeOutlined,
  ScissorOutlined,
  PlusOutlined,
  EditOutlined,
  StarOutlined,
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

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<api.SearchResult[]>([]);
  const [searchDone, setSearchDone] = useState(false);

  const [chunksModalOpen, setChunksModalOpen] = useState(false);
  const [chunksData, setChunksData] = useState<api.ChunksResponse | null>(null);
  const [chunksLoading, setChunksLoading] = useState(false);

  const [chunkModalOpen, setChunkModalOpen] = useState(false);
  const [chunkingDocId, setChunkingDocId] = useState<string>('');
  const [chunking, setChunking] = useState(false);
  const [chunkConfigs, setChunkConfigs] = useState<api.ChunkConfigInfo[]>([]);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<api.ChunkConfigInfo | null>(null);

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

  const handleUpload = async (file: File) => {
    if (!kbId) return false;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'md', 'pdf', 'docx'].includes(ext || '')) {
      message.error('仅支持 .txt、.md、.pdf、.docx 文件');
      return false;
    }
    try {
      setUploading(true);
      const res = await api.uploadFile(kbId, file);
      if (res.status === 'completed') {
        message.success(`上传成功，生成 ${res.chunk_count} 个分块`);
      } else {
        message.error(`处理失败: ${res.error_message}`);
      }
      fetchData();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setUploading(false);
    }
    return false;
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

  const handleSearch = async () => {
    if (!kbId || !query.trim()) return;
    try {
      setSearching(true);
      setSearchDone(true);
      const res = await api.search(kbId, query);
      setResults(res.results);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleViewChunks = async (docId: string) => {
    if (!kbId) return;
    try {
      setChunksLoading(true);
      setChunksModalOpen(true);
      const res = await api.getDocumentChunks(kbId, docId);
      setChunksData(res);
    } catch (e: any) {
      message.error(e.message);
      setChunksModalOpen(false);
    } finally {
      setChunksLoading(false);
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
      }
      const res = await api.chunkDocument(kbId, chunkingDocId, body);
      if (res.status === 'completed') {
        message.success(`分段完成，生成 ${res.chunk_count} 个分块`);
      } else {
        message.error(`分段失败`);
      }
      setChunkModalOpen(false);
      fetchData();
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

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  if (!kb) {
    return <Empty description="知识库不存在" style={{ marginTop: 80 }} />;
  }

  const totalChunks = docs.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
  const completedDocs = docs.filter(d => d.status === 'completed').length;

  const fileTypeIcon = (fileType: string) => {
    if (fileType === 'md' || fileType === 'markdown') return <FileMarkdownOutlined style={{ color: '#722ed1' }} />;
    if (fileType === 'pdf') return <FileTextOutlined style={{ color: '#f5222d' }} />;
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
      </div>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
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
        <Col xs={24} sm={8}>
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
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="向量数"
              value={kb.doc_count}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="条"
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
          accept=".txt,.md,.pdf,.docx"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading}
        >
          <Button icon={<UploadOutlined />} loading={uploading} type="primary">
            {uploading ? '处理中...' : '选择文件 (.txt / .md / .pdf / .docx)'}
          </Button>
        </Upload>
        <Text type="secondary" style={{ marginLeft: 12 }}>
          支持 .txt、.md、.pdf、.docx，最大 10MB
        </Text>
      </Card>

      <Card
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8 }} />
            文档列表
          </span>
        }
        size="small"
        style={{ marginBottom: 24, borderRadius: 8 }}
      >
        {docs.length === 0 ? (
          <Empty description="暂无文档，上传文件开始使用" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            dataSource={docs}
            rowKey="doc_id"
            size="small"
            pagination={false}
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
                width: 80,
                align: 'center',
                render: (s: string) => (
                  <Tag color={s === 'completed' ? 'green' : s === 'failed' || s === 'parse_failed' ? 'red' : s === 'uploaded' ? 'blue' : 'orange'}>
                    {s === 'completed' ? '完成' : s === 'failed' || s === 'parse_failed' ? '失败' : s === 'uploaded' ? '待分段' : '处理中'}
                  </Tag>
                ),
              },
              {
                title: '分块',
                dataIndex: 'chunk_count',
                width: 70,
                align: 'center',
              },
              {
                title: '操作',
                width: 120,
                align: 'center',
                render: (_: unknown, record: api.DocumentInfo) => (
                  <Space size="small">
                    {record.status === 'uploaded' && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<ScissorOutlined />}
                        onClick={() => openChunkModal(record.doc_id)}
                      >
                        分段
                      </Button>
                    )}
                    {record.status === 'completed' && record.chunk_count > 0 && (
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewChunks(record.doc_id)}
                      >
                        分块
                      </Button>
                    )}
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
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
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
                    marginBottom: 8,
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    文档: {item.metadata.doc_id} | 分块 #{item.metadata.chunk_index}
                  </Text>
                  <Tag color={item.score > 0.6 ? 'green' : item.score > 0.3 ? 'blue' : 'default'}>
                    {(item.score * 100).toFixed(1)}%
                  </Tag>
                </div>
                <Progress
                  percent={Math.round(item.score * 100)}
                  strokeColor={scoreColor(item.score)}
                  showInfo={false}
                  size="small"
                  style={{ marginBottom: 8 }}
                />
                <Paragraph style={{ margin: 0, color: '#333' }}>{highlightText(item.content, query)}</Paragraph>
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
        <Form layout="vertical" onFinish={handleChunk} autoComplete="off">
          <Form.Item name="config_id" label="使用已保存配置">
            <Select
              allowClear
              placeholder="选择已保存的配置，或留空自定义"
              options={chunkConfigs.map(c => ({
                value: c.id,
                label: `${c.name} (${c.chunk_size}/${c.chunk_overlap})`,
              }))}
            />
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
          } : { chunk_size: 800, chunk_overlap: 200, separators: '' }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：默认分段" />
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

      {/* Chunks Modal */}
      <Modal
        title={chunksData ? `${chunksData.filename} — 分块详情` : '分块详情'}
        open={chunksModalOpen}
        onCancel={() => { setChunksModalOpen(false); setChunksData(null); }}
        footer={null}
        width={700}
      >
        {chunksLoading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : chunksData ? (
          chunksData.chunks.length === 0 ? (
            <Empty description="暂无分块数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {chunksData.chunks.map((chunk) => (
                <Card
                  key={chunk.chunk_index}
                  size="small"
                  style={{ marginBottom: 12, borderRadius: 6 }}
                  title={
                    <span>
                      分块 #{chunk.chunk_index}
                      <Tag style={{ marginLeft: 8 }}>{chunk.char_count} 字符</Tag>
                    </span>
                  }
                >
                  <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                  }}>
                    {chunk.content}
                  </pre>
                </Card>
              ))}
            </div>
          )
        ) : null}
      </Modal>
    </div>
  );
}
