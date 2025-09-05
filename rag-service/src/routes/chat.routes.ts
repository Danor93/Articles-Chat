import { Router, Request, Response } from 'express';
import { langchainService } from '../services/langchain.service';

const router = Router();

interface ChatRequest {
  query: string;
  conversationId?: string;
}

interface ChatResponse {
  response: string;
  conversationId: string;
  timestamp: string;
  sources?: string[];
  format?: string;
  questionType?: string;
  metadata?: any;
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, conversationId = 'default' }: ChatRequest = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ 
        error: 'Query is required and must be a string' 
      });
      return;
    }

    console.log(`Processing chat query: ${query.substring(0, 100)}...`);

    const formattedResponse = await langchainService.processChat(query, conversationId);

    const chatResponse: ChatResponse = {
      response: formattedResponse.answer,
      conversationId,
      timestamp: new Date().toISOString(),
      format: formattedResponse.format,
      questionType: formattedResponse.metadata?.questionType,
      sources: formattedResponse.metadata?.sources,
      metadata: formattedResponse.metadata,
    };

    res.json(chatResponse);
  } catch (error) {
    console.error('Chat route error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat query',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, conversationId = 'default' }: ChatRequest = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ 
        error: 'Query is required and must be a string' 
      });
      return;
    }

    console.log(`Processing streaming chat query: ${query.substring(0, 100)}...`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    const stream = await langchainService.processChatStreaming(query, conversationId);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Streaming chat route error:', error);
    res.write(`data: ${JSON.stringify({ 
      error: 'Failed to process streaming chat query',
      message: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    res.end();
  }
});

router.get('/history/:conversationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      res.status(400).json({ 
        error: 'Conversation ID is required' 
      });
      return;
    }

    const history = langchainService.getConversationHistory(conversationId);
    
    res.json({
      conversationId,
      messages: history,
      messageCount: history.length,
    });
  } catch (error) {
    console.error('Get history route error:', error);
    res.status(500).json({ 
      error: 'Failed to get conversation history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/history/:conversationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      res.status(400).json({ 
        error: 'Conversation ID is required' 
      });
      return;
    }

    langchainService.clearConversationHistory(conversationId);
    
    res.json({
      message: `Conversation history cleared for ${conversationId}`,
      conversationId,
    });
  } catch (error) {
    console.error('Clear history route error:', error);
    res.status(500).json({ 
      error: 'Failed to clear conversation history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await langchainService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats route error:', error);
    res.status(500).json({ 
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as chatRoutes };