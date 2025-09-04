import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { chatRoutes } from './routes/chat.routes';
import { articlesRoutes } from './routes/articles.routes';
import { startupLoader } from './utils/startup-loader';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
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

app.get('/ping', (req, res) => {
  res.json({ message: 'RAG service is running' });
});

app.use('/api/chat', chatRoutes);
app.use('/api/articles', articlesRoutes);

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

async function startServer() {
  try {
    console.log('Starting RAG service...');
    
    await startupLoader.initialize();
    console.log('Startup loader initialized');
    
    app.listen(PORT, () => {
      console.log(`RAG service running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
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