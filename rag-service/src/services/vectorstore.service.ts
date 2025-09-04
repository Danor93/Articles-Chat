import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Document } from '@langchain/core/documents';
import { embeddingsService } from './embeddings.service';

export class VectorStoreService {
  private client: QdrantClient;
  private vectorStore: QdrantVectorStore | null = null;
  private readonly collectionName = 'articles';

  constructor() {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    
    this.client = new QdrantClient({
      host: qdrantUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, ''),
      port: parseInt(qdrantUrl.match(/:(\d+)$/)?.[1] || '6333'),
      https: qdrantUrl.startsWith('https'),
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureCollection();
      
      this.vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddingsService.getEmbeddings(),
        {
          client: this.client,
          collectionName: this.collectionName,
        }
      );
      
      console.log('Vector store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  private async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(col => col.name === this.collectionName);
      
      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: embeddingsService.getDimensions(),
            distance: 'Cosine',
          },
        });
        console.log(`Created collection: ${this.collectionName}`);
      } else {
        console.log(`Collection exists: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Error ensuring collection:', error);
      throw error;
    }
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      await this.vectorStore.addDocuments(documents);
      console.log(`Added ${documents.length} documents to vector store`);
      return documents.map((_, index) => `doc_${Date.now()}_${index}`);
    } catch (error) {
      console.error('Error adding documents:', error);
      throw error;
    }
  }

  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      return results;
    } catch (error) {
      console.error('Error in similarity search:', error);
      throw error;
    }
  }

  async similaritySearchWithScore(query: string, k: number = 4): Promise<[Document, number][]> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, k);
      return results;
    } catch (error) {
      console.error('Error in similarity search with score:', error);
      throw error;
    }
  }

  async getDocumentCount(): Promise<number> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return info.points_count || 0;
    } catch (error) {
      console.error('Error getting document count:', error);
      return 0;
    }
  }

  async deleteCollection(): Promise<void> {
    try {
      await this.client.deleteCollection(this.collectionName);
      console.log(`Deleted collection: ${this.collectionName}`);
    } catch (error) {
      console.error('Error deleting collection:', error);
      throw error;
    }
  }

  getVectorStore(): QdrantVectorStore {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }
    return this.vectorStore;
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      console.error('Qdrant health check failed:', error);
      return false;
    }
  }
}

export const vectorStoreService = new VectorStoreService();