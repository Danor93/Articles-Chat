import axios from 'axios';

// API Base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authentication interceptors
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clarticle_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if the error is due to invalid/expired token
    if (error.response?.status === 401) {
      // Clear invalid token and trigger re-authentication
      localStorage.removeItem('clarticle_auth_token');
      localStorage.removeItem('clarticle_user');
      
      // Dispatch custom event to notify AuthContext
      window.dispatchEvent(new CustomEvent('auth-token-invalid'));
    }
    return Promise.reject(error);
  }
);

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

// Authentication types
export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Conversation types  
export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// Authentication API functions
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  signup: async (credentials: SignupCredentials): Promise<{ user: User; message: string }> => {
    const response = await api.post('/auth/signup', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  updateProfile: async (data: { full_name: string }): Promise<User> => {
    const response = await api.put<User>('/auth/profile', data);
    return response.data;
  },

  checkEmail: async (email: string): Promise<{ exists: boolean }> => {
    const response = await api.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
    return response.data;
  },
};

// Conversations API functions
export const conversationsApi = {
  list: async (): Promise<{ conversations: Conversation[]; pagination: any }> => {
    const response = await api.get('/conversations');
    return response.data;
  },

  create: async (data: { title?: string }): Promise<Conversation> => {
    const response = await api.post<Conversation>('/conversations', data);
    return response.data;
  },

  get: async (id: string): Promise<ConversationWithMessages> => {
    const response = await api.get<ConversationWithMessages>(`/conversations/${id}`);
    return response.data;
  },

  update: async (id: string, data: { title: string }): Promise<Conversation> => {
    const response = await api.put<Conversation>(`/conversations/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/conversations/${id}`);
  },

  getMessages: async (id: string, limit?: number, offset?: number): Promise<{ messages: Message[]; pagination: any }> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const response = await api.get(`/conversations/${id}/messages?${params}`);
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