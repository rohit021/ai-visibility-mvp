import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollegesService } from './colleges.service';
import { CollegesController } from './colleges.controller';
import { College } from '../database/entities/college.entity';
import { CollegeSubscription } from '../database/entities/college-subscription.entity';
import { CollegeCompetitor } from '../database/entities/college-competitor.entity';
import { City } from '../database/entities/city.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      College,
      CollegeSubscription,
      CollegeCompetitor,
      City,
    ]),
  ],
  providers: [CollegesService],
  controllers: [CollegesController],
  exports: [CollegesService],
})
export class CollegesModule {}
