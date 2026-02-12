// import { Injectable, Logger, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Recommendation } from '../database/entities/recommendation.entity';
// import { RecommendationEngineService } from './services/recommendation-engine.service';

// @Injectable()
// export class RecommendationsService {
//   private readonly logger = new Logger(RecommendationsService.name);

//   constructor(
//     @InjectRepository(Recommendation)
//     private recommendationRepo: Repository<Recommendation>,
//     private engineService: RecommendationEngineService,
//   ) {}

//   /**
//    * Generate new recommendations for a college
//    */
//   async generateRecommendations(collegeId: number, daysToAnalyze: number = 30) {
//     return this.engineService.generateRecommendations(collegeId, daysToAnalyze);
//   }

//   /**
//    * Get all recommendations for a college
//    */
//   async getRecommendations(
//     collegeId: number,
//     filters?: {
//       status?: 'open' | 'in_progress' | 'completed' | 'dismissed';
//       priority?: 'high' | 'medium' | 'low';
//       category?: string;
//     },
//   ) {
//     const query = this.recommendationRepo
//       .createQueryBuilder('rec')
//       .where('rec.collegeId = :collegeId', { collegeId })
//       .orderBy('rec.impactScore', 'DESC')
//       .addOrderBy('rec.createdAt', 'DESC');

//     if (filters?.status) {
//       query.andWhere('rec.status = :status', { status: filters.status });
//     }

//     if (filters?.priority) {
//       query.andWhere('rec.priority = :priority', { priority: filters.priority });
//     }

//     if (filters?.category) {
//       query.andWhere('rec.category = :category', { category: filters.category });
//     }

//     return query.getMany();
//   }

//   /**
//    * Get a single recommendation by ID
//    */
//   async getRecommendationById(id: number, collegeId: number) {
//     const recommendation = await this.recommendationRepo.findOne({
//       where: { id, collegeId },
//     });

//     if (!recommendation) {
//       throw new NotFoundException(`Recommendation ${id} not found`);
//     }

//     return recommendation;
//   }

//   /**
//    * Update recommendation status
//    */
//   async updateStatus(
//     id: number,
//     collegeId: number,
//     status: 'open' | 'in_progress' | 'completed' | 'dismissed',
//   ) {
//     const recommendation = await this.getRecommendationById(id, collegeId);

//     const updateData: Partial<Recommendation> = { status };

//     if (status === 'completed') {
//       updateData.completedAt = new Date();
//     }

//     await this.recommendationRepo.update(id, updateData);

//     return this.getRecommendationById(id, collegeId);
//   }

//   /**
//    * Get recommendations summary for dashboard
//    */
//   async getSummary(collegeId: number) {
//     return this.engineService.getRecommendationsSummary(collegeId);
//   }

//   /**
//    * Validate completed recommendations
//    */
//   async validateRecommendations(collegeId: number) {
//     return this.engineService.validateRecommendations(collegeId);
//   }

//   /**
//    * Get recommendations grouped by category
//    */
//   async getByCategory(collegeId: number) {
//     const recommendations = await this.recommendationRepo.find({
//       where: { collegeId, status: 'open' },
//       order: { impactScore: 'DESC' },
//     });

//     const grouped = new Map<string, Recommendation[]>();

//     for (const rec of recommendations) {
//       if (!grouped.has(rec.category)) {
//         grouped.set(rec.category, []);
//       }
//       grouped.get(rec.category).push(rec);
//     }

//     return Object.fromEntries(grouped);
//   }

//   /**
//    * Get implementation roadmap (prioritized list with timeline)
//    */
//   async getRoadmap(collegeId: number) {
//     const recommendations = await this.recommendationRepo.find({
//       where: { collegeId, status: 'open' },
//       order: { impactScore: 'DESC' },
//     });

//     let currentDay = 0;
//     const roadmap = recommendations.map((rec) => {
//       const startDay = currentDay;
//       const endDay = currentDay + rec.estimatedTimeDays;
//       currentDay = endDay + 1; // 1 day gap between tasks

//       return {
//         id: rec.id,
//         recommendation: rec.recommendation,
//         priority: rec.priority,
//         category: rec.category,
//         expectedImpact: rec.expectedImpact,
//         startDay,
//         endDay,
//         durationDays: rec.estimatedTimeDays,
//         effort: rec.estimatedEffort,
//       };
//     });

//     return {
//       roadmap,
//       totalDays: currentDay,
//       totalImpact: recommendations.reduce((sum, r) => sum + Number(r.impactScore || 0), 0),
//     };
//   }

//   /**
//    * Get competitive gap analysis
//    */
//   async getCompetitiveGaps(collegeId: number) {
//     const recommendations = await this.recommendationRepo.find({
//       where: { collegeId, status: 'open' },
//     });

//     // Aggregate competitor references
//     const competitorGaps = new Map<string, {
//       competitor: string;
//       gaps: string[];
//       recommendations: number[];
//     }>();

//     for (const rec of recommendations) {
//       if (rec.competitorReference) {
//         for (const compRef of rec.competitorReference) {
//           if (!competitorGaps.has(compRef.name)) {
//             competitorGaps.set(compRef.name, {
//               competitor: compRef.name,
//               gaps: [],
//               recommendations: [],
//             });
//           }
//           const entry = competitorGaps.get(compRef.name);
//           entry.gaps.push(compRef.strength);
//           entry.recommendations.push(rec.id);
//         }
//       }
//     }

//     return [...competitorGaps.values()].map((entry) => ({
//       ...entry,
//       gaps: [...new Set(entry.gaps)],
//       recommendations: [...new Set(entry.recommendations)],
//       gapCount: entry.gaps.length,
//     })).sort((a, b) => b.gapCount - a.gapCount);
//   }
// }
