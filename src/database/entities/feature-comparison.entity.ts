import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AiQuery } from './ai-query.entity';
import { College } from './college.entity';

@Entity('feature_comparisons')
export class FeatureComparison {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'query_id' })
  queryId: number;

  @Index()
  @Column({ name: 'college_id' })
  collegeId: number;

  @Index()
  @Column({ name: 'competitor_college_id' })
  competitorCollegeId: number;

  // Feature battle details
  @Index()
  @Column({ name: 'feature_name', length: 100 })
  featureName: string;

  @Index()
  @Column({
    name: 'winner',
    type: 'enum',
    enum: ['client', 'competitor', 'neutral', 'unclear'],
    default: 'unclear',
  })
  winner: 'client' | 'competitor' | 'neutral' | 'unclear';

  @Column({
    name: 'confidence_level',
    type: 'enum',
    enum: ['strong', 'moderate', 'weak'],
    default: 'weak',
  })
  confidenceLevel: 'strong' | 'moderate' | 'weak';

  // Reasoning
  @Column({ name: 'client_reasoning', type: 'text', nullable: true })
  clientReasoning: string;

  @Column({ name: 'competitor_reasoning', type: 'text', nullable: true })
  competitorReasoning: string;

  // Data points extracted
  @Column({ name: 'client_data_points', type: 'json', nullable: true })
  clientDataPoints: Record<string, any>;

  @Column({ name: 'competitor_data_points', type: 'json', nullable: true })
  competitorDataPoints: Record<string, any>;

  // Sources cited
  @Column({ name: 'sources', type: 'json', nullable: true })
  sources: string[];

  // Gap identification
  @Column({ name: 'data_gap_identified', length: 500, nullable: true })
  dataGapIdentified: string;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => AiQuery, (query) => query.featureComparisons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'query_id' })
  query: AiQuery;

  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'college_id' })
  college: College;

  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competitor_college_id' })
  competitorCollege: College;
}