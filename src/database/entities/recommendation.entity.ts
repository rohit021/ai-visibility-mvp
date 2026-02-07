import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { College } from './college.entity';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_id' })
  collegeId: number;

  @Column({
    type: 'enum',
    enum: ['high', 'medium', 'low'],
  })
  priority: 'high' | 'medium' | 'low';

  @Column({ length: 100 })
  category: string;

  @Column({ type: 'text' })
  issue: string;

  @Column({ type: 'text' })
  recommendation: string;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string;

  @Column({ name: 'expected_impact', length: 255, nullable: true })
  expectedImpact: string;

  @Column({ name: 'impact_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  impactScore: number;

  @Column({ name: 'affected_queries', type: 'json', nullable: true })
  affectedQueries: string[];

  @Column({ name: 'competitor_reference', type: 'json', nullable: true })
  competitorReference: {
    name: string;
    strength: string;
    theirRank: number;
    yourRank: number;
  }[];

  @Column({ name: 'implementation_steps', type: 'json', nullable: true })
  implementationSteps: string[];

  @Column({
    name: 'estimated_effort',
    type: 'enum',
    enum: ['low', 'medium', 'high'],
    nullable: true,
  })
  estimatedEffort: 'low' | 'medium' | 'high';

  @Column({ name: 'estimated_time_days', nullable: true })
  estimatedTimeDays: number;

  @Column({
    type: 'enum',
    enum: ['open', 'in_progress', 'completed', 'dismissed'],
    default: 'open',
  })
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';

  @Column({ name: 'validation_status', type: 'enum', enum: ['pending', 'validated', 'not_validated'], default: 'pending' })
  validationStatus: 'pending' | 'validated' | 'not_validated';

  @Column({ name: 'visibility_before', type: 'decimal', precision: 5, scale: 2, nullable: true })
  visibilityBefore: number;

  @Column({ name: 'visibility_after', type: 'decimal', precision: 5, scale: 2, nullable: true })
  visibilityAfter: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @ManyToOne(() => College)
  @JoinColumn({ name: 'college_id' })
  college: College;
}
