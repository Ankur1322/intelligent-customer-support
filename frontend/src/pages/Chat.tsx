import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  MessageSquare, Send, Trash2, ShieldAlert, Sparkles, Copy, Check, RotateCcw, Search, Compass, Clock
} from 'lucide-react';
import { Conversation, Message } from '../types';

export const Chat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveTabConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const suggestedQuestions = [
    "What is the company refund policy?",
    "How do I reset my password?",
    "What are our official working hours?",
    "Where is the technical support contact info?"
  ];

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConvId !== null) {
      fetchMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendingMessage]);

  const fetchConversations = async () => {
    try {
      const data = await api.chat.listConversations();
      setConversations(data);
      if (data.length > 0 && activeConvId === null) {
        setActiveTabConvId(data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load conversations:", err);
    }
  };

  const fetchMessages = async (id: number) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const data = await api.chat.getConversation(id);
      setMessages(data.messages);
    } catch (err: any) {
      setError("Failed to load message logs.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateChat = async (title?: string) => {
    try {
      const newConv = await api.chat.createConversation(title || "New Chat");
      setConversations([newConv, ...conversations]);
      setActiveTabConvId(newConv.id);
    } catch (err) {
      setError("Could not create a new conversation thread.");
    }
  };

  const handleDeleteChat = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.chat.deleteConversation(id);
      const filtered = conversations.filter(c => c.id !== id);
      setConversations(filtered);
      if (activeConvId === id) {
        setActiveTabConvId(filtered.length > 0 ? filtered[0].id : null);
      }
    } catch (err) {
      setError("Failed to delete conversation.");
    }
  };

  const handleClearHistory = async () => {
    if (activeConvId === null) return;
    try {
      await api.chat.clearConversation(activeConvId);
      setMessages([]);
    } catch (err) {
      setError("Failed to clear chat history.");
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || activeConvId === null || sendingMessage) return;
    setError(null);
    setInputText('');
    setSendingMessage(true);

    const temporaryUserMsg: Message = {
      id: Date.now(),
      conversation_id: activeConvId,
      role: 'user',
      text: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, temporaryUserMsg]);

    try {
      await api.chat.sendMessage(activeConvId, text);
      setConversations(prev => prev.map(c => {
        if (c.id === activeConvId && c.title === "New Chat") {
          return { ...c, title: text.substring(0, 40) + (text.length > 40 ? "..." : "") };
        }
        return c;
      }));
      fetchMessages(activeConvId);
    } catch (err: any) {
      setError(err.response?.data?.detail || "AI Assistant failed to generate answer.");
    } finally {
      setSendingMessage(false);
    }
  };

  const copyToClipboard = (text: string, msgId: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getConfidenceLevel = (score?: number) => {
    if (score === undefined || score === null) return { text: 'N/A', css: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' };
    if (score >= 0.70) return { text: 'High Match', css: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' };
    if (score >= 0.40) return { text: 'Moderate Match', css: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' };
    return { text: 'Low Match', css: 'bg-rose-100 text-red-800 dark:bg-rose-950/40 dark:text-red-400' };
  };

  const renderMessageText = (text: string) => {
    if (text.includes("```")) {
      const parts = text.split("```");
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          const lines = part.split("\n");
          const language = lines[0] || 'text';
          const code = lines.slice(1).join("\n");
          return (
            <pre key={index} className="my-3 p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
              <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-800 pb-2">
                <span>{language}</span>
                <span>Code block</span>
              </div>
              <code>{code}</code>
            </pre>
          );
        }
        return <p key={index} className="whitespace-pre-line leading-relaxed">{part}</p>;
      });
    }
    return <p className="whitespace-pre-line leading-relaxed">{text}</p>;
  };

  return (
    <div className="flex flex-col lg:flex-row h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      
      {/* Chats List Sidebar Panel */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col h-64 lg:h-full bg-slate-50/50 dark:bg-slate-900/30">
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Conversations</h3>
          <button 
            onClick={() => handleCreateChat()}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center space-x-1 shadow-sm transition"
          >
            <Sparkles size={14} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search previous chats..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No chats found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConvId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveTabConvId(conv.id)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-left transition-all group
                    ${isActive 
                      ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/40 border border-transparent'}
                  `}
                >
                  <MessageSquare size={16} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      {conv.title}
                    </p>
                    <span className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                      <Clock size={10} />
                      <span>{new Date(conv.updated_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(conv.id, e)}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Chat Thread"
                  >
                    <Trash2 size={13} />
                  </button>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Support Chat Interface */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/20 dark:bg-slate-900/10">
        
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shadow-2xs">
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              {activeConvId !== null 
                ? conversations.find(c => c.id === activeConvId)?.title || "Active Discussion"
                : "Select a Discussion"
              }
            </h4>
          </div>
          {activeConvId !== null && messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center space-x-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 transition"
              title="Clear discussion"
            >
              <RotateCcw size={12} />
              <span>Clear History</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-700 dark:text-red-400">
              <ShieldAlert className="shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-semibold">
                {error}
              </div>
            </div>
          )}

          {activeConvId === null ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="p-4 bg-indigo-50 dark:bg-slate-800 rounded-3xl text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                <Compass size={36} />
              </div>
              <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Chat Thread Selected</h5>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Create a new thread or select an existing conversation from the sidebar to consult with the customer assistant.
              </p>
              <button
                onClick={() => handleCreateChat()}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
              >
                Start Conversation
              </button>
            </div>
          ) : loadingHistory ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Loading chat messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center max-w-2xl mx-auto p-4">
              <div className="text-center mb-8">
                <span className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400 inline-block mb-3">
                  <Sparkles size={24} />
                </span>
                <h5 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">Intelligent Knowledge Consult</h5>
                <p className="text-xs text-slate-400 mt-1">
                  Ask any question about indexed company documents. The assistant will answer using verified material only.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-xs text-left hover:border-indigo-500 hover:bg-indigo-50/20 hover:text-indigo-600 transition duration-150 shadow-2xs"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const confidence = getConfidenceLevel(msg.confidence_score);
                
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                      max-w-[85%] rounded-2xl px-5 py-4 shadow-3xs border
                      ${isUser 
                        ? 'bg-indigo-600 border-indigo-700 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'}
                    `}>
                      
                      {!isUser && (
                        <div className="flex items-center justify-between mb-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                          <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full ${confidence.css}`}>
                            {confidence.text} {msg.confidence_score !== undefined && `(${Math.round(msg.confidence_score * 100)}%)`}
                          </span>
                          
                          <button
                            onClick={() => copyToClipboard(msg.text, msg.id)}
                            className="p-1 text-slate-400 hover:text-indigo-500 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                            title="Copy reply text"
                          >
                            {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}

                      <div className="text-xs leading-relaxed">
                        {renderMessageText(msg.text)}
                      </div>



                    </div>
                  </div>
                );
              })}

              {sendingMessage && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none px-5 py-4 shadow-3xs flex items-center space-x-1.5">
                    <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {activeConvId !== null && (
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="max-w-4xl mx-auto flex items-center space-x-2.5"
            >
              <input
                type="text"
                required
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask support assistant about refund guidelines, operations manual, pricing..."
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 transition"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sendingMessage}
                className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition disabled:opacity-50"
                title="Send query"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
export default Chat;
