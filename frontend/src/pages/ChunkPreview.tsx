import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, List, Spin, Empty, Typography, message, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import * as api from '../api';

const { Title, Text } = Typography;

export default function ChunkPreview() {
  const { kbId, docId } = useParams<{ kbId: string; docId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<api.ChunksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);

  const fetchData = useCallback(async () => {
    if (!kbId || !docId) return;
    try {
      setLoading(true);
      const res = await api.getDocumentChunks(kbId, docId);
      setData(res);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [kbId, docId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-scroll to highlighted chunk
  useEffect(() => {
    if (!data || !data.chunks[selected]) return;
    const el = document.getElementById(`chunk-highlight-${selected}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selected, data]);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  if (!data) {
    return <Empty description="文档不存在" style={{ marginTop: 80 }} />;
  }

  const currentChunk = data.chunks[selected];
  const text = data.extracted_text || '';

  // Build highlighted segments
  const renderHighlightedText = () => {
    if (!text) return <Empty description="无原文" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    if (!currentChunk || currentChunk.start_offset == null || currentChunk.end_offset == null) {
      return (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontSize: 14, lineHeight: 1.8 }}>
          {text}
        </pre>
      );
    }

    const segments: React.ReactNode[] = [];
    const start = currentChunk.start_offset!;
    const end = currentChunk.end_offset!;

    if (start > 0) {
      segments.push(
        <span key="before">{text.slice(0, start)}</span>
      );
    }
    segments.push(
      <span
        key="highlight"
        id={`chunk-highlight-${selected}`}
        style={{
          background: '#fff3b0',
          padding: '2px 0',
          borderRadius: 2,
          borderBottom: '2px solid #faad14',
        }}
      >
        {text.slice(start, end)}
      </span>
    );
    if (end < text.length) {
      segments.push(
        <span key="after">{text.slice(end)}</span>
      );
    }

    return (
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontSize: 14, lineHeight: 1.8 }}>
        {segments}
      </pre>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ borderRadius: 6 }} />
        <Title level={4} style={{ margin: 0 }}>{data.filename} — 分块对照预览</Title>
      </div>

      <div style={{ display: 'flex', gap: 16, minHeight: 'calc(100vh - 180px)' }}>
        {/* Left: Chunk List */}
        <div style={{ width: '40%', flexShrink: 0 }}>
          <Card
            size="small"
            title={`分块列表 (${data.chunks.length})`}
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: 0, maxHeight: 'calc(100vh - 240px)', overflow: 'auto' } }}
          >
            <List
              dataSource={data.chunks}
              renderItem={(chunk) => (
                <List.Item
                  onClick={() => setSelected(chunk.chunk_index)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: selected === chunk.chunk_index ? '#e6f4ff' : 'transparent',
                    borderLeft: selected === chunk.chunk_index ? '3px solid #1677ff' : '3px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 13 }}>分块 #{chunk.chunk_index}</Text>
                      <Tag>{chunk.char_count} 字符</Tag>
                    </div>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, lineHeight: 1.5 }}
                      ellipsis
                    >
                      {chunk.content.slice(0, 100)}{chunk.content.length > 100 ? '...' : ''}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </div>

        {/* Right: Original Text Preview */}
        <div style={{ flex: 1 }}>
          <Card
            size="small"
            title="原文预览"
            style={{ borderRadius: 8 }}
            styles={{ body: { maxHeight: 'calc(100vh - 240px)', overflow: 'auto', userSelect: 'none' } }}
          >
            {renderHighlightedText()}
          </Card>
        </div>
      </div>
    </div>
  );
}
