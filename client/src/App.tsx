import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatInterface } from '@/components/ChatInterface';
import { ArticleManager } from '@/components/ArticleManager';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConversationsProvider } from '@/contexts/ConversationsContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Header } from '@/components/layout/Header';
import { ChatHistoryDrawer } from '@/components/layout/ChatHistoryDrawer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Activity } from 'lucide-react';
import { healthApi } from '@/lib/api';

type View = 'chat' | 'articles';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('chat');
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

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
          <Header 
            currentView={currentView}
            setCurrentView={setCurrentView}
            healthStatus={healthStatus}
            onToggleChatHistory={() => setIsHistoryDrawerOpen(true)}
          />

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
              <ChatInterface />
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

      {/* Chat History Drawer - Only visible for authenticated users */}
      <ChatHistoryDrawer 
        isOpen={isHistoryDrawerOpen} 
        setIsOpen={setIsHistoryDrawerOpen} 
      />
    </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        <ConversationsProvider>
          <AppContent />
        </ConversationsProvider>
      </AuthGuard>
    </AuthProvider>
  );
}

export default App;