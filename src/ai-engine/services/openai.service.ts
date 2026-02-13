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

  /**
   * System prompt optimized for structured, parseable responses.
   * 
   * KEY DESIGN DECISIONS:
   * - Asks for numbered list format (essential for parser)
   * - Asks for specific data when available (placement %, packages, NIRF)
   * - Asks for source citations in parentheses
   * - Asks for section grouping (Best Overall, Strong Private, etc.)
   * - Temperature 0.3 for consistency across runs
   * - Does NOT ask AI to invent data it doesn't have
   */
//   private getSystemPrompt(): string {
//     return `You are an expert college counselor specializing in Indian engineering colleges.

// When asked about colleges, provide a structured response with these rules:

// 1. Group colleges into sections based on quality tier:
//    - "Best Overall" for top-ranked, well-known institutions
//    - "Strong Private Colleges" for good private colleges with decent track records
//    - "Other Notable Options" for remaining options

// 2. Within each section, use a continuous numbered list (1, 2, 3... across all sections).

// 3. For each college, format as:
//    [number]. **[College Name]**: [Description with specific data]

// 4. Include specific data when you know it:
//    - Placement rate percentage
//    - Average and highest package (in LPA)
//    - NIRF rank if ranked
//    - NAAC grade if accredited
//    - Notable recruiting companies
//    - Number of industry tie-ups

// 5. If you cite information from a source, mention it in parentheses like (Shiksha) or (NIRF) or (CollegeDunia).

// 6. If you don't have specific data for a college, describe it honestly without inventing statistics.

