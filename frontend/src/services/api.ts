import axios from 'axios';
import { 
  User, Token, Document, DocumentStats, Conversation, 
  ConversationDetail, Message, QueryLog, AnalyticsDashboard 
} from '../types';

let API_BASE_URL = 'http://localhost:8000/api';

if (typeof window !== 'undefined' && window.location) {
  const hostname = window.location.hostname;
  if (hostname.includes('onrender.com')) {
    // Dynamically align the frontend and backend using Render's account resource suffix
    const match = hostname.match(/support-ai-frontend(-[a-zA-Z0-9]+)?\.onrender\.com/);
    const suffix = match && match[1] ? match[1] : '';
    API_BASE_URL = `https://support-ai-backend${suffix}.onrender.com/api`;
  } else if ((import.meta as any).env && (import.meta as any).env.VITE_API_BASE_URL) {
    API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL;
  }
}

if (API_BASE_URL && !API_BASE_URL.endsWith('/api') && !API_BASE_URL.endsWith('/api/')) {
  API_BASE_URL = `${API_BASE_URL.replace(/\/$/, '')}/api`;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const api = {
  auth: {
    async register(payload: any): Promise<User> {
      const { data } = await apiClient.post<User>('/auth/register', payload);
      return data;
    },
    async login(payload: any): Promise<Token> {
      const { data } = await apiClient.post<Token>('/auth/login', payload);
      return data;
    },
    async getMe(): Promise<User> {
      const { data } = await apiClient.get<User>('/auth/me');
      return data;
    },
  },

  documents: {
    async list(): Promise<Document[]> {
      const { data } = await apiClient.get<Document[]>('/documents');
      return data;
    },
    async upload(file: File): Promise<Document> {
      const formData = new FormData();
      formData.append('file', file);
      
      const { data } = await apiClient.post<Document>('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    async delete(id: number): Promise<{ message: string }> {
      const { data } = await apiClient.delete<{ message: string }>(`/documents/${id}`);
      return data;
    },
    async reindex(): Promise<{ message: string; total_indexed_chunks: number }> {
      const { data } = await apiClient.post<{ message: string; total_indexed_chunks: number }>('/documents/reindex');
      return data;
    },
    async getStats(): Promise<DocumentStats> {
      const { data } = await apiClient.get<DocumentStats>('/documents/stats');
      return data;
    },
  },

  chat: {
    async listConversations(): Promise<Conversation[]> {
      const { data } = await apiClient.get<Conversation[]>('/chat/conversations');
      return data;
    },
    async createConversation(title?: string): Promise<Conversation> {
      const { data } = await apiClient.post<Conversation>('/chat/conversations', { title });
      return data;
    },
    async getConversation(id: number): Promise<ConversationDetail> {
      const { data } = await apiClient.get<ConversationDetail>(`/chat/conversations/${id}`);
      return data;
    },
    async deleteConversation(id: number): Promise<{ message: string }> {
      const { data } = await apiClient.delete<{ message: string }>(`/chat/conversations/${id}`);
      return data;
    },
    async sendMessage(conversationId: number, text: string): Promise<Message> {
      const { data } = await apiClient.post<Message>(`/chat/conversations/${conversationId}/messages`, { text });
      return data;
    },
    async clearConversation(id: number): Promise<{ message: string }> {
      const { data } = await apiClient.post<{ message: string }>(`/chat/conversations/${id}/clear`);
      return data;
    },
    async getQueryLogs(): Promise<QueryLog[]> {
      const { data } = await apiClient.get<QueryLog[]>('/chat/query-logs');
      return data;
    },
    async getAnalytics(): Promise<AnalyticsDashboard> {
      const { data } = await apiClient.get<AnalyticsDashboard>('/chat/analytics');
      return data;
    },
  },

  system: {
    async checkHealth(): Promise<any> {
      const { data } = await apiClient.get('/health');
      return data;
    },
  },
};
export default api;
