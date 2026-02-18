import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DashboardService } from './services/dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollegeSubscription } from '../database/entities/college-subscription.entity';
import { GapsAnalyzerService } from './services/gaps-analyzer.service';
import { RecommendationsService } from './services/recommendations.service';
import { CompetitorAnalyzerService } from './services/competitor-analyzer.service'

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private dashboardService: DashboardService,
    @InjectRepository(CollegeSubscription)
    private subscriptionRepo: Repository<CollegeSubscription>,
    private gapsAnalyzerService: GapsAnalyzerService,
    private recommendationsService: RecommendationsService,
    private competitorAnalyzerService: CompetitorAnalyzerService,
  ) {}

  /**
   * GET /analytics/dashboard/:collegeId
   * 
   * Returns complete dashboard overview including:
   * - Visibility metrics (Layer 1)
   * - AI knowledge completeness (Layer 3)
   * - Competitive position (Layer 2)
   * - Recent trends
   */
  @Get('dashboard/:collegeId')
  async getDashboardOverview(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify user has access to this college
    // await this.verifyAccess(collegeId, user.userId);

    const overview = await this.dashboardService.getOverview(collegeId);

    return {
      success: true,
      data: overview,
    };
  }


  @Get('gaps/:collegeId')
  async getDetailedGaps(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify user has access to this college
    // await this.verifyAccess(collegeId, user.userId);

    const gaps = await this.gapsAnalyzerService.analyzeGaps(collegeId);

    return {
      success: true,
      data: gaps,
    };
  }



  /**
   * GET /analytics/recommendations/:collegeId
   * 
   * Returns auto-generated recommendations based on gaps:
   * - High/medium/low priority recommendations
   * - Implementation steps
   * - Expected impact
   * - Competitor references
   */
  @Get('recommendations/:collegeId')
  async getRecommendations(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify user has access to this college
    // await this.verifyAccess(collegeId, user.userId);

    const recommendations = await this.recommendationsService.getRecommendations(collegeId);

    return {
      success: true,
      data: recommendations,
    };
  }

  /**
   * GET /analytics/competitors/:collegeId
   * 
   * Returns detailed competitor comparison:
   * - Your rank among competitors
   * - Head-to-head feature battles
   * - Gap analysis vs each competitor
   * - Visibility rankings
   */
  @Get('competitors/:collegeId')
  async getCompetitorAnalysis(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify user has access to this college
    await this.verifyAccess(collegeId, user.userId);

    const analysis = await this.competitorAnalyzerService.analyzeCompetitors(collegeId);

    return {
      success: true,
      data: analysis,
    };
  }



  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Verify user has subscription for this college
  // ─────────────────────────────────────────────────────────────────────────
  private async verifyAccess(collegeId: number, userId: number): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, collegeId, isActive: true },
    });

    if (!subscription) {
      throw new NotFoundException('You do not have access to this college');
    }
  }
}