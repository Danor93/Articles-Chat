import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/ChatInterface';
import { ArticleManager } from '@/components/ArticleManager';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Plus, Activity } from 'lucide-react';
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
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Article Chat System</h1>
                <p className="text-sm text-muted-foreground">
                  Chat with articles using RAG-powered AI
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Health Status */}
              <div className="flex items-center gap-2">
                <Activity className={`h-4 w-4 ${
                  healthStatus === 'healthy' ? 'text-green-500' :
                  healthStatus === 'unhealthy' ? 'text-red-500' :
                  'text-yellow-500'
                }`} />
                <span className="text-sm text-muted-foreground">
                  {healthStatus === 'healthy' ? 'Connected' :
                   healthStatus === 'unhealthy' ? 'Disconnected' :
                   'Connecting...'}
                </span>
              </div>
              
              {/* Navigation */}
              <div className="flex gap-2">
                <Button
                  variant={currentView === 'chat' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentView('chat')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
                <Button
                  variant={currentView === 'articles' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentView('articles')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Articles
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Health Status Alert */}
        {healthStatus === 'unhealthy' && (
          <div className="flex-shrink-0 container mx-auto px-4 py-4">
            <Alert variant="destructive">
              <Activity className="h-4 w-4" />
              <AlertDescription>
                Unable to connect to the backend service. Please ensure the server is running and try refreshing the page.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Content Views */}
        {currentView === 'chat' ? (
          <ChatInterface 
            messages={messages}
            setMessages={setMessages}
            conversationId={conversationId}
            setConversationId={setConversationId}
          />
        ) : (
          <div className="container mx-auto px-4 py-8">
            <ArticleManager />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>Article Chat System - Hybrid Go + Node.js Architecture with Claude AI</p>
            <p className="mt-1">
              Built with React, TypeScript, shadcn/ui, and Tailwind CSS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
