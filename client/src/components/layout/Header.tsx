import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { UserMenu } from '../auth/UserMenu';
import { MessageSquare, Plus, Activity, Sparkles, PanelLeft } from 'lucide-react';

type View = 'chat' | 'articles';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  healthStatus: 'checking' | 'healthy' | 'unhealthy';
  onToggleChatHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  healthStatus,
  onToggleChatHistory
}) => {
  const { isAuthenticated } = useAuth();

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="border-b bg-gradient-to-r from-white/80 via-blue-50/80 to-purple-50/80 dark:from-slate-900/80 dark:via-purple-900/40 dark:to-blue-900/40 backdrop-blur-xl sticky top-0 z-50 border-purple-200/50 dark:border-purple-700/50"
    >
      <div className="w-full py-4">
        <div className="flex items-center justify-between pl-2 pr-4">
          {/* Left Side - Chat History Toggle (absolute left edge) + Logo */}
          <div className="flex items-center gap-4">
            {/* Chat History Toggle - Absolute Left Edge (authenticated users only) */}
            {isAuthenticated && onToggleChatHistory && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-shrink-0"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onToggleChatHistory}
                      variant="ghost"
                      size="lg"
                      className="w-14 h-14 p-0 hover:bg-purple-100/80 dark:hover:bg-purple-900/80 transition-all duration-200 hover:scale-105 rounded-xl border border-transparent hover:border-purple-200/50 dark:hover:border-purple-700/50"
                    >
                      <PanelLeft className="h-8 w-8 text-purple-700 dark:text-purple-300 stroke-[2.5]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Open chat history</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}

            {/* Logo */}
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="relative">
                <motion.div
                  className="absolute -inset-3 bg-gradient-to-r from-blue-400/40 via-purple-400/40 to-pink-400/40 rounded-full blur-xl"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.6, 1, 0.6],
                    rotate: [0, 180, 360]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
                <div className="relative bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-2 rounded-xl shadow-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Clarticle
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Chat with articles using RAG-powered AI
                  <Badge className="text-xs px-1.5 py-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
                    Claude AI
                  </Badge>
                </p>
              </div>
            </motion.div>
          </div>
          
          {/* Right Side - Health Status, Navigation (if authenticated), User Menu */}
          <div className="flex items-center gap-4">
            {/* Health Status */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 cursor-default border border-green-200/50 dark:border-green-700/50"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.div
                    animate={healthStatus === 'checking' ? {
                      scale: [1, 1.2, 1],
                    } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Activity className={`h-3.5 w-3.5 transition-colors ${
                      healthStatus === 'healthy' ? 'text-emerald-500 drop-shadow-sm' :
                      healthStatus === 'unhealthy' ? 'text-red-500 drop-shadow-sm' :
                      'text-amber-500 drop-shadow-sm'
                    }`} />
                  </motion.div>
                  <span className="text-xs font-medium">
                    {healthStatus === 'healthy' ? 'Connected' :
                     healthStatus === 'unhealthy' ? 'Disconnected' :
                     'Connecting...'}
                  </span>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {healthStatus === 'healthy' 
                    ? 'All services are running and healthy' 
                    : healthStatus === 'unhealthy' 
                    ? 'Backend services are not responding' 
                    : 'Checking backend service status...'
                  }
                </p>
              </TooltipContent>
            </Tooltip>
            
            {/* Navigation - Only for authenticated users */}
            {isAuthenticated && (
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant={currentView === 'chat' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentView('chat')}
                        className={`transition-all duration-300 ${
                          currentView === 'chat' ? 'shadow-lg shadow-blue-500/30 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0' : 'bg-white/50 hover:bg-white/70 dark:bg-slate-800/50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chat with your articles using AI</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant={currentView === 'articles' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentView('articles')}
                        className={`transition-all duration-300 ${
                          currentView === 'articles' ? 'shadow-lg shadow-purple-500/30 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0' : 'bg-white/50 hover:bg-white/70 dark:bg-slate-800/50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Articles
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add articles to the knowledge base</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            
            {/* User Menu - Only for authenticated users */}
            {isAuthenticated && <UserMenu />}
          </div>
        </div>
      </div>
    </motion.header>
  );
};