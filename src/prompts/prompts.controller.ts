import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('prompts')
@UseGuards(JwtAuthGuard)
export class PromptsController {
  constructor(private promptsService: PromptsService) {}

  @Get()
  async findAll() {
    return this.promptsService.findAll();
  }

  @Get('category/:category')
  async findByCategory(@Param('category') category: string) {
    return this.promptsService.findByCategory(category);
  }
}
