import React from 'react';
import type { RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Loader2, RotateCcw } from 'lucide-react';

interface ChatInputProps {
  inputMessage: string;
  isLoading: boolean;
  messageCount: number;
  isNearLimit: boolean;
  remainingMessages: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onNewChat: () => void;
}

export function ChatInput({
  inputMessage,
  isLoading,
  messageCount,
  isNearLimit,
  remainingMessages,
  textareaRef,
  onInputChange,
  onSendMessage,
  onKeyPress,
  onNewChat
}: ChatInputProps) {
  return (
    <div className="flex-shrink-0 border-t bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-pink-50/50 dark:from-slate-900/50 dark:via-purple-900/20 dark:to-blue-900/20 px-4 py-4 border-purple-200/50 dark:border-purple-700/50">
      <div className="w-full max-w-4xl mx-auto min-w-0">
        {/* Quick Actions Bar - Above input when conversation exists */}
        <AnimatePresence>
          {messageCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 10, height: 0 }}
              className="flex items-center justify-between mb-3 px-1"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="opacity-60">Conversation • {messageCount} messages</span>
                {isNearLimit && (
                  <span className="text-amber-600 dark:text-amber-400">
                    • {remainingMessages} left
                  </span>
                )}
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={onNewChat}
                      variant="ghost"
                      size="sm"
                      className="group relative h-7 px-3 text-xs bg-gradient-to-r from-blue-50/80 to-purple-50/80 hover:from-blue-100 hover:to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 dark:hover:from-blue-900/50 dark:hover:to-purple-900/50 border border-blue-200/30 dark:border-blue-700/30 transition-all duration-200"
                    >
                      <div className="relative flex items-center gap-1.5">
                        <motion.div
                          whileHover={{ rotate: 90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <RotateCcw className="h-3 w-3 text-blue-600 dark:text-blue-400 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                        </motion.div>
                        <span className="font-medium text-blue-600 dark:text-blue-400 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          New Chat
                        </span>
                      </div>
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start a fresh conversation</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className="relative"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <Textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="Ask about the articles... Press Enter to send, Shift+Enter for new line"
            className="resize-none border-2 focus:border-purple-500 transition-all duration-200 hover:border-purple-300 text-base p-4 pr-16 overflow-hidden leading-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
            disabled={isLoading}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={onSendMessage}
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
          </div>
        </motion.div>
      </div>
    </div>
  );
}