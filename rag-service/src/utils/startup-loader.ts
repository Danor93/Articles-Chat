import * as fs from 'fs';
import * as path from 'path';
import { langchainService } from '../services/langchain.service';
import { vectorStoreService } from '../services/vectorstore.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface Article {
  url: string;
  title?: string;
  category?: string;
}

export class StartupLoader {
  private readonly articlesPath: string;
  private readonly concurrentLimit: number;

  constructor() {
    this.articlesPath = process.env.ARTICLES_JSON_PATH || '/app/data/articles.json';
    this.concurrentLimit = parseInt(process.env.STARTUP_CONCURRENT_LIMIT || '3');
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Starting RAG service initialization...');
      
      await langchainService.initialize();
      console.log('✓ LangChain service initialized');
      
      await this.loadArticlesIfNeeded();
      console.log('✓ Startup initialization completed');
      
    } catch (error) {
      console.error('❌ Startup initialization failed:', error);
      throw error;
    }
  }

  private async loadArticlesIfNeeded(): Promise<void> {
    try {
      const documentCount = await vectorStoreService.getDocumentCount();
      console.log(`Current documents in vector store: ${documentCount}`);
      
      if (documentCount > 0) {
        console.log('📚 Articles already loaded in vector store, skipping startup loading');
        return;
      }

      console.log('📥 Loading articles from startup file...');
      await this.loadAndProcessArticles();
      
    } catch (error) {
      console.error('Error checking/loading articles:', error);
      throw error;
    }
  }

  private async loadAndProcessArticles(): Promise<void> {
    const articles = this.loadArticlesFromFile();
    
    if (articles.length === 0) {
      console.warn('⚠️  No articles found in articles.json');
      return;
    }

    console.log(`📖 Found ${articles.length} articles to process`);
    
    let processed = 0;
    const errors: string[] = [];

    for (let i = 0; i < articles.length; i += this.concurrentLimit) {
      const batch = articles.slice(i, i + this.concurrentLimit);
      
      console.log(`Processing batch ${Math.floor(i / this.concurrentLimit) + 1}/${Math.ceil(articles.length / this.concurrentLimit)}`);
      
      const results = await Promise.allSettled(
        batch.map(article => this.processArticle(article))
      );

      results.forEach((result, index) => {
        const article = batch[index];
        if (result.status === 'fulfilled') {
          processed++;
          console.log(`✓ Processed: ${article.title || article.url}`);
        } else {
          const error = `Failed to process ${article.url}: ${result.reason}`;
          errors.push(error);
          console.error(`❌ ${error}`);
        }
      });
    }

    console.log(`\n📊 Startup loading completed:`);
    console.log(`   ✓ Successfully processed: ${processed}/${articles.length}`);
    console.log(`   ❌ Failed: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n🔍 Errors encountered:');
      errors.forEach(error => console.log(`   - ${error}`));
    }
  }

  private loadArticlesFromFile(): Article[] {
    try {
      const fullPath = path.resolve(this.articlesPath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️  Articles file not found: ${fullPath}`);
        return [];
      }

      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const articles: Article[] = JSON.parse(fileContent);
      
      if (!Array.isArray(articles)) {
        throw new Error('Articles file must contain an array of articles');
      }

      return articles.filter(article => article.url && typeof article.url === 'string');
    } catch (error) {
      console.error('Error loading articles file:', error);
      throw new Error(`Failed to load articles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processArticle(article: Article): Promise<void> {
    try {
      const content = await this.fetchArticleContent(article.url);
      await langchainService.processArticle(article.url, content);
    } catch (error) {
      console.error(`Error processing article ${article.url}:`, error);
      throw error;
    }
  }

  private async fetchArticleContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        }
      });

      const $ = cheerio.load(response.data);
      
      $('script, style, nav, footer, aside, .ads, .advertisement, .sidebar, .menu, .header-menu').remove();
      
      let content = '';
      
      const articleSelectors = [
        'article',
        'main',
        '.content',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.story-content',
        '[role="main"]'
      ];

      for (const selector of articleSelectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          content = element.text().replace(/\s+/g, ' ').trim();
          if (content.length > 200) break;
        }
      }

      if (!content || content.length < 200) {
        content = $('body').text().replace(/\s+/g, ' ').trim();
      }

      if (!content || content.length < 100) {
        throw new Error('Article content too short or empty after extraction');
      }

      console.log(`📄 Fetched article content: ${content.length} characters from ${url}`);
      return content;
    } catch (error) {
      console.error(`Error fetching content from ${url}:`, error);
      throw new Error(`Failed to fetch article content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async reloadArticles(): Promise<void> {
    console.log('🔄 Reloading articles...');
    await this.loadAndProcessArticles();
  }

  getArticlesPath(): string {
    return this.articlesPath;
  }
}

export const startupLoader = new StartupLoader();