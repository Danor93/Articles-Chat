import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConversations } from '../../contexts/ConversationsContext';
import { ConversationItem } from './ConversationItem';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
// Removed date-fns dependency - using built-in date checking

interface ConversationsListProps {
  onSelectConversation?: () => void;
}

export const ConversationsList: React.FC<ConversationsListProps> = ({ 
  onSelectConversation 
}) => {
  const { conversations, currentConversation } = useConversations();

  // Helper functions for date checking
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isYesterday = (date: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  };

  const isThisWeek = (date: Date) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo && date < now;
  };

  const isThisMonth = (date: Date) => {
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  // Group conversations by time periods
  const groupConversations = () => {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: []
    } as any;

    conversations.forEach(conversation => {
      const date = new Date(conversation.updated_at);
      
      if (isToday(date)) {
        groups.today.push(conversation);
      } else if (isYesterday(date)) {
        groups.yesterday.push(conversation);
      } else if (isThisWeek(date)) {
        groups.thisWeek.push(conversation);
      } else if (isThisMonth(date)) {
        groups.thisMonth.push(conversation);
      } else {
        groups.older.push(conversation);
      }
    });

    return groups;
  };

  const groupedConversations = groupConversations();

  const renderGroup = (title: string, conversations: any[], icon?: React.ReactNode) => {
    if (conversations.length === 0) return null;

    return (
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        {/* Group Header */}
        <div className="flex items-center gap-2 mb-3 px-2">
          {icon}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h3>
          <Badge 
            variant="secondary" 
            className="ml-auto text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
          >
            {conversations.length}
          </Badge>
        </div>

        {/* Conversations */}
        <div className="space-y-1">
          <AnimatePresence>
            {conversations.map((conversation, index) => (
              <motion.div
                key={conversation.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
              >
                <ConversationItem
                  conversation={conversation}
                  isActive={currentConversation?.id === conversation.id}
                  onSelect={onSelectConversation}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <ScrollArea className="h-full px-4">
      <div className="py-2">
        {conversations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {renderGroup(
              'Today', 
              groupedConversations.today,
              <div className="w-2 h-2 rounded-full bg-green-500" />
            )}

            {renderGroup(
              'Yesterday', 
              groupedConversations.yesterday,
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            )}

            {renderGroup(
              'This Week', 
              groupedConversations.thisWeek,
              <div className="w-2 h-2 rounded-full bg-purple-500" />
            )}

            {renderGroup(
              'This Month', 
              groupedConversations.thisMonth,
              <div className="w-2 h-2 rounded-full bg-orange-500" />
            )}

            {renderGroup(
              'Older', 
              groupedConversations.older,
              <div className="w-2 h-2 rounded-full bg-gray-400" />
            )}

            {/* Separator before older conversations if there are multiple groups */}
            {(groupedConversations.today.length > 0 || 
              groupedConversations.yesterday.length > 0 || 
              groupedConversations.thisWeek.length > 0 || 
              groupedConversations.thisMonth.length > 0) && 
              groupedConversations.older.length > 0 && (
              <div className="my-6">
                <Separator className="bg-purple-200/50 dark:bg-purple-700/50" />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </ScrollArea>
  );
};