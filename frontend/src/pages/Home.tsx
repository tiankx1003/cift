import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Modal,
  Row,
  Input,
  Form,
  Popconfirm,
  Typography,
  message,
  Empty,
  Spin,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const { Title, Text, Paragraph } = Typography;

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#1677ff', '#0958d9', '#13c2c2', '#722ed1',
    '#eb2f96', '#fa8c16', '#52c41a', '#2f54eb',
    '#f5222d', '#faad14', '#36cfc9', '#9254de',
    '#4096ff', '#73d13d', '#597ef7', '#69b1ff',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function Home() {
  const navigate = useNavigate();
  const [kbs, setKbs] = useState<api.KbInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchKbs = useCallback(async () => {
    try {
      setLoading(true);
      setKbs(await api.listKbs());
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKbs(); }, [fetchKbs]);

  const handleCreate = async (values: { name: string; description?: string }) => {
    try {
      setCreating(true);
      await api.createKb(values.name, values.description || '');
      message.success('知识库创建成功');
      setModalOpen(false);
      fetchKbs();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (kbId: string) => {
    try {
      await api.deleteKb(kbId);
      message.success('已删除');
      fetchKbs();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const totalVectors = kbs.reduce((sum, kb) => sum + (kb.doc_count || 0), 0);

  return (
    <div>
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="知识库总数"
              value={kbs.length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="文档总数"
              value={kbs.length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={{ borderRadius: 8 }}>
            <Statistic
              title="向量总数"
              value={totalVectors}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix="条"
            />
          </Card>
        </Col>
      </Row>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>知识库列表</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新建知识库
        </Button>
      </div>

      {/* KB Cards */}
      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
      ) : kbs.length === 0 ? (
        <Empty description="暂无知识库，点击上方按钮创建" style={{ marginTop: 80 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {kbs.map((kb) => {
            const color = stringToColor(kb.name);
            return (
              <Col key={kb.kb_id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => navigate(`/kb/${kb.kb_id}`)}
                  style={{ borderRadius: 8, overflow: 'hidden' }}
                  styles={{ body: { padding: 0 } }}
                  actions={[
                    <Popconfirm
                      key="del"
                      title="确认删除该知识库？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDelete(kb.kb_id); }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <DeleteOutlined onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>,
                  ]}
                >
                  {/* Color bar */}
                  <div
                    style={{
                      height: 6,
                      background: `linear-gradient(90deg, ${color}, ${color}88)`,
                    }}
                  />
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: `${color}18`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color,
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        <DatabaseOutlined />
                      </div>
                      <Title level={5} ellipsis style={{ margin: 0, flex: 1, minWidth: 0 }}>
                        {kb.name}
                      </Title>
                    </div>
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ minHeight: 44, marginBottom: 12, fontSize: 13 }}
                    >
                      {kb.description || '暂无描述'}
                    </Paragraph>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AppstoreOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                      <Text type="secondary" style={{ fontSize: 13 }}>{kb.doc_count} 条向量</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Create Modal */}
      <Modal
        title="新建知识库"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleCreate} autoComplete="off">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：产品文档库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalOpen(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit" loading={creating}>创建</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
