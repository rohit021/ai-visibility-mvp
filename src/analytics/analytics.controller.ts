import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { College } from '../database/entities/college.entity';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
  ) {}

  @Get('visibility-score/:collegeId')
  async getVisibilityScore(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify ownership
    const college = await this.collegeRepo.findOne({
      where: { id: collegeId, userId: user.userId },
    });

    if (!college) {
      throw new Error('College not found or access denied');
    }

    return this.analyticsService.getLatestScore(collegeId);
  }

  @Get('trends/:collegeId')
  async getTrends(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
    @Query('weeks') weeks: number = 12,
  ) {
    // Verify ownership
    const college = await this.collegeRepo.findOne({
      where: { id: collegeId, userId: user.userId },
    });

    if (!college) {
      throw new Error('College not found or access denied');
    }

    return this.analyticsService.getTrendData(collegeId, weeks);
  }

  @Post('calculate/:collegeId')
  async calculateScore(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    // Verify ownership
    const college = await this.collegeRepo.findOne({
      where: { id: collegeId, userId: user.userId },
    });

    if (!college) {
      throw new Error('College not found or access denied');
    }

    // Calculate for current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    return this.analyticsService.calculateScoreForPeriod(
      collegeId,
      weekStart,
      now,
    );
  }
}
