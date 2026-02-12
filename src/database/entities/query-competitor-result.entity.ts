import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { AiQuery } from './ai-query.entity';
import { College } from './college.entity';
import { CitationSource } from './citation-source.entity';

@Entity('query_competitor_results')
@Unique(['queryId', 'collegeId'])
export class QueryCompetitorResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'query_id' })
  queryId: number;

  @Index()
  @Column({ name: 'college_id' })
  collegeId: number; // compitetor college id

  @Index()
  @Column({ name: 'rank_position', type: 'tinyint', nullable: true })
  rankPosition: number;

  @Column({ length: 255, nullable: true })
  section: string;

  @Column({ type: 'text', nullable: true })
  context: string;

  @Column({ type: 'text', nullable: true })
  reasoning: string;

  @Index()
  @Column({ name: 'source_id', nullable: true })
  sourceId: number;

  @Column({ type: 'json', nullable: true })
  strengths: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'signal_score', type: 'int', nullable: true })
signalScore: number;

  // Relationships
  @ManyToOne(() => AiQuery, (query) => query.competitorResults)
  @JoinColumn({ name: 'query_id' })
  query: AiQuery;


    @ManyToOne(() => College)
  @JoinColumn({ name: 'college_id' })
  college: College;
  // @ManyToOne(() => College, (college) => college.competitorResults)
  // @JoinColumn({ name: 'college_id' })
  // college: College;

  @ManyToOne(() => CitationSource, (source) => source.competitorResults, { nullable: true })
  @JoinColumn({ name: 'source_id' })
  source: CitationSource;
}
