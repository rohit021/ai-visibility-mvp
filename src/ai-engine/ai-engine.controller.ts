import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { QueryExecutorService } from './services/query-executor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AiQuery } from '../database/entities/ai-query.entity';
import { College } from '../database/entities/college.entity';

@Controller('ai-queries')
@UseGuards(JwtAuthGuard)
export class AiEngineController {
  constructor(
    private queryExecutor: QueryExecutorService,
    @InjectRepository(AiQuery)
    private queryRepo: Repository<AiQuery>,
    @InjectRepository(College)
    private collegeRepo: Repository<College>,
  ) {}

  @Post('execute/:collegeId')
  async executeQueries(
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

    return this.queryExecutor.executeQueriesForCollege(collegeId);
  }

  @Get(':collegeId')
  async getQueryHistory(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
    @Query('limit') limit: number = 50,
  ) {
    // Verify ownership
    const college = await this.collegeRepo.findOne({
      where: { id: collegeId, userId: user.userId },
    });

    if (!college) {
      throw new Error('College not found or access denied');
    }

    return this.queryRepo.find({
      where: { collegeId },
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }

  @Get(':collegeId/:queryId')
  async getQueryDetails(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @Param('queryId', ParseIntPipe) queryId: number,
    @CurrentUser() user: any,
  ) {
    // Verify ownership
    const college = await this.collegeRepo.findOne({
      where: { id: collegeId, userId: user.userId },
    });

    if (!college) {
      throw new Error('College not found or access denied');
    }

    return this.queryRepo.findOne({
      where: { id: queryId, collegeId },
    });
  }
}
