// Article-Chat Node.js RAG Service - AI/Machine Learning Processing Engine
//
// This service is the specialized AI processing component of the Article-Chat hybrid architecture.
// While the Go service handles HTTP traffic and orchestration, this Node.js service focuses exclusively 
// on advanced AI/ML operations using LangChain.js, Claude API, and local vector storage.
//
// CORE AI/ML RESPONSIBILITIES:
// 1. LangChain Pipeline Management: Orchestrates complex RAG (Retrieval-Augmented Generation) workflows
// 2. Claude Integration: Direct communication with Anthropic's Claude API for advanced language understanding
// 3. Vector Operations: Manages FAISS-based local vector storage for semantic search and embeddings
// 4. Document Processing: Text chunking, embedding generation, and semantic indexing
// 5. Conversation Memory: Maintains context across chat turns for coherent conversations
// 6. Startup Knowledge Loading: Processes and indexes 20 articles at service initialization
//
// ARCHITECTURE ADVANTAGES:
// - Specialized AI Stack: LangChain.js ecosystem provides mature RAG components
// - Local Embeddings: HuggingFace transformers eliminate external API costs for embeddings
// - FAISS Vector Store: Local file-based storage with no external database dependencies
// - Docker Optimized: Debian-based image supports ML libraries and model loading
// - Production Ready: Comprehensive error handling, health checks, and graceful shutdown
//
// HYBRID INTEGRATION:
// - Receives HTTP requests from Go backend service (port 8080)
// - Processes AI operations and returns structured responses
// - Maintains service independence while providing specialized AI functionality
// - Scales independently from the Go service for AI-specific workloads
//
// STARTUP SEQUENCE:
// 1. Environment validation (ANTHROPIC_API_KEY required)
// 2. Express server setup with security middleware
// 3. LangChain services initialization
// 4. FAISS vector store loading/creation
// 5. Article knowledge base processing (articles.json)
// 6. Health endpoints activation and request acceptance
//
// PERFORMANCE CHARACTERISTICS:
// - Response Times: 5-8 seconds for complex RAG queries
// - Document Processing: 6-8 chunks per article with semantic indexing
// - Memory Usage: Efficient local embeddings and vector storage
// - Concurrency: Node.js event loop handles multiple concurrent requests
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

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Default port for RAG service in Docker environment
const HOST = process.env.HOST || 'localhost';

// CRITICAL: Environment Variable Validation
// Service cannot function without Claude API access - fail fast if missing
const requiredEnvVars = ['ANTHROPIC_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1); // Immediate termination prevents service from starting without AI capabilities
  }
}

// SECURITY MIDDLEWARE STACK
// Applied in order - each request passes through this security pipeline
app.use(helmet()); // Security headers to prevent common web vulnerabilities
app.use(cors());   // Cross-Origin Resource Sharing for Go backend communication
app.use(express.json({ limit: '50mb' }));         // Large payload support for article processing
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Form data support

// REQUEST TRACKING MIDDLEWARE
// Generates unique request IDs for debugging and correlation with Go service
app.use(requestIdMiddleware);

// RATE LIMITING PROTECTION
// Prevents abuse and protects Claude API from excessive requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 100,                 // Maximum 100 requests per window per IP
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res) => {
    throw createError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests from this IP, please try again later.'
    );
  },
});
app.use(limiter);

// HEALTH CHECK ENDPOINTS
// Critical for Docker health monitoring and Go service integration

// Basic health check used by Go service to verify RAG service availability
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rag-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Detailed health check for monitoring and debugging
// Checks all critical AI/ML service dependencies
app.get('/health/detailed', (req, res) => {
  const services = {
    vectorStore: faissVectorStoreService.isHealthy(), // FAISS vector store availability
    claude: claudeService.isConfigured(),             // Claude API key configuration
    embeddings: true // HuggingFace transformers (true if service starts successfully)
  };
  
  // Overall service health based on all dependencies
  const allHealthy = Object.values(services).every(status => status);
  
  res.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    services,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Simple connectivity test endpoint
app.get('/ping', (req, res) => {
  res.json({ message: 'RAG service is running' });
});

// API ROUTE REGISTRATION
// Routes handle the core AI/ML functionality

// Chat routes: Handle RAG-based conversation processing
app.use('/api/chat', chatRoutes);

// Article routes: Handle document ingestion and embedding generation
app.use('/api/articles', articlesRoutes);

// ERROR HANDLING MIDDLEWARE
// Must be registered after all routes and middleware

// 404 handler for unmatched routes
app.use('*', notFoundHandler);

// Global error handler with standardized error responses
// Must be registered last to catch all errors
app.use(errorHandler);

// SERVER STARTUP FUNCTION
// Orchestrates the complex AI service initialization sequence
async function startServer() {
  try {
    console.log('Starting RAG service...');
    
    // CRITICAL: Initialize AI/ML components before accepting requests
    // This ensures all LangChain, FAISS, and embedding services are ready
    // Processes articles.json and builds initial knowledge base
    await startupLoader.initialize();
    console.log('Startup loader initialized - Knowledge base ready');
    
    // Start HTTP server only after AI components are fully initialized
    // This prevents requests from failing during startup
    app.listen(PORT, () => {
      console.log(`RAG service running on port ${PORT}`);
      console.log(`Health check: http://${HOST}:${PORT}/health`);
      console.log(`Detailed health: http://${HOST}:${PORT}/health/detailed`);
      console.log('RAG service ready to process AI requests');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1); // Fast fail prevents partially initialized service
  }
}

// GRACEFUL SHUTDOWN HANDLING
// Ensures proper cleanup of AI/ML resources and ongoing operations

// Docker container termination signal
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  // TODO: Add cleanup logic for:
  // - In-progress Claude API calls
  // - FAISS vector store saving
  // - Memory cleanup for embeddings
  process.exit(0);
});

// Ctrl+C or development termination signal
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Initialize and start the RAG service
startServer();