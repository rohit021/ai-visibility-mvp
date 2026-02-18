import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollegeAiProfile } from '../../database/entities/college-ai-profiles.entity';
import { CollegeCompetitor } from '../../database/entities/college-competitor.entity';

export interface GapsAnalysis {
  summary: {
    totalMissing: number;
    totalPopulated: number;
    completenessScore: number;
  };
  categories: {
    placements: CategoryGap;
    fees: CategoryGap;
    accreditation: CategoryGap;
    faculty: CategoryGap;
    infrastructure: CategoryGap;
    reviews: CategoryGap;
  };
  priorityGaps: PriorityGap[];
}

interface CategoryGap {
  completeness: number;
  missing: string[];
  populated: string[];
}

interface PriorityGap {
  field: string;
  category: string;
  importance: 'high' | 'medium' | 'low';
  reason: string;
}

@Injectable()
export class GapsAnalyzerService {
  private readonly logger = new Logger(GapsAnalyzerService.name);

  // Field mapping - which fields belong to which category
  private readonly fieldCategories = {
    placements: ['placementRate', 'averagePackage', 'highestPackage', 'topRecruiters', 'batchYear'],
    fees: ['btechAnnual', 'hostel', 'totalProgram'],
    accreditation: ['naacGrade', 'nirfRank', 'nbaAccredited', 'ugcRecognized'],
    faculty: ['totalFaculty', 'phdPercentage', 'studentFacultyRatio'],
    infrastructure: ['campusSize', 'facilities', 'hostelAvailable'],
    reviews: ['overallSentiment', 'averageRating'],
  };

  constructor(
    @InjectRepository(CollegeAiProfile)
    private profileRepo: Repository<CollegeAiProfile>,
    @InjectRepository(CollegeCompetitor)
    private competitorRepo: Repository<CollegeCompetitor>,
  ) {}

  async analyzeGaps(collegeId: number): Promise<GapsAnalysis> {
    this.logger.log(`🔍 Analyzing gaps for college ${collegeId}`);

    // Get client's profile
    const clientProfile = await this.profileRepo.findOne({ where: { collegeId } });

    if (!clientProfile) {
      return this.emptyGapsAnalysis();
    }

    const missingFields = clientProfile.missingFields || [];
    const allFields = Object.values(this.fieldCategories).flat();
    const populatedFields = allFields.filter(field => !missingFields.includes(field));

    // Build category breakdown
    const categories = this.buildCategoryBreakdown(missingFields, populatedFields);

    // Get competitor profiles for priority analysis
    const competitorProfiles = await this.getCompetitorProfiles(collegeId);

    // Build priority gaps
    const priorityGaps = this.buildPriorityGaps(
      missingFields,
      competitorProfiles,
    );

    return {
      summary: {
        totalMissing: missingFields.length,
        totalPopulated: populatedFields.length,
        completenessScore: clientProfile.dataCompletenessScore,
      },
      categories,
      priorityGaps,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build category breakdown
  // ─────────────────────────────────────────────────────────────────────────
  private buildCategoryBreakdown(
    missingFields: string[],
    populatedFields: string[],
  ): GapsAnalysis['categories'] {
    const categories: any = {};

    for (const [category, fields] of Object.entries(this.fieldCategories)) {
      const missing = fields.filter(f => missingFields.includes(f));
      const populated = fields.filter(f => populatedFields.includes(f));
      const completeness = Math.round((populated.length / fields.length) * 100);

      categories[category] = {
        completeness,
        missing,
        populated,
      };
    }

    return categories;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get competitor profiles
  // ─────────────────────────────────────────────────────────────────────────
  private async getCompetitorProfiles(collegeId: number): Promise<CollegeAiProfile[]> {
    const competitorRelations = await this.competitorRepo.find({
      where: { collegeId, isActive: true },
    });

    const competitorIds = competitorRelations.map(c => c.competitorCollegeId);

    if (competitorIds.length === 0) {
      return [];
    }

    return this.profileRepo.find({
      where: competitorIds.map(id => ({ collegeId: id })),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build priority gaps
  // ─────────────────────────────────────────────────────────────────────────
  private buildPriorityGaps(
    missingFields: string[],
    competitorProfiles: CollegeAiProfile[],
  ): PriorityGap[] {
    const gaps: PriorityGap[] = [];

    // High-value fields (most important)
    const highValueFields = [
      'placementRate',
      'averagePackage',
      'naacGrade',
      'nirfRank',
      'btechAnnual',
    ];

    for (const field of missingFields) {
      // Find which category this field belongs to
      const category = this.getFieldCategory(field);

      // Check how many competitors have this field
      const competitorsWithField = competitorProfiles.filter(
        profile => !(profile.missingFields || []).includes(field),
      ).length;

      let importance: 'high' | 'medium' | 'low' = 'low';
      let reason = 'Nice to have';

      // Determine importance
      if (highValueFields.includes(field)) {
        importance = 'high';
        reason = 'Critical data point';
      } else if (competitorsWithField > 0) {
        importance = 'high';
        reason = `${competitorsWithField} out of ${competitorProfiles.length} competitors have this data`;
      } else if (category === 'placements' || category === 'fees') {
        importance = 'medium';
        reason = 'Important for student decisions';
      }

      gaps.push({
        field,
        category,
        importance,
        reason,
      });
    }

    // Sort by importance (high first)
    const importanceOrder = { high: 0, medium: 1, low: 2 };
    gaps.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

    // Return top 10 priority gaps
    return gaps.slice(0, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Find which category a field belongs to
  // ─────────────────────────────────────────────────────────────────────────
  private getFieldCategory(field: string): string {
    for (const [category, fields] of Object.entries(this.fieldCategories)) {
      if (fields.includes(field)) {
        return category;
      }
    }
    return 'other';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Empty response when no profile exists
  // ─────────────────────────────────────────────────────────────────────────
  private emptyGapsAnalysis(): GapsAnalysis {
    return {
      summary: {
        totalMissing: 20,
        totalPopulated: 0,
        completenessScore: 0,
      },
      categories: {
        placements: { completeness: 0, missing: this.fieldCategories.placements, populated: [] },
        fees: { completeness: 0, missing: this.fieldCategories.fees, populated: [] },
        accreditation: { completeness: 0, missing: this.fieldCategories.accreditation, populated: [] },
        faculty: { completeness: 0, missing: this.fieldCategories.faculty, populated: [] },
        infrastructure: { completeness: 0, missing: this.fieldCategories.infrastructure, populated: [] },
        reviews: { completeness: 0, missing: this.fieldCategories.reviews, populated: [] },
      },
      priorityGaps: [],
    };
  }
}