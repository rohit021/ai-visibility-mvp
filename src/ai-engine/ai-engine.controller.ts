import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
  NotFoundException,
  ForbiddenException,
   Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { QueryExecutorService } from './services/query-executor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiQuery } from '../database/entities/ai-query.entity';
import { CollegeSubscription } from '../database/entities/college-subscription.entity';
import { CollegePrompt } from '../database/entities/college-prompt.entity';

@Controller('ai-queries')
@UseGuards(JwtAuthGuard)
export class AiEngineController {
  private readonly logger = new Logger(AiEngineController.name);
  constructor(
    private queryExecutor: QueryExecutorService,
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    @InjectRepository(CollegeSubscription)
    private subscriptionRepo: Repository<CollegeSubscription>,
    @InjectRepository(CollegePrompt)
    private collegePromptRepo: Repository<CollegePrompt>,
  ) {}

  /**
   * Get prompts mapped to a college
   */
  @Get('college/:collegeId/prompts')
  async getCollegePrompts(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    await this.verifyCollegeAccess(collegeId, user.userId);

    return this.collegePromptRepo.find({
      where: { collegeId, isEnabled: true },
      relations: ['prompt', 'prompt.category'],
      order: { priority: 'ASC' },
    });
  }

  /**
   * Execute AI queries for a specific college
   */
  @Post('execute/:collegeId')
  async executeQueries(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify user has active subscription for this college
    const subscription = await this.subscriptionRepo.findOne({
      where: { 
        userId: user.userId, 
        collegeId, 
        isActive: true 
      },
    });

    if (!subscription) {
      throw new NotFoundException(
        'You do not have an active subscription for this college',
      );
    }

    // Check subscription status
    if (subscription.status === 'expired' || subscription.status === 'cancelled') {
      throw new ForbiddenException(
        'Your subscription has expired. Please renew to execute queries.',
      );
    }

    return this.queryExecutor.executeQueriesForCollege(collegeId);
  }


  /** Queries for comparison  */

    @Post('execute-comparison-queries/:collegeId/:comparisonCollegeId')
  async executeComparisonQueries(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @Param('comparisonCollegeId', ParseIntPipe) comparisonCollegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify user has active subscription for this college
    const subscription = await this.subscriptionRepo.findOne({
      where: { 
        userId: user.userId, 
        collegeId, 
        isActive: true 
      },
    });

    if (!subscription) {
      throw new NotFoundException(
        'You do not have an active subscription for this college',
      );
    }

    // Check subscription status
    if (subscription.status === 'expired' || subscription.status === 'cancelled') {
      throw new ForbiddenException(
        'Your subscription has expired. Please renew to execute queries.',
      );
    }

    try {
      const result = await this.queryExecutor.executeComparisonQueries(
        collegeId,
        comparisonCollegeId,
      );

      return {
        success: true,
        message: 'Comparison queries executed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute comparison queries: ${error.message}`,
      );
      throw new HttpException(
        error.message || 'Failed to execute comparison queries',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

  }


  /**
   * Get all queries for a college (simple endpoint)
   */
  @Get('college/:collegeId')
  async getQueriesByCollege(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    await this.verifyCollegeAccess(collegeId, user.userId);
    console.log("Fetching queries for collegeId:", collegeId);
    return this.queryRepo.find({
      where: { collegeId },
      relations: ['prompt', 'aiEngine'],
      order: { executedAt: 'DESC' },
    });
  }

  /**
   * Get query history for a college
   */
  @Get(':collegeId/history')
  async getQueryHistory(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
    @Query('limit') limit: number = 50,
    @Query('status') status?: string,
  ) {
    await this.verifyCollegeAccess(collegeId, user.userId);

    const where: any = { collegeId };
    if (status && ['success', 'failed', 'pending'].includes(status)) {
      where.executionStatus = status;
    }

    return this.queryRepo.find({
      where,
      relations: ['prompt', 'prompt.category', 'aiEngine'],
      order: { executedAt: 'DESC' },
      take: Math.min(limit, 100),
    });
  }

  /**
   * Get specific query details with competitor results
   */
  @Get(':collegeId/query/:queryId')
  async getQueryDetails(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @Param('queryId', ParseIntPipe) queryId: number,
    @CurrentUser() user: any,
  ) {
    await this.verifyCollegeAccess(collegeId, user.userId);

    const query = await this.queryRepo.findOne({
      where: { id: queryId, collegeId },
      relations: [
        'prompt',
        'prompt.category',
        'aiEngine',
        'competitorResults',
        'competitorResults.source',
      ],
    });

    if (!query) {
      throw new NotFoundException('Query not found');
    }

    return query;
  }

  /**
   * Get query statistics for a college
   */
  @Get(':collegeId/stats')
  async getQueryStats(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    await this.verifyCollegeAccess(collegeId, user.userId);

    const [totalQueries, successfulQueries, failedQueries] = await Promise.all([
      this.queryRepo.count({ where: { collegeId } }),
      this.queryRepo.count({
        where: { collegeId, executionStatus: 'success' },
      }),
      this.queryRepo.count({
        where: { collegeId, executionStatus: 'failed' },
      }),
    ]);

    const mentionRate = await this.queryRepo
      .createQueryBuilder('query')
      .where('query.collegeId = :collegeId', { collegeId })
      .andWhere('query.executionStatus = :status', { status: 'success' })
      .select('AVG(query.yourCollegeMentioned)', 'mentionRate')
      .getRawOne();

    const avgRank = await this.queryRepo
      .createQueryBuilder('query')
      .where('query.collegeId = :collegeId', { collegeId })
      .andWhere('query.yourCollegeMentioned = :mentioned', { mentioned: true })
      .andWhere('query.yourCollegeRank IS NOT NULL')
      .select('AVG(query.yourCollegeRank)', 'avgRank')
      .getRawOne();

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      mentionRate: Math.round((mentionRate?.mentionRate || 0) * 100),
      averageRank: avgRank?.avgRank ? Math.round(avgRank.avgRank * 10) / 10 : null,
    };
  }

  private async verifyCollegeAccess(
    collegeId: number,
    userId: number,
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, collegeId, isActive: true },
    });

    if (!subscription) {
      throw new NotFoundException(
        'You do not have access to this college',
      );
    }
  }
}