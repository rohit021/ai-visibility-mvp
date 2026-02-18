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
import {ComparisonParserService} from '../services/comparison-analytics-parser';
import { FeatureComparison } from '../../database/entities/feature-comparison.entity';
import { CollegeAiProfile } from '@/database/entities/college-ai-profiles.entity';
import { CollegeAiProfileHistory } from '@/database/entities/college-ai-profile-history.entity';
import { DetailParserService } from './detail.parser.service';

export interface ExecutionResult {
  success: boolean;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  totalCost: number;
  errors: string[];
  summary: {
    mentioned: number;
    notMentioned: number;
    avgRank: number | null;
    bestRank: number | null;
    worstRank: number | null;
    avgSignalScore: number;
    categoryBreakdown: Record<string, {
      total: number;
      mentioned: number;
      avgRank: number | null;
    }>;
  };
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
    @InjectRepository(FeatureComparison)
    private featureComparisonRepo: Repository<FeatureComparison>,
    @InjectRepository(CollegeAiProfile)
    private collegeAiProfileRepo: Repository<CollegeAiProfile>,
    @InjectRepository(CollegeAiProfileHistory)
    private collegeAiProfileHistoryRepo: Repository<CollegeAiProfileHistory>,
    private openaiService: OpenAIService,
    private parserService: ResponseParserService,
    private ComparisonParserService: ComparisonParserService,
    private detailParserService: DetailParserService,
  ) {}

  // ============================================================
  // MAIN EXECUTION: LAYER 1 — VISIBILITY QUERIES
  // ============================================================

  /**
   * Execute all Layer 1 (visibility) queries for a college.
   * This is the primary method called by the scheduler (Mon/Wed/Fri/Sun).
   *
   * @param collegeId - The client college ID
   * @param queryLayer - Filter by query layer (default: 'visibility')
   */
  async executeQueriesForCollege(
    collegeId: number,
    queryLayer: 'visibility' | 'comparison' | 'detail' = 'visibility',
  ): Promise<ExecutionResult> {
    this.logger.log(`\n${'🚀'.repeat(3)} STARTING LAYER 1 EXECUTION`);
    this.logger.log(`   College ID: ${collegeId}`);
    this.logger.log(`   Query Layer: ${queryLayer}`);
    this.logger.log('='.repeat(70));

    // ── 1. Load college ──
    const college = await this.collegeRepo.findOne({
      where: { id: collegeId, isActive: true },
      relations: ['cityRelation'],
    });

    if (!college) {
      throw new NotFoundException(`College ${collegeId} not found`);
    }

    this.logger.log(`📚 College: ${college.collegeName}`);
    this.logger.log(`📍 City: ${college.cityRelation?.cityName || college.city || 'Unknown'}`);

    // ── 2. Load prompts (filtered by query layer) ──
    const prompts = await this.loadPrompts(collegeId, queryLayer);

    if (prompts.length === 0) {
      this.logger.warn('⚠️ No prompts found for this layer');
      return this.emptyResult('No prompts available');
    }

    this.logger.log(`📝 ${prompts.length} prompts to execute (layer: ${queryLayer})`);

    // ── 3. Load competitors ──
    const { competitorNames, competitorMap } = await this.loadCompetitors(collegeId);
    this.logger.log(`🎯 Tracking ${competitorNames.length} competitors`);

    // ── 4. Get AI engine ──
    const aiEngine = await this.getAiEngine();

    // ── 5. Execute all prompts ──
    let successCount = 0;
    let failCount = 0;
    let totalCost = 0;
    const errors: string[] = [];

    // Track results for summary
    const rankResults: number[] = [];
    const signalScores: number[] = [];
    let mentionedCount = 0;
    const categoryStats: Record<string, { total: number; mentioned: number; ranks: number[] }> = {};

    for (let idx = 0; idx < prompts.length; idx++) {
      const prompt = prompts[idx];
      const categoryName = prompt.category?.displayName || prompt.category?.categoryName || 'General';

      // Initialize category stats
      if (!categoryStats[categoryName]) {
        categoryStats[categoryName] = { total: 0, mentioned: 0, ranks: [] };
      }
      categoryStats[categoryName].total++;

      try {
        // Resolve placeholders
        const resolvedPrompt = this.resolvePlaceholders(prompt.promptTemplate, college);

        this.logger.log(`\n[${'─'.repeat(60)}]`);
        this.logger.log(`📤 [${idx + 1}/${prompts.length}] ${categoryName}`);
        this.logger.log(`   "${resolvedPrompt}"`);

        // Execute query
        const result = await this.openaiService.executeQuery(resolvedPrompt);

        if (!result.success || !result.response) {
          this.logger.error(`❌ Query failed: ${result.error}`);
          await this.saveFailedQuery(collegeId, prompt.id, aiEngine.id, queryLayer, resolvedPrompt, result.error);
          errors.push(`[${categoryName}] ${result.error}`);
          failCount++;
          await this.delay(2000);
          continue;
        }

        totalCost += result.cost || 0;
        this.logger.log(`✅ Response: ${result.response.length} chars`);

        // Parse response
        const parsed = this.parserService.parseResponse(
          result.response,
          college.collegeName,
          competitorNames,
        );

        console.log("parsed value we get",parsed);

        this.logger.log(`📊 Found ${parsed.collegesFound.length} matched colleges (${parsed.totalColleges} total)`);

        // Find YOUR college in results
        const yourCollege = parsed.collegesFound.find(
          (c) => c.name.toLowerCase() === college.collegeName.toLowerCase(),
        );

        if (yourCollege) {
          this.logger.log(
            `🎓 YOUR COLLEGE: Rank #${yourCollege.rank} | Tier: ${yourCollege.sectionTier} | Signal: ${yourCollege.signalScore} | Richness: ${yourCollege.responseRichnessScore}`,
          );
          mentionedCount++;
          rankResults.push(yourCollege.rank);
          signalScores.push(yourCollege.signalScore);
          categoryStats[categoryName].mentioned++;
          categoryStats[categoryName].ranks.push(yourCollege.rank);
        } else {
          this.logger.log('❌ Your college NOT mentioned in response');
        }

        // Get or create citation sources
        let sourceId: number | null = null;
        if (yourCollege?.sourcesCited?.length > 0) {
          const source = await this.getOrCreateSource(yourCollege.sourcesCited[0]);
          sourceId = source?.id || null;
        }

        // ── Save AI Query record ──
        const aiQuery = this.queryRepo.create({
          collegeId,
          promptId: prompt.id,
          aiEngineId: aiEngine.id,
          query_layer: queryLayer,
          resolvedPromptText: resolvedPrompt,
          executedAt: new Date(),
          executionStatus: 'success',
          rawResponse: result.response,
          responseLength: result.response.length,
          totalCollegesInResponse: parsed.totalColleges,
          sourceUrl: yourCollege?.sourcesUrl || null,

          // Your college results
          yourCollegeMentioned: !!yourCollege,
          yourCollegeRank: yourCollege?.rank || null,
          yourCollegeSection: yourCollege?.section || null,
          yourCollegeSectionTier: yourCollege?.sectionTier || 'not_mentioned',
          yourCollegeContext: yourCollege?.context || null,
          yourCollegeReasoning: yourCollege?.reasoning || null,
          yourCollegeSourceId: sourceId,
          yourCollegeStrengths: yourCollege?.strengths || [],
          yourCollegeWeaknesses: yourCollege?.weaknesses || [],
          signalScore: yourCollege?.signalScore || 0,
          responseRichnessScore: yourCollege?.responseRichnessScore || 0,
          totalCost: result.cost || 0,
        });

        const savedQuery = await this.queryRepo.save(aiQuery);
        this.logger.log(`💾 Saved query #${savedQuery.id}`);

        // ── Save competitor results ──
        const competitorsSaved = await this.saveCompetitorResults(
          savedQuery.id,
          parsed.collegesFound,
          college.collegeName,
          competitorMap,
        );

        this.logger.log(`✅ Saved ${competitorsSaved} competitor results`);
        successCount++;
      } catch (error) {
        this.logger.error(`💥 Error on prompt ${prompt.id}: ${error.message}`);
        errors.push(`[${categoryName}] ${error.message}`);
        failCount++;
      }

      // Rate limiting: 2s between queries
      if (idx < prompts.length - 1) {
        await this.delay(2000);
      }
    }

    // ── Build summary ──
    const summary = this.buildSummary(
      mentionedCount,
      prompts.length - failCount,
      rankResults,
      signalScores,
      categoryStats,
    );

    this.logger.log(`\n${'='.repeat(70)}`);
    this.logger.log('🏁 EXECUTION COMPLETE');
    this.logger.log(`   ✅ Success: ${successCount}`);
    this.logger.log(`   ❌ Failed: ${failCount}`);
    this.logger.log(`   💰 Total Cost: $${totalCost.toFixed(4)}`);
    this.logger.log(`   📊 Mentioned: ${mentionedCount}/${successCount}`);
    if (summary.avgRank) {
      this.logger.log(`   📈 Avg Rank: #${summary.avgRank.toFixed(1)}`);
    }
    this.logger.log('='.repeat(70));

    return {
      success: failCount < prompts.length,
      totalQueries: prompts.length,
      successfulQueries: successCount,
      failedQueries: failCount,
      totalCost,
      errors,
      summary,
    };
  }

  // ============================================================
  // LOAD PROMPTS (Layer-filtered)
  // ============================================================

  private async loadPrompts(
    collegeId: number,
    queryLayer: string,
  ): Promise<Prompt[]> {
    // First try college-specific prompts
    let collegePrompts = await this.collegePromptRepo.find({
      where: { collegeId, isEnabled: true },
      relations: ['prompt', 'prompt.category'],
      order: { priority: 'DESC', id: 'ASC' },
    });


    // Auto-assign if none exist
    if (collegePrompts.length === 0) {
      this.logger.warn('⚠️ No prompts assigned — auto-assigning system prompts');
      await this.autoAssignSystemPrompts(collegeId);

      collegePrompts = await this.collegePromptRepo.find({
        where: { collegeId, isEnabled: true },
        relations: ['prompt', 'prompt.category'],
        order: { priority: 'DESC', id: 'ASC' },
      });
    }

    // Filter by query layer
    const filtered = collegePrompts
      .map((cp) => cp.prompt)
      .filter((p) => p && p.isActive && p.query_layer === queryLayer);

    return filtered;
  }

  // ============================================================
  // LOAD COMPETITORS
  // ============================================================

  private async loadCompetitors(collegeId: number): Promise<{
    competitorNames: string[];
    competitorMap: Map<string, number>;
  }> {
    const competitors = await this.competitorRepo.find({
      where: { collegeId, isActive: true },
      relations: ['competitorCollege', 'competitorCollege.cityRelation'],
    });

    const competitorNames = competitors.map((c) => c.competitorCollege.collegeName);
    const competitorMap = new Map<string, number>();

    competitors.forEach((comp) => {
      // Store multiple keys for better matching
      const name = comp.competitorCollege.collegeName;
      const normalized = name.toLowerCase().trim();

      competitorMap.set(normalized, comp.competitorCollegeId);

      // Also store cleaned version (no special chars)
      const cleaned = normalized.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      if (cleaned !== normalized) {
        competitorMap.set(cleaned, comp.competitorCollegeId);
      }
    });

    return { competitorNames, competitorMap };
  }

  // ============================================================
  // SAVE COMPETITOR RESULTS
  // ============================================================

  private async saveCompetitorResults(
    queryId: number,
    collegesFound: Array<{
      name: string;
      rank: number;
      section: string;
      sectionTier:'best_overall' | 'strong_private' | 'universities_with_engineering' | 'other_options' | 'not_mentioned' | 'unknown';
      context: string;
      reasoning: string;
      sourcesCited: string[];
      strengths: string[];
      weaknesses: string[];
      signalScore: number;
      responseRichnessScore: number;
      sourcesUrl?: string | null;
    }>,
    clientCollegeName: string,
    competitorMap: Map<string, number>,
  ): Promise<number> {

    let saved = 0;

    for (const collegeResult of collegesFound) {
      // Skip client's own college
      if (collegeResult.name.toLowerCase() === clientCollegeName.toLowerCase()) {
        continue;
      }

      // Find competitor college ID using fuzzy matching
      const competitorCollegeId = await this.findCompetitorId(
        collegeResult.name,
        competitorMap,
      );


      if (!competitorCollegeId) {
        this.logger.debug(`⬜ Skipping untracked college: "${collegeResult.name}"`);
        continue;
      }

      // Get source ID
      let sourceId: number | null = null;
      if (collegeResult.sourcesCited?.length > 0) {
        const source = await this.getOrCreateSource(collegeResult.sourcesCited[0]);
        sourceId = source?.id || null;
      }

      try {
        const competitorResult = this.competitorResultRepo.create({
          query: { id: queryId },
          college: { id: competitorCollegeId },
          // queryId,
          // collegeId: competitorCollegeId,
          rankPosition: collegeResult.rank,
          section: collegeResult.section,
          sectionTier: collegeResult.sectionTier,
          // sectionTier: "best_overall",
          context: collegeResult.context,
          reasoning: collegeResult.reasoning,
          sourceUrl: collegeResult.sourcesUrl || null,
          sourceId,
          strengths: collegeResult.strengths,
          weaknesses: collegeResult.weaknesses,
          signalScore: collegeResult.signalScore,
          responseRichnessScore: collegeResult.responseRichnessScore,
        });

        await this.competitorResultRepo.save(competitorResult);
        saved++;
      } catch (error) {
        // Handle duplicate key (same query + college combo)
        if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate')) {
          this.logger.debug(`⬜ Duplicate result for query ${queryId}, college ${competitorCollegeId}`);
        } else {
          this.logger.warn(`⚠️ Failed to save competitor result: ${error.message}`);
        }
      }
    }

    return saved;
  }

  /**
   * Find competitor college ID using fuzzy matching.
   * Uses the parser's matching logic for consistency.
   */
  private async findCompetitorId(
    aiGivenName: string,
    competitorMap: Map<string, number>,
  ): Promise<number | null> {
    const normalized = aiGivenName.toLowerCase().trim();

    // Direct match in competitor map
    const directMatch = competitorMap.get(normalized);
    if (directMatch) return directMatch;

    // Cleaned match
    const cleaned = normalized.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const cleanedMatch = competitorMap.get(cleaned);
    if (cleanedMatch) return cleanedMatch;

    // Fuzzy match: use parser's matching logic
    const competitorNames = Array.from(competitorMap.keys());
    const matchedKey = this.parserService.findBestMatch(aiGivenName, competitorNames);

    if (matchedKey) {
      return competitorMap.get(matchedKey.toLowerCase().trim()) || null;
    }

    // Last resort: database search
    try {
      const foundCollege = await this.collegeRepo
        .createQueryBuilder('college')
        .where('LOWER(college.collegeName) = :name', { name: normalized })
        .andWhere('college.isActive = :active', { active: true })
        .getOne();

      return foundCollege?.id || null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // SAVE FAILED QUERY
  // ============================================================

  private async saveFailedQuery(
    collegeId: number,
    promptId: number,
    aiEngineId: number,
    queryLayer: string,
    resolvedPrompt: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const aiQuery = this.queryRepo.create({
        collegeId,
        promptId,
        aiEngineId,
        query_layer: "visibility", // need to fix this
        resolvedPromptText: resolvedPrompt,
        executedAt: new Date(),
        executionStatus: 'failed',
        errorMessage,
      });

      await this.queryRepo.save(aiQuery);
    } catch (error) {
      this.logger.error(`Failed to save error record: ${error.message}`);
    }
  }

  // ============================================================
  // BUILD EXECUTION SUMMARY
  // ============================================================

  private buildSummary(
    mentionedCount: number,
    totalSuccessful: number,
    rankResults: number[],
    signalScores: number[],
    categoryStats: Record<string, { total: number; mentioned: number; ranks: number[] }>,
  ): ExecutionResult['summary'] {
    const avgRank =
      rankResults.length > 0
        ? rankResults.reduce((a, b) => a + b, 0) / rankResults.length
        : null;

    const avgSignalScore =
      signalScores.length > 0
        ? signalScores.reduce((a, b) => a + b, 0) / signalScores.length
        : 0;

    const categoryBreakdown: Record<string, { total: number; mentioned: number; avgRank: number | null }> = {};

    for (const [category, stats] of Object.entries(categoryStats)) {
      categoryBreakdown[category] = {
        total: stats.total,
        mentioned: stats.mentioned,
        avgRank:
          stats.ranks.length > 0
            ? stats.ranks.reduce((a, b) => a + b, 0) / stats.ranks.length
            : null,
      };
    }

    return {
      mentioned: mentionedCount,
      notMentioned: totalSuccessful - mentionedCount,
      avgRank,
      bestRank: rankResults.length > 0 ? Math.min(...rankResults) : null,
      worstRank: rankResults.length > 0 ? Math.max(...rankResults) : null,
      avgSignalScore,
      categoryBreakdown,
    };
  }

  // ============================================================
  // AUTO-ASSIGN SYSTEM PROMPTS
  // ============================================================

  private async autoAssignSystemPrompts(collegeId: number): Promise<void> {
    this.logger.log(`🔧 Auto-assigning system prompts to college ${collegeId}`);

    const systemPrompts = await this.promptRepo.find({
      where: { isActive: true, isSystemPrompt: true },
      order: { id: 'ASC' },
    });

    if (systemPrompts.length === 0) {
      this.logger.warn('⚠️ No system prompts found in database');
      return;
    }

    const entries = systemPrompts.map((prompt, index) =>
      this.collegePromptRepo.create({
        collegeId,
        promptId: prompt.id,
        isEnabled: true,
        priority: systemPrompts.length - index,
      }),
    );

    try {
      await this.collegePromptRepo.save(entries);
      this.logger.log(`✅ Assigned ${entries.length} system prompts`);
    } catch (error) {
      // Handle duplicates gracefully
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate')) {
        this.logger.log('ℹ️ Some prompts already assigned');
      } else {
        throw error;
      }
    }
  }

  // ============================================================
  // HELPER: GET OR CREATE CITATION SOURCE
  // ============================================================

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
        this.logger.log(`📌 New source created: ${sourceName}`);
      }

      return source;
    } catch (error) {
      this.logger.warn(`⚠️ Source creation failed: ${error.message}`);
      return null;
    }
  }

  // ============================================================
  // HELPER: GET AI ENGINE
  // ============================================================

  private async getAiEngine(): Promise<AiEngine> {
    const aiEngine = await this.aiEngineRepo.findOne({
      where: { engineName: 'chatgpt', isActive: true },
    });

    if (!aiEngine) {
      throw new NotFoundException(
        'ChatGPT AI Engine not configured. Add a row to ai_engines table with engine_name = "chatgpt"',
      );
    }

    return aiEngine;
  }

  // ============================================================
  // HELPER: RESOLVE PLACEHOLDERS
  // ============================================================

  private resolvePlaceholders(template: string, college: College): string {
    let resolved = template;

    const cityName =
      college.cityRelation?.cityName || college.city || college.state || 'India';

    const replacements: Record<string, string> = {
      '{city}': cityName,
      '{state}': college.state || '',
      '{college_name}': college.collegeName,
      '{established_year}': college.establishedYear?.toString() || '',
      '{nirf_rank}': college.nirfRank?.toString() || '',
      '{college_type}': college.collegeType || '',
      '{year}': new Date().getFullYear().toString(),
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      resolved = resolved.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'gi'), value);
    }

    return resolved;
  }

  // ============================================================
  // HELPER: EMPTY RESULT
  // ============================================================

  private emptyResult(errorMsg: string): ExecutionResult {
    return {
      success: false,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalCost: 0,
      errors: [errorMsg],
      summary: {
        mentioned: 0,
        notMentioned: 0,
        avgRank: null,
        bestRank: null,
        worstRank: null,
        avgSignalScore: 0,
        categoryBreakdown: {},
      },
    };
  }

  // ============================================================
  // HELPER: DELAY
  // ============================================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }



   async executeComparisonQueries(
    collegeId: number,
    competitorId: number,
  )
  // : Promise<{
  //   totalQueries: number;
  //   successfulQueries: number;
  //   failedQueries: number;
  //   totalFeatures: number;
  //   executionTime: number;
  // }> 
  { 
  const startTime = Date.now();
     const college = await this.collegeRepo.findOne({
      where: { id: collegeId },
    });

    if (!college) {
      throw new NotFoundException(`College with ID ${collegeId} not found`);
    }

    // Step 2: Fetch competitor college
    const competitor = await this.collegeRepo.findOne({
      where: { id: competitorId },
    });

    if (!competitor) {
      throw new NotFoundException(
        `Competitor college with ID ${competitorId} not found`,
      );
    }

  const prompts = await this.loadPrompts(collegeId, "comparison");
  // console.log("prompts for comparison",prompts);

  const aiEngine = await this.aiEngineRepo.findOne({
      where: { engineName: 'chatgpt', isActive: true },
    });

    if (!aiEngine) {
      throw new NotFoundException('No active AI engine found');
    }

    // Step 5: Execute queries one by one
    let successfulQueries = 0;
    let failedQueries = 0;
    let totalFeatures = 0;

    for (const prompt of prompts) {
      try {
        const result = await this.executeAndParseSingleQuery(
          prompt,
          college,
          competitor,
          aiEngine,
        );

        if (result.success) {
          successfulQueries++;
          totalFeatures += result.featuresExtracted;
        } else {
          failedQueries++;
        }

        // Rate limiting: wait 2 seconds between queries
        await this.delay(2000);
      } catch (error) {
        this.logger.error(
          `Failed to execute prompt ${prompt.id}: ${error.message}`,
        );
        failedQueries++;
      }
    }

    const executionTime = Date.now() - startTime;

    this.logger.log(
      `Comparison execution completed: ${successfulQueries}/${prompts.length} successful, ${totalFeatures} features extracted`,
    );

    return {
      totalQueries: prompts.length,
      successfulQueries,
      failedQueries,
      totalFeatures,
      executionTime,
    };
  }


  private async executeAndParseSingleQuery(
    prompt: Prompt,
    college: College,
    competitor: College,
    aiEngine: AiEngine,
  ): Promise<{ success: boolean; featuresExtracted: number }> {
    // Step 1: Replace placeholders
    const resolvedPrompt = this.replacePlaceholders(
      prompt.promptTemplate,
      college,
      competitor,
    );

    // this.logger.debug(`Executing: ${resolvedPrompt}`);

    // return {
    //   success: false,
    //   featuresExtracted: 0,
    // }

    // Step 2: Create AI query record
    const aiQuery = this.queryRepo.create({
      collegeId: college.id,
      promptId: prompt.id,
      aiEngineId: aiEngine.id,
      query_layer: 'comparison',
      resolvedPromptText: resolvedPrompt,
      executionStatus: 'pending',
    });

    await this.queryRepo.save(aiQuery);

    try {
      // Step 3: Execute query via AI engine
      const response = await this.openaiService.executeQueryForComparison(resolvedPrompt);

      // Step 4: Update query with response
      aiQuery.rawResponse = response.response;
      aiQuery.responseLength = response.response.length;
      aiQuery.executionStatus = 'success';
      aiQuery.executedAt = new Date();
      aiQuery.totalCost = response.cost || 0;
       await this.queryRepo.save(aiQuery);

      // Step 5: Parse comparison response
      const responsefromdb = await this.queryRepo.findOne({ where: { id: aiQuery.id } });
      // console.log("responsefromdb",responsefromdb);
      const analysis = this.ComparisonParserService.parseComparisonResponse(
        responsefromdb.rawResponse,
        college.collegeName,
        competitor.collegeName,
      );

      this.logger.debug(
        `Parsed ${analysis.features.length} features from response`,
      );

      // Step 6: Save feature battles
      for (const feature of analysis.features) {
        const featureComparison = this.featureComparisonRepo.create({
          queryId: aiQuery.id,
          collegeId: college.id,
          competitorCollegeId: competitor.id,
          featureName: feature.featureName,
          winner: feature.winner,
          confidenceLevel: feature.confidenceLevel,
          clientReasoning: feature.clientReasoning,
          competitorReasoning: feature.competitorReasoning,
          clientDataPoints: feature.clientDataPoints,
          competitorDataPoints: feature.competitorDataPoints,
          sources: feature.sources,
          dataGapIdentified: feature.dataGapIdentified,
        });

        await this.featureComparisonRepo.save(featureComparison);
      }

      return {
        success: true,
        featuresExtracted: analysis.features.length,
      };
    } catch (error) {
      // Update query status to failed
      aiQuery.executionStatus = 'failed';
      aiQuery.errorMessage = error.message;
      await this.queryRepo.save(aiQuery);

      this.logger.error(`Query execution failed: ${error.message}`);

      return {
        success: false,
        featuresExtracted: 0,
      };
    }
  }

    private replacePlaceholders(
    template: string,
    college: College,
    competitor: College,
  ): string {
    let resolved = template;

    // Replace college placeholders
    resolved = resolved.replace(/{college_name}/g, college.collegeName);
    resolved = resolved.replace(/{city}/g, college.city || '');
    resolved = resolved.replace(/{state}/g, college.state || '');

    // Replace competitor placeholders
    resolved = resolved.replace(/{competitor_name}/g, competitor.collegeName);
    resolved = resolved.replace(/{competitor_city}/g, competitor.city || '');

    return resolved;
  }


 async executeDetailQueries(clientCollegeId: number): Promise<{
    success: boolean;
    collegeName: string;
    completenessScore: number;
    fieldsPopulated: number;
    missingFields: string[];
    cost: number;
    error?: string;
  }> {
    this.logger.log(`\n${'🔍'.repeat(3)} LAYER 3 — CLIENT DETAIL QUERY`);
    this.logger.log(`   College ID: ${clientCollegeId}`);
    this.logger.log('='.repeat(70));

    // ── 1. Load client college ──
    const clientCollege = await this.collegeRepo.findOne({
      where: { id: clientCollegeId, isActive: true },
    });

    if (!clientCollege) {
      throw new NotFoundException(`College ${clientCollegeId} not found`);
    }

    this.logger.log(`📚 College: ${clientCollege.collegeName}`);

    // ── 2. Get AI engine + run date ──
    const aiEngine = await this.getAiEngine();
    const runDate = new Date().toISOString().split('T')[0];

    // ── 3. Call OpenAI ──
    const result = await this.openaiService.executeDetailQuery(clientCollege.collegeName);

    // ── 4. Save ai_queries record (always — even on failure) ──
    const aiQuery = this.queryRepo.create({
      collegeId:          clientCollegeId,
      promptId:           40,
      aiEngineId:         aiEngine.id,
      query_layer:        'detail',
      resolvedPromptText: `Tell me everything about ${clientCollege.collegeName} BTech placements average package fees NIRF ranking NAAC grade infrastructure student reviews and top recruiters`,
      executedAt:         new Date(),
      executionStatus:    result.success ? 'success' : 'failed',
      rawResponse:        result.response || null,
      responseLength:     result.response?.length || 0,
      errorMessage:       result.error || null,
      totalCost:          result.cost || 0,
    });

    const savedQuery = await this.queryRepo.save(aiQuery);
    this.logger.log(`💾 ai_queries record saved: #${savedQuery.id}`);

    // ── 5. If API failed — return early ──
    if (!result.success || !result.response) {
      this.logger.error(`❌ OpenAI call failed: ${result.error}`);
      return {
        success:          false,
        collegeName:      clientCollege.collegeName,
        completenessScore: 0,
        fieldsPopulated:  0,
        missingFields:    [],
        cost:             result.cost || 0,
        error:            result.error,
      };
    }

    // ── 6. Parse the JSON response + score it ──
    const parsed = this.detailParserService.parseDetailResponse(
      result.response,
      clientCollege.collegeName,
    );

    this.logger.log(
      `📊 Completeness: ${parsed.fieldsPopulated}/20 fields (${parsed.dataCompletenessScore}%)`,
    );
    this.logger.log(`🔎 Missing: [${parsed.missingFields.join(', ')}]`);

    // ── 7. Upsert college_ai_profiles (Table 1 — latest data) ──
    await this.upsertCollegeAiProfile(
      clientCollegeId,
      savedQuery.id,
      true,        // isClientCollege = true
      parsed,
      runDate,
    );

    // ── 8. Get previous snapshot for delta calculation ──
    const previousSnapshot = await this.getPreviousSnapshot(clientCollegeId, runDate);

    // ── 9. Append college_ai_profile_history (Table 2 — weekly snapshot) ──
    await this.insertProfileHistory(
      clientCollegeId,
      clientCollegeId,   // clientCollegeId same as collegeId for client rows
      savedQuery.id,
      true,              // isClientCollege = true
      runDate,
      parsed,
      previousSnapshot,
      null,              // bestCompetitorScore — not calculated yet (no competitor run)
      null,              // bestCompetitorName
      result.cost || 0,
    );

    this.logger.log('='.repeat(70));
    this.logger.log(`✅ LAYER 3 DONE — ${clientCollege.collegeName}`);
    this.logger.log(`   Score: ${parsed.dataCompletenessScore}% | Fields: ${parsed.fieldsPopulated}/20`);
    this.logger.log('='.repeat(70));

    return {
      success:           true,
      collegeName:       clientCollege.collegeName,
      completenessScore: parsed.dataCompletenessScore,
      fieldsPopulated:   parsed.fieldsPopulated,
      missingFields:     parsed.missingFields,
      cost:              result.cost || 0,
    };
  }

  private async upsertCollegeAiProfile(
    collegeId: number,
    queryId: number,
    isClient: boolean,
    parsed: any,
    runDate: string,
  ): Promise<void> {
    const existing = await this.collegeAiProfileRepo.findOne({ where: { collegeId } });

    if (existing) {
      existing.lastQueryId           = queryId;
      existing.isClientCollege       = isClient;
      existing.placementsData        = parsed.placementsData;
      existing.feesData              = parsed.feesData;
      existing.accreditationData     = parsed.accreditationData;
      existing.facultyData           = parsed.facultyData;
      existing.infrastructureData    = parsed.infrastructureData;
      existing.reviewsData           = parsed.reviewsData;
      existing.sources               = parsed.sources;
      existing.dataCompletenessScore = parsed.dataCompletenessScore;
      existing.fieldsPopulated       = parsed.fieldsPopulated;
      existing.fieldsTotal           = parsed.fieldsTotal;
      existing.missingFields         = parsed.missingFields;
      existing.lastRunDate           = runDate;
      existing.runCount              = (existing.runCount || 0) + 1;
      await this.collegeAiProfileRepo.save(existing);
      this.logger.log(`♻️  Updated profile (run #${existing.runCount})`);
    } else {
      const newProfile = this.collegeAiProfileRepo.create({
        collegeId,
        lastQueryId:           queryId,
        isClientCollege:       isClient,
        placementsData:        parsed.placementsData,
        feesData:              parsed.feesData,
        accreditationData:     parsed.accreditationData,
        facultyData:           parsed.facultyData,
        infrastructureData:    parsed.infrastructureData,
        reviewsData:           parsed.reviewsData,
        sources:               parsed.sources,
        dataCompletenessScore: parsed.dataCompletenessScore,
        fieldsPopulated:       parsed.fieldsPopulated,
        fieldsTotal:           parsed.fieldsTotal,
        missingFields:         parsed.missingFields,
        lastRunDate:           runDate,
        runCount:              1,
      });
      await this.collegeAiProfileRepo.save(newProfile);
      this.logger.log(`🆕 Created new profile`);
    }
  }

  private async insertProfileHistory(
    collegeId: number,
    clientCollegeId: number,
    queryId: number,
    isClient: boolean,
    runDate: string,
    parsed: any,
    previousSnapshot: { completenessScore: number; missingFields: string[] } | null,
    bestCompetitorScore: number | null,
    bestCompetitorName: string | null,
    queryCost: number,
  ): Promise<void> {
    const scoreChange = previousSnapshot
      ? parsed.dataCompletenessScore - previousSnapshot.completenessScore
      : null;

    const newlyPopulatedFields = previousSnapshot
      ? previousSnapshot.missingFields.filter(
          (field) => !parsed.missingFields.includes(field),
        )
      : null;

    const gapVsBestCompetitor =
      isClient && bestCompetitorScore !== null
        ? parsed.dataCompletenessScore - bestCompetitorScore
        : null;

    try {
      const historyRow = this.collegeAiProfileHistoryRepo.create({
        collegeId,
        clientCollegeId,
        queryId,
        isClientCollege:      isClient,
        runDate,
        completenessScore:    parsed.dataCompletenessScore,
        fieldsPopulated:      parsed.fieldsPopulated,
        scoreChange,
        missingFields:        parsed.missingFields,
        newlyPopulatedFields: newlyPopulatedFields?.length ? newlyPopulatedFields : null,
        bestCompetitorScore,
        gapVsBestCompetitor,
        bestCompetitorName,
        queryCost,
      });

      await this.collegeAiProfileHistoryRepo.save(historyRow);
      this.logger.log(`📅 History snapshot saved for ${runDate}`);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate')) {
        this.logger.warn(`⚠️ History already exists for college ${collegeId} on ${runDate} — skipping`);
      } else {
        throw error;
      }
    }
  }

  private async getPreviousSnapshot(
    collegeId: number,
    currentRunDate: string,
  ): Promise<{ completenessScore: number; missingFields: string[] } | null> {
    const previous = await this.collegeAiProfileHistoryRepo.findOne({
      where: { collegeId },
      order: { runDate: 'DESC' },
    });

    if (!previous || previous.runDate === currentRunDate) return null;

    return {
      completenessScore: previous.completenessScore,
      missingFields:     previous.missingFields || [],
    };
  }

  private async getBestCompetitorProfile(
    competitorCollegeIds: number[],
  ): Promise<CollegeAiProfile | null> {
    if (!competitorCollegeIds.length) return null;

    return this.collegeAiProfileRepo
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.college', 'college')
      .where('profile.college_id IN (:...ids)', { ids: competitorCollegeIds })
      .orderBy('profile.data_completeness_score', 'DESC')
      .getOne();
  }



}