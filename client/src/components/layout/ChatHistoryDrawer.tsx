import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '../ui/sheet';
import { useConversations } from '../../contexts/ConversationsContext';
import { ConversationsList } from '../chat/ConversationsList';
import { 
  History, 
  MessageSquare, 
  Plus,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({ isOpen, setIsOpen }) => {
  const {
    conversations,
    currentConversation,
    isLoading,
    error,
    createConversation,
    loadConversations
  } = useConversations();

  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const handleNewConversation = async () => {
    try {
      setIsCreatingConversation(true);
      await createConversation();
      setIsOpen(false); // Close drawer after creating new conversation
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleRefresh = () => {
    loadConversations();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* Sheet Content */}
      <SheetContent 
        side="left" 
        className="w-96 bg-gradient-to-b from-white/95 via-blue-50/95 to-purple-50/95 dark:from-slate-900/95 dark:via-purple-900/40 dark:to-blue-900/40 backdrop-blur-xl border-r border-purple-200/50 dark:border-purple-700/50"
      >
        {/* Header */}
        <SheetHeader className="border-b border-purple-200/50 dark:border-purple-700/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <motion.div
                className="absolute -inset-2 bg-gradient-to-r from-blue-400/30 via-purple-400/30 to-pink-400/30 rounded-full blur-lg"
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="relative bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-2 rounded-xl shadow-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <SheetTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Chat History
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {/* New Chat Button */}
          <Button
            onClick={handleNewConversation}
            disabled={isCreatingConversation}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg shadow-blue-500/30 transition-all duration-300 mt-4"
          >
            {isCreatingConversation ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            New Conversation
          </Button>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden py-4"
             style={{ overflowX: 'hidden' }}>
          {/* Error State */}
          {error && (
            <div className="p-4">
              <div className="p-4 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 rounded-lg border">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Error</p>
                    <p className="text-xs">{error}</p>
                  </div>
                </div>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full text-red-600 border-red-200 hover:bg-red-100"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !error && (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="h-8 w-8 text-purple-500 mx-auto mb-3" />
                </motion.div>
                <p className="text-sm text-muted-foreground">Loading conversations...</p>
              </div>
            </div>
          )}

          {/* Conversations List */}
          {!isLoading && !error && (
            <div className="h-full overflow-y-auto overflow-x-hidden">
              {conversations.length === 0 ? (
                <div className="flex items-center justify-center p-8 h-full overflow-hidden">
                  <div className="text-center max-w-full">
                    <div className="relative mb-4 overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-full blur-xl"
                        animate={{ 
                          scale: [1, 1.1, 1],
                          opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{ duration: 4, repeat: Infinity }}
                      />
                      <div className="relative bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 p-6 rounded-2xl mx-auto w-fit">
                        <MessageSquare className="h-12 w-12 text-purple-500 mx-auto" />
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">
                      No conversations yet
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start a new conversation to see your chat history here
                    </p>
                    <Button
                      onClick={handleNewConversation}
                      disabled={isCreatingConversation}
                      variant="outline"
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      {isCreatingConversation ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Start Chatting
                    </Button>
                  </div>
                </div>
              ) : (
                <ConversationsList onSelectConversation={() => setIsOpen(false)} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-purple-200/50 dark:border-purple-700/50 pt-4 mt-auto">
          <div className="flex items-center justify-between">
            <Badge
              variant="secondary"
              className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-purple-700 dark:text-purple-300 border-0"
            >
              {currentConversation ? 'Active Chat' : 'No Active Chat'}
            </Badge>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleRefresh}
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 rounded-full hover:bg-purple-100/50 dark:hover:bg-purple-900/50"
                >
                  <motion.div
                    animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
                  >
                    <History className="h-4 w-4" />
                  </motion.div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh conversations</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};