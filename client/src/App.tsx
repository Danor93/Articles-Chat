import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatInterface } from '@/components/ChatInterface';
import { ArticleManager } from '@/components/ArticleManager';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/theme-provider';
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
    <ThemeProvider defaultTheme="system" storageKey="article-chat-theme">
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-b from-background to-background/95 flex flex-col">
      {/* Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="border-b bg-background/50 backdrop-blur-xl sticky top-0 z-50"
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
                  className="absolute -inset-2 bg-gradient-to-r from-primary/30 via-primary/20 to-transparent rounded-full blur-xl"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 0.8, 0.5]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative bg-gradient-to-br from-primary to-primary/80 p-2 rounded-lg">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Article Chat System
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Chat with articles using RAG-powered AI
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
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
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 cursor-default"
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
                        healthStatus === 'healthy' ? 'text-green-500' :
                        healthStatus === 'unhealthy' ? 'text-red-500' :
                        'text-yellow-500'
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
                          currentView === 'chat' ? 'shadow-lg shadow-primary/20' : ''
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
                          currentView === 'articles' ? 'shadow-lg shadow-primary/20' : ''
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
                <Alert variant="destructive" className="border-2">
                  <Activity className="h-4 w-4" />
                  <AlertDescription>
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
              className="flex-1 flex flex-col overflow-hidden"
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
              className="container mx-auto px-4 py-8"
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