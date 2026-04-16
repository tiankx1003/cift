import { useCallback, useEffect, useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, Popconfirm, Tabs, message,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'mlx', label: 'MLX' },
  { value: 'llama_cpp', label: 'LlamaCpp' },
];

function ModelTab({ type }: { type: 'llm' | 'embedding' | 'rerank' }) {
  const [configs, setConfigs] = useState<api.ModelConfigInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<api.ModelConfigInfo | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listModels(type);
      setConfigs(data);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

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
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button
          icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >
          新增 {type === 'llm' ? 'LLM' : type === 'embedding' ? 'Embedding' : 'Rerank'} 模型
        </Button>
      </div>

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
        title={editing ? '编辑模型' : `新增 ${type === 'llm' ? 'LLM' : type === 'embedding' ? 'Embedding' : 'Rerank'} 模型`}
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
    </div>
  );
}

// Need to use api.listModels directly due to scope
function listModels(type: string) {
  return api.listModels(type);
}

export default function Manage() {
  return (
    <div>
      <Tabs
        defaultActiveKey="llm"
        items={[
          { key: 'llm', label: 'LLM 模型', children: <ModelTab type="llm" /> },
          { key: 'embedding', label: 'Embedding 模型', children: <ModelTab type="embedding" /> },
          { key: 'rerank', label: 'Rerank 模型', children: <ModelTab type="rerank" /> },
        ]}
      />
    </div>
  );
}
