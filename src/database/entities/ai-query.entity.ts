import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { College } from './college.entity';
import { Prompt } from './prompt.entity';
import { AiEngine } from './ai-engine.entity';
import { CitationSource } from './citation-source.entity';
import { QueryCompetitorResult } from './query-competitor-result.entity';
// import { RecommendationAffectedQuery } from './recommendation-affected-query.entity';

@Entity('ai_queries')
export class AiQuery {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'college_id' })
  collegeId: number;

  @Index()
  @Column({ name: 'prompt_id' })
  promptId: number;

  @Index()
  @Column({ name: 'ai_engine_id' })
  aiEngineId: number;

  // Query details
  @Column({ name: 'resolved_prompt_text', type: 'text' })
  resolvedPromptText: string;

  @Index()
  @CreateDateColumn({ name: 'executed_at' })
  executedAt: Date;

  @Index()
  @Column({
    name: 'execution_status',
    type: 'enum',
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  })
  executionStatus: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  // Response details
  @Column({ name: 'raw_response', type: 'longtext', nullable: true })
  rawResponse: string;

  @Column({ name: 'response_length', nullable: true })
  responseLength: number;

  @Column({ name: 'total_colleges_in_response', type: 'tinyint', nullable: true })
  totalCollegesInResponse: number;

  // YOUR COLLEGE RESULTS (merged - always 1:1 with query)
  @Index()
  @Column({ name: 'your_college_mentioned', default: false })
  yourCollegeMentioned: boolean;

  @Column({ name: 'your_college_rank', type: 'tinyint', nullable: true })
  yourCollegeRank: number;

  @Column({ name: 'your_college_section', length: 255, nullable: true })
  yourCollegeSection: string;

  @Column({
    name: 'your_college_section_tier',
    type: 'enum',
    enum: ['best_overall', 'strong_private', 'universities_with_engineering', 'other_options', 'not_mentioned', 'unknown'],
    default: 'not_mentioned',
  })
  yourCollegeSectionTier: 'best_overall' | 'strong_private' | 'universities_with_engineering' | 'other_options' | 'not_mentioned' | 'unknown';

  @Column({ name: 'your_college_context', type: 'text', nullable: true })
  yourCollegeContext: string;

  @Column({ name: 'your_college_reasoning', type: 'text', nullable: true })
  yourCollegeReasoning: string;

  @Column({ name: 'your_college_source_id', nullable: true })
  yourCollegeSourceId: number;

  @Column({ name: 'your_college_strengths', type: 'json', nullable: true })
  yourCollegeStrengths: string[];

  @Column({ name: 'your_college_weaknesses', type: 'json', nullable: true })
  yourCollegeWeaknesses: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  
  @Column({ name: 'signal_score', type: 'int', nullable: true })
  signalScore: number;

  @Column({ name: 'response_richness_score', type: 'tinyint', default: 0 })
  responseRichnessScore: number;

  @Column({ name: 'totalCost', type: 'decimal', precision: 10, scale: 7, nullable: true })
  totalCost: number;

  
  @Column({
    name: 'query_layer',
    type: 'enum',
    enum: ['visibility', 'comparison', 'detail'],
    default: 'visibility',
  })
  query_layer: 'visibility' | 'comparison' | 'detail';

  @ManyToOne(() => College, (college) => college.aiQueries)
  @JoinColumn({ name: 'college_id' })
  college: College;

  @ManyToOne(() => Prompt, (prompt) => prompt.aiQueries)
  @JoinColumn({ name: 'prompt_id' })
  prompt: Prompt;

  @ManyToOne(() => AiEngine, (engine) => engine.queries)
  @JoinColumn({ name: 'ai_engine_id' })
  aiEngine: AiEngine;

  @ManyToOne(() => CitationSource, (source) => source.aiQueries, { nullable: true })
  @JoinColumn({ name: 'your_college_source_id' })
  yourCollegeSource: CitationSource;

  @OneToMany(() => QueryCompetitorResult, (result) => result.query)
  competitorResults: QueryCompetitorResult[];

  // @OneToMany(() => RecommendationAffectedQuery, (raq) => raq.query)
  // affectedRecommendations: RecommendationAffectedQuery[];
}
