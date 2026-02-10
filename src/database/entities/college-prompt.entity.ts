import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { College } from './college.entity';
import { Prompt } from './prompt.entity';

@Entity('college_prompts')
@Unique(['collegeId', 'promptId'])
export class CollegePrompt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_id' })
  collegeId: number;

  @Column({ name: 'prompt_id' })
  promptId: number;

  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ name: 'priority', default: 0 })
  priority: number;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;

  // Relations
  @ManyToOne(() => College, (college) => college.prompts)
  @JoinColumn({ name: 'college_id' })
  college: College;

  @ManyToOne(() => Prompt)
  @JoinColumn({ name: 'prompt_id' })
  prompt: Prompt;

  // Indexes for faster queries
  // @Index('idx_college_id')
  // collegeIndex: number;

  // @Index('idx_prompt_id')
  // promptIndex: number;
}
