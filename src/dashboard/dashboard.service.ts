// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository, MoreThanOrEqual } from 'typeorm';
// import { College } from '../database/entities/college.entity';
// import { VisibilityScore } from '../database/entities/visibility-score.entity';
// import { AiQuery } from '../database/entities/ai-query.entity';

// @Injectable()
// export class DashboardService {
//   constructor(
//     @InjectRepository(College)
//     private collegeRepo: Repository<College>,
//     @InjectRepository(VisibilityScore)
//     private scoreRepo: Repository<VisibilityScore>,
//     @InjectRepository(AiQuery)
//     private queryRepo: Repository<AiQuery>,
//   ) {}

//   async getDashboard(collegeId: number) {
//     // Get college info
//     const college = await this.collegeRepo.findOne({
//       where: { id: collegeId },
//       relations: ['competitors'],
//     });

//     if (!college) {
//       throw new Error('College not found');
//     }

//     // Get latest visibility score
//     const latestScore = await this.scoreRepo.findOne({
//       where: { collegeId },
//       order: { periodStart: 'DESC' },
//     });

//     // Get trend data (last 12 weeks)
//     const trendData = await this.scoreRepo.find({
//       where: { collegeId, periodType: 'weekly' },
//       order: { periodStart: 'DESC' },
//       take: 12,
//     });

//     // Get recent queries (last 7 days)
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     const recentQueries = await this.queryRepo.find({
//       where: {
//         collegeId,
//         executedAt: MoreThanOrEqual(sevenDaysAgo),
//         executionStatus: 'success',
//       },
//       order: { executedAt: 'DESC' },
//       take: 10,
//     });

//     // Top wins (where you ranked #1)
//     const topWins = await this.queryRepo.find({
//       where: {
//         collegeId,
//         yourCollegeMentioned: true,
//         yourCollegeRank: 1,
//         executedAt: MoreThanOrEqual(sevenDaysAgo),
//       },
//       take: 5,
//     });

//     // Gaps (queries where you weren't mentioned)
//     const gaps = await this.queryRepo.find({
//       where: {
//         collegeId,
//         yourCollegeMentioned: false,
//         executedAt: MoreThanOrEqual(sevenDaysAgo),
//       },
//       take: 5,
//     });

//     return {
//       college: {
//         id: college.id,
//         name: college.collegeName,
//         city: college.city,
//         state: college.state,
//         subscriptionStatus: college.subscriptionStatus,
//         competitorsCount: college.competitors?.length || 0,
//       },
//       currentScore: latestScore
//         ? {
//             visibilityPercentage: Number(latestScore.visibilityPercentage),
//             rankAmongCompetitors: latestScore.yourRankAmongCompetitors,
//             totalQueries: latestScore.totalQueries,
//             mentions: latestScore.mentionsCount,
//             averageRank: latestScore.averageRank
//               ? Number(latestScore.averageRank)
//               : null,
//             categoryScores: latestScore.categoryScores,
//             competitorScores: latestScore.competitorScores,
//             changeFromPrevious: latestScore.changeFromPreviousPeriod
//               ? Number(latestScore.changeFromPreviousPeriod)
//               : null,
//           }
//         : null,
//       trends: trendData.map((score) => ({
//         date: score.periodStart,
//         visibility: Number(score.visibilityPercentage),
//         mentions: score.mentionsCount,
//         totalQueries: score.totalQueries,
//       })),
//       recentActivity: {
//         totalQueriesLastWeek: recentQueries.length,
//         topWins: topWins.map((q) => ({
//           prompt: q.promptText,
//           rank: q.yourCollegeRank,
//           context: q.yourCollegeContext,
//         })),
//         gaps: gaps.map((q) => ({
//           prompt: q.promptText,
//           competitorsMentioned: q.competitorsMentioned,
//         })),
//       },
//     };
//   }

//   async getSummary(collegeId: number) {
//     const latestScore = await this.scoreRepo.findOne({
//       where: { collegeId },
//       // order: { periodStart: 'DESC' },
//     });

//     if (!latestScore) {
//       return {
//         visibilityPercentage: 0,
//         mentions: 0,
//         totalQueries: 0,
//         rank: null,
//       };
//     }

//     return {
//       visibilityPercentage: Number(latestScore.visibilityPercentage),
//       mentions: latestScore.mentionsCount,
//       totalQueries: latestScore.totalQueries,
//       rank: latestScore.yourRankAmongCompetitors,
//     };
//   }
// }
