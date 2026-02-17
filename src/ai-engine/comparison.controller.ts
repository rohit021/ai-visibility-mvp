// import {
//   Controller,
//   Post,
//   Get,
//   Param,
//   Body,
//   Query,
//   UseGuards,
//   Request,
//   Logger,
//   HttpException,
//   HttpStatus,
//   ParseIntPipe,
// } from '@nestjs/common';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { QueryExecutorService } from '../ai-engine/services/query-executor.service';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { FeatureComparison } from '../database/entities/feature-comparison.entity';
// import { AiQuery } from '../database/entities/ai-query.entity';
// import { College } from '../database/entities/college.entity';

// @Controller('comparison')
// @UseGuards(JwtAuthGuard)
// export class ComparisonController {
//   private readonly logger = new Logger(ComparisonController.name);

//   constructor(
//     private readonly queryExecutorService: QueryExecutorService,
//     @InjectRepository(FeatureComparison)
//     private featureComparisonRepo: Repository<FeatureComparison>,
//     @InjectRepository(AiQuery)
//     private aiQueryRepo: Repository<AiQuery>,
//     @InjectRepository(College)
//     private collegeRepo: Repository<College>,
//   ) {}

//   /**
//    * Execute comparison queries for client college vs specific competitor
//    * POST /comparison/execute
//    * Body: { competitorId: 3 }
//    */
//   @Post('execute')
//   async executeComparisonQueries(
//     @Request() req,
//     @Body('competitorId', ParseIntPipe) competitorId: number,
//   ) {
//     const collegeId = req.user.collegeId;

//     if (!collegeId) {
//       throw new HttpException(
//         'College ID not found in token',
//         HttpStatus.UNAUTHORIZED,
//       );
//     }

//     this.logger.log(
//       `🎯 Starting comparison: College ${collegeId} vs Competitor ${competitorId}`,
//     );

//     try {
//       const result = await this.queryExecutorService.executeComparisonQueries(
//         collegeId,
//         competitorId,
//       );

//       return {
//         success: true,
//         message: 'Comparison queries executed successfully',
//         data: result,
//       };
//     } catch (error) {
//       this.logger.error(`Failed to execute: ${error.message}`);
//       throw new HttpException(
//         error.message || 'Failed to execute comparison queries',
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   /**
//    * Get comparison insights for client college
//    * GET /comparison/insights?days=7
//    */
//   @Get('insights')
//   async getComparisonInsights(
//     @Request() req,
//     @Query('days') days?: string,
//   ) {
//     const collegeId = req.user.collegeId;
//     const periodDays = days ? parseInt(days) : 7;

//     try {
//       const insights = await this.calculateInsights(collegeId, periodDays);

//       return {
//         success: true,
//         data: insights,
//       };
//     } catch (error) {
//       this.logger.error(`Failed to fetch insights: ${error.message}`);
//       throw new HttpException(
//         error.message,
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   /**
//    * Get comparison query history
//    * GET /comparison/history?limit=10
//    */
//   @Get('history')
//   async getComparisonHistory(
//     @Request() req,
//     @Query('limit') limit?: string,
//   ) {
//     const collegeId = req.user.collegeId;
//     const queryLimit = limit ? parseInt(limit) : 10;

//     try {
//       const queries = await this.aiQueryRepo.find({
//         where: {
//           collegeId,
//           query_layer: 'comparison',
//         },
//         relations: ['prompt'],
//         order: { executedAt: 'DESC' },
//         take: queryLimit,
//       });

//       // Get feature counts for each query
//       const history = await Promise.all(
//         queries.map(async (query) => {
//           const featureCount = await this.featureComparisonRepo.count({
//             where: { queryId: query.id },
//           });

//           return {
//             id: query.id,
//             prompt: query.resolvedPromptText,
//             executedAt: query.executedAt,
//             status: query.executionStatus,
//             featuresExtracted: featureCount,
//           };
//         }),
//       );

//       return {
//         success: true,
//         data: history,
//       };
//     } catch (error) {
//       throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
//     }
//   }

