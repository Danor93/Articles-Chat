import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { Document } from '@langchain/core/documents';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FaissVectorStoreService {
  private vectorStore: FaissStore | null = null;
  private embeddings: HuggingFaceTransformersEmbeddings;
  private storePath: string;

  constructor() {
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
    });
    this.storePath = process.env.FAISS_STORE_PATH || '/app/data/faiss_store';
  }

  async initialize(): Promise<void> {
    try {
      // Check if saved store exists
      const storeExists = await this.checkStoreExists();
      
      if (storeExists) {
        console.log('Loading existing FAISS store...');
        this.vectorStore = await FaissStore.load(this.storePath, this.embeddings);
        console.log('FAISS store loaded successfully');
      } else {
        console.log('Creating new FAISS store...');
        // Create with empty documents initially
        this.vectorStore = await FaissStore.fromDocuments([], this.embeddings);
        console.log('FAISS store created successfully');
      }
    } catch (error) {
      console.error('Failed to initialize FAISS store:', error);
      // Create new store if loading fails
      this.vectorStore = await FaissStore.fromDocuments([], this.embeddings);
    }
  }

  private async checkStoreExists(): Promise<boolean> {
    try {
      await fs.access(path.join(this.storePath, 'faiss.index'));
      return true;
    } catch {
      return false;
    }
  }

  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    await this.vectorStore.addDocuments(documents);
    // Save after adding documents
    await this.save();
  }

  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    return await this.vectorStore.similaritySearch(query, k);
  }

  async similaritySearchWithScore(query: string, k: number = 4): Promise<[Document, number][]> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    return await this.vectorStore.similaritySearchWithScore(query, k);
  }

  async save(): Promise<void> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    // Ensure directory exists
    await fs.mkdir(this.storePath, { recursive: true });
    await this.vectorStore.save(this.storePath);
    console.log('FAISS store saved to disk');
  }

  async deleteAll(): Promise<void> {
    // Create new empty store
    this.vectorStore = await FaissStore.fromDocuments([], this.embeddings);
    await this.save();
  }

  isHealthy(): boolean {
    return this.vectorStore !== null;
  }

  getEmbeddings(): HuggingFaceTransformersEmbeddings {
    return this.embeddings;
  }

  getVectorStore(): FaissStore | null {
    return this.vectorStore;
  }
}

export const faissVectorStoreService = new FaissVectorStoreService();