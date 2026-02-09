import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { City } from './city.entity';
// import { CollegeSubscription } from './college-subscription.entity';
import { AiQuery } from './ai-query.entity';
import { User } from './user.entity';
import { Competitor } from './competitor.entity';

@Entity('colleges')
export class College {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_name', length: 255 })
  collegeName: string;

  @Column({ name: 'city_id', nullable: true })
  cityId?: number;

   @Column({ length: 100, nullable: true })
  city?: string;

  @Column({ length: 100, nullable: true })
  state?: string;

  @Column({ length: 500, nullable: true })
  website?: string;

  @Column({ name: 'nirf_rank', nullable: true })
  nirfRank?: number;

  @Column({ name: 'established_year', nullable: true })
  establishedYear?: number;

  @Column({
    name: 'college_type',
    type: 'enum',
    enum: ['private', 'government', 'deemed', 'autonomous'],
    default: 'private',
  })
  collegeType: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;


  // Add these columns back
  @Column({ name: 'user_id' })
  userId: number;

  @Column({
    name: 'subscription_plan',
    type: 'enum',
    enum: ['starter', 'professional', 'enterprise'],
    default: 'starter',
  })
  subscriptionPlan: string;

  @Column({
    name: 'subscription_status',
    type: 'enum',
    enum: ['trial', 'active', 'expired', 'cancelled'],
    default: 'trial',
  })
  subscriptionStatus: string;

  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trialEndsAt?: Date;

  @Column({ name: 'subscription_ends_at', type: 'timestamp', nullable: true })
  subscriptionEndsAt?: Date;

  // Add this relation back
  @ManyToOne(() => User, (user) => user.colleges)
  @JoinColumn({ name: 'user_id' })
  user: User;

@OneToMany(() => Competitor, (competitor) => competitor.college)
competitors: Competitor[];

  @OneToMany(() => AiQuery, (query) => query.college)
  aiQueries: AiQuery[];

  // Indexes
  @Index('idx_city')
  cityIndex: number;

  @Index('idx_nirf')
  nirfIndex: number;

  @Index('idx_type')
  typeIndex: string;
}