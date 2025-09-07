import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatInterface } from '@/components/ChatInterface';
import { ArticleManager } from '@/components/ArticleManager';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquare, Plus, Activity, Sparkles } from 'lucide-react';
import { healthApi } from '@/lib/api';
import type { ChatMessage } from '@/lib/api';

type View = 'chat' | 'articles';

function App() {
  const [currentView, setCurrentView] = useState<View>('chat');
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');
  
  // Persistent chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await healthApi.check();
        setHealthStatus('healthy');
      } catch (error) {
        setHealthStatus('unhealthy');
        console.error('Health check failed:', error);
      }
    };

    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ThemeProvider defaultTheme="system" storageKey="clarticle-theme">
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-blue-900/20 flex flex-col">
      {/* Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="border-b bg-gradient-to-r from-white/80 via-blue-50/80 to-purple-50/80 dark:from-slate-900/80 dark:via-purple-900/40 dark:to-blue-900/40 backdrop-blur-xl sticky top-0 z-50 border-purple-200/50 dark:border-purple-700/50"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
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
              
              {/* Navigation */}
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
              
              {/* Theme Toggle */}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Health Status Alert */}
        <AnimatePresence>
          {healthStatus === 'unhealthy' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-shrink-0"
            >
              <div className="container mx-auto px-4 py-4">
                <Alert variant="destructive" className="border-2 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800">
                  <Activity className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-700 dark:text-red-300">
                    Unable to connect to the backend service. Please ensure the server is running and try refreshing the page.
                  </AlertDescription>
                </Alert>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Views */}
        <AnimatePresence mode="wait">
          {currentView === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center overflow-hidden container mx-auto px-4 py-16"
            >
              <ChatInterface 
                messages={messages}
                setMessages={setMessages}
                conversationId={conversationId}
                setConversationId={setConversationId}
              />
            </motion.div>
          ) : (
            <motion.div
              key="articles"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center overflow-hidden container mx-auto px-4 py-16"
            >
              <ArticleManager />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer />
    </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;