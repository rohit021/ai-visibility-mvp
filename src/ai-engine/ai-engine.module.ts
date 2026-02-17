import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiEngineController } from './ai-engine.controller';
import { QueryExecutorService } from './services/query-executor.service';
import { OpenAIService } from './services/openai.service';
import { ResponseParserService } from './services/response-parser.service';
import { AiQuery } from '../database/entities/ai-query.entity';
import { QueryCompetitorResult } from '../database/entities/query-competitor-result.entity';
import { College } from '../database/entities/college.entity';
import { CollegeSubscription } from '../database/entities/college-subscription.entity';
import { Prompt } from '../database/entities/prompt.entity';
import { CollegeCompetitor } from '../database/entities/college-competitor.entity';
import { AiEngine } from '../database/entities/ai-engine.entity';
import { CitationSource } from '../database/entities/citation-source.entity';
import { CollegePrompt } from '../database/entities/college-prompt.entity';
import { ComparisonParserService } from './services/comparison-analytics-parser';
import { FeatureComparison } from '../database/entities/feature-comparison.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiQuery,
      QueryCompetitorResult,
      College,
      CollegeSubscription,
      Prompt,
      CollegePrompt,
      CollegeCompetitor,
      AiEngine,
      CitationSource,
      FeatureComparison,
    ]),
  ],
  controllers: [AiEngineController],
  providers: [QueryExecutorService, OpenAIService, ResponseParserService, ComparisonParserService],
  exports: [QueryExecutorService],
})
export class AiEngineModule {}