import { useCallback, useEffect, useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, Popconfirm, Card, Descriptions, message, Typography,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined, SafetyCertificateOutlined, KeyOutlined, CopyOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'mlx', label: 'MLX' },
  { value: 'llama_cpp', label: 'LlamaCpp' },
];

const MODEL_TYPE_LABELS: Record<string, string> = {
  llm: 'LLM 模型',
  embedding: 'Embedding 模型',
  rerank: 'Rerank 模型',
};

function ModelSection({ type }: { type: 'llm' | 'embedding' | 'rerank' }) {
  const [configs, setConfigs] = useState<api.ModelConfigInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<api.ModelConfigInfo | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Default embedding model (only for embedding type)
  const [defaultModel, setDefaultModel] = useState<{ provider: string; model_name: string; base_url: string } | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listModels(type);
      setConfigs(data);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchConfigs();
    if (type === 'embedding') {
      api.getDefaultEmbedding().then(setDefaultModel).catch(() => {});
    }
  }, [fetchConfigs, type]);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await api.updateModel(editing.id, values);
        message.success('已更新');
      } else {
        await api.createModel({ ...values, model_type: type });
        message.success('已创建');
      }
      setModalOpen(false);
      setEditing(null);
      fetchConfigs();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await api.activateModel(id);
      message.success('已设为活跃');
      fetchConfigs();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteModel(id);
      message.success('已删除');
      fetchConfigs();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleTest = async (record: api.ModelConfigInfo) => {
    setTesting(record.id);
    setTestResult(null);
    try {
      const result = await api.testModel({
        model_type: type,
        provider: record.provider,
        model_name: record.model_name,
        base_url: record.base_url,
        api_key: record.api_key,
      });
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTesting(null);
    }
  };

  return (
    <Card
      title={MODEL_TYPE_LABELS[type]}
      size="small"
      style={{ marginBottom: 24, borderRadius: 8 }}
      extra={
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >
          新增
        </Button>
      }
    >
      {/* Default embedding model info */}
      {type === 'embedding' && defaultModel && (
        <Descriptions
          size="small"
          bordered
          column={3}
          style={{ marginBottom: 16 }}
          title={
            <span>
              <SafetyCertificateOutlined style={{ marginRight: 6, color: '#1677ff' }} />
              系统默认
            </span>
          }
        >
          <Descriptions.Item label="Provider">{defaultModel.provider}</Descriptions.Item>
          <Descriptions.Item label="模型名称">{defaultModel.model_name}</Descriptions.Item>
          <Descriptions.Item label="Base URL">{defaultModel.base_url || '-'}</Descriptions.Item>
        </Descriptions>
      )}

      <Table
        dataSource={configs}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={false}
        columns={[
          { title: 'Provider', dataIndex: 'provider', width: 100 },
          { title: '模型名称', dataIndex: 'model_name', ellipsis: true },
          { title: 'Base URL', dataIndex: 'base_url', ellipsis: true, render: (v: string) => v || '-' },
          {
            title: '状态',
            dataIndex: 'is_active',
            width: 80,
            align: 'center',
            render: (v: boolean) => v ? <Tag color="green">活跃</Tag> : <Tag>未激活</Tag>,
          },
          {
            title: '操作',
            width: 240,
            align: 'center',
            render: (_: unknown, record: api.ModelConfigInfo) => (
              <Space size={4}>
                {!record.is_active && (
                  <Button size="small" type="link" onClick={() => handleActivate(record.id)}>激活</Button>
                )}
                <Button
                  size="small"
                  type="link"
                  icon={<ThunderboltOutlined />}
                  loading={testing === record.id}
                  onClick={() => handleTest(record)}
                >
                  测试
                </Button>
                <Button
                  size="small"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => { setEditing(record); setModalOpen(true); }}
                />
                <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
                  <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {testResult && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 6,
          background: testResult.success ? '#f6ffed' : '#fff2f0',
          border: `1px solid ${testResult.success ? '#b7eb8f' : '#ffccc7'}`,
        }}>
          {testResult.success
            ? <><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{testResult.message}</>
            : <><CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />{testResult.message}</>
          }
        </div>
      )}

      <Modal
        title={editing ? '编辑模型' : `新增 ${MODEL_TYPE_LABELS[type]}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          layout="vertical"
          onFinish={handleSave}
          initialValues={editing ? {
            provider: editing.provider,
            model_name: editing.model_name,
            base_url: editing.base_url,
            api_key: editing.api_key,
          } : {}}
        >
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Select options={PROVIDERS} placeholder="选择 Provider" />
          </Form.Item>
          <Form.Item name="model_name" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="例如: qwen2.5:7b" />
          </Form.Item>
          <Form.Item name="base_url" label="Base URL">
            <Input placeholder="默认使用内置地址" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key">
            <Input.Password placeholder="可选" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">{editing ? '保存' : '创建'}</Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function ApiKeySection() {
  const [keys, setKeys] = useState<api.ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<api.ApiKeyCreated | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listApiKeys();
      setKeys(data);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async (values: any) => {
    try {
      const created = await api.createApiKey(values.name);
      setNewKey(created);
      setCreateOpen(false);
      fetchKeys();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteApiKey(id);
      message.success('已删除');
      fetchKeys();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey.key);
      message.success('已复制到剪贴板');
    }
  };

  return (
    <Card
      title={<span><KeyOutlined style={{ marginRight: 8 }} />API Keys</span>}
      extra={
        <Button size="small" icon={<PlusOutlined />} onClick={() => { setNewKey(null); setCreateOpen(true); }}>
          创建 API Key
        </Button>
      }
      size="small"
      style={{ marginBottom: 24, borderRadius: 8 }}
    >
      {newKey && (
        <div style={{
          marginBottom: 16, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6,
        }}>
          <Typography.Text strong>新 API Key 已创建（仅显示一次）：</Typography.Text>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input value={newKey.key} readOnly size="small" style={{ fontFamily: 'monospace' }} />
            <Button size="small" icon={<CopyOutlined />} onClick={copyKey}>复制</Button>
          </div>
        </div>
      )}

      <Table
        dataSource={keys}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={false}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: 'Key', dataIndex: 'key', render: (v: string) => <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text> },
          {
            title: '状态', dataIndex: 'is_active', width: 80, align: 'center',
            render: (v: boolean) => v ? <Tag color="green">活跃</Tag> : <Tag>禁用</Tag>,
          },
          {
            title: '创建时间', dataIndex: 'created_at', width: 170,
            render: (v: string) => v ? new Date(v).toLocaleString() : '-',
          },
          {
            title: '最后使用', dataIndex: 'last_used_at', width: 170,
            render: (v: string | null) => v ? new Date(v).toLocaleString() : '未使用',
          },
          {
            title: '操作', width: 80, align: 'center',
            render: (_: unknown, record: api.ApiKeyInfo) => (
              <Popconfirm title="确认删除此 API Key？" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />

      <Modal
        title="创建 API Key"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        width={420}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleCreate} autoComplete="off">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：Dify 外部知识库" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setCreateOpen(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">创建</Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default function Manage() {
  return (
    <div>
      <ModelSection type="llm" />
      <ModelSection type="embedding" />
      <ModelSection type="rerank" />
      <ApiKeySection />
    </div>
  );
}
