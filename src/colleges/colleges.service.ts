import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { College } from '../database/entities/college.entity';
import { CollegeSubscription } from '../database/entities/college-subscription.entity';
import { CollegeCompetitor } from '../database/entities/college-competitor.entity';
import { CreateCollegeDto } from './dto/create-college.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { CollegePrompt } from '../database/entities/college-prompt.entity';

@Injectable()
export class CollegesService {
  constructor(
    @InjectRepository(College)
    private collegeRepository: Repository<College>,
    @InjectRepository(CollegeSubscription)
    private subscriptionRepository: Repository<CollegeSubscription>,
    @InjectRepository(CollegeCompetitor)
    private competitorRepository: Repository<CollegeCompetitor>,
    @InjectRepository(CollegePrompt)
    private collegePromptRepo: Repository<CollegePrompt>,
  ) {}

  // ==================== COLLEGE MASTER DATA ====================

  /**
   * Create a new college in master database (Admin only - or open for now)
   */
  async createCollege(createCollegeDto: CreateCollegeDto) {
    const college = this.collegeRepository.create(createCollegeDto);
    return this.collegeRepository.save(college);
  }

  /**
   * Search colleges by name (for users to find their college)
   */
  async searchColleges(searchTerm: string, limit: number = 10) {
    return this.collegeRepository
      .createQueryBuilder('college')
      .where('college.collegeName LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .andWhere('college.isActive = :isActive', { isActive: true })
      .leftJoinAndSelect('college.cityRelation', 'city')
      .limit(limit)
      .getMany();
  }

  /**
   * Get all colleges in a city (for competitor selection)
   */
  async getCollegesByCity(cityId: number) {
    return this.collegeRepository.find({
      where: { cityId, isActive: true },
      relations: ['cityRelation'],
      order: { nirfRank: 'ASC' },
    });
  }

  /**
   * Get college by ID (public info)
   */
  async getCollegeById(collegeId: number) {
    const college = await this.collegeRepository.findOne({
      where: { id: collegeId, isActive: true },
      relations: ['cityRelation'],
    });

    if (!college) {
      throw new NotFoundException('College not found');
    }

    return college;
  }

  // ==================== SUBSCRIPTIONS ====================

  /**
   * Create a subscription for a user to manage a college
   */
  async createSubscription(
    userId: number,
    createSubscriptionDto: CreateSubscriptionDto,
  ) {
    // Verify college exists
    const college = await this.collegeRepository.findOne({
      where: { id: createSubscriptionDto.collegeId, isActive: true },
    });

    if (!college) {
      throw new NotFoundException('College not found');
    }

    // Check if user already has subscription for this college
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        collegeId: createSubscriptionDto.collegeId,
        isActive: true,
      },
    });

    if (existingSubscription) {
      throw new BadRequestException(
        'You already have an active subscription for this college',
      );
    }

    // Set trial period (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const plan = createSubscriptionDto.plan || 'starter';

    const subscription = this.subscriptionRepository.create({
      userId,
      collegeId: createSubscriptionDto.collegeId,
      plan,
      status: 'trial',
      trialEndsAt,
      maxCompetitors: this.getMaxCompetitors(plan),
      maxPrompts: this.getMaxPrompts(plan),
      queriesPerDay: this.getQueriesPerDay(plan),
    });

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: number) {
    return this.subscriptionRepository.find({
      where: { userId, isActive: true },
      relations: ['college', 'college.cityRelation'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific subscription with details
   */
  async getSubscription(subscriptionId: number, userId: number) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, isActive: true },
      relations: ['college', 'college.cityRelation'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Check ownership
    if (subscription.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this subscription',
      );
    }

    return subscription;
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(
    subscriptionId: number,
    userId: number,
    plan: string,
  ) {
    const subscription = await this.getSubscription(subscriptionId, userId);

    subscription.plan = plan;
    subscription.maxCompetitors = this.getMaxCompetitors(plan);
    subscription.maxPrompts = this.getMaxPrompts(plan);
    subscription.queriesPerDay = this.getQueriesPerDay(plan);

    // If upgrading from trial to paid
    if (subscription.status === 'trial') {
      subscription.status = 'active';
      subscription.subscriptionStartsAt = new Date();

      const endsAt = new Date();
      endsAt.setMonth(endsAt.getMonth() + 1); // 1 month from now
      subscription.subscriptionEndsAt = endsAt;
    }

    return this.subscriptionRepository.save(subscription);
  }

  // ==================== COMPETITORS ====================

  /**
   * Add a competitor to track (using college ID)
   */
  async addCompetitor(
    collegeId: number,
    userId: number,
    addCompetitorDto: AddCompetitorDto,
  ) {
    // Get user's subscription for this college
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, collegeId, isActive: true },
    });

    if (!subscription) {
      throw new NotFoundException(
        'You do not have an active subscription for this college',
      );
    }

    // Check if trying to add own college as competitor
    if (collegeId === addCompetitorDto.competitorCollegeId) {
      throw new BadRequestException('Cannot add your own college as competitor');
    }

    // Verify competitor college exists
    const competitorCollege = await this.collegeRepository.findOne({
      where: { id: addCompetitorDto.competitorCollegeId, isActive: true },
    });

    if (!competitorCollege) {
      throw new NotFoundException('Competitor college not found');
    }

    // Check competitor limit
    const activeCompetitors = await this.competitorRepository.count({
      where: { collegeId, isActive: true },
    });

    if (activeCompetitors >= subscription.maxCompetitors) {
      throw new ForbiddenException(
        `Maximum ${subscription.maxCompetitors} competitors allowed for ${subscription.plan} plan. Upgrade to add more.`,
      );
    }

    // Check if already added
    const existing = await this.competitorRepository.findOne({
      where: {
        collegeId,
        competitorCollegeId: addCompetitorDto.competitorCollegeId,
      },
    });

    if (existing) {
      if (existing.isActive) {
        throw new BadRequestException('This competitor is already being tracked');
      } else {
        // Re-activate if previously deleted
        existing.isActive = true;
        return this.competitorRepository.save(existing);
      }
    }

    const competitor = this.competitorRepository.create({
      collegeId,
      competitorCollegeId: addCompetitorDto.competitorCollegeId,
    });

    return this.competitorRepository.save(competitor);
  }

  /**
   * Get all competitors for a college
   */
  async getCompetitors(collegeId: number, userId: number) {
    // Verify user has access to this college
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, collegeId, isActive: true },
    });

    if (!subscription) {
      throw new ForbiddenException('You do not have access to this college');
    }

    return this.competitorRepository.find({
      where: { collegeId, isActive: true },
      relations: ['competitorCollege', 'competitorCollege.cityRelation'],
    });
  }

  /**
   * Remove a competitor (soft delete)
   */
  async removeCompetitor(
    collegeId: number,
    competitorId: number,
    userId: number,
  ) {
    // Verify user has access
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, collegeId, isActive: true },
    });

    if (!subscription) {
      throw new ForbiddenException('You do not have access to this college');
    }

    const competitor = await this.competitorRepository.findOne({
      where: { id: competitorId, collegeId },
    });

    if (!competitor) {
      throw new NotFoundException('Competitor not found');
    }

    competitor.isActive = false;
    return this.competitorRepository.save(competitor);
  }

  // ==================== HELPER METHODS ====================

  private getMaxCompetitors(plan: string): number {
    const limits = { starter: 5, professional: 10, enterprise: 15 };
    return limits[plan] || 5;
  }

  private getMaxPrompts(plan: string): number {
    const limits = { starter: 25, professional: 50, enterprise: 100 };
    return limits[plan] || 25;
  }

  private getQueriesPerDay(plan: string): number {
    const limits = { starter: 2, professional: 3, enterprise: 5 };
    return limits[plan] || 2;
  }

  async assignPrompt(
  collegeId: number,
  promptId: number,
  userId: number,
  priority: number = 0,
) {
  // Verify access
  const subscription = await this.subscriptionRepository.findOne({
    where: { userId, collegeId, isActive: true },
  });

  if (!subscription) {
    throw new ForbiddenException('No access to this college');
  }

  // Check if already assigned
  const existing = await this.collegePromptRepo.findOne({
    where: { collegeId, promptId },
  });

  if (existing) {
    existing.isEnabled = true;
    existing.priority = priority;
    return this.collegePromptRepo.save(existing);
  }

  const collegePrompt = this.collegePromptRepo.create({
    collegeId,
    promptId,
    isEnabled: true,
    priority,
  });

  return this.collegePromptRepo.save(collegePrompt);
}

async getCollegePrompts(collegeId: number, userId: number) {
  // Verify access
  const subscription = await this.subscriptionRepository.findOne({
    where: { userId, collegeId, isActive: true },
  });

  if (!subscription) {
    throw new ForbiddenException('No access to this college');
  }

  return this.collegePromptRepo.find({
    where: { collegeId },
    relations: ['prompt', 'prompt.category'],
    order: { priority: 'DESC' },
  });
}

async removePrompt(collegeId: number, promptId: number, userId: number) {
  // Verify access
  const subscription = await this.subscriptionRepository.findOne({
    where: { userId, collegeId, isActive: true },
  });

  if (!subscription) {
    throw new ForbiddenException('No access to this college');
  }

  const collegePrompt = await this.collegePromptRepo.findOne({
    where: { collegeId, promptId },
  });

  if (!collegePrompt) {
    throw new NotFoundException('Prompt assignment not found');
  }

  collegePrompt.isEnabled = false;
  return this.collegePromptRepo.save(collegePrompt);
}



}