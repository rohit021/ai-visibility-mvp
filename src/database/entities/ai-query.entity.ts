import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { College } from './college.entity';

@Entity('ai_queries')
export class AiQuery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_id' })
  collegeId: number;

  @Column({ name: 'prompt_id' })
  promptId: number;

  @Column({ name: 'prompt_text', type: 'text' })
  promptText: string;

  @Column({ name: 'prompt_category', nullable: true })
  promptCategory: string;

  @Column({
    name: 'ai_engine',
    type: 'enum',
    enum: ['chatgpt', 'claude', 'perplexity'],
    default: 'chatgpt',
  })
  aiEngine: string;

  @CreateDateColumn({ name: 'executed_at' })
  executedAt: Date;

  @Column({
    name: 'execution_status',
    type: 'enum',
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  })
  executionStatus: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'raw_response', type: 'longtext', nullable: true })
  rawResponse: string;

  @Column({ name: 'colleges_mentioned', type: 'json', nullable: true })
  collegesMentioned: string[];

  @Column({ name: 'your_college_mentioned', default: false })
  yourCollegeMentioned: boolean;

  @Column({ name: 'your_college_rank', nullable: true })
  yourCollegeRank: number;

  @Column({ name: 'your_college_context', type: 'text', nullable: true })
  yourCollegeContext: string;

  // NEW: Explicit reasoning from structured prompt (Option 2)
  @Column({ name: 'your_college_reasoning', type: 'text', nullable: true })
  yourCollegeReasoning: string;

  // NEW: Weaknesses identified for your college
  @Column({ name: 'your_college_weaknesses', type: 'json', nullable: true })
  yourCollegeWeaknesses: string[];

  // NEW: Strengths identified for your college
  @Column({ name: 'your_college_strengths', type: 'json', nullable: true })
  yourCollegeStrengths: string[];

  @Column({ name: 'competitors_mentioned', type: 'json', nullable: true })
  competitorsMentioned: {
    name: string;
    rank: number;
    context: string;
    reasoning?: string;
    strengths?: string[];
  }[];

  // NEW: Sources/citations mentioned in response
  @Column({ name: 'sources_cited', type: 'json', nullable: true })
  sourcesCited: string[];

  // NEW: Key ranking factors mentioned by AI
  @Column({ name: 'ranking_factors', type: 'json', nullable: true })
  rankingFactors: string[];

  @Column({ name: 'response_length', nullable: true })
  responseLength: number;

  @Column({ name: 'total_colleges_in_response', nullable: true })
  totalCollegesInResponse: number;

  @ManyToOne(() => College, (college) => college.aiQueries)
  @JoinColumn({ name: 'college_id' })
  college: College;
}
