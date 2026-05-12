import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Trash2, Loader2, Sparkles } from 'lucide-react';
import api from '../../utils/api.js';
import toast from 'react-hot-toast';

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isUser ? 'bg-accent/20 border border-accent/30' : 'bg-blue-accent/20 border border-blue-accent/30'}`}>
        {isUser ? <User size={13} className="text-accent" /> : <Bot size={13} className="text-blue-accent" />}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`text-xs font-medium ${isUser ? 'text-accent' : 'text-blue-accent'}`}>
          {isUser ? 'You' : 'DevMind AI'}
        </div>
        <div className={`prose-chat text-sm text-text-primary rounded-xl px-4 py-3 max-w-full leading-relaxed ${
          isUser
            ? 'bg-accent/10 border border-accent/20 rounded-tr-sm'
            : 'bg-panel border border-border rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

export default function ChatPanel({ projectId, chatHistory, onHistoryUpdate }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setMessage('');
    setLoading(true);

    // Optimistic update
    const optimistic = [
      ...chatHistory,
      { role: 'user', content: trimmed, timestamp: new Date() },
    ];
    onHistoryUpdate(optimistic);

    try {
      const res = await api.post(`/chat/${projectId}`, { message: trimmed });
      onHistoryUpdate(res.data.chatHistory);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      onHistoryUpdate(chatHistory);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear chat history?')) return;
    try {
      await api.delete(`/chat/${projectId}`);
      onHistoryUpdate([]);
      toast.success('Chat cleared');
    } catch {
      toast.error('Failed to clear chat');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const SUGGESTIONS = [
    'Explain the main function',
    'How can I improve this code?',
    'Find potential bugs',
    'Add error handling',
  ];

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-accent/20 border border-blue-accent/30 flex items-center justify-center">
            <Sparkles size={12} className="text-blue-accent" />
          </div>
          <span className="text-sm font-semibold text-text-primary">AI Assistant</span>
        </div>
        {chatHistory.length > 0 && (
          <button onClick={handleClear} className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Clear history">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {chatHistory.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-accent/10 border border-blue-accent/20 flex items-center justify-center mb-4">
              <Bot size={22} className="text-blue-accent" />
            </div>
            <p className="text-text-primary font-medium mb-1">Ask me anything</p>
            <p className="text-text-muted text-xs mb-6">I understand your project files and can help with code</p>
            <div className="grid grid-cols-1 gap-2 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setMessage(s)}
                  className="text-xs text-left px-3 py-2.5 rounded-lg bg-panel border border-border hover:border-blue-accent/30 hover:text-blue-accent text-text-secondary transition-all duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <ChatMessage key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-accent/20 border border-blue-accent/30 flex items-center justify-center flex-shrink-0">
              <Bot size={13} className="text-blue-accent" />
            </div>
            <div className="bg-panel border border-border rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 size={13} className="animate-spin text-blue-accent" />
                <span className="text-xs">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50">
        <div className="flex items-end gap-2 bg-panel border border-border rounded-xl px-3 py-2 focus-within:border-blue-accent/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code... (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none max-h-28 leading-relaxed"
            style={{ minHeight: '20px' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || loading}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-accent/20 border border-blue-accent/30 flex items-center justify-center text-blue-accent hover:bg-blue-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-xs text-text-muted mt-1.5 text-center">Shift+Enter for new line · Enter to send</p>
      </div>
    </div>
  );
}
