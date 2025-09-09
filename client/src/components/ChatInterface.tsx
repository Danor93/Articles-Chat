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
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Loader2, User, Bot, Copy, Check, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/contexts/ConversationsContext';
import { chatApi } from '@/lib/api';
import type { ApiError, ChatMessage } from '@/lib/api';

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
      {/* Header - Fixed at top */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50/90 via-purple-50/90 to-pink-50/90 dark:from-slate-900/90 dark:via-purple-900/30 dark:to-blue-900/30 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 min-h-[70px] border-purple-200/50 dark:border-purple-700/50"
      >
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/30 via-purple-400/30 to-pink-400/30 rounded-full blur-sm animate-pulse-subtle" />
              <Avatar className="h-10 w-10 relative">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white">
                  <Sparkles className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Clarticle Assistant</h1>
              <p className="text-xs text-muted-foreground">
                Powered by Claude AI • Logged in as {user?.full_name}
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearChat}
                  className="transition-all hover:shadow-md"
                >
                  Clear Chat
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear all messages and start a new conversation</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </motion.div>
      
      {/* Messages Area - Scrollable content */}
      <div className="flex-1 overflow-hidden">
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
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="group"
                  >
                  <div className="flex gap-4 w-full">
                    {/* Avatar */}
                    <motion.div 
                      className="flex-shrink-0 mt-1"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={message.role === 'user' 
                          ? "bg-gradient-to-br from-green-500 to-teal-500 text-white" 
                          : "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white"
                        }>
                          {message.role === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </motion.div>
                    
                    {/* Message Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Message Bubble */}
                      <div className="break-words overflow-wrap-anywhere">
                        {message.role === 'assistant' ? (
                          <div className="text-sm prose prose-sm max-w-none dark:prose-invert
                                       prose-headings:mt-4 prose-headings:mb-2 prose-headings:text-inherit
                                       prose-p:my-2 prose-p:leading-relaxed
                                       prose-pre:bg-black/10 dark:prose-pre:bg-white/10
                                       prose-pre:rounded prose-pre:p-3 prose-pre:overflow-x-auto
                                       prose-code:bg-black/10 dark:prose-code:bg-white/10
                                       prose-code:rounded prose-code:px-1 prose-code:py-0.5
                                       prose-strong:text-inherit prose-strong:font-semibold
                                       prose-em:text-inherit prose-em:italic
                                       prose-ul:my-2 prose-ol:my-2
                                       prose-li:my-1 prose-li:leading-relaxed
                                       prose-blockquote:border-l-4 prose-blockquote:border-border
                                       prose-blockquote:pl-4 prose-blockquote:italic
                                       prose-table:text-sm prose-td:px-3 prose-td:py-2
                                       prose-th:px-3 prose-th:py-2 prose-th:font-semibold">
                            <ReactMarkdown
                              components={{
                                // Custom components for better styling
                                h1: ({children}) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
                                h2: ({children}) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                                h3: ({children}) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
                                p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                ul: ({children}) => <ul className="list-disc list-inside space-y-2 my-3">{children}</ul>,
                                ol: ({children}) => <ol className="list-decimal list-inside space-y-2 my-3">{children}</ol>,
                                li: ({children}) => <li className="leading-relaxed mb-1 block">{children}</li>,
                                strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                                em: ({children}) => <em className="italic">{children}</em>,
                                code: ({children, className}) => {
                                  const isInline = !className?.includes('language-');
                                  return isInline ? (
                                    <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">
                                      {children}
                                    </code>
                                  ) : (
                                    <code className={className}>{children}</code>
                                  );
                                },
                                pre: ({children}) => (
                                  <pre className="bg-black/10 dark:bg-white/10 rounded p-3 overflow-x-auto my-2 text-xs">
                                    {children}
                                  </pre>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-sm break-words bg-gradient-to-r from-green-100 to-teal-100 dark:from-green-900/40 dark:to-teal-900/40 text-green-800 dark:text-green-200 p-3 rounded-lg border border-green-200 dark:border-green-700">
                            {message.content}
                          </div>
                        )}
                      </div>
                      
                      {/* Message Meta - Timestamp and Actions */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {message.timestamp && (
                          <span className="opacity-60">{new Date(message.timestamp).toLocaleTimeString()}</span>
                        )}
                        {message.role === 'assistant' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-auto hover:scale-110"
                                  onClick={() => copyToClipboard(message.content, index)}
                                >
                                  <AnimatePresence mode="wait">
                                    {copiedMessageId === index.toString() ? (
                                      <motion.div
                                        key="check"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                      >
                                        <Check className="h-3 w-3 text-green-500" />
                                      </motion.div>
                                    ) : (
                                      <motion.div
                                        key="copy"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </Button>
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy message</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                  </motion.div>
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
      <div className="flex-shrink-0 border-t bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-pink-50/50 dark:from-slate-900/50 dark:via-purple-900/20 dark:to-blue-900/20 px-4 py-4 border-purple-200/50 dark:border-purple-700/50">
        <div className="w-full max-w-4xl mx-auto min-w-0">
          <motion.div 
            className="relative"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about the articles... Press Enter to send, Shift+Enter for new line"
              className="resize-none border-2 focus:border-purple-500 transition-all duration-200 hover:border-purple-300 text-base p-4 pr-16 overflow-hidden leading-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
              disabled={isLoading}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  className="absolute bottom-2 right-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    size="sm"
                    className="h-10 w-10 p-0 rounded-full relative overflow-hidden group bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 border-0 shadow-lg"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                    />
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.div
                          key="loading"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1, rotate: 360 }}
                          exit={{ scale: 0 }}
                          transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" } }}
                        >
                          <Loader2 className="h-4 w-4" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="send"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          whileHover={{ x: 2, y: -2 }}
                          className="relative z-10"
                        >
                          <Send className="h-4 w-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isLoading ? "Processing..." : "Send message (Enter)"}</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        </div>
      </div>

    </motion.div>
    </TooltipProvider>
  );
}