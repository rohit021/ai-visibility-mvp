import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly groqApiKey: string;
  private readonly groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY;
    
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }
  }

    private getSystemPrompt(): string {
    return `You are a helpful assistant advising Indian students about colleges.

When asked about colleges, you MUST:
1. Provide a ranked list of relevant institutions (top 5-10)
2. For EACH college, explain WHY it deserves that rank
3. Mention specific factors like: placement rates, average packages, NIRF rank, infrastructure, faculty quality, industry connections, fee structure, accreditations
4. If a college has weaknesses, mention them (e.g., "however, placement data is not publicly available")
5. Cite your sources when possible (e.g., "according to NIRF 2024", "based on Shiksha.com data")

Format your response as:
1. [College Name]
   - Rank Reason: [Why this college is ranked here]
   - Strengths: [Key strengths]
   - Weaknesses: [Any weaknesses or missing information]
   - Key Stats: [Placement %, packages, NIRF rank if known]

Focus on Indian colleges and universities. Be specific and factual.`;
  }

async executeQuery(prompt: string): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> {
  try {
    this.logger.log(`Executing query via Groq: ${prompt.substring(0, 50)}...`);

    const response = await axios.post(
      this.groqApiUrl,
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
           {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'system',
            content: `You are an expert college counselor in India. You provide accurate, factual information about Indian colleges and universities.

IMPORTANT: 
- Only recommend colleges you know FOR CERTAIN exist in the specified location
- give the reason why you mentioned each college (2-3 lines)
- give the name of the source or reason why you mentioned the college
- If you're not 100% confident about a college's location, do not include it
- Provide factual information based on your knowledge
- Format as a numbered list with descriptions

Think step-by-step:
1. First, identify the location in the query
2. Recall colleges you KNOW are in that exact location
3. List them with accurate details
4. Double-check each college is in the right city before including it`,
          },
          {
            role: 'user',
            content: `${prompt}

Please think carefully and only mention colleges you are certain are in the correct location. Format your response as:

1. [College Name] - [Description]
2. [College Name] - [Description]
etc.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
        top_p: 0.9,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const aiResponse = response.data.choices[0].message.content;

    this.logger.log(`Query successful. Response length: ${aiResponse.length}`);
    console.log('\n📝 AI RESPONSE:\n', aiResponse);

    return {
      success: true,
      response: aiResponse,
    };
  } catch (error) {
    this.logger.error(`Groq API error: ${error.response?.data?.error?.message || error.message}`);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async executeQueriesBatch(prompts: string[]): Promise<Map<string, any>> {
    const results = new Map();

    for (const prompt of prompts) {
      const result = await this.executeQuery(prompt);
      results.set(prompt, result);

      // Groq free tier: 30 req/min, so delay 2 seconds to be safe
      await this.delay(2000);
    }

    return results;
  }
}