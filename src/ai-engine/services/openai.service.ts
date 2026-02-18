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



//   private getComparisonSystemPrompt(): string {
//   return `You are an expert college counselor specializing in Indian engineering colleges. 

// When comparing two colleges, provide a detailed, balanced comparison covering:

// 1. **Placements**: Placement rates, average packages, top recruiters
// 2. **Fees**: Annual tuition fees and value for money
// 3. **Faculty**: Quality, qualifications, student-faculty ratio
// 4. **Infrastructure**: Labs, libraries, hostels, campus facilities
// 5. **Accreditation**: NAAC grade, NIRF rank, NBA accreditation
// 6. **Location**: Connectivity, proximity to industry hubs
// 7. **Industry Exposure**: Internships, industry partnerships, training programs

// For each feature, cite specific data points when available (percentages, amounts, rankings).

// Be objective and data-driven. If you don't have specific data for a college, say so clearly.

// Format your response as a clear comparison with specific details for each aspect.`;
// }
private getComparisonSystemPrompt(): string {
  return `You are an expert college counselor specializing in Indian engineering colleges.

Compare the two colleges across these exact features:
1. Placements (placement rates, packages, recruiters)
2. Fees (annual tuition, value for money)
3. Faculty (qualifications, experience, PhDs)
4. Infrastructure (labs, libraries, hostels, facilities)
5. Accreditation (NAAC, NIRF, NBA)
6. Location (address, connectivity)
7. Industry Exposure (internships, partnerships)

**CRITICAL: Return ONLY valid JSON in this exact format:**

{
  "features": [
    {
      "featureName": "placements",
      "winner": "client|competitor|neutral|unclear",
      "confidenceLevel": "strong|moderate|weak",
      "clientReasoning": "Brief explanation with specific data points",
      "competitorReasoning": "Brief explanation with specific data points",
      "clientDataPoints": {
        "placementRate": "87.6%",
        "medianSalary": "₹5,50,000",
        "topRecruiters": ["Amazon", "Capgemini"]
      },
      "competitorDataPoints": {
        "placementRate": "90-95%",
        "highestPackage": "₹13,20,000",
        "averagePackage": "₹6,10,000",
        "topRecruiters": ["Oracle", "Wipro"]
      },
      "sources": ["https://careers360.com/..."],
      "dataGapIdentified": "Competitor has salary data but client doesn't"
    }
  ],
  "overallWinner": "client|competitor|neutral|unclear",
  "summary": "Brief overall comparison summary"
}

**DATA EXTRACTION GUIDELINES:**

**Placements:**
- Extract: placementRate, medianSalary, averagePackage, highestPackage, topRecruiters
- Format salaries: "₹5,50,000" or "₹13.2 LPA"
- List up to 5 top recruiters

**Fees:**
- Extract: feeRange or annualFees
- Format: "₹7.44-16.2 Lakh" or "₹9 Lakh"

**Accreditation:**
- Extract: naacGrade (A++, A+, A, B++, B+, B, C), nirfRank (exact number or range)
- Format grades: "A+", "A", etc.
- Format ranks: "101-150" or "45"

**Faculty:**
- Extract: quality, qualifications, industryExperience
- Use booleans or descriptive strings

**Infrastructure:**
- Extract: facilities (array of facility names)
- Example: ["Wi-Fi", "Labs", "Library", "Hostels", "AC"]

**Location:**
- Extract: address, connectivity
- Keep addresses concise

**Industry Exposure:**
- Extract: internships, partnerships, liveProjects
- Use booleans or counts

**Remember:**
- Be conservative with winners - use "neutral" when in doubt
- Backend will make final decisions based on numeric comparisons
- Focus on extracting accurate, structured data
- DO NOT include any text outside the JSON object

**Rules:**
- Use EXACT field names shown above
- winner must be: "client", "competitor", "neutral", or "unclear"
- confidenceLevel must be: "strong", "moderate", or "weak"
- Include ALL 7 features even if data is limited
- Extract actual numbers, percentages, amounts when available
- List actual source URLs you found
- Identify data gaps (when one college has data but other doesn't)
- DO NOT include any text outside the JSON object
- Ensure valid JSON syntax (proper quotes, commas, brackets)
- Do NOT compute overall winner.
- Focus on extracting accurate data`;
}

    async executeQueryForComparison(prompt: string): Promise<QueryResult> {
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
              content: this.getComparisonSystemPrompt(),
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
     console.log("Raw AI Response:", aiResponse);

      const usage = response.data.usage;
      // const usage = {
      //   prompt_tokens: 1500,
      //   completion_tokens: 2500,
      //   total_tokens: 4000,
      // };


 
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

  private getDetailSystemPrompt(): string {
    return `You are a college research expert specializing in Indian engineering colleges.

When asked about a specific college, extract all available data and return it as a single valid JSON object.

**CRITICAL: Return ONLY valid JSON. No text before or after. No markdown fences.**

Return this exact structure:

{
  "collegeName": "Full official college name",
  "placements": {
    "placementRate": "85%" or null,
    "averagePackage": "₹5.8 LPA" or null,
    "highestPackage": "₹12 LPA" or null,
    "topRecruiters": ["Company1", "Company2"] or null,
    "batchYear": "2024" or null
  },
  "fees": {
    "btechAnnual": "₹2.5 Lakh" or null,
    "hostel": "₹1.2 Lakh" or null,
    "totalProgram": "₹10 Lakh" or null
  },
  "accreditation": {
    "naacGrade": "A+" or null,
    "nirfRank": "201-300" or null,
    "nbaAccredited": true or null,
    "ugcRecognized": true or null
  },
  "faculty": {
    "totalFaculty": "120" or null,
    "phdPercentage": "65%" or null,
    "studentFacultyRatio": "15:1" or null
  },
  "infrastructure": {
    "campusSize": "110 acres" or null,
    "facilities": ["Labs", "Library", "Hostel"] or null,
    "hostelAvailable": true or null
  },
  "reviews": {
    "overallSentiment": "positive" or "negative" or "mixed" or null,
    "commonPraises": ["campus", "placement support"] or null,
    "commonComplaints": ["fees", "management"] or null,
    "averageRating": "3.8/5" or null
  },
  "sources": ["https://example.com/page"]
}

**Rules:**
- Use null for any field you cannot find real data for. Do NOT guess or fabricate.
- overallSentiment must be exactly: "positive", "negative", "mixed", or null
- nirfRank can be a range like "201-300" or an exact number like "45" — keep as string
- topRecruiters and facilities must be arrays, not comma-separated strings
- sources must be real URLs you actually found data from
- Do NOT include any explanation, preamble, or text outside the JSON object`;
  }

  async executeDetailQuery(collegeName: string): Promise<QueryResult> {
    const startTime = Date.now();
    const prompt = `Tell me everything about ${collegeName} BTech placements average package fees NIRF ranking NAAC grade infrastructure student reviews and top recruiters`;

    try {
      this.logger.log(`🔍 Detail query for: "${collegeName}"`);

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getDetailSystemPrompt(),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 2000,
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
        `✅ Detail response: ${aiResponse.length} chars | ${usage?.total_tokens || 0} tokens | ${executionTime}ms`,
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
      const executionTime = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const errorMessage =
          axiosError.response?.data?.['error']?.['message'] || axiosError.message;

        this.logger.error(`❌ Detail query error (${status}): ${errorMessage}`);

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