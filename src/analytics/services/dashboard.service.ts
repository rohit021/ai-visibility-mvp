import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { College } from '../../database/entities/college.entity';
import { AiQuery } from '../../database/entities/ai-query.entity';
import { CollegeAiProfile } from '../../database/entities/college-ai-profiles.entity';
import { CollegeAiProfileHistory } from '../../database/entities/college-ai-profile-history.entity';
import { FeatureComparison } from '../../database/entities/feature-comparison.entity';
import { CollegeCompetitor } from '../../database/entities/college-competitor.entity';

export interface DashboardOverview {
  college: {
    id: number;
    name: string;
    lastUpdated: string;
  };
  visibility: {
    score: number;
    mentionRate: number;
    averageRank: number | null;
    totalQueries: number;
    mentioned: number;
    notMentioned: number;
  };
  aiKnowledge: {
    completenessScore: number;
    fieldsPopulated: number;
    fieldsTotal: number;
    missingFieldsCount: number;
    topMissingFields: string[];
  };
  competitive: {
    totalCompetitors: number;
    yourRank: number | null;
    winsCount: number;
    lossesCount: number;
    neutralCount: number;
    gapVsBest: number | null;
  };
  trend: {
    completenessChange: number | null;
    visibilityChange: number | null;
    direction: 'improving' | 'declining' | 'stable';
  };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    @InjectRepository(CollegeAiProfile)
    private profileRepo: Repository<CollegeAiProfile>,
    @InjectRepository(CollegeAiProfileHistory)
    private historyRepo: Repository<CollegeAiProfileHistory>,
    @InjectRepository(FeatureComparison)
    private featureComparisonRepo: Repository<FeatureComparison>,
    @InjectRepository(CollegeCompetitor)
    private competitorRepo: Repository<CollegeCompetitor>,
  ) {}

  async getOverview(collegeId: number): Promise<DashboardOverview> {
    this.logger.log(`📊 Generating dashboard overview for college ${collegeId}`);

    // Run all queries in parallel for speed
    const [
      college,
      visibilityData,
      aiKnowledgeData,
      competitiveData,
      trendData,
    ] = await Promise.all([
      this.getCollegeInfo(collegeId),
      this.getVisibilityMetrics(collegeId),
      this.getAiKnowledgeMetrics(collegeId),
      this.getCompetitiveMetrics(collegeId),
      this.getTrendMetrics(collegeId),
    ]);

    return {
      college,
      visibility: visibilityData,
      aiKnowledge: aiKnowledgeData,
      competitive: competitiveData,
      trend: trendData,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. College Info
  // ─────────────────────────────────────────────────────────────────────────
  private async getCollegeInfo(collegeId: number) {
    const college = await this.collegeRepo.findOne({ where: { id: collegeId } });

    return {
      id: collegeId,
      name: college?.collegeName || 'Unknown College',
      lastUpdated: new Date().toISOString().split('T')[0],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Visibility Metrics (Layer 1)
  // ─────────────────────────────────────────────────────────────────────────
  private async getVisibilityMetrics(collegeId: number) {
    // Get all visibility queries (Layer 1)
    const queries = await this.queryRepo.find({
      where: {
        collegeId,
        query_layer: 'visibility',
        executionStatus: 'success',
      },
    });

    if (queries.length === 0) {
      return {
        score: 0,
        mentionRate: 0,
        averageRank: null,
        totalQueries: 0,
        mentioned: 0,
        notMentioned: 0,
      };
    }

    const totalQueries = queries.length;
    const mentioned = queries.filter((q) => q.yourCollegeMentioned).length;
    const notMentioned = totalQueries - mentioned;
    const mentionRate = Math.round((mentioned / totalQueries) * 100);

    // Calculate average rank (only for queries where mentioned)
    const ranks = queries
      .filter((q) => q.yourCollegeMentioned && q.yourCollegeRank)
      .map((q) => q.yourCollegeRank);

    const averageRank = ranks.length > 0
      ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10
      : null;

    // Visibility score = mention rate
    const score = mentionRate;

    return {
      score,
      mentionRate,
      averageRank,
      totalQueries,
      mentioned,
      notMentioned,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. AI Knowledge Metrics (Layer 3)
  // ─────────────────────────────────────────────────────────────────────────
  private async getAiKnowledgeMetrics(collegeId: number) {
    const profile = await this.profileRepo.findOne({ where: { collegeId } });

    if (!profile) {
      return {
        completenessScore: 0,
        fieldsPopulated: 0,
        fieldsTotal: 20,
        missingFieldsCount: 20,
        topMissingFields: [],
      };
    }

    const topMissingFields = profile.missingFields?.slice(0, 3) || [];

    return {
      completenessScore: profile.dataCompletenessScore,
      fieldsPopulated: profile.fieldsPopulated,
      fieldsTotal: profile.fieldsTotal,
      missingFieldsCount: profile.missingFields?.length || 0,
      topMissingFields,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Competitive Metrics (Layer 2 + competitors)
  // ─────────────────────────────────────────────────────────────────────────
  private async getCompetitiveMetrics(collegeId: number) {
    // Get total number of competitors
    const competitors = await this.competitorRepo.count({
      where: { collegeId, isActive: true },
    });

    // Get feature comparison wins/losses (Layer 2)
    const comparisons = await this.featureComparisonRepo.find({
      where: { collegeId },
    });

    const winsCount = comparisons.filter((c) => c.winner === 'client').length;
    const lossesCount = comparisons.filter((c) => c.winner === 'competitor').length;
    const neutralCount = comparisons.filter(
      (c) => c.winner === 'neutral' || c.winner === 'unclear',
    ).length;

    // Get gap vs best competitor from latest history
    const latestHistory = await this.historyRepo.findOne({
      where: { collegeId, isClientCollege: true },
      order: { runDate: 'DESC' },
    });

    const gapVsBest = latestHistory?.gapVsBestCompetitor || null;

    // Calculate rank among competitors (based on completeness score)
    let yourRank: number | null = null;
    if (competitors > 0) {
      const competitorRelations = await this.competitorRepo.find({
        where: { collegeId, isActive: true },
      });
      const competitorIds = competitorRelations.map((c) => c.competitorCollegeId);

      const allProfiles = await this.profileRepo.find({
        where: [
          { collegeId },
          ...competitorIds.map((id) => ({ collegeId: id })),
        ],
      });

      // Sort by completeness score descending
      const sorted = allProfiles.sort(
        (a, b) => b.dataCompletenessScore - a.dataCompletenessScore,
      );

      yourRank = sorted.findIndex((p) => p.collegeId === collegeId) + 1;
    }

    return {
      totalCompetitors: competitors,
      yourRank,
      winsCount,
      lossesCount,
      neutralCount,
      gapVsBest,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Trend Metrics (from history)
  // ─────────────────────────────────────────────────────────────────────────
  private async getTrendMetrics(collegeId: number) {
    // Get last 2 history snapshots to calculate change
    const history = await this.historyRepo.find({
      where: { collegeId, isClientCollege: true },
      order: { runDate: 'DESC' },
      take: 2,
    });

    if (history.length < 2) {
      return {
        completenessChange: null,
        visibilityChange: null,
        direction: 'stable' as const,
      };
    }

    const latest = history[0];
    const previous = history[1];

    const completenessChange = latest.scoreChange || 0;

    // Calculate visibility change (would need visibility_scores table)
    // For now, use completeness change as proxy
    const visibilityChange = completenessChange > 0 ? Math.abs(completenessChange) : 0;

const direction: 'improving' | 'declining' | 'stable' =
  completenessChange > 0 ? 'improving' : completenessChange < 0 ? 'declining' : 'stable';

    return {
      completenessChange,
      visibilityChange,
      direction,
    };
  }
}