import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Competitor } from './competitor.entity';
import { AiQuery } from './ai-query.entity';

@Entity('colleges')
export class College {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'college_name' })
  collegeName: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column({ nullable: true })
  website: string;

  @Column({ name: 'nirf_rank', nullable: true })
  nirfRank: number;

  @Column({ name: 'established_year', nullable: true })
  establishedYear: number;

  @Column({
    name: 'college_type',
    type: 'enum',
    enum: ['private', 'government', 'deemed'],
    default: 'private',
  })
  collegeType: string;

  @Column({ type: 'json', nullable: true })
  programs: string[];

  @Column({ type: 'json', nullable: true })
  specializations: string[];

  @Column({
    name: 'subscription_plan',
    type: 'enum',
    enum: ['starter', 'professional', 'enterprise'],
    default: 'professional',
  })
  subscriptionPlan: string;

  @Column({
    name: 'subscription_status',
    type: 'enum',
    enum: ['trial', 'active', 'expired'],
    default: 'trial',
  })
  subscriptionStatus: string;

  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  @Column({ name: 'subscription_ends_at', type: 'timestamp', nullable: true })
  subscriptionEndsAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.colleges)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Competitor, (competitor) => competitor.college)
  competitors: Competitor[];

  @OneToMany(() => AiQuery, (query) => query.college)
  aiQueries: AiQuery[];
}
