import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollegesService } from './colleges.service';
import { CollegesController } from './colleges.controller';
import { College } from '../database/entities/college.entity';
import { CollegeSubscription } from '../database/entities/college-subscription.entity';
import { CollegeCompetitor } from '../database/entities/college-competitor.entity';
import { City } from '../database/entities/city.entity';
import { CollegePrompt } from '../database/entities/college-prompt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      College,
      CollegeSubscription,
      CollegeCompetitor,
      City,
      CollegePrompt,
    ]),
  ],
  providers: [CollegesService],
  controllers: [CollegesController],
  exports: [CollegesService],
})
export class CollegesModule {}
