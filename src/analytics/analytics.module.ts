import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { DashboardService } from './services/dashboard.service';
import { GapsAnalyzerService } from './services/gaps-analyzer.service';
import { RecommendationsService } from './services/recommendations.service';
import { CompetitorAnalyzerService } from './services/competitor-analyzer.service';
import { College } from '../database/entities/college.entity';
import { AiQuery } from '../database/entities/ai-query.entity';
import { CollegeAiProfile } from '../database/entities/college-ai-profiles.entity';
import { CollegeAiProfileHistory } from '../database/entities/college-ai-profile-history.entity';
import { FeatureComparison } from '../database/entities/feature-comparison.entity';
import { CollegeCompetitor } from '../database/entities/college-competitor.entity';
import { CollegeSubscription } from '../database/entities/college-subscription.entity';
import { Recommendation } from '../database/entities/recommendation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      College,
      AiQuery,
      CollegeAiProfile,
      CollegeAiProfileHistory,
      FeatureComparison,
      CollegeCompetitor,
      CollegeSubscription,
      Recommendation,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    DashboardService,
    GapsAnalyzerService,
    RecommendationsService,
    CompetitorAnalyzerService,
  ],
  exports: [
    DashboardService,
    GapsAnalyzerService,
    RecommendationsService,
    CompetitorAnalyzerService,
  ],
})
export class AnalyticsModule {}