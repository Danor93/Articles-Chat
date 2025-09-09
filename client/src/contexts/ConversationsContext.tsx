import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { conversationsApi } from '../lib/api';

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
  metadata?: {
    sources?: string[];
    cached?: boolean;
    tokens_used?: number;
    processing_time_ms?: number;
    model?: string;
  };
  created_at: string;
}

interface ConversationsContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  // Conversation management
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  loadConversation: (conversationId: string) => Promise<void>;
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  
  // Message management
  addMessage: (message: Omit<Message, 'id' | 'created_at'>) => void;
  clearCurrentConversation: () => void;
  
  // UI state
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

export const useConversations = () => {
  const context = useContext(ConversationsContext);
  if (context === undefined) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return context;
};

interface ConversationsProviderProps {
  children: ReactNode;
}

export const ConversationsProvider: React.FC<ConversationsProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  // Load conversations when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    } else {
      // Clear state when user logs out
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
      setError(null);
      setDrawerOpen(false);
    }
  }, [isAuthenticated]);

  const loadConversations = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await conversationsApi.list();
      setConversations(data.conversations || []);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = async (title?: string): Promise<Conversation> => {
    if (!isAuthenticated) {
      throw new Error('Must be authenticated to create conversation');
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const conversation = await conversationsApi.create({ title });
      setConversations(prev => [conversation, ...prev]);
      setCurrentConversation(conversation);
      setMessages([]);
      
      return conversation;
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      setError('Failed to create conversation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const conversationData = await conversationsApi.get(conversationId);
      
      setCurrentConversation(conversationData);
      setMessages(conversationData.messages || []);
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    if (!isAuthenticated) return;
    
    try {
      const updatedConversation = await conversationsApi.update(conversationId, { title });
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, title: updatedConversation.title, updated_at: updatedConversation.updated_at }
            : conv
        )
      );
      
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(prev => prev ? { ...prev, title: updatedConversation.title } : null);
      }
    } catch (err: any) {
      console.error('Failed to update conversation title:', err);
      setError('Failed to update conversation title');
      throw err;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!isAuthenticated) return;
    
    try {
      await conversationsApi.delete(conversationId);
      
      // Update local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation');
      throw err;
    }
  };

  const addMessage = (message: Omit<Message, 'id' | 'created_at'>) => {
    const newMessage: Message = {
      ...message,
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Update conversation message count if we have a current conversation
    if (currentConversation) {
      setCurrentConversation(prev => 
        prev ? { ...prev, message_count: prev.message_count + 1 } : null
      );
      
      setConversations(prev => 
        prev.map(conv => 
          conv.id === currentConversation.id 
            ? { ...conv, message_count: conv.message_count + 1, updated_at: new Date().toISOString() }
            : conv
        )
      );
    }
  };

  const clearCurrentConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const value: ConversationsContextType = {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    loadConversations,
    createConversation,
    loadConversation,
    updateConversationTitle,
    deleteConversation,
    addMessage,
    clearCurrentConversation,
    isDrawerOpen,
    setDrawerOpen,
  };

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
};