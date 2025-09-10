import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { User, Copy, Check, Sparkles } from 'lucide-react';
import type { ChatMessage } from '@/lib/api';

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  copiedMessageId: string | null;
  onCopy: (text: string, index: number) => void;
}

export function MessageItem({ message, index, copiedMessageId, onCopy }: MessageItemProps) {
  return (
    <motion.div 
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
                      onClick={() => onCopy(message.content, index)}
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
  );
}