import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { College } from './college.entity';

@Entity('college_subscriptions')
export class CollegeSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'college_id' })
  collegeId: number;

  @Column({
    type: 'enum',
    enum: ['starter', 'professional', 'enterprise'],
    default: 'starter',
  })
  plan: string;

  @Column({
    type: 'enum',
    enum: ['trial', 'active', 'expired', 'cancelled'],
    default: 'trial',
  })
  status: string;

  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  @Column({ name: 'subscription_starts_at', type: 'timestamp', nullable: true })
  subscriptionStartsAt: Date;

  @Column({ name: 'subscription_ends_at', type: 'timestamp', nullable: true })
  subscriptionEndsAt: Date;

  @Column({ name: 'max_competitors', default: 5 })
  maxCompetitors: number;

  @Column({ name: 'max_prompts', default: 50 })
  maxPrompts: number;

  @Column({ name: 'queries_per_day', default: 2 })
  queriesPerDay: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.subscriptions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => College, (college) => college.subscriptions)
  @JoinColumn({ name: 'college_id' })
  college: College;

  // Indexes
//   @Index('idx_user')
//   userIndex: number;

//   @Index('idx_college')
//   collegeIndex: number;

//   @Index('idx_status')
//   statusIndex: string;
}