// 7. List 8-15 colleges typically. Only include colleges you are confident exist in the specified location.`;
//   }

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

      // const response = await 

      // const response = await axios.post(
      //   this.apiUrl,
      // {
      //     model: this.model,
      //     messages: [
      //       {
      //         role: 'system',
      //         content: this.getSystemPrompt(),
      //       },
      //       {
      //         role: 'user',
      //         content: prompt,
      //       },
      //     ],
      //     // temperature: 0.6,
      //     max_tokens: 3000,
      //     web_search_options: {
      //       search_context_size: 'high',
      //     },
      //   },
      //   {
      //     headers: {
      //       Authorization: `Bearer ${this.apiKey}`,
      //       'Content-Type': 'application/json',
      //     },
      //     timeout: 60000,
      //   },
      // );

      // const aiResponse = response.data.choices[0].message.content;
      const aiResponse = `Gurugram, a prominent city in Haryana, India, offers a variety of reputable institutions for pursuing a Bachelor of Technology (B.Tech) degree. Below is a curated list of notable B.Tech colleges in Gurugram:
 
 **1. Well-Known Universities & Institutes**
 
 1. **Amity University, Gurugram** – Established in 2010, Amity University offers a diverse range of B.Tech programs, including Computer Science, Electronics & Communication, Civil, Mechanical, and Aerospace Engineering. The university is recognized by the University Grants Commission (UGC) and accredited by the National Assessment and Accreditation Council (NAAC) with an 'A' grade. ([en.wikipedia.org](https://en.wikipedia.org/wiki/Amity_University%2C_Gurgaon?utm_source=openai))
 
 2. **GD Goenka University** – Located in Sohna, Gurugram, GD Goenka University provides B.Tech courses in Computer Science, Mechanical, Civil, and Electrical Engineering. Established in 2013, the university is approved by the UGC and offers state-of-the-art facilities. ([en.wikipedia.org](https://en.wikipedia.org/wiki/GD_Goenka_University?utm_source=openai))
 
 3. **K.R. Mangalam University** – Established in 2013, K.R. Mangalam University offers B.Tech programs in Computer Science, Electronics & Communication, Mechanical, and Information Technology. The university is NAAC 'A' accredited and provides a modern campus with comprehensive facilities. ([en.wikipedia.org](https://en.wikipedia.org/wiki/K.R._Mangalam_University?utm_source=openai))
 
 4. **The NorthCap University (NCU)** – Formerly known as ITM University, NCU offers B.Tech degrees in Computer Science, Mechanical, Civil, Electronics & Communication, and Information Technology. The university is recognized by the UGC and has a strong emphasis on research and innovation. ([engineering.careers360.com](https://engineering.careers360.com/articles/best-engineering-colleges-in-haryana-rank-wise?utm_source=openai))
 
 5. **BML Munjal University (BMU)** – BMU offers B.Tech programs in Computer Science, Mechanical, Electronics & Communication, and Data Science. The university is known for its project-based learning approach and industry collaborations. ([engineering.careers360.com](https://engineering.careers360.com/articles/best-engineering-colleges-in-haryana-rank-wise?utm_source=openai))
 
 **2. Other Notable Colleges**
 
 6. **Dronacharya College of Engineering** – Established in 1998, this college offers B.Tech programs in Computer Science, Electronics & Communication, Mechanical, Civil, and Electrical Engineering. It is affiliated with Gurugram University and has a strong placement record. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 7. **KIIT College of Engineering** – Located on Sohna Road, this college provides B.Tech courses in Computer Science, Mechanical, Civil, Electronics & Communication, and Information Technology. It is known for its affordable fee structure and industry-oriented curriculum. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 8. **St. Andrews Institute of Technology and Management (SAITM)** – SAITM offers B.Tech programs in Mechanical, Civil, Electronics & Communication, and Computer Science Engineering. The institute focuses on practical learning and has collaborations with various industries. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 9. **World College of Technology and Management (WCTM)** – WCTM provides B.Tech degrees in Computer Science, Electronics & Communication, Mechanical, Civil, and Artificial Intelligence & Data Science. The college is known for its high return on investment with competitive placement packages. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 10. **Global Institute of Technology and Management (GITM)** – GITM offers B.Tech programs in Computer Science, Electronics & Communication, Mechanical, Civil, Information Technology, and Automobile Engineering. The institute has a diverse student base and provides modern infrastructure. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 11. **DPG Institute of Technology and Management (DPGITM)** – DPGITM offers B.Tech courses in Computer Science, Electrical, and CSE-IT focused programs. The institute is known for its affordable fee structure and industry collaborations. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 12. **World Institute of Technology (WIT)** – WIT provides B.Tech programs in Computer Science, Electronics & Communication, Mechanical, Civil, and Artificial Intelligence & Data Science. The college is recognized for its modern infrastructure and industry-oriented curriculum. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 13. **BM Group of Institutions** – BM Group offers B.Tech courses in Civil, Electronics & Communication, and other engineering disciplines. The institution is known for its affordable fee structure and diverse student base. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 14. **DPG Degree College** – DPG Degree College offers B.Tech programs in Artificial Intelligence & Machine Learning and other engineering streams. The college is recognized for its industry collaborations and modern infrastructure. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 15. **KIIT College of Engineering** – KIIT College offers B.Tech courses in Computer Science, Mechanical, Civil, Electronics & Communication, and Information Technology. The college is known for its affordable fee structure and industry-oriented curriculum. ([collegedunia.com](https://collegedunia.com/engineering/gurgaon-colleges?utm_source=openai))
 
 These institutions provide a range of B.Tech programs catering to various engineering disciplines, each with its unique strengths and offerings. Prospective students should consider factors such as accreditation, infrastructure, faculty expertise, industry connections, and placement records when making their decision. `;
      // const usage = response.data.usage;
      const executionTime = Date.now() - startTime;

      // const cost = this.calculateCost(
      //   usage?.prompt_tokens || 0,
      //   usage?.completion_tokens || 0,
      // );

      this.logger.log(
        `✅ Response: ${aiResponse.length} chars  || 0} tokens | ${executionTime}ms }`,
      );

      return {
        success: true,
        response: aiResponse,
        // tokensUsed: usage?.total_tokens || 0,
        executionTime,
        model: this.model,
        // cost,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

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