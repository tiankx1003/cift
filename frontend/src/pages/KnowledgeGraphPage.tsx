import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, Select, Card, Table, Tag, Space, Popconfirm, Empty, Spin, message, Typography,
} from 'antd';
import {
  ApartmentOutlined, PlusOutlined, DeleteOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const { Title, Text } = Typography;

const TYPE_COLORS: Record<string, string> = {
  '人物': '#1677ff',
  '组织': '#52c41a',
  '地点': '#fa8c16',
  '概念': '#722ed1',
  '事件': '#f5222d',
  '产品': '#13c2c2',
};

export default function KnowledgeGraphPage() {
  const [kbs, setKbs] = useState<api.KbInfo[]>([]);
  const [selectedKb, setSelectedKb] = useState<string>('');
  const [graphs, setGraphs] = useState<api.GraphInfo[]>([]);
  const [activeGraph, setActiveGraph] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.listKbs().then(setKbs).catch(() => {});
  }, []);

  const fetchGraphs = useCallback(async (kbId: string) => {
    if (!kbId) return;
    try {
      const data = await api.listKnowledgeGraphs(kbId);
      setGraphs(data);
      // Auto-load latest completed graph
      const completed = data.find((g: api.GraphInfo) => g.status === 'completed');
      if (completed) {
        const detail = await api.getKnowledgeGraph(kbId, completed.id);
        setActiveGraph(detail);
      } else {
        setActiveGraph(null);
      }
    } catch (e: any) {
      message.error(e.message);
    }
  }, []);

  useEffect(() => {
    if (selectedKb) fetchGraphs(selectedKb);
    else { setGraphs([]); setActiveGraph(null); }
  }, [selectedKb, fetchGraphs]);

  const handleCreate = async () => {
    if (!selectedKb) return;
    try {
      setBuilding(true);
      await api.createKnowledgeGraph(selectedKb);
      message.info('图谱构建已开始，请稍候...');

      // Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const data = await api.listKnowledgeGraphs(selectedKb);
          setGraphs(data);
          const latest = data[0];
          if (latest && (latest.status === 'completed' || latest.status === 'failed')) {
            if (pollRef.current) clearInterval(pollRef.current);
            setBuilding(false);
            if (latest.status === 'completed') {
              const detail = await api.getKnowledgeGraph(selectedKb, latest.id);
              setActiveGraph(detail);
              message.success('图谱构建完成');
            } else {
              message.error(`构建失败: ${latest.error_message}`);
            }
          }
        } catch { /* continue polling */ }
      }, 3000);
    } catch (e: any) {
      message.error(e.message);
      setBuilding(false);
    }
  };

  const handleViewGraph = async (graphId: string) => {
    if (!selectedKb) return;
    try {
      setLoading(true);
      const detail = await api.getKnowledgeGraph(selectedKb, graphId);
      setActiveGraph(detail);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (graphId: string) => {
    if (!selectedKb) return;
    try {
      await api.deleteKnowledgeGraph(selectedKb, graphId);
      message.success('已删除');
      fetchGraphs(selectedKb);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // Simple graph visualization using SVG (since @ant-design/graphs may have compatibility issues)
  const renderGraph = () => {
    if (!activeGraph?.graph_data) return <Empty description="无图谱数据" />;
    const { nodes, edges } = activeGraph.graph_data;
    if (!nodes || nodes.length === 0) return <Empty description="无实体节点" />;

    const width = 800;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 60;

    // Position nodes in a circle
    const nodePositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node: any, i: number) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      nodePositions[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    return (
      <div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              <Text style={{ fontSize: 12 }}>{type}</Text>
            </span>
          ))}
        </div>

        <svg width={width} height={height} style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
          {/* Edges */}
          {edges?.map((edge: any, i: number) => {
            const src = nodePositions[edge.source];
            const tgt = nodePositions[edge.target];
            if (!src || !tgt) return null;
            return (
              <g key={`e-${i}`}>
                <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="#d9d9d9" strokeWidth={1} />
                <text
                  x={(src.x + tgt.x) / 2}
                  y={(src.y + tgt.y) / 2}
                  textAnchor="middle"
                  fill="#8c8c8c"
                  fontSize={10}
                >
                  {edge.label.length > 6 ? edge.label.slice(0, 6) + '...' : edge.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node: any) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const color = TYPE_COLORS[node.type] || '#1677ff';
            return (
              <g key={node.id}>
                <circle cx={pos.x} cy={pos.y} r={8} fill={color} stroke="#fff" strokeWidth={2} />
                <text
                  x={pos.x}
                  y={pos.y - 14}
                  textAnchor="middle"
                  fill="#333"
                  fontSize={11}
                  fontWeight={500}
                >
                  {node.name.length > 8 ? node.name.slice(0, 8) + '...' : node.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ marginTop: 8 }}>
          <Text type="secondary">{nodes.length} 个实体, {edges?.length || 0} 个关系</Text>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <ApartmentOutlined style={{ marginRight: 8 }} />
        知识图谱
      </Title>

      {/* KB selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <Text>选择知识库:</Text>
        <Select
          style={{ width: 300 }}
          placeholder="请选择知识库"
          value={selectedKb || undefined}
          onChange={setSelectedKb}
          options={kbs.map(kb => ({ value: kb.kb_id, label: kb.name }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={building}
          disabled={!selectedKb}
          onClick={handleCreate}
        >
          生成图谱
        </Button>
      </div>

      {/* Graph list */}
      {selectedKb && (
        <Card size="small" title="图谱列表" style={{ marginBottom: 24, borderRadius: 8 }}>
          {graphs.length === 0 ? (
            <Empty description="暂无图谱，点击「生成图谱」开始" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              dataSource={graphs}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: '名称', dataIndex: 'name' },
                { title: '节点', dataIndex: 'node_count', width: 70, align: 'center' },
                { title: '关系', dataIndex: 'edge_count', width: 70, align: 'center' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 80,
                  align: 'center',
                  render: (s: string) => (
                    <Tag color={s === 'completed' ? 'green' : s === 'failed' ? 'red' : 'processing'}>
                      {s === 'completed' ? '完成' : s === 'failed' ? '失败' : s === 'building' ? '构建中' : '等待中'}
                    </Tag>
                  ),
                },
                {
                  title: '操作',
                  width: 120,
                  align: 'center',
                  render: (_: unknown, record: api.GraphInfo) => (
                    <Space size={4}>
                      <Button size="small" type="link" onClick={() => handleViewGraph(record.id)}>查看</Button>
                      <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}

      {/* Graph visualization */}
      {activeGraph && (
        <Card size="small" title={`${activeGraph.name} — 图谱可视化`} style={{ borderRadius: 8 }}>
          {loading ? <Spin /> : renderGraph()}
        </Card>
      )}
    </div>
  );
}
