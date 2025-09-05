import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Loader2, User, Bot, Copy, Check } from 'lucide-react';
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
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Article Chat Assistant</h1>
          </div>
          <Button variant="outline" size="sm" onClick={clearChat}>
            Clear Chat
          </Button>
        </div>
      </div>
      
      {/* Messages Area - Scrollable content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-6 py-4">
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>Welcome! Ask me anything about the articles in the system.</p>
                  <p className="text-sm mt-2">You can also add new articles using the form below.</p>
                </div>
              )}
              
              {messages.map((message, index) => (
                <div key={index} className="group">
                  <div className="flex gap-4 w-full">
                    {/* Avatar */}
                    <div className="flex-shrink-0 mt-1">
                      {message.role === 'user' ? (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <Bot className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                    
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
                          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                        )}
                        {message.role === 'assistant' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                            onClick={() => copyToClipboard(message.content, index)}
                          >
                            {copiedMessageId === index.toString() ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="group">
                  <div className="flex gap-4 w-full">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <Bot className="h-4 w-4 text-secondary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Add some padding at the bottom for scroll */}
              <div className="h-4"></div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 px-6 py-2">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-background px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about the articles... (Press Enter to send, Shift+Enter for new line)"
              className="min-h-[52px] max-h-[120px] resize-none border-2 focus:border-primary"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="lg"
              className="h-[52px] px-4"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}