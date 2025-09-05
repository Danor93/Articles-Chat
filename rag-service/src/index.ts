import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { chatRoutes } from './routes/chat.routes';
import { articlesRoutes } from './routes/articles.routes';
import { startupLoader } from './utils/startup-loader';
import { faissVectorStoreService } from './services/faiss-vectorstore.service';
import { claudeService } from './services/claude.service';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { createError, ErrorCode } from './utils/errors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// Validate required environment variables
const requiredEnvVars = ['ANTHROPIC_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add request ID middleware
app.use(requestIdMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res) => {
    throw createError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests from this IP, please try again later.'
    );
  },
});
app.use(limiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rag-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/health/detailed', (req, res) => {
  const services = {
    vectorStore: faissVectorStoreService.isHealthy(),
    claude: claudeService.isConfigured(),
    embeddings: true // Will be true if service starts
  };
  
  const allHealthy = Object.values(services).every(status => status);
  
  res.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    services,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/ping', (req, res) => {
  res.json({ message: 'RAG service is running' });
});

app.use('/api/chat', chatRoutes);
app.use('/api/articles', articlesRoutes);

// 404 handler
app.use('*', notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

async function startServer() {
  try {
    console.log('Starting RAG service...');
    
    await startupLoader.initialize();
    console.log('Startup loader initialized');
    
    app.listen(PORT, () => {
      console.log(`RAG service running on port ${PORT}`);
      console.log(`Health check: http://${HOST}:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();