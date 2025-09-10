// ChatInterface Component - Modern AI Chat Experience
//
// This component provides the main chat interface for the Clarticle system,
// implementing a modern ChatGPT/Claude-style conversation experience with advanced
// animations, markdown rendering, and seamless integration with the backend services.
//
// KEY FEATURES & CAPABILITIES:
// 1. Modern Chat UI: Avatar-based design matching leading AI applications (ChatGPT, Claude)
// 2. Advanced Animations: Framer Motion integration with smooth micro-interactions
// 3. Markdown Rendering: Full ReactMarkdown support for rich AI responses  
// 4. State Persistence: Messages persist across tab navigation via props-based state management
// 5. Intelligent Input: Auto-resizing textarea with large text support (120px-400px)
// 6. Error Handling: Complete integration with standardized error system
// 7. Copy Functionality: One-click copy of AI responses with visual feedback
// 8. Performance Optimized: Efficient re-renders and scroll management
//
// CHAT EXPERIENCE DESIGN:
// - Welcome Screen: Animated bot avatar with gentle rocking motion when empty
// - Message Layout: Clean avatar-based messages without chat bubbles
// - Professional Styling: shadcn/ui components with Tailwind CSS
// - Responsive Design: Mobile-first approach with proper breakpoints
// - Loading States: Sophisticated loading animations for processing feedback
// - Auto-scroll: Automatic scrolling to new messages for natural flow
//
// TECHNICAL ARCHITECTURE:
// - Props-based State: Messages managed by parent App component for persistence
// - API Integration: Direct communication with Go backend via chatApi
// - Error Mapping: Maps backend error codes to user-friendly messages
// - Animation System: Comprehensive Framer Motion integration for smooth UX
// - Accessibility: Full keyboard navigation and screen reader support
//
// PERFORMANCE OPTIMIZATIONS:
// - Textarea Auto-resize: Intelligent height management for large text input
// - Message Animations: Optimized AnimatePresence for smooth message transitions  
// - Copy Operations: Efficient clipboard API with timeout-based feedback
// - Scroll Management: Smart auto-scroll with scroll area optimization
//
// INTEGRATION WITH BACKEND:
// - Real-time Communication: Axios-based HTTP requests to Go backend API
// - Conversation Continuity: Conversation ID management for session context
// - Cache Indicators: Visual feedback when responses served from Redis cache
// - Error Resilience: Graceful handling of service unavailability
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2, Bot, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/contexts/ConversationsContext';
import { chatApi } from '@/lib/api';
import type { ApiError, ChatMessage } from '@/lib/api';
import { MessageItem } from './chat/MessageItem';
import { ChatHeader } from './chat/ChatHeader';
import { ChatInput } from './chat/ChatInput';

// ChatInterfaceProps - Simplified since conversations context handles state
interface ChatInterfaceProps {
  // Props are now optional since the conversations context manages state
  messages?: ChatMessage[];
  setMessages?: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversationId?: string;
  setConversationId?: React.Dispatch<React.SetStateAction<string | undefined>>;
}

/**
 * ChatInterface - Main chat component with modern AI chat experience
 * 
 * Implements Claude/ChatGPT-style interface with advanced features:
 * - Props-based state management for persistence across navigation
 * - Professional animations and micro-interactions
 * - Intelligent textarea auto-resizing for large content
 * - Complete error handling with user-friendly messages
 */
