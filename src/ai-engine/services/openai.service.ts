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

  async executeQuery(prompt: string): Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }> {
    console.log("GROQ API KEY is", this.groqApiKey);
    try {
      this.logger.log(`Executing query via Groq: ${prompt.substring(0, 50)}...`);

      const response = await axios.post(
        this.groqApiUrl,
        {
          model: 'llama-3.1-8b-instant', // FREE Groq model
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant advising Indian students about colleges. 
              When asked about colleges, provide a ranked list of relevant institutions with brief explanations.
              Focus on Indian colleges and universities.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
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

      return {
        success: true,
        response: aiResponse,
      };
    } catch (error) {
      // console.log("error is", error)
      this.logger.error(`Groq API error: ${error.response.data.error.message}`);
      return {
        success: false,
        error: error.response.data.error.message,
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
















// import { Injectable, Logger } from '@nestjs/common';
// import OpenAI from 'openai';

// @Injectable()
// export class OpenAIService {
//   private readonly logger = new Logger(OpenAIService.name);
//   private openai: OpenAI;

//   constructor() {
//     this.openai = new OpenAI({
//       apiKey: process.env.OPENAI_API_KEY,
//     });
//   }

// //   const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
// //   model: 'llama-3.1-70b-versatile',
// //   messages: [...]
// // });

//   async executeQuery(prompt: string): Promise<{
//     success: boolean;
//     response?: string;
//     error?: string;
//   }> {
//     try {
//       this.logger.log(`Executing query: ${prompt.substring(0, 50)}...`);

//       const completion = await this.openai.chat.completions.create({
//         model: 'gpt-4o-mini',
//         messages: [
//           {
//             role: 'system',
//             content: `You are a helpful assistant advising Indian students about colleges. 
//             When asked about colleges, provide a ranked list of relevant institutions with brief explanations.
//             Focus on Indian colleges and universities.`,
//           },
//           {
//             role: 'user',
//             content: prompt,
//           },
//         ],
//         temperature: 0.7,
//         max_tokens: 1000,
//       });

//       const response = completion.choices[0].message.content;

//       this.logger.log(`Query successful. Response length: ${response.length}`);

//       return {
//         success: true,
//         response,
//       };
//     } catch (error) {
//       this.logger.error(`OpenAI API error: ${error.message}`);
//       return {
//         success: false,
//         error: error.message,
//       };
//     }
//   }

//   private delay(ms: number): Promise<void> {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }

//   async executeQueriesBatch(prompts: string[]): Promise<Map<string, any>> {
//     const results = new Map();

//     for (const prompt of prompts) {
//       const result = await this.executeQuery(prompt);
//       results.set(prompt, result);

//       // Rate limiting: Wait 350ms between requests (3 req/sec)
//       await this.delay(350);
//     }

//     return results;
//   }
// }

