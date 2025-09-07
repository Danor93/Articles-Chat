import { Router, Request, Response } from 'express';
import { langchainService } from '../services/langchain.service';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest, chatValidationRules } from '../middleware/validation';
import { createError, ErrorCode } from '../utils/errors';

const router = Router();

interface ChatRequest {
  query: string;
  conversationId?: string;
}

interface ChunkSource {
  article_id: string;
  article_title: string;
  chunk_id: string;
  content: string;
  relevance: number;
  position: number;
}

interface ChatResponse {
  response: string;
  conversationId: string;
  timestamp: string;
  sources?: ChunkSource[];
  tokensUsed?: number;
  processingTime?: number;
  format?: string;
  questionType?: string;
  metadata?: any;
}

router.post('/', 
  validateRequest(chatValidationRules),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, conversationId = 'default' }: ChatRequest = req.body;

    console.log(`Processing chat query: ${query.substring(0, 100)}...`);

    // Check if services are initialized
    if (!langchainService.isInitialized()) {
      throw createError(
        ErrorCode.SERVICE_NOT_INITIALIZED,
        'Chat service is not initialized'
      );
    }

    const formattedResponse = await langchainService.processChat(query, conversationId);

    const chatResponse: ChatResponse = {
      response: formattedResponse.answer,
      conversationId,
      timestamp: new Date().toISOString(),
      format: formattedResponse.format,
      questionType: formattedResponse.metadata?.questionType,
      sources: formattedResponse.metadata?.sources || [],
      tokensUsed: formattedResponse.metadata?.tokensUsed || 0,
      processingTime: formattedResponse.metadata?.processingTime || 0,
      metadata: formattedResponse.metadata,
    };

    res.json(chatResponse);
  })
);

router.post('/stream', 
  validateRequest(chatValidationRules),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, conversationId = 'default' }: ChatRequest = req.body;

    console.log(`Processing streaming chat query: ${query.substring(0, 100)}...`);

    // Check if services are initialized
    if (!langchainService.isInitialized()) {
      throw createError(
        ErrorCode.SERVICE_NOT_INITIALIZED,
        'Chat service is not initialized'
      );
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    try {
      const stream = await langchainService.processChatStreaming(query, conversationId);

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Streaming error:', error);
      const errorDetails = createError(
        ErrorCode.PROCESSING_ERROR,
        error instanceof Error ? error.message : 'Streaming failed'
      ).toJSON();
      res.write(`data: ${JSON.stringify({ 
        error: errorDetails.code,
        message: errorDetails.message,
        done: true
      })}\n\n`);
      res.end();
    }
  })
);

router.get('/history/:conversationId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { conversationId } = req.params;
  
  if (!conversationId) {
    throw createError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Conversation ID is required'
    );
  }

  const history = langchainService.getConversationHistory(conversationId);
  
  if (history.length === 0) {
    throw createError(
      ErrorCode.CONVERSATION_NOT_FOUND,
      `No history found for conversation: ${conversationId}`
    );
  }
  
  res.json({
    conversationId,
    messages: history,
    messageCount: history.length,
  });
}));

router.delete('/history/:conversationId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { conversationId } = req.params;
  
  if (!conversationId) {
    throw createError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Conversation ID is required'
    );
  }

  langchainService.clearConversationHistory(conversationId);
  
  res.json({
    message: `Conversation history cleared for ${conversationId}`,
    conversationId,
  });
}));

router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await langchainService.getStats();
  res.json(stats);
}));

export { router as chatRoutes };