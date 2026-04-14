import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Table,
  Upload,
  Input,
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
} from '@ant-design/icons';
import * as api from '../api';

const { Title, Text, Paragraph } = Typography;

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
    if (ext !== 'txt' && ext !== 'md') {
      message.error('仅支持 .txt 和 .md 文件');
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
          accept=".txt,.md"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading}
        >
          <Button icon={<UploadOutlined />} loading={uploading} type="primary">
            {uploading ? '处理中...' : '选择文件 (.txt / .md)'}
          </Button>
        </Upload>
        <Text type="secondary" style={{ marginLeft: 12 }}>
          支持 .txt 和 .md，最大 10MB
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
                    {name}
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
                  <Tag color={s === 'completed' ? 'green' : s === 'failed' ? 'red' : 'blue'}>
                    {s === 'completed' ? '完成' : s === 'failed' ? '失败' : '处理中'}
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
                width: 70,
                align: 'center',
                render: (_: unknown, record: api.DocumentInfo) => (
                  <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDoc(record.doc_id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
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
        style={{ borderRadius: 8 }}
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
                <Paragraph style={{ margin: 0, color: '#333' }}>{item.content}</Paragraph>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