//   /**
//    * Get feature battles for specific query
//    * GET /comparison/query/:queryId/features
//    */
//   @Get('query/:queryId/features')
//   async getQueryFeatures(
//     @Request() req,
//     @Param('queryId', ParseIntPipe) queryId: number,
//   ) {
//     const collegeId = req.user.collegeId;

//     try {
//       const features = await this.featureComparisonRepo.find({
//         where: {
//           queryId,
//           collegeId,
//         },
//         relations: ['competitorCollege'],
//       });

//       const result = features.map((f) => ({
//         featureName: f.featureName,
//         winner: f.winner,
//         confidenceLevel: f.confidenceLevel,
//         clientReasoning: f.clientReasoning,
//         competitorReasoning: f.competitorReasoning,
//         clientDataPoints: f.clientDataPoints,
//         competitorDataPoints: f.competitorDataPoints,
//         dataGapIdentified: f.dataGapIdentified,
//         competitor: f.competitorCollege.collegeName,
//       }));

//       return {
//         success: true,
//         data: result,
//       };
//     } catch (error) {
//       throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
//     }
//   }

//   /**
//    * Get performance for specific feature
//    * GET /comparison/feature/:featureName
//    */
//   @Get('feature/:featureName')
//   async getFeaturePerformance(
//     @Request() req,
//     @Param('featureName') featureName: string,
//   ) {
//     const collegeId = req.user.collegeId;

//     try {
//       const features = await this.featureComparisonRepo.find({
//         where: {
//           collegeId,
//           featureName,
//         },
//         relations: ['competitorCollege', 'query'],
//         order: { createdAt: 'DESC' },
//         take: 50,
//       });

//       const totalBattles = features.length;
//       const clientWins = features.filter((f) => f.winner === 'client').length;
//       const competitorWins = features.filter(
//         (f) => f.winner === 'competitor',
//       ).length;

//       return {
//         success: true,
//         data: {
//           featureName,
//           totalBattles,
//           clientWins,
//           competitorWins,
//           winRate:
//             totalBattles > 0
//               ? Math.round((clientWins / totalBattles) * 1000) / 10
//               : 0,
//           recentBattles: features.slice(0, 10).map((f) => ({
//             competitor: f.competitorCollege.collegeName,
//             winner: f.winner,
//             confidenceLevel: f.confidenceLevel,
//             clientReasoning: f.clientReasoning,
//             competitorReasoning: f.competitorReasoning,
//             executedAt: f.query.executedAt,
//           })),
//         },
//       };
//     } catch (error) {
//       throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
//     }
//   }

//   /**
//    * Get comparison vs specific competitor
//    * GET /comparison/vs-competitor/:competitorId
//    */
//   @Get('vs-competitor/:competitorId')
//   async getCompetitorComparison(
//     @Request() req,
//     @Param('competitorId', ParseIntPipe) competitorId: number,
//   ) {
//     const collegeId = req.user.collegeId;

//     try {
//       const features = await this.featureComparisonRepo.find({
//         where: {
//           collegeId,
//           competitorCollegeId: competitorId,
//         },
//         relations: ['competitorCollege'],
//       });

//       const featureBreakdown = new Map<
//         string,
//         { clientWins: number; competitorWins: number; total: number }
//       >();

//       for (const feature of features) {
//         if (!featureBreakdown.has(feature.featureName)) {
//           featureBreakdown.set(feature.featureName, {
//             clientWins: 0,
//             competitorWins: 0,
//             total: 0,
//           });
//         }

//         const breakdown = featureBreakdown.get(feature.featureName);
//         breakdown.total++;

//         if (feature.winner === 'client') breakdown.clientWins++;
//         else if (feature.winner === 'competitor') breakdown.competitorWins++;
//       }

