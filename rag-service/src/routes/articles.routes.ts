import { Router, Request, Response } from 'express';
import { langchainService } from '../services/langchain.service';
import { vectorStoreService } from '../services/vectorstore.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
      throw new Error('Article content too short or empty');
    }

    return { title, content };
  } catch (error) {
    console.error(`Error fetching article from ${url}:`, error);
    throw new Error(`Failed to fetch article: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

router.post('/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, title }: ProcessArticleRequest = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ 
        error: 'URL is required and must be a string' 
      });
      return;
    }

    console.log(`Processing single article: ${url}`);

    const { title: fetchedTitle, content } = await fetchArticleContent(url);
    const articleTitle = title || fetchedTitle;

    const ids = await langchainService.processArticle(url, content);

    res.json({
      message: 'Article processed successfully',
      url,
      title: articleTitle,
      chunks: ids.length,
      documentIds: ids,
    });

  } catch (error) {
    console.error('Process article error:', error);
    res.status(500).json({ 
      error: 'Failed to process article',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { urls }: ProcessBatchRequest = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({ 
        error: 'URLs array is required and cannot be empty' 
      });
      return;
    }

    if (processingStatus.inProgress) {
      res.status(429).json({ 
        error: 'Batch processing already in progress',
        status: processingStatus
      });
      return;
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

    processBatchAsync(urls);

  } catch (error) {
    console.error('Batch processing error:', error);
    processingStatus.inProgress = false;
    res.status(500).json({ 
      error: 'Failed to start batch processing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

async function processBatchAsync(urls: string[]): Promise<void> {
  const concurrentLimit = parseInt(process.env.CONCURRENT_ARTICLE_LIMIT || '3');
  
  for (let i = 0; i < urls.length; i += concurrentLimit) {
    const batch = urls.slice(i, i + concurrentLimit);
    
    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          console.log(`Processing article ${processingStatus.processed + 1}/${processingStatus.total}: ${url}`);
          
          const { content } = await fetchArticleContent(url);
          await langchainService.processArticle(url, content);
          
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