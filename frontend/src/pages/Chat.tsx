import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Input, List, Card, Space, Spin, Empty, Typography, message, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, SendOutlined,
} from '@ant-design/icons';
import * as api from '../api';

const { Text } = Typography;

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: any[];
  loading?: boolean;
}

export default function Chat() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<api.ChatSessionInfo[]>([]);
  const [activeSession, setActiveSession] = useState<api.ChatSessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!kbId) return;
    try {
      const data = await api.listChatSessions(kbId);
      setSessions(data);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const loadMessages = async (sessionId: string) => {
    try {
      const msgs = await api.getChatMessages(sessionId);
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
    if (!kbId) return;
    try {
      const session = await api.createChatSession(kbId);
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleSelectSession = async (session: api.ChatSessionInfo) => {
    setActiveSession(session);
    await loadMessages(session.id);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession || sending) return;

    const userMsg = input.trim();
    setInput('');
    setSending(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    // Add placeholder for assistant
    setMessages(prev => [...prev, { role: 'assistant', content: '', loading: true }]);

    try {
      await api.streamChatMessage(
        activeSession.id,
        userMsg,
        { top_k: 5, similarity_threshold: 0.3 },
        // onToken
        (token) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + token,
                loading: false,
              };
            }
            return updated;
          });
        },
        // onSources
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
        // onError
        (error) => {
          message.error(error);
        },
      );

      // Update session title if it's still "New Chat"
      if (activeSession.title === 'New Chat') {
        setActiveSession(prev => prev ? { ...prev, title: userMsg.slice(0, 50) } : prev);
        setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, title: userMsg.slice(0, 50) } : s));
      }
    } catch (e: any) {
      message.error(e.message);
      // Remove the empty assistant message
      setMessages(prev => prev.filter(m => !(m.role === 'assistant' && !m.content)));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>
      {/* Left: Session list */}
      <Card
        size="small"
        style={{ width: 260, flexShrink: 0, borderRadius: 8, overflow: 'auto' }}
        title="对话列表"
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
                  <Text ellipsis style={{ fontSize: 13, display: 'block' }}>
                    {session.title}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {session.updated_at ? new Date(session.updated_at).toLocaleString() : ''}
                  </Text>
                </div>
                <Popconfirm title="删除对话？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteSession(session.id); }}>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
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
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate(-1)} />
            <span>{activeSession?.title || '请选择或创建对话'}</span>
          </Space>
        }
      >
        {!activeSession ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="点击左侧新建对话开始" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <>
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
                                {src.metadata?.filename && <Text style={{ fontSize: 11 }}>📄 {src.metadata.filename}</Text>}
                                {src.score != null && <Text style={{ fontSize: 11, marginLeft: 8 }}> ({(src.score * 100).toFixed(0)}%)</Text>}
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
