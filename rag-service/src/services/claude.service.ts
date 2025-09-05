import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { createError, ErrorCode } from "../utils/errors";

export class ClaudeService {
  private llm: ChatAnthropic | null = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (this.apiKey) {
      try {
        this.llm = new ChatAnthropic({
          apiKey: this.apiKey,
          model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-latest",
          temperature: parseFloat(process.env.TEMPERATURE || "0.7"),
          maxTokens: parseInt(process.env.MAX_TOKENS || "4000"),
          streaming: true,
        });
      } catch (error) {
        console.error("Failed to initialize Claude service:", error);
        this.llm = null;
      }
    }
  }

  async generateResponse(messages: BaseMessage[]): Promise<string> {
    if (!this.llm) {
      throw createError(
        ErrorCode.MISSING_API_KEY,
        "Claude service is not initialized. Please check your ANTHROPIC_API_KEY"
      );
    }

    try {
      const response = await this.llm.invoke(messages);
      return response.content as string;
    } catch (error) {
      console.error("Claude API error:", error);
      
      // Check for specific error types
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
      const stream = await this.llm.stream(messages);
      return this.processStream(stream);
    } catch (error) {
      console.error("Claude streaming error:", error);
      
      // Check for specific error types
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

  private async *processStream(
    stream: AsyncIterable<any>
  ): AsyncIterable<string> {
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content;
      }
    }
  }

  formatMessagesFromHistory(
    history: Array<{ role: string; content: string }>
  ): BaseMessage[] {
    return history.map((msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);
      }
      throw createError(
        ErrorCode.VALIDATION_ERROR,
        `Unknown message role: ${msg.role}. Expected 'user' or 'assistant'`
      );
    });
  }

  getLLM(): ChatAnthropic {
    if (!this.llm) {
      throw createError(
        ErrorCode.SERVICE_NOT_INITIALIZED,
        "Claude service is not initialized"
      );
    }
    return this.llm;
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.llm;
  }
}

export const claudeService = new ClaudeService();
