import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { College } from '../../database/entities/college.entity';
import { CollegeAiProfile } from '../../database/entities/college-ai-profiles.entity';
import { CollegeCompetitor } from '../../database/entities/college-competitor.entity';
import { FeatureComparison } from '../../database/entities/feature-comparison.entity';
import { AiQuery } from '../../database/entities/ai-query.entity';

export interface CompetitorAnalysis {
  yourScore: number;
  yourRank: number | null;
  totalCompetitors: number;
  competitors: CompetitorDetail[];
  topCompetitor: {
    name: string;
    score: number;
  } | null;
}

export interface CompetitorDetail {
  id: number;
  name: string;
  completenessScore: number;
  gap: number; // negative = you're behind, positive = you're ahead
  headToHead: {
    wins: number;
    losses: number;
    neutral: number;
  };
  visibilityRank: number | null;
  yourVisibilityRank: number | null;
  featureBattles: FeatureBattle[];
}

export interface FeatureBattle {
  feature: string;
  winner: 'client' | 'competitor' | 'neutral';
  confidenceLevel: string;
  theirData: string;
  yourData: string;
  dataGap: string | null;
}

@Injectable()
export class CompetitorAnalyzerService {
  private readonly logger = new Logger(CompetitorAnalyzerService.name);

  constructor(
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
    @InjectRepository(CollegeAiProfile)
    private profileRepo: Repository<CollegeAiProfile>,
    @InjectRepository(CollegeCompetitor)
    private competitorRepo: Repository<CollegeCompetitor>,
    @InjectRepository(FeatureComparison)
    private featureComparisonRepo: Repository<FeatureComparison>,
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
  ) {}

  async analyzeCompetitors(collegeId: number): Promise<CompetitorAnalysis> {
    this.logger.log(`🏆 Analyzing competitors for college ${collegeId}`);

    // Get client's profile
    const clientProfile = await this.profileRepo.findOne({ where: { collegeId } });

    if (!clientProfile) {
      return this.emptyAnalysis();
    }

    // Get all active competitors
    const competitorRelations = await this.competitorRepo.find({
      where: { collegeId, isActive: true },
      relations: ['competitorCollege'],
    });

    if (competitorRelations.length === 0) {
      return {
        yourScore: clientProfile.dataCompletenessScore,
        yourRank: 1,
        totalCompetitors: 0,
        competitors: [],
        topCompetitor: null,
      };
    }

    const competitorIds = competitorRelations.map((c) => c.competitorCollegeId);

    // Get competitor profiles
    const competitorProfiles = await this.profileRepo.find({
      where: competitorIds.map((id) => ({ collegeId: id })),
      relations: ['college'],
    });

    // Get all feature comparisons
    const allComparisons = await this.featureComparisonRepo.find({
      where: competitorIds.map((competitorId) => ({
        collegeId,
        competitorCollegeId: competitorId,
      })),
    });

    // Build competitor details
    const competitors: CompetitorDetail[] = [];

    for (const competitorProfile of competitorProfiles) {
      const competitorId = competitorProfile.collegeId;

      // Get feature comparisons for this specific competitor
      const comparisons = allComparisons.filter(
        (c) => c.competitorCollegeId === competitorId,
      );

      const wins = comparisons.filter((c) => c.winner === 'client').length;
      const losses = comparisons.filter((c) => c.winner === 'competitor').length;
      const neutral = comparisons.filter(
        (c) => c.winner === 'neutral' || c.winner === 'unclear',
      ).length;

      const gap = clientProfile.dataCompletenessScore - competitorProfile.dataCompletenessScore;

      // Get visibility ranks
      const { yourRank, theirRank } = await this.getVisibilityRanks(collegeId, competitorId);

      // Build feature battles
      const featureBattles: FeatureBattle[] = comparisons.map((c) => ({
        feature: c.featureName,
        winner: c.winner as 'client' | 'competitor' | 'neutral',
        confidenceLevel: c.confidenceLevel,
        theirData: this.formatDataPoints(c.competitorDataPoints),
        yourData: this.formatDataPoints(c.clientDataPoints),
        dataGap: c.dataGapIdentified,
      }));

      competitors.push({
        id: competitorId,
        name: competitorProfile.college?.collegeName || 'Unknown',
        completenessScore: competitorProfile.dataCompletenessScore,
        gap,
        headToHead: {
          wins,
          losses,
          neutral,
        },
        visibilityRank: theirRank,
        yourVisibilityRank: yourRank,
        featureBattles,
      });
    }

    // Sort competitors by completeness score (best first)
    competitors.sort((a, b) => b.completenessScore - a.completenessScore);

    // Calculate your rank
    const allScores = [
      clientProfile.dataCompletenessScore,
      ...competitors.map((c) => c.completenessScore),
    ].sort((a, b) => b - a);

    const yourRank = allScores.indexOf(clientProfile.dataCompletenessScore) + 1;

    // Find top competitor
    const topCompetitor =
      competitors.length > 0
        ? {
            name: competitors[0].name,
            score: competitors[0].completenessScore,
          }
        : null;

    return {
      yourScore: clientProfile.dataCompletenessScore,
      yourRank,
      totalCompetitors: competitors.length,
      competitors,
      topCompetitor,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get visibility ranks for client vs competitor
  // ─────────────────────────────────────────────────────────────────────────
  private async getVisibilityRanks(
    clientId: number,
    competitorId: number,
  ): Promise<{ yourRank: number | null; theirRank: number | null }> {
    // Get visibility queries where both appeared
    const queries = await this.queryRepo.find({
      where: {
        collegeId: clientId,
        query_layer: 'visibility',
        executionStatus: 'success',
      },
    });

    if (queries.length === 0) {
      return { yourRank: null, theirRank: null };
    }

    // Calculate average rank for client
    const clientRanks = queries
      .filter((q) => q.yourCollegeMentioned && q.yourCollegeRank)
      .map((q) => q.yourCollegeRank);

    const yourRank =
      clientRanks.length > 0
        ? Math.round((clientRanks.reduce((a, b) => a + b, 0) / clientRanks.length) * 10) / 10
        : null;

    // For competitor rank, we'd need to check query_competitor_results table
    // For now, return null (can be enhanced later)
    const theirRank = null;

    return { yourRank, theirRank };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Format data points for display
  // ─────────────────────────────────────────────────────────────────────────
  private formatDataPoints(dataPoints: any): string {
    if (!dataPoints) return 'No data';
    if (typeof dataPoints === 'string') return dataPoints;
    if (typeof dataPoints === 'object') {
      return JSON.stringify(dataPoints, null, 2);
    }
    return String(dataPoints);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Empty analysis when no profile exists
  // ─────────────────────────────────────────────────────────────────────────
  private emptyAnalysis(): CompetitorAnalysis {
    return {
      yourScore: 0,
      yourRank: null,
      totalCompetitors: 0,
      competitors: [],
      topCompetitor: null,
    };
  }
}