// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { RecommendationsController } from './recommendations.controller';
// import { RecommendationsService } from './recommendations.service';
// import { RecommendationEngineService } from './services/recommendation-engine.service';
// import { Recommendation } from '../database/entities/recommendation.entity';
// import { AiQuery } from '../database/entities/ai-query.entity';
// import { College } from '../database/entities/college.entity';
// import { Competitor } from '../database/entities/competitor.entity';
// import { VisibilityScore } from '../database/entities/visibility-score.entity';
// import { PromptLibrary } from '../database/entities/prompt-library.entity';

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([
//       Recommendation,
//       AiQuery,
//       College,
//       Competitor,
//       VisibilityScore,
//       PromptLibrary,
//     ]),
//   ],
//   controllers: [RecommendationsController],
//   providers: [RecommendationsService, RecommendationEngineService],
//   exports: [RecommendationsService, RecommendationEngineService],
// })
// export class RecommendationsModule {}
