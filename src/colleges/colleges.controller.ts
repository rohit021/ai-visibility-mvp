import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CollegesService } from './colleges.service';
import { CreateCollegeDto } from './dto/create-college.dto';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('colleges')
@UseGuards(JwtAuthGuard)
export class CollegesController {
  constructor(private collegesService: CollegesService) {}

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() createCollegeDto: CreateCollegeDto,
  ) {
    return this.collegesService.create(user.userId, createCollegeDto);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.collegesService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.collegesService.findOne(id, user.userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() updateData: Partial<CreateCollegeDto>,
  ) {
    return this.collegesService.update(id, user.userId, updateData);
  }

  @Post(':id/competitors')
  async addCompetitor(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() addCompetitorDto: AddCompetitorDto,
  ) {
    return this.collegesService.addCompetitor(id, user.userId, addCompetitorDto);
  }

  @Get(':id/competitors')
  async getCompetitors(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.collegesService.getCompetitors(id, user.userId);
  }

  @Delete(':id/competitors/:competitorId')
  async removeCompetitor(
    @Param('id', ParseIntPipe) id: number,
    @Param('competitorId', ParseIntPipe) competitorId: number,
    @CurrentUser() user: any,
  ) {
    return this.collegesService.removeCompetitor(id, competitorId, user.userId);
  }



  // ##############################City###################

  @Get('by-city/:cityId')
  async getCollegesByCity(@Param('cityId', ParseIntPipe) cityId: number) {
    return this.collegesService.getCollegesByCity(cityId);
  }


}


