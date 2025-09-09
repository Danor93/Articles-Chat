import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useConversations, type Conversation } from '../../contexts/ConversationsContext';
import { 
  MessageSquare,
  Trash2,
  Edit3,
  Calendar,
  Hash,
  Check,
  X
} from 'lucide-react';
// Removed date-fns dependency - using built-in date formatting

interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
  onSelect?: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onSelect
}) => {
  const { 
    loadConversation, 
    deleteConversation, 
    updateConversationTitle,
    currentConversation 
  } = useConversations();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSelect = async () => {
    if (currentConversation?.id !== conversation.id) {
      await loadConversation(conversation.id);
    }
    onSelect?.();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        setIsDeleting(true);
        await deleteConversation(conversation.id);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim() && editTitle !== conversation.title) {
      try {
        await updateConversationTitle(conversation.id, editTitle.trim());
      } catch (error) {
        console.error('Failed to update conversation title:', error);
        setEditTitle(conversation.title); // Revert on error
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conversation.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit(e as any);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e as any);
    }
  };

  const isCurrentActive = currentConversation?.id === conversation.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`relative group cursor-pointer transition-all duration-200 ${
        isCurrentActive ? 'mb-2' : 'mb-1'
      }`}
      onClick={handleSelect}
    >
      <div
        className={`relative p-4 rounded-lg border transition-all duration-200 ${
          isCurrentActive
            ? 'bg-gradient-to-r from-blue-100/80 to-purple-100/80 dark:from-blue-900/30 dark:to-purple-900/30 border-blue-300 dark:border-blue-700 shadow-md shadow-blue-500/20'
            : 'bg-white/50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 border-purple-200/30 dark:border-purple-700/30 hover:border-blue-300/50 dark:hover:border-blue-700/50'
        }`}
      >
        {/* Active Indicator */}
        {isCurrentActive && (
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full"
            initial={{ height: 0 }}
            animate={{ height: 32 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Content */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`mt-0.5 ${isCurrentActive ? 'text-blue-600 dark:text-blue-400' : 'text-purple-500'}`}>
            <MessageSquare className="h-4 w-4" />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            {isEditing ? (
              <div className="flex items-center gap-1 mb-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 text-sm font-medium bg-white dark:bg-slate-700 border border-purple-200 dark:border-purple-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  onClick={handleSaveEdit}
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <h4 className={`text-sm font-medium mb-2 line-clamp-2 ${
                isCurrentActive 
                  ? 'text-blue-900 dark:text-blue-100' 
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {conversation.title}
              </h4>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span>{conversation.message_count}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <Tooltip>
                  <TooltipTrigger>
                    <span>{formatDate(conversation.updated_at)}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{getRelativeTime(conversation.updated_at)}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleEdit}
                  variant="ghost"
                  size="sm"
                  className="w-7 h-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-gray-500 hover:text-blue-600"
                  disabled={isEditing}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit title</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleDelete}
                  variant="ghost"
                  size="sm"
                  className="w-7 h-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-500 hover:text-red-600"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete conversation</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Active Badge */}
        {isCurrentActive && (
          <motion.div
            className="absolute -top-2 -right-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 500, damping: 30 }}
          >
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-2 py-1 shadow-lg">
              Active
            </Badge>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};