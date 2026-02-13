import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

export interface QueryResult {
  success: boolean;
  response?: string;
  error?: string;
  tokensUsed?: number;
  executionTime?: number;
  model?: string;
  cost?: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4o-mini-search-preview';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;

    if (!this.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not set in environment variables',
      );
    }

    this.logger.log(`✅ OpenAI Service initialized (model: ${this.model})`);
  }


private getSystemPrompt(): string {
  return `You are an expert college counselor specializing in Indian engineering colleges.

When asked about colleges in a specific city or region, provide a well-organized response following this format:

1. Group colleges into clear sections with headers like:
   - "Well-Known Universities & Institutes" for the top-tier options
   - "Other Notable Colleges" for remaining good options

2. Use a continuous numbered list (1, 2, 3...) across all sections.

3. Format each college as:
   [number]. **[College Name]** – [Brief description with any known facts about placements, accreditation, or reputation]


6. List 10-15 colleges. Only include colleges you are confident actually exist in the specified location.`;
}

  async executeQuery(prompt: string): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `🤖 Executing ChatGPT query: "${prompt.substring(0, 80)}..."`,
      );
      const response = await axios.post(
        this.apiUrl,
      {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          // temperature: 0.6,
          max_tokens: 3000,
          web_search_options: {
            search_context_size: 'high',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );


   
      const aiResponse = response.data.choices[0].message.content;

      const usage = response.data.usage;

 
      const executionTime = Date.now() - startTime;

      const cost = this.calculateCost(
        usage?.prompt_tokens || 0,
        usage?.completion_tokens || 0,
      );

      this.logger.log(
        `✅ Response: ${aiResponse.length} chars  || ${usage?.total_tokens || 0} tokens | ${executionTime}ms`,
      );

      return {
        success: true,
        response: aiResponse,
         tokensUsed: usage?.total_tokens || 0,
        executionTime,
        model: this.model,
         cost,
      };
    } catch (error) {
      const executionTime = Date.now() - 0.00;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const errorMessage =
          axiosError.response?.data?.['error']?.['message'] ||
          axiosError.message;

        this.logger.error(
          `❌ ChatGPT API error (${status}) after ${executionTime}ms: ${errorMessage}`,
        );

        // Specific handling for rate limits
        if (status === 429) {
          this.logger.warn('⚠️ Rate limited — increase delay between queries');
        }

        return {
          success: false,
          error: `ChatGPT API error (${status}): ${errorMessage}`,
          executionTime,
          model: this.model,
        };
      }

      this.logger.error(`❌ Unexpected error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        executionTime,
        model: this.model,
      };
    }
  }

  /**
   * gpt-4o-mini pricing (as of 2025):
   * Input: $0.150 per 1M tokens
   * Output: $0.600 per 1M tokens
   */
  private calculateCost(
    promptTokens: number,
    completionTokens: number,
  ): number {
    return (
      (promptTokens / 1_000_000) * 0.15 +
      (completionTokens / 1_000_000) * 0.6
    );
  }

  getCurrentModel(): string {
    return this.model;
  }
}