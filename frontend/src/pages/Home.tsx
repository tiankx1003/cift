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
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const { Title, Text, Paragraph } = Typography;

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

  return (
    <div style={{ padding: '32px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <DatabaseOutlined /> 知识库
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新建知识库
        </Button>
      </div>

      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
      ) : kbs.length === 0 ? (
        <Empty description="暂无知识库，点击上方按钮创建" style={{ marginTop: 80 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {kbs.map((kb) => (
            <Col key={kb.kb_id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => navigate(`/kb/${kb.kb_id}`)}
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
                <Title level={5} ellipsis style={{ marginBottom: 4 }}>{kb.name}</Title>
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ minHeight: 44, marginBottom: 8 }}>
                  {kb.description || '暂无描述'}
                </Paragraph>
                <Text type="secondary">{kb.doc_count} 条向量</Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

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