export function ChatInterface({ 
  messages: propMessages, 
  setMessages: propSetMessages, 
  conversationId: propConversationId, 
  setConversationId: propSetConversationId 
}: ChatInterfaceProps = {}) {
  // AUTHENTICATION STATE  
  const { user } = useAuth();
  
  // CONVERSATIONS CONTEXT
  const { 
    messages: contextMessages, 
    currentConversation, 
    createConversation,
    addMessage,
    clearCurrentConversation,
    isNearLimit,
    getRemainingMessages,
    getConversationLength
  } = useConversations();
  
  // Use context messages if available, otherwise fall back to props
  const messages = contextMessages.length > 0 ? contextMessages.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.created_at
  } as ChatMessage)) : propMessages || [];
  
  const conversationId = currentConversation?.id || propConversationId;
  
  // LOCAL STATE MANAGEMENT
  const [inputMessage, setInputMessage] = useState('');              // Current input text
  const [isLoading, setIsLoading] = useState(false);                // Chat processing state
  const [error, setError] = useState<string | null>(null);          // Error display state
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null); // Copy feedback state
  const textareaRef = useRef<HTMLTextAreaElement>(null);            // Textarea DOM reference

  // EFFECT: Auto-scroll to bottom when new messages arrive
  // Ensures users always see the latest message without manual scrolling
  useEffect(() => {
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  // EFFECT: Initialize textarea with fixed height on component mount  
  // Prevents initial flash and ensures consistent starting size
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '120px'; // Fixed initial height for consistency
    }
  }, []);

  // EFFECT: Intelligent textarea auto-resize system
  // BREAKTHROUGH FEATURE: Handles large text input (articles, long questions) gracefully
  // - Minimum height: 120px (prevents shrinking below comfortable size)
  // - Maximum height: 400px (prevents excessive growth)
  // - Smart growth: Only expands when content actually overflows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset to minimum height to accurately measure content
      textarea.style.height = '120px';
      
      const scrollHeight = textarea.scrollHeight;
      const currentHeight = textarea.clientHeight;
      
      // Only grow if content exceeds current height (prevents unnecessary resizing)
      if (scrollHeight > currentHeight) {
        const newHeight = Math.min(400, scrollHeight); // Cap at 400px maximum
        textarea.style.height = `${newHeight}px`;
      }
      // Maintains 120px minimum - no shrinking below comfortable size
    }
  }, [inputMessage]);

  /**
   * handleSendMessage - Core chat message processing function
   * 
   * ENHANCED WITH AUTHENTICATION:
   * - For authenticated users: Creates/uses persistent conversations
   * - For anonymous users: Uses session-based temporary conversations
   * - Seamless experience regardless of authentication state
   * 
   * PROCESSING PIPELINE:
   * 1. Immediate UI update (optimistic) - user message appears instantly
   * 2. Create conversation if authenticated and no conversation exists
   * 3. API call to Go backend → RAG service → Claude
   * 4. AI response integration with conversation continuity
   * 5. Error handling with user-friendly message mapping
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    // Check if conversation is at maximum length
    if (getConversationLength() >= 20) {
      setError('This conversation has reached its maximum length. Please start a new conversation to continue chatting.');
      return;
    }

    const messageToSend = inputMessage.trim();
    setInputMessage('');     // Clear input immediately
    setError(null);          // Clear any previous errors
    setIsLoading(true);      // Show loading state

    try {
      // STEP 1: Ensure we have a conversation
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        // Create a new conversation with a title based on the first message
        const title = messageToSend.length > 50 
          ? messageToSend.substring(0, 47) + '...' 
          : messageToSend;
        
        const newConversation = await createConversation(title);
        currentConversationId = newConversation.id;
      }

      // STEP 2: Add user message to context immediately (optimistic update)
      addMessage({
        conversation_id: currentConversationId,
        role: 'user',
        content: messageToSend,
        metadata: {}
      });

      // STEP 3: Send message to Go backend → RAG service → Claude API
      const response = await chatApi.sendMessage(messageToSend, currentConversationId);

      // STEP 4: Add AI response to context
      addMessage({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: response.message,
        metadata: {
          tokens_used: response.tokens_used,
          processing_time_ms: response.processing_time_ms,
          cached: response.cached,
          model: response.model
        }
      });

      // STEP 5: Cache performance monitoring
      if (response.cached) {
        console.log('Response served from cache'); // Performance indicator
      }
    } catch (err: unknown) {
      console.error('Chat error:', err);
      let errorMessage = 'Failed to send message. Please try again.';
      
      // STEP 7: Error code mapping from backend to user-friendly messages
      if (err && typeof err === 'object' && 'response' in err && (err as any).response?.data) {
        const apiError = (err as any).response.data as ApiError;
        switch (apiError.error) {
          case 'VALIDATION_ERROR':
            errorMessage = 'Message validation failed. Please check your input.';
            break;
          case 'RATE_LIMIT_EXCEEDED':
            errorMessage = 'Too many requests. Please slow down.';
            break;
          case 'SERVICE_UNAVAILABLE':
            errorMessage = 'Chat service is temporarily unavailable. Please try again later.';
            break;
          case 'MISSING_API_KEY':
            errorMessage = 'API configuration error. Please contact support.';
            break;
          default:
            errorMessage = apiError.message || errorMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus(); // Return focus for continued typing
    }
  };

  /**
   * handleKeyPress - Keyboard interaction handler
   * - Enter: Send message (standard chat behavior)
   * - Shift+Enter: New line (allows multi-line input)
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * clearChat - Reset conversation state
   * Clears current conversation and any error states for fresh start
   */
  const clearChat = () => {
    // Clear current conversation in context
    clearCurrentConversation();
    
    // Clear local states
    if (propSetMessages) propSetMessages([]);
    if (propSetConversationId) propSetConversationId(undefined);
    setError(null);
  };

  /**
   * copyToClipboard - Copy AI response with visual feedback
   * Uses modern Clipboard API with timeout-based feedback system
   */
  const copyToClipboard = async (text: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageIndex.toString());
      setTimeout(() => setCopiedMessageId(null), 2000); // 2s feedback duration
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <TooltipProvider>
      <motion.div 
        className="flex flex-col h-full w-full max-w-4xl mx-auto min-w-0"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
      {/* Header - Only visible when no conversation */}
      <AnimatePresence>
        {messages.length === 0 && (
          <ChatHeader userName={user?.full_name} onNewChat={clearChat} />
        )}
      </AnimatePresence>
      
      {/* Messages Area - Scrollable content */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
          <div className="px-4 py-4">
            <div className="space-y-6 w-full max-w-3xl mx-auto min-w-0">
              {messages.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-center text-muted-foreground py-8"
                >
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Avatar className="h-20 w-20 mx-auto mb-4">
                      <AvatarFallback className="bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-blue-900/40 dark:via-purple-900/40 dark:to-pink-900/40">
                        <Bot className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-lg font-medium text-foreground mb-2">Welcome to Clarticle!</h2>
                    <p className="text-sm">Ask me anything about the articles in the system.</p>
                    <p className="text-xs mt-2 opacity-80">Your conversations are automatically saved to your account.</p>
                    <p className="text-xs mt-1 opacity-60">Pro tip: Use the Articles tab to add new content to chat with.</p>
                  </motion.div>
                </motion.div>
              )}
              
              <AnimatePresence>
                {messages.map((message, index) => (
                  <MessageItem
                    key={index}
                    message={message}
                    index={index}
                    copiedMessageId={copiedMessageId}
                    onCopy={copyToClipboard}
                  />
                ))}
              </AnimatePresence>
              
              <AnimatePresence>
                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="group"
                  >
                    <div className="flex gap-4 w-full">
                      <motion.div 
                        className="flex-shrink-0 mt-1"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white">
                            <Sparkles className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                      <div className="flex-1 min-w-0 flex items-center">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Loader2 className="h-4 w-4" />
                          </motion.div>
                          <motion.span
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            Thinking...
                          </motion.span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Add some padding at the bottom for scroll */}
              <div className="h-4"></div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Warning Display - Near Conversation Limit */}
      <AnimatePresence>
        {isNearLimit() && !error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-shrink-0 px-6 py-2"
          >
            <Alert className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                This conversation is approaching its limit ({getRemainingMessages()} messages remaining). 
                Consider starting a new conversation soon to maintain chat quality.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-shrink-0 px-6 py-2"
          >
            <Alert variant="destructive" className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700 dark:text-red-300">{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area - Fixed at bottom */}
      <ChatInput
        inputMessage={inputMessage}
        isLoading={isLoading}
        messageCount={messages.length}
        isNearLimit={isNearLimit()}
        remainingMessages={getRemainingMessages()}
        textareaRef={textareaRef}
        onInputChange={setInputMessage}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
        onNewChat={clearChat}
      />

    </motion.div>
    </TooltipProvider>
  );
}