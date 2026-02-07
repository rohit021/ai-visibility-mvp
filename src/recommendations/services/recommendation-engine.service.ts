import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { AiQuery } from '../../database/entities/ai-query.entity';
import { College } from '../../database/entities/college.entity';
import { Competitor } from '../../database/entities/competitor.entity';
import { Recommendation } from '../../database/entities/recommendation.entity';
import { VisibilityScore } from '../../database/entities/visibility-score.entity';
import { PromptLibrary } from '../../database/entities/prompt-library.entity';

interface GapAnalysis {
  query: AiQuery;
  gapType: 'not_mentioned' | 'low_rank' | 'weak_context';
  competitorsAhead: {
    name: string;
    rank: number;
    strengths: string[];
  }[];
  yourWeaknesses: string[];
  category: string;
}

interface PatternGroup {
  pattern: string;
  category: string;
  queries: GapAnalysis[];
  frequency: number;
  topCompetitorStrengths: string[];
  commonWeaknesses: string[];
}

interface RecommendationCandidate {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  rootCause: string;
  recommendation: string;
  expectedImpact: string;
  impactScore: number;
  affectedQueries: string[];
  competitorReference: {
    name: string;
    strength: string;
    theirRank: number;
    yourRank: number;
  }[];
  implementationSteps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedTimeDays: number;
}

