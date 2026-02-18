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
import { College } from './college.entity';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Foreign Key ───────────────────────────────────────────────────────────
  @Index()
  @Column({ name: 'college_id' })
  collegeId: number;

  // ── Recommendation Details ────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  })
  priority: 'high' | 'medium' | 'low';

  @Index()
  @Column({ length: 100 })
  category: string; // placements, fees, visibility, etc.

  @Column({ type: 'text' })
  issue: string; // What's the problem?

  @Column({ type: 'text' })
  recommendation: string; // What should they do?

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string | null; // Why does this problem exist?

  @Column({ name: 'expected_impact', length: 255, nullable: true })
  expectedImpact: string | null; // "+15% completeness score"

  @Column({ name: 'impact_score', type: 'int', nullable: true })
  impactScore: number | null; // Numeric score for sorting

  // ── Implementation Details ────────────────────────────────────────────────
  @Column({ name: 'implementation_steps', type: 'json', nullable: true })
  implementationSteps: string[] | null;

  @Column({
    name: 'estimated_effort',
    type: 'enum',
    enum: ['low', 'medium', 'high'],
    nullable: true,
  })
  estimatedEffort: 'low' | 'medium' | 'high' | null;

  @Column({ name: 'estimated_time_days', type: 'int', nullable: true })
  estimatedTimeDays: number | null;

  // ── Competitor Reference ──────────────────────────────────────────────────
  @Column({ name: 'competitor_reference', type: 'json', nullable: true })
  competitorReference: any[] | null; // Array of competitor data

  // ── Status ────────────────────────────────────────────────────────────────
  @Index()
  @Column({
    type: 'enum',
    enum: ['open', 'in_progress', 'completed', 'dismissed'],
    default: 'open',
  })
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'dismissed_at', type: 'timestamp', nullable: true })
  dismissedAt: Date | null;

  @Column({ name: 'dismissal_reason', type: 'text', nullable: true })
  dismissalReason: string | null;

  // ── Timestamps ────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relations ─────────────────────────────────────────────────────────────
  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'college_id' })
  college: College;
}