import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { PromptTemplate } from '@langchain/core/prompts';
import { claudeService } from './claude.service';
import { faissVectorStoreService } from './faiss-vectorstore.service';
import { promptEngineeringService, type FormattedResponse } from './prompt-engineering.service';
import axios from 'axios';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
}

interface ConversationHistory {
  [conversationId: string]: ChatMessage[];
}

export class LangChainService {
  private textSplitter: RecursiveCharacterTextSplitter;
  private conversationHistory: ConversationHistory = {};
  private ragChain: ConversationalRetrievalQAChain | null = null;

  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
    });
  }

  async initialize(): Promise<void> {
    try {
      await faissVectorStoreService.initialize();
      await this.initializeRAGChain();
      console.log('LangChain service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LangChain service:', error);
      throw error;
    }
  }

  private async initializeRAGChain(): Promise<void> {
    const llm = claudeService.getLLM();

    const condenseQuestionPrompt = PromptTemplate.fromTemplate(`
Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}

Follow Up Input: {question}
Standalone question:`);

    const qaPrompt = PromptTemplate.fromTemplate(`
You are a helpful AI assistant for an article chat system. Use the following pieces of context to answer the user's question. If you don't know the answer based on the context, just say that you don't have enough information to answer accurately.

Context:
{context}

Question: {question}

Provide a comprehensive and helpful answer based on the provided articles:`);

    // Get the vector store and create a proper retriever
    const vectorStore = faissVectorStoreService.getVectorStore();
    if (!vectorStore) {
      throw new Error('Vector store not initialized');
    }

    this.ragChain = ConversationalRetrievalQAChain.fromLLM(
      llm,
      vectorStore.asRetriever({
        k: parseInt(process.env.RAG_SEARCH_RESULTS || '4'),
      }),
      {
        memory: new BufferMemory({
          memoryKey: 'chat_history',
          inputKey: 'question',
          outputKey: 'text',
          returnMessages: true,
        }),
        verbose: process.env.NODE_ENV === 'development',
      }
    );
  }

  async processArticle(url: string, content: string): Promise<string[]> {
    try {
      const chunks = await this.textSplitter.splitText(content);
      
      const documents = chunks.map((chunk, index) => new Document({
        pageContent: chunk,
        metadata: {
          source: url,
          chunk_index: index,
          total_chunks: chunks.length,
          processed_at: new Date().toISOString(),
        },
      }));

      await faissVectorStoreService.addDocuments(documents);
      const ids = documents.map((_, index) => `${url}_chunk_${index}`);
      console.log(`Processed article ${url} into ${chunks.length} chunks`);
      
      return ids;
    } catch (error) {
      console.error(`Error processing article ${url}:`, error);
      throw error;
    }
  }

  async processChat(query: string, conversationId: string = 'default', providedHistory: ChatMessage[] = []): Promise<FormattedResponse> {
    if (!this.ragChain) {
      throw new Error('RAG chain not initialized');
    }

    try {
      // Use provided history if available, otherwise fall back to internal memory
      const historyToUse = providedHistory.length > 0 ? providedHistory : (this.conversationHistory[conversationId] || []);

      // Classify the question type
      const questionType = promptEngineeringService.classifyQuestion(query);

      // Handle articles list requests specially
      if (questionType.type === 'articles_list') {
        return await this.handleArticlesListRequest(query, conversationId, historyToUse);
      }

      // Get relevant documents with scores
      const relevantDocsWithScores = await faissVectorStoreService.similaritySearchWithScore(query, parseInt(process.env.RAG_SEARCH_RESULTS || '4'));
      const context = relevantDocsWithScores.map(([doc]) => doc.pageContent).join('\n\n');

      // Build structured sources from relevant documents
      const sources = relevantDocsWithScores.map(([doc, score], index) => ({
        article_id: doc.metadata.source || 'unknown',
        article_title: this.extractTitleFromUrl(doc.metadata.source || ''),
        chunk_id: `${doc.metadata.source}_chunk_${doc.metadata.chunk_index || index}`,
        content: doc.pageContent.substring(0, 200) + '...', // Truncate for size
        relevance: Math.round((1 - score) * 100) / 100, // Convert distance to relevance (lower distance = higher relevance)
        position: index
      }));

      // Generate specialized prompt based on question type and include conversation context
      const specializedPrompt = promptEngineeringService.generatePrompt(query, questionType, context, historyToUse);

      // Convert history to Claude message format
      const messages = claudeService.formatMessagesFromHistory(historyToUse);
      messages.push({
        role: 'user',
        content: specializedPrompt,
      } as any);

      const rawResponse = await claudeService.generateResponse(messages);
      
      // Format the response based on question type and include sources
      const formattedResponse = promptEngineeringService.formatResponse(rawResponse, questionType, query);
      
      // Add sources to metadata
      formattedResponse.metadata = {
        ...formattedResponse.metadata,
        questionType: formattedResponse.metadata?.questionType || questionType.type,
        sources,
        tokensUsed: 0, // Claude service would need to provide this
        processingTime: Date.now() - Date.now() // This should be calculated properly
      };
      
      // Only update internal history if no external history was provided
      if (providedHistory.length === 0) {
        this.addToHistory(conversationId, query, formattedResponse.answer);
      }
      
      return formattedResponse;
    } catch (error) {
      console.error('Chat processing error:', error);
      throw new Error(`Failed to process chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processChatStreaming(query: string, conversationId: string = 'default', providedHistory: ChatMessage[] = []): Promise<AsyncIterable<string>> {
    if (!this.ragChain) {
      throw new Error('RAG chain not initialized');
    }

    try {
      // Use provided history if available, otherwise fall back to internal memory
      const historyToUse = providedHistory.length > 0 ? providedHistory : (this.conversationHistory[conversationId] || []);

      // Classify the question type
      const questionType = promptEngineeringService.classifyQuestion(query);

      // Get relevant documents
      const relevantDocs = await faissVectorStoreService.similaritySearch(query, parseInt(process.env.RAG_SEARCH_RESULTS || '4'));
      const context = relevantDocs.map((doc: Document) => doc.pageContent).join('\n\n');

      // Generate specialized prompt based on question type and include conversation context
      const specializedPrompt = promptEngineeringService.generatePrompt(query, questionType, context, historyToUse);
      
      const messages = claudeService.formatMessagesFromHistory(historyToUse);
      messages.push({
        role: 'user',
        content: specializedPrompt,
      } as any);

      const stream = await claudeService.generateStreamingResponse(messages);
      
      let fullResponse = '';
      // Only update internal history if no external history was provided
      const shouldUpdateHistory = providedHistory.length === 0;
      const processedStream = this.processStreamWithHistory(stream, conversationId, query, fullResponse, shouldUpdateHistory);
      
      return processedStream;
    } catch (error) {
      console.error('Streaming chat error:', error);
      throw new Error(`Failed to process streaming chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async *processStreamWithHistory(
    stream: AsyncIterable<string>, 
    conversationId: string, 
    query: string, 
    fullResponse: string,
    shouldUpdateHistory: boolean = true
  ): AsyncIterable<string> {
    for await (const chunk of stream) {
      fullResponse += chunk;
      yield chunk;
    }
    
    if (shouldUpdateHistory) {
      this.addToHistory(conversationId, query, fullResponse);
    }
  }

  private formatChatHistory(conversationId: string): string {
    const history = this.conversationHistory[conversationId] || [];
    return history
      .slice(-10)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  private addToHistory(conversationId: string, userMessage: string, assistantMessage: string): void {
    if (!this.conversationHistory[conversationId]) {
      this.conversationHistory[conversationId] = [];
    }

    this.conversationHistory[conversationId].push(
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      }
    );

    if (this.conversationHistory[conversationId].length > 50) {
      this.conversationHistory[conversationId] = this.conversationHistory[conversationId].slice(-40);
    }
  }

  getConversationHistory(conversationId: string): ChatMessage[] {
    return this.conversationHistory[conversationId] || [];
  }

  clearConversationHistory(conversationId: string): void {
    delete this.conversationHistory[conversationId];
  }

  async getStats(): Promise<{
    totalDocuments: number;
    conversations: number;
    totalMessages: number;
  }> {
    const totalDocuments = 0; // FAISS doesn't provide direct document count
    const conversations = Object.keys(this.conversationHistory).length;
    const totalMessages = Object.values(this.conversationHistory)
      .reduce((sum, history) => sum + history.length, 0);

    return {
      totalDocuments,
      conversations,
      totalMessages,
    };
  }

  isInitialized(): boolean {
    return !!this.ragChain && faissVectorStoreService.isHealthy() && claudeService.isConfigured();
  }

  private extractTitleFromUrl(url: string): string {
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

  private async handleArticlesListRequest(query: string, conversationId: string, historyToUse: ChatMessage[]): Promise<FormattedResponse> {
    try {
      // Try to get articles from the API first (preferred method)
      let sourceArticles = [];
      let articlesData = { total: 0, articles: [] };
      
      try {
        // Make HTTP request to the articles list endpoint
        const axios = require('axios');
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        
        const response = await axios.get(`${baseUrl}/api/articles/list`, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.data) {
          articlesData = response.data;
          sourceArticles = response.data.articles || [];
        }
      } catch (apiError) {
        // Fallback to reading from file
        const fs = require('fs');
        const path = require('path');
        
        // Try multiple possible paths for the articles.json file
        const possiblePaths = [
          process.env.ARTICLES_JSON_PATH,
          path.join(__dirname, '../../../data/articles.json'),
          path.join(process.cwd(), 'data/articles.json'),
          '/app/data/articles.json',
          'C:/Users/danor/Desktop/RnD/Article-Chat/data/articles.json'
        ].filter(p => p); // Remove undefined/null paths
        
        for (const articlesPath of possiblePaths) {
          try {
            if (fs.existsSync(articlesPath)) {
              const fileContent = fs.readFileSync(articlesPath, 'utf-8');
              sourceArticles = JSON.parse(fileContent);
              articlesData = {
                total: sourceArticles.length,
                articles: sourceArticles
              };
              break;
            }
          } catch (fileError) {
            // Silent fallback - continue trying other paths
          }
        }
      }
      
      // Update prompt engineering service with metadata
      if (sourceArticles.length > 0) {
        promptEngineeringService.setArticleMetadata(sourceArticles);
      }

      let articlesListText = '';
      if (articlesData.articles && articlesData.articles.length > 0) {
        articlesListText = `## Available Articles (${articlesData.total} total)

${articlesData.articles.map((article: any, index: number) => {
  const domain = article.url ? new URL(article.url).hostname.replace('www.', '') : 'unknown';
  return `${index + 1}. **${article.title}**
   - Source: ${domain}
   - URL: ${article.url}`;
}).join('\n\n')}

## Categories Available
Based on the sources, articles cover topics in:
${[...new Set(articlesData.articles.map((a: any) => new URL(a.url).hostname.replace('www.', '')))]
  .map(domain => `• ${domain}`)
  .join('\n')}`;
      } else {
        articlesListText = `## No Articles Currently Available

The knowledge base doesn't currently contain any processed articles. Articles need to be added and processed before I can provide analysis and insights.

To add articles, you would typically:
1. Use the Articles tab to add new articles
2. Wait for processing to complete
3. Then I can analyze and answer questions about the content`;
      }

      // Generate the specialized prompt
      const specializedPrompt = promptEngineeringService.generatePrompt(query, 
        { type: 'articles_list', confidence: 1.0 }, 
        articlesListText, 
        historyToUse
      );

      // Use Claude service to format the response
      const messages = claudeService.formatMessagesFromHistory(historyToUse);
      messages.push({
        role: 'user',
        content: specializedPrompt,
      } as any);

      const rawResponse = await claudeService.generateResponse(messages);
      
      // Format the response
      const formattedResponse = promptEngineeringService.formatResponse(rawResponse, 
        { type: 'articles_list', confidence: 1.0 }, 
        query
      );
      
      // Add metadata
      formattedResponse.metadata = {
        ...formattedResponse.metadata,
        questionType: 'articles_list',
        articlesCount: articlesData.total || 0,
        sources: [],
        tokensUsed: 0,
        processingTime: Date.now() - Date.now()
      };
      
      return formattedResponse;
    } catch (error) {
      console.error('Error handling articles list request:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        error: error
      });
      
      // Fallback response
      const fallbackResponse = `I apologize, but I'm having trouble accessing the articles list at the moment. This could be because:

1. No articles have been processed yet
2. The articles service is temporarily unavailable
3. There was an error retrieving the information

To add articles to my knowledge base:
• Use the Articles tab in the application
• Add article URLs for processing  
• Wait for processing to complete
• Then I'll be able to analyze and discuss the content

You can try asking about available articles again in a moment, or feel free to ask me other questions!`;

      return {
        answer: fallbackResponse,
        format: 'conversational',
        metadata: {
          questionType: 'articles_list',
          articlesCount: 0,
          sources: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

export const langchainService = new LangChainService();