//       return {
//         success: true,
//         data: {
//           competitor:
//             features.length > 0
//               ? features[0].competitorCollege.collegeName
//               : 'Unknown',
//           totalComparisons: new Set(features.map((f) => f.queryId)).size,
//           overallClientWins: features.filter((f) => f.winner === 'client')
//             .length,
//           overallCompetitorWins: features.filter(
//             (f) => f.winner === 'competitor',
//           ).length,
//           featureBreakdown: Array.from(featureBreakdown.entries()).map(
//             ([name, breakdown]) => ({
//               featureName: name,
//               clientWins: breakdown.clientWins,
//               competitorWins: breakdown.competitorWins,
//               total: breakdown.total,
//               winRate:
//                 breakdown.total > 0
//                   ? Math.round(
//                       (breakdown.clientWins / breakdown.total) * 1000,
//                     ) / 10
//                   : 0,
//             }),
//           ),
//         },
//       };
//     } catch (error) {
//       throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
//     }
//   }

//   /**
//    * Helper: Calculate insights
//    */
//   private async calculateInsights(collegeId: number, periodDays: number) {
//     const periodStart = new Date();
//     periodStart.setDate(periodStart.getDate() - periodDays);

//     const features = await this.featureComparisonRepo.find({
//       where: { collegeId },
//       relations: ['competitorCollege'],
//       order: { createdAt: 'DESC' },
//     });

//     const periodFeatures = features.filter((f) => f.createdAt >= periodStart);

//     if (periodFeatures.length === 0) {
//       return {
//         periodStart,
//         periodEnd: new Date(),
//         totalComparisons: 0,
//         features: [],
//         overallClientWins: 0,
//         overallCompetitorWins: 0,
//         overallWinRate: 0,
//         criticalDataGaps: [],
//       };
//     }

//     // Calculate feature performance
//     const featurePerformanceMap = new Map<
//       string,
//       {
//         totalBattles: number;
//         clientWins: number;
//         competitorWins: number;
//         neutral: number;
//       }
//     >();

//     for (const feature of periodFeatures) {
//       if (!featurePerformanceMap.has(feature.featureName)) {
//         featurePerformanceMap.set(feature.featureName, {
//           totalBattles: 0,
//           clientWins: 0,
//           competitorWins: 0,
//           neutral: 0,
//         });
//       }

//       const perf = featurePerformanceMap.get(feature.featureName);
//       perf.totalBattles++;

//       if (feature.winner === 'client') perf.clientWins++;
//       else if (feature.winner === 'competitor') perf.competitorWins++;
//       else if (feature.winner === 'neutral') perf.neutral++;
//     }

//     const featurePerformances = Array.from(featurePerformanceMap.entries()).map(
//       ([featureName, perf]) => ({
//         featureName,
//         totalBattles: perf.totalBattles,
//         clientWins: perf.clientWins,
//         competitorWins: perf.competitorWins,
//         neutral: perf.neutral,
//         winRate:
//           perf.totalBattles > 0
//             ? Math.round((perf.clientWins / perf.totalBattles) * 1000) / 10
//             : 0,
//       }),
//     );

//     // Data gaps
//     const dataGaps = periodFeatures
//       .filter((f) => f.dataGapIdentified)
//       .map((f) => f.dataGapIdentified);

//     const gapMap = new Map<string, number>();
//     for (const gap of dataGaps) {
//       gapMap.set(gap, (gapMap.get(gap) || 0) + 1);
//     }

//     const criticalDataGaps = Array.from(gapMap.entries())
//       .map(([gap, frequency]) => ({ gap, frequency }))
//       .sort((a, b) => b.frequency - a.frequency)
//       .slice(0, 5);

//     return {
//       periodStart,
//       periodEnd: new Date(),
//       totalComparisons: new Set(periodFeatures.map((f) => f.queryId)).size,
//       features: featurePerformances.sort((a, b) => a.winRate - b.winRate),
//       overallClientWins: periodFeatures.filter((f) => f.winner === 'client')
//         .length,
//       overallCompetitorWins: periodFeatures.filter(
//         (f) => f.winner === 'competitor',
//       ).length,
//       overallWinRate:
//         periodFeatures.length > 0
//           ? Math.round(
//               (periodFeatures.filter((f) => f.winner === 'client').length /
//                 periodFeatures.length) *
//                 1000,
//             ) / 10
//           : 0,
//       criticalDataGaps,
//     };
//   }
// }