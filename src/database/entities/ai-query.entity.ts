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

  @Column({ name: 'competitors_mentioned', type: 'json', nullable: true })
  competitorsMentioned: any[];

  @Column({ name: 'response_length', nullable: true })
  responseLength: number;

  @Column({ name: 'total_colleges_in_response', nullable: true })
  totalCollegesInResponse: number;

  @ManyToOne(() => College, (college) => college.aiQueries)
  @JoinColumn({ name: 'college_id' })
  college: College;
}
