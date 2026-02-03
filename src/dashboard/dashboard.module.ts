import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { College } from '../database/entities/college.entity';
import { VisibilityScore } from '../database/entities/visibility-score.entity';
import { AiQuery } from '../database/entities/ai-query.entity';

@Module({
  imports: [TypeOrmModule.forFeature([College, VisibilityScore, AiQuery])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
