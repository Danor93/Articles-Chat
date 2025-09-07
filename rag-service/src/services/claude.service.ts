// Claude Service - Anthropic Claude API Integration
//
// This service manages direct communication with Anthropic's Claude API through LangChain.js.
// It provides both streaming and non-streaming responses for the Article-Chat RAG pipeline,
// handling conversation context, error mapping, and model configuration.
//
// CORE CLAUDE INTEGRATION RESPONSIBILITIES:
// 1. API Client Management: Initializes and manages ChatAnthropic LangChain client
// 2. Response Generation: Handles both streaming and non-streaming Claude responses
// 3. Message Format Conversion: Converts between internal formats and LangChain BaseMessage
// 4. Error Handling: Maps Claude API errors to standardized application error codes
// 5. Configuration Management: Manages model settings, temperature, and token limits
// 6. Authentication: Validates and manages Anthropic API key authentication
//
// MODEL CONFIGURATION:
// - Model: claude-3-7-sonnet-latest (configurable via CLAUDE_MODEL env var)
// - Temperature: 0.7 (balanced creativity vs consistency)
// - Max Tokens: 4000 (sufficient for detailed responses)
// - Streaming: Enabled for real-time response delivery
//
// ERROR HANDLING STRATEGY:
// - API Key Validation: Fails fast if ANTHROPIC_API_KEY is missing or invalid
// - Rate Limiting: Maps Claude API rate limits to standardized error responses
// - Timeout Handling: Graceful handling of network timeouts and API unavailability
// - Authentication Errors: Clear error messages for invalid API keys
//
// STREAMING CAPABILITIES:
// - Server-Sent Events: Supports real-time response streaming to frontend
// - Chunk Processing: Efficiently processes streaming response chunks
// - Error Propagation: Maintains error handling in streaming mode
//
// CONVERSATION CONTEXT:
// - Message History: Formats conversation history for Claude context
// - Role Mapping: Converts between "user"/"assistant" and LangChain message types
// - Context Preservation: Maintains conversation state across multiple turns
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { createError, ErrorCode } from "../utils/errors";

/**
 * ClaudeService - Direct integration with Anthropic's Claude API via LangChain.js
 * Handles AI response generation for the Article-Chat RAG system.
 */
export class ClaudeService {
  private llm: ChatAnthropic | null = null;  // LangChain Claude client instance
  private apiKey: string | undefined;        // Anthropic API key for authentication

  /**
   * Initialize Claude service with API key validation and model configuration
   * Fails gracefully if API key is missing - service can start but will error on use
   */
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (this.apiKey) {
      try {
        this.llm = new ChatAnthropic({
          apiKey: this.apiKey,
          model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-latest", // Latest Sonnet for best performance
          temperature: parseFloat(process.env.TEMPERATURE || "0.7"),      // Balanced creativity
          maxTokens: parseInt(process.env.MAX_TOKENS || "4000"),          // Generous response length
          streaming: true,  // Enable streaming for real-time responses
        });
      } catch (error) {
        console.error("Failed to initialize Claude service:", error);
        this.llm = null; // Service continues but will fail on API calls
      }
    }
  }

  /**
   * Generate a complete response from Claude API (non-streaming)
   * Used for standard chat responses where immediate complete response is preferred
   * 
   * @param messages - Array of conversation messages (user/assistant history + new message)
   * @returns Promise<string> - Complete Claude response text
   */
  async generateResponse(messages: BaseMessage[]): Promise<string> {
    // Validate service initialization
    if (!this.llm) {
      throw createError(
        ErrorCode.MISSING_API_KEY,
        "Claude service is not initialized. Please check your ANTHROPIC_API_KEY"
      );
    }

    try {
      // Call Claude API through LangChain with conversation context
      const response = await this.llm.invoke(messages);
      return response.content as string;
    } catch (error) {
      console.error("Claude API error:", error);
      
      // Map specific Claude API errors to standardized application errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw createError(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            "Claude API rate limit exceeded. Please try again later."
          );
        }
        if (error.message.includes('401') || error.message.includes('authentication')) {
          throw createError(
            ErrorCode.INVALID_API_KEY,
            "Invalid Anthropic API key"
          );
        }
        if (error.message.includes('timeout')) {
          throw createError(
            ErrorCode.SERVICE_UNAVAILABLE,
            "Claude API request timed out"
          );
        }
      }
      
      throw createError(
        ErrorCode.CLAUDE_API_ERROR,
        `Claude API error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate streaming response from Claude API for real-time delivery
   * Used for long responses where progressive display improves user experience
   * 
   * @param messages - Array of conversation messages for context
   * @returns AsyncIterable<string> - Stream of response chunks
   */
  async generateStreamingResponse(
    messages: BaseMessage[]
  ): Promise<AsyncIterable<string>> {
    if (!this.llm) {
      throw createError(
        ErrorCode.MISSING_API_KEY,
        "Claude service is not initialized. Please check your ANTHROPIC_API_KEY"
      );
    }

    try {
      // Initialize streaming connection to Claude API
      const stream = await this.llm.stream(messages);
      return this.processStream(stream);
    } catch (error) {
      console.error("Claude streaming error:", error);
      
      // Map streaming-specific errors to application error codes
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw createError(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            "Claude API rate limit exceeded. Please try again later."
          );
        }
        if (error.message.includes('401') || error.message.includes('authentication')) {
          throw createError(
            ErrorCode.INVALID_API_KEY,
            "Invalid Anthropic API key"
          );
        }
      }
      
      throw createError(
        ErrorCode.CLAUDE_API_ERROR,
        `Claude streaming error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Process streaming response chunks from Claude API
   * Filters and yields only content chunks, ignoring metadata
   * 
   * @private
   * @param stream - Raw Claude API streaming response
   * @yields string - Content chunks for progressive display
   */
  private async *processStream(
    stream: AsyncIterable<any>
  ): AsyncIterable<string> {
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content; // Yield only content, filter metadata
      }
    }
  }

  /**
   * Convert conversation history to LangChain BaseMessage format
   * Transforms internal message format to what Claude API expects
   * 
   * @param history - Array of conversation messages with role/content
   * @returns BaseMessage[] - LangChain-formatted message array
   */
  formatMessagesFromHistory(
    history: Array<{ role: string; content: string }>
  ): BaseMessage[] {
    return history.map((msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);    // User messages
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);       // Claude responses
      }
      throw createError(
        ErrorCode.VALIDATION_ERROR,
        `Unknown message role: ${msg.role}. Expected 'user' or 'assistant'`
      );
    });
  }

  /**
   * Get the underlying LangChain ChatAnthropic instance
   * Used by other services that need direct access to the LLM
   * 
   * @returns ChatAnthropic - Initialized Claude client
   */
  getLLM(): ChatAnthropic {
    if (!this.llm) {
      throw createError(
        ErrorCode.SERVICE_NOT_INITIALIZED,
        "Claude service is not initialized"
      );
    }
    return this.llm;
  }

  /**
   * Check if Claude service is properly configured and ready
   * Used by health checks and service initialization validation
   * 
   * @returns boolean - True if API key is set and client is initialized
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.llm;
  }
}

// Singleton instance for global use across the RAG service
// Initialized once and shared to maintain consistent Claude API configuration
export const claudeService = new ClaudeService();
