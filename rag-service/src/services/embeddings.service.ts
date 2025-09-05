import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';

export class EmbeddingsService {
  private embeddings: HuggingFaceTransformersEmbeddings;

  constructor() {
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '50'),
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddings.embedQuery(text);
      return embedding;
    } catch (error) {
      console.error('Embedding query error:', error);
      throw new Error(`Failed to embed query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await this.embeddings.embedDocuments(texts);
      return embeddings;
    } catch (error) {
      console.error('Embedding documents error:', error);
      throw new Error(`Failed to embed documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedDocumentsBatch(texts: string[], batchSize?: number): Promise<number[][]> {
    const actualBatchSize = batchSize || parseInt(process.env.EMBEDDING_BATCH_SIZE || '100');
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += actualBatchSize) {
      const batch = texts.slice(i, i + actualBatchSize);
      console.log(`Processing embedding batch ${Math.floor(i / actualBatchSize) + 1}/${Math.ceil(texts.length / actualBatchSize)}`);
      
      try {
        const batchEmbeddings = await this.embedDocuments(batch);
        results.push(...batchEmbeddings);
      } catch (error) {
        console.error(`Error in batch ${i}-${i + actualBatchSize}:`, error);
        throw error;
      }
    }
    
    return results;
  }

  getEmbeddings(): HuggingFaceTransformersEmbeddings {
    return this.embeddings;
  }

  getDimensions(): number {
    return parseInt(process.env.EMBEDDING_DIMENSIONS || '384');
  }
}

export const embeddingsService = new EmbeddingsService();