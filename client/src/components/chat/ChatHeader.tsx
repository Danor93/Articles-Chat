import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, MessageSquarePlus } from 'lucide-react';

interface ChatHeaderProps {
  userName?: string;
  onNewChat: () => void;
}

export function ChatHeader({ userName, onNewChat }: ChatHeaderProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
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
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Clarticle Assistant</h1>
            <p className="text-xs text-muted-foreground">
              Powered by Claude AI • Logged in as {userName}
            </p>
          </div>
        </div>
        
        {/* New Chat Action - Only shows when no messages */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost"
                  size="sm" 
                  onClick={onNewChat}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 dark:hover:from-blue-900/50 dark:hover:to-purple-900/50 border border-blue-200/50 dark:border-blue-700/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
                >
                  <div className="relative flex items-center gap-2">
                    <MessageSquarePlus className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      New Chat
                    </span>
                  </div>
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Start a new conversation</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}