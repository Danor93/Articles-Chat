import axios from 'axios';

// API Base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types based on the backend API
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  id: string;
  message: string;
  conversation_id: string;
  tokens_used: number;
  processing_time_ms: number;
  model: string;
  created_at: string;
  cached?: boolean;
}

export interface ArticleRequest {
  url: string;
}

export interface ArticleResponse {
  message: string;
  cached?: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId: string;
}

// Chat API functions
export const chatApi = {
  sendMessage: async (message: string, conversationId?: string): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>('/chat', {
      message,
      conversation_id: conversationId,
    });
    return response.data;
  },
};

// Articles API functions
export const articlesApi = {
  addArticle: async (url: string): Promise<ArticleResponse> => {
    const response = await api.post<ArticleResponse>('/articles', { url });
    return response.data;
  },
};

// Health check
export const healthApi = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;