import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { AiQuery } from './ai-query.entity';
import { QueryCompetitorResult } from './query-competitor-result.entity';
// import { RecommendationCompetitor } from './recommendation-competitor.entity';

@Entity('citation_sources')
export class CitationSource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'source_name', length: 100, unique: true })
  sourceName: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  displayName: string;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: ['aggregator', 'ranking', 'official', 'review', 'news', 'social'],
  })
  sourceType: string;

  @Column({ name: 'website_url', length: 500, nullable: true })
  websiteUrl: string;

  @Column({ name: 'authority_score', type: 'tinyint', default: 5 })
  authorityScore: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => AiQuery, (query) => query.yourCollegeSource)
  aiQueries: AiQuery[];

  @OneToMany(() => QueryCompetitorResult, (result) => result.source)
  competitorResults: QueryCompetitorResult[];

  // @OneToMany(() => RecommendationCompetitor, (rc) => rc.source)
  // recommendationCompetitors: RecommendationCompetitor[];
}
