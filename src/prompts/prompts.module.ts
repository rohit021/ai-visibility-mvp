import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptsService } from './prompts.service';
import { PromptsController } from './prompts.controller';
import { PromptLibrary } from '../database/entities/prompt-library.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromptLibrary])],
  providers: [PromptsService],
  controllers: [PromptsController],
  exports: [PromptsService],
})
export class PromptsModule {}
