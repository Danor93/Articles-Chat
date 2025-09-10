import { Router, Request, Response } from 'express';
import { langchainService } from '../services/langchain.service';
import { faissVectorStoreService } from '../services/faiss-vectorstore.service';
import { promptEngineeringService } from '../services/prompt-engineering.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest, articleValidationRules, batchArticleValidationRules } from '../middleware/validation';
import { createError, ErrorCode } from '../utils/errors';

const router = Router();

interface ProcessArticleRequest {
  url: string;
  title?: string;
}

interface ProcessBatchRequest {
  urls: string[];
}

interface ArticleProcessingStatus {
  processed: number;
  total: number;
  inProgress: boolean;
  errors: string[];
}

let processingStatus: ArticleProcessingStatus = {
  processed: 0,
  total: 0,
  inProgress: false,
  errors: []
};

// Store processed articles metadata
interface ProcessedArticle {
  url: string;
  title: string;
  category?: string;
  processedAt: Date;
  chunks: number;
}

let processedArticles: ProcessedArticle[] = [];

function extractTitleFromUrl(url: string): string {
  try {
    // Extract meaningful title from URL path
    const urlPath = new URL(url).pathname;
    const segments = urlPath.split('/').filter(s => s.length > 0);
    const lastSegment = segments[segments.length - 1];
    
    // Convert URL-style text to readable title
    return lastSegment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .substring(0, 100); // Limit length
  } catch {
    return 'Unknown Article';
  }
}

async function fetchArticleContent(url: string): Promise<{ title: string; content: string }> {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    $('script, style, nav, footer, aside, .ads, .advertisement').remove();
    
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  'Untitled Article';
    
    const content = $('article, main, .content, .post-content, .entry-content, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    if (!content || content.length < 100) {
      throw createError(
        ErrorCode.VALIDATION_ERROR,
        'Article content too short or empty (minimum 100 characters required)'
      );
    }

    return { title, content };
  } catch (error) {
    console.error(`Error fetching article from ${url}:`, error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw createError(
          ErrorCode.ARTICLE_NOT_FOUND,
          `Article not found at URL: ${url}`
        );
      }
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw createError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Article fetch timed out'
        );
      }
    }
    
    throw error instanceof Error && 'code' in error ? error : createError(
      ErrorCode.PROCESSING_ERROR,
      `Failed to fetch article: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

router.post('/process', 
  validateRequest(articleValidationRules),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { url, title }: ProcessArticleRequest = req.body;

    // Process single article

    // Check if services are initialized
    if (!langchainService.isInitialized()) {
      throw createError(
        ErrorCode.SERVICE_NOT_INITIALIZED,
        'Article processing service is not initialized'
      );
    }

    const { title: fetchedTitle, content } = await fetchArticleContent(url);
    const articleTitle = title || fetchedTitle;

    const ids = await langchainService.processArticle(url, content);

    // Update article count in prompt engineering service
    promptEngineeringService.incrementArticleCount(url);

    // Store processed article metadata
    processedArticles.push({
      url,
      title: articleTitle,
      processedAt: new Date(),
      chunks: ids.length
    });

    res.json({
      message: 'Article processed successfully',
      url,
      title: articleTitle,
      chunks: ids.length,
      documentIds: ids,
    });
  })
);

router.post('/batch', 
  validateRequest(batchArticleValidationRules),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { urls }: ProcessBatchRequest = req.body;

    // Check if services are initialized
    if (!langchainService.isInitialized()) {
      throw createError(
        ErrorCode.SERVICE_NOT_INITIALIZED,
        'Article processing service is not initialized'
      );
    }

    if (processingStatus.inProgress) {
      throw createError(
        ErrorCode.PROCESSING_ERROR,
        'Batch processing already in progress',
        processingStatus
      );
    }

    processingStatus = {
      processed: 0,
      total: urls.length,
      inProgress: true,
      errors: []
    };

    res.json({
      message: 'Batch processing started',
      total: urls.length,
      status: 'started'
    });

    // Process batch asynchronously
    processBatchAsync(urls).catch(error => {
      console.error('Batch processing failed:', error);
      processingStatus.inProgress = false;
      processingStatus.errors.push(error.message);
    });
  })
);

async function processBatchAsync(urls: string[]): Promise<void> {
  const concurrentLimit = parseInt(process.env.CONCURRENT_ARTICLE_LIMIT || '3');
  
  for (let i = 0; i < urls.length; i += concurrentLimit) {
    const batch = urls.slice(i, i + concurrentLimit);
    
    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const { title, content } = await fetchArticleContent(url);
          const ids = await langchainService.processArticle(url, content);
          
          // Update article count in prompt engineering service
          promptEngineeringService.incrementArticleCount(url);

          // Store processed article metadata
          processedArticles.push({
            url,
            title,
            processedAt: new Date(),
            chunks: ids.length
          });
          
          processingStatus.processed++;
        } catch (error) {
          const errorMessage = `Failed to process ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          processingStatus.errors.push(errorMessage);
          console.error(errorMessage);
        }
      })
    );
  }
  
  processingStatus.inProgress = false;
  console.log(`Batch processing completed. Processed: ${processingStatus.processed}/${processingStatus.total}, Errors: ${processingStatus.errors.length}`);
}

