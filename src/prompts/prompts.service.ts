import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptLibrary } from '../database/entities/prompt-library.entity';

@Injectable()
export class PromptsService {
  constructor(
    @InjectRepository(PromptLibrary)
    private promptRepository: Repository<PromptLibrary>,
  ) {}

  async findAll() {
    return this.promptRepository.find({
      where: { isActive: true },
    });
  }

  async findByCategory(category: string) {
    return this.promptRepository.find({
      where: { category, isActive: true },
    });
  }

  async findForCollege(collegeId: number) {
    // Get system prompts + college-specific prompts
    return this.promptRepository.find({
      where: [
        { isSystemPrompt: true, isActive: true },
        { collegeId, isActive: true },
      ],
    });
  }
}
