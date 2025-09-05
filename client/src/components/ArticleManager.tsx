import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
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

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleAddArticle = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!validateUrl(url.trim())) {
      setError('Please enter a valid HTTP or HTTPS URL');
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
    } catch (err: any) {
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
      
      if (err.response?.data) {
        const apiError = err.response.data as ApiError;
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
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <div className="h-4 w-4 rounded-full bg-red-500" />;
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
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Articles to Knowledge Base
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Add Article Form */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter article URL (e.g., https://example.com/article)"
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleAddArticle}
              disabled={!url.trim() || isLoading}
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Article
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Processed Articles List */}
        {processedArticles.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Recent Articles</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {processedArticles.map((article) => (
                <div
                  key={`${article.url}-${article.timestamp}`}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(article.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline truncate max-w-[400px]"
                        title={article.url}
                      >
                        {article.url}
                      </a>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${
                        article.status === 'completed' ? 'text-green-600' :
                        article.status === 'processing' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {getStatusText(article.status)}
                      </span>
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Instructions:</strong></p>
          <ul className="space-y-1 ml-4">
            <li>• Enter any HTTP or HTTPS article URL</li>
            <li>• The system will fetch and process the article content</li>
            <li>• Once processed, you can ask questions about the article in the chat</li>
            <li>• Duplicate URLs will be detected and served from cache</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}