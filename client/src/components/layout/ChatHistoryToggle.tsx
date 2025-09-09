import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useConversations } from '../../contexts/ConversationsContext';
import { History } from 'lucide-react';

interface ChatHistoryToggleProps {
  onToggle: () => void;
}

export const ChatHistoryToggle: React.FC<ChatHistoryToggleProps> = ({ onToggle }) => {
  const { conversations } = useConversations();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onToggle}
            variant="outline"
            size="sm"
            className="relative bg-white/50 hover:bg-white/70 dark:bg-slate-800/50 dark:hover:bg-slate-800/70 border-purple-200/50 dark:border-purple-700/50 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300"
          >
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="relative">
                <History className="h-4 w-4" />
                {conversations.length > 0 && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>
              <span className="hidden sm:inline">History</span>
              {conversations.length > 0 && (
                <motion.div
                  className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-xs text-purple-700 dark:text-purple-300 rounded-full font-medium"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {conversations.length}
                </motion.div>
              )}
            </motion.div>
          </Button>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {conversations.length === 0 
            ? 'View chat history' 
            : `View ${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`
          }
        </p>
      </TooltipContent>
    </Tooltip>
  );
};