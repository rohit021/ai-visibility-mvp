import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { VisibilityScore } from '../database/entities/visibility-score.entity';
import { VisibilityCalculatorService } from './services/visibility-calculator.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(VisibilityScore)
    private scoreRepo: Repository<VisibilityScore>,
    private visibilityCalculator: VisibilityCalculatorService,
  ) {}

  async getLatestScore(collegeId: number) {
    return this.scoreRepo.findOne({
      where: { collegeId },
      order: { periodStart: 'DESC' },
    });
  }

  async getTrendData(collegeId: number, weeks: number = 12) {
    return this.scoreRepo.find({
      where: { collegeId, periodType: 'weekly' },
      order: { periodStart: 'DESC' },
      take: weeks,
    });
  }

  async calculateScoreForPeriod(
    collegeId: number,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return this.visibilityCalculator.calculateWeeklyScore(
      collegeId,
      periodStart,
      periodEnd,
    );
  }
}
