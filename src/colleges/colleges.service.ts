import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { College } from '../database/entities/college.entity';
import { Competitor } from '../database/entities/competitor.entity';
import { CreateCollegeDto } from './dto/create-college.dto';
import { AddCompetitorDto } from './dto/add-competitor.dto';

@Injectable()
export class CollegesService {
  constructor(
    @InjectRepository(College)
    private collegeRepository: Repository<College>,
    @InjectRepository(Competitor)
    private competitorRepository: Repository<Competitor>,
  ) {}

  async create(userId: number, createCollegeDto: CreateCollegeDto) {
    // Set trial period (90 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 90);

    const college = this.collegeRepository.create({
      ...createCollegeDto,
      userId,
      subscriptionStatus: 'trial',
      trialEndsAt,
    });

    return this.collegeRepository.save(college);
  }

  async findAll(userId: number) {
    return this.collegeRepository.find({
      where: { userId },
      relations: ['competitors'],
    });
  }

  async findOne(id: number, userId: number) {
    const college = await this.collegeRepository.findOne({
      where: { id },
      relations: ['competitors'],
    });

    if (!college) {
      throw new NotFoundException('College not found');
    }

    // Check ownership
    if (college.userId !== userId) {
      throw new ForbiddenException('You do not have access to this college');
    }

    return college;
  }

  async update(id: number, userId: number, updateData: Partial<CreateCollegeDto>) {
    const college = await this.findOne(id, userId);

    Object.assign(college, updateData);

    return this.collegeRepository.save(college);
  }

  async addCompetitor(
    collegeId: number,
    userId: number,
    addCompetitorDto: AddCompetitorDto,
  ) {
    // Verify ownership
    await this.findOne(collegeId, userId);

    // Check competitor limit (max 5 for professional plan)
    const competitorCount = await this.competitorRepository.count({
      where: { collegeId, isActive: true },
    });

    if (competitorCount >= 5) {
      throw new ForbiddenException(
        'Maximum 5 competitors allowed. Upgrade to enterprise plan for more.',
      );
    }

    const competitor = this.competitorRepository.create({
      ...addCompetitorDto,
      collegeId,
    });

    return this.competitorRepository.save(competitor);
  }

  async getCompetitors(collegeId: number, userId: number) {
    // Verify ownership
    await this.findOne(collegeId, userId);

    return this.competitorRepository.find({
      where: { collegeId, isActive: true },
    });
  }

  async removeCompetitor(
    collegeId: number,
    competitorId: number,
    userId: number,
  ) {
    // Verify ownership
    await this.findOne(collegeId, userId);

    const competitor = await this.competitorRepository.findOne({
      where: { id: competitorId, collegeId },
    });

    if (!competitor) {
      throw new NotFoundException('Competitor not found');
    }

    // Soft delete
    competitor.isActive = false;
    return this.competitorRepository.save(competitor);
  }
}
