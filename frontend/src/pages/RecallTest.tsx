import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Button, Input, InputNumber, Card, Space, Spin, Empty, Typography, Tag, Progress, List, Pagination, Radio, Switch, Slider, message,
} from 'antd';
import { SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import * as api from '../api';

const { Text, Paragraph } = Typography;

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
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <mark key={idx} style={{ background: '#fff3b0', padding: '0 2px', borderRadius: 2 }}>
        {text.slice(idx, idx + trimmed.length)}
      </mark>
    );
    lastIndex = idx + trimmed.length;
    searchFrom = lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? <>{parts}</> : text;
}

const scoreColor = (score: number) => {
  if (score > 0.8) return '#52c41a';
  if (score > 0.6) return '#1677ff';
  if (score > 0.4) return '#faad14';
  return '#ff4d4f';
};

export default function RecallTest() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<api.SearchResult[]>([]);
  const [searchDone, setSearchDone] = useState(false);

  // Parameters
  const [searchMode, setSearchMode] = useState<string>('vector');
  const [useRerank, setUseRerank] = useState(false);
  const [topK, setTopK] = useState(10);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [vectorWeight, setVectorWeight] = useState(0.7);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const handleSearch = async () => {
    if (!kbId || !query.trim()) return;
    try {
      setSearching(true);
      setSearchDone(true);
      setPage(1);
      const res = await api.search(kbId, query, {
        top_k: topK,
        similarity_threshold: similarityThreshold,
        vector_weight: vectorWeight,
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

  const pagedResults = results.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>
      {/* Left: Search input + parameters */}
      <Card
        size="small"
        style={{ width: 320, flexShrink: 0, borderRadius: 8, overflow: 'auto' }}
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate(-1)} style={{ borderRadius: 6 }} />
            <SearchOutlined />
            召回测试
          </Space>
        }
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
          />
        </Space.Compact>

        {/* Parameters - always visible */}
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>检索模式</Text>
          <Radio.Group
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
            options={[
              { value: 'vector', label: '语义' },
              { value: 'bm25', label: '关键词' },
              { value: 'hybrid', label: '混合' },
            ]}
            style={{ marginBottom: 12 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>启用重排序</Text>
            <Switch size="small" checked={useRerank} onChange={setUseRerank} />
          </Space>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>返回数量 (top-k)</Text>
          <InputNumber min={1} max={50} value={topK} onChange={(v) => v && setTopK(v)} style={{ width: 80 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>最低相似度</Text>
            <InputNumber min={0} max={1} step={0.01} value={similarityThreshold} onChange={(v) => v !== null && setSimilarityThreshold(v)} style={{ width: 80 }} size="small" />
          </div>
          <Slider min={0} max={100} step={1} value={Math.round(similarityThreshold * 100)} onChange={(v) => setSimilarityThreshold(v / 100)} />
        </div>

        {searchMode === 'hybrid' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>向量权重</Text>
              <InputNumber min={0} max={1} step={0.01} value={vectorWeight} onChange={(v) => v !== null && setVectorWeight(v)} style={{ width: 80 }} size="small" />
            </div>
            <Slider min={0} max={100} step={1} value={Math.round(vectorWeight * 100)} onChange={(v) => setVectorWeight(v / 100)} />
          </div>
        )}

        {searchDone && results.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {results.length} 条结果
          </Text>
        )}
      </Card>

      {/* Right: Results */}
      <Card
        size="small"
        style={{ flex: 1, borderRadius: 8, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {searching && results.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin size="large" tip="搜索中..." />
          </div>
        ) : !searchDone ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="输入查询内容开始召回测试" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : results.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="未找到相关结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <List
                dataSource={pagedResults}
                renderItem={(item) => (
                  <List.Item style={{ padding: '12px 0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
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
                        <Space size={4}>
                          {searchMode === 'hybrid' ? (
                            <>
                              <Tag color={item.score > 0.6 ? 'green' : item.score > 0.3 ? 'blue' : 'default'}>
                                混合 {(item.score * 100).toFixed(1)}%
                              </Tag>
                              <Tag color="blue" style={{ fontSize: 10 }}>
                                语义 {item.vector_score != null ? `${(item.vector_score * 100).toFixed(1)}%` : '-'}
                              </Tag>
                              <Tag color="orange" style={{ fontSize: 10 }}>
                                关键词 {item.bm25_score != null ? `${(item.bm25_score * 100).toFixed(1)}%` : '-'}
                              </Tag>
                            </>
                          ) : (
                            <Tag color={item.score > 0.6 ? 'green' : item.score > 0.3 ? 'blue' : 'default'}>
                              {(item.score * 100).toFixed(1)}%
                            </Tag>
                          )}
                          {item.rerank_score != null && (
                            <Tag color="purple" style={{ fontSize: 10 }}>Rerank: {(item.rerank_score * 100).toFixed(1)}%</Tag>
                          )}
                        </Space>
                      </div>
                      <Progress
                        percent={Math.round(item.score * 100)}
                        strokeColor={scoreColor(item.score)}
                        showInfo={false}
                        size="small"
                        style={{ marginBottom: 8 }}
                      />
                      <Paragraph style={{ margin: 0, color: '#333', lineHeight: 1.8 }}>
                        {highlightText(item.content, query)}
                      </Paragraph>
                    </div>
                  </List.Item>
                )}
              />
            </div>
            {results.length > pageSize && (
              <div style={{ textAlign: 'center', padding: '16px 0 0' }}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={results.length}
                  onChange={(p) => setPage(p)}
                  showSizeChanger={false}
                  size="small"
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
