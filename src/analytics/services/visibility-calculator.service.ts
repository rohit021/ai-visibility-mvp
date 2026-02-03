import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AiQuery } from '../../database/entities/ai-query.entity';
import { VisibilityScore } from '../../database/entities/visibility-score.entity';

@Injectable()
export class VisibilityCalculatorService {
  private readonly logger = new Logger(VisibilityCalculatorService.name);

  constructor(
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    @InjectRepository(VisibilityScore)
    private scoreRepo: Repository<VisibilityScore>,
  ) {}

  async calculateWeeklyScore(
    collegeId: number,
    weekStart: Date,
    weekEnd: Date,
  ) {
    this.logger.log(`Calculating weekly score for college ${collegeId}`);

    // Get all queries for this week
    const queries = await this.queryRepo.find({
      where: {
        collegeId,
        executedAt: Between(weekStart, weekEnd),
        executionStatus: 'success',
      },
    });

    const totalQueries = queries.length;
    const mentionedQueries = queries.filter((q) => q.yourCollegeMentioned);
    const mentionsCount = mentionedQueries.length;

    // Overall visibility percentage
    const visibilityPercentage =
      totalQueries > 0 ? (mentionsCount / totalQueries) * 100 : 0;

    // Average rank when mentioned
    const rankedQueries = mentionedQueries.filter((q) => q.yourCollegeRank);
    const averageRank =
      rankedQueries.length > 0
        ? rankedQueries.reduce((sum, q) => sum + q.yourCollegeRank, 0) /
          rankedQueries.length
        : null;

    // Category breakdown
    const categoryScores = this.calculateCategoryScores(queries);

    // Competitor scores
    const competitorScores = this.calculateCompetitorScores(queries);

    // Get previous week's score for trend
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(weekEnd);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

    const previousScore = await this.scoreRepo.findOne({
      where: {
        collegeId,
        periodType: 'weekly',
        periodStart: previousWeekStart,
      },
    });

    const changeFromPrevious = previousScore
      ? visibilityPercentage - Number(previousScore.visibilityPercentage)
      : 0;

    // Rank among competitors
    const yourRank = this.calculateYourRank(
      competitorScores,
      visibilityPercentage,
    );

    // Save score
    const score = await this.scoreRepo.save({
      collegeId,
      periodType: 'weekly',
      periodStart: weekStart,
      periodEnd: weekEnd,
      totalQueries,
      mentionsCount,
      visibilityPercentage,
      averageRank,
      categoryScores,
      competitorScores,
      yourRankAmongCompetitors: yourRank,
      changeFromPreviousPeriod: changeFromPrevious,
    });

    this.logger.log(
      `Weekly score calculated: ${visibilityPercentage.toFixed(1)}% (${mentionsCount}/${totalQueries})`,
    );

    return score;
  }

  private calculateCategoryScores(queries: AiQuery[]): Record<string, number> {
    const categories = [
      'general',
      'program_specific',
      'feature_specific',
      'competitive',
      'student_intent',
    ];

    const scores: Record<string, number> = {};

    for (const category of categories) {
      // Filter queries by category (would need to join with prompt_library table in real implementation)
      const categoryQueries = queries; // Simplified for MVP

      const mentioned = categoryQueries.filter(
        (q) => q.yourCollegeMentioned,
      ).length;

      scores[category] =
        categoryQueries.length > 0
          ? (mentioned / categoryQueries.length) * 100
          : 0;
    }

    return scores;
  }

  private calculateCompetitorScores(
    queries: AiQuery[],
  ): Array<{ name: string; visibility: number; rank: number }> {
    // Extract all competitors mentioned across queries
    const competitorMentions = new Map<string, number>();

    queries.forEach((query) => {
      if (query.competitorsMentioned && Array.isArray(query.competitorsMentioned)) {
        query.competitorsMentioned.forEach((comp: any) => {
          const count = competitorMentions.get(comp.name) || 0;
          competitorMentions.set(comp.name, count + 1);
        });
      }
    });

    // Calculate visibility percentage for each competitor
    const totalQueries = queries.length;
    const competitors = Array.from(competitorMentions.entries()).map(
      ([name, mentions]) => ({
        name,
        visibility: (mentions / totalQueries) * 100,
        rank: 0, // Will be assigned after sorting
      }),
    );

    // Sort by visibility and assign ranks
    competitors.sort((a, b) => b.visibility - a.visibility);
    competitors.forEach((comp, index) => {
      comp.rank = index + 1;
    });

    return competitors;
  }

  private calculateYourRank(
    competitors: Array<{ name: string; visibility: number }>,
    yourVisibility: number,
  ): number {
    const allScores = [
      ...competitors.map((c) => c.visibility),
      yourVisibility,
    ].sort((a, b) => b - a);

    return allScores.indexOf(yourVisibility) + 1;
  }
}
