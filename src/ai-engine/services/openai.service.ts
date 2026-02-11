import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

interface QueryResult {
  success: boolean;
  response?: string;
  error?: string;
  tokensUsed?: number;
  executionTime?: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly groqApiKey: string;
  private readonly groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'llama-3.3-70b-versatile';

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY;

    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert college counselor specializing in Indian higher education institutions. 

Provide comprehensive, factual information about colleges with the following guidelines:
- List relevant colleges for the query (typically 5-10)
- Only recommend colleges you're confident exist in the specified location

Format your response naturally and conversationally, similar to how you would advise a student in person.`;
  }

  async executeQuery(prompt: string): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Executing Groq query: ${prompt.substring(0, 100)}...`);

      const response = await axios.post(
        this.groqApiUrl,
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
          temperature: 0.3, // Slightly more creative
          max_tokens: 2500,
          top_p: 0.9,
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const aiResponse = response.data.choices[0].message.content;
      const tokensUsed = response.data.usage?.total_tokens || 0;
      const executionTime = Date.now() - startTime;

      this.logger.log(
        `Query successful. Response: ${aiResponse.length} chars, Tokens: ${tokensUsed}, Time: ${executionTime}ms`,
      );

      return {
        success: true,
        response: aiResponse,
        tokensUsed,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const errorMessage =
          axiosError.response?.data?.['error']?.['message'] ||
          axiosError.message;

        this.logger.error(
          `Groq API error (${executionTime}ms): ${errorMessage}`,
        );

        return {
          success: false,
          error: errorMessage,
          executionTime,
        };
      }

      this.logger.error(`Unexpected error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


