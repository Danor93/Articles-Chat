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
import { chatApi } from '@/lib/api';
import type { ApiError, ChatMessage } from '@/lib/api';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversationId?: string;
  setConversationId: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export function ChatInterface({ 
  messages, 
  setMessages, 
  conversationId, 
  setConversationId 
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage(messageToSend, conversationId);
      
      // Set conversation ID for future messages
      if (response.conversation_id && !conversationId) {
        setConversationId(response.conversation_id);
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show cache indicator if response was cached
      if (response.cached) {
        console.log('Response served from cache');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      let errorMessage = 'Failed to send message. Please try again.';
      
      if (err.response?.data) {
        const apiError = err.response.data as ApiError;
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
      // Focus back to textarea
      textareaRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
  };

  const copyToClipboard = async (text: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageIndex.toString());
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header - Fixed at top */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur-sm animate-pulse-subtle" />
              <Avatar className="h-10 w-10 relative">
                <AvatarFallback className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
                  <Sparkles className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Article Chat Assistant</h1>
              <p className="text-xs text-muted-foreground">Powered by Claude AI</p>
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
          <div className="px-6 py-4">
            <div className="space-y-6 max-w-3xl mx-auto">
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
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                        <Bot className="h-10 w-10 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-lg font-medium text-foreground mb-2">Welcome to Article Chat!</h2>
                    <p className="text-sm">Ask me anything about the articles in the system.</p>
                    <p className="text-xs mt-2 opacity-80">Pro tip: Use the Articles tab to add new content to chat with.</p>
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
                          ? "bg-primary text-primary-foreground" 
                          : "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground"
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
                                ul: ({children}) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                                ol: ({children}) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                                li: ({children}) => <li className="leading-relaxed">{children}</li>,
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
                          <div className="text-sm break-words">
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
                          <AvatarFallback className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
                            <Sparkles className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                      <div className="flex-1 min-w-0">
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

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-shrink-0 px-6 py-2"
          >
            <Alert variant="destructive" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-background px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4 items-start">
            <motion.div 
              className="flex-1"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about the articles... You can paste large text here. Press Enter to send, Shift+Enter for new line"
                className="h-[120px] max-h-[400px] resize-y border-2 focus:border-primary transition-all duration-200 hover:border-primary/50 text-base p-4 overflow-y-auto"
                disabled={isLoading}
                rows={5}
              />
            </motion.div>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    size="lg"
                    className="h-[120px] px-6 relative overflow-hidden group self-end"
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
                <p>{isLoading ? "Processing..." : "Send message (Enter) • Large text supported"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}