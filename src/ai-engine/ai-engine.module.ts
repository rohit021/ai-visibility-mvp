import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryExecutorService } from './services/query-executor.service';
import { OpenAIService } from './services/openai.service';
import { ResponseParserService } from './services/response-parser.service';
import { AiEngineController } from './ai-engine.controller';
import { AiQuery } from '../database/entities/ai-query.entity';
import { College } from '../database/entities/college.entity';
import { PromptLibrary } from '../database/entities/prompt-library.entity';
import { Competitor } from '../database/entities/competitor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiQuery, College, PromptLibrary, Competitor]),
  ],
  providers: [QueryExecutorService, OpenAIService, ResponseParserService],
  controllers: [AiEngineController],
  exports: [QueryExecutorService],
})
export class AiEngineModule {}
