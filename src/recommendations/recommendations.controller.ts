// import {
//   Controller,
//   Get,
//   Post,
//   Patch,
//   Param,
//   Query,
//   Body,
//   ParseIntPipe,
//   UseGuards,
// } from '@nestjs/common';
// import { RecommendationsService } from './recommendations.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// @Controller('recommendations')
// @UseGuards(JwtAuthGuard)
// export class RecommendationsController {
//   constructor(private readonly recommendationsService: RecommendationsService) {}

//   /**
//    * Generate new recommendations for a college
//    * POST /recommendations/generate/:collegeId
//    */
//   @Post('generate/:collegeId')
//   async generateRecommendations(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @Query('days', new ParseIntPipe({ optional: true })) days?: number,
//   ) {
//     console.log("Generating recommendations for collegeId:", collegeId, "for the past", days || 30, "days");
//     const recommendations = await this.recommendationsService.generateRecommendations(
//       collegeId,
//       days || 30,
//     );

//     return {
//       success: true,
//       message: `Generated ${recommendations.length} new recommendations`,
//       data: recommendations,
//     };
//   }

//   /**
//    * Get all recommendations for a college
//    * GET /recommendations/:collegeId
//    */
//   @Get(':collegeId')
//   async getRecommendations(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @Query('status') status?: 'open' | 'in_progress' | 'completed' | 'dismissed',
//     @Query('priority') priority?: 'high' | 'medium' | 'low',
//     @Query('category') category?: string,
//   ) {
//     const recommendations = await this.recommendationsService.getRecommendations(
//       collegeId,
//       { status, priority, category },
//     );

//     return {
//       success: true,
//       count: recommendations.length,
//       data: recommendations,
//     };
//   }

//   /**
//    * Get recommendations summary for dashboard
//    * GET /recommendations/:collegeId/summary
//    */
//   @Get(':collegeId/summary')
//   async getSummary(@Param('collegeId', ParseIntPipe) collegeId: number) {
//     console.log("Fetching recommendations summary for collegeId:", collegeId);
//     const summary = await this.recommendationsService.getSummary(collegeId);
    
//     return {
//       success: true,
//       data: summary,
//     };
//   }

//   /**
//    * Get recommendations grouped by category
//    * GET /recommendations/:collegeId/by-category
//    */
//   @Get(':collegeId/by-category')
//   async getByCategory(@Param('collegeId', ParseIntPipe) collegeId: number) {
//     const grouped = await this.recommendationsService.getByCategory(collegeId);

//     return {
//       success: true,
//       data: grouped,
//     };
//   }

//   /**
//    * Get implementation roadmap
//    * GET /recommendations/:collegeId/roadmap
//    */
//   @Get(':collegeId/roadmap')
//   async getRoadmap(@Param('collegeId', ParseIntPipe) collegeId: number) {
//     const roadmap = await this.recommendationsService.getRoadmap(collegeId);

//     return {
//       success: true,
//       data: roadmap,
//     };
//   }

//   /**
//    * Get competitive gap analysis
//    * GET /recommendations/:collegeId/competitive-gaps
//    */
//   @Get(':collegeId/competitive-gaps')
//   async getCompetitiveGaps(@Param('collegeId', ParseIntPipe) collegeId: number) {
//     const gaps = await this.recommendationsService.getCompetitiveGaps(collegeId);

//     return {
//       success: true,
//       data: gaps,
//     };
//   }

//   /**
//    * Get a single recommendation
//    * GET /recommendations/:collegeId/:id
//    */
//   @Get(':collegeId/:id')
//   async getRecommendation(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @Param('id', ParseIntPipe) id: number,
//   ) {
//     const recommendation = await this.recommendationsService.getRecommendationById(
//       id,
//       collegeId,
//     );

//     return {
//       success: true,
//       data: recommendation,
//     };
//   }

//   /**
//    * Update recommendation status
//    * PATCH /recommendations/:collegeId/:id/status
//    */
//   @Patch(':collegeId/:id/status')
//   async updateStatus(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @Param('id', ParseIntPipe) id: number,
//     @Body('status') status: 'open' | 'in_progress' | 'completed' | 'dismissed',
//   ) {
//     const recommendation = await this.recommendationsService.updateStatus(
//       id,
//       collegeId,
//       status,
//     );

//     return {
//       success: true,
//       message: `Recommendation status updated to ${status}`,
//       data: recommendation,
//     };
//   }

//   /**
//    * Mark recommendation as started
//    * PATCH /recommendations/:collegeId/:id/start
//    */
//   @Patch(':collegeId/:id/start')
//   async startRecommendation(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @Param('id', ParseIntPipe) id: number,
//   ) {
//     const recommendation = await this.recommendationsService.updateStatus(
//       id,
//       collegeId,
//       'in_progress',
//     );

//     return {
//       success: true,
//       message: 'Recommendation marked as in progress',
//       data: recommendation,
//     };
//   }

//   /**
//    * Mark recommendation as completed
//    * PATCH /recommendations/:collegeId/:id/complete
//    */
//   @Patch(':collegeId/:id/complete')
//   async completeRecommendation(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @Param('id', ParseIntPipe) id: number,
//   ) {
//     const recommendation = await this.recommendationsService.updateStatus(
//       id,
//       collegeId,
//       'completed',
//     );

//     return {
//       success: true,
//       message: 'Recommendation marked as completed. Will be validated in next analysis cycle.',
//       data: recommendation,
//     };
//   }

//   /**
//    * Dismiss a recommendation
//    * PATCH /recommendations/:collegeId/:id/dismiss
//    */
//   @Patch(':collegeId/:id/dismiss')
//   async dismissRecommendation(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @Param('id', ParseIntPipe) id: number,
//   ) {
//     const recommendation = await this.recommendationsService.updateStatus(
//       id,
//       collegeId,
//       'dismissed',
//     );

//     return {
//       success: true,
//       message: 'Recommendation dismissed',
//       data: recommendation,
//     };
//   }

//   /**
//    * Validate completed recommendations
//    * POST /recommendations/:collegeId/validate
//    */
//   @Post(':collegeId/validate')
//   async validateRecommendations(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//   ) {
//     const result = await this.recommendationsService.validateRecommendations(collegeId);

//     return {
//       success: true,
//       message: `Validation complete: ${result.validated} validated, ${result.notValidated} not validated, ${result.pending} pending`,
//       data: result,
//     };
//   }
// }