router.get('/list', async (req: Request, res: Response) => {
  try {
    // Get all articles from the vector store (the source of truth)
    const vectorStore = faissVectorStoreService.getVectorStore();
    const vectorStoreArticles: ProcessedArticle[] = [];
    
    if (vectorStore) {
      try {
        // Search with a very common term to get many documents
        const searchResults = await vectorStore.similaritySearch('the', 1000);
        const uniqueArticlesMap = new Map<string, ProcessedArticle>();
        
        // Extract unique articles from search results
        searchResults.forEach(doc => {
          if (doc.metadata && doc.metadata.source && !uniqueArticlesMap.has(doc.metadata.source)) {
            const url = doc.metadata.source;
            const title = extractTitleFromUrl(url);
            uniqueArticlesMap.set(url, {
              url,
              title,
              category: 'unknown',
              processedAt: doc.metadata.processed_at || new Date(),
              chunks: doc.metadata.total_chunks || 1
            });
          }
        });
        
        vectorStoreArticles.push(...Array.from(uniqueArticlesMap.values()));
      } catch (error) {
        console.log('Could not retrieve articles from vector store:', error);
      }
    }
    
    // Read articles from the source file as fallback
    const fs = require('fs');
    const path = require('path');
    
    const articlesPath = process.env.ARTICLES_JSON_PATH || 
      (process.env.NODE_ENV === 'production' ? '/app/data/articles.json' : path.join(__dirname, '../../../data/articles.json'));
    
    let sourceArticles = [];
    if (fs.existsSync(articlesPath)) {
      const fileContent = fs.readFileSync(articlesPath, 'utf-8');
      sourceArticles = JSON.parse(fileContent);
    }

    // Combine all sources: vector store (highest priority), runtime, and file
    const allArticles = [
      ...vectorStoreArticles.map(article => ({
        ...article,
        source: 'vectorstore'
      })),
      ...processedArticles.map(article => ({
        url: article.url,
        title: article.title,
        category: article.category,
        processedAt: article.processedAt,
        chunks: article.chunks,
        source: 'runtime'
      })),
      ...sourceArticles.map((article: any) => ({
        url: article.url,
        title: article.title,
        category: article.category,
        processedAt: new Date().toISOString(),
        chunks: 3,
        source: 'file'
      }))
    ];

    // Remove duplicates (prefer vector store > runtime > file)
    const uniqueArticles: any[] = [];
    const seenUrls = new Set<string>();
    
    // Priority order: vectorstore > runtime > file
    const priorityOrder = ['vectorstore', 'runtime', 'file'];
    
    priorityOrder.forEach(source => {
      allArticles.filter(a => a.source === source).forEach(article => {
        if (!seenUrls.has(article.url)) {
          uniqueArticles.push(article);
          seenUrls.add(article.url);
        }
      });
    });

    // Sort by title for consistency
    uniqueArticles.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    res.json({
      total: uniqueArticles.length,
      articles: uniqueArticles.map(article => ({
        url: article.url,
        title: article.title,
        category: article.category,
        processedAt: article.processedAt,
        chunks: article.chunks
      }))
    });
  } catch (error) {
    console.error('Articles list error:', error);
    res.status(500).json({ 
      error: 'Failed to get articles list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    // FAISS doesn't expose document count directly, use stats from langchain service
    const stats = await langchainService.getStats();
    
    res.json({
      processing: processingStatus,
      vectorStore: {
        totalDocuments: stats.totalDocuments || 0,
        healthy: faissVectorStoreService.isHealthy(),
      }
    });
  } catch (error) {
    console.error('Status route error:', error);
    res.status(500).json({ 
      error: 'Failed to get processing status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const vectorStoreHealthy = faissVectorStoreService.isHealthy();
    const stats = await langchainService.getStats();
    
    res.json({
      status: vectorStoreHealthy ? 'healthy' : 'unhealthy',
      vectorStore: {
        healthy: vectorStoreHealthy,
        documents: stats.totalDocuments,
      },
      conversations: stats.conversations,
      totalMessages: stats.totalMessages,
    });
  } catch (error) {
    console.error('Articles health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/reset', async (req: Request, res: Response) => {
  try {
    await faissVectorStoreService.deleteAll();
    await faissVectorStoreService.initialize();
    
    processingStatus = {
      processed: 0,
      total: 0,
      inProgress: false,
      errors: []
    };

    res.json({
      message: 'Vector store reset successfully',
      status: 'reset'
    });
  } catch (error) {
    console.error('Reset route error:', error);
    res.status(500).json({ 
      error: 'Failed to reset vector store',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as articlesRoutes };