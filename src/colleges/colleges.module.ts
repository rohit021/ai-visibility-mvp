import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollegesService } from './colleges.service';
import { CollegesController } from './colleges.controller';
import { College } from '../database/entities/college.entity';
import { Competitor } from '../database/entities/competitor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([College, Competitor])],
  providers: [CollegesService],
  controllers: [CollegesController],
  exports: [CollegesService],
})
export class CollegesModule {}
