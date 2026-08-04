export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Document {
  id: number;
  name: string;
  file_type: 'pdf' | 'docx' | 'txt' | string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  status: 'uploaded' | 'indexing' | 'indexed' | 'failed';
  is_indexed: boolean;
  upload_date: string;
}

export interface DocumentStats {
  total_documents: number;
  total_chunks: number;
  total_size_bytes: number;
  indexed_documents: number;
  file_type_breakdown: Record<string, number>;
}

export interface Source {
  document_name: string;
  file_type: string;
  page_number: number;
  chunk_index: number;
  score: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  text: string;
  confidence_score?: number;
  sources?: Source[];
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface QueryLog {
  id: number;
  query_text: string;
  response_text: string;
  confidence_score?: number;
  latency_ms: number;
  timestamp: string;
  llm_provider: string;
  username: string;
}

export interface DailyQueryVolume {
  date: string;
  count: number;
}

export interface AnalyticsDashboard {
  total_queries: number;
  avg_confidence: number;
  avg_latency_ms: number;
  provider_distribution: Record<string, number>;
  daily_query_volume: DailyQueryVolume[];
}
