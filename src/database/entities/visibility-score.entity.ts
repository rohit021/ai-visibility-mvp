import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('visibility_scores')
export class VisibilityScore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_id' })
  collegeId: number;

  @Column({
    name: 'period_type',
    type: 'enum',
    enum: ['daily', 'weekly', 'monthly'],
  })
  periodType: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: Date;

  @Column({ name: 'total_queries' })
  totalQueries: number;

  @Column({ name: 'mentions_count' })
  mentionsCount: number;

  @Column({ name: 'visibility_percentage', type: 'decimal', precision: 5, scale: 2 })
  visibilityPercentage: number;

  @Column({ name: 'average_rank', type: 'decimal', precision: 4, scale: 2, nullable: true })
  averageRank: number;

  @Column({ name: 'category_scores', type: 'json', nullable: true })
  categoryScores: any;

  @Column({ name: 'competitor_scores', type: 'json', nullable: true })
  competitorScores: any[];

  @Column({ name: 'your_rank_among_competitors', nullable: true })
  yourRankAmongCompetitors: number;

  @Column({
    name: 'change_from_previous_period',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  changeFromPreviousPeriod: number;

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;
}
