// import {
//   Controller,
//   Get,
//   Param,
//   UseGuards,
//   ParseIntPipe,
// } from '@nestjs/common';
// import { DashboardService } from './dashboard.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { CurrentUser } from '../auth/decorators/current-user.decorator';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { College } from '../database/entities/college.entity';

// @Controller('dashboard')
// @UseGuards(JwtAuthGuard)
// export class DashboardController {
//   constructor(
//     private dashboardService: DashboardService,
//     @InjectRepository(College)
//     private collegeRepo: Repository<College>,
//   ) {}

//   @Get(':collegeId')
//   async getDashboard(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @CurrentUser() user: any,
//   ) {
//     // Verify ownership
//     const college = await this.collegeRepo.findOne({
//       where: { id: collegeId, userId: user.userId },
//     });

//     if (!college) {
//       throw new Error('College not found or access denied');
//     }

//     return this.dashboardService.getDashboard(collegeId);
//   }

//   @Get(':collegeId/summary')
//   async getSummary(
//     @Param('collegeId', ParseIntPipe) collegeId: number,
//     @CurrentUser() user: any,
//   ) {
//     // Verify ownership
//     const college = await this.collegeRepo.findOne({
//       where: { id: collegeId, userId: user.userId },
//     });

//     if (!college) {
//       throw new Error('College not found or access denied');
//     }

//     return this.dashboardService.getSummary(collegeId);
//   }
// }
