import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CollegesService } from './colleges.service';
import { CreateCollegeDto } from './dto/create-college.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('colleges')
export class CollegesController {
  constructor(private collegesService: CollegesService) {}

  // ==================== COLLEGE SEARCH (Public or Auth) ====================

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchColleges(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
  ) {
    return this.collegesService.searchColleges(searchTerm, limit);
  }

  @Get('by-city/:cityId')
  @UseGuards(JwtAuthGuard)
  async getCollegesByCity(@Param('cityId', ParseIntPipe) cityId: number) {
    return this.collegesService.getCollegesByCity(cityId);
  }

  @Get('details/:id')
  @UseGuards(JwtAuthGuard)
  async getCollegeById(@Param('id', ParseIntPipe) id: number) {
    return this.collegesService.getCollegeById(id);
  }

  // ==================== SUBSCRIPTIONS ====================

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard)
  async createSubscription(
    @CurrentUser() user: any,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.collegesService.createSubscription(
      user.userId,
      createSubscriptionDto,
    );
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  async getUserSubscriptions(@CurrentUser() user: any) {
    return this.collegesService.getUserSubscriptions(user.userId);
  }

  @Get('subscriptions/:id')
  @UseGuards(JwtAuthGuard)
  async getSubscription(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.collegesService.getSubscription(id, user.userId);
  }

  @Patch('subscriptions/:id/plan')
  @UseGuards(JwtAuthGuard)
  async updatePlan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body('plan') plan: string,
  ) {
    return this.collegesService.updateSubscriptionPlan(id, user.userId, plan);
  }

  // ==================== COMPETITORS ====================

  @Post(':collegeId/competitors')
  @UseGuards(JwtAuthGuard)
  async addCompetitor(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
    @Body() addCompetitorDto: AddCompetitorDto,
  ) {
    return this.collegesService.addCompetitor(
      collegeId,
      user.userId,
      addCompetitorDto,
    );
  }

  @Get(':collegeId/competitors')
  @UseGuards(JwtAuthGuard)
  async getCompetitors(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @CurrentUser() user: any,
  ) {
    return this.collegesService.getCompetitors(collegeId, user.userId);
  }

  @Delete(':collegeId/competitors/:competitorId')
  @UseGuards(JwtAuthGuard)
  async removeCompetitor(
    @Param('collegeId', ParseIntPipe) collegeId: number,
    @Param('competitorId', ParseIntPipe) competitorId: number,
    @CurrentUser() user: any,
  ) {
    return this.collegesService.removeCompetitor(
      collegeId,
      competitorId,
      user.userId,
    );
  }
}