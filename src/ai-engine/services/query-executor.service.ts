import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from './openai.service';
import { ResponseParserService } from './response-parser.service';
import { AiQuery } from '../../database/entities/ai-query.entity';
import { College } from '../../database/entities/college.entity';
import { PromptLibrary } from '../../database/entities/prompt-library.entity';
import { Competitor } from '../../database/entities/competitor.entity';

@Injectable()
export class QueryExecutorService {
  private readonly logger = new Logger(QueryExecutorService.name);

  constructor(
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
    @InjectRepository(PromptLibrary)
    private promptRepo: Repository<PromptLibrary>,
    @InjectRepository(Competitor)
    private competitorRepo: Repository<Competitor>,
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    private openaiService: OpenAIService,
    private parserService: ResponseParserService,
  ) {}

  async executeQueriesForCollege(collegeId: number): Promise<{
    success: boolean;
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
  }> {
    this.logger.log(`Starting query execution for college ${collegeId}`);

    const college = await this.collegeRepo.findOne({
      where: { id: collegeId },
    });

    if (!college) {
      throw new Error(`College ${collegeId} not found`);
    }

    // Get all active prompts
    const prompts = await this.getPromptsForCollege(college);

    // Get competitor list
    const competitors = await this.competitorRepo.find({
      where: { collegeId, isActive: true },
    });

    // Build known college list for parsing
    const knownColleges = [
      college.collegeName,
      ...competitors.map((c) => c.competitorCollegeName),
    ];

    let successCount = 0;
    let failCount = 0;

    // Execute each prompt
    for (const prompt of prompts) {
      try {
        // Resolve placeholders
        const resolvedPrompt = this.resolvePlaceholders(
          prompt.promptText,
          college,
        );

        // Execute query
        const result = await this.openaiService.executeQuery(resolvedPrompt);

        if (result.success) {
          // Parse response with enhanced parsing
          const parsed = this.parserService.parseResponse(
            result.response,
            knownColleges,
          );

          // Find your college in results
          const yourCollege = parsed.collegesFound.find(
            (c) => c.name.toLowerCase() === college.collegeName.toLowerCase(),
          );

          // Extract competitor data with full insights
          const competitorsFound = parsed.collegesFound
            .filter(
              (c) => c.name.toLowerCase() !== college.collegeName.toLowerCase(),
            )
            .map((c) => ({
              name: c.name,
              rank: c.rank,
              context: c.context,
              reasoning: c.reasoning,
              strengths: c.strengths,
            }));

          // Save to database with new fields
          await this.queryRepo.save({
            collegeId,
            promptId: prompt.id,
            promptText: resolvedPrompt,
            promptCategory: prompt.category,
            aiEngine: 'chatgpt',
            executedAt: new Date(),
            executionStatus: 'success',
            rawResponse: result.response,
            collegesMentioned: parsed.collegesFound.map((c) => c.name),
            yourCollegeMentioned: !!yourCollege,
            yourCollegeRank: yourCollege?.rank || null,
            yourCollegeContext: yourCollege?.context || null,
            yourCollegeReasoning: yourCollege?.reasoning || null,
            yourCollegeStrengths: yourCollege?.strengths || [],
            yourCollegeWeaknesses: yourCollege?.weaknesses || [],
            competitorsMentioned: competitorsFound,
            sourcesCited: parsed.sourcesCited,
            rankingFactors: parsed.rankingFactors,
            responseLength: result.response.length,
            totalCollegesInResponse: parsed.totalColleges,
          });

          successCount++;
        } else {
          // Save failed query
          await this.queryRepo.save({
            collegeId,
            promptId: prompt.id,
            promptText: resolvedPrompt,
            promptCategory: prompt.category,
            aiEngine: 'chatgpt',
            executedAt: new Date(),
            executionStatus: 'failed',
            errorMessage: result.error,
          });

          failCount++;
        }

        // Rate limiting delay
        await this.delay(350);
      } catch (error) {
        this.logger.error(`Error executing prompt ${prompt.id}: ${error.message}`);
        failCount++;
      }
    }

    this.logger.log(
      `Completed queries for college ${collegeId}. Success: ${successCount}, Failed: ${failCount}`,
    );

    return {
      success: true,
      totalQueries: prompts.length,
      successfulQueries: successCount,
      failedQueries: failCount,
    };
  }

  private async getPromptsForCollege(
    college: College,
  ): Promise<PromptLibrary[]> {
    // Get system prompts + college's custom prompts
    const prompts = await this.promptRepo.find({
      where: [
        { isSystemPrompt: true, isActive: true },
        { collegeId: college.id, isActive: true },
      ],
    });

    return prompts;
  }

  private resolvePlaceholders(promptText: string, college: College): string {
    let resolved = promptText;

    // Replace {city}
    resolved = resolved.replace(/{city}/gi, college.city);

    // Replace {state}
    resolved = resolved.replace(/{state}/gi, college.state);

    // Replace {college_name}
    resolved = resolved.replace(/{college_name}/gi, college.collegeName);

    // Replace {program} - use first program if multiple
    // if (college.programs && college.programs.length > 0) {
    //   resolved = resolved.replace(/{program}/gi, college.programs[0]);
    // }

    return resolved;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
