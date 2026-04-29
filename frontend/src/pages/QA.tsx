import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, Input, List, Card, Space, Spin, Empty, Typography, message, Popconfirm, Select, Tag,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SendOutlined, EditOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const { Text } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  loading?: boolean;
}

export default function QA() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<api.QaSessionInfo[]>([]);
  const [activeSession, setActiveSession] = useState<api.QaSessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<api.KbInfo[]>([]);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.listQaSessions();
      setSessions(data);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    api.listKbs().then(setKnowledgeBases).catch(() => {});
  }, [fetchSessions]);

  const loadMessages = async (sessionId: string) => {
    try {
      const msgs = await api.getQaMessages(sessionId);
      setMessages(msgs.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        sources: m.sources ? JSON.parse(m.sources) : undefined,
      })));
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleNewSession = async () => {
    try {
      const session = await api.createQaSession();
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleSelectSession = async (session: api.QaSessionInfo) => {
    setActiveSession(session);
    await loadMessages(session.id);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteQaSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleRenameSession = async (sessionId: string) => {
    if (!editTitleValue.trim()) {
      setEditingTitle(null);
      return;
    }
    try {
      const updated = await api.renameQaSession(sessionId, editTitleValue.trim());
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
      if (activeSession?.id === sessionId) {
        setActiveSession(updated);
      }
    } catch (e: any) {
      message.error(e.message);
    }
    setEditingTitle(null);
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession || sending) return;

    const userMsg = input.trim();
    setInput('');
    setSending(true);

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '', loading: true }]);

    try {
      await api.streamQaMessage(
        activeSession.id,
        userMsg,
        { kb_ids: selectedKbIds, top_k: 5, similarity_threshold: 0.3 },
        (token) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + token, loading: false };
            }
            return updated;
          });
        },
        (sources) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, sources };
            }
            return updated;
          });
        },
        (error) => { message.error(error); },
      );

      if (activeSession.title === '新对话') {
        const newTitle = userMsg.slice(0, 50);
        setActiveSession(prev => prev ? { ...prev, title: newTitle } : prev);
        setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, title: newTitle } : s));
      }
    } catch (e: any) {
      message.error(e.message);
      setMessages(prev => prev.filter(m => !(m.role === 'assistant' && !m.content)));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getKbName = (kbId: string) => knowledgeBases.find(kb => kb.kb_id === kbId)?.name || kbId;

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>
      {/* Left: Session list */}
      <Card
        size="small"
        style={{ width: 260, flexShrink: 0, borderRadius: 8, overflow: 'auto' }}
        title="问答对话"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={handleNewSession}>
            新建
          </Button>
        }
      >
        {sessions.length === 0 ? (
          <Empty description="暂无对话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background: activeSession?.id === session.id ? '#e6f4ff' : 'transparent',
                  padding: '8px 12px',
                  borderRadius: 6,
                }}
                onClick={() => handleSelectSession(session)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingTitle === session.id ? (
                    <Input
                      size="small"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onPressEnter={() => handleRenameSession(session.id)}
                      onBlur={() => handleRenameSession(session.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <Text ellipsis style={{ fontSize: 13, display: 'block' }}>
                      {session.title}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {session.updated_at ? new Date(session.updated_at).toLocaleString() : ''}
                  </Text>
                </div>
                <Space size={0}>
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTitle(session.id);
                      setEditTitleValue(session.title);
                    }}
                  />
                  <Popconfirm title="删除对话？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteSession(session.id); }}>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Right: Chat area */}
      <Card
        size="small"
        style={{ flex: 1, borderRadius: 8, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}
        title={<span>{activeSession?.title || '智能问答'}</span>}
      >
        {!activeSession ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="点击左侧新建对话开始" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <>
            {/* KB selector */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0' }}>
              <Select
                mode="multiple"
                placeholder="选择知识库（可多选，不选则直接对话）"
                value={selectedKbIds}
                onChange={setSelectedKbIds}
                style={{ width: '100%' }}
                options={knowledgeBases.map(kb => ({ label: kb.name, value: kb.kb_id }))}
                allowClear
              />
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '75%',
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                      color: msg.role === 'user' ? '#fff' : '#333',
                    }}
                  >
                    {msg.loading && !msg.content ? (
                      <Spin size="small" />
                    ) : (
                      <>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div style={{ marginTop: 8, borderTop: '1px solid #e8e8e8', paddingTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 11, color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : undefined }}>
                              引用来源 ({msg.sources.length} 条)
                            </Text>
                            {msg.sources.slice(0, 3).map((src: any, j: number) => (
                              <div key={j} style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                                {src.metadata?.filename && <span>📄 {src.metadata.filename}</span>}
                                {src.metadata?.kb_id && <Tag style={{ fontSize: 10, marginLeft: 4 }}>{getKbName(src.metadata.kb_id)}</Tag>}
                                {src.score != null && <span style={{ marginLeft: 8 }}>({(src.score * 100).toFixed(0)}%)</span>}
                                <div style={{ color: '#666', marginTop: 2 }}>{src.content?.slice(0, 80)}...</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0' }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                  size="large"
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  size="large"
                >
                  发送
                </Button>
              </Space.Compact>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
