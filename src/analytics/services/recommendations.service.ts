import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { College } from '../../database/entities/college.entity';
import { CollegeAiProfile } from '../../database/entities/college-ai-profiles.entity';
import { FeatureComparison } from '../../database/entities/feature-comparison.entity';
import { AiQuery } from '../../database/entities/ai-query.entity';
import { CollegeCompetitor } from '../../database/entities/college-competitor.entity';
import { Recommendation } from '../../database/entities/recommendation.entity';

export interface RecommendationSummary {
  totalRecommendations: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  recommendations: RecommendationItem[];
}

export interface RecommendationItem {
  id: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  rootCause: string | null;
  expectedImpact: string | null;
  impactScore: number | null;
  competitorReference: any[] | null;
  implementationSteps: string[] | null;
  estimatedEffort: 'low' | 'medium' | 'high' | null;
  estimatedTimeDays: number | null;
  status: string;
  createdAt: Date;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
    @InjectRepository(CollegeAiProfile)
    private profileRepo: Repository<CollegeAiProfile>,
    @InjectRepository(FeatureComparison)
    private featureComparisonRepo: Repository<FeatureComparison>,
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    @InjectRepository(CollegeCompetitor)
    private competitorRepo: Repository<CollegeCompetitor>,
    @InjectRepository(Recommendation)
    private recommendationRepo: Repository<Recommendation>,
  ) {}

  async getRecommendations(collegeId: number): Promise<RecommendationSummary> {
    this.logger.log(`💡 Generating recommendations for college ${collegeId}`);

    // Get existing recommendations from DB
    const existingRecommendations = await this.recommendationRepo.find({
      where: { collegeId },
      order: { createdAt: 'DESC' },
    });

    // If we have recent recommendations (less than 7 days old), return them
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRecommendations = existingRecommendations.filter(
      r => r.createdAt >= sevenDaysAgo,
    );

    if (recentRecommendations.length > 0) {
      return this.formatRecommendations(recentRecommendations);
    }

    // Generate fresh recommendations
    await this.generateRecommendations(collegeId);

    // Fetch newly generated recommendations
    const newRecommendations = await this.recommendationRepo.find({
      where: { collegeId },
      order: { createdAt: 'DESC' },
    });

    return this.formatRecommendations(newRecommendations);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generate recommendations based on Layer 1, 2, 3 data
  // ─────────────────────────────────────────────────────────────────────────
  private async generateRecommendations(collegeId: number): Promise<void> {
    this.logger.log(`🔄 Generating fresh recommendations for college ${collegeId}`);

    const recommendations: Partial<Recommendation>[] = [];

    // Get all the data we need
    const [college, profile, featureComparisons, visibilityQueries, competitors] =
      await Promise.all([
        this.collegeRepo.findOne({ where: { id: collegeId } }),
        this.profileRepo.findOne({ where: { collegeId } }),
        this.featureComparisonRepo.find({ where: { collegeId } }),
        this.queryRepo.find({
          where: { collegeId, query_layer: 'visibility', executionStatus: 'success' },
        }),
        this.getCompetitorProfiles(collegeId),
      ]);

    // 1. Recommendations from missing fields (Layer 3)
    if (profile && profile.missingFields && profile.missingFields.length > 0) {
      const fieldRecommendations = this.generateFieldRecommendations(
        collegeId,
        profile.missingFields,
        competitors,
      );
      recommendations.push(...fieldRecommendations);
    }

    // 2. Recommendations from competitor losses (Layer 2)
    if (featureComparisons.length > 0) {
      const competitorRecommendations = this.generateCompetitorRecommendations(
        collegeId,
        featureComparisons,
      );
      recommendations.push(...competitorRecommendations);
    }

    // 3. Recommendations from low visibility (Layer 1)
    if (visibilityQueries.length > 0) {
      const visibilityRecommendations = this.generateVisibilityRecommendations(
        collegeId,
        visibilityQueries,
      );
      recommendations.push(...visibilityRecommendations);
    }

    // Save recommendations to DB
    if (recommendations.length > 0) {
      await this.recommendationRepo.save(recommendations);
      this.logger.log(`✅ Generated ${recommendations.length} recommendations`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generate recommendations for missing fields
  // ─────────────────────────────────────────────────────────────────────────
  private generateFieldRecommendations(
    collegeId: number,
    missingFields: string[],
    competitors: CollegeAiProfile[],
  ): Partial<Recommendation>[] {
    const recommendations: Partial<Recommendation>[] = [];

    const criticalFields = ['placementRate', 'averagePackage', 'naacGrade', 'nirfRank', 'btechAnnual'];

    for (const field of missingFields) {
      const isCritical = criticalFields.includes(field);

      // Check how many competitors have this field
      const competitorsWithField = competitors.filter(
        c => !(c.missingFields || []).includes(field),
      );

      const priority: 'high' | 'medium' | 'low' = isCritical
        ? 'high'
        : competitorsWithField.length > 0
        ? 'high'
        : 'medium';

      const category = this.getFieldCategory(field);
      const fieldDisplayName = this.getFieldDisplayName(field);

      recommendations.push({
        collegeId,
        priority,
        category,
        issue: `AI doesn't know your ${fieldDisplayName}`,
        recommendation: `Publish ${fieldDisplayName} on your website with clear headings and structured data`,
        rootCause: 'Data not found on college website or not in AI-readable format',
        expectedImpact: isCritical ? '+15% completeness score' : '+5% completeness score',
        impactScore: isCritical ? 15 : 5,
        implementationSteps: [
          `Create or update the ${category} page on your website`,
          `Add a clear heading: "${fieldDisplayName}"`,
          'Include the data in plain text (not in images or PDFs)',
          'Use structured data markup (Schema.org) if possible',
        ],
        estimatedEffort: 'medium',
        estimatedTimeDays: 7,
        status: 'open',
        competitorReference:
          competitorsWithField.length > 0
            ? competitorsWithField.slice(0, 3).map(c => ({
                name: c.college?.collegeName || 'Unknown',
                strength: `Has ${fieldDisplayName} data`,
              }))
            : null,
      });
    }

    // Return top 5 most important
    return recommendations.slice(0, 5);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generate recommendations from competitor losses
  // ─────────────────────────────────────────────────────────────────────────
  private generateCompetitorRecommendations(
    collegeId: number,
    featureComparisons: FeatureComparison[],
  ): Partial<Recommendation>[] {
    const recommendations: Partial<Recommendation>[] = [];

    // Find features where competitor won
    const losses = featureComparisons.filter(f => f.winner === 'competitor');

    for (const loss of losses.slice(0, 3)) {
      // top 3 losses
      recommendations.push({
        collegeId,
        priority: 'high',
        category: loss.featureName,
        issue: `You lose to competitors on ${loss.featureName}`,
        recommendation: `Update your ${loss.featureName} data - competitors have better/more complete information`,
        rootCause: loss.dataGapIdentified || 'Competitor has data you don\'t have',
        expectedImpact: '+10% competitive positioning',
        impactScore: 10,
        competitorReference: [
          {
            name: 'Competitor',
            theirData: JSON.stringify(loss.competitorDataPoints),
            yourData: JSON.stringify(loss.clientDataPoints),
          },
        ],
        implementationSteps: [
          `Review competitor's ${loss.featureName} data`,
          'Update your website with comparable or better data',
          'Ensure data is in AI-readable format',
        ],
        estimatedEffort: 'medium',
        estimatedTimeDays: 10,
        status: 'open',
      });
    }

    return recommendations;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generate recommendations from low visibility
  // ─────────────────────────────────────────────────────────────────────────
  private generateVisibilityRecommendations(
    collegeId: number,
    visibilityQueries: AiQuery[],
  ): Partial<Recommendation>[] {
    const recommendations: Partial<Recommendation>[] = [];

    const totalQueries = visibilityQueries.length;
    const mentioned = visibilityQueries.filter(q => q.yourCollegeMentioned).length;
    const mentionRate = (mentioned / totalQueries) * 100;

    if (mentionRate < 50) {
      recommendations.push({
        collegeId,
        priority: 'high',
        category: 'visibility',
        issue: `You appear in only ${Math.round(mentionRate)}% of relevant queries`,
        recommendation: 'Optimize your online presence for AI search visibility',
        rootCause: 'Limited indexed content or poor keyword optimization',
        expectedImpact: '+20% mention rate',
        impactScore: 20,
        implementationSteps: [
          'Publish more content about your programs, placements, and achievements',
          'Optimize for keywords like "BTech colleges in [your city]"',
          'Ensure your website is crawlable by search engines',
          'Get listed on education portals (Shiksha, CollegeDunia)',
        ],
        estimatedEffort: 'high',
        estimatedTimeDays: 30,
        status: 'open',
      });
    }

    return recommendations;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  private async getCompetitorProfiles(collegeId: number): Promise<CollegeAiProfile[]> {
    const competitorRelations = await this.competitorRepo.find({
      where: { collegeId, isActive: true },
    });

    const competitorIds = competitorRelations.map(c => c.competitorCollegeId);

    if (competitorIds.length === 0) return [];

    return this.profileRepo.find({
      where: competitorIds.map(id => ({ collegeId: id })),
      relations: ['college'],
    });
  }

  private getFieldCategory(field: string): string {
    const categories: Record<string, string[]> = {
      placements: ['placementRate', 'averagePackage', 'highestPackage', 'topRecruiters', 'batchYear'],
      fees: ['btechAnnual', 'hostel', 'totalProgram'],
      accreditation: ['naacGrade', 'nirfRank', 'nbaAccredited', 'ugcRecognized'],
      faculty: ['totalFaculty', 'phdPercentage', 'studentFacultyRatio'],
      infrastructure: ['campusSize', 'facilities', 'hostelAvailable'],
      reviews: ['overallSentiment', 'averageRating'],
    };

    for (const [category, fields] of Object.entries(categories)) {
      if (fields.includes(field)) return category;
    }
    return 'other';
  }

  private getFieldDisplayName(field: string): string {
    const displayNames: Record<string, string> = {
      placementRate: 'Placement Rate',
      averagePackage: 'Average Package',
      highestPackage: 'Highest Package',
      topRecruiters: 'Top Recruiters',
      batchYear: 'Batch Year',
      btechAnnual: 'BTech Annual Fees',
      hostel: 'Hostel Fees',
      totalProgram: 'Total Program Fees',
      naacGrade: 'NAAC Grade',
      nirfRank: 'NIRF Rank',
      nbaAccredited: 'NBA Accreditation',
      ugcRecognized: 'UGC Recognition',
      totalFaculty: 'Total Faculty',
      phdPercentage: 'PhD Faculty Percentage',
      studentFacultyRatio: 'Student-Faculty Ratio',
      campusSize: 'Campus Size',
      facilities: 'Facilities',
      hostelAvailable: 'Hostel Availability',
      overallSentiment: 'Overall Sentiment',
      averageRating: 'Average Rating',
    };

    return displayNames[field] || field;
  }

  private formatRecommendations(recommendations: Recommendation[]): RecommendationSummary {
    const highPriority = recommendations.filter(r => r.priority === 'high').length;
    const mediumPriority = recommendations.filter(r => r.priority === 'medium').length;
    const lowPriority = recommendations.filter(r => r.priority === 'low').length;

    return {
      totalRecommendations: recommendations.length,
      highPriority,
      mediumPriority,
      lowPriority,
      recommendations: recommendations.map(r => ({
        id: r.id,
        priority: r.priority,
        category: r.category,
        issue: r.issue,
        recommendation: r.recommendation,
        rootCause: r.rootCause,
        expectedImpact: r.expectedImpact,
        impactScore: r.impactScore,
        competitorReference: r.competitorReference,
        implementationSteps: r.implementationSteps,
        estimatedEffort: r.estimatedEffort,
        estimatedTimeDays: r.estimatedTimeDays,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }
}