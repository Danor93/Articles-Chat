import { Router, Request, Response } from 'express';
import { langchainService } from '../services/langchain.service';
import { vectorStoreService } from '../services/vectorstore.service';
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

    console.log(`Processing single article: ${url}`);

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
          console.log(`Processing article ${processingStatus.processed + 1}/${processingStatus.total}: ${url}`);
          
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
          console.log(`✓ Completed: ${url}`);
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
    // Read articles from the source file
    const fs = require('fs');
    const path = require('path');
    
    const articlesPath = process.env.ARTICLES_JSON_PATH || 
      (process.env.NODE_ENV === 'production' ? '/app/data/articles.json' : path.join(__dirname, '../../../data/articles.json'));
    
    let sourceArticles = [];
    if (fs.existsSync(articlesPath)) {
      const fileContent = fs.readFileSync(articlesPath, 'utf-8');
      sourceArticles = JSON.parse(fileContent);
    }

    // Combine source articles with any runtime processed articles
    const allArticles = [
      ...sourceArticles.map((article: any) => ({
        url: article.url,
        title: article.title,
        category: article.category,
        processedAt: new Date().toISOString(), // Default processed date
        chunks: 3, // Estimated chunks
        source: 'startup'
      })),
      ...processedArticles.map(article => ({
        url: article.url,
        title: article.title,
        category: article.category,
        processedAt: article.processedAt,
        chunks: article.chunks,
        source: 'runtime'
      }))
    ];

    // Remove duplicates (prefer runtime over startup)
    const uniqueArticles: any[] = [];
    const seenUrls = new Set<string>();
    
    // First add runtime articles (higher priority)
    allArticles.filter(a => a.source === 'runtime').forEach(article => {
      if (!seenUrls.has(article.url)) {
        uniqueArticles.push(article);
        seenUrls.add(article.url);
      }
    });
    
    // Then add startup articles for URLs not seen
    allArticles.filter(a => a.source === 'startup').forEach(article => {
      if (!seenUrls.has(article.url)) {
        uniqueArticles.push(article);
        seenUrls.add(article.url);
      }
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
    const documentCount = await vectorStoreService.getDocumentCount();
    
    res.json({
      processing: processingStatus,
      vectorStore: {
        totalDocuments: documentCount,
        healthy: await vectorStoreService.checkHealth(),
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
    const vectorStoreHealthy = await vectorStoreService.checkHealth();
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
    await vectorStoreService.deleteCollection();
    await vectorStoreService.initialize();
    
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