@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);

  // Mapping of weakness patterns to actionable recommendations
  private readonly weaknessToActionMap: Record<string, {
    issue: string;
    recommendation: string;
    steps: string[];
    effort: 'low' | 'medium' | 'high';
    days: number;
    impactMultiplier: number;
  }> = {
    'placement': {
      issue: 'Missing or incomplete placement data',
      recommendation: 'Add comprehensive placement statistics to your website',
      steps: [
        'Create a dedicated "Placements" page on your website',
        'Add placement percentage for last 3 years',
        'Include average package (LPA) and highest package',
        'List top recruiting companies with logos',
        'Add year-wise placement trends graph',
        'Update the same data on Shiksha.com and Collegedunia profiles',
      ],
      effort: 'medium',
      days: 7,
      impactMultiplier: 1.5,
    },
    'nirf': {
      issue: 'NIRF ranking not prominently displayed',
      recommendation: 'Highlight NIRF ranking across all digital properties',
      steps: [
        'Add NIRF rank badge on website homepage',
        'Update NIRF rank in meta descriptions',
        'Include NIRF rank in all press releases',
        'Update third-party profiles (Shiksha, Collegedunia)',
      ],
      effort: 'low',
      days: 2,
      impactMultiplier: 1.2,
    },
    'fee': {
      issue: 'Fee structure not clearly published',
      recommendation: 'Publish transparent fee structure online',
      steps: [
        'Create detailed fee structure page with program-wise breakdown',
        'Include scholarship information and eligibility',
        'Add fee comparison with competitors if favorable',
        'Update fee info on aggregator sites',
      ],
      effort: 'low',
      days: 3,
      impactMultiplier: 1.1,
    },
    'infrastructure': {
      issue: 'Infrastructure details not well documented',
      recommendation: 'Showcase campus infrastructure with visual content',
      steps: [
        'Add virtual campus tour video',
        'Create photo gallery of labs, library, sports facilities',
        'Document hostel facilities with photos and amenities',
        'Add infrastructure highlights on homepage',
      ],
      effort: 'medium',
      days: 14,
      impactMultiplier: 1.0,
    },
    'faculty': {
      issue: 'Faculty credentials not highlighted',
      recommendation: 'Create detailed faculty profiles',
      steps: [
        'Build faculty directory with photos and qualifications',
        'Highlight faculty achievements and publications',
        'Showcase faculty-to-student ratio',
        'Add notable faculty members on homepage',
      ],
      effort: 'medium',
      days: 10,
      impactMultiplier: 1.0,
    },
    'program': {
      issue: 'Program curriculum is outdated or unclear',
      recommendation: 'Update program pages with current curriculum',
      steps: [
        'Revise curriculum content for each program',
        'Add semester-wise subject breakdown',
        'Include specialization options and electives',
        'Highlight industry-relevant skills covered',
        'Add program outcomes and career paths',
      ],
      effort: 'high',
      days: 21,
      impactMultiplier: 1.3,
    },
    'shiksha': {
      issue: 'Weak presence on Shiksha.com',
      recommendation: 'Complete and optimize Shiksha.com profile',
      steps: [
        'Claim and verify your Shiksha profile',
        'Add all programs with complete details',
        'Upload photos and virtual tour',
        'Add placement data and top recruiters',
        'Respond to student reviews',
        'Keep information updated regularly',
      ],
      effort: 'low',
      days: 5,
      impactMultiplier: 1.3,
    },
    'collegedunia': {
      issue: 'Incomplete Collegedunia profile',
      recommendation: 'Optimize Collegedunia listing',
      steps: [
        'Complete all profile sections',
        'Add accurate fee and admission details',
        'Upload recent photos and videos',
        'Ensure placement data is current',
        'Monitor and respond to reviews',
      ],
      effort: 'low',
      days: 5,
      impactMultiplier: 1.2,
    },
    'reviews': {
      issue: 'Low or negative online reviews',
      recommendation: 'Improve online reputation and reviews',
      steps: [
        'Encourage satisfied students to leave reviews',
        'Respond professionally to negative reviews',
        'Address common complaints mentioned in reviews',
        'Create student testimonial videos',
        'Showcase alumni success stories',
      ],
      effort: 'medium',
      days: 30,
      impactMultiplier: 1.1,
    },
    'accreditation': {
      issue: 'Accreditations not prominently featured',
      recommendation: 'Highlight accreditations and recognitions',
      steps: [
        'Add accreditation badges on homepage',
        'Create dedicated accreditation page',
        'Include NAAC, NBA, AICTE approvals clearly',
        'Update accreditation info on all platforms',
      ],
      effort: 'low',
      days: 2,
      impactMultiplier: 1.1,
    },
    'industry': {
      issue: 'Weak industry connections visibility',
      recommendation: 'Showcase industry partnerships and tie-ups',
      steps: [
        'List MoUs with companies on website',
        'Highlight internship partnerships',
        'Add industry expert guest lecture information',
        'Create industry collaboration page',
      ],
      effort: 'medium',
      days: 7,
      impactMultiplier: 1.2,
    },
    'research': {
      issue: 'Research output not visible',
      recommendation: 'Highlight research and publications',
      steps: [
        'Create research publications page',
        'Add notable research projects',
        'Highlight patents and innovations',
        'Showcase research collaborations',
      ],
      effort: 'medium',
      days: 14,
      impactMultiplier: 0.9,
    },
  };

  constructor(
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
    @InjectRepository(Competitor)
    private competitorRepo: Repository<Competitor>,
    @InjectRepository(Recommendation)
    private recommendationRepo: Repository<Recommendation>,
    @InjectRepository(VisibilityScore)
    private scoreRepo: Repository<VisibilityScore>,
    @InjectRepository(PromptLibrary)
    private promptRepo: Repository<PromptLibrary>,
  ) {}

  /**
   * Main entry point: Generate recommendations for a college
   */
  async generateRecommendations(
    collegeId: number,
    daysToAnalyze: number = 30,
  ): Promise<Recommendation[]> {
    this.logger.log(`Generating recommendations for college ${collegeId}`);

    // Step 1: Get college and competitor data
    const college = await this.collegeRepo.findOne({ where: { id: collegeId } });
    if (!college) {
      throw new Error(`College ${collegeId} not found`);
    }

    const competitors = await this.competitorRepo.find({
      where: { collegeId, isActive: true },
    });

    // Step 2: Get query results for analysis period
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);

    const queries = await this.queryRepo.find({
      where: {
        collegeId,
        executionStatus: 'success',
        executedAt: Between(startDate, endDate),
      },
      order: { executedAt: 'DESC' },
    });

    if (queries.length === 0) {
      this.logger.warn(`No queries found for college ${collegeId}`);
      return [];
    }

    // Step 3: Perform gap analysis
    const gaps = this.analyzeGaps(queries, college, competitors);
    this.logger.log(`Found ${gaps.length} gaps`);

    // Step 4: Detect patterns in gaps
    const patterns = this.detectPatterns(gaps);
    this.logger.log(`Detected ${patterns.length} patterns`);

    // Step 5: Generate recommendation candidates
    const candidates = this.generateCandidates(patterns, college, competitors);
    this.logger.log(`Generated ${candidates.length} recommendation candidates`);

    // Step 6: Deduplicate against existing recommendations
    const existingRecs = await this.recommendationRepo.find({
      where: {
        collegeId,
        status: In(['open', 'in_progress']),
      },
    });

    const newCandidates = this.deduplicateCandidates(candidates, existingRecs);

    // Step 7: Get current visibility for tracking
    const currentScore = await this.scoreRepo.findOne({
      where: { collegeId },
      order: { periodStart: 'DESC' },
    });

    // Step 8: Save new recommendations
    const savedRecommendations: Recommendation[] = [];

    for (const candidate of newCandidates) {
      const recommendation = await this.recommendationRepo.save({
        collegeId,
        priority: candidate.priority,
        category: candidate.category,
        issue: candidate.issue,
        rootCause: candidate.rootCause,
        recommendation: candidate.recommendation,
        expectedImpact: candidate.expectedImpact,
        impactScore: candidate.impactScore,
        affectedQueries: candidate.affectedQueries,
        competitorReference: candidate.competitorReference,
        implementationSteps: candidate.implementationSteps,
        estimatedEffort: candidate.estimatedEffort,
        estimatedTimeDays: candidate.estimatedTimeDays,
        status: 'open',
        validationStatus: 'pending',
        visibilityBefore: currentScore?.visibilityPercentage || null,
      });

      savedRecommendations.push(recommendation);
    }

    this.logger.log(`Saved ${savedRecommendations.length} new recommendations`);

    return savedRecommendations;
  }

  /**
   * Step 3: Analyze gaps between your college and competitors
   */
  private analyzeGaps(
    queries: AiQuery[],
    college: College,
    competitors: Competitor[],
  ): GapAnalysis[] {
    const gaps: GapAnalysis[] = [];

    for (const query of queries) {
      // Gap Type 1: Not mentioned at all
      if (!query.yourCollegeMentioned) {
        const competitorsAhead = (query.competitorsMentioned || [])
          .filter((c) => competitors.some((comp) => 
            comp.competitorCollegeName.toLowerCase() === c.name.toLowerCase()
          ))
          .map((c) => ({
            name: c.name,
            rank: c.rank,
            strengths: c.strengths || [],
          }));

        if (competitorsAhead.length > 0) {
          gaps.push({
            query,
            gapType: 'not_mentioned',
            competitorsAhead,
            yourWeaknesses: [],
            category: query.promptCategory || 'general',
          });
        }
        continue;
      }

      // Gap Type 2: Mentioned but ranked low (worse than rank 3)
      if (query.yourCollegeRank && query.yourCollegeRank > 3) {
        const competitorsAhead = (query.competitorsMentioned || [])
          .filter((c) => c.rank < query.yourCollegeRank)
          .map((c) => ({
            name: c.name,
            rank: c.rank,
            strengths: c.strengths || [],
          }));

        gaps.push({
          query,
          gapType: 'low_rank',
          competitorsAhead,
          yourWeaknesses: query.yourCollegeWeaknesses || [],
          category: query.promptCategory || 'general',
        });
        continue;
      }

      // Gap Type 3: Mentioned with weak/negative context
      if (query.yourCollegeWeaknesses && query.yourCollegeWeaknesses.length > 0) {
        const competitorsAhead = (query.competitorsMentioned || [])
          .filter((c) => c.rank <= (query.yourCollegeRank || 999))
          .map((c) => ({
            name: c.name,
            rank: c.rank,
            strengths: c.strengths || [],
          }));

        gaps.push({
          query,
          gapType: 'weak_context',
          competitorsAhead,
          yourWeaknesses: query.yourCollegeWeaknesses,
          category: query.promptCategory || 'general',
        });
      }
    }

    return gaps;
  }

  /**
   * Step 4: Detect patterns in gaps
   */
  private detectPatterns(gaps: GapAnalysis[]): PatternGroup[] {
    const patternMap = new Map<string, GapAnalysis[]>();

    // Group gaps by detected weakness patterns
    for (const gap of gaps) {
      const patterns = this.identifyWeaknessPatterns(gap);

      for (const pattern of patterns) {
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, []);
        }
        patternMap.get(pattern).push(gap);
      }
    }

    // Also group by category
    const categoryMap = new Map<string, GapAnalysis[]>();
    for (const gap of gaps) {
      const category = gap.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push(gap);
    }

    // Build pattern groups
    const patternGroups: PatternGroup[] = [];

    for (const [pattern, patternGaps] of patternMap) {
      // Aggregate competitor strengths
      const allStrengths: string[] = [];
      const allWeaknesses: string[] = [];

      for (const gap of patternGaps) {
        for (const comp of gap.competitorsAhead) {
          allStrengths.push(...comp.strengths);
        }
        allWeaknesses.push(...gap.yourWeaknesses);
      }

      // Find most common category for this pattern
      const categoryCounts = new Map<string, number>();
      for (const gap of patternGaps) {
        const count = categoryCounts.get(gap.category) || 0;
        categoryCounts.set(gap.category, count + 1);
      }
      const topCategory = [...categoryCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'general';

      patternGroups.push({
        pattern,
        category: topCategory,
        queries: patternGaps,
        frequency: patternGaps.length,
        topCompetitorStrengths: this.getTopItems(allStrengths, 5),
        commonWeaknesses: this.getTopItems(allWeaknesses, 5),
      });
    }

    // Sort by frequency (most common patterns first)
    patternGroups.sort((a, b) => b.frequency - a.frequency);

    return patternGroups;
  }

  /**
   * Identify weakness patterns from gap analysis
   */
  private identifyWeaknessPatterns(gap: GapAnalysis): string[] {
    const patterns: string[] = [];
    const searchText = [
      ...gap.yourWeaknesses,
      gap.query.yourCollegeContext || '',
      gap.query.yourCollegeReasoning || '',
      ...gap.competitorsAhead.flatMap((c) => c.strengths),
    ].join(' ').toLowerCase();

    // Check each known pattern
    const patternKeywords: Record<string, string[]> = {
      'placement': ['placement', 'placed', 'package', 'salary', 'lpa', 'recruit', 'job', 'employment'],
      'nirf': ['nirf', 'ranking', 'ranked', 'rank'],
      'fee': ['fee', 'fees', 'cost', 'affordable', 'expensive', 'tuition', 'scholarship'],
      'infrastructure': ['infrastructure', 'campus', 'facility', 'facilities', 'lab', 'library', 'hostel'],
      'faculty': ['faculty', 'professor', 'teacher', 'phd', 'qualification', 'experience'],
      'program': ['curriculum', 'syllabus', 'program', 'course', 'outdated', 'updated'],
      'shiksha': ['shiksha'],
      'collegedunia': ['collegedunia', 'college dunia'],
      'reviews': ['review', 'rating', 'feedback', 'student opinion'],
      'accreditation': ['naac', 'nba', 'aicte', 'ugc', 'accredit'],
      'industry': ['industry', 'corporate', 'tie-up', 'partnership', 'mou', 'collaboration'],
      'research': ['research', 'publication', 'paper', 'journal', 'innovation'],
    };

    for (const [pattern, keywords] of Object.entries(patternKeywords)) {
      if (keywords.some((kw) => searchText.includes(kw))) {
        patterns.push(pattern);
      }
    }

    // If no specific pattern found, use category-based pattern
    if (patterns.length === 0) {
      patterns.push(gap.category);
    }

    return patterns;
  }

  /**
   * Step 5: Generate recommendation candidates from patterns
   */
  private generateCandidates(
    patterns: PatternGroup[],
    college: College,
    competitors: Competitor[],
  ): RecommendationCandidate[] {
    const candidates: RecommendationCandidate[] = [];

    for (const pattern of patterns) {
      const actionMap = this.weaknessToActionMap[pattern.pattern];

      if (!actionMap) {
        // Generate generic recommendation for unknown patterns
        candidates.push(this.generateGenericCandidate(pattern, college));
        continue;
      }

      // Calculate priority based on frequency
      let priority: 'high' | 'medium' | 'low';
      if (pattern.frequency >= 3) {
        priority = 'high';
      } else if (pattern.frequency >= 2) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      // Calculate impact score (base 10 per query affected, with multiplier)
      const impactScore = pattern.frequency * 10 * actionMap.impactMultiplier;

      // Build competitor reference
      const competitorRef = this.buildCompetitorReference(pattern);

      // Build affected queries list
      const affectedQueries = pattern.queries.map((g) => g.query.promptText);

      candidates.push({
        priority,
        category: pattern.category,
        issue: actionMap.issue,
        rootCause: this.buildRootCause(pattern, college),
        recommendation: actionMap.recommendation,
        expectedImpact: `+${Math.round(impactScore)}% potential visibility improvement on ${pattern.frequency} queries`,
        impactScore,
        affectedQueries: [...new Set(affectedQueries)],
        competitorReference: competitorRef,
        implementationSteps: actionMap.steps,
        estimatedEffort: actionMap.effort,
        estimatedTimeDays: actionMap.days,
      });
    }

    // Sort by impact score
    candidates.sort((a, b) => b.impactScore - a.impactScore);

    return candidates;
  }

  /**
   * Generate generic recommendation for unknown patterns
   */
  private generateGenericCandidate(
    pattern: PatternGroup,
    college: College,
  ): RecommendationCandidate {
    const priority = pattern.frequency >= 3 ? 'high' : pattern.frequency >= 2 ? 'medium' : 'low';

    return {
      priority,
      category: pattern.category,
      issue: `Low visibility in ${pattern.category} queries`,
      rootCause: `You are not appearing or ranking low in ${pattern.frequency} queries related to ${pattern.category}. Competitors are being preferred.`,
      recommendation: `Improve your online presence for ${pattern.category}-related content`,
      expectedImpact: `+${pattern.frequency * 8}% potential visibility improvement`,
      impactScore: pattern.frequency * 8,
      affectedQueries: pattern.queries.map((g) => g.query.promptText),
      competitorReference: this.buildCompetitorReference(pattern),
      implementationSteps: [
        `Audit your ${pattern.category} content on website`,
        'Compare with top-ranking competitors',
        'Identify and fill content gaps',
        'Update third-party profiles with this information',
      ],
      estimatedEffort: 'medium',
      estimatedTimeDays: 14,
    };
  }

  /**
   * Build root cause explanation
   */
  private buildRootCause(pattern: PatternGroup, college: College): string {
    const topStrengths = pattern.topCompetitorStrengths.slice(0, 3).join(', ');
    const weaknesses = pattern.commonWeaknesses.slice(0, 2).join(', ');

    let rootCause = `AI models are not finding sufficient ${pattern.pattern}-related information about ${college.collegeName}. `;

    if (topStrengths) {
      rootCause += `Competitors are being cited for: ${topStrengths}. `;
    }

    if (weaknesses) {
      rootCause += `Your identified gaps: ${weaknesses}.`;
    }

    return rootCause;
  }

  /**
   * Build competitor reference from pattern
   */
  private buildCompetitorReference(pattern: PatternGroup): {
    name: string;
    strength: string;
    theirRank: number;
    yourRank: number;
  }[] {
    const refs: Map<string, { strength: string; theirRank: number; yourRank: number }> = new Map();

    for (const gap of pattern.queries) {
      for (const comp of gap.competitorsAhead) {
        if (!refs.has(comp.name)) {
          refs.set(comp.name, {
            strength: comp.strengths[0] || 'Higher visibility',
            theirRank: comp.rank,
            yourRank: gap.query.yourCollegeRank || 99,
          });
        }
      }
    }

    return [...refs.entries()].slice(0, 3).map(([name, data]) => ({
      name,
      ...data,
    }));
  }

  /**
   * Deduplicate candidates against existing recommendations
   */
  private deduplicateCandidates(
    candidates: RecommendationCandidate[],
    existing: Recommendation[],
  ): RecommendationCandidate[] {
    return candidates.filter((candidate) => {
      // Check if similar recommendation already exists
      const isDuplicate = existing.some((rec) => {
        // Same category and similar issue
        if (rec.category === candidate.category) {
          // Check if issue is similar (contains same key words)
          const recWords = rec.issue.toLowerCase().split(' ');
          const candidateWords = candidate.issue.toLowerCase().split(' ');
          const commonWords = recWords.filter((w) => candidateWords.includes(w) && w.length > 3);
          return commonWords.length >= 2;
        }
        return false;
      });

      return !isDuplicate;
    });
  }

  /**
   * Helper: Get top N items from array by frequency
   */
  private getTopItems(items: string[], n: number): string[] {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item && item.trim()) {
        const normalized = item.trim().toLowerCase();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([item]) => item);
  }

  /**
   * Validate recommendations after implementation
   */
  async validateRecommendations(collegeId: number): Promise<{
    validated: number;
    notValidated: number;
    pending: number;
  }> {
    // Get completed recommendations
    const completedRecs = await this.recommendationRepo.find({
      where: {
        collegeId,
        status: 'completed',
        validationStatus: 'pending',
      },
    });

    // Get current visibility score
    const currentScore = await this.scoreRepo.findOne({
      where: { collegeId },
      order: { periodStart: 'DESC' },
    });

    let validated = 0;
    let notValidated = 0;

    for (const rec of completedRecs) {
      // Check if visibility improved for affected queries
      const improvement = currentScore
        ? Number(currentScore.visibilityPercentage) - Number(rec.visibilityBefore || 0)
        : 0;

      if (improvement > 0) {
        await this.recommendationRepo.update(rec.id, {
          validationStatus: 'validated',
          visibilityAfter: currentScore?.visibilityPercentage,
        });
        validated++;
      } else {
        // Check if at least 2 weeks have passed
        const weeksSinceCompletion = rec.completedAt
          ? (Date.now() - rec.completedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
          : 0;

        if (weeksSinceCompletion >= 2) {
          await this.recommendationRepo.update(rec.id, {
            validationStatus: 'not_validated',
            visibilityAfter: currentScore?.visibilityPercentage,
          });
          notValidated++;
        }
      }
    }

    const pending = completedRecs.length - validated - notValidated;

    return { validated, notValidated, pending };
  }

  /**
   * Get recommendations summary for dashboard
   */
  async getRecommendationsSummary(collegeId: number): Promise<{
    total: number;
    byPriority: { high: number; medium: number; low: number };
    byStatus: { open: number; inProgress: number; completed: number; dismissed: number };
    topRecommendations: Recommendation[];
    potentialImpact: number;
  }> {
    const recommendations = await this.recommendationRepo.find({
      where: { collegeId },
      order: { impactScore: 'DESC' },
    });

    const byPriority = { high: 0, medium: 0, low: 0 };
    const byStatus = { open: 0, inProgress: 0, completed: 0, dismissed: 0 };
    let potentialImpact = 0;

    for (const rec of recommendations) {
      byPriority[rec.priority]++;
      
      switch (rec.status) {
        case 'open':
          byStatus.open++;
          potentialImpact += Number(rec.impactScore) || 0;
          break;
        case 'in_progress':
          byStatus.inProgress++;
          potentialImpact += Number(rec.impactScore) || 0;
          break;
        case 'completed':
          byStatus.completed++;
          break;
        case 'dismissed':
          byStatus.dismissed++;
          break;
      }
    }

    return {
      total: recommendations.length,
      byPriority,
      byStatus,
      topRecommendations: recommendations.filter((r) => r.status === 'open').slice(0, 5),
      potentialImpact,
    };
  }
}
