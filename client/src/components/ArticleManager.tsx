import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Loader2, ExternalLink, CheckCircle2, AlertCircle, LinkIcon, Sparkles } from 'lucide-react';
import { articlesApi } from '@/lib/api';
import type { ApiError } from '@/lib/api';

interface ProcessedArticle {
  url: string;
  status: 'processing' | 'completed' | 'error';
  message?: string;
  timestamp: string;
}

export function ArticleManager() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processedArticles, setProcessedArticles] = useState<ProcessedArticle[]>([]);

  const validateUrl = (url: string): { isValid: boolean; message?: string } => {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return { isValid: false, message: 'URL must use HTTP or HTTPS protocol' };
      }
      
      // Check for localhost/IP addresses (usually not articles)
      if (urlObj.hostname === 'localhost' || 
          urlObj.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) ||
          urlObj.hostname.includes('127.0.0.1')) {
        return { isValid: false, message: 'Local URLs are not supported for article processing' };
      }
      
      // Check for common non-article domains
      const nonArticleDomains = ['youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com'];
      if (nonArticleDomains.some(domain => urlObj.hostname.includes(domain))) {
        return { isValid: false, message: 'Social media and video platforms are not supported. Please use news or blog article URLs' };
      }
      
      // Check for minimum domain structure
      if (!urlObj.hostname.includes('.')) {
        return { isValid: false, message: 'Please enter a complete URL (e.g., https://example.com/article)' };
      }
      
      // Check for path (articles usually have paths)
      if (urlObj.pathname === '/' || urlObj.pathname === '') {
        return { isValid: false, message: 'Please provide a link to a specific article, not just the homepage' };
      }
      
      return { isValid: true };
    } catch {
      return { isValid: false, message: 'Please enter a valid URL format (e.g., https://example.com/article)' };
    }
  };

  const handleAddArticle = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    const validation = validateUrl(url.trim());
    if (!validation.isValid) {
      setError(validation.message || 'Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const articleUrl = url.trim();
    const timestamp = new Date().toISOString();

    // Add to processed articles list with processing status
    const newArticle: ProcessedArticle = {
      url: articleUrl,
      status: 'processing',
      timestamp,
    };
    setProcessedArticles(prev => [newArticle, ...prev]);

    try {
      const response = await articlesApi.addArticle(articleUrl);
      
      // Update the article status to completed
      setProcessedArticles(prev => 
        prev.map(article => 
          article.url === articleUrl && article.timestamp === timestamp
            ? { ...article, status: 'completed', message: response.message }
            : article
        )
      );

      if (response.cached) {
        setSuccess('Article was already processed and is available in the system.');
      } else {
        setSuccess('Article has been successfully processed and added to the system.');
      }
      
      setUrl('');
    } catch (err: unknown) {
      console.error('Article processing error:', err);
      
      // Update the article status to error
      setProcessedArticles(prev => 
        prev.map(article => 
          article.url === articleUrl && article.timestamp === timestamp
            ? { ...article, status: 'error', message: 'Failed to process article' }
            : article
        )
      );

      let errorMessage = 'Failed to process article. Please try again.';
      
      if (err && typeof err === 'object' && 'response' in err && (err as any).response?.data) {
        const apiError = (err as any).response.data as ApiError;
        switch (apiError.error) {
          case 'VALIDATION_ERROR':
            errorMessage = 'Invalid URL format. Please check your input.';
            break;
          case 'ARTICLE_NOT_FOUND':
            errorMessage = 'Article could not be found at the provided URL.';
            break;
          case 'RATE_LIMIT_EXCEEDED':
            errorMessage = 'Too many requests. Please wait before adding more articles.';
            break;
          case 'SERVICE_UNAVAILABLE':
            errorMessage = 'Article processing service is temporarily unavailable.';
            break;
          default:
            errorMessage = apiError.message || errorMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddArticle();
    }
  };

  const getStatusIcon = (status: ProcessedArticle['status']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-amber-500 drop-shadow-sm" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 drop-shadow-sm" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500 drop-shadow-sm" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: ProcessedArticle['status']) => {
    switch (status) {
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  };

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full overflow-hidden shadow-lg bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-purple-900/10 dark:to-blue-900/10 border border-purple-200/50 dark:border-purple-700/50">
          <CardHeader className="bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 dark:from-blue-900/40 dark:via-purple-900/40 dark:to-pink-900/40">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <CardTitle className="flex items-center gap-3">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-blue-400/30 via-purple-400/30 to-pink-400/30 rounded-full blur-md"
                  />
                  <LinkIcon className="h-6 w-6 relative text-purple-600 dark:text-purple-400" />
                </div>
                Add Articles to Clarticle
                <Badge className="ml-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
              </CardTitle>
            </motion.div>
          </CardHeader>
          
          <CardContent className="space-y-6 p-6">
            {/* Add Article Form */}
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex gap-2">
                <motion.div 
                  className="flex-1"
                  whileFocus={{ scale: 1.02 }}
                >
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter article URL (e.g., https://example.com/article)"
                    disabled={isLoading}
                    className="h-12 px-4 text-base border-2 transition-all hover:border-purple-300 focus:border-purple-500 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm"
                  />
                </motion.div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={handleAddArticle}
                        disabled={!url.trim() || isLoading}
                        size="lg"
                        className="h-12 px-6 relative overflow-hidden group bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0 shadow-lg"
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                        />
                        <AnimatePresence mode="wait">
                          {isLoading ? (
                            <motion.div
                              key="loading"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="flex items-center gap-2"
                            >
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Processing
                            </motion.div>
                          ) : (
                            <motion.div
                              key="add"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="flex items-center gap-2 relative z-10"
                            >
                              <Plus className="h-4 w-4" />
                              Add Article
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Process and add article to knowledge base</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Error Display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Alert variant="destructive" className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <AlertDescription className="text-red-700 dark:text-red-300">{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Display */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Alert className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 text-green-800 dark:text-green-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Processed Articles List */}
            <AnimatePresence>
              {processedArticles.length > 0 && (
                <motion.div 
                  className="space-y-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Separator />
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    Recent Articles
                    <Badge variant="outline" className="ml-2">
                      {processedArticles.length}
                    </Badge>
                  </h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    <AnimatePresence>
                      {processedArticles.map((article, index) => (
                        <motion.div
                          key={`${article.url}-${article.timestamp}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          className="flex items-center gap-3 p-4 border rounded-lg bg-gradient-to-r from-white/80 to-blue-50/50 dark:from-slate-800/80 dark:to-purple-900/30 hover:from-blue-50/80 hover:to-purple-50/80 dark:hover:from-slate-700/80 dark:hover:to-purple-800/40 transition-all border-blue-200/50 dark:border-purple-700/50"
                        >
                          <motion.div 
                            className="flex-shrink-0"
                            animate={article.status === 'processing' ? {
                              scale: [1, 1.2, 1],
                            } : {}}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            {getStatusIcon(article.status)}
                          </motion.div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary hover:underline truncate max-w-[400px] flex items-center gap-1 group"
                                title={article.url}
                              >
                                {article.url}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                className={`text-xs px-2 py-0 ${
                                  article.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0' :
                                  article.status === 'processing' ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0' :
                                  'bg-gradient-to-r from-red-500 to-pink-500 text-white border-0'
                                }`}
                              >
                                {getStatusText(article.status)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(article.timestamp).toLocaleString()}
                              </span>
                            </div>
                            
                            {article.message && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {article.message}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Instructions */}
            <motion.div 
              className="text-sm text-muted-foreground space-y-2 bg-gradient-to-r from-blue-50/80 via-purple-50/80 to-pink-50/80 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30 rounded-lg p-4 border border-purple-200/50 dark:border-purple-700/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Instructions:
              </p>
              <ul className="space-y-1.5 ml-6">
                <motion.li 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-purple-500 mt-1">•</span>
                  <span>Enter any HTTP or HTTPS article URL</span>
                </motion.li>
                <motion.li 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-purple-500 mt-1">•</span>
                  <span>The system will fetch and process the article content using AI</span>
                </motion.li>
                <motion.li 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-purple-500 mt-1">•</span>
                  <span>Once processed, ask questions about the article in the chat</span>
                </motion.li>
                <motion.li 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-purple-500 mt-1">•</span>
                  <span>Duplicate URLs will be detected and served from cache instantly</span>
                </motion.li>
              </ul>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}