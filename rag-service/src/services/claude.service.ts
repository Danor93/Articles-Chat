import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

export class ClaudeService {
  private llm: ChatAnthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.llm = new ChatAnthropic({
      apiKey,
      model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-latest",
      temperature: parseFloat(process.env.TEMPERATURE || "0.7"),
      maxTokens: parseInt(process.env.MAX_TOKENS || "4000"),
      streaming: true,
    });
  }

  async generateResponse(messages: BaseMessage[]): Promise<string> {
    try {
      const response = await this.llm.invoke(messages);
      return response.content as string;
    } catch (error) {
      console.error("Claude API error:", error);
      throw new Error(
        `Failed to generate response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async generateStreamingResponse(
    messages: BaseMessage[]
  ): Promise<AsyncIterable<string>> {
    try {
      const stream = await this.llm.stream(messages);
      return this.processStream(stream);
    } catch (error) {
      console.error("Claude streaming error:", error);
      throw new Error(
        `Failed to generate streaming response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
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
      throw new Error(`Unknown message role: ${msg.role}`);
    });
  }

  getLLM(): ChatAnthropic {
    return this.llm;
  }
}

export const claudeService = new ClaudeService();
