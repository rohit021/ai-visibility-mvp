import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from './openai.service';
import { ResponseParserService } from './response-parser.service';
import { AiQuery } from '../../database/entities/ai-query.entity';
import { QueryCompetitorResult } from '../../database/entities/query-competitor-result.entity';
import { College } from '../../database/entities/college.entity';
import { Prompt } from '../../database/entities/prompt.entity';
import { CollegePrompt } from '../../database/entities/college-prompt.entity';
import { CollegeCompetitor } from '../../database/entities/college-competitor.entity';
import { AiEngine } from '../../database/entities/ai-engine.entity';
import { CitationSource } from '../../database/entities/citation-source.entity';

export interface ExecutionResult {
  success: boolean;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  errors: string[];
}

@Injectable()
export class QueryExecutorService {
  private readonly logger = new Logger(QueryExecutorService.name);

  constructor(
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
    @InjectRepository(Prompt)
    private promptRepo: Repository<Prompt>,
    @InjectRepository(CollegePrompt)
    private collegePromptRepo: Repository<CollegePrompt>,
    @InjectRepository(CollegeCompetitor)
    private competitorRepo: Repository<CollegeCompetitor>,
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    @InjectRepository(QueryCompetitorResult)
    private competitorResultRepo: Repository<QueryCompetitorResult>,
    @InjectRepository(AiEngine)
    private aiEngineRepo: Repository<AiEngine>,
    @InjectRepository(CitationSource)
    private citationSourceRepo: Repository<CitationSource>,
    private openaiService: OpenAIService,
    private parserService: ResponseParserService,
  ) {}

  async executeQueriesForCollege(collegeId: number): Promise<ExecutionResult> {
    this.logger.log(`🚀 Starting query execution for college ${collegeId}`);

    // Get college
    const college = await this.collegeRepo.findOne({
      where: { id: collegeId, isActive: true },
      relations: ['cityRelation'],
    });

    if (!college) {
      throw new NotFoundException(`College ${collegeId} not found`);
    }

    this.logger.log(`📚 College: ${college.collegeName}`);

    // ✅ CORRECT: Get college-specific prompts
    const collegePrompts = await this.collegePromptRepo.find({
      where: { 
        collegeId, 
        isEnabled: true 
      },
      relations: ['prompt', 'prompt.category'],
      order: { priority: 'DESC', id: 'ASC' },
    });

    if (collegePrompts.length === 0) {
      this.logger.warn('⚠️ No prompts assigned to this college. Assigning default system prompts...');
      
      // Auto-assign system prompts if none exist
      await this.autoAssignSystemPrompts(collegeId);
      
      // Fetch again
      const retryPrompts = await this.collegePromptRepo.find({
        where: { 
          collegeId, 
          isEnabled: true 
        },
        relations: ['prompt', 'prompt.category'],
        order: { priority: 'DESC', id: 'ASC' },
      });
      
      if (retryPrompts.length === 0) {
        return {
          success: false,
          totalQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          errors: ['No prompts available for this college'],
        };
      }
    }

    const prompts = collegePrompts.map(cp => cp.prompt);
    this.logger.log(`📝 Found ${prompts.length} college-specific prompts to execute`);

    // Get competitors
    const competitors = await this.competitorRepo.find({
      where: { collegeId, isActive: true },
      relations: ['competitorCollege', 'competitorCollege.cityRelation'],
    });

    const competitorNames = competitors.map((c) => c.competitorCollege.collegeName);
    const competitorMap = new Map<string, number>();
    
    competitors.forEach((comp) => {
      const normalizedName = comp.competitorCollege.collegeName.toLowerCase().trim();
      competitorMap.set(normalizedName, comp.competitorCollegeId);
    });

    this.logger.log(`🎯 Tracking ${competitors.length} competitors: ${competitorNames.join(', ')}`);

    // Get ChatGPT AI Engine
    const aiEngine = await this.aiEngineRepo.findOne({
      where: { engineName: 'chatgpt', isActive: true },
    });

    if (!aiEngine) {
      throw new NotFoundException('ChatGPT AI Engine not configured');
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // Execute each prompt
    for (const prompt of prompts) {
      try {
        const resolvedPrompt = this.resolvePlaceholders(prompt.promptTemplate, college);

        this.logger.log(`\n${'='.repeat(60)}`);
        this.logger.log(`📤 Executing: ${prompt.category?.categoryName} - "${resolvedPrompt}"`);

        // Execute query
        const result = await this.openaiService.executeQuery(resolvedPrompt);

        if (result.success) {
          this.logger.log(`✅ AI Response received (${result.response.length} chars)`);

          // Parse response
          const parsed = this.parserService.parseResponse(
            result.response,
            college.collegeName,
            competitorNames,
          );

          this.logger.log(`📊 Parsed ${parsed.collegesFound.length} colleges from response`);

          // Find YOUR college in results
          const yourCollege = parsed.collegesFound.find(
            (c) => c.name.toLowerCase() === college.collegeName.toLowerCase(),
          );

          if (yourCollege) {
            this.logger.log(`🎓 Your College: Rank ${yourCollege.rank}, Section: ${yourCollege.section}`);
          } else {
            this.logger.log(`❌ Your college NOT mentioned in response`);
          }

          // Get or create citation source for your college
          let sourceId: number | null = null;
          if (yourCollege?.sourceCited) {
            const source = await this.getOrCreateSource(yourCollege.sourceCited);
            sourceId = source?.id || null;
          }

          // Create AI Query record
          const aiQuery = this.queryRepo.create({
            collegeId,
            promptId: prompt.id,
            aiEngineId: aiEngine.id,
            resolvedPromptText: resolvedPrompt,
            executedAt: new Date(),
            executionStatus: 'success',
            rawResponse: result.response,
            responseLength: result.response.length,
            totalCollegesInResponse: parsed.totalColleges,
            yourCollegeMentioned: !!yourCollege,
            yourCollegeRank: yourCollege?.rank || null,
            yourCollegeSection: yourCollege?.section || null,
            yourCollegeContext: yourCollege?.context || null,
            yourCollegeReasoning: yourCollege?.reasoning || null,
            yourCollegeSourceId: sourceId,
            yourCollegeStrengths: yourCollege?.strengths || [],
            yourCollegeWeaknesses: yourCollege?.weaknesses || [],
          });

          const savedQuery = await this.queryRepo.save(aiQuery);
          this.logger.log(`💾 Saved query #${savedQuery.id}`);

          // Save competitor results
          let competitorsSaved = 0;
          for (const collegeResult of parsed.collegesFound) {
            // Skip if it's the client's college
            if (collegeResult.name.toLowerCase() === college.collegeName.toLowerCase()) {
              continue;
            }

            // Try to find matching competitor college ID
            const normalizedName = collegeResult.name.toLowerCase().trim();
            let competitorCollegeId = competitorMap.get(normalizedName);

            // If not in tracked competitors, try to find in colleges table
            if (!competitorCollegeId) {
              const foundCollege = await this.collegeRepo
                .createQueryBuilder('college')
                .where('LOWER(college.collegeName) = :name', { name: normalizedName })
                .andWhere('college.isActive = :active', { active: true })
                .getOne();
              
              competitorCollegeId = foundCollege?.id || null;
            }

            // Skip if we can't identify the college
            if (!competitorCollegeId) {
              this.logger.warn(`⚠️ Could not identify college ID for: "${collegeResult.name}"`);
              continue;
            }

            // Get or create source for this result
            let resultSourceId: number | null = null;
            if (collegeResult.sourceCited) {
              const source = await this.getOrCreateSource(collegeResult.sourceCited);
              resultSourceId = source?.id || null;
            }

            const competitorResult = this.competitorResultRepo.create({
              queryId: savedQuery.id,
              collegeId: competitorCollegeId,
              rankPosition: collegeResult.rank,
              section: collegeResult.section,
              context: collegeResult.context,
              reasoning: collegeResult.reasoning,
              sourceId: resultSourceId,
              strengths: collegeResult.strengths,
            });

            await this.competitorResultRepo.save(competitorResult);
            competitorsSaved++;
          }

          this.logger.log(`✅ Saved ${competitorsSaved} competitor results`);
          successCount++;
        } else {
          this.logger.error(`❌ Query failed: ${result.error}`);

          // Save failed query
          const aiQuery = this.queryRepo.create({
            collegeId,
            promptId: prompt.id,
            aiEngineId: aiEngine.id,
            resolvedPromptText: resolvedPrompt,
            executedAt: new Date(),
            executionStatus: 'failed',
            errorMessage: result.error,
          });

          await this.queryRepo.save(aiQuery);
          errors.push(`Prompt ${prompt.id}: ${result.error}`);
          failCount++;
        }

        // Rate limiting delay
        this.logger.log(`⏱️ Waiting 2 seconds before next query...`);
        await this.delay(2000);
      } catch (error) {
        this.logger.error(`💥 Error executing prompt ${prompt.id}: ${error.message}`);
        errors.push(`Prompt ${prompt.id}: ${error.message}`);
        failCount++;
      }
    }

    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log(`🏁 EXECUTION COMPLETE`);
    this.logger.log(`   ✅ Success: ${successCount}`);
    this.logger.log(`   ❌ Failed: ${failCount}`);
    this.logger.log(`${'='.repeat(60)}\n`);

    return {
      success: failCount < prompts.length,
      totalQueries: prompts.length,
      successfulQueries: successCount,
      failedQueries: failCount,
      errors,
    };
  }

  /**
   * Auto-assign system prompts to a college if none exist
   */
  private async autoAssignSystemPrompts(collegeId: number): Promise<void> {
    this.logger.log(`🔧 Auto-assigning system prompts to college ${collegeId}...`);

    // Get all active system prompts
    const systemPrompts = await this.promptRepo.find({
      where: { isActive: true, isSystemPrompt: true },
      order: { id: 'ASC' },
    });

    if (systemPrompts.length === 0) {
      this.logger.warn('⚠️ No system prompts found in database');
      return;
    }

    // Create college_prompts entries
    const collegePrompts = systemPrompts.map((prompt, index) => 
      this.collegePromptRepo.create({
        collegeId,
        promptId: prompt.id,
        isEnabled: true,
        priority: systemPrompts.length - index, // Higher priority for earlier prompts
      })
    );

    await this.collegePromptRepo.save(collegePrompts);
    this.logger.log(`✅ Assigned ${collegePrompts.length} system prompts to college ${collegeId}`);
  }

  private async getOrCreateSource(
    sourceName: string,
  ): Promise<CitationSource | null> {
    try {
      const normalizedName = sourceName.toLowerCase().trim();
      
      let source = await this.citationSourceRepo.findOne({
        where: { sourceName: normalizedName },
      });

      if (!source) {
        source = this.citationSourceRepo.create({
          sourceName: normalizedName,
          displayName: sourceName,
          sourceType: 'aggregator',
          isActive: true,
        });
        source = await this.citationSourceRepo.save(source);
        this.logger.log(`📌 Created new source: ${sourceName}`);
      }

      return source;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to get/create source: ${error.message}`);
      return null;
    }
  }

  private resolvePlaceholders(template: string, college: College): string {
    let resolved = template;

    const cityName = college.cityRelation?.cityName || college.city || college.state || 'India';

    const replacements = {
      '{city}': cityName,
      '{state}': college.state || '',
      '{college_name}': college.collegeName,
      '{established_year}': college.establishedYear?.toString() || '',
      '{nirf_rank}': college.nirfRank?.toString() || '',
      '{college_type}': college.collegeType || '',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      resolved = resolved.replace(new RegExp(placeholder, 'gi'), value);
    }

    return resolved;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}